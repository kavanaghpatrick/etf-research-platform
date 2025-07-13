import numpy as np
import pandas as pd
from scipy.optimize import minimize
from typing import Dict, List, Optional, Tuple
import warnings


class PortfolioOptimizer:
    """Portfolio optimization using modern portfolio theory."""
    
    def __init__(self, returns_data: pd.DataFrame):
        """
        Initialize optimizer with returns data.
        
        Args:
            returns_data: DataFrame with returns, columns are asset tickers
        """
        self.returns = returns_data.dropna()
        self.mean_returns = self.returns.mean()
        self.cov_matrix = self.returns.cov()
        self.n_assets = len(self.returns.columns)
        self.tickers = list(self.returns.columns)
        
    def calculate_portfolio_stats(
        self,
        weights: np.ndarray,
        annualize: bool = True,
        periods_per_year: int = 252
    ) -> Tuple[float, float]:
        """Calculate portfolio return and volatility."""
        portfolio_return = np.dot(weights, self.mean_returns)
        portfolio_variance = np.dot(weights.T, np.dot(self.cov_matrix, weights))
        portfolio_volatility = np.sqrt(portfolio_variance)
        
        if annualize:
            portfolio_return *= periods_per_year
            portfolio_volatility *= np.sqrt(periods_per_year)
        
        return portfolio_return, portfolio_volatility
    
    def optimize_min_variance(
        self,
        constraints: Optional[Dict] = None,
        bounds: Optional[Tuple] = None
    ) -> Dict[str, float]:
        """Find minimum variance portfolio."""
        def objective(weights):
            return np.dot(weights.T, np.dot(self.cov_matrix, weights))
        
        initial_weights = np.array(self.n_assets * [1.0 / self.n_assets])
        
        if bounds is None:
            bounds = tuple((0, 1) for _ in range(self.n_assets))
        
        constraints_list = [{"type": "eq", "fun": lambda x: np.sum(x) - 1}]
        
        if constraints:
            if "max_weight" in constraints:
                max_weight = constraints["max_weight"]
                bounds = tuple((0, max_weight) for _ in range(self.n_assets))
            
            if "min_weight" in constraints:
                min_weight = constraints["min_weight"]
                bounds = tuple((min_weight, bounds[0][1]) for _ in range(self.n_assets))
        
        result = minimize(
            objective,
            initial_weights,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints_list,
            options={"disp": False}
        )
        
        if not result.success:
            warnings.warn(f"Optimization failed: {result.message}")
        
        return dict(zip(self.tickers, result.x))
    
    def optimize_max_sharpe(
        self,
        risk_free_rate: float = 0.02,
        constraints: Optional[Dict] = None,
        bounds: Optional[Tuple] = None
    ) -> Dict[str, float]:
        """Find maximum Sharpe ratio portfolio."""
        def negative_sharpe(weights):
            ret, vol = self.calculate_portfolio_stats(weights)
            if vol == 0:
                return 0
            return -(ret - risk_free_rate) / vol
        
        initial_weights = np.array(self.n_assets * [1.0 / self.n_assets])
        
        if bounds is None:
            bounds = tuple((0, 1) for _ in range(self.n_assets))
        
        constraints_list = [{"type": "eq", "fun": lambda x: np.sum(x) - 1}]
        
        if constraints:
            if "max_weight" in constraints:
                max_weight = constraints["max_weight"]
                bounds = tuple((0, max_weight) for _ in range(self.n_assets))
            
            if "min_weight" in constraints:
                min_weight = constraints["min_weight"]
                bounds = tuple((min_weight, bounds[0][1]) for _ in range(self.n_assets))
        
        result = minimize(
            negative_sharpe,
            initial_weights,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints_list,
            options={"disp": False}
        )
        
        if not result.success:
            warnings.warn(f"Optimization failed: {result.message}")
        
        return dict(zip(self.tickers, result.x))
    
    def optimize_risk_parity(self) -> Dict[str, float]:
        """Find risk parity portfolio where each asset contributes equally to risk."""
        def risk_contribution_objective(weights):
            portfolio_vol = np.sqrt(np.dot(weights.T, np.dot(self.cov_matrix, weights)))
            marginal_contrib = np.dot(self.cov_matrix, weights)
            contrib = weights * marginal_contrib / portfolio_vol
            
            # We want equal risk contribution
            target_contrib = 1.0 / self.n_assets
            return np.sum((contrib - target_contrib) ** 2)
        
        initial_weights = np.array(self.n_assets * [1.0 / self.n_assets])
        bounds = tuple((0.01, 1) for _ in range(self.n_assets))
        constraints = [{"type": "eq", "fun": lambda x: np.sum(x) - 1}]
        
        result = minimize(
            risk_contribution_objective,
            initial_weights,
            method="SLSQP",
            bounds=bounds,
            constraints=constraints,
            options={"disp": False}
        )
        
        if not result.success:
            warnings.warn(f"Optimization failed: {result.message}")
        
        return dict(zip(self.tickers, result.x))
    
    def efficient_frontier(
        self,
        n_portfolios: int = 100,
        risk_free_rate: float = 0.02
    ) -> pd.DataFrame:
        """Generate efficient frontier portfolios."""
        target_returns = np.linspace(
            self.mean_returns.min() * 252,
            self.mean_returns.max() * 252,
            n_portfolios
        )
        
        efficient_portfolios = []
        
        for target_return in target_returns:
            def objective(weights):
                return np.dot(weights.T, np.dot(self.cov_matrix, weights))
            
            constraints = [
                {"type": "eq", "fun": lambda x: np.sum(x) - 1},
                {"type": "eq", "fun": lambda x: np.dot(x, self.mean_returns) * 252 - target_return}
            ]
            
            bounds = tuple((0, 1) for _ in range(self.n_assets))
            initial_weights = np.array(self.n_assets * [1.0 / self.n_assets])
            
            result = minimize(
                objective,
                initial_weights,
                method="SLSQP",
                bounds=bounds,
                constraints=constraints,
                options={"disp": False}
            )
            
            if result.success:
                ret, vol = self.calculate_portfolio_stats(result.x)
                sharpe = (ret - risk_free_rate) / vol if vol > 0 else 0
                
                portfolio_info = {
                    "return": ret,
                    "volatility": vol,
                    "sharpe_ratio": sharpe
                }
                
                for ticker, weight in zip(self.tickers, result.x):
                    portfolio_info[f"weight_{ticker}"] = weight
                
                efficient_portfolios.append(portfolio_info)
        
        return pd.DataFrame(efficient_portfolios)