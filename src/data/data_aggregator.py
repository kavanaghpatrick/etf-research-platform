"""
Advanced data aggregator that intelligently combines data from multiple sources
to create the most complete and accurate dataset possible.
"""

import logging
from typing import Dict, List, Optional, Union, Tuple
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

from .resilient_fetcher import ResilientDataFetcher, DataQualityChecker
from .sources import DataSource
from ..utils import Config, load_config


class DataAggregator:
    """
    Intelligently aggregates data from multiple sources to create
    the most complete and accurate dataset.
    """
    
    def __init__(
        self,
        fetcher: Optional[ResilientDataFetcher] = None,
        config: Optional[Config] = None
    ):
        self.config = config or load_config()
        self.fetcher = fetcher or ResilientDataFetcher(config=self.config)
        self.logger = logging.getLogger(__name__)
    
    def aggregate_from_all_sources(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        aggregation_method: str = "best_quality"
    ) -> pd.DataFrame:
        """
        Fetch data from all available sources and aggregate intelligently.
        
        Args:
            ticker: Stock/ETF ticker
            start_date: Start date
            end_date: End date
            aggregation_method: Method to use for aggregation
                - "best_quality": Use highest quality data for each date
                - "average": Average prices from all sources
                - "consensus": Use most common value
                - "priority": Use first available by source priority
                
        Returns:
            Aggregated DataFrame
        """
        if end_date is None:
            end_date = datetime.now()
        
        # Fetch from all sources
        all_data = self._fetch_from_all_sources(ticker, start_date, end_date)
        
        if not all_data:
            self.logger.warning(f"No data available from any source for {ticker}")
            return pd.DataFrame()
        
        # Aggregate based on method
        if aggregation_method == "best_quality":
            return self._aggregate_best_quality(all_data, ticker)
        elif aggregation_method == "average":
            return self._aggregate_average(all_data)
        elif aggregation_method == "consensus":
            return self._aggregate_consensus(all_data)
        elif aggregation_method == "priority":
            return self._aggregate_priority(all_data)
        else:
            raise ValueError(f"Unknown aggregation method: {aggregation_method}")
    
    def _fetch_from_all_sources(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> Dict[str, pd.DataFrame]:
        """Fetch data from all available sources."""
        all_data = {}
        
        with ThreadPoolExecutor(max_workers=len(self.fetcher.sources)) as executor:
            future_to_source = {}
            
            for source in self.fetcher.sources:
                if source.is_available():
                    future = executor.submit(
                        self._fetch_from_source,
                        source,
                        ticker,
                        start_date,
                        end_date
                    )
                    future_to_source[future] = source.name
            
            for future in as_completed(future_to_source):
                source_name = future_to_source[future]
                
                try:
                    data = future.result()
                    if data is not None and not data.empty:
                        all_data[source_name] = data
                        self.logger.info(f"Got {len(data)} days from {source_name} for {ticker}")
                except Exception as e:
                    self.logger.error(f"Error fetching from {source_name}: {str(e)}")
        
        return all_data
    
    def _fetch_from_source(
        self,
        source: DataSource,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> Optional[pd.DataFrame]:
        """Fetch data from a specific source with error handling."""
        try:
            # Apply rate limiting
            rate_limiter = self.fetcher.rate_limiters.get(source.name)
            if rate_limiter:
                rate_limiter.acquire()
            
            data = source.fetch_data(ticker, start_date, end_date)
            
            if not data.empty:
                # Add source column for tracking
                data['_source'] = source.name
                data['_source_priority'] = source.priority
                
            return data
            
        except Exception as e:
            self.logger.warning(f"Failed to fetch {ticker} from {source.name}: {str(e)}")
            return None
    
    def _aggregate_best_quality(
        self,
        all_data: Dict[str, pd.DataFrame],
        ticker: str
    ) -> pd.DataFrame:
        """
        Aggregate using best quality data for each date.
        Quality is determined by completeness and consistency.
        """
        # Score each source's data quality
        source_scores = {}
        
        for source_name, data in all_data.items():
            is_valid, issues = DataQualityChecker.validate_data(data, ticker)
            
            # Calculate quality score (0-100)
            score = 100
            
            # Deduct points for issues
            if not is_valid:
                score -= len(issues) * 10
            
            # Deduct for missing data
            missing_pct = data.isna().sum().sum() / (len(data) * len(data.columns))
            score -= missing_pct * 50
            
            # Deduct for suspicious patterns
            if len(data) > 1:
                # Check for too many identical values
                for col in ['Open', 'High', 'Low', 'Close']:
                    if col in data.columns:
                        unique_pct = data[col].nunique() / len(data)
                        if unique_pct < 0.5:  # Less than 50% unique values
                            score -= 20
            
            source_scores[source_name] = max(0, score)
            self.logger.debug(f"{source_name} quality score: {score:.1f}")
        
        # Combine data, preferring higher quality sources
        all_dates = set()
        for data in all_data.values():
            all_dates.update(data.index)
        
        all_dates = sorted(all_dates)
        
        # Build result row by row, using best source for each date
        result_data = []
        
        for date in all_dates:
            best_row = None
            best_score = -1
            
            for source_name, data in all_data.items():
                if date in data.index:
                    row = data.loc[date]
                    score = source_scores[source_name]
                    
                    # Bonus for data consistency on this date
                    if self._is_row_consistent(row):
                        score += 10
                    
                    if score > best_score:
                        best_score = score
                        best_row = row
            
            if best_row is not None:
                result_data.append(best_row)
        
        if not result_data:
            return pd.DataFrame()
        
        result = pd.DataFrame(result_data)
        
        # Clean up internal columns
        result = result.drop(columns=['_source', '_source_priority'], errors='ignore')
        
        return result
    
    def _aggregate_average(self, all_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Aggregate by averaging prices from all sources."""
        # Align all dataframes to same dates
        aligned_data = self._align_dataframes(list(all_data.values()))
        
        if not aligned_data:
            return pd.DataFrame()
        
        # Calculate average for each numeric column
        result = pd.DataFrame(index=aligned_data[0].index)
        
        for col in ['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']:
            col_data = []
            
            for df in aligned_data:
                if col in df.columns:
                    col_data.append(df[col])
            
            if col_data:
                # Use nanmean to ignore NaN values
                result[col] = pd.concat(col_data, axis=1).mean(axis=1)
        
        return result
    
    def _aggregate_consensus(self, all_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Aggregate by using most common value (consensus)."""
        aligned_data = self._align_dataframes(list(all_data.values()))
        
        if not aligned_data:
            return pd.DataFrame()
        
        result = pd.DataFrame(index=aligned_data[0].index)
        
        for col in ['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']:
            col_data = []
            
            for df in aligned_data:
                if col in df.columns:
                    col_data.append(df[col])
            
            if col_data:
                # Use mode (most common value) for each date
                stacked = pd.concat(col_data, axis=1)
                result[col] = stacked.mode(axis=1).iloc[:, 0]
        
        return result
    
    def _aggregate_priority(self, all_data: Dict[str, pd.DataFrame]) -> pd.DataFrame:
        """Aggregate by source priority (use first available)."""
        # Sort by priority
        sorted_sources = sorted(
            all_data.items(),
            key=lambda x: x[1]['_source_priority'].iloc[0] if '_source_priority' in x[1].columns else 999
        )
        
        if not sorted_sources:
            return pd.DataFrame()
        
        # Start with highest priority source
        result = sorted_sources[0][1].copy()
        
        # Fill missing data from lower priority sources
        for source_name, data in sorted_sources[1:]:
            for col in ['Open', 'High', 'Low', 'Close', 'Adj Close', 'Volume']:
                if col in data.columns and col in result.columns:
                    # Fill NaN values
                    result[col] = result[col].fillna(data[col])
        
        # Clean up internal columns
        result = result.drop(columns=['_source', '_source_priority'], errors='ignore')
        
        return result
    
    def _align_dataframes(self, dataframes: List[pd.DataFrame]) -> List[pd.DataFrame]:
        """Align multiple dataframes to the same date index."""
        if not dataframes:
            return []
        
        # Find union of all dates
        all_dates = dataframes[0].index
        for df in dataframes[1:]:
            all_dates = all_dates.union(df.index)
        
        # Reindex all dataframes to same dates
        aligned = []
        for df in dataframes:
            aligned.append(df.reindex(all_dates))
        
        return aligned
    
    def _is_row_consistent(self, row: pd.Series) -> bool:
        """Check if a data row has consistent OHLC values."""
        try:
            if 'High' in row and 'Low' in row:
                if row['High'] < row['Low']:
                    return False
            
            if all(col in row for col in ['Open', 'High', 'Low', 'Close']):
                # Check OHLC relationships
                if row['High'] < max(row['Open'], row['Close']):
                    return False
                if row['Low'] > min(row['Open'], row['Close']):
                    return False
                
                # Check for zero/negative prices
                if any(row[col] <= 0 for col in ['Open', 'High', 'Low', 'Close'] if not pd.isna(row[col])):
                    return False
            
            return True
            
        except:
            return False
    
    def create_composite_dataset(
        self,
        tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        aggregation_method: str = "best_quality"
    ) -> Dict[str, pd.DataFrame]:
        """
        Create composite datasets for multiple tickers using all available sources.
        
        Returns:
            Dict mapping ticker to aggregated DataFrame
        """
        results = {}
        
        self.logger.info(f"Creating composite dataset for {len(tickers)} tickers")
        
        with ThreadPoolExecutor(max_workers=5) as executor:
            future_to_ticker = {
                executor.submit(
                    self.aggregate_from_all_sources,
                    ticker,
                    start_date,
                    end_date,
                    aggregation_method
                ): ticker
                for ticker in tickers
            }
            
            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                
                try:
                    data = future.result()
                    results[ticker] = data
                    
                    if not data.empty:
                        self.logger.info(f"Created composite data for {ticker}: {len(data)} days")
                    else:
                        self.logger.warning(f"No composite data created for {ticker}")
                        
                except Exception as e:
                    self.logger.error(f"Error creating composite for {ticker}: {str(e)}")
                    results[ticker] = pd.DataFrame()
        
        return results
    
    def fill_gaps_with_interpolation(
        self,
        data: pd.DataFrame,
        method: str = "linear",
        limit: int = 5
    ) -> pd.DataFrame:
        """
        Fill gaps in data using interpolation.
        
        Args:
            data: DataFrame with potential gaps
            method: Interpolation method ('linear', 'quadratic', 'cubic')
            limit: Maximum number of consecutive gaps to fill
            
        Returns:
            DataFrame with gaps filled
        """
        if data.empty:
            return data
        
        filled = data.copy()
        
        # Interpolate price columns
        price_columns = ['Open', 'High', 'Low', 'Close', 'Adj Close']
        for col in price_columns:
            if col in filled.columns:
                filled[col] = filled[col].interpolate(
                    method=method,
                    limit=limit,
                    limit_direction='both'
                )
        
        # Volume should not be interpolated the same way
        if 'Volume' in filled.columns:
            # Use forward fill for volume
            filled['Volume'] = filled['Volume'].fillna(method='ffill', limit=limit)
        
        return filled