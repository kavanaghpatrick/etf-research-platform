#!/usr/bin/env python3
"""
Test script for multi-source data fetching capabilities.
"""

import os
import logging
from datetime import datetime, timedelta

from src.data import ETFDataFetcher
from src.utils import setup_logging

def main():
    # Set up logging
    setup_logging()
    logger = logging.getLogger(__name__)
    
    # Initialize fetcher (will use all available sources)
    fetcher = ETFDataFetcher()
    
    # Show available sources
    print("Available data sources:")
    for source in fetcher.get_available_sources():
        print(f"  - {source}")
    print()
    
    # Test tickers
    test_tickers = ["SPY", "QQQ", "INVALID_TICKER"]
    start_date = datetime.now() - timedelta(days=30)
    end_date = datetime.now()
    
    print(f"Testing data fetch for: {test_tickers}")
    print(f"Date range: {start_date.date()} to {end_date.date()}")
    print()
    
    # Test individual fetching
    print("1. Testing individual ticker fetching:")
    print("-" * 50)
    
    for ticker in test_tickers:
        print(f"\nFetching {ticker}...")
        data = fetcher.fetch_etf_data(ticker, start_date, end_date)
        
        if not data.empty:
            print(f"  ✓ Success: {len(data)} days of data")
            print(f"  Date range: {data.index[0].date()} to {data.index[-1].date()}")
            print(f"  Latest close: ${data['Close'].iloc[-1]:.2f}")
        else:
            print(f"  ✗ Failed: No data retrieved")
    
    # Test batch fetching
    print("\n\n2. Testing batch fetching:")
    print("-" * 50)
    
    batch_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"]
    print(f"\nFetching batch: {batch_tickers}")
    
    results = fetcher.fetch_multiple_etfs(batch_tickers, start_date, end_date)
    
    for ticker, data in results.items():
        if not data.empty:
            print(f"  ✓ {ticker}: {len(data)} days, latest close: ${data['Close'].iloc[-1]:.2f}")
        else:
            print(f"  ✗ {ticker}: Failed")
    
    # Test force refresh (bypass cache)
    print("\n\n3. Testing force refresh:")
    print("-" * 50)
    
    print("\nFetching SPY with force_refresh=True...")
    data = fetcher.fetch_etf_data("SPY", start_date, end_date, force_refresh=True)
    
    if not data.empty:
        print(f"  ✓ Success: Retrieved fresh data")
    else:
        print(f"  ✗ Failed")
    
    # Show cache statistics
    print("\n\n4. Cache Statistics:")
    print("-" * 50)
    
    cache_info = fetcher.cache.get_cache_info()
    print(f"  Total cached items: {cache_info['total_items']}")
    print(f"  Total cache size: {cache_info['total_size_mb']:.2f} MB")
    
    print("\n✅ Multi-source data fetching test complete!")


if __name__ == "__main__":
    main()