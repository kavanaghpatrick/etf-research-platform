import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta


@pytest.fixture
def sample_returns_data():
    """Generate sample returns data for testing."""
    np.random.seed(42)
    dates = pd.date_range(start="2022-01-01", end="2022-12-31", freq="D")
    tickers = ["SPY", "AGG", "GLD", "VNQ"]
    
    # Generate random returns
    returns_dict = {}
    for ticker in tickers:
        returns_dict[ticker] = np.random.normal(0.0005, 0.02, len(dates))
    
    returns_df = pd.DataFrame(returns_dict, index=dates)
    return returns_df


@pytest.fixture
def sample_price_data():
    """Generate sample price data for testing."""
    np.random.seed(42)
    dates = pd.date_range(start="2022-01-01", end="2022-12-31", freq="D")
    tickers = ["SPY", "AGG", "GLD", "VNQ"]
    
    price_dict = {}
    for ticker in tickers:
        # Start with base price
        base_price = {"SPY": 400, "AGG": 100, "GLD": 180, "VNQ": 90}[ticker]
        returns = np.random.normal(0.0005, 0.02, len(dates))
        prices = base_price * (1 + returns).cumprod()
        
        # Create DataFrame with OHLCV data
        df = pd.DataFrame(index=dates)
        df["Open"] = prices * (1 + np.random.uniform(-0.005, 0.005, len(dates)))
        df["High"] = prices * (1 + np.random.uniform(0, 0.01, len(dates)))
        df["Low"] = prices * (1 + np.random.uniform(-0.01, 0, len(dates)))
        df["Close"] = prices
        df["Adj Close"] = prices
        df["Volume"] = np.random.randint(1000000, 10000000, len(dates))
        
        price_dict[ticker] = df
    
    return price_dict


@pytest.fixture
def sample_weights():
    """Sample portfolio weights."""
    return {
        "SPY": 0.4,
        "AGG": 0.3,
        "GLD": 0.2,
        "VNQ": 0.1
    }


@pytest.fixture
def mock_etf_info():
    """Mock ETF information data."""
    return {
        "SPY": {
            "ticker": "SPY",
            "name": "SPDR S&P 500 ETF Trust",
            "expense_ratio": 0.0009,
            "total_assets": 400000000000,
            "category": "Large Blend",
            "fund_family": "SPDR State Street Global Advisors",
            "inception_date": datetime(1993, 1, 22),
            "holdings_count": 500
        },
        "AGG": {
            "ticker": "AGG",
            "name": "iShares Core U.S. Aggregate Bond ETF",
            "expense_ratio": 0.0003,
            "total_assets": 90000000000,
            "category": "Intermediate Core Bond",
            "fund_family": "iShares",
            "inception_date": datetime(2003, 9, 22),
            "holdings_count": 10000
        }
    }