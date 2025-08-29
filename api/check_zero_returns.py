#!/usr/bin/env python3
"""
Check for zero returns in cached data
"""
import numpy as np
from cached_data_fetcher import CachedDataFetcher
from simple_data_sources import YFinanceSource
from datetime import datetime, timedelta

def check_ticker_data():
    """Check each ticker for zero or extreme returns"""
    # Create fetcher with YFinance source
    sources = [YFinanceSource()]
    fetcher = CachedDataFetcher(sources)
    
    tickers = ["SPLV", "PHDG", "QUAL", "VUG", "VGT", "VEA", "SCHE", "GLD"]
    
    print("🔍 Checking for Zero Returns in Cached Data")
    print("=" * 60)
    
    for ticker in tickers:
        print(f"\n📊 Checking {ticker}:")
        
        try:
            # Try to get data from cache
            start_date = datetime.now() - timedelta(days=365*15)  # 15 years
            end_date = datetime.now()
            
            # Get data using the fetcher directly
            from datetime import date
            result = fetcher.fetch_ticker_data(
                ticker, 
                start_date.date(),
                end_date.date()
            )
            
            # Extract data from result
            data = result.data if result and result.success else None
            
            if data and 'prices' in data and data['prices']:
                prices = np.array(data['prices'])
                dates = data.get('dates', [])
                
                # Check for zeros
                zero_count = np.sum(prices == 0)
                negative_count = np.sum(prices < 0)
                
                # Calculate returns
                if len(prices) > 1:
                    returns = np.diff(prices) / prices[:-1]
                    
                    # Check for extreme returns
                    extreme_negative = np.sum(returns < -0.5)
                    extreme_positive = np.sum(returns > 1.0)
                    zero_returns = np.sum(returns == 0)
                    
                    # Check for NaN or inf
                    nan_count = np.sum(np.isnan(returns))
                    inf_count = np.sum(np.isinf(returns))
                    
                    print(f"   • Data points: {len(prices)}")
                    print(f"   • Date range: {dates[0] if dates else 'N/A'} to {dates[-1] if dates else 'N/A'}")
                    print(f"   • Price range: ${prices.min():.2f} - ${prices.max():.2f}")
                    print(f"   • Zero prices: {zero_count}")
                    print(f"   • Negative prices: {negative_count}")
                    print(f"   • Zero returns: {zero_returns}")
                    print(f"   • Returns < -50%: {extreme_negative}")
                    print(f"   • Returns > +100%: {extreme_positive}")
                    print(f"   • NaN returns: {nan_count}")
                    print(f"   • Inf returns: {inf_count}")
                    
                    # Calculate simple annualized return
                    if len(prices) > 252:  # At least 1 year of data
                        total_return = (prices[-1] / prices[0]) - 1
                        years = len(prices) / 252
                        annualized = (1 + total_return) ** (1 / years) - 1
                        print(f"   • Annualized return: {annualized * 100:.1f}%")
                    
                    # Find specific problematic days
                    if extreme_negative > 0:
                        worst_idx = np.argmin(returns)
                        print(f"   ⚠️  Worst day: {dates[worst_idx] if worst_idx < len(dates) else 'Unknown'} with {returns[worst_idx]*100:.1f}% loss")
                    
                    if zero_count > 0 or nan_count > 0 or inf_count > 0:
                        print(f"   🚨 DATA QUALITY ISSUE DETECTED!")
                else:
                    print(f"   ❌ Not enough data points for return calculation")
            else:
                print(f"   ❌ No data found in cache")
                
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
    
    print("\n" + "=" * 60)
    print("💡 Summary: Check for zero prices, NaN, or infinity values that could cause extreme returns")

if __name__ == "__main__":
    check_ticker_data()