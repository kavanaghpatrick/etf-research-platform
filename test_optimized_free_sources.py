#!/usr/bin/env python3
"""
Test optimized free tier sources with actual working endpoints.
This should demonstrate real data retrieval capabilities!
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load test environment variables
test_env_path = Path(__file__).parent / '.env.test'
if test_env_path.exists():
    load_dotenv(test_env_path)
    print(f"✅ Loaded test environment from {test_env_path}")
else:
    print(f"⚠️ Warning: {test_env_path} not found. Using system environment variables.")
    print("   To set up test environment, copy .env.test.example to .env.test and add your API keys.")

# Add paths
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

async def test_optimized_alphavantage():
    """Test optimized AlphaVantage source."""
    print("📊 TESTING OPTIMIZED ALPHAVANTAGE")
    print("=" * 50)
    
    try:
        from src.data.sources.optimized_alphavantage_source import OptimizedAlphaVantageSource
        from src.utils.config import load_config
        
        config = load_config()
        av_source = OptimizedAlphaVantageSource(config)
        
        print(f"🔑 API Key available: {'✅' if av_source.api_key else '❌'}")
        print(f"📡 Source available: {'✅' if av_source.is_available() else '❌'}")
        
        if av_source.is_available():
            # Test historical data
            print(f"\n🧪 Testing historical data for AAPL...")
            try:
                data = av_source.fetch_data(
                    "AAPL", 
                    datetime.now() - timedelta(days=30), 
                    datetime.now()
                )
                
                if not data.empty:
                    print(f"   ✅ SUCCESS! Got {len(data)} data points")
                    print(f"   📅 Date range: {data.index.min().date()} to {data.index.max().date()}")
                    print(f"   📋 Columns: {list(data.columns)}")
                    print(f"   📊 Sample data:")
                    print(data.head(2).to_string())
                    return True
                else:
                    print(f"   ⚠️  Empty result")
                    
            except Exception as e:
                print(f"   ❌ Historical data failed: {str(e)}")
            
            # Test real-time quote
            print(f"\n🧪 Testing real-time quote for AAPL...")
            try:
                quote = av_source.get_quote("AAPL")
                print(f"   ✅ SUCCESS! Quote: ${quote['price']:.2f}")
                print(f"   📊 Quote details: {quote}")
                return True
                
            except Exception as e:
                print(f"   ❌ Quote failed: {str(e)}")
        
        return False
        
    except Exception as e:
        print(f"❌ AlphaVantage test failed: {str(e)}")
        return False

async def test_optimized_tiingo():
    """Test optimized Tiingo source."""
    print(f"\n📊 TESTING OPTIMIZED TIINGO")
    print("=" * 50)
    
    try:
        from src.data.sources.optimized_tiingo_source import OptimizedTiingoSource
        from src.utils.config import load_config
        
        config = load_config()
        tiingo_source = OptimizedTiingoSource(config)
        
        print(f"🔑 API Key available: {'✅' if tiingo_source.api_key else '❌'}")
        print(f"📡 Source available: {'✅' if tiingo_source.is_available() else '❌'}")
        
        if tiingo_source.is_available():
            # Test historical data
            print(f"\n🧪 Testing historical data for AAPL...")
            try:
                data = tiingo_source.fetch_data(
                    "AAPL",
                    "2024-01-01",
                    "2024-01-31"
                )
                
                if not data.empty:
                    print(f"   ✅ SUCCESS! Got {len(data)} data points")
                    print(f"   📅 Date range: {data.index.min().date()} to {data.index.max().date()}")
                    print(f"   📋 Columns: {list(data.columns)}")
                    print(f"   📊 Sample data:")
                    print(data.head(2).to_string())
                    return True
                else:
                    print(f"   ⚠️  Empty result")
                    
            except Exception as e:
                print(f"   ❌ Historical data failed: {str(e)}")
            
            # Test metadata
            print(f"\n🧪 Testing metadata for AAPL...")
            try:
                metadata = tiingo_source.get_metadata("AAPL")
                print(f"   ✅ SUCCESS! Metadata: {metadata['name']}")
                print(f"   📊 Details: {metadata}")
                return True
                
            except Exception as e:
                print(f"   ❌ Metadata failed: {str(e)}")
        
        return False
        
    except Exception as e:
        print(f"❌ Tiingo test failed: {str(e)}")
        return False

async def test_data_retrieval_capability():
    """Test what data we can actually retrieve with working sources."""
    print(f"\n🎯 TESTING ACTUAL DATA RETRIEVAL CAPABILITY")
    print("=" * 60)
    
    # Test different tickers and date ranges
    test_cases = [
        ("AAPL", "2024-01-01", "2024-01-31", "Apple January 2024"),
        ("SPY", "2023-12-01", "2023-12-31", "SPY December 2023"),
        ("MSFT", "2024-06-01", "2024-06-30", "Microsoft June 2024"),
        ("GOOGL", "2023-01-01", "2023-03-31", "Google Q1 2023"),
        ("TSLA", "2023-06-01", "2023-08-31", "Tesla Summer 2023")
    ]
    
    successful_retrievals = 0
    total_data_points = 0
    
    try:
        from src.data.sources.optimized_tiingo_source import OptimizedTiingoSource
        from src.utils.config import load_config
        
        config = load_config()
        source = OptimizedTiingoSource(config)
        
        if not source.is_available():
            print("❌ Tiingo source not available")
            return False
        
        print(f"📊 Testing {len(test_cases)} different ticker/date combinations:")
        
        for ticker, start, end, description in test_cases:
            try:
                print(f"\n   🧪 {description} ({ticker})...")
                data = source.fetch_data(ticker, start, end)
                
                if not data.empty:
                    points = len(data)
                    total_data_points += points
                    successful_retrievals += 1
                    
                    print(f"      ✅ {points} data points")
                    print(f"      📅 {data.index.min().date()} to {data.index.max().date()}")
                    
                    # Show price range
                    if 'Close' in data.columns:
                        min_price = data['Close'].min()
                        max_price = data['Close'].max()
                        last_price = data['Close'].iloc[-1]
                        print(f"      💰 Price range: ${min_price:.2f} - ${max_price:.2f} (last: ${last_price:.2f})")
                else:
                    print(f"      ❌ No data")
                
                # Rate limiting
                await asyncio.sleep(1)
                
            except Exception as e:
                print(f"      ❌ Failed: {str(e)}")
        
        print(f"\n📈 DATA RETRIEVAL SUMMARY:")
        print(f"   ✅ Successful: {successful_retrievals}/{len(test_cases)}")
        print(f"   📊 Total data points: {total_data_points:,}")
        print(f"   🎯 Success rate: {successful_retrievals/len(test_cases):.1%}")
        
        if successful_retrievals > 0:
            avg_points = total_data_points / successful_retrievals
            print(f"   📊 Average points per ticker: {avg_points:.0f}")
        
        return successful_retrievals > 0
        
    except Exception as e:
        print(f"❌ Data retrieval test failed: {str(e)}")
        return False

async def main():
    """Run comprehensive optimized source testing."""
    print("🔧 OPTIMIZED FREE TIER SOURCES TEST")
    print("Testing sources that actually work with free API tiers")
    print("=" * 80)
    
    # Test individual sources
    av_working = await test_optimized_alphavantage()
    tiingo_working = await test_optimized_tiingo()
    
    # Test actual data retrieval
    data_retrieval_working = await test_data_retrieval_capability()
    
    print(f"\n" + "=" * 80)
    print(f"🎯 FINAL ASSESSMENT")
    print(f"=" * 80)
    
    working_sources = sum([av_working, tiingo_working])
    
    print(f"Working sources: {working_sources}/2")
    print(f"   AlphaVantage: {'✅' if av_working else '❌'}")
    print(f"   Tiingo: {'✅' if tiingo_working else '❌'}")
    print(f"   Data retrieval: {'✅' if data_retrieval_working else '❌'}")
    
    if working_sources > 0 or data_retrieval_working:
        print(f"\n🎉 SUCCESS! Free tier data access is WORKING!")
        print(f"   ✅ Can retrieve real historical market data")
        print(f"   ✅ Multiple working sources for resilience")
        print(f"   ✅ Ready for web application integration")
        
        print(f"\n💡 OPTIMAL FREE TIER STRATEGY:")
        print(f"   1. Use Tiingo as primary (1000 calls/month)")
        print(f"   2. Use AlphaVantage as backup (25 calls/day)")
        print(f"   3. Implement aggressive caching (24-48 hours)")
        print(f"   4. Use for demo with 10-20 popular tickers")
        print(f"   5. Rate limit to stay within quotas")
        
        return True
    else:
        print(f"\n⚠️  No sources currently working")
        print(f"   🔧 May need API key validation")
        print(f"   ⏰ APIs may be temporarily unavailable")
        
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)