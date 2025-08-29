#!/usr/bin/env python3
"""
Test real data fetching directly with our optimized sources.
"""

import os
import sys
from datetime import datetime

# Add src to path
sys.path.insert(0, '/Users/patrickkavanagh/etf-research-platform/src')

def test_alphavantage():
    print("🧪 Testing AlphaVantage directly...")
    try:
        from data.sources.optimized_alphavantage_source import OptimizedAlphaVantageSource
        
        api_key = os.getenv('ALPHA_VANTAGE_API_KEY', '')
        source = OptimizedAlphaVantageSource(api_key=api_key)
        
        print(f"   API Key: {api_key[:10]}...")
        print(f"   Available: {source.is_available()}")
        
        if source.is_available():
            data = source.fetch_data("AAPL", "2024-01-01", "2024-01-31")
            print(f"   ✅ Success! Got {len(data)} data points")
            print(f"   Date range: {data.index.min()} to {data.index.max()}")
            print(f"   Sample data:\n{data.head(3)}")
        else:
            print("   ❌ Source not available")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_tiingo():
    print("\n🧪 Testing Tiingo directly...")
    try:
        from data.sources.optimized_tiingo_source import OptimizedTiingoSource
        
        api_key = os.getenv('TIINGO_API_KEY', '')
        source = OptimizedTiingoSource(api_key=api_key)
        
        print(f"   API Key: {api_key[:10]}...")
        print(f"   Available: {source.is_available()}")
        
        if source.is_available():
            data = source.fetch_data("AAPL", "2024-01-01", "2024-01-31")
            print(f"   ✅ Success! Got {len(data)} data points")
            print(f"   Date range: {data.index.min()} to {data.index.max()}")
            print(f"   Sample data:\n{data.head(3)}")
        else:
            print("   ❌ Source not available")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")

def test_resilient_fetcher():
    print("\n🧪 Testing ResilientDataFetcher...")
    try:
        from data.sources.optimized_alphavantage_source import OptimizedAlphaVantageSource
        from data.sources.optimized_tiingo_source import OptimizedTiingoSource
        from data.resilient_fetcher import ResilientDataFetcher
        
        # Initialize sources
        alpha_key = "VUVQWE4APFVTVRBD"
        tiingo_key = "d678fd56fd40967c1c7011997c61e685961a79d3"
        
        alphavantage_source = OptimizedAlphaVantageSource(api_key=alpha_key)
        tiingo_source = OptimizedTiingoSource(api_key=tiingo_key)
        
        # Create fetcher
        fetcher = ResilientDataFetcher(
            sources=[alphavantage_source, tiingo_source],
            config=None
        )
        
        print(f"   Sources available: {len(fetcher.sources)}")
        
        # Test fetch
        start_date = datetime(2024, 1, 1)
        end_date = datetime(2024, 1, 31)
        
        results = fetcher.fetch_multiple_tickers(["AAPL"], start_date, end_date)
        print(f"   ✅ ResilientDataFetcher results:")
        print(f"   Total tickers: {results.get('total_tickers')}")
        print(f"   Successful: {results.get('successful_tickers')}")
        print(f"   Sources used: {results.get('data_sources_used')}")
        
        if results.get('data'):
            aapl_data = results['data']['AAPL']
            print(f"   AAPL data points: {len(aapl_data.get('data', []))}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🚀 Testing Real Data Sources")
    print("=" * 50)
    
    # Set environment variables
    os.environ['ALPHA_VANTAGE_API_KEY'] = "VUVQWE4APFVTVRBD"
    os.environ['TIINGO_API_KEY'] = "d678fd56fd40967c1c7011997c61e685961a79d3"
    
    test_alphavantage()
    test_tiingo()
    test_resilient_fetcher()
    
    print("\n🎯 Testing complete!")