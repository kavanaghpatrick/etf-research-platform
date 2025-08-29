#!/usr/bin/env python3
"""
Test script for YFinance dividend functionality.
Demonstrates the new dividend fetching methods.
"""

import logging
from datetime import datetime, timedelta
from yfinance_source import YFinanceSource
import pandas as pd

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

def test_dividend_fetching():
    """Test dividend fetching functionality"""
    print("\n=== Testing YFinance Dividend Fetching ===\n")
    
    # Initialize YFinance source
    yf_source = YFinanceSource()
    
    # Test tickers
    test_tickers = ['AAPL', 'SPY', 'VIG', 'MSFT', 'JNJ']  # Mix of stocks and ETFs
    
    # Date range - last 2 years
    end_date = datetime.now()
    start_date = end_date - timedelta(days=730)
    
    for ticker in test_tickers:
        print(f"\n--- Testing {ticker} ---")
        
        # 1. Test fetch_dividends
        print(f"\n1. Fetching dividends for {ticker} from {start_date.date()} to {end_date.date()}")
        dividends = yf_source.fetch_dividends(ticker, start_date, end_date)
        
        if not dividends.empty:
            print(f"   Found {len(dividends)} dividends")
            print("\n   Latest 5 dividends:")
            print(dividends.head().to_string())
            
            # Calculate trailing 12-month yield
            one_year_ago = end_date - timedelta(days=365)
            ttm_dividends = dividends[dividends['ex_date'] >= one_year_ago]['dividend_amount'].sum()
            print(f"\n   Trailing 12-month dividends: ${ttm_dividends:.2f}")
        else:
            print("   No dividends found")
        
        # 2. Test get_dividend_calendar
        print(f"\n2. Getting full dividend calendar for {ticker}")
        calendar = yf_source.get_dividend_calendar(ticker)
        
        if not calendar.empty:
            print(f"   Found {len(calendar)} total dividend entries")
            print(f"   Payment frequency: {calendar['payment_frequency'].iloc[0] if 'payment_frequency' in calendar.columns else 'N/A'}")
            
            # Show dividend growth
            if len(calendar) >= 8:  # Need at least 2 years of quarterly dividends
                recent_year = calendar.iloc[:4]['dividend_amount'].mean() if len(calendar) >= 4 else 0
                prior_year = calendar.iloc[4:8]['dividend_amount'].mean() if len(calendar) >= 8 else 0
                if prior_year > 0:
                    growth = ((recent_year - prior_year) / prior_year) * 100
                    print(f"   YoY dividend growth: {growth:.1f}%")
        
        # 3. Test fetch_splits
        print(f"\n3. Fetching stock splits for {ticker}")
        splits = yf_source.fetch_splits(ticker, start_date, end_date)
        
        if not splits.empty:
            print(f"   Found {len(splits)} splits")
            print("\n   Split details:")
            print(splits.to_string())
        else:
            print("   No splits found in date range")
        
        # 4. Test get_all_corporate_actions
        print(f"\n4. Getting all corporate actions for {ticker}")
        actions = yf_source.get_all_corporate_actions(ticker)
        
        if not actions.empty:
            print(f"   Found {len(actions)} corporate actions")
            print("\n   Recent actions:")
            print(actions.head().to_string())
        else:
            print("   No corporate actions found")
        
        print("\n" + "="*60)
    
    # Close the source
    yf_source.close()

def test_edge_cases():
    """Test edge cases and error handling"""
    print("\n=== Testing Edge Cases ===\n")
    
    yf_source = YFinanceSource()
    
    # Test invalid ticker
    print("1. Testing invalid ticker (XXXXX)")
    dividends = yf_source.fetch_dividends('XXXXX', '2023-01-01', '2024-01-01')
    print(f"   Result: {'Empty DataFrame' if dividends.empty else f'{len(dividends)} records'}")
    
    # Test ticker with no dividends
    print("\n2. Testing non-dividend paying stock (TSLA)")
    dividends = yf_source.fetch_dividends('TSLA', '2023-01-01', '2024-01-01')
    print(f"   Result: {'No dividends (as expected)' if dividends.empty else f'{len(dividends)} records'}")
    
    # Test date range with no dividends
    print("\n3. Testing very recent date range (last 7 days)")
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    dividends = yf_source.fetch_dividends('AAPL', start_date, end_date)
    print(f"   Result: {'Empty (likely no dividends in 7 days)' if dividends.empty else f'{len(dividends)} records'}")
    
    # Test string date formats
    print("\n4. Testing string date format")
    dividends = yf_source.fetch_dividends('MSFT', '2023-01-01', '2023-12-31')
    print(f"   Result: {len(dividends)} dividends found")
    
    yf_source.close()

def test_data_integration():
    """Test how dividend data integrates with cached_data_fetcher"""
    print("\n=== Testing Data Integration ===\n")
    
    yf_source = YFinanceSource()
    
    # Fetch dividend data for a high-dividend ETF
    ticker = 'VYM'  # Vanguard High Dividend Yield ETF
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365)
    
    print(f"Fetching comprehensive data for {ticker}")
    
    # Get price data
    price_data = yf_source.fetch_data(ticker, start_date, end_date)
    print(f"\n1. Price data: {len(price_data)} daily records")
    
    # Get dividend data
    dividend_data = yf_source.fetch_dividends(ticker, start_date, end_date)
    print(f"2. Dividend data: {len(dividend_data)} dividend payments")
    
    # Get corporate actions
    corp_actions = yf_source.get_all_corporate_actions(ticker)
    print(f"3. Corporate actions: {len(corp_actions)} actions")
    
    # Calculate total return
    if not price_data.empty and not dividend_data.empty:
        start_price = price_data.iloc[-1]['Close']
        end_price = price_data.iloc[0]['Close']
        price_return = ((end_price - start_price) / start_price) * 100
        
        total_dividends = dividend_data['dividend_amount'].sum()
        dividend_return = (total_dividends / start_price) * 100
        total_return = price_return + dividend_return
        
        print(f"\n4. Return Analysis:")
        print(f"   Price return: {price_return:.2f}%")
        print(f"   Dividend return: {dividend_return:.2f}%")
        print(f"   Total return: {total_return:.2f}%")
    
    yf_source.close()

if __name__ == "__main__":
    # Run all tests
    test_dividend_fetching()
    test_edge_cases()
    test_data_integration()
    
    print("\n=== All tests completed ===")