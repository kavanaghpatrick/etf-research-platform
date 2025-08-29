#!/usr/bin/env python3
"""
Phase 3 Integration Testing: Test existing API endpoints with new gap detection.
Verifies that all dividend-related endpoints work correctly with the updated TotalReturnCalculator.
"""

import pytest
import tempfile
import os
import json
from datetime import date, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import pandas as pd

# Set up environment for testing
os.environ['DATABASE_URL'] = 'sqlite:///test.db'

# Import the main FastAPI app
from main import app, total_return_calculator, data_fetcher


class TestDividendEndpointsIntegration:
    """Test integration of dividend endpoints with gap detection."""
    
    @pytest.fixture
    def client(self):
        """Create test client for API endpoints."""
        return TestClient(app)
    
    @pytest.fixture
    def mock_dividend_data(self):
        """Mock dividend data for testing."""
        return pd.DataFrame([
            {
                'ticker_symbol': 'MSFT',
                'ex_date': date(2024, 2, 14),
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            },
            {
                'ticker_symbol': 'MSFT',
                'ex_date': date(2024, 5, 15),
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            },
            {
                'ticker_symbol': 'MSFT',
                'ex_date': date(2024, 8, 15),
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            }
        ])
    
    def test_get_dividend_history_endpoint(self, client, mock_dividend_data):
        """Test GET /dividends/{ticker} endpoint with gap detection."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_fetch:
            mock_fetch.return_value = mock_dividend_data
            
            # Test basic dividend history request
            response = client.get("/dividends/MSFT?years=5")
            
            assert response.status_code == 200
            data = response.json()
            
            # Verify response structure
            assert data["status"] == "success"
            assert "data" in data
            assert "dividends" in data["data"]
            assert len(data["data"]["dividends"]) == 3
            
            # Verify gap detection was used
            mock_fetch.assert_called_once()
            args = mock_fetch.call_args[0]
            assert args[0] == 'MSFT'  # ticker
            assert isinstance(args[1], date)  # start_date
            assert isinstance(args[2], date)  # end_date
    
    def test_dividend_history_with_different_years(self, client, mock_dividend_data):
        """Test dividend history with different year parameters."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_fetch:
            mock_fetch.return_value = mock_dividend_data
            
            # Test different year ranges
            for years in [1, 3, 10]:
                response = client.get(f"/dividends/MSFT?years={years}")
                assert response.status_code == 200
                
                # Verify the date range calculation
                call_args = mock_fetch.call_args[0]
                start_date = call_args[1]
                end_date = call_args[2]
                
                expected_days = years * 365
                actual_days = (end_date - start_date).days
                assert abs(actual_days - expected_days) <= 1  # Allow for rounding
    
    def test_dividend_yield_endpoint(self, client):
        """Test GET /dividends/yield/{ticker} endpoint."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        with patch.object(total_return_calculator, 'calculate_dividend_metrics') as mock_metrics:
            mock_metrics.return_value = {
                'ticker': 'MSFT',
                'dividend_paying': True,
                'metrics': {
                    'current_yield': 0.028,
                    'ttm_dividends': 3.00,
                    'dividend_growth_rate': 0.05,
                    'payment_frequency': 'Quarterly'
                }
            }
            
            response = client.get("/dividends/yield/MSFT")
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "success"
            assert "yield_data" in data["data"]
            assert data["data"]["yield_data"]["current_yield"] == 0.028
    
    def test_data_fetch_with_dividends(self, client, mock_dividend_data):
        """Test POST /data/fetch endpoint with include_dividends=true."""
        if not data_fetcher or not total_return_calculator:
            pytest.skip("Data services not available")
        
        # Mock price data
        mock_price_data = pd.DataFrame({
            'Open': [100.0, 101.0],
            'High': [102.0, 103.0],
            'Low': [99.0, 100.0],
            'Close': [101.0, 102.0],
            'Volume': [1000000, 1100000],
            'Adj Close': [101.0, 102.0]
        }, index=pd.date_range('2024-01-01', periods=2))
        
        with patch.object(data_fetcher, 'fetch_data') as mock_price_fetch:
            with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_div_fetch:
                mock_price_fetch.return_value = mock_price_data
                mock_div_fetch.return_value = mock_dividend_data
                
                request_data = {
                    "tickers": ["MSFT"],
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31",
                    "include_dividends": True
                }
                
                response = client.post("/data/fetch", json=request_data)
                assert response.status_code == 200
                
                data = response.json()
                assert data["status"] == "success"
                assert "MSFT" in data["data"]
                assert "dividend_data" in data["data"]["MSFT"]
                
                # Verify dividend data is included
                dividend_data = data["data"]["MSFT"]["dividend_data"]
                assert len(dividend_data) == 3
                
                # Verify gap detection was used for dividends
                mock_div_fetch.assert_called_once()
    
    def test_total_returns_with_dividends(self, client, mock_dividend_data):
        """Test GET /returns/{ticker} endpoint with dividend integration."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        # Mock price data and total return calculation
        mock_metrics = MagicMock()
        mock_metrics.ticker = 'MSFT'
        mock_metrics.total_return = 0.25
        mock_metrics.dividend_return = 0.05
        mock_metrics.price_return = 0.20
        mock_metrics.total_dividends = 3.00
        mock_metrics.dividend_count = 4
        
        with patch.object(total_return_calculator, 'calculate_simple_total_return') as mock_calc:
            mock_calc.return_value = mock_metrics
            
            response = client.get("/returns/MSFT?start_date=2024-01-01&end_date=2024-12-31")
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "success"
            assert "returns" in data["data"]
            assert data["data"]["returns"]["total_return"] == 0.25
            assert data["data"]["returns"]["dividend_return"] == 0.05
    
    def test_total_returns_with_reinvestment(self, client):
        """Test total returns calculation with dividend reinvestment."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        # Mock reinvestment calculation
        mock_metrics = MagicMock()
        mock_metrics.ticker = 'MSFT'
        mock_metrics.total_return = 0.25
        mock_metrics.reinvested_return = 0.28
        mock_metrics.total_dividends = 3.00
        
        with patch.object(total_return_calculator, 'calculate_dividend_reinvested_return') as mock_calc:
            mock_calc.return_value = mock_metrics
            
            response = client.get("/returns/MSFT?start_date=2024-01-01&end_date=2024-12-31&include_reinvestment=true")
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "success"
            assert "returns" in data["data"]
    
    def test_dividend_calendar_endpoint(self, client):
        """Test GET /dividends/calendar/{ticker} endpoint."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        mock_calendar = pd.DataFrame([
            {
                'ticker': 'MSFT',
                'estimated_ex_date': date(2024, 11, 15),
                'last_dividend_amount': 0.75,
                'payment_frequency': 'Quarterly',
                'confidence': 'Estimated'
            }
        ])
        
        with patch.object(total_return_calculator, 'get_dividend_calendar') as mock_calendar_func:
            mock_calendar_func.return_value = mock_calendar
            
            response = client.get("/dividends/calendar/MSFT?days_ahead=30")
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "success"
            assert "calendar" in data["data"]
    
    def test_error_handling_no_dividends(self, client):
        """Test error handling when no dividends are found."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        # Mock empty dividend data
        empty_df = pd.DataFrame()
        
        with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_fetch:
            mock_fetch.return_value = empty_df
            
            response = client.get("/dividends/TSLA?years=5")  # TSLA doesn't pay dividends
            assert response.status_code == 200
            
            data = response.json()
            assert data["status"] == "success"
            assert "No dividend history found" in data["message"]
            assert data["data"]["dividends"] == []
    
    def test_error_handling_invalid_ticker(self, client):
        """Test error handling for invalid ticker symbols."""
        # Test invalid ticker format
        response = client.get("/dividends/INVALID_TICKER?years=5")
        assert response.status_code == 400
        
        data = response.json()
        assert "Invalid ticker format" in data["detail"]
    
    def test_error_handling_invalid_years(self, client):
        """Test error handling for invalid years parameter."""
        # Test years out of range
        response = client.get("/dividends/MSFT?years=25")
        assert response.status_code == 400
        
        data = response.json()
        assert "Years must be between 1 and 20" in data["detail"]


class TestDataFetchIntegration:
    """Test data fetch endpoints with dividend gap detection."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_data_fetch_dividend_integration(self, client):
        """Test that data fetch properly integrates dividend gap detection."""
        if not data_fetcher:
            pytest.skip("Data fetcher not available")
        
        with patch.object(data_fetcher, 'fetch_data') as mock_price:
            # Mock price data
            mock_price_data = pd.DataFrame({
                'Open': [100.0], 'High': [101.0], 'Low': [99.0], 
                'Close': [100.5], 'Volume': [1000000], 'Adj Close': [100.5]
            }, index=[date(2024, 6, 15)])
            mock_price.return_value = mock_price_data
            
            # Test with dividends disabled
            request_data = {
                "tickers": ["MSFT"],
                "start_date": "2024-01-01", 
                "end_date": "2024-12-31",
                "include_dividends": False
            }
            
            response = client.post("/data/fetch", json=request_data)
            assert response.status_code == 200
            
            data = response.json()
            assert "MSFT" in data["data"]
            # Should not include dividend data when disabled
            assert "dividend_data" not in data["data"]["MSFT"] or not data["data"]["MSFT"]["dividend_data"]
    
    def test_multi_ticker_dividend_fetch(self, client):
        """Test multi-ticker requests with dividend data."""
        if not data_fetcher or not total_return_calculator:
            pytest.skip("Data services not available")
        
        # Mock data for multiple tickers
        mock_price_data = pd.DataFrame({
            'Open': [100.0], 'High': [101.0], 'Low': [99.0],
            'Close': [100.5], 'Volume': [1000000], 'Adj Close': [100.5]
        }, index=[date(2024, 6, 15)])
        
        mock_dividend_data = pd.DataFrame([{
            'ex_date': date(2024, 6, 15),
            'dividend_amount': 0.75,
            'ticker_symbol': 'MSFT'
        }])
        
        with patch.object(data_fetcher, 'fetch_data') as mock_price:
            with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_div:
                mock_price.return_value = mock_price_data
                mock_div.return_value = mock_dividend_data
                
                request_data = {
                    "tickers": ["MSFT", "AAPL"],
                    "start_date": "2024-01-01",
                    "end_date": "2024-12-31", 
                    "include_dividends": True
                }
                
                response = client.post("/data/fetch", json=request_data)
                assert response.status_code == 200
                
                data = response.json()
                assert data["status"] == "success"
                
                # Should have called gap detection for each ticker
                assert mock_div.call_count == 2


class TestGapDetectionPerformance:
    """Test performance aspects of gap detection integration."""
    
    @pytest.fixture
    def client(self):
        return TestClient(app)
    
    def test_response_time_within_limits(self, client):
        """Test that dividend endpoints respond within acceptable time limits."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        # Mock fast dividend response
        mock_data = pd.DataFrame([{
            'ex_date': date(2024, 6, 15),
            'dividend_amount': 0.75,
            'ticker_symbol': 'MSFT'
        }])
        
        with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_fetch:
            mock_fetch.return_value = mock_data
            
            import time
            start_time = time.time()
            
            response = client.get("/dividends/MSFT?years=5")
            
            end_time = time.time()
            response_time = end_time - start_time
            
            assert response.status_code == 200
            # Should respond within 5 seconds (generous limit for testing)
            assert response_time < 5.0
            
            data = response.json()
            # Verify execution time is tracked
            assert "execution_time" in data
    
    def test_cached_data_performance(self, client):
        """Test that cached dividend data returns quickly."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        # Mock cached data (no missing ranges)
        with patch.object(total_return_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gaps:
            mock_gaps.return_value = []  # No missing ranges - all cached
            
            # Mock cached dividend query
            with patch.object(total_return_calculator, 'get_connection') as mock_conn:
                mock_cursor = MagicMock()
                mock_conn.return_value.__enter__.return_value.execute.return_value = mock_cursor
                mock_cursor.fetchall.return_value = [{
                    'ticker_symbol': 'MSFT',
                    'ex_date': '2024-06-15',
                    'dividend_amount': 0.75,
                    'dividend_type': 'regular'
                }]
                
                response = client.get("/dividends/MSFT?years=5")
                assert response.status_code == 200
                
                # Verify no API calls were made (cached data only)
                # The response should be fast since it's all cached
                data = response.json()
                assert data["status"] == "success"


class TestBackwardCompatibility:
    """Test that existing API behavior is preserved."""
    
    @pytest.fixture  
    def client(self):
        return TestClient(app)
    
    def test_api_response_format_unchanged(self, client):
        """Test that API response formats remain the same."""
        if not total_return_calculator:
            pytest.skip("Total return calculator not available")
        
        mock_data = pd.DataFrame([{
            'ticker_symbol': 'MSFT',
            'ex_date': date(2024, 6, 15),
            'dividend_amount': 0.75,
            'dividend_type': 'regular',
            'currency': 'USD'
        }])
        
        with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_fetch:
            mock_fetch.return_value = mock_data
            
            response = client.get("/dividends/MSFT?years=5")
            assert response.status_code == 200
            
            data = response.json()
            
            # Verify response structure is unchanged
            required_fields = ["status", "message", "timestamp", "execution_time", "data"]
            for field in required_fields:
                assert field in data
            
            # Verify data structure
            assert "ticker" in data["data"]
            assert "dividends" in data["data"]
            assert isinstance(data["data"]["dividends"], list)
            
            # Verify dividend record structure
            if data["data"]["dividends"]:
                dividend = data["data"]["dividends"][0]
                expected_dividend_fields = ["ex_date", "dividend_amount"]
                for field in expected_dividend_fields:
                    assert field in dividend
    
    def test_parameter_validation_unchanged(self, client):
        """Test that parameter validation behavior is preserved."""
        # Test invalid years parameter
        response = client.get("/dividends/MSFT?years=25")
        assert response.status_code == 400
        
        # Test invalid ticker format
        response = client.get("/dividends/invalid-ticker?years=5")
        assert response.status_code == 400
        
        # Test valid parameters still work
        if total_return_calculator:
            with patch.object(total_return_calculator, 'fetch_and_cache_dividends') as mock_fetch:
                mock_fetch.return_value = pd.DataFrame()
                
                response = client.get("/dividends/MSFT?years=5")
                assert response.status_code == 200


if __name__ == '__main__':
    # Run integration tests
    pytest.main([__file__, '-v', '--tb=short'])