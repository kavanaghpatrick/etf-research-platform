import pytest
import pandas as pd
import numpy as np
from datetime import datetime

from src.models import ETF, Portfolio, Position, Transaction, TransactionType


class TestETF:
    def test_etf_creation(self):
        etf = ETF(
            ticker="spy",
            name="SPDR S&P 500",
            expense_ratio=0.0009,
            inception_date=datetime(1993, 1, 22),
            category="Large Blend"
        )
        
        assert etf.ticker == "SPY"  # Should be uppercase
        assert etf.name == "SPDR S&P 500"
        assert etf.expense_ratio == 0.0009
        assert etf.category == "Large Blend"
        assert not etf.has_price_data
    
    def test_etf_with_price_data(self, sample_price_data):
        etf = ETF(
            ticker="SPY",
            name="SPDR S&P 500",
            expense_ratio=0.0009,
            inception_date=datetime(1993, 1, 22),
            category="Large Blend",
            price_data=sample_price_data["SPY"]
        )
        
        assert etf.has_price_data
        assert len(etf.price_data) == len(sample_price_data["SPY"])
    
    def test_get_returns(self, sample_price_data):
        etf = ETF(
            ticker="SPY",
            name="SPDR S&P 500",
            expense_ratio=0.0009,
            inception_date=datetime(1993, 1, 22),
            category="Large Blend",
            price_data=sample_price_data["SPY"]
        )
        
        # Test daily returns
        daily_returns = etf.get_returns("daily")
        assert len(daily_returns) == len(sample_price_data["SPY"])
        assert daily_returns.iloc[0] != daily_returns.iloc[0]  # First value should be NaN
        
        # Test weekly returns
        weekly_returns = etf.get_returns("weekly")
        assert len(weekly_returns) < len(daily_returns)
        
        # Test monthly returns
        monthly_returns = etf.get_returns("monthly")
        assert len(monthly_returns) <= 12  # Should have at most 12 months
    
    def test_get_volatility(self, sample_price_data):
        etf = ETF(
            ticker="SPY",
            name="SPDR S&P 500",
            expense_ratio=0.0009,
            inception_date=datetime(1993, 1, 22),
            category="Large Blend",
            price_data=sample_price_data["SPY"]
        )
        
        volatility = etf.get_volatility()
        assert isinstance(volatility, float)
        assert 0 < volatility < 1  # Reasonable volatility range
    
    def test_get_sharpe_ratio(self, sample_price_data):
        etf = ETF(
            ticker="SPY",
            name="SPDR S&P 500",
            expense_ratio=0.0009,
            inception_date=datetime(1993, 1, 22),
            category="Large Blend",
            price_data=sample_price_data["SPY"]
        )
        
        sharpe = etf.get_sharpe_ratio(risk_free_rate=0.02)
        assert isinstance(sharpe, float)


class TestPosition:
    def test_position_creation(self):
        position = Position(
            ticker="SPY",
            shares=100,
            average_cost=400.0,
            current_price=410.0
        )
        
        assert position.ticker == "SPY"
        assert position.shares == 100
        assert position.average_cost == 400.0
        assert position.cost_basis == 40000.0
        assert position.market_value == 41000.0
        assert position.unrealized_pnl == 1000.0
        assert position.unrealized_pnl_pct == 0.025


class TestPortfolio:
    def test_portfolio_creation(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        assert portfolio.name == "Test Portfolio"
        assert portfolio.cash == 100000
        assert len(portfolio.positions) == 0
        assert portfolio.total_value == 100000
    
    def test_add_position(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        portfolio.add_position("SPY", 100, 400.0)
        
        assert "SPY" in portfolio.positions
        assert portfolio.positions["SPY"].shares == 100
        assert portfolio.cash == 60000  # 100000 - (100 * 400)
        assert portfolio.total_cost_basis == 40000
    
    def test_add_to_existing_position(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        portfolio.add_position("SPY", 100, 400.0)
        portfolio.add_position("SPY", 50, 420.0)
        
        position = portfolio.positions["SPY"]
        assert position.shares == 150
        assert position.average_cost == (100 * 400 + 50 * 420) / 150
        assert portfolio.cash == 100000 - 40000 - 21000
    
    def test_remove_position(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        portfolio.add_position("SPY", 100, 400.0)
        realized_pnl = portfolio.remove_position("SPY", 50, 420.0)
        
        assert portfolio.positions["SPY"].shares == 50
        assert realized_pnl == 50 * (420 - 400)
        assert portfolio.cash == 100000 - 40000 + 21000
    
    def test_remove_full_position(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        portfolio.add_position("SPY", 100, 400.0)
        portfolio.remove_position("SPY", 100, 420.0)
        
        assert "SPY" not in portfolio.positions
        assert portfolio.cash == 100000 + 2000  # Initial + profit
    
    def test_get_weights(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        portfolio.add_position("SPY", 100, 400.0)
        portfolio.add_position("AGG", 200, 100.0)
        
        weights = portfolio.get_weights()
        
        assert weights["SPY"] == pytest.approx(40000 / 140000)
        assert weights["AGG"] == pytest.approx(20000 / 140000)
        assert weights["CASH"] == pytest.approx(80000 / 140000)
        assert sum(weights.values()) == pytest.approx(1.0)
    
    def test_rebalance(self):
        portfolio = Portfolio(name="Test Portfolio", cash=100000)
        
        # Initial positions
        portfolio.add_position("SPY", 100, 400.0)
        portfolio.add_position("AGG", 100, 100.0)
        
        # Target weights
        target_weights = {"SPY": 0.6, "AGG": 0.4}
        current_prices = {"SPY": 410.0, "AGG": 105.0}
        
        trades = portfolio.rebalance(target_weights, current_prices)
        
        # Check portfolio is rebalanced
        portfolio.update_prices(current_prices)
        weights = portfolio.get_weights()
        
        assert weights["SPY"] == pytest.approx(0.6, rel=0.01)
        assert weights["AGG"] == pytest.approx(0.4, rel=0.01)
        assert len(trades) > 0


class TestTransaction:
    def test_transaction_creation(self):
        transaction = Transaction(
            timestamp=datetime.now(),
            transaction_type=TransactionType.BUY,
            ticker="SPY",
            shares=100,
            price=400.0,
            commission=5.0
        )
        
        assert transaction.gross_amount == 40000.0
        assert transaction.net_amount == -40005.0  # Negative for buy
    
    def test_sell_transaction(self):
        transaction = Transaction(
            timestamp=datetime.now(),
            transaction_type=TransactionType.SELL,
            ticker="SPY",
            shares=100,
            price=420.0,
            commission=5.0
        )
        
        assert transaction.gross_amount == 42000.0
        assert transaction.net_amount == 41995.0  # Positive for sell