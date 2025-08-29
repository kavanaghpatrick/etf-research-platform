"""
Pydantic request models for ETF Research Platform API.
Provides type safety and validation for all incoming requests.
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Union, Literal
from datetime import datetime, date
import re

class TickerListRequest(BaseModel):
    """Request model for ticker-based operations."""
    tickers: List[str] = Field(
        ..., 
        description="List of stock/ETF tickers (e.g., ['AAPL', 'SPY', 'VTI'])",
        min_items=1,
        max_items=50  # Reasonable limit for web interface
    )
    
    @validator('tickers')
    def validate_tickers(cls, v):
        """Validate ticker format and remove duplicates."""
        if not v:
            raise ValueError("At least one ticker is required")
        
        # Clean and validate each ticker
        cleaned_tickers = []
        for ticker in v:
            # Remove whitespace and convert to uppercase
            clean_ticker = ticker.strip().upper()
            
            # Basic ticker validation (alphanumeric, dots, hyphens)
            if not re.match(r'^[A-Z0-9.-]+$', clean_ticker):
                raise ValueError(f"Invalid ticker format: {ticker}")
            
            if len(clean_ticker) > 10:  # Most tickers are <= 5 chars
                raise ValueError(f"Ticker too long: {ticker}")
            
            cleaned_tickers.append(clean_ticker)
        
        # Remove duplicates while preserving order
        return list(dict.fromkeys(cleaned_tickers))

class DateRangeRequest(BaseModel):
    """Base model for requests with date ranges."""
    start_date: Union[date, str] = Field(
        default="2020-01-01",
        description="Start date for data (YYYY-MM-DD or date object)"
    )
    end_date: Optional[Union[date, str]] = Field(
        default=None,
        description="End date for data (YYYY-MM-DD or date object, defaults to today)"
    )
    
    @validator('start_date', 'end_date', pre=True)
    def parse_dates(cls, v):
        """Parse and validate date inputs."""
        if v is None:
            return v
        
        if isinstance(v, str):
            try:
                return datetime.strptime(v, '%Y-%m-%d').date()
            except ValueError:
                raise ValueError(f"Invalid date format: {v}. Use YYYY-MM-DD")
        
        return v
    
    @validator('end_date')
    def validate_date_range(cls, v, values):
        """Ensure end_date is after start_date."""
        if v is None:
            return v
            
        start_date = values.get('start_date')
        if start_date and v <= start_date:
            raise ValueError("end_date must be after start_date")
        
        return v

class DataFetchRequest(TickerListRequest, DateRangeRequest):
    """Request for fetching ticker data."""
    force_refresh: bool = Field(
        default=False,
        description="Force refresh data, bypassing cache"
    )
    max_workers: int = Field(
        default=5,
        ge=1,
        le=20,
        description="Number of concurrent workers for data fetching"
    )

class OptimizationRequest(TickerListRequest, DateRangeRequest):
    """Request for portfolio optimization."""
    method: Literal["min_variance", "max_sharpe", "risk_parity", "efficient_frontier"] = Field(
        default="max_sharpe",
        description="Optimization method to use"
    )
    risk_free_rate: float = Field(
        default=0.02,
        ge=0.0,
        le=0.2,
        description="Risk-free rate for Sharpe ratio calculation"
    )
    constraints: Optional[Dict[str, float]] = Field(
        default=None,
        description="Portfolio constraints (e.g., {'max_weight': 0.4, 'min_weight': 0.05})"
    )
    n_portfolios: int = Field(
        default=100,
        ge=10,
        le=1000,
        description="Number of portfolios for efficient frontier (only used for efficient_frontier method)"
    )

class BacktestRequest(TickerListRequest, DateRangeRequest):
    """Request for backtesting strategies."""
    strategy: Union[Literal["equal_weight", "min_variance", "max_sharpe", "risk_parity"], Dict[str, float]] = Field(
        default="max_sharpe",
        description="Strategy to backtest (predefined name or custom weights dict)"
    )
    initial_cash: float = Field(
        default=100000.0,
        gt=0,
        description="Initial portfolio value"
    )
    rebalance_frequency: Literal["daily", "weekly", "monthly", "quarterly", "yearly"] = Field(
        default="monthly",
        description="How often to rebalance the portfolio"
    )
    commission: float = Field(
        default=0.001,
        ge=0.0,
        le=0.1,
        description="Commission rate per trade (0.001 = 0.1%)"
    )
    slippage: float = Field(
        default=0.001,
        ge=0.0,
        le=0.1,
        description="Slippage rate (market impact) per trade"
    )
    benchmark_ticker: Optional[str] = Field(
        default="SPY",
        description="Benchmark ticker for comparison"
    )

class AnalyticsRequest(TickerListRequest, DateRangeRequest):
    """Request for analytics and risk calculations."""
    analysis_type: Literal["correlation", "risk_metrics", "performance_attribution"] = Field(
        default="correlation",
        description="Type of analytics to perform"
    )
    rolling_window: int = Field(
        default=60,
        ge=5,
        le=252,
        description="Rolling window for time-series analysis (in trading days)"
    )
    confidence_level: float = Field(
        default=0.05,
        gt=0.0,
        lt=1.0,
        description="Confidence level for VaR calculations (0.05 = 95% confidence)"
    )

class VisualizationRequest(TickerListRequest):
    """Request for generating visualizations."""
    chart_type: Literal["correlation_matrix", "efficient_frontier", "backtest_comparison", "allocation_pie"] = Field(
        ...,
        description="Type of chart to generate"
    )
    data: Dict = Field(
        ...,
        description="Data to visualize (varies by chart type)"
    )
    title: Optional[str] = Field(
        default=None,
        description="Custom chart title"
    )
    save_format: Literal["png", "pdf", "svg"] = Field(
        default="png",
        description="Output format for the chart"
    )
    width: int = Field(
        default=12,
        ge=4,
        le=20,
        description="Chart width in inches"
    )
    height: int = Field(
        default=8,
        ge=4,
        le=20,
        description="Chart height in inches"
    )

class CompareStrategiesRequest(TickerListRequest, DateRangeRequest):
    """Request for comparing multiple strategies."""
    strategies: Dict[str, Union[str, Dict[str, float]]] = Field(
        ...,
        description="Dictionary of strategy_name -> strategy_definition"
    )
    initial_cash: float = Field(
        default=100000.0,
        gt=0,
        description="Initial portfolio value"
    )
    rebalance_frequency: Literal["daily", "weekly", "monthly", "quarterly", "yearly"] = Field(
        default="monthly",
        description="How often to rebalance the portfolio"
    )
    benchmark_ticker: Optional[str] = Field(
        default="SPY",
        description="Benchmark ticker for comparison"
    )
    
    @validator('strategies')
    def validate_strategies(cls, v):
        """Validate strategies dictionary."""
        if not v:
            raise ValueError("At least one strategy is required")
        
        if len(v) > 10:  # Reasonable limit
            raise ValueError("Maximum 10 strategies allowed for comparison")
        
        return v