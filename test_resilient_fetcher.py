#!/usr/bin/env python3
"""
Comprehensive test of the resilient data fetching system.
Demonstrates handling of rate limits, failures, and data quality issues.
"""

import os
import logging
from datetime import datetime, timedelta
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from src.data.resilient_fetcher import ResilientDataFetcher
from src.data.data_aggregator import DataAggregator
from src.utils import setup_logging


def test_single_ticker_resilience():
    """Test fetching a single ticker with simulated failures."""
    print("\n" + "="*60)
    print("TEST 1: Single Ticker Resilience")
    print("="*60)
    
    fetcher = ResilientDataFetcher()
    
    # Test with a popular ticker
    ticker = "AAPL"
    start_date = datetime.now() - timedelta(days=30)
    end_date = datetime.now()
    
    print(f"\nFetching {ticker} from {start_date.date()} to {end_date.date()}")
    print(f"Available sources: {[s.name for s in fetcher.sources]}")
    
    # Fetch with fallback
    data = fetcher.fetch_with_fallback(ticker, start_date, end_date)
    
    if not data.empty:
        print(f"\n✓ Success! Retrieved {len(data)} days of data")
        print(f"Date range: {data.index[0].date()} to {data.index[-1].date()}")
        print(f"Latest close: ${data['Close'].iloc[-1]:.2f}")
        
        # Show data quality
        print("\nData quality check:")
        print(f"  Missing values: {data.isna().sum().sum()}")
        print(f"  Columns: {list(data.columns)}")
    else:
        print("\n✗ Failed to retrieve data")
    
    # Show source health
    print("\nSource Health Status:")
    health = fetcher.get_source_health()
    for source, status in health.items():
        print(f"  {source}: {status['healthy']} (Success rate: {status['success_rate']})")


def test_batch_fetching_resilience():
    """Test batch fetching with mixed success/failure."""
    print("\n" + "="*60)
    print("TEST 2: Batch Fetching Resilience")
    print("="*60)
    
    fetcher = ResilientDataFetcher()
    
    # Mix of valid and invalid tickers
    tickers = [
        "SPY", "QQQ", "IWM",  # Valid ETFs
        "INVALID1", "FAKE_TICKER",  # Invalid
        "AAPL", "MSFT", "GOOGL",  # Valid stocks
        "XYZ123", "ABC789"  # Invalid
    ]
    
    start_date = datetime.now() - timedelta(days=7)
    end_date = datetime.now()
    
    print(f"\nFetching {len(tickers)} tickers (including invalid ones)")
    print(f"Tickers: {tickers}")
    
    # Fetch with priority (prioritize valid ETFs)
    priority_map = {
        "SPY": -2,  # Highest priority
        "QQQ": -1,
        "IWM": -1,
        "AAPL": 0,
        "MSFT": 0,
        "GOOGL": 0
    }
    
    results = fetcher.fetch_multiple_resilient(
        tickers,
        start_date,
        end_date,
        priority_map=priority_map
    )
    
    # Analyze results
    successful = sum(1 for df in results.values() if not df.empty)
    print(f"\n✓ Successfully fetched: {successful}/{len(tickers)} tickers")
    
    print("\nDetailed results:")
    for ticker, data in results.items():
        if not data.empty:
            print(f"  ✓ {ticker}: {len(data)} days, latest close: ${data['Close'].iloc[-1]:.2f}")
        else:
            print(f"  ✗ {ticker}: No data")
    
    # Show updated source health
    print("\nSource Health After Batch:")
    health = fetcher.get_source_health()
    for source, status in health.items():
        print(f"  {source}:")
        print(f"    Success rate: {status['success_rate']}")
        print(f"    Total requests: {status['total_requests']}")
        print(f"    Rate limit hits: {status['rate_limit_hits']}")


def test_data_aggregation():
    """Test intelligent data aggregation from multiple sources."""
    print("\n" + "="*60)
    print("TEST 3: Multi-Source Data Aggregation")
    print("="*60)
    
    aggregator = DataAggregator()
    
    ticker = "SPY"
    start_date = datetime.now() - timedelta(days=14)
    end_date = datetime.now()
    
    print(f"\nAggregating data for {ticker} from all available sources")
    
    # Test different aggregation methods
    methods = ["best_quality", "average", "consensus", "priority"]
    results = {}
    
    for method in methods:
        print(f"\nTesting {method} aggregation...")
        data = aggregator.aggregate_from_all_sources(
            ticker,
            start_date,
            end_date,
            aggregation_method=method
        )
        
        if not data.empty:
            results[method] = data
            print(f"  ✓ Success: {len(data)} days")
            print(f"  Close price range: ${data['Close'].min():.2f} - ${data['Close'].max():.2f}")
        else:
            print(f"  ✗ Failed")
    
    # Compare results if we have multiple successful methods
    if len(results) > 1:
        print("\nComparing aggregation methods:")
        
        # Create comparison DataFrame
        comparison = pd.DataFrame()
        for method, data in results.items():
            comparison[f"{method}_close"] = data['Close']
        
        # Calculate statistics
        print("\nClose price statistics:")
        print(comparison.describe())
        
        # Plot comparison
        plt.figure(figsize=(12, 6))
        for col in comparison.columns:
            plt.plot(comparison.index, comparison[col], label=col.replace('_close', ''), alpha=0.7)
        
        plt.title('Comparison of Aggregation Methods')
        plt.xlabel('Date')
        plt.ylabel('Close Price ($)')
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.tight_layout()
        plt.savefig('aggregation_comparison.png', dpi=150)
        print("\n✓ Saved comparison plot to 'aggregation_comparison.png'")


def test_gap_filling():
    """Test data gap filling and repair functionality."""
    print("\n" + "="*60)
    print("TEST 4: Data Gap Filling and Repair")
    print("="*60)
    
    fetcher = ResilientDataFetcher()
    
    # Use a ticker that might have gaps
    ticker = "IEF"  # Bond ETF that might have some missing data
    start_date = datetime.now() - timedelta(days=60)
    end_date = datetime.now()
    
    print(f"\nFetching {ticker} and checking for gaps")
    
    # First fetch
    initial_data = fetcher.fetch_with_fallback(ticker, start_date, end_date)
    
    if not initial_data.empty:
        print(f"Initial fetch: {len(initial_data)} days")
        
        # Check for gaps
        expected_days = pd.bdate_range(start=start_date, end=end_date)
        missing_days = expected_days.difference(initial_data.index)
        
        print(f"Missing days: {len(missing_days)}")
        
        if len(missing_days) > 0:
            print("\nAttempting to repair missing data...")
            repaired_data = fetcher.repair_missing_data(
                ticker,
                initial_data,
                start_date,
                end_date
            )
            
            print(f"After repair: {len(repaired_data)} days")
            print(f"Recovered {len(repaired_data) - len(initial_data)} missing days")
        
        # Test interpolation
        aggregator = DataAggregator()
        interpolated = aggregator.fill_gaps_with_interpolation(
            initial_data,
            method="linear",
            limit=3
        )
        
        missing_before = initial_data.isna().sum().sum()
        missing_after = interpolated.isna().sum().sum()
        
        print(f"\nInterpolation results:")
        print(f"  Missing values before: {missing_before}")
        print(f"  Missing values after: {missing_after}")
        print(f"  Values filled: {missing_before - missing_after}")


def test_source_failover():
    """Test source failover behavior."""
    print("\n" + "="*60)
    print("TEST 5: Source Failover Simulation")
    print("="*60)
    
    fetcher = ResilientDataFetcher()
    
    # Simulate source failures by marking some as unhealthy
    print("\nSimulating source failures...")
    
    # Get initial health
    initial_health = fetcher.get_source_health()
    print(f"Initial healthy sources: {sum(1 for s in initial_health.values() if s['healthy'])}")
    
    # Simulate failures on primary source
    if fetcher.sources:
        primary_source = fetcher.sources[0]
        status = fetcher.source_status[primary_source.name]
        
        # Simulate multiple failures
        for i in range(5):
            status.record_failure(is_rate_limit=True)
        
        print(f"\nSimulated rate limit failures on {primary_source.name}")
        print(f"Source is now in backoff until: {status.backoff_until}")
    
    # Try fetching with primary source down
    ticker = "VTI"
    data = fetcher.fetch_with_fallback(
        ticker,
        datetime.now() - timedelta(days=5),
        datetime.now()
    )
    
    if not data.empty:
        print(f"\n✓ Successfully failed over to alternate source")
        print(f"  Retrieved {len(data)} days of data")
    
    # Show final health status
    print("\nFinal Source Health:")
    final_health = fetcher.get_source_health()
    for source, status in final_health.items():
        print(f"  {source}: {'Healthy' if status['healthy'] else 'Unhealthy'}")
        if status['backoff_until']:
            print(f"    In backoff until: {status['backoff_until']}")


def main():
    """Run all resilience tests."""
    # Set up logging
    setup_logging()
    
    # Reduce matplotlib logging
    logging.getLogger('matplotlib').setLevel(logging.WARNING)
    
    print("\n" + "="*60)
    print("RESILIENT DATA FETCHER TEST SUITE")
    print("="*60)
    
    # Run tests
    try:
        test_single_ticker_resilience()
        test_batch_fetching_resilience()
        test_data_aggregation()
        test_gap_filling()
        test_source_failover()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS COMPLETED")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()