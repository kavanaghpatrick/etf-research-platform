#!/usr/bin/env python3
"""
Test Phase 2 implementation: TotalReturnCalculator with intelligent gap detection.
Verifies that the TotalReturnCalculator now uses gap detection instead of cache-first logic.
"""

import pytest
import tempfile
import os
import pandas as pd
from datetime import date, timedelta
from unittest.mock import patch, MagicMock

from total_return_calculator import TotalReturnCalculator
from sqlite_cache_manager import DateRange


class TestTotalReturnGapDetection:
    """Test suite for TotalReturnCalculator gap detection integration."""
    
    @pytest.fixture
    def temp_calculator(self):
        """Create a temporary TotalReturnCalculator for testing."""
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        temp_file.close()
        
        calculator = TotalReturnCalculator(database_url=f"sqlite:///{temp_file.name}")
        
        yield calculator
        
        # Cleanup
        calculator.close()
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
    
    @pytest.fixture
    def mock_dividend_data(self):
        """Mock dividend data for testing."""
        return pd.DataFrame([
            {
                'ex_date': '2024-02-14',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            },
            {
                'ex_date': '2024-05-15',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            },
            {
                'ex_date': '2024-08-15',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD',
                'source': 'YFinance'
            }
        ])
    
    def test_fetch_dividends_uses_gap_detection(self, temp_calculator):
        """Test that fetch_and_cache_dividends uses gap detection instead of cache-first."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Mock the cache manager's gap detection method
        with patch.object(temp_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap_detection:
            with patch.object(temp_calculator.data_source, 'fetch_dividends') as mock_fetch:
                
                # Test scenario 1: No gaps (all data cached)
                mock_gap_detection.return_value = []  # No missing ranges
                
                # Should retrieve from cache, not fetch from source
                result = temp_calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                
                # Verify gap detection was called
                mock_gap_detection.assert_called_once_with(ticker, start_date, end_date)
                
                # Verify data source was NOT called (since no gaps)
                mock_fetch.assert_not_called()
    
    def test_fetch_dividends_handles_gaps(self, temp_calculator, mock_dividend_data):
        """Test that missing dividend ranges are properly fetched and cached."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Define missing ranges
        missing_ranges = [
            DateRange(date(2024, 1, 1), date(2024, 6, 30)),  # First half missing
            DateRange(date(2024, 10, 1), date(2024, 12, 31))  # Last quarter missing
        ]
        
        with patch.object(temp_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap_detection:
            with patch.object(temp_calculator.data_source, 'fetch_dividends') as mock_fetch:
                with patch.object(temp_calculator.cache_manager, 'cache_dividend_data') as mock_cache:
                    
                    # Setup mocks
                    mock_gap_detection.return_value = missing_ranges
                    mock_fetch.return_value = mock_dividend_data
                    mock_cache.return_value = True
                    
                    # Execute the method
                    result = temp_calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                    
                    # Verify gap detection was called
                    mock_gap_detection.assert_called_once_with(ticker, start_date, end_date)
                    
                    # Verify data source was called for each missing range
                    assert mock_fetch.call_count == 2
                    
                    # Verify caching was called for each missing range
                    assert mock_cache.call_count == 2
                    
                    # Check the specific ranges were fetched
                    fetch_calls = mock_fetch.call_args_list
                    assert fetch_calls[0][0] == (ticker, missing_ranges[0].start_date, missing_ranges[0].end_date)
                    assert fetch_calls[1][0] == (ticker, missing_ranges[1].start_date, missing_ranges[1].end_date)
    
    def test_fetch_dividends_error_handling(self, temp_calculator):
        """Test error handling when fetching missing dividend ranges."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        missing_ranges = [DateRange(start_date, end_date)]
        
        with patch.object(temp_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap_detection:
            with patch.object(temp_calculator.data_source, 'fetch_dividends') as mock_fetch:
                with patch.object(temp_calculator.cache_manager, 'cache_dividend_data') as mock_cache:
                    
                    # Setup mocks
                    mock_gap_detection.return_value = missing_ranges
                    mock_fetch.side_effect = Exception("API Error")
                    mock_cache.return_value = True
                    
                    # Should not raise exception, but handle gracefully
                    result = temp_calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                    
                    # Should return empty DataFrame on error
                    assert isinstance(result, pd.DataFrame)
                    
                    # Gap detection should still be called
                    mock_gap_detection.assert_called_once_with(ticker, start_date, end_date)
    
    def test_empty_dividend_caching(self, temp_calculator):
        """Test that empty dividend results are still cached to track ranges."""
        ticker = 'NODIV'  # Non-dividend paying stock
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        missing_ranges = [DateRange(start_date, end_date)]
        empty_df = pd.DataFrame()
        
        with patch.object(temp_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap_detection:
            with patch.object(temp_calculator.data_source, 'fetch_dividends') as mock_fetch:
                with patch.object(temp_calculator.cache_manager, 'cache_dividend_data') as mock_cache:
                    
                    # Setup mocks
                    mock_gap_detection.return_value = missing_ranges
                    mock_fetch.return_value = empty_df
                    mock_cache.return_value = True
                    
                    # Execute the method
                    result = temp_calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                    
                    # Should still cache empty result to track the range
                    mock_cache.assert_called_once_with(
                        ticker, empty_df, start_date, end_date, temp_calculator.data_source.name
                    )
                    
                    # Should return empty DataFrame
                    assert result.empty
    
    def test_partial_cache_coverage(self, temp_calculator, mock_dividend_data):
        """Test handling of partial cache coverage - some data cached, some missing."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Only missing Q4 data
        missing_ranges = [DateRange(date(2024, 10, 1), date(2024, 12, 31))]
        
        # Mock cached data (Q1-Q3)
        cached_data = mock_dividend_data.iloc[:2].copy()  # First 2 dividends
        
        with patch.object(temp_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap_detection:
            with patch.object(temp_calculator.data_source, 'fetch_dividends') as mock_fetch:
                with patch.object(temp_calculator.cache_manager, 'cache_dividend_data') as mock_cache:
                    
                    # Setup mocks
                    mock_gap_detection.return_value = missing_ranges
                    mock_fetch.return_value = mock_dividend_data.iloc[2:].copy()  # Last dividend
                    mock_cache.return_value = True
                    
                    # Mock the database query to return cached data
                    with patch.object(temp_calculator, 'get_connection') as mock_conn:
                        mock_cursor = MagicMock()
                        mock_conn.return_value.__enter__.return_value.execute.return_value = mock_cursor
                        
                        # Convert cached_data to list of Row-like dicts
                        cached_rows = []
                        for _, row in cached_data.iterrows():
                            cached_rows.append({
                                'ticker_symbol': ticker,
                                'ex_date': row['ex_date'],
                                'dividend_amount': row['dividend_amount'],
                                'dividend_type': row['dividend_type'],
                                'currency': row['currency']
                            })
                        
                        mock_cursor.fetchall.return_value = cached_rows
                        
                        # Execute the method
                        result = temp_calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                        
                        # Should fetch only missing Q4 data
                        mock_fetch.assert_called_once_with(ticker, date(2024, 10, 1), date(2024, 12, 31))
                        
                        # Should cache the new data
                        mock_cache.assert_called_once()
                        
                        # Should return combined results
                        assert not result.empty
                        assert len(result) == len(cached_rows)  # From final database query
    
    def test_integration_with_total_return_calculation(self, temp_calculator):
        """Test that gap detection works within total return calculations."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Mock price data
        mock_price_data = pd.DataFrame({
            'Adj Close': [100.0, 110.0],
            'Open': [99.0, 109.0],
            'High': [101.0, 111.0],
            'Low': [98.0, 108.0],
            'Close': [100.0, 110.0],
            'Volume': [1000000, 1100000]
        }, index=pd.date_range(start_date, end_date, periods=2))
        
        with patch.object(temp_calculator.cache_manager, 'get_cached_data') as mock_price_cache:
            with patch.object(temp_calculator, 'fetch_and_cache_dividends') as mock_div_fetch:
                
                # Setup mocks
                mock_price_cache.return_value = mock_price_data
                mock_div_fetch.return_value = pd.DataFrame([{
                    'ex_date': date(2024, 6, 15),
                    'dividend_amount': 2.0,
                    'ticker_symbol': ticker
                }])
                
                # Execute total return calculation
                metrics = temp_calculator.calculate_simple_total_return(ticker, start_date, end_date)
                
                # Verify dividend fetching was called with gap detection
                mock_div_fetch.assert_called_once_with(ticker, start_date, end_date)
                
                # Verify calculation includes dividends
                assert metrics.total_dividends == 2.0
                assert metrics.dividend_count == 1
                assert metrics.dividend_return > 0
    
    def test_backwards_compatibility(self, temp_calculator):
        """Test that the API remains backward compatible after gap detection implementation."""
        ticker = 'AAPL'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # The method should still return a DataFrame with the same structure
        with patch.object(temp_calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap:
            mock_gap.return_value = []  # No missing ranges
            
            result = temp_calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            # Should return DataFrame (empty or with data)
            assert isinstance(result, pd.DataFrame)
            
            # If not empty, should have expected columns
            if not result.empty:
                expected_columns = ['ticker_symbol', 'ex_date', 'dividend_amount']
                for col in expected_columns:
                    assert col in result.columns or any(col.replace('_', '') in c for c in result.columns)


class TestPhase2ComplianceChecks:
    """Test that Phase 2 meets all PRD requirements."""
    
    @pytest.fixture
    def calculator(self):
        """Create calculator for compliance testing."""
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        temp_file.close()
        
        calc = TotalReturnCalculator(database_url=f"sqlite:///{temp_file.name}")
        
        yield calc
        
        calc.close()
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
    
    def test_no_breaking_api_changes(self, calculator):
        """Verify no breaking API changes in fetch_and_cache_dividends method."""
        # Method signature should remain the same
        import inspect
        sig = inspect.signature(calculator.fetch_and_cache_dividends)
        
        # Should have the same parameters
        params = list(sig.parameters.keys())
        expected_params = ['ticker', 'start_date', 'end_date']
        assert params == expected_params
        
        # Return type should still be DataFrame
        with patch.object(calculator.cache_manager, 'get_missing_dividend_ranges'):
            result = calculator.fetch_and_cache_dividends('TEST', date(2024, 1, 1), date(2024, 12, 31))
            assert isinstance(result, pd.DataFrame)
    
    def test_gap_detection_reduces_api_calls(self, calculator):
        """Verify that gap detection reduces unnecessary API calls."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        with patch.object(calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap:
            with patch.object(calculator.data_source, 'fetch_dividends') as mock_fetch:
                
                # Test 1: No gaps - no API calls
                mock_gap.return_value = []
                calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                mock_fetch.assert_not_called()
                
                # Test 2: One gap - one API call
                mock_fetch.reset_mock()
                mock_gap.return_value = [DateRange(start_date, end_date)]
                calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                assert mock_fetch.call_count == 1
                
                # Test 3: Two consolidated gaps - two API calls
                mock_fetch.reset_mock()
                mock_gap.return_value = [
                    DateRange(date(2024, 1, 1), date(2024, 6, 30)),
                    DateRange(date(2024, 9, 1), date(2024, 12, 31))
                ]
                calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                assert mock_fetch.call_count == 2
    
    def test_intelligent_backfilling(self, calculator):
        """Test that only missing data is fetched, not entire ranges."""
        ticker = 'MSFT'
        
        # Request 5-year range
        end_date = date(2024, 12, 31)
        start_date = date(2019, 1, 1)
        
        # But only 2023-2024 is missing
        missing_ranges = [DateRange(date(2023, 1, 1), date(2024, 12, 31))]
        
        with patch.object(calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap:
            with patch.object(calculator.data_source, 'fetch_dividends') as mock_fetch:
                with patch.object(calculator.cache_manager, 'cache_dividend_data'):
                    
                    mock_gap.return_value = missing_ranges
                    mock_fetch.return_value = pd.DataFrame()
                    
                    calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                    
                    # Should only fetch the missing 2023-2024 range, not entire 2019-2024
                    mock_fetch.assert_called_once_with(ticker, date(2023, 1, 1), date(2024, 12, 31))
    
    def test_cache_range_tracking(self, calculator):
        """Test that cache ranges are properly tracked after fetching."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        mock_data = pd.DataFrame([{
            'ex_date': '2024-06-15',
            'dividend_amount': 0.75,
            'dividend_type': 'regular'
        }])
        
        with patch.object(calculator.cache_manager, 'get_missing_dividend_ranges') as mock_gap:
            with patch.object(calculator.data_source, 'fetch_dividends') as mock_fetch:
                with patch.object(calculator.cache_manager, 'cache_dividend_data') as mock_cache:
                    
                    mock_gap.return_value = [DateRange(start_date, end_date)]
                    mock_fetch.return_value = mock_data
                    mock_cache.return_value = True
                    
                    calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
                    
                    # Verify cache range tracking was called
                    mock_cache.assert_called_once_with(
                        ticker, mock_data, start_date, end_date, calculator.data_source.name
                    )


if __name__ == '__main__':
    pytest.main([__file__, '-v'])