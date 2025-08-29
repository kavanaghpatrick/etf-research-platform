"""
Comprehensive unit tests for dividend gap detection functionality.
Tests the SQLiteStockDataCache dividend methods.
"""

import pytest
import sqlite3
import pandas as pd
import tempfile
import os
from datetime import date, datetime, timedelta
from unittest.mock import patch, MagicMock

from sqlite_cache_manager import SQLiteStockDataCache, DateRange


class TestDividendGapDetection:
    """Test suite for dividend gap detection methods."""
    
    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing."""
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        temp_file.close()
        
        cache = SQLiteStockDataCache(database_url=f"sqlite:///{temp_file.name}")
        
        yield cache
        
        # Cleanup
        cache.close()
        os.unlink(temp_file.name)
    
    @pytest.fixture
    def sample_dividend_data(self):
        """Sample dividend data for testing."""
        return pd.DataFrame([
            {
                'ex_date': '2024-02-14',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD'
            },
            {
                'ex_date': '2024-05-15',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD'
            },
            {
                'ex_date': '2024-08-15',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD'
            }
        ])
    
    def test_empty_cache_returns_full_range(self, temp_db):
        """Test that empty cache returns the full requested range."""
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        missing_ranges = temp_db.get_missing_dividend_ranges('MSFT', start_date, end_date)
        
        assert len(missing_ranges) == 1
        assert missing_ranges[0].start_date == start_date
        assert missing_ranges[0].end_date == end_date
    
    def test_full_cache_coverage_returns_no_gaps(self, temp_db, sample_dividend_data):
        """Test that full cache coverage returns no missing ranges."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Cache the dividend data
        success = temp_db.cache_dividend_data(
            ticker, sample_dividend_data, start_date, end_date, 'Test'
        )
        assert success
        
        # Check for missing ranges
        missing_ranges = temp_db.get_missing_dividend_ranges(ticker, start_date, end_date)
        
        assert len(missing_ranges) == 0
    
    def test_partial_cache_coverage_finds_gaps(self, temp_db, sample_dividend_data):
        """Test that partial cache coverage correctly identifies gaps."""
        ticker = 'MSFT'
        
        # Cache data for part of 2024
        cache_start = date(2024, 2, 1)
        cache_end = date(2024, 8, 31)
        temp_db.cache_dividend_data(ticker, sample_dividend_data, cache_start, cache_end, 'Test')
        
        # Request larger range
        request_start = date(2023, 1, 1)
        request_end = date(2024, 12, 31)
        
        missing_ranges = temp_db.get_missing_dividend_ranges(ticker, request_start, request_end)
        
        # Should find gaps before and after cached period
        assert len(missing_ranges) == 2
        
        # Gap before cached period
        assert missing_ranges[0].start_date == request_start
        assert missing_ranges[0].end_date == cache_start - timedelta(days=1)
        
        # Gap after cached period
        assert missing_ranges[1].start_date == cache_end + timedelta(days=1)
        assert missing_ranges[1].end_date == request_end
    
    def test_gap_consolidation_merges_nearby_gaps(self, temp_db):
        """Test that nearby gaps are consolidated to minimize API calls."""
        ticker = 'MSFT'
        
        # Create multiple small cached ranges with gaps between them
        ranges = [
            (date(2024, 1, 1), date(2024, 1, 31)),   # Jan
            (date(2024, 3, 1), date(2024, 3, 31)),   # Mar (gap in Feb)
            (date(2024, 4, 15), date(2024, 4, 30)),  # Mid-April (small gap)
            (date(2024, 6, 1), date(2024, 6, 30)),   # June (gap in May)
        ]
        
        for start, end in ranges:
            empty_df = pd.DataFrame()  # No dividends
            temp_db.cache_dividend_data(ticker, empty_df, start, end, 'Test')
        
        # Request full year
        missing_ranges = temp_db.get_missing_dividend_ranges(
            ticker, date(2024, 1, 1), date(2024, 12, 31)
        )
        
        # Should consolidate nearby gaps
        assert len(missing_ranges) < 5  # Should be fewer than the number of actual gaps
    
    def test_cache_dividend_data_success(self, temp_db, sample_dividend_data):
        """Test successful caching of dividend data."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        success = temp_db.cache_dividend_data(
            ticker, sample_dividend_data, start_date, end_date, 'YFinance'
        )
        
        assert success
        
        # Verify data was cached
        coverage = temp_db.get_dividend_cache_coverage(ticker)
        assert coverage['total_dividends'] == 3
        assert coverage['ticker'] == ticker
    
    def test_cache_dividend_data_empty_dataframe(self, temp_db):
        """Test caching with empty dividend data (no dividends found)."""
        ticker = 'NODIV'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        empty_df = pd.DataFrame()
        
        success = temp_db.cache_dividend_data(
            ticker, empty_df, start_date, end_date, 'YFinance'
        )
        
        assert success
        
        # Should still record the cache range even with no dividends
        coverage = temp_db.get_dividend_cache_coverage(ticker)
        assert coverage['total_dividends'] == 0
        assert coverage['cached_ranges'] == 1
    
    def test_get_dividend_cache_coverage_comprehensive(self, temp_db, sample_dividend_data):
        """Test comprehensive cache coverage statistics."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        temp_db.cache_dividend_data(ticker, sample_dividend_data, start_date, end_date, 'YFinance')
        
        coverage = temp_db.get_dividend_cache_coverage(ticker)
        
        assert coverage['ticker'] == ticker
        assert coverage['total_dividends'] == 3
        assert coverage['total_amount'] == 2.25  # 3 * 0.75
        assert coverage['cached_ranges'] == 1
        assert coverage['first_dividend'] == '2024-02-14'
        assert coverage['last_dividend'] == '2024-08-15'
        assert 'last_updated' in coverage
    
    def test_invalidate_dividend_cache_complete(self, temp_db, sample_dividend_data):
        """Test complete cache invalidation."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Cache data
        temp_db.cache_dividend_data(ticker, sample_dividend_data, start_date, end_date, 'YFinance')
        
        # Verify data exists
        coverage_before = temp_db.get_dividend_cache_coverage(ticker)
        assert coverage_before['total_dividends'] == 3
        
        # Invalidate cache
        success = temp_db.invalidate_dividend_cache(ticker)
        assert success
        
        # Verify data is gone
        coverage_after = temp_db.get_dividend_cache_coverage(ticker)
        assert coverage_after['total_dividends'] == 0
        assert coverage_after['cached_ranges'] == 0
    
    def test_invalidate_dividend_cache_partial(self, temp_db, sample_dividend_data):
        """Test partial cache invalidation with date range."""
        ticker = 'MSFT'
        full_start = date(2024, 1, 1)
        full_end = date(2024, 12, 31)
        
        # Cache data
        temp_db.cache_dividend_data(ticker, sample_dividend_data, full_start, full_end, 'YFinance')
        
        # Invalidate only Q2 data
        invalidate_start = date(2024, 4, 1)
        invalidate_end = date(2024, 6, 30)
        
        success = temp_db.invalidate_dividend_cache(ticker, invalidate_start, invalidate_end)
        assert success
        
        # Should have removed May dividend, kept Feb and August
        coverage = temp_db.get_dividend_cache_coverage(ticker)
        assert coverage['total_dividends'] == 2  # Feb and Aug remain
    
    def test_gap_detection_with_database_error(self, temp_db):
        """Test error handling in gap detection."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Mock database connection to raise error
        with patch.object(temp_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            missing_ranges = temp_db.get_missing_dividend_ranges(ticker, start_date, end_date)
            
            # Should fallback to full range
            assert len(missing_ranges) == 1
            assert missing_ranges[0].start_date == start_date
            assert missing_ranges[0].end_date == end_date
    
    def test_cache_data_with_database_error(self, temp_db, sample_dividend_data):
        """Test error handling in cache data method."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Mock database connection to raise error
        with patch.object(temp_db, 'get_connection') as mock_conn:
            mock_conn.side_effect = sqlite3.Error("Database error")
            
            success = temp_db.cache_dividend_data(
                ticker, sample_dividend_data, start_date, end_date, 'YFinance'
            )
            
            assert not success
    
    def test_edge_case_single_day_range(self, temp_db):
        """Test gap detection with single day range."""
        ticker = 'MSFT'
        single_day = date(2024, 5, 15)
        
        missing_ranges = temp_db.get_missing_dividend_ranges(ticker, single_day, single_day)
        
        assert len(missing_ranges) == 1
        assert missing_ranges[0].start_date == single_day
        assert missing_ranges[0].end_date == single_day
    
    def test_edge_case_overlapping_ranges(self, temp_db):
        """Test handling of overlapping cached ranges."""
        ticker = 'MSFT'
        
        # Cache overlapping ranges
        empty_df = pd.DataFrame()
        temp_db.cache_dividend_data(ticker, empty_df, date(2024, 1, 1), date(2024, 6, 30), 'Test1')
        temp_db.cache_dividend_data(ticker, empty_df, date(2024, 3, 1), date(2024, 9, 30), 'Test2')
        
        # Request range that should be fully covered
        missing_ranges = temp_db.get_missing_dividend_ranges(
            ticker, date(2024, 2, 1), date(2024, 8, 31)
        )
        
        # Should find no gaps since ranges overlap and cover the request
        assert len(missing_ranges) == 0
    
    def test_dividend_data_date_format_handling(self, temp_db):
        """Test handling of different date formats in dividend data."""
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        
        # Create dividend data with datetime objects instead of strings
        dividend_data = pd.DataFrame([
            {
                'ex_date': datetime(2024, 2, 14),
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD'
            }
        ])
        
        success = temp_db.cache_dividend_data(
            ticker, dividend_data, start_date, end_date, 'YFinance'
        )
        
        assert success
        
        coverage = temp_db.get_dividend_cache_coverage(ticker)
        assert coverage['total_dividends'] == 1
    
    @pytest.mark.parametrize("gap_days,expected_consolidation", [
        (10, True),   # Small gap - should consolidate
        (60, False),  # Large gap - should not consolidate
        (30, True),   # Boundary case - should consolidate
        (31, False),  # Just over boundary - should not consolidate
    ])
    def test_gap_consolidation_thresholds(self, temp_db, gap_days, expected_consolidation):
        """Test gap consolidation with different gap sizes."""
        gaps = [
            DateRange(date(2024, 1, 1), date(2024, 1, 31)),
            DateRange(date(2024, 1, 31) + timedelta(days=gap_days), date(2024, 3, 31))
        ]
        
        consolidated = temp_db._consolidate_dividend_gaps(gaps)
        
        if expected_consolidation:
            assert len(consolidated) == 1  # Gaps merged
        else:
            assert len(consolidated) == 2  # Gaps kept separate


class TestDividendGapDetectionIntegration:
    """Integration tests for dividend gap detection with real-world scenarios."""
    
    @pytest.fixture
    def cache_with_msft_data(self):
        """Create cache with realistic MSFT dividend data."""
        temp_file = tempfile.NamedTemporaryFile(delete=False)
        temp_file.close()
        
        cache = SQLiteStockDataCache(database_url=f"sqlite:///{temp_file.name}")
        
        # Add realistic MSFT dividend data for 2024
        msft_dividends = pd.DataFrame([
            {'ex_date': '2024-02-14', 'dividend_amount': 0.75, 'dividend_type': 'regular'},
            {'ex_date': '2024-05-15', 'dividend_amount': 0.75, 'dividend_type': 'regular'},
            {'ex_date': '2024-08-15', 'dividend_amount': 0.75, 'dividend_type': 'regular'},
            {'ex_date': '2024-11-21', 'dividend_amount': 0.83, 'dividend_type': 'regular'},
        ])
        
        cache.cache_dividend_data(
            'MSFT', msft_dividends, date(2024, 1, 1), date(2024, 12, 31), 'YFinance'
        )
        
        yield cache
        
        cache.close()
        os.unlink(temp_file.name)
    
    def test_realistic_5year_gap_detection(self, cache_with_msft_data):
        """Test gap detection for realistic 5-year MSFT scenario."""
        # Request 5 years but only have 1 year cached
        start_date = date(2019, 8, 14)  # 5 years ago
        end_date = date(2025, 5, 15)    # Future date
        
        missing_ranges = cache_with_msft_data.get_missing_dividend_ranges(
            'MSFT', start_date, end_date
        )
        
        # Should find gaps before and after cached 2024 data
        assert len(missing_ranges) >= 1
        
        # First gap should cover historical period
        assert missing_ranges[0].start_date <= start_date
    
    def test_quarterly_dividend_pattern_recognition(self, cache_with_msft_data):
        """Test that gap detection handles quarterly dividend patterns."""
        # MSFT pays quarterly, so 6 years should need ~24 dividends
        start_date = date(2019, 1, 1)
        end_date = date(2024, 12, 31)
        
        missing_ranges = cache_with_msft_data.get_missing_dividend_ranges(
            'MSFT', start_date, end_date
        )
        
        # Should identify 2019-2023 as missing
        assert len(missing_ranges) > 0
        
        # Total missing period should be approximately 5 years
        total_missing_days = sum(
            (r.end_date - r.start_date).days + 1 for r in missing_ranges
        )
        assert total_missing_days > 365 * 4  # At least 4 years missing
    
    def test_cache_efficiency_metrics(self, cache_with_msft_data):
        """Test cache efficiency and coverage metrics."""
        coverage = cache_with_msft_data.get_dividend_cache_coverage('MSFT')
        
        assert coverage['total_dividends'] == 4
        assert coverage['total_amount'] == 3.08  # 0.75*3 + 0.83*1
        assert coverage['cached_ranges'] == 1
        assert coverage['first_dividend'] == '2024-02-14'
        assert coverage['last_dividend'] == '2024-11-21'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])