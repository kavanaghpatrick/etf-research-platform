import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats


class RiskAnalyzer:
    """Analyze risk characteristics of portfolios and assets."""
    
    def __init__(self, returns_data: pd.DataFrame):
        """
        Initialize with returns data.
        
        Args:
            returns_data: DataFrame with returns, columns are asset tickers
        """
        self.returns = returns_data.dropna()
        self.cov_matrix = self.returns.cov()
        self.corr_matrix = self.returns.corr()
    
    def calculate_portfolio_risk(self, weights: Dict[str, float]) -> float:
        """Calculate portfolio volatility given weights."""
        weight_array = np.array([weights.get(ticker, 0) for ticker in self.returns.columns])
        portfolio_variance = np.dot(weight_array.T, np.dot(self.cov_matrix, weight_array))
        return np.sqrt(portfolio_variance)
    
    def risk_contribution(self, weights: Dict[str, float]) -> Dict[str, float]:
        """Calculate risk contribution of each asset."""
        weight_array = np.array([weights.get(ticker, 0) for ticker in self.returns.columns])
        portfolio_vol = self.calculate_portfolio_risk(weights)
        
        if portfolio_vol == 0:
            return {ticker: 0 for ticker in self.returns.columns}
        
        marginal_contributions = np.dot(self.cov_matrix, weight_array) / portfolio_vol
        contributions = weight_array * marginal_contributions
        
        return dict(zip(self.returns.columns, contributions))
    
    def marginal_risk_contribution(self, weights: Dict[str, float]) -> Dict[str, float]:
        """Calculate marginal risk contribution (derivative of risk w.r.t. weight)."""
        weight_array = np.array([weights.get(ticker, 0) for ticker in self.returns.columns])
        portfolio_vol = self.calculate_portfolio_risk(weights)
        
        if portfolio_vol == 0:
            return {ticker: 0 for ticker in self.returns.columns}
        
        marginal_contributions = np.dot(self.cov_matrix, weight_array) / portfolio_vol
        
        return dict(zip(self.returns.columns, marginal_contributions))
    
    def calculate_var_historical(
        self,
        weights: Optional[Dict[str, float]] = None,
        confidence_level: float = 0.95,
        holding_period: int = 1
    ) -> float:
        """Calculate historical VaR."""
        if weights:
            portfolio_returns = self._calculate_portfolio_returns(weights)
        else:
            portfolio_returns = self.returns.mean(axis=1)
        
        # Scale returns for holding period
        scaled_returns = portfolio_returns * np.sqrt(holding_period)
        
        return np.percentile(scaled_returns, (1 - confidence_level) * 100)
    
    def calculate_var_parametric(
        self,
        weights: Optional[Dict[str, float]] = None,
        confidence_level: float = 0.95,
        holding_period: int = 1
    ) -> float:
        """Calculate parametric VaR assuming normal distribution."""
        if weights:
            portfolio_returns = self._calculate_portfolio_returns(weights)
        else:
            portfolio_returns = self.returns.mean(axis=1)
        
        mean = portfolio_returns.mean() * holding_period
        std = portfolio_returns.std() * np.sqrt(holding_period)
        
        z_score = stats.norm.ppf(1 - confidence_level)
        return mean + z_score * std
    
    def calculate_cvar(
        self,
        weights: Optional[Dict[str, float]] = None,
        confidence_level: float = 0.95,
        holding_period: int = 1
    ) -> float:
        """Calculate Conditional VaR (Expected Shortfall)."""
        if weights:
            portfolio_returns = self._calculate_portfolio_returns(weights)
        else:
            portfolio_returns = self.returns.mean(axis=1)
        
        scaled_returns = portfolio_returns * np.sqrt(holding_period)
        var_threshold = self.calculate_var_historical(weights, confidence_level, holding_period)
        
        return scaled_returns[scaled_returns <= var_threshold].mean()
    
    def stress_test(
        self,
        weights: Dict[str, float],
        scenarios: Dict[str, Dict[str, float]]
    ) -> Dict[str, float]:
        """
        Perform stress testing with custom scenarios.
        
        Args:
            weights: Portfolio weights
            scenarios: Dict of scenario name -> asset returns in that scenario
        
        Returns:
            Portfolio return in each scenario
        """
        results = {}
        
        for scenario_name, scenario_returns in scenarios.items():
            portfolio_return = sum(
                weights.get(ticker, 0) * scenario_returns.get(ticker, 0)
                for ticker in weights.keys()
            )
            results[scenario_name] = portfolio_return
        
        return results
    
    def monte_carlo_var(
        self,
        weights: Optional[Dict[str, float]] = None,
        confidence_level: float = 0.95,
        holding_period: int = 1,
        n_simulations: int = 10000
    ) -> Tuple[float, np.ndarray]:
        """Calculate VaR using Monte Carlo simulation."""
        if weights:
            weight_array = np.array([weights.get(ticker, 0) for ticker in self.returns.columns])
        else:
            weight_array = np.ones(len(self.returns.columns)) / len(self.returns.columns)
        
        # Portfolio parameters
        portfolio_mean = np.dot(weight_array, self.returns.mean())
        portfolio_vol = self.calculate_portfolio_risk(weights) if weights else self.returns.mean(axis=1).std()
        
        # Generate simulations
        simulated_returns = np.random.normal(
            portfolio_mean * holding_period,
            portfolio_vol * np.sqrt(holding_period),
            n_simulations
        )
        
        var = np.percentile(simulated_returns, (1 - confidence_level) * 100)
        
        return var, simulated_returns
    
    def plot_risk_metrics(self, weights: Dict[str, float]) -> plt.Figure:
        """Plot various risk metrics."""
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        
        # Risk contributions
        ax1 = axes[0, 0]
        contributions = self.risk_contribution(weights)
        pd.Series(contributions).plot(kind="bar", ax=ax1)
        ax1.set_title("Risk Contribution by Asset")
        ax1.set_ylabel("Risk Contribution")
        ax1.tick_params(axis='x', rotation=45)
        
        # VaR histogram
        ax2 = axes[0, 1]
        portfolio_returns = self._calculate_portfolio_returns(weights)
        portfolio_returns.hist(bins=50, ax=ax2, alpha=0.7)
        
        var_95 = self.calculate_var_historical(weights, 0.95)
        cvar_95 = self.calculate_cvar(weights, 0.95)
        
        ax2.axvline(var_95, color='red', linestyle='--', label=f'VaR 95%: {var_95:.2%}')
        ax2.axvline(cvar_95, color='darkred', linestyle='--', label=f'CVaR 95%: {cvar_95:.2%}')
        ax2.set_title("Return Distribution with VaR/CVaR")
        ax2.set_xlabel("Return")
        ax2.legend()
        
        # Monte Carlo simulation
        ax3 = axes[1, 0]
        mc_var, simulated_returns = self.monte_carlo_var(weights, n_simulations=5000)
        ax3.hist(simulated_returns, bins=50, alpha=0.7, density=True)
        ax3.axvline(mc_var, color='red', linestyle='--', label=f'MC VaR 95%: {mc_var:.2%}')
        ax3.set_title("Monte Carlo Simulation")
        ax3.set_xlabel("Simulated Return")
        ax3.legend()
        
        # Correlation heatmap for portfolio assets
        ax4 = axes[1, 1]
        portfolio_assets = [asset for asset in weights.keys() if weights[asset] > 0]
        if portfolio_assets:
            corr_subset = self.corr_matrix.loc[portfolio_assets, portfolio_assets]
            sns.heatmap(corr_subset, annot=True, fmt='.2f', cmap='coolwarm', 
                       center=0, ax=ax4, cbar_kws={'label': 'Correlation'})
            ax4.set_title("Correlation Matrix")
        
        plt.tight_layout()
        return fig
    
    def _calculate_portfolio_returns(self, weights: Dict[str, float]) -> pd.Series:
        """Calculate portfolio returns from weights."""
        portfolio_returns = pd.Series(0, index=self.returns.index)
        
        for ticker, weight in weights.items():
            if ticker in self.returns.columns:
                portfolio_returns += weight * self.returns[ticker]
        
        return portfolio_returns
    
    def drawdown_analysis(self, weights: Dict[str, float]) -> pd.DataFrame:
        """Analyze drawdowns for a portfolio."""
        portfolio_returns = self._calculate_portfolio_returns(weights)
        cumulative_returns = (1 + portfolio_returns).cumprod()
        running_max = cumulative_returns.expanding().max()
        drawdown = (cumulative_returns - running_max) / running_max
        
        # Find drawdown periods
        drawdown_periods = []
        in_drawdown = False
        start_date = None
        
        for date, dd in drawdown.items():
            if dd < 0 and not in_drawdown:
                in_drawdown = True
                start_date = date
            elif dd == 0 and in_drawdown:
                end_date = date
                peak_date = cumulative_returns[:start_date].idxmax()
                trough_date = drawdown[start_date:end_date].idxmin()
                
                drawdown_periods.append({
                    "peak_date": peak_date,
                    "trough_date": trough_date,
                    "recovery_date": end_date,
                    "drawdown": drawdown[trough_date],
                    "duration_days": (end_date - peak_date).days
                })
                in_drawdown = False
        
        return pd.DataFrame(drawdown_periods)