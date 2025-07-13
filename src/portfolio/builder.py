from typing import Dict, List, Optional
import pandas as pd
import numpy as np
from datetime import datetime

from ..models import Portfolio, ETF
from ..data import ETFDataFetcher
from .optimizer import PortfolioOptimizer
from ..utils import Config, load_config


class PortfolioBuilder:
    """Build and manage ETF portfolios."""
    
    def __init__(self, data_fetcher: Optional[ETFDataFetcher] = None, config: Optional[Config] = None):
        self.config = config or load_config()
        self.initial_cash = self.config.portfolio.default_initial_cash
        self.data_fetcher = data_fetcher or ETFDataFetcher(config=self.config)
        
    def create_portfolio(
        self,
        name: str,
        etf_tickers: List[str],
        weights: Dict[str, float],
        start_date: str,
        end_date: Optional[str] = None
    ) -> Portfolio:
        """Create a portfolio with specified ETFs and weights."""
        portfolio = Portfolio(name=name, cash=self.initial_cash)
        
        # Fetch current prices
        etf_data = self.data_fetcher.fetch_multiple_etfs(
            etf_tickers,
            start_date,
            end_date or datetime.now()
        )
        
        current_prices = {}
        for ticker, data in etf_data.items():
            if not data.empty:
                current_prices[ticker] = data["Close"].iloc[-1]
        
        # Allocate positions based on weights
        for ticker, weight in weights.items():
            if ticker in current_prices:
                allocation = self.initial_cash * weight
                shares = allocation / current_prices[ticker]
                portfolio.add_position(ticker, shares, current_prices[ticker])
        
        return portfolio
    
    def create_optimized_portfolio(
        self,
        name: str,
        etf_tickers: List[str],
        optimization_method: str,
        start_date: str,
        end_date: Optional[str] = None,
        **kwargs
    ) -> Portfolio:
        """Create an optimized portfolio using specified method."""
        # Fetch historical data
        etf_data = self.data_fetcher.fetch_multiple_etfs(
            etf_tickers,
            start_date,
            end_date or datetime.now()
        )
        
        # Calculate returns
        returns_data = pd.DataFrame()
        for ticker, data in etf_data.items():
            if not data.empty:
                returns_data[ticker] = data["Close"].pct_change()
        
        returns_data = returns_data.dropna()
        
        if returns_data.empty:
            raise ValueError("No valid returns data available")
        
        # Optimize portfolio
        optimizer = PortfolioOptimizer(returns_data)
        
        if optimization_method == "min_variance":
            weights = optimizer.optimize_min_variance(**kwargs)
        elif optimization_method == "max_sharpe":
            weights = optimizer.optimize_max_sharpe(**kwargs)
        elif optimization_method == "risk_parity":
            weights = optimizer.optimize_risk_parity()
        else:
            raise ValueError(f"Unknown optimization method: {optimization_method}")
        
        # Create portfolio with optimized weights
        return self.create_portfolio(name, list(weights.keys()), weights, start_date, end_date)
    
    def create_equal_weight_portfolio(
        self,
        name: str,
        etf_tickers: List[str],
        start_date: str,
        end_date: Optional[str] = None
    ) -> Portfolio:
        """Create an equally weighted portfolio."""
        weight = 1.0 / len(etf_tickers)
        weights = {ticker: weight for ticker in etf_tickers}
        
        return self.create_portfolio(name, etf_tickers, weights, start_date, end_date)
    
    def create_sector_rotation_portfolio(
        self,
        name: str,
        sector_weights: Dict[str, float],
        start_date: str,
        end_date: Optional[str] = None
    ) -> Portfolio:
        """Create a portfolio based on sector allocation."""
        sector_etfs = self.data_fetcher.get_sector_etfs()
        
        etf_weights = {}
        for sector, weight in sector_weights.items():
            if sector in sector_etfs and sector_etfs[sector]:
                # Use the first ETF in each sector
                etf_ticker = sector_etfs[sector][0]
                etf_weights[etf_ticker] = weight
        
        # Normalize weights
        total_weight = sum(etf_weights.values())
        if total_weight > 0:
            etf_weights = {k: v/total_weight for k, v in etf_weights.items()}
        
        return self.create_portfolio(
            name,
            list(etf_weights.keys()),
            etf_weights,
            start_date,
            end_date
        )
    
    def create_core_satellite_portfolio(
        self,
        name: str,
        core_etfs: Dict[str, float],
        satellite_etfs: Dict[str, float],
        core_allocation: float = 0.7,
        start_date: str = None,
        end_date: Optional[str] = None
    ) -> Portfolio:
        """Create a core-satellite portfolio strategy."""
        if core_allocation < 0 or core_allocation > 1:
            raise ValueError("Core allocation must be between 0 and 1")
        
        satellite_allocation = 1 - core_allocation
        
        # Normalize core weights
        core_total = sum(core_etfs.values())
        if core_total > 0:
            core_weights = {
                k: (v/core_total) * core_allocation 
                for k, v in core_etfs.items()
            }
        else:
            core_weights = {}
        
        # Normalize satellite weights
        satellite_total = sum(satellite_etfs.values())
        if satellite_total > 0:
            satellite_weights = {
                k: (v/satellite_total) * satellite_allocation 
                for k, v in satellite_etfs.items()
            }
        else:
            satellite_weights = {}
        
        # Combine weights
        all_weights = {**core_weights, **satellite_weights}
        
        return self.create_portfolio(
            name,
            list(all_weights.keys()),
            all_weights,
            start_date,
            end_date
        )