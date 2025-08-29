"""
Async Parallel Integration Layer
Integrates the parallel data fetcher with the existing async FastAPI endpoints
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from parallel_data_fetcher import ParallelDataFetcher, ParallelFetchResult, create_parallel_fetcher

logger = logging.getLogger(__name__)

class AsyncParallelDataManager:
    """
    Integration layer that manages parallel data fetching within the async architecture
    """
    
    def __init__(self, cache_manager=None):
        self.cache_manager = cache_manager
        self.parallel_fetcher = create_parallel_fetcher(cache_manager)
        self.stats = {
            'total_requests': 0,
            'cache_hits': 0,
            'parallel_fetches': 0,
            'total_response_time': 0.0,
            'source_usage': {}
        }
        logger.info("Async parallel data manager initialized")
    
    async def fetch_ticker_data_parallel(self, ticker: str, start_date: str, end_date: str, 
                                       region: str = 'iad1') -> Dict[str, Any]:
        """
        Fetch data for a single ticker using parallel strategy
        Returns the same format as the existing async fetcher for compatibility
        """
        start_time = time.time()
        self.stats['total_requests'] += 1
        
        try:
            # Use parallel fetcher
            result = await self.parallel_fetcher.fetch_parallel(ticker, start_date, end_date, region)
            
            response_time = time.time() - start_time
            self.stats['total_response_time'] += response_time
            
            if result.success:
                # Update stats
                if result.from_cache:
                    self.stats['cache_hits'] += 1
                else:
                    self.stats['parallel_fetches'] += 1
                    source = result.source or 'unknown'
                    self.stats['source_usage'][source] = self.stats['source_usage'].get(source, 0) + 1
                
                # Convert to expected format
                if isinstance(result.data, dict) and 'data' in result.data:
                    # Data is already in expected format
                    ticker_data = result.data['data']
                elif isinstance(result.data, list):
                    # Data is a list of records
                    ticker_data = result.data
                else:
                    # Handle other formats (including pandas DataFrame)
                    import pandas as pd
                    if isinstance(result.data, pd.DataFrame):
                        # Convert DataFrame to list of records
                        ticker_data = result.data.to_dict('records')
                    elif result.data is not None:
                        ticker_data = result.data
                    else:
                        ticker_data = []
                
                # Return in expected format
                return {
                    'data': ticker_data,
                    'ticker': ticker,
                    'source': result.source,
                    'response_time': response_time,
                    'from_cache': result.from_cache,
                    'parallel_fetch': True,
                    'date_range': {
                        'start': start_date,
                        'end': end_date
                    },
                    'cache_stats': {
                        'cache_hit_rate': 1.0 if result.from_cache else 0.0,
                        'cached_records': len(ticker_data) if result.from_cache else 0,
                        'api_records': len(ticker_data) if not result.from_cache else 0,
                        'api_calls_made': 0 if result.from_cache else 1
                    }
                }
            else:
                # Handle failure
                logger.error(f"Parallel fetch failed for {ticker}: {result.error}")
                raise Exception(f"Failed to fetch data for {ticker}: {result.error}")
                
        except Exception as e:
            response_time = time.time() - start_time
            self.stats['total_response_time'] += response_time
            logger.error(f"Error in parallel fetch for {ticker}: {e}")
            raise
    
    async def fetch_multiple_tickers_parallel(self, tickers: List[str], start_date: str, end_date: str,
                                            region: str = 'iad1', max_concurrent: int = 10) -> Dict[str, Dict[str, Any]]:
        """
        Fetch data for multiple tickers using parallel strategy
        Returns the same format as the existing async fetcher for compatibility
        """
        start_time = time.time()
        
        try:
            # Use batch parallel fetcher
            results = await self.parallel_fetcher.batch_fetch_parallel(
                tickers, start_date, end_date, region, max_concurrent
            )
            
            # Convert results to expected format
            formatted_results = {}
            total_response_time = time.time() - start_time
            
            for ticker, result in results.items():
                if result.success:
                    # Update stats
                    if result.from_cache:
                        self.stats['cache_hits'] += 1
                    else:
                        self.stats['parallel_fetches'] += 1
                        source = result.source or 'unknown'
                        self.stats['source_usage'][source] = self.stats['source_usage'].get(source, 0) + 1
                    
                    # Convert to expected format
                    if isinstance(result.data, dict) and 'data' in result.data:
                        ticker_data = result.data['data']
                    elif isinstance(result.data, list):
                        ticker_data = result.data
                    else:
                        # Handle other formats (including pandas DataFrame)
                        import pandas as pd
                        if isinstance(result.data, pd.DataFrame):
                            # Convert DataFrame to list of records
                            ticker_data = result.data.to_dict('records')
                        elif result.data is not None:
                            ticker_data = result.data
                        else:
                            ticker_data = []
                    
                    formatted_results[ticker] = {
                        'data': ticker_data,
                        'ticker': ticker,
                        'source': result.source,
                        'response_time': result.response_time,
                        'from_cache': result.from_cache,
                        'parallel_fetch': True,
                        'date_range': {
                            'start': start_date,
                            'end': end_date
                        },
                        'cache_stats': {
                            'cache_hit_rate': 1.0 if result.from_cache else 0.0,
                            'cached_records': len(ticker_data) if result.from_cache else 0,
                            'api_records': len(ticker_data) if not result.from_cache else 0,
                            'api_calls_made': 0 if result.from_cache else 1
                        }
                    }
                else:
                    # Handle individual ticker failure
                    logger.warning(f"Parallel fetch failed for {ticker}: {result.error}")
                    formatted_results[ticker] = {
                        'data': [],
                        'ticker': ticker,
                        'source': None,
                        'response_time': result.response_time,
                        'from_cache': False,
                        'parallel_fetch': True,
                        'error': result.error,
                        'date_range': {
                            'start': start_date,
                            'end': end_date
                        },
                        'cache_stats': {
                            'cache_hit_rate': 0.0,
                            'cached_records': 0,
                            'api_records': 0,
                            'api_calls_made': 0
                        }
                    }
            
            self.stats['total_requests'] += len(tickers)
            self.stats['total_response_time'] += total_response_time
            
            return formatted_results
            
        except Exception as e:
            total_response_time = time.time() - start_time
            self.stats['total_response_time'] += total_response_time
            logger.error(f"Error in batch parallel fetch: {e}")
            raise
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for monitoring"""
        avg_response_time = (
            self.stats['total_response_time'] / self.stats['total_requests'] 
            if self.stats['total_requests'] > 0 else 0
        )
        
        cache_hit_rate = (
            self.stats['cache_hits'] / self.stats['total_requests']
            if self.stats['total_requests'] > 0 else 0
        )
        
        return {
            'total_requests': self.stats['total_requests'],
            'cache_hits': self.stats['cache_hits'],
            'parallel_fetches': self.stats['parallel_fetches'],
            'avg_response_time': avg_response_time,
            'cache_hit_rate': cache_hit_rate,
            'source_usage': self.stats['source_usage'],
            'source_health': self.parallel_fetcher.get_source_health()
        }
    
    def reset_stats(self):
        """Reset performance statistics"""
        self.stats = {
            'total_requests': 0,
            'cache_hits': 0,
            'parallel_fetches': 0,
            'total_response_time': 0.0,
            'source_usage': {}
        }
        logger.info("Performance stats reset")

class ParallelAsyncCachedDataFetcher:
    """
    Drop-in replacement for AsyncCachedDataFetcher that uses parallel fetching
    Maintains the same interface for easy integration
    """
    
    def __init__(self, cache_manager=None):
        self.cache_manager = cache_manager
        self.parallel_manager = AsyncParallelDataManager(cache_manager)
        self.sources = []  # Compatibility with existing code
        logger.info("Parallel async cached data fetcher initialized")
    
    async def fetch_data_for_ticker_async(self, ticker: str, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Async method to fetch data for a single ticker using parallel strategy
        Compatible with existing AsyncCachedDataFetcher interface
        """
        return await self.parallel_manager.fetch_ticker_data_parallel(ticker, start_date, end_date)
    
    async def fetch_data_for_tickers_async(self, tickers: List[str], start_date: str, end_date: str) -> Dict[str, Dict[str, Any]]:
        """
        Async method to fetch data for multiple tickers using parallel strategy
        Compatible with existing AsyncCachedDataFetcher interface
        """
        return await self.parallel_manager.fetch_multiple_tickers_parallel(tickers, start_date, end_date)
    
    def get_cache_coverage(self, ticker: str) -> Dict[str, Any]:
        """Get cache coverage info (compatibility method)"""
        if self.cache_manager:
            return self.cache_manager.get_cache_coverage(ticker)
        return {'coverage': 0, 'gaps': []}
    
    def get_available_sources(self) -> List[str]:
        """Get list of available sources"""
        return list(self.parallel_manager.parallel_fetcher.sources.keys())
    
    def get_source_health(self) -> Dict[str, Any]:
        """Get source health information"""
        return self.parallel_manager.parallel_fetcher.get_source_health()
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return self.parallel_manager.get_performance_stats()

# Factory function for easy integration
def create_parallel_async_fetcher(cache_manager=None) -> ParallelAsyncCachedDataFetcher:
    """Create a parallel async data fetcher instance"""
    return ParallelAsyncCachedDataFetcher(cache_manager=cache_manager)