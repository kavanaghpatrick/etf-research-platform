"""
Highly resilient data fetching engine with advanced error handling,
rate limit management, and data quality assurance.
"""

import os
import time
import random
import logging
import json
import threading
from typing import Dict, List, Optional, Union, Set, Tuple, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor, as_completed
import pandas as pd
import numpy as np
from pathlib import Path

from ..utils import Config, load_config
from .cache import DataCache
from .sources import DataSource, YFinanceSource, AlphaVantageSource, FinnhubSource, TiingoSource


@dataclass
class SourceStatus:
    """Track health and performance of a data source."""
    name: str
    available: bool = True
    last_success: Optional[datetime] = None
    last_failure: Optional[datetime] = None
    consecutive_failures: int = 0
    total_requests: int = 0
    successful_requests: int = 0
    average_response_time: float = 0.0
    rate_limit_hits: int = 0
    last_rate_limit: Optional[datetime] = None
    backoff_until: Optional[datetime] = None
    
    @property
    def success_rate(self) -> float:
        if self.total_requests == 0:
            return 0.0
        return self.successful_requests / self.total_requests
    
    @property
    def is_healthy(self) -> bool:
        # Source is healthy if available and not in backoff
        if not self.available:
            return False
        if self.backoff_until and datetime.now() < self.backoff_until:
            return False
        return True
    
    def record_success(self, response_time: float):
        """Record a successful request."""
        self.last_success = datetime.now()
        self.consecutive_failures = 0
        self.total_requests += 1
        self.successful_requests += 1
        
        # Update rolling average response time
        alpha = 0.1  # Exponential moving average factor
        self.average_response_time = (
            alpha * response_time + (1 - alpha) * self.average_response_time
        )
    
    def record_failure(self, is_rate_limit: bool = False):
        """Record a failed request."""
        self.last_failure = datetime.now()
        self.consecutive_failures += 1
        self.total_requests += 1
        
        if is_rate_limit:
            self.rate_limit_hits += 1
            self.last_rate_limit = datetime.now()
            
            # Exponential backoff for rate limits
            backoff_minutes = min(60, 2 ** self.rate_limit_hits)
            self.backoff_until = datetime.now() + timedelta(minutes=backoff_minutes)


@dataclass
class DataRequest:
    """Represents a data request with retry information."""
    ticker: str
    start_date: Union[str, datetime]
    end_date: Union[str, datetime]
    attempt: int = 0
    failed_sources: Set[str] = field(default_factory=set)
    last_error: Optional[str] = None
    priority: int = 0  # Lower number = higher priority
    
    def __lt__(self, other):
        return self.priority < other.priority


class RateLimitManager:
    """Advanced rate limit management with token bucket algorithm."""
    
    def __init__(self, rate: float, burst: int):
        """
        Args:
            rate: Tokens per second
            burst: Maximum burst size
        """
        self.rate = rate
        self.capacity = burst
        self.tokens = burst
        self.last_update = time.time()
        self.lock = threading.Lock()
    
    def acquire(self, tokens: int = 1) -> float:
        """
        Acquire tokens, blocking if necessary.
        Returns wait time.
        """
        total_wait_time = 0.0
        
        while True:
            with self.lock:
                now = time.time()
                elapsed = now - self.last_update
                self.last_update = now
                
                # Add tokens based on elapsed time
                self.tokens = min(self.capacity, self.tokens + elapsed * self.rate)
                
                # If we have enough tokens, proceed
                if self.tokens >= tokens:
                    self.tokens -= tokens
                    return total_wait_time
                
                # Calculate wait time
                deficit = tokens - self.tokens
                wait_time = deficit / self.rate
            
            # Release lock before sleeping
            time.sleep(wait_time)
            total_wait_time += wait_time
            
            # After sleeping, loop back to try again
            # This ensures fair access for concurrent threads


class DataQualityChecker:
    """Validates and improves data quality."""
    
    @staticmethod
    def validate_data(data: pd.DataFrame, ticker: str) -> Tuple[bool, List[str]]:
        """
        Validate data quality and return issues found.
        
        Returns:
            Tuple of (is_valid, list_of_issues)
        """
        issues = []
        
        if data.empty:
            return False, ["Empty dataframe"]
        
        # Check required columns
        required_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
        missing_columns = [col for col in required_columns if col not in data.columns]
        if missing_columns:
            issues.append(f"Missing columns: {missing_columns}")
        
        # Check for data consistency
        if len(data) > 0 and not missing_columns:
            # High should be >= Low
            if 'High' in data.columns and 'Low' in data.columns:
                invalid_hl = (data['High'] < data['Low']).sum()
                if invalid_hl > 0:
                    issues.append(f"{invalid_hl} rows with High < Low")
            
            # OHLC relationship
            if all(col in data.columns for col in ['Open', 'High', 'Low', 'Close']):
                invalid_prices = (
                    (data['Close'] > data['High']) | 
                    (data['Close'] < data['Low']) |
                    (data['Open'] > data['High']) |
                    (data['Open'] < data['Low'])
                ).sum()
                if invalid_prices > 0:
                    issues.append(f"{invalid_prices} rows with invalid OHLC relationships")
            
                # Check for zeros or negative values
                zero_prices = (data[['Open', 'High', 'Low', 'Close']] <= 0).any(axis=1).sum()
                if zero_prices > 0:
                    issues.append(f"{zero_prices} rows with zero or negative prices")
            
            # Check for missing data
            missing_pct = data.isna().sum().sum() / (len(data) * len(data.columns))
            if missing_pct > 0.1:  # More than 10% missing
                issues.append(f"{missing_pct:.1%} missing data")
            
            # Check for duplicate indices
            if data.index.duplicated().any():
                issues.append("Duplicate date indices found")
        
        return len(issues) == 0, issues
    
    @staticmethod
    def repair_data(data: pd.DataFrame) -> pd.DataFrame:
        """Attempt to repair common data issues."""
        if data.empty:
            return data
        
        df = data.copy()
        
        # Remove duplicate indices (keep last)
        df = df[~df.index.duplicated(keep='last')]
        
        # Fix OHLC relationships
        df['High'] = df[['Open', 'High', 'Close']].max(axis=1)
        df['Low'] = df[['Open', 'Low', 'Close']].min(axis=1)
        
        # Forward fill missing data (up to 5 days)
        df = df.fillna(method='ffill', limit=5)
        
        # Remove rows that are still mostly empty
        df = df.dropna(thresh=len(df.columns) * 0.5)
        
        # Ensure Adj Close exists
        if 'Adj Close' not in df.columns and 'Close' in df.columns:
            df['Adj Close'] = df['Close']
        
        return df


class ResilientDataFetcher:
    """
    Highly resilient data fetcher with advanced error handling,
    intelligent retry logic, and data quality assurance.
    """
    
    def __init__(
        self,
        config: Optional[Config] = None,
        cache: Optional[DataCache] = None,
        sources: Optional[List[DataSource]] = None,
        quality_check: bool = True,
        repair_data: bool = True
    ):
        self.config = config or load_config()
        self.cache = cache or DataCache(self.config.data.cache_dir)
        self.logger = logging.getLogger(__name__)
        
        # Configuration
        self.quality_check = quality_check
        self.repair_data = repair_data
        self.max_retries = getattr(self.config.data, 'retry_attempts', 5)
        self.retry_delay_base = getattr(self.config.data, 'retry_delay', 2.0)  # Base delay for exponential backoff
        
        # Initialize sources
        self.sources = sources or self._initialize_default_sources()
        self.source_status = {
            source.name: SourceStatus(source.name) 
            for source in self.sources
        }
        
        # Rate limiters for each source
        self.rate_limiters = self._initialize_rate_limiters()
        
        # Request queue for retry logic
        self.retry_queue = deque()
        
        # Performance tracking
        self.request_history = defaultdict(list)
        
        # Load persisted source health
        self._load_source_health()
    
    def _initialize_default_sources(self) -> List[DataSource]:
        """Initialize available data sources."""
        sources = []
        
        # Always add YFinance
        sources.append(YFinanceSource(self.config))
        
        # Add other sources if configured
        if os.environ.get("ALPHA_VANTAGE_API_KEY"):
            sources.append(AlphaVantageSource(self.config))
        
        if os.environ.get("FINNHUB_API_KEY"):
            sources.append(FinnhubSource(self.config))
        
        if os.environ.get("TIINGO_API_KEY"):
            sources.append(TiingoSource(self.config))
        
        return sorted(sources, key=lambda x: x.priority)
    
    def _initialize_rate_limiters(self) -> Dict[str, RateLimitManager]:
        """Initialize rate limiters for each source."""
        # Conservative rate limits to avoid hitting API limits
        rate_configs = {
            "YahooFinance": (0.5, 5),     # 0.5 requests/sec, burst of 5
            "AlphaVantage": (0.08, 2),     # ~5/min, burst of 2
            "Finnhub": (0.9, 10),          # ~60/min, burst of 10
            "Tiingo": (5.0, 20),           # 5/sec, burst of 20
        }
        
        # Allow override from config for testing
        default_rate = getattr(self.config.data, 'default_rate_limit', 1.0)
        default_burst = getattr(self.config.data, 'default_burst_limit', 5)
        
        limiters = {}
        for source in self.sources:
            rate, burst = rate_configs.get(source.name, (default_rate, default_burst))
            limiters[source.name] = RateLimitManager(rate, burst)
        
        return limiters
    
    def _load_source_health(self):
        """Load persisted source health data."""
        health_file = Path(self.config.data.cache_dir) / "source_health.json"
        
        if health_file.exists():
            try:
                with open(health_file, 'r') as f:
                    health_data = json.load(f)
                
                for source_name, data in health_data.items():
                    if source_name in self.source_status:
                        status = self.source_status[source_name]
                        status.total_requests = data.get('total_requests', 0)
                        status.successful_requests = data.get('successful_requests', 0)
                        status.rate_limit_hits = data.get('rate_limit_hits', 0)
                        
                self.logger.info("Loaded source health history")
                
            except Exception as e:
                self.logger.warning(f"Failed to load source health: {e}")
    
    def _save_source_health(self):
        """Persist source health data."""
        health_file = Path(self.config.data.cache_dir) / "source_health.json"
        
        health_data = {}
        for source_name, status in self.source_status.items():
            health_data[source_name] = {
                'total_requests': status.total_requests,
                'successful_requests': status.successful_requests,
                'rate_limit_hits': status.rate_limit_hits,
                'success_rate': status.success_rate,
                'average_response_time': status.average_response_time
            }
        
        try:
            health_file.parent.mkdir(parents=True, exist_ok=True)
            with open(health_file, 'w') as f:
                json.dump(health_data, f, indent=2)
        except Exception as e:
            self.logger.warning(f"Failed to save source health: {e}")
    
    def get_source_health(self) -> Dict[str, Dict[str, Any]]:
        """Get current health status of all sources."""
        health = {}
        
        for source_name, status in self.source_status.items():
            health[source_name] = {
                'healthy': status.is_healthy,
                'available': status.available,
                'success_rate': f"{status.success_rate:.1%}",
                'total_requests': status.total_requests,
                'consecutive_failures': status.consecutive_failures,
                'rate_limit_hits': status.rate_limit_hits,
                'average_response_time': f"{status.average_response_time:.2f}s",
                'backoff_until': status.backoff_until.isoformat() if status.backoff_until else None
            }
        
        return health
    
    def _select_best_source(self, failed_sources: Set[str]) -> Optional[DataSource]:
        """
        Select the best available source based on health metrics.
        Uses a scoring system considering success rate, response time, and availability.
        """
        available_sources = []
        
        for source in self.sources:
            if source.name in failed_sources:
                continue
            
            status = self.source_status[source.name]
            if not status.is_healthy:
                continue
            
            if not source.is_available():
                continue
            
            # Calculate score (higher is better)
            score = 0.0
            
            # Base priority (lower priority number = higher score)
            score += (10 - source.priority) * 10
            
            # Success rate (0-100 points)
            score += status.success_rate * 100
            
            # Response time penalty (faster is better)
            if status.average_response_time > 0:
                score -= min(50, status.average_response_time * 10)
            
            # Recent success bonus
            if status.last_success:
                minutes_since_success = (datetime.now() - status.last_success).total_seconds() / 60
                if minutes_since_success < 5:
                    score += 20
            
            # Rate limit penalty
            if status.rate_limit_hits > 0:
                score -= status.rate_limit_hits * 5
            
            available_sources.append((source, score))
        
        if not available_sources:
            return None
        
        # Sort by score and return best
        available_sources.sort(key=lambda x: x[1], reverse=True)
        best_source, score = available_sources[0]
        
        self.logger.debug(f"Selected {best_source.name} with score {score:.1f}")
        return best_source
    
    def fetch_with_fallback(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        force_refresh: bool = False,
        priority: int = 0
    ) -> pd.DataFrame:
        """
        Fetch data with intelligent fallback and retry logic.
        
        Args:
            ticker: Stock/ETF ticker
            start_date: Start date for data
            end_date: End date for data (default: today)
            force_refresh: Bypass cache
            priority: Request priority (lower = higher priority)
            
        Returns:
            DataFrame with price data
        """
        if end_date is None:
            end_date = datetime.now()
        
        # Check cache first
        if not force_refresh:
            cache_key = f"resilient_{ticker}_{start_date}_{end_date}"
            cached_data = self.cache.get(cache_key)
            
            if cached_data is not None:
                self.logger.debug(f"Cache hit for {ticker}")
                return cached_data
        
        # Create request object
        request = DataRequest(
            ticker=ticker,
            start_date=start_date,
            end_date=end_date,
            priority=priority
        )
        
        # Try to fetch data
        data = self._execute_request(request)
        
        if data is not None and not data.empty:
            # Cache successful result
            if not force_refresh:
                self.cache.set(cache_key, data, ttl_hours=self.config.data.cache_ttl_hours)
            
            # Save source health periodically
            if random.random() < 0.1:  # 10% chance
                self._save_source_health()
        
        return data if data is not None else pd.DataFrame()
    
    def _execute_request(self, request: DataRequest) -> Optional[pd.DataFrame]:
        """Execute a data request with retries and fallback."""
        max_attempts = min(self.max_retries, len(self.sources))
        
        while request.attempt < max_attempts:
            request.attempt += 1
            
            # Select best available source
            source = self._select_best_source(request.failed_sources)
            
            if source is None:
                self.logger.warning(f"No available sources for {request.ticker}")
                break
            
            # Apply rate limiting
            rate_limiter = self.rate_limiters[source.name]
            wait_time = rate_limiter.acquire()
            
            if wait_time > 0:
                self.logger.debug(f"Rate limited on {source.name}, waited {wait_time:.1f}s")
            
            # Attempt to fetch data
            start_time = time.time()
            status = self.source_status[source.name]
            
            try:
                self.logger.info(f"Fetching {request.ticker} from {source.name} (attempt {request.attempt})")
                
                data = source.fetch_data(
                    request.ticker,
                    request.start_date,
                    request.end_date
                )
                
                response_time = time.time() - start_time
                
                # Validate data quality
                if self.quality_check:
                    is_valid, issues = DataQualityChecker.validate_data(data, request.ticker)
                    
                    if not is_valid:
                        self.logger.warning(f"Data quality issues for {request.ticker} from {source.name}: {issues}")
                        
                        if self.repair_data:
                            self.logger.info(f"Attempting to repair data for {request.ticker}")
                            data = DataQualityChecker.repair_data(data)
                            
                            # Re-validate
                            is_valid, issues = DataQualityChecker.validate_data(data, request.ticker)
                            
                            if not is_valid:
                                raise ValueError(f"Data quality issues after repair: {issues}")
                
                # Success!
                status.record_success(response_time)
                self.logger.info(f"Successfully fetched {request.ticker} from {source.name} in {response_time:.2f}s")
                
                return data
                
            except Exception as e:
                error_msg = str(e)
                is_rate_limit = any(
                    term in error_msg.lower() 
                    for term in ['rate limit', '429', 'too many requests']
                )
                
                status.record_failure(is_rate_limit)
                request.failed_sources.add(source.name)
                request.last_error = error_msg
                
                self.logger.warning(
                    f"Failed to fetch {request.ticker} from {source.name}: {error_msg} "
                    f"(attempt {request.attempt}/{max_attempts})"
                )
                
                # Exponential backoff before retry
                if request.attempt < max_attempts:
                    delay = self.retry_delay_base * (2 ** (request.attempt - 1)) + random.uniform(0, 0.1)
                    self.logger.debug(f"Waiting {delay:.1f}s before retry")
                    time.sleep(delay)
        
        # All attempts failed
        self.logger.error(
            f"Failed to fetch {request.ticker} after {request.attempt} attempts. "
            f"Last error: {request.last_error}"
        )
        
        return None
    
    def fetch_multiple_resilient(
        self,
        tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        max_workers: int = 5,
        use_batch: bool = True,
        priority_map: Optional[Dict[str, int]] = None
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch multiple tickers with maximum resilience.
        
        Args:
            tickers: List of tickers to fetch
            start_date: Start date
            end_date: End date
            max_workers: Number of concurrent workers
            use_batch: Try batch fetching first
            priority_map: Dict mapping tickers to priority levels
            
        Returns:
            Dict of ticker -> DataFrame
        """
        if priority_map is None:
            priority_map = {}
        
        results = {}
        remaining_tickers = list(tickers)
        
        # Try batch-capable sources first
        if use_batch and len(tickers) > 1:
            for source in self.sources:
                if not source.supports_batch:
                    continue
                
                status = self.source_status[source.name]
                if not status.is_healthy or not source.is_available():
                    continue
                
                try:
                    self.logger.info(f"Attempting batch fetch from {source.name} for {len(remaining_tickers)} tickers")
                    
                    # Apply rate limiting
                    rate_limiter = self.rate_limiters[source.name]
                    rate_limiter.acquire(tokens=min(5, len(remaining_tickers)))
                    
                    start_time = time.time()
                    batch_results = source.fetch_batch(remaining_tickers, start_date, end_date or datetime.now())
                    response_time = time.time() - start_time
                    
                    # Process results
                    successful = 0
                    for ticker, data in batch_results.items():
                        if not data.empty:
                            if self.quality_check:
                                is_valid, issues = DataQualityChecker.validate_data(data, ticker)
                                if not is_valid and self.repair_data:
                                    data = DataQualityChecker.repair_data(data)
                            
                            results[ticker] = data
                            remaining_tickers.remove(ticker)
                            successful += 1
                            
                            # Cache the data
                            cache_key = f"resilient_{ticker}_{start_date}_{end_date}"
                            self.cache.set(cache_key, data, ttl_hours=self.config.data.cache_ttl_hours)
                    
                    if successful > 0:
                        status.record_success(response_time / successful)
                        self.logger.info(f"Batch fetch got {successful}/{len(batch_results)} tickers from {source.name}")
                    
                    if not remaining_tickers:
                        return results
                        
                except Exception as e:
                    self.logger.warning(f"Batch fetch failed on {source.name}: {str(e)}")
                    status.record_failure('rate limit' in str(e).lower())
        
        # Fetch remaining tickers individually with concurrent workers
        if remaining_tickers:
            self.logger.info(f"Fetching {len(remaining_tickers)} tickers individually")
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Create futures with priority
                future_to_ticker = {
                    executor.submit(
                        self.fetch_with_fallback,
                        ticker,
                        start_date,
                        end_date,
                        priority=priority_map.get(ticker, 0)
                    ): ticker
                    for ticker in remaining_tickers
                }
                
                # Process completed futures
                for future in as_completed(future_to_ticker):
                    ticker = future_to_ticker[future]
                    
                    try:
                        data = future.result()
                        results[ticker] = data
                        
                        if data.empty:
                            self.logger.warning(f"No data retrieved for {ticker}")
                            
                    except Exception as e:
                        self.logger.error(f"Unexpected error fetching {ticker}: {str(e)}")
                        results[ticker] = pd.DataFrame()
        
        # Log summary
        successful = sum(1 for df in results.values() if not df.empty)
        self.logger.info(
            f"Fetch complete: {successful}/{len(tickers)} successful. "
            f"Source health: {self._get_health_summary()}"
        )
        
        return results
    
    def _get_health_summary(self) -> str:
        """Get a summary of source health."""
        healthy_sources = sum(1 for s in self.source_status.values() if s.is_healthy)
        total_sources = len(self.source_status)
        
        return f"{healthy_sources}/{total_sources} healthy"
    
    def repair_missing_data(
        self,
        ticker: str,
        existing_data: pd.DataFrame,
        expected_start: Union[str, datetime],
        expected_end: Union[str, datetime]
    ) -> pd.DataFrame:
        """
        Attempt to fill missing data by fetching from multiple sources
        and combining the results intelligently.
        """
        if isinstance(expected_start, str):
            expected_start = pd.to_datetime(expected_start)
        if isinstance(expected_end, str):
            expected_end = pd.to_datetime(expected_end)
        
        # Identify missing date ranges
        if existing_data.empty:
            missing_ranges = [(expected_start, expected_end)]
        else:
            existing_data = existing_data.sort_index()
            all_dates = pd.date_range(start=expected_start, end=expected_end, freq='B')  # Business days
            existing_dates = existing_data.index
            missing_dates = all_dates.difference(existing_dates)
            
            if missing_dates.empty:
                return existing_data
            
            # Group consecutive missing dates into ranges
            missing_ranges = []
            if len(missing_dates) > 0:
                start_missing = missing_dates[0]
                prev_date = start_missing
                
                for date in missing_dates[1:]:
                    if (date - prev_date).days > 1:
                        missing_ranges.append((start_missing, prev_date))
                        start_missing = date
                    prev_date = date
                
                missing_ranges.append((start_missing, prev_date))
        
        self.logger.info(f"Found {len(missing_ranges)} missing date ranges for {ticker}")
        
        # Try to fetch missing data from each source
        all_patches = []
        
        for start, end in missing_ranges:
            self.logger.debug(f"Fetching missing data for {ticker} from {start.date()} to {end.date()}")
            
            patch_data = self.fetch_with_fallback(
                ticker,
                start,
                end,
                force_refresh=True,
                priority=-1  # High priority for repair
            )
            
            if not patch_data.empty:
                all_patches.append(patch_data)
        
        # Combine all data
        if all_patches:
            if not existing_data.empty:
                all_patches.append(existing_data)
            
            combined_data = pd.concat(all_patches)
            combined_data = combined_data.sort_index()
            
            # Remove duplicates, keeping the most recent
            combined_data = combined_data[~combined_data.index.duplicated(keep='last')]
            
            return combined_data
        
        return existing_data


import os