import pytest
import pandas as pd
import numpy as np

from src.analytics import PerformanceMetrics, RiskAnalyzer, CorrelationAnalyzer


class TestPerformanceMetrics:
    def test_calculate_returns(self):
        prices = pd.Series([100, 105, 110, 108, 112])
        
        # Simple returns
        simple_returns = PerformanceMetrics.calculate_returns(prices, "simple")
        assert len(simple_returns) == len(prices)
        assert np.isnan(simple_returns.iloc[0])
        assert simple_returns.iloc[1] == pytest.approx(0.05)
        
        # Log returns
        log_returns = PerformanceMetrics.calculate_returns(prices, "log")
        assert len(log_returns) == len(prices)
        assert np.isnan(log_returns.iloc[0])
        assert log_returns.iloc[1] == pytest.approx(np.log(105/100))
    
    def test_annualized_return(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        annual_return = PerformanceMetrics.annualized_return(returns, 252)
        
        assert isinstance(annual_return, float)
        assert -1 < annual_return < 2  # Reasonable range
    
    def test_annualized_volatility(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        volatility = PerformanceMetrics.annualized_volatility(returns, 252)
        
        assert isinstance(volatility, float)
        assert 0 < volatility < 1  # Reasonable range
    
    def test_sharpe_ratio(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        sharpe = PerformanceMetrics.sharpe_ratio(returns, risk_free_rate=0.02)
        
        assert isinstance(sharpe, float)
        assert -5 < sharpe < 5  # Reasonable range
    
    def test_max_drawdown(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        max_dd = PerformanceMetrics.max_drawdown(returns)
        
        assert isinstance(max_dd, float)
        assert max_dd <= 0  # Drawdown should be negative
    
    def test_var_cvar(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        
        var_95 = PerformanceMetrics.var(returns, 0.95)
        cvar_95 = PerformanceMetrics.cvar(returns, 0.95)
        
        assert isinstance(var_95, float)
        assert isinstance(cvar_95, float)
        assert cvar_95 <= var_95  # CVaR should be worse than VaR
    
    def test_beta_alpha(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        market_returns = sample_returns_data["SPY"] * 1.1  # Slightly different
        
        beta = PerformanceMetrics.beta(returns, market_returns)
        alpha = PerformanceMetrics.alpha(returns, market_returns)
        
        assert isinstance(beta, float)
        assert isinstance(alpha, float)
        assert 0 < beta < 2  # Reasonable range
    
    def test_calculate_all_metrics(self, sample_returns_data):
        returns = sample_returns_data["SPY"]
        benchmark_returns = sample_returns_data["AGG"]
        
        metrics = PerformanceMetrics.calculate_all_metrics(
            returns, 
            benchmark_returns=benchmark_returns,
            risk_free_rate=0.02
        )
        
        # Check all expected metrics are present
        expected_keys = [
            "annualized_return", "annualized_volatility", "sharpe_ratio",
            "sortino_ratio", "max_drawdown", "calmar_ratio", "var_95", 
            "cvar_95", "beta", "alpha", "information_ratio", "treynor_ratio"
        ]
        
        for key in expected_keys:
            assert key in metrics
            assert isinstance(metrics[key], (int, float))


class TestRiskAnalyzer:
    def test_risk_analyzer_init(self, sample_returns_data):
        analyzer = RiskAnalyzer(sample_returns_data)
        
        assert analyzer.returns.shape == sample_returns_data.shape
        assert analyzer.cov_matrix.shape == (4, 4)  # 4 assets
        assert analyzer.corr_matrix.shape == (4, 4)
    
    def test_portfolio_risk(self, sample_returns_data, sample_weights):
        analyzer = RiskAnalyzer(sample_returns_data)
        
        portfolio_risk = analyzer.calculate_portfolio_risk(sample_weights)
        
        assert isinstance(portfolio_risk, float)
        assert 0 < portfolio_risk < 1  # Reasonable range
    
    def test_risk_contribution(self, sample_returns_data, sample_weights):
        analyzer = RiskAnalyzer(sample_returns_data)
        
        contributions = analyzer.risk_contribution(sample_weights)
        
        assert len(contributions) == 4
        assert sum(contributions.values()) == pytest.approx(1.0, rel=0.01)
        
        for ticker, contrib in contributions.items():
            assert 0 <= contrib <= 1
    
    def test_var_calculations(self, sample_returns_data, sample_weights):
        analyzer = RiskAnalyzer(sample_returns_data)
        
        # Historical VaR
        hist_var = analyzer.calculate_var_historical(sample_weights, 0.95)
        assert isinstance(hist_var, float)
        assert hist_var < 0  # VaR should be negative
        
        # Parametric VaR
        param_var = analyzer.calculate_var_parametric(sample_weights, 0.95)
        assert isinstance(param_var, float)
        assert param_var < 0
        
        # CVaR
        cvar = analyzer.calculate_cvar(sample_weights, 0.95)
        assert isinstance(cvar, float)
        assert cvar <= hist_var  # CVaR should be worse than VaR
    
    def test_monte_carlo_var(self, sample_returns_data, sample_weights):
        analyzer = RiskAnalyzer(sample_returns_data)
        
        mc_var, simulations = analyzer.monte_carlo_var(
            sample_weights, 
            n_simulations=1000
        )
        
        assert isinstance(mc_var, float)
        assert mc_var < 0
        assert len(simulations) == 1000
    
    def test_stress_test(self, sample_returns_data, sample_weights):
        analyzer = RiskAnalyzer(sample_returns_data)
        
        scenarios = {
            "Market Crash": {"SPY": -0.20, "AGG": 0.05, "GLD": 0.10, "VNQ": -0.15},
            "Inflation Spike": {"SPY": -0.05, "AGG": -0.10, "GLD": 0.15, "VNQ": -0.08}
        }
        
        results = analyzer.stress_test(sample_weights, scenarios)
        
        assert len(results) == 2
        assert "Market Crash" in results
        assert "Inflation Spike" in results
        
        for scenario, return_val in results.items():
            assert isinstance(return_val, float)


class TestCorrelationAnalyzer:
    def test_correlation_analyzer_init(self, sample_returns_data):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        assert analyzer.returns.shape == sample_returns_data.shape
        assert analyzer.correlation_matrix is None  # Not calculated yet
    
    def test_calculate_correlation_matrix(self, sample_returns_data):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        corr_matrix = analyzer.calculate_correlation_matrix()
        
        assert corr_matrix.shape == (4, 4)
        assert np.allclose(np.diag(corr_matrix), 1.0)  # Diagonal should be 1
        assert corr_matrix.equals(corr_matrix.T)  # Should be symmetric
    
    def test_rolling_correlation(self, sample_returns_data):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        rolling_corr = analyzer.calculate_rolling_correlation("SPY", "AGG", window=60)
        
        assert isinstance(rolling_corr, pd.Series)
        assert len(rolling_corr) == len(sample_returns_data)
        assert rolling_corr.iloc[:59].isna().all()  # First 59 should be NaN
        assert rolling_corr.iloc[60:].notna().all()  # Rest should have values
    
    def test_find_low_correlation_pairs(self, sample_returns_data):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        low_corr_pairs = analyzer.find_low_correlation_pairs(max_correlation=0.5)
        
        assert isinstance(low_corr_pairs, list)
        
        for ticker1, ticker2, corr in low_corr_pairs:
            assert ticker1 != ticker2
            assert abs(corr) <= 0.5
    
    def test_correlation_stability(self, sample_returns_data):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        stability = analyzer.calculate_correlation_stability("SPY", "AGG", window=60)
        
        assert "mean" in stability
        assert "std" in stability
        assert "min" in stability
        assert "max" in stability
        assert "range" in stability
        
        for metric in stability.values():
            assert isinstance(metric, float)
    
    def test_cluster_assets(self, sample_returns_data):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        linkage_matrix, labels = analyzer.cluster_assets()
        
        assert linkage_matrix.shape[0] == 3  # n-1 for 4 assets
        assert len(labels) == 4
        assert set(labels) == {"SPY", "AGG", "GLD", "VNQ"}
    
    def test_portfolio_correlation(self, sample_returns_data, sample_weights):
        analyzer = CorrelationAnalyzer(sample_returns_data)
        
        portfolio_corr = analyzer.calculate_portfolio_correlation(sample_weights, "SPY")
        
        assert isinstance(portfolio_corr, float)
        assert -1 <= portfolio_corr <= 1