import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
import matplotlib.pyplot as plt
import seaborn as sns
from scipy.cluster.hierarchy import dendrogram, linkage
from scipy.spatial.distance import squareform


class CorrelationAnalyzer:
    """Analyze correlations between ETFs."""
    
    def __init__(self, returns_data: pd.DataFrame):
        """
        Initialize with returns data.
        
        Args:
            returns_data: DataFrame with returns, columns are asset tickers
        """
        self.returns = returns_data.dropna()
        self.correlation_matrix = None
        self.rolling_correlations = None
    
    def calculate_correlation_matrix(self, method: str = "pearson") -> pd.DataFrame:
        """Calculate correlation matrix using specified method."""
        self.correlation_matrix = self.returns.corr(method=method)
        return self.correlation_matrix
    
    def calculate_rolling_correlation(
        self,
        ticker1: str,
        ticker2: str,
        window: int = 60
    ) -> pd.Series:
        """Calculate rolling correlation between two assets."""
        if ticker1 not in self.returns.columns or ticker2 not in self.returns.columns:
            raise ValueError(f"Ticker not found in returns data")
        
        return self.returns[ticker1].rolling(window).corr(self.returns[ticker2])
    
    def find_low_correlation_pairs(
        self,
        max_correlation: float = 0.3,
        min_data_points: int = 100
    ) -> List[Tuple[str, str, float]]:
        """Find asset pairs with low correlation."""
        if self.correlation_matrix is None:
            self.calculate_correlation_matrix()
        
        low_corr_pairs = []
        
        for i in range(len(self.correlation_matrix.columns)):
            for j in range(i + 1, len(self.correlation_matrix.columns)):
                ticker1 = self.correlation_matrix.columns[i]
                ticker2 = self.correlation_matrix.columns[j]
                
                # Check data availability
                valid_data = self.returns[[ticker1, ticker2]].dropna()
                if len(valid_data) < min_data_points:
                    continue
                
                corr = self.correlation_matrix.iloc[i, j]
                
                if abs(corr) <= max_correlation:
                    low_corr_pairs.append((ticker1, ticker2, corr))
        
        return sorted(low_corr_pairs, key=lambda x: abs(x[2]))
    
    def calculate_correlation_stability(
        self,
        ticker1: str,
        ticker2: str,
        window: int = 60
    ) -> Dict[str, float]:
        """Calculate stability metrics for correlation between two assets."""
        rolling_corr = self.calculate_rolling_correlation(ticker1, ticker2, window)
        rolling_corr = rolling_corr.dropna()
        
        if len(rolling_corr) == 0:
            return {
                "mean": np.nan,
                "std": np.nan,
                "min": np.nan,
                "max": np.nan,
                "range": np.nan
            }
        
        return {
            "mean": rolling_corr.mean(),
            "std": rolling_corr.std(),
            "min": rolling_corr.min(),
            "max": rolling_corr.max(),
            "range": rolling_corr.max() - rolling_corr.min()
        }
    
    def cluster_assets(self, method: str = "average") -> Tuple[np.ndarray, List[str]]:
        """Perform hierarchical clustering on assets based on correlation."""
        if self.correlation_matrix is None:
            self.calculate_correlation_matrix()
        
        # Convert correlation to distance
        distance_matrix = 1 - self.correlation_matrix
        condensed_distances = squareform(distance_matrix)
        
        # Perform clustering
        linkage_matrix = linkage(condensed_distances, method=method)
        
        return linkage_matrix, list(self.correlation_matrix.columns)
    
    def plot_correlation_matrix(
        self,
        figsize: Tuple[int, int] = (10, 8),
        annot: bool = True,
        cmap: str = "coolwarm"
    ) -> plt.Figure:
        """Plot correlation matrix heatmap."""
        if self.correlation_matrix is None:
            self.calculate_correlation_matrix()
        
        fig, ax = plt.subplots(figsize=figsize)
        
        mask = np.triu(np.ones_like(self.correlation_matrix), k=1)
        
        sns.heatmap(
            self.correlation_matrix,
            mask=mask,
            annot=annot,
            fmt=".2f",
            cmap=cmap,
            center=0,
            square=True,
            cbar_kws={"label": "Correlation"},
            ax=ax
        )
        
        ax.set_title("Asset Correlation Matrix")
        plt.tight_layout()
        
        return fig
    
    def plot_rolling_correlation(
        self,
        ticker1: str,
        ticker2: str,
        window: int = 60,
        figsize: Tuple[int, int] = (10, 6)
    ) -> plt.Figure:
        """Plot rolling correlation between two assets."""
        rolling_corr = self.calculate_rolling_correlation(ticker1, ticker2, window)
        
        fig, ax = plt.subplots(figsize=figsize)
        
        rolling_corr.plot(ax=ax, label=f"{window}-day rolling correlation")
        
        # Add horizontal lines for reference
        ax.axhline(y=0, color='black', linestyle='-', alpha=0.3)
        ax.axhline(y=0.5, color='gray', linestyle='--', alpha=0.5)
        ax.axhline(y=-0.5, color='gray', linestyle='--', alpha=0.5)
        
        # Add average correlation
        avg_corr = rolling_corr.mean()
        ax.axhline(y=avg_corr, color='red', linestyle='--', alpha=0.7, 
                  label=f'Average: {avg_corr:.3f}')
        
        ax.set_title(f"Rolling Correlation: {ticker1} vs {ticker2}")
        ax.set_ylabel("Correlation")
        ax.set_ylim(-1, 1)
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        return fig
    
    def plot_dendrogram(
        self,
        figsize: Tuple[int, int] = (12, 8),
        orientation: str = "top"
    ) -> plt.Figure:
        """Plot hierarchical clustering dendrogram."""
        linkage_matrix, labels = self.cluster_assets()
        
        fig, ax = plt.subplots(figsize=figsize)
        
        dendrogram(
            linkage_matrix,
            labels=labels,
            ax=ax,
            orientation=orientation
        )
        
        ax.set_title("Asset Clustering Dendrogram")
        
        if orientation in ["top", "bottom"]:
            ax.set_xlabel("Asset")
            ax.set_ylabel("Distance")
            plt.xticks(rotation=45, ha='right')
        else:
            ax.set_ylabel("Asset")
            ax.set_xlabel("Distance")
        
        plt.tight_layout()
        return fig
    
    def plot_correlation_network(
        self,
        min_correlation: float = 0.5,
        figsize: Tuple[int, int] = (12, 10)
    ) -> plt.Figure:
        """Plot network graph of correlations above threshold."""
        if self.correlation_matrix is None:
            self.calculate_correlation_matrix()
        
        import networkx as nx
        
        # Create graph
        G = nx.Graph()
        
        # Add nodes
        for ticker in self.correlation_matrix.columns:
            G.add_node(ticker)
        
        # Add edges for high correlations
        for i in range(len(self.correlation_matrix.columns)):
            for j in range(i + 1, len(self.correlation_matrix.columns)):
                corr = self.correlation_matrix.iloc[i, j]
                if abs(corr) >= min_correlation:
                    G.add_edge(
                        self.correlation_matrix.columns[i],
                        self.correlation_matrix.columns[j],
                        weight=abs(corr),
                        correlation=corr
                    )
        
        fig, ax = plt.subplots(figsize=figsize)
        
        # Layout
        pos = nx.spring_layout(G, k=2, iterations=50)
        
        # Draw nodes
        nx.draw_networkx_nodes(G, pos, node_size=1000, node_color='lightblue', ax=ax)
        
        # Draw edges with varying width based on correlation
        edges = G.edges()
        weights = [G[u][v]['weight'] for u, v in edges]
        
        nx.draw_networkx_edges(
            G, pos,
            width=[w * 3 for w in weights],
            alpha=0.6,
            ax=ax
        )
        
        # Draw labels
        nx.draw_networkx_labels(G, pos, font_size=10, ax=ax)
        
        ax.set_title(f"Correlation Network (|correlation| >= {min_correlation})")
        ax.axis('off')
        
        plt.tight_layout()
        return fig
    
    def calculate_portfolio_correlation(
        self,
        weights: Dict[str, float],
        benchmark: str
    ) -> float:
        """Calculate correlation between portfolio and benchmark."""
        portfolio_returns = pd.Series(0, index=self.returns.index)
        
        for ticker, weight in weights.items():
            if ticker in self.returns.columns:
                portfolio_returns += weight * self.returns[ticker]
        
        if benchmark not in self.returns.columns:
            raise ValueError(f"Benchmark {benchmark} not found in returns data")
        
        return portfolio_returns.corr(self.returns[benchmark])