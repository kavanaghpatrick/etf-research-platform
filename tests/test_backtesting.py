import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.backtesting import BacktestEngine, BacktestResults
from src.models import Portfolio, Transaction, TransactionType
from src.portfolio import EqualWeightStrategy


class TestBacktestEngine:
    def test_engine_init(self):
        engine = BacktestEngine(
            initial_cash=50000,
            commission=10.0,
            rebalance_frequency="quarterly",
            slippage=0.001
        )
        
        assert engine.initial_cash == 50000
        assert engine.commission == 10.0
        assert engine.rebalance_frequency == "quarterly"
        assert engine.slippage == 0.001
    
    def test_get_rebalance_dates(self, sample_price_data):
        engine = BacktestEngine()
        
        # Test monthly rebalancing
        dates = engine._get_rebalance_dates(sample_price_data, "monthly")
        assert len(dates) == 12  # One per month for a year
        
        # Test quarterly rebalancing
        dates = engine._get_rebalance_dates(sample_price_data, "quarterly")
        assert len(dates) == 4  # One per quarter
        
        # Test yearly rebalancing
        dates = engine._get_rebalance_dates(sample_price_data, "yearly")
        assert len(dates) == 1  # One for the year
    
    @patch('src.backtesting.engine.ETFDataFetcher')
    def test_fetch_price_data(self, mock_fetcher_class, sample_price_data):
        mock_fetcher = Mock()
        mock_fetcher.fetch_multiple_etfs.return_value = sample_price_data
        mock_fetcher_class.return_value = mock_fetcher
        
        engine = BacktestEngine()
        engine.data_fetcher = mock_fetcher
        
        price_data = engine._fetch_price_data(
            ["SPY", "AGG"],
            "2022-01-01",
            "2022-12-31"
        )
        
        assert len(price_data) == 2
        assert "SPY" in price_data
        assert "AGG" in price_data
        assert isinstance(price_data["SPY"], pd.Series)
    
    @patch('src.backtesting.engine.ETFDataFetcher')
    def test_run_backtest_with_strategy(self, mock_fetcher_class, sample_price_data):
        mock_fetcher = Mock()
        mock_fetcher.fetch_multiple_etfs.return_value = sample_price_data
        mock_fetcher_class.return_value = mock_fetcher
        
        engine = BacktestEngine(
            initial_cash=100000,
            commission=5.0,
            rebalance_frequency="monthly"
        )
        engine.data_fetcher = mock_fetcher
        
        strategy = EqualWeightStrategy()
        results = engine.run_backtest(
            strategy=strategy,
            etf_tickers=["SPY", "AGG"],
            start_date="2022-01-01",
            end_date="2022-12-31",
            benchmark_ticker="SPY"
        )
        
        assert isinstance(results, BacktestResults)
        assert len(results.portfolio_values) > 0
        assert results.initial_value == 100000
        assert isinstance(results.final_portfolio, Portfolio)
    
    @patch('src.backtesting.engine.ETFDataFetcher')
    def test_run_backtest_with_static_weights(self, mock_fetcher_class, sample_price_data):
        mock_fetcher = Mock()
        mock_fetcher.fetch_multiple_etfs.return_value = sample_price_data
        mock_fetcher_class.return_value = mock_fetcher
        
        engine = BacktestEngine()
        engine.data_fetcher = mock_fetcher
        
        static_weights = {"SPY": 0.7, "AGG": 0.3}
        results = engine.run_backtest(
            strategy=static_weights,
            etf_tickers=["SPY", "AGG"],
            start_date="2022-01-01",
            end_date="2022-12-31"
        )
        
        assert isinstance(results, BacktestResults)


class TestBacktestResults:
    def create_sample_results(self):
        # Create sample portfolio values
        dates = pd.date_range(start="2022-01-01", end="2022-12-31", freq="D")
        values = 100000 * (1 + np.random.normal(0.0003, 0.01, len(dates))).cumprod()
        
        portfolio_values = pd.DataFrame({
            "total_value": values,
            "cash": 10000,
            "positions_value": values - 10000
        }, index=dates)
        
        # Create sample transactions
        transactions = [
            Transaction(
                timestamp=dates[0],
                transaction_type=TransactionType.BUY,
                ticker="SPY",
                shares=100,
                price=400.0,
                commission=5.0
            )
        ]
        
        # Create final portfolio
        final_portfolio = Portfolio(name="Test", cash=10000)
        final_portfolio.add_position("SPY", 100, 400.0)
        
        return BacktestResults(
            portfolio_values=portfolio_values,
            transactions=transactions,
            final_portfolio=final_portfolio,
            initial_value=100000
        )
    
    def test_total_return(self):
        results = self.create_sample_results()
        
        total_return = results.total_return
        assert isinstance(total_return, float)
        assert -1 < total_return < 2  # Reasonable range
    
    def test_annualized_return(self):
        results = self.create_sample_results()
        
        annual_return = results.annualized_return
        assert isinstance(annual_return, float)
        assert -1 < annual_return < 2  # Reasonable range
    
    def test_volatility(self):
        results = self.create_sample_results()
        
        volatility = results.volatility
        assert isinstance(volatility, float)
        assert 0 < volatility < 1  # Reasonable range
    
    def test_sharpe_ratio(self):
        results = self.create_sample_results()
        
        sharpe = results.sharpe_ratio
        assert isinstance(sharpe, float)
        assert -5 < sharpe < 5  # Reasonable range
    
    def test_max_drawdown(self):
        results = self.create_sample_results()
        
        max_dd = results.max_drawdown
        assert isinstance(max_dd, float)
        assert max_dd <= 0  # Drawdown should be negative
    
    def test_calmar_ratio(self):
        results = self.create_sample_results()
        
        calmar = results.calmar_ratio
        assert isinstance(calmar, float)
    
    def test_calculate_metrics(self):
        results = self.create_sample_results()
        
        metrics = results.calculate_metrics()
        
        expected_keys = [
            "total_return", "annualized_return", "volatility",
            "sharpe_ratio", "max_drawdown", "calmar_ratio",
            "final_value", "total_trades"
        ]
        
        for key in expected_keys:
            assert key in metrics
            assert isinstance(metrics[key], (int, float))
    
    def test_generate_report(self):
        results = self.create_sample_results()
        
        report = results.generate_report()
        
        assert isinstance(report, str)
        assert "Backtest Results Summary" in report
        assert "Performance Metrics:" in report
        assert "Portfolio Statistics:" in report
        assert "Final Portfolio Allocation:" in report