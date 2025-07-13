import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from pathlib import Path

from ..backtesting import BacktestResults
from ..analytics import CorrelationAnalyzer
from ..utils import Config, load_config


class PortfolioPlotter:
    """Handles all visualization for the ETF Research Platform."""
    
    def __init__(self, config: Optional[Config] = None):
        self.config = config or load_config()
        
        # Set style
        plt.style.use(self.config.visualization.style)
        
        # Default figure settings
        self.figsize = tuple(self.config.visualization.figure_size)
        self.dpi = self.config.visualization.dpi
        self.save_format = self.config.visualization.save_format
    
    def plot_backtest_comparison(
        self,
        results: Dict[str, BacktestResults],
        etf_data: Optional[Dict[str, pd.DataFrame]] = None,
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """Create comprehensive comparison plot for multiple backtest results."""
        fig, axes = plt.subplots(2, 2, figsize=self.figsize)
        
        # 1. Cumulative returns
        ax1 = axes[0, 0]
        for name, result in results.items():
            returns = result.portfolio_values["total_value"].pct_change().fillna(0)
            cum_returns = (1 + returns).cumprod() - 1
            cum_returns.plot(ax=ax1, label=name)
        
        # Add benchmark if available
        if etf_data and "SPY" in etf_data:
            spy_returns = etf_data["SPY"]["Close"].pct_change().fillna(0)
            spy_cum_returns = (1 + spy_returns).cumprod() - 1
            spy_cum_returns.plot(ax=ax1, label="SPY Benchmark", linestyle="--", alpha=0.7)
        
        ax1.set_title("Cumulative Returns Comparison")
        ax1.set_ylabel("Cumulative Return")
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        ax1.yaxis.set_major_formatter(plt.FuncFormatter(lambda y, _: '{:.0%}'.format(y)))
        
        # 2. Risk-Return scatter
        ax2 = axes[0, 1]
        for name, result in results.items():
            metrics = result.calculate_metrics()
            ax2.scatter(
                metrics['volatility'],
                metrics['annualized_return'],
                s=100,
                label=name
            )
            
            # Add label next to point
            ax2.annotate(
                name,
                (metrics['volatility'], metrics['annualized_return']),
                xytext=(5, 5),
                textcoords='offset points',
                fontsize=8,
                alpha=0.7
            )
        
        ax2.set_xlabel("Volatility (%)")
        ax2.set_ylabel("Annual Return (%)")
        ax2.set_title("Risk-Return Profile")
        ax2.grid(True, alpha=0.3)
        
        # 3. Drawdown comparison
        ax3 = axes[1, 0]
        for name, result in results.items():
            values = result.portfolio_values["total_value"]
            running_max = values.expanding().max()
            drawdown = (values - running_max) / running_max * 100
            drawdown.plot(ax=ax3, label=name, alpha=0.7)
        
        ax3.set_title("Drawdown Comparison")
        ax3.set_ylabel("Drawdown (%)")
        ax3.legend()
        ax3.grid(True, alpha=0.3)
        ax3.fill_between(drawdown.index, 0, drawdown.min(), alpha=0.1, color='red')
        
        # 4. Performance metrics table
        ax4 = axes[1, 1]
        ax4.axis('tight')
        ax4.axis('off')
        
        # Create metrics table
        metrics_data = []
        metrics_columns = ['Strategy', 'Return (%)', 'Vol (%)', 'Sharpe', 'Max DD (%)']
        
        for name, result in results.items():
            metrics = result.calculate_metrics()
            metrics_data.append([
                name,
                f"{metrics['annualized_return']:.1f}",
                f"{metrics['volatility']:.1f}",
                f"{metrics['sharpe_ratio']:.2f}",
                f"{metrics['max_drawdown']:.1f}"
            ])
        
        table = ax4.table(
            cellText=metrics_data,
            colLabels=metrics_columns,
            cellLoc='center',
            loc='center'
        )
        table.auto_set_font_size(False)
        table.set_fontsize(9)
        table.scale(1.2, 1.5)
        
        ax4.set_title("Performance Summary", pad=20)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight', format=self.save_format)
        
        return fig
    
    def plot_correlation_analysis(
        self,
        correlation_analyzer: CorrelationAnalyzer,
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """Plot correlation analysis results."""
        fig, axes = plt.subplots(2, 2, figsize=self.figsize)
        
        # 1. Correlation matrix heatmap
        ax1 = axes[0, 0]
        corr_matrix = correlation_analyzer.calculate_correlation_matrix()
        
        mask = np.triu(np.ones_like(corr_matrix), k=1)
        sns.heatmap(
            corr_matrix,
            mask=mask,
            annot=True,
            fmt=".2f",
            cmap="coolwarm",
            center=0,
            square=True,
            cbar_kws={"label": "Correlation"},
            ax=ax1
        )
        ax1.set_title("Asset Correlation Matrix")
        
        # 2. Dendrogram
        ax2 = axes[0, 1]
        from scipy.cluster.hierarchy import dendrogram
        linkage_matrix, labels = correlation_analyzer.cluster_assets()
        
        dendrogram(
            linkage_matrix,
            labels=labels,
            ax=ax2,
            orientation='top'
        )
        ax2.set_title("Asset Clustering Dendrogram")
        ax2.set_xlabel("Asset")
        ax2.set_ylabel("Distance")
        plt.setp(ax2.xaxis.get_majorticklabels(), rotation=45, ha='right')
        
        # 3. Rolling correlation example
        ax3 = axes[1, 0]
        tickers = list(corr_matrix.columns)
        if len(tickers) >= 2:
            rolling_corr = correlation_analyzer.calculate_rolling_correlation(
                tickers[0], tickers[1], window=60
            )
            rolling_corr.plot(ax=ax3)
            ax3.set_title(f"Rolling Correlation: {tickers[0]} vs {tickers[1]}")
            ax3.set_ylabel("Correlation")
            ax3.grid(True, alpha=0.3)
            ax3.axhline(y=0, color='black', linestyle='-', alpha=0.3)
        
        # 4. Low correlation pairs
        ax4 = axes[1, 1]
        ax4.axis('tight')
        ax4.axis('off')
        
        low_corr_pairs = correlation_analyzer.find_low_correlation_pairs(max_correlation=0.3)[:5]
        
        if low_corr_pairs:
            pairs_data = [[f"{t1}-{t2}", f"{corr:.3f}"] for t1, t2, corr in low_corr_pairs]
            
            table = ax4.table(
                cellText=pairs_data,
                colLabels=['Asset Pair', 'Correlation'],
                cellLoc='center',
                loc='center'
            )
            table.auto_set_font_size(False)
            table.set_fontsize(10)
            table.scale(1.2, 1.5)
        
        ax4.set_title("Low Correlation Pairs", pad=20)
        
        plt.tight_layout()
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight', format=self.save_format)
        
        return fig
    
    def plot_portfolio_allocation(
        self,
        weights: Dict[str, float],
        title: str = "Portfolio Allocation",
        save_path: Optional[str] = None
    ) -> plt.Figure:
        """Plot portfolio allocation as pie chart."""
        fig, ax = plt.subplots(figsize=(8, 8))
        
        # Filter out small positions and cash
        filtered_weights = {k: v for k, v in weights.items() 
                          if k != "CASH" and v > 0.01}
        
        if filtered_weights:
            weights_series = pd.Series(filtered_weights)
            weights_series.plot(
                kind="pie",
                ax=ax,
                autopct="%1.1f%%",
                startangle=90,
                colors=plt.cm.Set3.colors
            )
            ax.set_ylabel("")
            ax.set_title(title)
        else:
            ax.text(0.5, 0.5, "No positions", ha="center", va="center", fontsize=14)
            ax.set_title(title)
            ax.axis('off')
        
        if save_path:
            plt.savefig(save_path, dpi=self.dpi, bbox_inches='tight', format=self.save_format)
        
        return fig
    
    def save_all_plots(
        self,
        results: Dict[str, BacktestResults],
        correlation_analyzer: CorrelationAnalyzer,
        output_dir: str = "output/plots"
    ):
        """Save all standard plots to a directory."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Backtest comparison
        self.plot_backtest_comparison(
            results,
            save_path=output_path / f"backtest_comparison.{self.save_format}"
        )
        
        # Correlation analysis
        self.plot_correlation_analysis(
            correlation_analyzer,
            save_path=output_path / f"correlation_analysis.{self.save_format}"
        )
        
        # Individual portfolio allocations
        for name, result in results.items():
            weights = result.final_portfolio.get_weights()
            self.plot_portfolio_allocation(
                weights,
                title=f"{name} - Final Allocation",
                save_path=output_path / f"allocation_{name.lower().replace(' ', '_')}.{self.save_format}"
            )
        
        plt.close('all')  # Clean up