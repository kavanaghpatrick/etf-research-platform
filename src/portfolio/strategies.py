from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import pandas as pd
import numpy as np


class PortfolioStrategy(ABC):
    """Base class for portfolio allocation strategies."""
    
    @abstractmethod
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        **kwargs
    ) -> Dict[str, float]:
        """Calculate portfolio weights based on strategy."""
        pass
    
    def validate_weights(self, weights: Dict[str, float]) -> bool:
        """Validate that weights sum to approximately 1."""
        total = sum(weights.values())
        return abs(total - 1.0) < 0.001


class EqualWeightStrategy(PortfolioStrategy):
    """Equal weight allocation strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        **kwargs
    ) -> Dict[str, float]:
        n_assets = len(returns_data.columns)
        weight = 1.0 / n_assets
        return {ticker: weight for ticker in returns_data.columns}


class MarketCapWeightStrategy(PortfolioStrategy):
    """Market capitalization weighted strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        market_caps: Dict[str, float],
        **kwargs
    ) -> Dict[str, float]:
        available_tickers = [t for t in returns_data.columns if t in market_caps]
        
        if not available_tickers:
            # Fall back to equal weight if no market cap data
            return EqualWeightStrategy().calculate_weights(returns_data)
        
        total_market_cap = sum(market_caps[t] for t in available_tickers)
        
        weights = {}
        for ticker in returns_data.columns:
            if ticker in market_caps:
                weights[ticker] = market_caps[ticker] / total_market_cap
            else:
                weights[ticker] = 0.0
        
        # Normalize to ensure sum = 1
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v/total_weight for k, v in weights.items()}
        
        return weights


class MinimumVarianceStrategy(PortfolioStrategy):
    """Minimum variance portfolio strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        constraints: Optional[Dict] = None,
        **kwargs
    ) -> Dict[str, float]:
        from ..portfolio.optimizer import PortfolioOptimizer
        
        optimizer = PortfolioOptimizer(returns_data)
        return optimizer.optimize_min_variance(constraints=constraints)


class MaxSharpeStrategy(PortfolioStrategy):
    """Maximum Sharpe ratio portfolio strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        risk_free_rate: float = 0.02,
        constraints: Optional[Dict] = None,
        **kwargs
    ) -> Dict[str, float]:
        from ..portfolio.optimizer import PortfolioOptimizer
        
        optimizer = PortfolioOptimizer(returns_data)
        return optimizer.optimize_max_sharpe(
            risk_free_rate=risk_free_rate,
            constraints=constraints
        )


class RiskParityStrategy(PortfolioStrategy):
    """Risk parity portfolio strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        **kwargs
    ) -> Dict[str, float]:
        from ..portfolio.optimizer import PortfolioOptimizer
        
        optimizer = PortfolioOptimizer(returns_data)
        return optimizer.optimize_risk_parity()


class MomentumStrategy(PortfolioStrategy):
    """Momentum-based allocation strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        lookback_period: int = 60,
        top_n: int = 5,
        **kwargs
    ) -> Dict[str, float]:
        # Calculate momentum (cumulative returns over lookback period)
        if len(returns_data) < lookback_period:
            # Fall back to equal weight if insufficient data
            return EqualWeightStrategy().calculate_weights(returns_data)
        
        momentum = (1 + returns_data.tail(lookback_period)).prod() - 1
        
        # Select top N performers
        top_performers = momentum.nlargest(top_n).index.tolist()
        
        # Equal weight among top performers
        weights = {}
        for ticker in returns_data.columns:
            if ticker in top_performers:
                weights[ticker] = 1.0 / top_n
            else:
                weights[ticker] = 0.0
        
        return weights


class VolatilityWeightStrategy(PortfolioStrategy):
    """Inverse volatility weighted strategy."""
    
    def calculate_weights(
        self,
        returns_data: pd.DataFrame,
        lookback_period: int = 60,
        **kwargs
    ) -> Dict[str, float]:
        # Calculate volatility for each asset
        if len(returns_data) < lookback_period:
            lookback_period = len(returns_data)
        
        volatilities = returns_data.tail(lookback_period).std()
        
        # Inverse volatility weights
        inv_vols = 1 / volatilities
        total_inv_vol = inv_vols.sum()
        
        weights = {}
        for ticker in returns_data.columns:
            weights[ticker] = inv_vols[ticker] / total_inv_vol
        
        return weights