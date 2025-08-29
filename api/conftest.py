"""
Pytest configuration and fixtures for async implementation tests
"""

import pytest
import asyncio
import httpx
import os
import logging
from typing import AsyncGenerator, Generator

# Configure logging for tests
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Test configuration
TEST_BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:8000")
TEST_TIMEOUT = int(os.getenv("TEST_TIMEOUT", "30"))

# Disable warnings for cleaner test output
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def async_client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """Async HTTP client fixture for testing."""
    async with httpx.AsyncClient(
        base_url=TEST_BASE_URL,
        timeout=httpx.Timeout(TEST_TIMEOUT),
        headers={"Content-Type": "application/json"}
    ) as client:
        yield client


@pytest.fixture
def sync_client() -> Generator:
    """Sync HTTP client fixture for comparison tests."""
    import requests
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    yield session
    session.close()


@pytest.fixture
def test_tickers() -> list:
    """Test ticker symbols."""
    return ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]


@pytest.fixture
def test_payload(test_tickers) -> dict:
    """Standard test payload."""
    return {
        "tickers": test_tickers[:3],
        "start_date": "2023-01-01",
        "end_date": "2023-12-31"
    }


@pytest.fixture
def large_payload(test_tickers) -> dict:
    """Large payload for stress testing."""
    return {
        "tickers": test_tickers * 4,  # 20 tickers
        "start_date": "2020-01-01",
        "end_date": "2023-12-31"
    }


@pytest.fixture
def vercel_config() -> dict:
    """Vercel-specific configuration."""
    return {
        "timeout": 10,  # Vercel timeout limit
        "memory_limit": 512,  # MB
        "max_response_size": 50 * 1024 * 1024,  # 50MB
        "cold_start_threshold": 1.0  # seconds
    }


@pytest.fixture(autouse=True)
def cleanup_after_test():
    """Cleanup after each test."""
    yield
    # Force garbage collection
    import gc
    gc.collect()


@pytest.fixture
def mock_external_api():
    """Mock external API responses for testing."""
    from unittest.mock import Mock, patch
    
    # Mock yfinance responses
    mock_ticker = Mock()
    mock_ticker.history.return_value = {
        "Open": [100, 101, 102],
        "High": [105, 106, 107],
        "Low": [95, 96, 97],
        "Close": [104, 105, 106],
        "Volume": [1000000, 1100000, 1200000]
    }
    
    with patch('yfinance.Ticker', return_value=mock_ticker):
        yield mock_ticker


@pytest.fixture
def performance_monitor():
    """Performance monitoring fixture."""
    import time
    import psutil
    
    class PerformanceMonitor:
        def __init__(self):
            self.process = psutil.Process()
            self.start_time = None
            self.start_memory = None
            
        def start(self):
            self.start_time = time.time()
            self.start_memory = self.process.memory_info().rss / 1024 / 1024
            
        def stop(self):
            if self.start_time is None:
                return None
            
            duration = time.time() - self.start_time
            end_memory = self.process.memory_info().rss / 1024 / 1024
            memory_used = end_memory - self.start_memory
            
            return {
                "duration": duration,
                "memory_used": memory_used,
                "start_memory": self.start_memory,
                "end_memory": end_memory
            }
    
    return PerformanceMonitor()


# Pytest markers
pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.filterwarnings("ignore::DeprecationWarning")
]


# Skip tests if server is not running
def pytest_configure(config):
    """Configure pytest."""
    import requests
    
    try:
        response = requests.get(f"{TEST_BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            raise Exception("Server not healthy")
    except Exception:
        pytest.skip(
            f"Server not available at {TEST_BASE_URL}. "
            "Start the server before running tests.",
            allow_module_level=True
        )


# Custom assertions
def assert_response_time(duration: float, max_duration: float = 5.0):
    """Assert response time is within acceptable limits."""
    assert duration < max_duration, f"Response time {duration:.2f}s exceeds limit {max_duration}s"


def assert_memory_usage(memory_mb: float, max_memory_mb: float = 400.0):
    """Assert memory usage is within Vercel limits."""
    assert memory_mb < max_memory_mb, f"Memory usage {memory_mb:.1f}MB exceeds limit {max_memory_mb}MB"


def assert_vercel_compliance(duration: float, memory_mb: float):
    """Assert Vercel compliance for timeout and memory."""
    assert duration < 10.0, f"Response time {duration:.2f}s exceeds Vercel 10s limit"
    assert memory_mb < 512.0, f"Memory usage {memory_mb:.1f}MB exceeds Vercel 512MB limit"


# Test data factories
class TestDataFactory:
    """Factory for generating test data."""
    
    @staticmethod
    def create_ticker_payload(tickers: list, start_date: str = "2023-01-01", end_date: str = "2023-12-31"):
        """Create a ticker data payload."""
        return {
            "tickers": tickers,
            "start_date": start_date,
            "end_date": end_date
        }
    
    @staticmethod
    def create_streaming_payload(tickers: list):
        """Create a streaming payload."""
        return {
            "tickers": tickers,
            "start_date": "2023-01-01",
            "end_date": "2023-12-31",
            "stream": True
        }
    
    @staticmethod
    def create_concurrent_payloads(ticker_count: int, request_count: int):
        """Create multiple payloads for concurrent testing."""
        test_tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]
        payloads = []
        
        for i in range(request_count):
            ticker_subset = test_tickers[i % len(test_tickers):(i % len(test_tickers)) + ticker_count]
            if len(ticker_subset) < ticker_count:
                ticker_subset.extend(test_tickers[:ticker_count - len(ticker_subset)])
            
            payloads.append({
                "tickers": ticker_subset,
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            })
        
        return payloads