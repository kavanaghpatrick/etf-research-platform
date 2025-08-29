"""
Parallel Data Fetching Implementation - Vercel Optimized
Implements intelligent parallel querying of multiple data sources with regional optimization,
circuit breakers, and distributed rate limiting.
"""

import asyncio
import aiohttp
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Union
from dataclasses import dataclass
from enum import Enum
import json
import random
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed
import os

# Import existing components
try:
    from simple_data_sources import (
        SimpleAlphaVantageSource, SimpleTiingoSource, SimpleFinnhubSource, 
        SimplePolygonSource, YFINANCE_AVAILABLE, FINNHUB_AVAILABLE, POLYGON_AVAILABLE
    )
    if YFINANCE_AVAILABLE:
        from yfinance_source import YFinanceSource
    from sqlite_cache_manager import SQLiteStockDataCache
    from cache_manager import StockDataCache
except ImportError as e:
    logging.warning(f"Import error in parallel fetcher: {e}")

logger = logging.getLogger(__name__)

class SourceStatus(Enum):
    """Source availability status for circuit breaker"""
    HEALTHY = "healthy"
    DEGRADED = "degraded" 
    FAILED = "failed"
    CIRCUIT_OPEN = "circuit_open"

@dataclass
class SourceMetrics:
    """Metrics for a data source"""
    success_rate: float = 1.0
    avg_response_time: float = 1.0
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    consecutive_failures: int = 0
    total_requests: int = 0
    status: SourceStatus = SourceStatus.HEALTHY

@dataclass 
class ParallelFetchResult:
    """Result from parallel data fetching"""
    data: Optional[Dict[str, Any]] = None
    source: Optional[str] = None
    response_time: float = 0.0
    success: bool = False
    error: Optional[str] = None
    from_cache: bool = False

class CircuitBreaker:
    """Circuit breaker for source resilience"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = SourceStatus.HEALTHY
    
    def is_available(self) -> bool:
        """Check if source is available for requests"""
        if self.state == SourceStatus.CIRCUIT_OPEN:
            if (time.time() - self.last_failure_time) > self.recovery_timeout:
                self.state = SourceStatus.DEGRADED
                self.failure_count = 0
                logger.info("Circuit breaker transitioning to DEGRADED state")
                return True
            return False
        return True
    
    def record_success(self):
        """Record successful operation"""
        self.failure_count = 0
        if self.state == SourceStatus.DEGRADED:
            self.state = SourceStatus.HEALTHY
            logger.info("Circuit breaker transitioning to HEALTHY state")
    
    def record_failure(self):
        """Record failed operation"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = SourceStatus.CIRCUIT_OPEN
            logger.warning(f"Circuit breaker OPEN - failure threshold reached: {self.failure_count}")

class RegionalSourceSelector:
    """Intelligent source selection based on region and performance"""
    
    def __init__(self):
        # Regional latency data (simulated - in production would be measured)
        self.regional_latencies = {
            'iad1': {  # US East (N. Virginia) 
                'alphavantage': 50, 'tiingo': 60, 'yfinance': 80, 'finnhub': 70, 'polygon': 90
            },
            'sfo1': {  # US West (San Francisco)
                'alphavantage': 80, 'tiingo': 70, 'yfinance': 60, 'finnhub': 85, 'polygon': 75
            },
            'lhr1': {  # Europe (London)
                'alphavantage': 120, 'tiingo': 100, 'yfinance': 110, 'finnhub': 95, 'polygon': 130
            },
            'sin1': {  # Asia Pacific (Singapore)
                'alphavantage': 200, 'tiingo': 180, 'yfinance': 150, 'finnhub': 160, 'polygon': 190
            }
        }
    
    def select_optimal_sources(self, region: str = 'iad1') -> List[str]:
        """Select optimal sources based on region"""
        latencies = self.regional_latencies.get(region, self.regional_latencies['iad1'])
        
        # Sort by latency (ascending)
        sorted_sources = sorted(latencies.items(), key=lambda x: x[1])
        return [source for source, _ in sorted_sources]

class ThompsonSamplingOptimizer:
    """Thompson Sampling for intelligent source selection"""
    
    def __init__(self):
        # Beta distribution parameters (alpha, beta) for each source
        self.source_params = {}
        self.default_alpha = 1
        self.default_beta = 1
    
    def get_source_params(self, source: str) -> Tuple[float, float]:
        """Get or initialize parameters for a source"""
        if source not in self.source_params:
            self.source_params[source] = [self.default_alpha, self.default_beta]
        return self.source_params[source]
    
    def select_source(self, available_sources: List[str]) -> str:
        """Select source using Thompson Sampling"""
        if not available_sources:
            raise ValueError("No available sources")
        
        if len(available_sources) == 1:
            return available_sources[0]
        
        # Sample from beta distributions
        samples = {}
        for source in available_sources:
            alpha, beta = self.get_source_params(source)
            samples[source] = random.betavariate(alpha, beta)
        
        # Select source with highest sample
        return max(samples.items(), key=lambda x: x[1])[0]
    
    def update_source(self, source: str, success: bool):
        """Update source parameters based on result"""
        alpha, beta = self.get_source_params(source)
        if success:
            self.source_params[source] = [alpha + 1, beta]
        else:
            self.source_params[source] = [alpha, beta + 1]

class ParallelDataFetcher:
    """Main parallel data fetching orchestrator"""
    
    def __init__(self, cache_manager=None, max_concurrent_sources: int = 5):
        self.cache_manager = cache_manager
        self.max_concurrent_sources = max_concurrent_sources
        
        # Initialize components
        self.regional_selector = RegionalSourceSelector()
        self.thompson_optimizer = ThompsonSamplingOptimizer()
        self.circuit_breakers = {}
        self.source_metrics = {}
        
        # Initialize data sources
        self.sources = {}
        self._initialize_sources()
        
        # Rate limiting (in production, would use Redis/Vercel KV)
        self.rate_limits = {}
        self.rate_limit_window = 60  # seconds
        
        logger.info(f"Parallel data fetcher initialized with {len(self.sources)} sources")
    
    def _initialize_sources(self):
        """Initialize available data sources"""
        # Get API keys
        alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        tiingo_key = os.getenv('TIINGO_API_KEY')
        finnhub_key = os.getenv('FINNHUB_API_KEY')
        polygon_key = os.getenv('POLYGON_API_KEY')
        
        # Initialize sources that have API keys
        if alpha_vantage_key:
            self.sources['alphavantage'] = SimpleAlphaVantageSource(api_key=alpha_vantage_key)
            self.circuit_breakers['alphavantage'] = CircuitBreaker()
            self.source_metrics['alphavantage'] = SourceMetrics()
        
        if tiingo_key:
            self.sources['tiingo'] = SimpleTiingoSource(api_key=tiingo_key)
            self.circuit_breakers['tiingo'] = CircuitBreaker()
            self.source_metrics['tiingo'] = SourceMetrics()
        
        # YFinance as fallback (no API key required)
        if YFINANCE_AVAILABLE:
            self.sources['yfinance'] = YFinanceSource()
            self.circuit_breakers['yfinance'] = CircuitBreaker()
            self.source_metrics['yfinance'] = SourceMetrics()
        
        if FINNHUB_AVAILABLE and finnhub_key:
            self.sources['finnhub'] = SimpleFinnhubSource(api_key=finnhub_key)
            self.circuit_breakers['finnhub'] = CircuitBreaker()
            self.source_metrics['finnhub'] = SourceMetrics()
        
        if POLYGON_AVAILABLE and polygon_key:
            self.sources['polygon'] = SimplePolygonSource(api_key=polygon_key)
            self.circuit_breakers['polygon'] = CircuitBreaker()
            self.source_metrics['polygon'] = SourceMetrics()
    
    def _check_rate_limit(self, source: str) -> bool:
        """Check if source is within rate limits"""
        current_time = time.time()
        window_start = current_time - self.rate_limit_window
        
        if source not in self.rate_limits:
            self.rate_limits[source] = []
        
        # Remove old requests
        self.rate_limits[source] = [
            req_time for req_time in self.rate_limits[source] 
            if req_time > window_start
        ]
        
        # Define rate limits per source (per minute)
        limits = {
            'alphavantage': 5,  # Conservative for free tier
            'tiingo': 50,       # Typical API limit
            'yfinance': 100,    # No strict limit but be reasonable
            'finnhub': 60,      # API limit
            'polygon': 5        # Free tier limit
        }
        
        current_requests = len(self.rate_limits[source])
        limit = limits.get(source, 10)  # Default conservative limit
        
        if current_requests >= limit:
            logger.warning(f"Rate limit reached for {source}: {current_requests}/{limit}")
            return False
        
        return True
    
    def _record_request(self, source: str):
        """Record a request for rate limiting"""
        if source not in self.rate_limits:
            self.rate_limits[source] = []
        self.rate_limits[source].append(time.time())
    
    async def _fetch_from_source(self, source_name: str, ticker: str, 
                                start_date: str, end_date: str) -> ParallelFetchResult:
        """Fetch data from a single source with error handling"""
        start_time = time.time()
        
        try:
            # Check circuit breaker
            if not self.circuit_breakers[source_name].is_available():
                return ParallelFetchResult(
                    success=False,
                    error=f"Circuit breaker open for {source_name}",
                    response_time=time.time() - start_time
                )
            
            # Check rate limit
            if not self._check_rate_limit(source_name):
                return ParallelFetchResult(
                    success=False,
                    error=f"Rate limit exceeded for {source_name}",
                    response_time=time.time() - start_time
                )
            
            # Record request
            self._record_request(source_name)
            
            # Get source instance
            source = self.sources[source_name]
            
            # Fetch data with timeout
            try:
                data = await asyncio.wait_for(
                    asyncio.to_thread(source.fetch_data, ticker, start_date, end_date),
                    timeout=5.0  # 5 second timeout per source
                )
                
                response_time = time.time() - start_time
                
                # Record success
                self.circuit_breakers[source_name].record_success()
                self.thompson_optimizer.update_source(source_name, True)
                
                # Update metrics
                metrics = self.source_metrics[source_name]
                metrics.total_requests += 1
                metrics.last_success = datetime.now()
                metrics.consecutive_failures = 0
                metrics.avg_response_time = (
                    (metrics.avg_response_time * (metrics.total_requests - 1) + response_time) / 
                    metrics.total_requests
                )
                
                return ParallelFetchResult(
                    data=data,
                    source=source_name,
                    response_time=response_time,
                    success=True
                )
                
            except asyncio.TimeoutError:
                raise Exception(f"Timeout after 5 seconds")
                
        except Exception as e:
            response_time = time.time() - start_time
            error_msg = str(e)
            
            # Record failure
            self.circuit_breakers[source_name].record_failure()
            self.thompson_optimizer.update_source(source_name, False)
            
            # Update metrics
            metrics = self.source_metrics[source_name]
            metrics.total_requests += 1
            metrics.last_failure = datetime.now()
            metrics.consecutive_failures += 1
            
            logger.warning(f"Source {source_name} failed: {error_msg}")
            
            return ParallelFetchResult(
                success=False,
                error=error_msg,
                response_time=response_time,
                source=source_name
            )
    
    async def fetch_parallel(self, ticker: str, start_date: str, end_date: str,
                           region: str = 'iad1') -> ParallelFetchResult:
        """
        Fetch data using parallel source strategy
        
        Strategy:
        1. Check cache first
        2. Get optimal sources for region
        3. Use Thompson Sampling to prioritize
        4. Fetch from multiple sources in parallel
        5. Return first successful result
        6. Fall back to any successful result if first fails
        """
        
        # Check cache first
        if self.cache_manager:
            try:
                cached_data = self.cache_manager.get_cached_data(ticker, start_date, end_date)
                if cached_data is not None and len(cached_data) > 0:
                    logger.info(f"Cache hit for {ticker}")
                    return ParallelFetchResult(
                        data=cached_data,
                        source="cache",
                        response_time=0.001,  # Very fast cache access
                        success=True,
                        from_cache=True
                    )
            except Exception as e:
                logger.warning(f"Cache check failed: {e}")
        
        # Get available sources
        available_sources = [
            name for name, breaker in self.circuit_breakers.items()
            if breaker.is_available() and self._check_rate_limit(name)
        ]
        
        if not available_sources:
            return ParallelFetchResult(
                success=False,
                error="No available sources (circuit breakers open or rate limited)"
            )
        
        # Select optimal sources based on region
        regional_sources = self.regional_selector.select_optimal_sources(region)
        prioritized_sources = [s for s in regional_sources if s in available_sources]
        
        # Add any remaining available sources
        for source in available_sources:
            if source not in prioritized_sources:
                prioritized_sources.append(source)
        
        # Limit concurrent sources
        sources_to_query = prioritized_sources[:self.max_concurrent_sources]
        
        logger.info(f"Querying {len(sources_to_query)} sources in parallel for {ticker}: {sources_to_query}")
        
        # Create fetch tasks
        fetch_tasks = [
            self._fetch_from_source(source, ticker, start_date, end_date)
            for source in sources_to_query
        ]
        
        # Wait for first successful result or all to complete
        successful_result = None
        completed_tasks = 0
        
        try:
            # Use as_completed to get results as they finish
            for coro in asyncio.as_completed(fetch_tasks, timeout=10.0):
                try:
                    result = await coro
                    completed_tasks += 1
                    
                    if result.success and successful_result is None:
                        # First successful result - cache it and return
                        successful_result = result
                        
                        if self.cache_manager and result.data:
                            try:
                                self.cache_manager.cache_data(ticker, result.data)
                                logger.info(f"Cached data for {ticker} from {result.source}")
                            except Exception as e:
                                logger.warning(f"Failed to cache data: {e}")
                        
                        # Cancel remaining tasks to save resources
                        for task in fetch_tasks:
                            if not task.done():
                                task.cancel()
                        
                        return successful_result
                        
                except Exception as e:
                    logger.warning(f"Task failed: {e}")
                    completed_tasks += 1
            
            # If we get here, no source succeeded
            return ParallelFetchResult(
                success=False,
                error=f"All {len(sources_to_query)} sources failed"
            )
            
        except asyncio.TimeoutError:
            logger.warning(f"Parallel fetch timeout for {ticker}")
            return ParallelFetchResult(
                success=False,
                error="Parallel fetch timeout"
            )
    
    def get_source_health(self) -> Dict[str, Dict[str, Any]]:
        """Get health status of all sources"""
        health_status = {}
        
        for source_name, metrics in self.source_metrics.items():
            circuit_breaker = self.circuit_breakers[source_name]
            
            health_status[source_name] = {
                'status': circuit_breaker.state.value,
                'success_rate': metrics.success_rate,
                'avg_response_time': metrics.avg_response_time,
                'total_requests': metrics.total_requests,
                'consecutive_failures': metrics.consecutive_failures,
                'last_success': metrics.last_success.isoformat() if metrics.last_success else None,
                'last_failure': metrics.last_failure.isoformat() if metrics.last_failure else None
            }
        
        return health_status
    
    async def batch_fetch_parallel(self, tickers: List[str], start_date: str, end_date: str,
                                 region: str = 'iad1', max_concurrent: int = 10) -> Dict[str, ParallelFetchResult]:
        """
        Fetch data for multiple tickers in parallel with concurrency control
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def fetch_with_semaphore(ticker):
            async with semaphore:
                return ticker, await self.fetch_parallel(ticker, start_date, end_date, region)
        
        # Create tasks for all tickers
        tasks = [fetch_with_semaphore(ticker) for ticker in tickers]
        
        # Execute with progress tracking
        results = {}
        completed = 0
        
        for coro in asyncio.as_completed(tasks):
            ticker, result = await coro
            results[ticker] = result
            completed += 1
            
            if completed % 5 == 0 or completed == len(tickers):
                logger.info(f"Batch fetch progress: {completed}/{len(tickers)} completed")
        
        return results

# Convenience function for easy integration
def create_parallel_fetcher(cache_manager=None) -> ParallelDataFetcher:
    """Create a parallel data fetcher instance"""
    return ParallelDataFetcher(cache_manager=cache_manager)