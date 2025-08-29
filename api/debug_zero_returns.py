#!/usr/bin/env python3
"""
Debug script to check for zero returns or data corruption issues.
"""

import requests
import json
import numpy as np
from datetime import datetime, date

def check_for_zero_returns():
    """Check if any tickers have zero or corrupted return data."""
    print("🔍 Checking for Zero Returns or Data Corruption")
    print("=" * 60)
    
    # Test tickers from the problematic portfolio
    tickers = ["SPLV", "PHDG", "QUAL", "VUG", "VGT", "VEA", "SCHE", "GLD"]
    
    # Fetch data for each ticker
    for ticker in tickers:
        print(f"\n📊 Checking {ticker}:")
        
        # Make API call to fetch data
        response = requests.post(
            "http://localhost:8000/api/fetch-data",
            json={
                "tickers": [ticker],
                "start_date": "2010-01-01",
                "end_date": "2024-12-31"
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            ticker_data = data.get('data', {}).get(ticker, {})
            
            if ticker_data:
                prices = ticker_data.get('prices', [])
                dates = ticker_data.get('dates', [])
                
                if prices:
                    # Convert to numpy array for analysis
                    price_array = np.array(prices)
                    
                    # Check for zeros or extreme values
                    zero_count = np.sum(price_array == 0)
                    negative_count = np.sum(price_array < 0)
                    
                    # Calculate returns
                    returns = np.diff(price_array) / price_array[:-1]
                    
                    # Check for extreme returns
                    extreme_negative = np.sum(returns < -0.5)  # More than 50% daily loss
                    extreme_positive = np.sum(returns > 1.0)   # More than 100% daily gain
                    
                    print(f"   • Data points: {len(prices)}")
                    print(f"   • Date range: {dates[0] if dates else 'N/A'} to {dates[-1] if dates else 'N/A'}")
                    print(f"   • Min price: ${price_array.min():.2f}")
                    print(f"   • Max price: ${price_array.max():.2f}")
                    print(f"   • Zero prices: {zero_count}")
                    print(f"   • Negative prices: {negative_count}")
                    print(f"   • Returns < -50%: {extreme_negative}")
                    print(f"   • Returns > +100%: {extreme_positive}")
                    
                    # Check for data gaps
                    if len(returns) > 0:
                        # Find days with exactly 0% return (suspicious)
                        zero_returns = np.sum(returns == 0)
                        print(f"   • Zero returns: {zero_returns}")
                        
                        # Calculate annualized return
                        total_return = (price_array[-1] / price_array[0]) - 1
                        years = len(prices) / 252
                        annualized = (1 + total_return) ** (1 / years) - 1
                        print(f"   • Total return: {total_return * 100:.1f}%")
                        print(f"   • Annualized: {annualized * 100:.1f}%")
                    
                    # Flag any issues
                    if zero_count > 0 or negative_count > 0:
                        print(f"   ⚠️  WARNING: Found {zero_count} zero prices and {negative_count} negative prices!")
                    if extreme_negative > 10:
                        print(f"   ⚠️  WARNING: {extreme_negative} days with >50% losses!")
                    
                else:
                    print(f"   ❌ No price data returned")
            else:
                print(f"   ❌ No data for ticker")
        else:
            print(f"   ❌ API error: {response.status_code}")
    
    print("\n" + "=" * 60)
    print("💡 If seeing zero prices or extreme returns, this could explain the -65% annualized return")

if __name__ == "__main__":
    check_for_zero_returns()