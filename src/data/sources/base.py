"""Base class for data sources."""

from abc import ABC, abstractmethod
from typing import Union, Optional
from datetime import datetime
import pandas as pd


class DataSource(ABC):
    """Abstract base class for data sources."""
    
    @abstractmethod
    def fetch_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> pd.DataFrame:
        """
        Fetch historical price data for a ticker.
        
        Args:
            ticker: Stock/ETF ticker symbol
            start_date: Start date for data
            end_date: End date for data
            
        Returns:
            DataFrame with columns: Open, High, Low, Close, Adj Close, Volume
            Index should be DatetimeIndex
        """
        pass
    
    @abstractmethod
    def is_available(self) -> bool:
        """Check if this data source is currently available."""
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the data source."""
        pass
    
    @property
    @abstractmethod
    def priority(self) -> int:
        """Priority of this source (lower number = higher priority)."""
        pass
    
    @property
    def supports_batch(self) -> bool:
        """Whether this source supports batch ticker fetching."""
        return False
    
    def fetch_batch(
        self,
        tickers: list[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> dict[str, pd.DataFrame]:
        """
        Fetch data for multiple tickers in a single request.
        Default implementation calls fetch_data for each ticker.
        """
        if not self.supports_batch:
            raise NotImplementedError(f"{self.name} does not support batch fetching")
        
        results = {}
        for ticker in tickers:
            try:
                results[ticker] = self.fetch_data(ticker, start_date, end_date)
            except Exception:
                results[ticker] = pd.DataFrame()
        
        return results