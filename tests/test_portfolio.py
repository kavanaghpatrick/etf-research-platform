import pytest
import pandas as pd
import numpy as np
from unittest.mock import Mock, patch

from src.portfolio import (
    PortfolioOptimizer, PortfolioBuilder,
    EqualWeightStrategy, MarketCapWeightStrategy,
    MinimumVarianceStrategy, MaxSharpeStrategy,
    RiskParityStrategy, MomentumStrategy, VolatilityWeightStrategy
)


class TestPortfolioOptimizer:
    def test_optimizer_init(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        assert optimizer.n_assets == 4
        assert optimizer.tickers == ["SPY", "AGG", "GLD", "VNQ"]
        assert optimizer.mean_returns.shape == (4,)
        assert optimizer.cov_matrix.shape == (4, 4)
    
    def test_calculate_portfolio_stats(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        weights = np.array([0.25, 0.25, 0.25, 0.25])
        ret, vol = optimizer.calculate_portfolio_stats(weights, annualize=True)
        
        assert isinstance(ret, float)
        assert isinstance(vol, float)
        assert vol > 0  # Volatility should be positive
    
    def test_optimize_min_variance(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        weights = optimizer.optimize_min_variance()
        
        assert len(weights) == 4
        assert sum(weights.values()) == pytest.approx(1.0)
        
        for ticker, weight in weights.items():
            assert 0 <= weight <= 1
    
    def test_optimize_min_variance_with_constraints(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        # Test with max weight constraint
        weights = optimizer.optimize_min_variance(constraints={"max_weight": 0.4})
        
        assert sum(weights.values()) == pytest.approx(1.0)
        
        for ticker, weight in weights.items():
            assert 0 <= weight <= 0.4
    
    def test_optimize_max_sharpe(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        weights = optimizer.optimize_max_sharpe(risk_free_rate=0.02)
        
        assert len(weights) == 4
        assert sum(weights.values()) == pytest.approx(1.0)
        
        for ticker, weight in weights.items():
            assert 0 <= weight <= 1
    
    def test_optimize_risk_parity(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        weights = optimizer.optimize_risk_parity()
        
        assert len(weights) == 4
        assert sum(weights.values()) == pytest.approx(1.0)
        
        for ticker, weight in weights.items():
            assert 0.01 <= weight <= 1  # Risk parity has min weight
    
    def test_efficient_frontier(self, sample_returns_data):
        optimizer = PortfolioOptimizer(sample_returns_data)
        
        ef_portfolios = optimizer.efficient_frontier(n_portfolios=10)
        
        assert len(ef_portfolios) > 0
        assert "return" in ef_portfolios.columns
        assert "volatility" in ef_portfolios.columns
        assert "sharpe_ratio" in ef_portfolios.columns
        
        # Volatility should generally increase with return
        returns = ef_portfolios["return"].values
        vols = ef_portfolios["volatility"].values
        assert np.corrcoef(returns[~np.isnan(returns)], vols[~np.isnan(vols)])[0, 1] > 0


class TestPortfolioBuilder:
    @patch('src.portfolio.builder.ETFDataFetcher')
    def test_portfolio_builder_init(self, mock_fetcher):
        builder = PortfolioBuilder(initial_cash=50000)
        
        assert builder.initial_cash == 50000
        assert builder.data_fetcher is not None
    
    @patch('src.portfolio.builder.ETFDataFetcher')
    def test_create_portfolio(self, mock_fetcher_class, sample_price_data):
        # Mock the data fetcher
        mock_fetcher = Mock()
        mock_fetcher.fetch_multiple_etfs.return_value = sample_price_data
        mock_fetcher_class.return_value = mock_fetcher
        
        builder = PortfolioBuilder(initial_cash=100000)
        
        weights = {"SPY": 0.6, "AGG": 0.4}
        portfolio = builder.create_portfolio(
            name="Test Portfolio",
            etf_tickers=["SPY", "AGG"],
            weights=weights,
            start_date="2022-01-01"
        )
        
        assert portfolio.name == "Test Portfolio"
        assert len(portfolio.positions) == 2
        assert "SPY" in portfolio.positions
        assert "AGG" in portfolio.positions
    
    @patch('src.portfolio.builder.ETFDataFetcher')
    def test_create_equal_weight_portfolio(self, mock_fetcher_class, sample_price_data):
        mock_fetcher = Mock()
        mock_fetcher.fetch_multiple_etfs.return_value = sample_price_data
        mock_fetcher_class.return_value = mock_fetcher
        
        builder = PortfolioBuilder()
        
        portfolio = builder.create_equal_weight_portfolio(
            name="Equal Weight",
            etf_tickers=["SPY", "AGG", "GLD", "VNQ"],
            start_date="2022-01-01"
        )
        
        assert len(portfolio.positions) == 4
        
        # Check weights are approximately equal
        weights = portfolio.get_weights()
        for ticker in ["SPY", "AGG", "GLD", "VNQ"]:
            assert weights.get(ticker, 0) == pytest.approx(0.25, rel=0.1)


class TestPortfolioStrategies:
    def test_equal_weight_strategy(self, sample_returns_data):
        strategy = EqualWeightStrategy()
        weights = strategy.calculate_weights(sample_returns_data)
        
        assert len(weights) == 4
        assert all(w == 0.25 for w in weights.values())
        assert strategy.validate_weights(weights)
    
    def test_market_cap_weight_strategy(self, sample_returns_data):
        strategy = MarketCapWeightStrategy()
        
        market_caps = {
            "SPY": 400e9,
            "AGG": 100e9,
            "GLD": 50e9,
            "VNQ": 50e9
        }
        
        weights = strategy.calculate_weights(sample_returns_data, market_caps=market_caps)
        
        assert weights["SPY"] == pytest.approx(400/600)
        assert weights["AGG"] == pytest.approx(100/600)
        assert weights["GLD"] == pytest.approx(50/600)
        assert weights["VNQ"] == pytest.approx(50/600)
        assert strategy.validate_weights(weights)
    
    def test_minimum_variance_strategy(self, sample_returns_data):
        strategy = MinimumVarianceStrategy()
        weights = strategy.calculate_weights(sample_returns_data)
        
        assert len(weights) == 4
        assert strategy.validate_weights(weights)
        assert all(0 <= w <= 1 for w in weights.values())
    
    def test_max_sharpe_strategy(self, sample_returns_data):
        strategy = MaxSharpeStrategy()
        weights = strategy.calculate_weights(sample_returns_data, risk_free_rate=0.02)
        
        assert len(weights) == 4
        assert strategy.validate_weights(weights)
        assert all(0 <= w <= 1 for w in weights.values())
    
    def test_risk_parity_strategy(self, sample_returns_data):
        strategy = RiskParityStrategy()
        weights = strategy.calculate_weights(sample_returns_data)
        
        assert len(weights) == 4
        assert strategy.validate_weights(weights)
        assert all(0.01 <= w <= 1 for w in weights.values())
    
    def test_momentum_strategy(self, sample_returns_data):
        strategy = MomentumStrategy()
        
        # Test with sufficient data
        weights = strategy.calculate_weights(
            sample_returns_data,
            lookback_period=30,
            top_n=2
        )
        
        assert len(weights) == 4
        assert sum(w > 0 for w in weights.values()) == 2  # Only top 2 should have weight
        assert strategy.validate_weights(weights)
    
    def test_volatility_weight_strategy(self, sample_returns_data):
        strategy = VolatilityWeightStrategy()
        weights = strategy.calculate_weights(sample_returns_data, lookback_period=30)
        
        assert len(weights) == 4
        assert strategy.validate_weights(weights)
        
        # Lower volatility assets should have higher weights
        # This is hard to test without knowing the exact volatilities