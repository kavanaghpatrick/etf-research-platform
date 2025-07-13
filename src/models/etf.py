from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional, List
import pandas as pd


@dataclass
class ETF:
    """Represents an Exchange-Traded Fund with its metadata and price data."""
    
    ticker: str
    name: str
    expense_ratio: float
    inception_date: datetime
    category: str
    total_assets: Optional[float] = None
    issuer: Optional[str] = None
    index_tracked: Optional[str] = None
    holdings_count: Optional[int] = None
    
    price_data: Optional[pd.DataFrame] = None
    holdings: Optional[List[Dict[str, float]]] = None
    
    def __post_init__(self):
        self.ticker = self.ticker.upper()
    
    @property
    def has_price_data(self) -> bool:
        return self.price_data is not None and not self.price_data.empty
    
    def get_returns(self, period: str = "daily") -> pd.Series:
        """Calculate returns for specified period."""
        if not self.has_price_data:
            raise ValueError(f"No price data available for {self.ticker}")
        
        if "Adj Close" not in self.price_data.columns:
            raise ValueError("Price data must contain 'Adj Close' column")
        
        if period == "daily":
            return self.price_data["Adj Close"].pct_change()
        elif period == "weekly":
            weekly_prices = self.price_data["Adj Close"].resample("W").last()
            return weekly_prices.pct_change()
        elif period == "monthly":
            monthly_prices = self.price_data["Adj Close"].resample("M").last()
            return monthly_prices.pct_change()
        else:
            raise ValueError(f"Unsupported period: {period}")
    
    def get_volatility(self, window: int = 252) -> float:
        """Calculate annualized volatility."""
        if not self.has_price_data:
            raise ValueError(f"No price data available for {self.ticker}")
        
        returns = self.get_returns()
        return returns.std() * (window ** 0.5)
    
    def get_sharpe_ratio(self, risk_free_rate: float = 0.02, window: int = 252) -> float:
        """Calculate Sharpe ratio."""
        if not self.has_price_data:
            raise ValueError(f"No price data available for {self.ticker}")
        
        returns = self.get_returns()
        excess_returns = returns - risk_free_rate / window
        
        if returns.std() == 0:
            return 0.0
        
        return (excess_returns.mean() * window) / (returns.std() * (window ** 0.5))