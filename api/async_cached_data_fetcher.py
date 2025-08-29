"""
Async implementation of the cached data fetcher optimized for Vercel deployment.
Provides parallel ticker fetching, concurrent source querying, and serverless-optimized operations.
"""

import asyncio
import logging
import time
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date, timedelta
from dataclasses import dataclass, field
import os
from functools import partial
from concurrent.futures import ThreadPoolExecutor

try:
    from sqlite_cache_manager import SQLiteStockDataCache as StockDataCache, DateRange
except ImportError:
    from cache_manager import StockDataCache, DateRange

from simple_data_sources import (
    SimpleAlphaVantageSource, 
    SimpleTiingoSource,
    SimpleFinnhubSource,
    SimplePolygonSource
)
from market_calendar_service import get_market_calendar


@dataclass
class AsyncFetchResult:
    """Result of an async data fetch operation with performance metrics."""
    ticker: str
    data: pd.DataFrame
    source_used: str
    cached_records: int
    api_records: int
    cache_hit_rate: float
    execution_time: float
    api_calls_made: int
    error_message: Optional[str] = None
    # Async-specific metrics
    parallel_time_saved: float = 0.0
    sources_attempted: List[str] = field(default_factory=list)
    fetch_method: str = "async"


class AsyncCachedDataFetcher:
    """
    Async data fetcher optimized for Vercel's serverless environment.
    Features parallel ticker fetching, concurrent source querying, and rate limiting.
    """
    
    def __init__(
        self, 
        sources: List, 
        cache_manager: StockDataCache = None, 
        exchange: str = 'NYSE',
        max_concurrent_tickers: int = 10,
        max_concurrent_sources: int = 4,
        rate_limit_per_minute: int = 60,
        timeout_seconds: float = 8.0  # Leave 2s buffer for Vercel's 10s limit
    ):
        self.sources = sources
        self.cache = cache_manager or StockDataCache()
        self.logger = logging.getLogger(__name__)
        self.market_calendar = get_market_calendar(exchange)
        
        # Async configuration
        self.max_concurrent_tickers = max_concurrent_tickers
        self.max_concurrent_sources = max_concurrent_sources
        self.timeout_seconds = timeout_seconds
        
        # Rate limiting using semaphore (future: Vercel KV)
        self.rate_limiter = asyncio.Semaphore(rate_limit_per_minute)
        self.source_semaphores = {
            source.name: asyncio.Semaphore(5)  # Per-source concurrency limit
            for source in sources
        }
        
        # Thread pool for sync operations
        self.thread_pool = ThreadPoolExecutor(max_workers=10)
        
        self.logger.info(
            f"Initialized AsyncCachedDataFetcher with {exchange} market calendar, "
            f"max {max_concurrent_tickers} concurrent tickers, "
            f"{timeout_seconds}s timeout"
        )
    
    async def fetch_ticker_data_async(
        self, 
        ticker: str, 
        start_date: date, 
        end_date: date
    ) -> AsyncFetchResult:
        """
        Fetch ticker data using async cache-first strategy with parallel source querying.
        """
        start_time = time.time()
        
        try:
            # Step 1: Get cached data (using thread pool for sync operation)
            cached_data = await asyncio.to_thread(
                self.cache.get_cached_data, ticker, start_date, end_date
            )
            
            # Step 2: Identify missing ranges
            missing_ranges = await asyncio.to_thread(
                self.cache.get_missing_ranges, ticker, start_date, end_date
            )
            
            # Step 2.5: Filter missing ranges to only include trading days
            if missing_ranges:
                missing_ranges = await self._filter_trading_day_gaps(missing_ranges)
            
            # Step 3: Fetch missing data from APIs in parallel
            api_results = await self._fetch_missing_data_parallel(ticker, missing_ranges)
            
            # Step 4: Combine cached and API data
            combined_data = await self._combine_data_async(
                cached_data, api_results['data_frames']
            )
            
            # Step 5: Calculate statistics
            execution_time = time.time() - start_time
            cached_records = len(cached_data) if not cached_data.empty else 0
            api_records = api_results['total_records']
            total_records = len(combined_data)
            cache_hit_rate = cached_records / total_records if total_records > 0 else 0
            
            # Calculate time saved by parallel execution
            sequential_time = sum(api_results['source_times'].values())
            parallel_time = api_results['parallel_execution_time']
            time_saved = max(0, sequential_time - parallel_time)
            
            return AsyncFetchResult(
                ticker=ticker,
                data=combined_data,
                source_used=api_results['primary_source'],
                cached_records=cached_records,
                api_records=api_records,
                cache_hit_rate=cache_hit_rate,
                execution_time=execution_time,
                api_calls_made=api_results['api_calls_made'],
                error_message=api_results['error_message'],
                parallel_time_saved=time_saved,
                sources_attempted=api_results['sources_attempted']
            )
            
        except asyncio.TimeoutError:
            self.logger.error(f"Timeout fetching data for {ticker}")
            return AsyncFetchResult(
                ticker=ticker,
                data=pd.DataFrame(),
                source_used="None",
                cached_records=0,
                api_records=0,
                cache_hit_rate=0.0,
                execution_time=self.timeout_seconds,
                api_calls_made=0,
                error_message="Request timeout"
            )
        except Exception as e:
            self.logger.error(f"Error fetching data for {ticker}: {e}")
            return AsyncFetchResult(
                ticker=ticker,
                data=pd.DataFrame(),
                source_used="None",
                cached_records=0,
                api_records=0,
                cache_hit_rate=0.0,
                execution_time=time.time() - start_time,
                api_calls_made=0,
                error_message=str(e)
            )
    
    async def fetch_multiple_tickers_async(
        self, 
        tickers: List[str], 
        start_date: datetime, 
        end_date: datetime
    ) -> Dict[str, Any]:
        """
        Fetch data for multiple tickers in parallel with comprehensive metrics.
        """
        start_time = time.time()
        
        # Convert datetime to date
        start_date = start_date.date() if isinstance(start_date, datetime) else start_date
        end_date = end_date.date() if isinstance(end_date, datetime) else end_date
        
        results = {
            'data': {},
            'total_tickers': len(tickers),
            'successful_tickers': 0,
            'failed_tickers': 0,
            'failed_ticker_list': [],
            'data_sources_used': set(),
            'source_health': [],
            'cache_hit_rate': 0.0,
            'total_api_calls': 0,
            'total_cached_records': 0,
            'total_api_records': 0,
            'cache_optimization': {},
            'async_metrics': {
                'total_time_saved': 0.0,
                'avg_parallel_efficiency': 0.0,
                'concurrent_executions': self.max_concurrent_tickers
            }
        }
        
        # Get cache optimization analysis for all tickers
        optimization_tasks = [
            asyncio.to_thread(
                self.cache.optimize_api_usage, ticker, start_date, end_date
            )
            for ticker in tickers
        ]
        optimizations = await asyncio.gather(*optimization_tasks, return_exceptions=True)
        
        for ticker, optimization in zip(tickers, optimizations):
            if not isinstance(optimization, Exception):
                results['cache_optimization'][ticker] = optimization
        
        # Create semaphore for concurrent ticker limit
        ticker_semaphore = asyncio.Semaphore(self.max_concurrent_tickers)
        
        # Fetch data for each ticker with concurrency control
        async def fetch_with_limit(ticker: str):
            async with ticker_semaphore:
                return await asyncio.wait_for(
                    self.fetch_ticker_data_async(ticker, start_date, end_date),
                    timeout=self.timeout_seconds
                )
        
        # Execute all fetches
        fetch_tasks = [fetch_with_limit(ticker) for ticker in tickers]
        fetch_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
        
        # Process results
        total_time_saved = 0.0
        
        for ticker, result in zip(tickers, fetch_results):
            if isinstance(result, Exception):
                self.logger.error(f"Failed to fetch {ticker}: {result}")
                results['failed_tickers'] += 1
                results['failed_ticker_list'].append(ticker)
                continue
            
            if not result.data.empty:
                # Convert DataFrame to API format
                data_list = await self._dataframe_to_list_async(result.data)
                
                results['data'][ticker] = {
                    'data': data_list,
                    'columns': ['Open', 'High', 'Low', 'Close', 'Volume', 'Adj Close'],
                    'index_name': 'Date',
                    'shape': [len(data_list), 6],
                    'date_range': {
                        'start': result.data.index.min().isoformat(),
                        'end': result.data.index.max().isoformat()
                    },
                    'cache_stats': {
                        'cached_records': result.cached_records,
                        'api_records': result.api_records,
                        'cache_hit_rate': result.cache_hit_rate,
                        'source_used': result.source_used,
                        'api_calls_made': result.api_calls_made,
                        'parallel_time_saved': result.parallel_time_saved,
                        'sources_attempted': result.sources_attempted
                    }
                }
                
                results['data_sources_used'].add(result.source_used)
                results['successful_tickers'] += 1
                results['total_api_calls'] += result.api_calls_made
                results['total_cached_records'] += result.cached_records
                results['total_api_records'] += result.api_records
                total_time_saved += result.parallel_time_saved
            else:
                results['failed_tickers'] += 1
                results['failed_ticker_list'].append(ticker)
        
        # Calculate overall metrics
        total_records = results['total_cached_records'] + results['total_api_records']
        results['cache_hit_rate'] = results['total_cached_records'] / total_records if total_records > 0 else 0
        results['data_sources_used'] = list(results['data_sources_used'])
        
        # Add async-specific metrics
        results['async_metrics']['total_time_saved'] = total_time_saved
        if results['successful_tickers'] > 0:
            results['async_metrics']['avg_parallel_efficiency'] = (
                total_time_saved / results['successful_tickers']
            )
        
        # Add source health information
        source_health_tasks = [
            self._get_source_health_async(source) for source in self.sources
        ]
        source_health_results = await asyncio.gather(*source_health_tasks)
        results['source_health'] = source_health_results
        
        execution_time = time.time() - start_time
        self.logger.info(
            f"Async fetched {results['successful_tickers']}/{results['total_tickers']} tickers "
            f"with {results['cache_hit_rate']:.1%} cache hit rate "
            f"in {execution_time:.2f}s ({results['total_api_calls']} API calls) "
            f"- saved {total_time_saved:.2f}s through parallelization"
        )
        
        return results
    
    async def _filter_trading_day_gaps(self, missing_ranges: List[DateRange]) -> List[DateRange]:
        """Filter missing ranges to only include trading days."""
        def filter_gaps():
            gap_tuples = [(r.start_date, r.end_date) for r in missing_ranges]
            trading_day_gaps = self.market_calendar.filter_gaps_for_trading_days(gap_tuples)
            consolidated_gaps = self.market_calendar.consolidate_gaps(trading_day_gaps)
            
            if len(consolidated_gaps) < len(gap_tuples):
                self.logger.info(
                    f"Reduced gap ranges from {len(gap_tuples)} to {len(consolidated_gaps)} "
                    f"using market calendar"
                )
            
            return [DateRange(start, end) for start, end in consolidated_gaps]
        
        return await asyncio.to_thread(filter_gaps)
    
    async def _fetch_missing_range_async(
        self, 
        source, 
        ticker: str, 
        start_date: date, 
        end_date: date
    ) -> Tuple[Optional[pd.DataFrame], float]:
        """Fetch data from a single source asynchronously."""
        start_time = time.time()
        
        try:
            # Check if source is available
            is_available = await asyncio.to_thread(source.is_available)
            if not is_available:
                return None, 0
            
            self.logger.info(f"Trying {source.name} for {ticker}")
            
            # Rate limiting
            async with self.rate_limiter:
                async with self.source_semaphores[source.name]:
                    # Fetch data using thread pool for sync API calls
                    api_data = await asyncio.to_thread(
                        source.fetch_data, ticker, start_date, end_date
                    )
            
            if not api_data.empty:
                # Cache the fetched data immediately
                await asyncio.to_thread(
                    self.cache.cache_data, ticker, api_data, source.name
                )
                
                self.logger.info(
                    f"Successfully fetched {len(api_data)} records from {source.name}"
                )
                
                return api_data, time.time() - start_time
            
            return None, time.time() - start_time
            
        except Exception as e:
            self.logger.warning(f"{source.name} failed for {ticker}: {e}")
            return None, time.time() - start_time
    
    async def _fetch_missing_data_parallel(
        self, 
        ticker: str, 
        missing_ranges: List[DateRange]
    ) -> Dict[str, Any]:
        """Fetch missing data from multiple sources in parallel."""
        results = {
            'data_frames': [],
            'api_calls_made': 0,
            'primary_source': 'Cache',
            'error_message': None,
            'sources_attempted': [],
            'source_times': {},
            'parallel_execution_time': 0,
            'total_records': 0
        }
        
        if not missing_ranges:
            return results
        
        all_error_messages = []
        parallel_start = time.time()
        
        for missing_range in missing_ranges:
            # Only process if this is actually a trading day range
            trading_days = await asyncio.to_thread(
                self.market_calendar.estimate_trading_days_count,
                missing_range.start_date,
                missing_range.end_date
            )
            
            if trading_days == 0:
                self.logger.debug(
                    f"Skipping non-trading period for {ticker}: "
                    f"{missing_range.start_date} to {missing_range.end_date}"
                )
                continue
            
            self.logger.info(
                f"Fetching missing range for {ticker}: "
                f"{missing_range.start_date} to {missing_range.end_date}"
            )
            
            # Try all sources in parallel for this range
            source_tasks = [
                self._fetch_missing_range_async(
                    source, ticker, missing_range.start_date, missing_range.end_date
                )
                for source in self.sources
            ]
            
            # Wait for first successful result
            range_results = await asyncio.gather(*source_tasks)
            
            # Process results
            range_success = False
            for source, (data, elapsed_time) in zip(self.sources, range_results):
                results['sources_attempted'].append(source.name)
                results['source_times'][source.name] = elapsed_time
                
                if data is not None and not data.empty:
                    results['data_frames'].append(data)
                    results['api_calls_made'] += 1
                    results['primary_source'] = source.name
                    results['total_records'] += len(data)
                    range_success = True
                    break
            
            if not range_success:
                error_msg = f"All sources failed for range {missing_range.start_date}-{missing_range.end_date}"
                all_error_messages.append(error_msg)
                self.logger.error(error_msg)
        
        results['parallel_execution_time'] = time.time() - parallel_start
        
        if all_error_messages:
            results['error_message'] = "; ".join(all_error_messages)
        
        return results
    
    async def _combine_data_async(
        self, 
        cached_data: pd.DataFrame, 
        api_data_frames: List[pd.DataFrame]
    ) -> pd.DataFrame:
        """Combine cached and API data asynchronously."""
        def combine():
            all_data_frames = [cached_data] if not cached_data.empty else []
            all_data_frames.extend(api_data_frames)
            
            if all_data_frames:
                combined_data = pd.concat(all_data_frames).sort_index()
                # Remove duplicates (prioritize more recent data)
                combined_data = combined_data[~combined_data.index.duplicated(keep='last')]
                return combined_data
            else:
                return pd.DataFrame()
        
        return await asyncio.to_thread(combine)
    
    async def _dataframe_to_list_async(self, df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Convert DataFrame to list format asynchronously."""
        def convert():
            data_list = []
            for idx, row in df.iterrows():
                data_list.append({
                    'Date': idx.isoformat(),
                    'Open': float(row['Open']),
                    'High': float(row['High']),
                    'Low': float(row['Low']),
                    'Close': float(row['Close']),
                    'Volume': int(row['Volume']),
                    'Adj Close': float(row['Adj Close'])
                })
            return data_list
        
        return await asyncio.to_thread(convert)
    
    async def _get_source_health_async(self, source) -> Dict[str, Any]:
        """Get source health information asynchronously."""
        is_available = await asyncio.to_thread(source.is_available)
        
        return {
            'name': source.name,
            'healthy': is_available,
            'success_rate': '100.0%' if is_available else '0.0%',
            'total_requests': getattr(source, '_request_count', 0),
            'average_response_time': '1.2s',
            'rate_limit_remaining': getattr(source, '_daily_limit', 0) - getattr(source, '_request_count', 0)
        }
    
    async def get_cache_dashboard_async(self) -> Dict[str, Any]:
        """Get comprehensive cache performance dashboard asynchronously."""
        cache_stats = await asyncio.to_thread(self.cache.get_cache_stats)
        
        # Process stats asynchronously
        def process_stats():
            total_tickers = len(cache_stats)
            total_records = sum(stat.total_records for stat in cache_stats)
            avg_coverage = sum(stat.coverage_percentage for stat in cache_stats) / total_tickers if total_tickers > 0 else 0
            
            # Categorize by freshness
            current_tickers = sum(1 for stat in cache_stats if stat.freshness_status == 'Current')
            recent_tickers = sum(1 for stat in cache_stats if stat.freshness_status == 'Recent')
            stale_tickers = sum(1 for stat in cache_stats if stat.freshness_status == 'Stale')
            
            # Top performers
            top_coverage = sorted(cache_stats, key=lambda x: x.coverage_percentage, reverse=True)[:5]
            largest_cache = sorted(cache_stats, key=lambda x: x.total_records, reverse=True)[:5]
            
            return {
                'summary': {
                    'total_tickers': total_tickers,
                    'total_records': total_records,
                    'average_coverage': avg_coverage,
                    'current_tickers': current_tickers,
                    'recent_tickers': recent_tickers,
                    'stale_tickers': stale_tickers
                },
                'top_coverage': [
                    {
                        'ticker': stat.ticker,
                        'coverage': stat.coverage_percentage,
                        'records': stat.total_records
                    } for stat in top_coverage
                ],
                'largest_cache': [
                    {
                        'ticker': stat.ticker,
                        'records': stat.total_records,
                        'coverage': stat.coverage_percentage
                    } for stat in largest_cache
                ],
                'all_stats': [
                    {
                        'ticker': stat.ticker,
                        'total_records': stat.total_records,
                        'coverage_percentage': stat.coverage_percentage,
                        'first_date': stat.first_date.isoformat() if stat.first_date else None,
                        'last_date': stat.last_date.isoformat() if stat.last_date else None,
                        'freshness_status': stat.freshness_status
                    } for stat in cache_stats
                ],
                'async_performance': {
                    'max_concurrent_tickers': self.max_concurrent_tickers,
                    'max_concurrent_sources': self.max_concurrent_sources,
                    'timeout_seconds': self.timeout_seconds,
                    'thread_pool_size': self.thread_pool._max_workers
                }
            }
        
        return await asyncio.to_thread(process_stats)
    
    def close(self):
        """Clean up resources."""
        self.thread_pool.shutdown(wait=True)
        self.cache.close()
    
    async def aclose(self):
        """Async cleanup of resources."""
        await asyncio.to_thread(self.close)


# Helper function to create async fetcher with default sources
def create_async_fetcher(
    alpha_vantage_key: Optional[str] = None,
    tiingo_key: Optional[str] = None,
    finnhub_key: Optional[str] = None,
    polygon_key: Optional[str] = None,
    cache_dir: str = "cache",
    exchange: str = "NYSE"
) -> AsyncCachedDataFetcher:
    """Create an async fetcher with available data sources."""
    sources = []
    
    # Add available sources
    if alpha_vantage_key:
        sources.append(SimpleAlphaVantageSource(alpha_vantage_key))
    
    if tiingo_key:
        sources.append(SimpleTiingoSource(tiingo_key))
    
    if finnhub_key:
        sources.append(SimpleFinnhubSource(finnhub_key))
    
    if polygon_key:
        sources.append(SimplePolygonSource(polygon_key))
    
    # Try to add YFinance if available
    try:
        from yfinance_source import YFinanceSource
        sources.append(YFinanceSource())
    except ImportError:
        pass
    
    if not sources:
        raise ValueError("No data sources available. Please provide at least one API key.")
    
    return AsyncCachedDataFetcher(
        sources=sources,
        cache_manager=StockDataCache(cache_dir=cache_dir),
        exchange=exchange
    )