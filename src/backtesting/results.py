import pandas as pd
import numpy as np
from typing import List, Optional, Dict
from dataclasses import dataclass
import matplotlib.pyplot as plt
import seaborn as sns

from ..models import Portfolio, Transaction


@dataclass
class BacktestResults:
    """Container for backtest results and performance metrics."""
    
    portfolio_values: pd.DataFrame
    transactions: List[Transaction]
    final_portfolio: Portfolio
    benchmark_prices: Optional[pd.Series] = None
    initial_value: float = 100000
    
    @property
    def total_return(self) -> float:
        """Calculate total return percentage."""
        final_value = self.portfolio_values["total_value"].iloc[-1]
        return (final_value - self.initial_value) / self.initial_value
    
    @property
    def annualized_return(self) -> float:
        """Calculate annualized return."""
        days = len(self.portfolio_values)
        years = days / 252
        if years == 0:
            return 0
        return (1 + self.total_return) ** (1 / years) - 1
    
    @property
    def volatility(self) -> float:
        """Calculate annualized volatility."""
        returns = self.portfolio_values["total_value"].pct_change().dropna()
        return returns.std() * np.sqrt(252)
    
    @property
    def sharpe_ratio(self, risk_free_rate: float = 0.02) -> float:
        """Calculate Sharpe ratio."""
        if self.volatility == 0:
            return 0
        return (self.annualized_return - risk_free_rate) / self.volatility
    
    @property
    def max_drawdown(self) -> float:
        """Calculate maximum drawdown."""
        values = self.portfolio_values["total_value"]
        running_max = values.expanding().max()
        drawdown = (values - running_max) / running_max
        return drawdown.min()
    
    @property
    def calmar_ratio(self) -> float:
        """Calculate Calmar ratio (return / max drawdown)."""
        if self.max_drawdown == 0:
            return 0
        return self.annualized_return / abs(self.max_drawdown)
    
    def calculate_metrics(self) -> Dict[str, float]:
        """Calculate all performance metrics."""
        metrics = {
            "total_return": self.total_return * 100,
            "annualized_return": self.annualized_return * 100,
            "volatility": self.volatility * 100,
            "sharpe_ratio": self.sharpe_ratio,
            "max_drawdown": self.max_drawdown * 100,
            "calmar_ratio": self.calmar_ratio,
            "final_value": self.portfolio_values["total_value"].iloc[-1],
            "total_trades": len(self.transactions)
        }
        
        if self.benchmark_prices is not None:
            benchmark_return = (self.benchmark_prices.iloc[-1] - self.benchmark_prices.iloc[0]) / self.benchmark_prices.iloc[0]
            metrics["benchmark_return"] = benchmark_return * 100
            metrics["excess_return"] = (self.total_return - benchmark_return) * 100
        
        return metrics
    
    def plot_performance(self, figsize: tuple = (12, 8)) -> plt.Figure:
        """Plot portfolio performance."""
        fig, axes = plt.subplots(2, 2, figsize=figsize)
        
        # Portfolio value over time
        ax1 = axes[0, 0]
        self.portfolio_values["total_value"].plot(ax=ax1, label="Portfolio", color="blue")
        if self.benchmark_prices is not None:
            normalized_benchmark = self.benchmark_prices * (self.initial_value / self.benchmark_prices.iloc[0])
            normalized_benchmark.plot(ax=ax1, label="Benchmark", color="gray", alpha=0.7)
        ax1.set_title("Portfolio Value Over Time")
        ax1.set_ylabel("Value ($)")
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Daily returns distribution
        ax2 = axes[0, 1]
        returns = self.portfolio_values["total_value"].pct_change().dropna()
        returns.hist(bins=50, ax=ax2, alpha=0.7, color="blue")
        ax2.set_title("Daily Returns Distribution")
        ax2.set_xlabel("Daily Return")
        ax2.set_ylabel("Frequency")
        ax2.grid(True, alpha=0.3)
        
        # Drawdown
        ax3 = axes[1, 0]
        values = self.portfolio_values["total_value"]
        running_max = values.expanding().max()
        drawdown = (values - running_max) / running_max * 100
        drawdown.plot(ax=ax3, color="red", alpha=0.7)
        ax3.fill_between(drawdown.index, drawdown, 0, color="red", alpha=0.3)
        ax3.set_title("Drawdown Over Time")
        ax3.set_ylabel("Drawdown (%)")
        ax3.grid(True, alpha=0.3)
        
        # Portfolio composition
        ax4 = axes[1, 1]
        if self.final_portfolio.positions:
            weights = self.final_portfolio.get_weights()
            non_cash_weights = {k: v for k, v in weights.items() if k != "CASH"}
            if non_cash_weights:
                pd.Series(non_cash_weights).plot(kind="pie", ax=ax4, autopct="%1.1f%%")
                ax4.set_title("Final Portfolio Allocation")
                ax4.set_ylabel("")
        else:
            ax4.text(0.5, 0.5, "No positions", ha="center", va="center")
            ax4.set_title("Final Portfolio Allocation")
        
        plt.tight_layout()
        return fig
    
    def plot_returns_comparison(self, benchmark_name: str = "Benchmark") -> plt.Figure:
        """Plot cumulative returns comparison."""
        fig, ax = plt.subplots(figsize=(10, 6))
        
        # Calculate cumulative returns
        portfolio_returns = self.portfolio_values["total_value"].pct_change().fillna(0)
        cum_returns = (1 + portfolio_returns).cumprod() - 1
        
        cum_returns.plot(ax=ax, label="Portfolio", linewidth=2)
        
        if self.benchmark_prices is not None:
            benchmark_returns = self.benchmark_prices.pct_change().fillna(0)
            cum_benchmark = (1 + benchmark_returns).cumprod() - 1
            cum_benchmark.plot(ax=ax, label=benchmark_name, linewidth=2, alpha=0.7)
        
        ax.set_title("Cumulative Returns Comparison")
        ax.set_ylabel("Cumulative Return")
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        # Format y-axis as percentage
        ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: '{:.0%}'.format(y)))
        
        return fig
    
    def generate_report(self) -> str:
        """Generate a text report of backtest results."""
        metrics = self.calculate_metrics()
        
        report = f"""
Backtest Results Summary
========================

Performance Metrics:
-------------------
Total Return: {metrics['total_return']:.2f}%
Annualized Return: {metrics['annualized_return']:.2f}%
Volatility: {metrics['volatility']:.2f}%
Sharpe Ratio: {metrics['sharpe_ratio']:.2f}
Maximum Drawdown: {metrics['max_drawdown']:.2f}%
Calmar Ratio: {metrics['calmar_ratio']:.2f}

Portfolio Statistics:
--------------------
Initial Value: ${self.initial_value:,.2f}
Final Value: ${metrics['final_value']:,.2f}
Total Trades: {metrics['total_trades']}

Final Portfolio Allocation:
--------------------------
"""
        weights = self.final_portfolio.get_weights()
        for ticker, weight in sorted(weights.items(), key=lambda x: x[1], reverse=True):
            if weight > 0.001:  # Only show positions > 0.1%
                report += f"{ticker}: {weight*100:.1f}%\n"
        
        if 'benchmark_return' in metrics:
            report += f"\nBenchmark Comparison:\n"
            report += f"---------------------\n"
            report += f"Benchmark Return: {metrics['benchmark_return']:.2f}%\n"
            report += f"Excess Return: {metrics['excess_return']:.2f}%\n"
        
        return report