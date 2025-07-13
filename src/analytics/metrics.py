import pandas as pd
import numpy as np
from typing import Dict, Optional, Union
import empyrical
from ..utils import Config, load_config


class PerformanceMetrics:
    """Calculate various performance metrics for portfolios and assets."""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or load_config()
        self.risk_free_rate = self.config.analytics.risk_free_rate
        self.periods_per_year = self.config.analytics.periods_per_year
    
    @staticmethod
    def calculate_returns(prices: pd.Series, method: str = "simple") -> pd.Series:
        """Calculate returns from price series."""
        if method == "simple":
            return prices.pct_change()
        elif method == "log":
            return np.log(prices / prices.shift(1))
        else:
            raise ValueError(f"Unknown return calculation method: {method}")
    
    @staticmethod
    def annualized_return(returns: pd.Series, periods_per_year: int = 252) -> float:
        """Calculate annualized return."""
        total_return = (1 + returns).prod() - 1
        n_periods = len(returns)
        if n_periods == 0:
            return 0
        years = n_periods / periods_per_year
        return (1 + total_return) ** (1 / years) - 1
    
    @staticmethod
    def annualized_volatility(returns: pd.Series, periods_per_year: int = 252) -> float:
        """Calculate annualized volatility."""
        return returns.std() * np.sqrt(periods_per_year)
    
    def sharpe_ratio(
        self,
        returns: pd.Series,
        risk_free_rate: Optional[float] = None,
        periods_per_year: Optional[int] = None
    ) -> float:
        if risk_free_rate is None:
            risk_free_rate = self.risk_free_rate
        if periods_per_year is None:
            periods_per_year = self.periods_per_year
        """Calculate Sharpe ratio."""
        excess_returns = returns - risk_free_rate / periods_per_year
        
        if returns.std() == 0:
            return 0
        
        return empyrical.sharpe_ratio(excess_returns, periods_per_year)
    
    def sortino_ratio(
        self,
        returns: pd.Series,
        risk_free_rate: Optional[float] = None,
        periods_per_year: Optional[int] = None
    ) -> float:
        if risk_free_rate is None:
            risk_free_rate = self.risk_free_rate
        if periods_per_year is None:
            periods_per_year = self.periods_per_year
        """Calculate Sortino ratio."""
        return empyrical.sortino_ratio(returns, risk_free_rate / periods_per_year, periods_per_year)
    
    @staticmethod
    def max_drawdown(returns: pd.Series) -> float:
        """Calculate maximum drawdown."""
        return empyrical.max_drawdown(returns)
    
    @staticmethod
    def calmar_ratio(returns: pd.Series, periods_per_year: int = 252) -> float:
        """Calculate Calmar ratio."""
        return empyrical.calmar_ratio(returns, periods_per_year)
    
    @staticmethod
    def var(returns: pd.Series, confidence_level: float = 0.95) -> float:
        """Calculate Value at Risk (VaR)."""
        return np.percentile(returns, (1 - confidence_level) * 100)
    
    @staticmethod
    def cvar(returns: pd.Series, confidence_level: float = 0.95) -> float:
        """Calculate Conditional Value at Risk (CVaR)."""
        var_threshold = PerformanceMetrics.var(returns, confidence_level)
        return returns[returns <= var_threshold].mean()
    
    @staticmethod
    def information_ratio(
        returns: pd.Series,
        benchmark_returns: pd.Series,
        periods_per_year: int = 252
    ) -> float:
        """Calculate Information ratio."""
        active_returns = returns - benchmark_returns
        tracking_error = active_returns.std() * np.sqrt(periods_per_year)
        
        if tracking_error == 0:
            return 0
        
        return PerformanceMetrics.annualized_return(active_returns, periods_per_year) / tracking_error
    
    @staticmethod
    def beta(returns: pd.Series, market_returns: pd.Series) -> float:
        """Calculate beta relative to market."""
        aligned_returns = pd.DataFrame({
            "returns": returns,
            "market": market_returns
        }).dropna()
        
        if len(aligned_returns) < 2:
            return 1.0
        
        covariance = aligned_returns.cov().iloc[0, 1]
        market_variance = aligned_returns["market"].var()
        
        if market_variance == 0:
            return 1.0
        
        return covariance / market_variance
    
    @staticmethod
    def alpha(
        returns: pd.Series,
        market_returns: pd.Series,
        risk_free_rate: float = 0.02,
        periods_per_year: int = 252
    ) -> float:
        """Calculate Jensen's alpha."""
        beta_value = PerformanceMetrics.beta(returns, market_returns)
        
        portfolio_return = PerformanceMetrics.annualized_return(returns, periods_per_year)
        market_return = PerformanceMetrics.annualized_return(market_returns, periods_per_year)
        
        return portfolio_return - (risk_free_rate + beta_value * (market_return - risk_free_rate))
    
    @staticmethod
    def treynor_ratio(
        returns: pd.Series,
        market_returns: pd.Series,
        risk_free_rate: float = 0.02,
        periods_per_year: int = 252
    ) -> float:
        """Calculate Treynor ratio."""
        beta_value = PerformanceMetrics.beta(returns, market_returns)
        
        if beta_value == 0:
            return 0
        
        portfolio_return = PerformanceMetrics.annualized_return(returns, periods_per_year)
        return (portfolio_return - risk_free_rate) / beta_value
    
    @staticmethod
    def calculate_all_metrics(
        returns: pd.Series,
        benchmark_returns: Optional[pd.Series] = None,
        risk_free_rate: float = 0.02,
        periods_per_year: int = 252
    ) -> Dict[str, float]:
        """Calculate all available metrics."""
        metrics = {
            "annualized_return": PerformanceMetrics.annualized_return(returns, periods_per_year) * 100,
            "annualized_volatility": PerformanceMetrics.annualized_volatility(returns, periods_per_year) * 100,
            "sharpe_ratio": PerformanceMetrics.sharpe_ratio(returns, risk_free_rate, periods_per_year),
            "sortino_ratio": PerformanceMetrics.sortino_ratio(returns, risk_free_rate, periods_per_year),
            "max_drawdown": PerformanceMetrics.max_drawdown(returns) * 100,
            "calmar_ratio": PerformanceMetrics.calmar_ratio(returns, periods_per_year),
            "var_95": PerformanceMetrics.var(returns, 0.95) * 100,
            "cvar_95": PerformanceMetrics.cvar(returns, 0.95) * 100,
            "skewness": returns.skew(),
            "kurtosis": returns.kurtosis()
        }
        
        if benchmark_returns is not None:
            # Align the series
            aligned = pd.DataFrame({
                "returns": returns,
                "benchmark": benchmark_returns
            }).dropna()
            
            if len(aligned) > 1:
                metrics.update({
                    "beta": PerformanceMetrics.beta(aligned["returns"], aligned["benchmark"]),
                    "alpha": PerformanceMetrics.alpha(aligned["returns"], aligned["benchmark"], risk_free_rate, periods_per_year) * 100,
                    "information_ratio": PerformanceMetrics.information_ratio(aligned["returns"], aligned["benchmark"], periods_per_year),
                    "treynor_ratio": PerformanceMetrics.treynor_ratio(aligned["returns"], aligned["benchmark"], risk_free_rate, periods_per_year)
                })
        
        return metrics