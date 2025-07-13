"""
Tests for the data aggregator that combines data from multiple sources.
"""

import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, patch

from src.data.data_aggregator import DataAggregator
from src.data.resilient_fetcher import ResilientDataFetcher
from src.utils import Config


class TestDataAggregator:
    """Test the data aggregation functionality."""
    
    @pytest.fixture
    def sample_data_sources(self):
        """Create sample data from different sources."""
        dates = pd.date_range('2023-01-01', '2023-01-10', freq='D')
        
        # Source 1: Complete data with some noise
        source1_data = pd.DataFrame({
            'Open': [100 + i + np.random.normal(0, 0.5) for i in range(len(dates))],
            'High': [105 + i + np.random.normal(0, 0.5) for i in range(len(dates))],
            'Low': [95 + i + np.random.normal(0, 0.5) for i in range(len(dates))],
            'Close': [102 + i + np.random.normal(0, 0.5) for i in range(len(dates))],
            'Volume': [1000000 + i * 10000 for i in range(len(dates))],
            '_source': 'Source1',
            '_source_priority': 1
        }, index=dates)
        
        # Fix OHLC relationships
        source1_data['High'] = source1_data[['Open', 'High', 'Close']].max(axis=1)
        source1_data['Low'] = source1_data[['Open', 'Low', 'Close']].min(axis=1)
        source1_data['Adj Close'] = source1_data['Close']
        
        # Source 2: Missing some days
        source2_data = pd.DataFrame({
            'Open': [100 + i for i in range(0, len(dates), 2)],  # Every other day
            'High': [105 + i for i in range(0, len(dates), 2)],
            'Low': [95 + i for i in range(0, len(dates), 2)],
            'Close': [102 + i for i in range(0, len(dates), 2)],
            'Volume': [1000000 + i * 10000 for i in range(0, len(dates), 2)],
            '_source': 'Source2',
            '_source_priority': 2
        }, index=dates[::2])
        
        source2_data['High'] = source2_data[['Open', 'High', 'Close']].max(axis=1)
        source2_data['Low'] = source2_data[['Open', 'Low', 'Close']].min(axis=1)
        source2_data['Adj Close'] = source2_data['Close']
        
        # Source 3: Some bad data
        source3_data = pd.DataFrame({
            'Open': [100 + i if i % 3 != 0 else 0 for i in range(len(dates))],  # Some zeros
            'High': [105 + i for i in range(len(dates))],
            'Low': [95 + i if i % 4 != 0 else 200 for i in range(len(dates))],  # Some invalid
            'Close': [102 + i for i in range(len(dates))],
            'Volume': [1000000 + i * 10000 for i in range(len(dates))],
            '_source': 'Source3',
            '_source_priority': 3
        }, index=dates)
        
        source3_data['Adj Close'] = source3_data['Close']
        
        return {
            'Source1': source1_data,
            'Source2': source2_data,
            'Source3': source3_data
        }
    
    @pytest.fixture
    def aggregator(self):
        """Create aggregator instance."""
        config = Config({"data": {"cache_dir": "/tmp"}})
        return DataAggregator(config=config)
    
    def test_aggregate_best_quality(self, aggregator, sample_data_sources):
        """Test best quality aggregation method."""
        # Mock the fetcher to return our sample data
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = sample_data_sources
            
            result = aggregator.aggregate_from_all_sources(
                "TEST",
                "2023-01-01",
                "2023-01-10",
                aggregation_method="best_quality"
            )
        
        assert not result.empty
        assert len(result) == 10  # Should have all days
        
        # Should prefer Source1 data (highest quality)
        # Check that we don't have zeros from Source3
        assert (result['Open'] > 0).all()
        
        # Check OHLC relationships are valid
        assert (result['High'] >= result['Low']).all()
        assert (result['High'] >= result['Open']).all()
        assert (result['High'] >= result['Close']).all()
    
    def test_aggregate_average(self, aggregator, sample_data_sources):
        """Test average aggregation method."""
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = sample_data_sources
            
            result = aggregator.aggregate_from_all_sources(
                "TEST",
                "2023-01-01",
                "2023-01-10",
                aggregation_method="average"
            )
        
        assert not result.empty
        
        # Result should be average of available values
        # For dates where all sources have data, close should be ~102
        first_day_close = result.iloc[0]['Close']
        assert 101 < first_day_close < 103  # Should be around 102
    
    def test_aggregate_consensus(self, aggregator, sample_data_sources):
        """Test consensus aggregation method."""
        # Create data where 2 sources agree
        dates = pd.date_range('2023-01-01', '2023-01-05', freq='D')
        
        source_data = {
            'Source1': pd.DataFrame({
                'Close': [100, 101, 102, 103, 104],
                'Volume': [1000000] * 5,
                '_source': 'Source1',
                '_source_priority': 1
            }, index=dates),
            'Source2': pd.DataFrame({
                'Close': [100, 101, 102, 103, 104],  # Agrees with Source1
                'Volume': [1000000] * 5,
                '_source': 'Source2',
                '_source_priority': 2
            }, index=dates),
            'Source3': pd.DataFrame({
                'Close': [99, 100, 101, 102, 103],  # Different values
                'Volume': [900000] * 5,
                '_source': 'Source3',
                '_source_priority': 3
            }, index=dates)
        }
        
        # Add required columns
        for source_df in source_data.values():
            source_df['Open'] = source_df['Close']
            source_df['High'] = source_df['Close']
            source_df['Low'] = source_df['Close']
            source_df['Adj Close'] = source_df['Close']
        
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = source_data
            
            result = aggregator.aggregate_from_all_sources(
                "TEST",
                "2023-01-01",
                "2023-01-05",
                aggregation_method="consensus"
            )
        
        assert not result.empty
        
        # Should use the most common values (Source1 & Source2 agree)
        assert list(result['Close'].values) == [100, 101, 102, 103, 104]
    
    def test_aggregate_priority(self, aggregator, sample_data_sources):
        """Test priority aggregation method."""
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = sample_data_sources
            
            result = aggregator.aggregate_from_all_sources(
                "TEST",
                "2023-01-01",
                "2023-01-10",
                aggregation_method="priority"
            )
        
        assert not result.empty
        
        # Should use Source1 data primarily (highest priority)
        # Internal columns should be removed
        assert '_source' not in result.columns
        assert '_source_priority' not in result.columns
    
    def test_aggregate_no_data(self, aggregator):
        """Test aggregation when no data is available."""
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = {}
            
            result = aggregator.aggregate_from_all_sources(
                "TEST",
                "2023-01-01",
                "2023-01-10"
            )
        
        assert result.empty
    
    def test_create_composite_dataset(self, aggregator):
        """Test creating composite datasets for multiple tickers."""
        tickers = ["AAPL", "MSFT", "GOOGL"]
        
        # Mock the aggregate method
        def mock_aggregate(ticker, start, end, method):
            # Return different data for each ticker
            dates = pd.date_range(start, end, freq='D')
            return pd.DataFrame({
                'Close': [100 + ord(ticker[0]) + i for i in range(len(dates))],
                'Volume': [1000000] * len(dates)
            }, index=dates)
        
        with patch.object(aggregator, 'aggregate_from_all_sources', side_effect=mock_aggregate):
            results = aggregator.create_composite_dataset(
                tickers,
                "2023-01-01",
                "2023-01-05"
            )
        
        assert len(results) == 3
        assert all(ticker in results for ticker in tickers)
        assert all(not df.empty for df in results.values())
    
    def test_fill_gaps_with_interpolation(self, aggregator):
        """Test gap filling with interpolation."""
        dates = pd.date_range('2023-01-01', '2023-01-10', freq='D')
        
        # Create data with gaps
        data = pd.DataFrame({
            'Open': [100, np.nan, np.nan, 103, 104, np.nan, 106, 107, np.nan, 109],
            'Close': [101, np.nan, np.nan, 104, 105, np.nan, 107, 108, np.nan, 110],
            'Volume': [1e6, np.nan, np.nan, 1.3e6, 1.4e6, np.nan, 1.6e6, 1.7e6, np.nan, 1.9e6]
        }, index=dates)
        
        # Fill gaps
        filled = aggregator.fill_gaps_with_interpolation(data, method='linear', limit=3)
        
        # Check that gaps are filled
        assert filled['Open'].isna().sum() < data['Open'].isna().sum()
        assert filled['Close'].isna().sum() < data['Close'].isna().sum()
        
        # Check interpolated values are reasonable
        assert 100 < filled['Open'].iloc[1] < 103  # Interpolated between 100 and 103
        assert 101 < filled['Close'].iloc[1] < 104  # Interpolated between 101 and 104
        
        # Volume should be forward filled, not interpolated
        assert filled['Volume'].iloc[1] == 1e6  # Forward filled
    
    def test_is_row_consistent(self, aggregator):
        """Test row consistency checking."""
        # Valid row
        valid_row = pd.Series({
            'Open': 100,
            'High': 105,
            'Low': 95,
            'Close': 102
        })
        assert aggregator._is_row_consistent(valid_row)
        
        # Invalid: High < Low
        invalid_hl = pd.Series({
            'Open': 100,
            'High': 95,
            'Low': 105,
            'Close': 102
        })
        assert not aggregator._is_row_consistent(invalid_hl)
        
        # Invalid: High < Close
        invalid_hc = pd.Series({
            'Open': 100,
            'High': 101,
            'Low': 95,
            'Close': 105
        })
        assert not aggregator._is_row_consistent(invalid_hc)
        
        # Invalid: Zero price
        zero_price = pd.Series({
            'Open': 0,
            'High': 105,
            'Low': 95,
            'Close': 102
        })
        assert not aggregator._is_row_consistent(zero_price)
    
    def test_align_dataframes(self, aggregator):
        """Test dataframe alignment."""
        # Create dataframes with different date ranges
        dates1 = pd.date_range('2023-01-01', '2023-01-05', freq='D')
        dates2 = pd.date_range('2023-01-03', '2023-01-07', freq='D')
        
        df1 = pd.DataFrame({'value': range(5)}, index=dates1)
        df2 = pd.DataFrame({'value': range(5, 10)}, index=dates2)
        
        aligned = aggregator._align_dataframes([df1, df2])
        
        assert len(aligned) == 2
        assert len(aligned[0]) == len(aligned[1])  # Same length after alignment
        
        # Check that all dates are included
        all_dates = dates1.union(dates2)
        assert len(aligned[0]) == len(all_dates)
    
    def test_fetch_from_source_error_handling(self, aggregator):
        """Test error handling when fetching from a source."""
        # Create a mock source that raises an exception
        mock_source = Mock()
        mock_source.name = "FailingSource"
        mock_source.priority = 1
        mock_source.fetch_data.side_effect = Exception("API Error")
        
        result = aggregator._fetch_from_source(
            mock_source,
            "TEST",
            "2023-01-01",
            "2023-01-05"
        )
        
        assert result is None
    
    def test_quality_score_calculation(self, aggregator):
        """Test that quality scores are calculated correctly."""
        # Create data with varying quality
        dates = pd.date_range('2023-01-01', '2023-01-05', freq='D')
        
        # High quality data
        good_data = pd.DataFrame({
            'Open': [100, 101, 102, 103, 104],
            'High': [105, 106, 107, 108, 109],
            'Low': [95, 96, 97, 98, 99],
            'Close': [102, 103, 104, 105, 106],
            'Volume': [1e6, 1.1e6, 1.2e6, 1.3e6, 1.4e6],
            'Adj Close': [102, 103, 104, 105, 106],
            '_source': 'GoodSource',
            '_source_priority': 1
        }, index=dates)
        
        # Poor quality data (missing values, invalid relationships)
        bad_data = pd.DataFrame({
            'Open': [100, np.nan, 102, 0, 104],
            'High': [90, 106, 107, 108, 109],  # First day: High < Low
            'Low': [95, 96, 97, 98, 99],
            'Close': [102, np.nan, 104, 105, 106],
            'Volume': [1e6, np.nan, 1.2e6, 1.3e6, 1.4e6],
            'Adj Close': [102, np.nan, 104, 105, 106],
            '_source': 'BadSource',
            '_source_priority': 2
        }, index=dates)
        
        data_dict = {
            'GoodSource': good_data,
            'BadSource': bad_data
        }
        
        with patch.object(aggregator, '_fetch_from_all_sources') as mock_fetch:
            mock_fetch.return_value = data_dict
            
            result = aggregator.aggregate_from_all_sources(
                "TEST",
                "2023-01-01",
                "2023-01-05",
                aggregation_method="best_quality"
            )
        
        # Should prefer good quality data
        assert not result.empty
        assert not result.isna().any().any()  # No missing values in result