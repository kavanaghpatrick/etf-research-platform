#!/usr/bin/env python3
"""
Analyze what each free tier API actually allows.
Fix configuration issues and optimize for free tier usage.
"""

import asyncio
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Set API keys
os.environ['ALPHA_VANTAGE_API_KEY'] = 'VUVQWE4APFVTVRBD'
os.environ['FINNHUB_API_KEY'] = 'd1pqg81r01qku4u42vqgd1pqg81r01qku4u42vr0'
os.environ['TIINGO_API_KEY'] = 'd678fd56fd40967c1c7011997c61e685961a79d3'

# Add paths
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

async def test_yfinance_free_capabilities():
    """Test what YFinance actually supports for free."""
    print("🔍 ANALYZING YFINANCE FREE CAPABILITIES")
    print("=" * 60)
    
    try:
        import yfinance as yf
        
        # Test different date ranges and periods
        test_cases = [
            ("5d", "Last 5 days"),
            ("1mo", "Last month"),
            ("3mo", "Last 3 months"),
            ("1y", "Last year"),
            ("2y", "Last 2 years"),
            ("5y", "Last 5 years"),
            ("max", "Maximum available")
        ]
        
        print("📊 Testing YFinance with different periods:")
        
        for period, description in test_cases:
            try:
                ticker = yf.Ticker("AAPL")
                data = ticker.history(period=period)
                
                if not data.empty:
                    print(f"   ✅ {description} ({period}): {len(data)} data points")
                    print(f"      📅 {data.index.min().date()} to {data.index.max().date()}")
                else:
                    print(f"   ❌ {description} ({period}): No data")
                    
            except Exception as e:
                print(f"   ❌ {description} ({period}): Error - {str(e)}")
        
        # Test specific date ranges
        print(f"\n📅 Testing specific date ranges:")
        date_tests = [
            ("2024-01-01", "2024-01-31", "January 2024"),
            ("2023-01-01", "2023-12-31", "Full year 2023"),
            ("2020-01-01", "2020-12-31", "Full year 2020"),
        ]
        
        for start, end, desc in date_tests:
            try:
                ticker = yf.Ticker("SPY")
                data = ticker.history(start=start, end=end)
                
                if not data.empty:
                    print(f"   ✅ {desc}: {len(data)} data points")
                else:
                    print(f"   ❌ {desc}: No data")
                    
            except Exception as e:
                print(f"   ❌ {desc}: Error - {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ YFinance test failed: {str(e)}")
        return False

async def test_alphavantage_free_endpoints():
    """Test AlphaVantage free tier endpoints."""
    print(f"\n🔍 ANALYZING ALPHAVANTAGE FREE TIER")
    print("=" * 60)
    
    try:
        import requests
        
        api_key = os.environ.get('ALPHA_VANTAGE_API_KEY')
        base_url = "https://www.alphavantage.co/query"
        
        # Test free endpoints
        free_endpoints = [
            ("TIME_SERIES_DAILY", "Daily time series"),
            ("TIME_SERIES_WEEKLY", "Weekly time series"),
            ("TIME_SERIES_MONTHLY", "Monthly time series"),
            ("GLOBAL_QUOTE", "Real-time quote"),
            ("SYMBOL_SEARCH", "Symbol search")
        ]
        
        print("📊 Testing AlphaVantage free endpoints:")
        
        for function, description in free_endpoints:
            try:
                params = {
                    'function': function,
                    'symbol': 'AAPL',
                    'apikey': api_key
                }
                
                response = requests.get(base_url, params=params, timeout=10)
                data = response.json()
                
                if 'Error Message' in data:
                    print(f"   ❌ {description}: {data['Error Message']}")
                elif 'Note' in data:
                    print(f"   ⚠️  {description}: Rate limited - {data['Note']}")
                elif 'Information' in data:
                    print(f"   ⚠️  {description}: {data['Information']}")
                else:
                    # Check if we got actual data
                    if any('Time Series' in key for key in data.keys()) or 'Global Quote' in data:
                        print(f"   ✅ {description}: Working!")
                        # Show sample data structure
                        for key in list(data.keys())[:2]:
                            print(f"      📋 Contains: {key}")
                    else:
                        print(f"   ❓ {description}: Unexpected response")
                        
            except Exception as e:
                print(f"   ❌ {description}: Error - {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ AlphaVantage test failed: {str(e)}")
        return False

async def test_finnhub_free_endpoints():
    """Test Finnhub free tier endpoints."""
    print(f"\n🔍 ANALYZING FINNHUB FREE TIER")
    print("=" * 60)
    
    try:
        import requests
        
        api_key = os.environ.get('FINNHUB_API_KEY')
        base_url = "https://finnhub.io/api/v1"
        
        # Test free endpoints
        free_endpoints = [
            ("quote", "Real-time quote", {"symbol": "AAPL"}),
            ("stock/profile2", "Company profile", {"symbol": "AAPL"}),
            ("stock/metric", "Basic metrics", {"symbol": "AAPL", "metric": "all"}),
            ("search", "Symbol search", {"q": "Apple"}),
            ("stock/candle", "Historical candles", {
                "symbol": "AAPL", 
                "resolution": "D", 
                "from": int((datetime.now() - timedelta(days=30)).timestamp()),
                "to": int(datetime.now().timestamp())
            })
        ]
        
        print("📊 Testing Finnhub free endpoints:")
        
        for endpoint, description, params in free_endpoints:
            try:
                params['token'] = api_key
                url = f"{base_url}/{endpoint}"
                
                response = requests.get(url, params=params, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        print(f"   ✅ {description}: Working!")
                        # Show data keys
                        if isinstance(data, dict):
                            keys = list(data.keys())[:3]
                            print(f"      📋 Contains: {keys}")
                        elif isinstance(data, list) and data:
                            print(f"      📋 List with {len(data)} items")
                    else:
                        print(f"   ⚠️  {description}: Empty response")
                elif response.status_code == 403:
                    print(f"   ❌ {description}: 403 Forbidden - API key issue")
                elif response.status_code == 429:
                    print(f"   ⚠️  {description}: Rate limited")
                else:
                    print(f"   ❌ {description}: HTTP {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {description}: Error - {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Finnhub test failed: {str(e)}")
        return False

async def test_tiingo_free_endpoints():
    """Test Tiingo free tier endpoints."""
    print(f"\n🔍 ANALYZING TIINGO FREE TIER")
    print("=" * 60)
    
    try:
        import requests
        
        api_key = os.environ.get('TIINGO_API_KEY')
        base_url = "https://api.tiingo.com/tiingo"
        
        # Test free endpoints
        free_endpoints = [
            ("daily/AAPL", "Daily prices", {}),
            ("daily/AAPL/prices", "Price history", {
                "startDate": "2024-01-01",
                "endDate": "2024-01-31"
            }),
            ("fundamentals/meta", "Metadata", {"tickers": "AAPL"})
        ]
        
        print("📊 Testing Tiingo free endpoints:")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Token {api_key}'
        }
        
        for endpoint, description, params in free_endpoints:
            try:
                url = f"{base_url}/{endpoint}"
                
                response = requests.get(url, params=params, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        print(f"   ✅ {description}: Working!")
                        if isinstance(data, list):
                            print(f"      📋 List with {len(data)} items")
                        elif isinstance(data, dict):
                            keys = list(data.keys())[:3]
                            print(f"      📋 Contains: {keys}")
                    else:
                        print(f"   ⚠️  {description}: Empty response")
                elif response.status_code == 401:
                    print(f"   ❌ {description}: 401 Unauthorized - API key issue")
                elif response.status_code == 429:
                    print(f"   ⚠️  {description}: Rate limited")
                else:
                    print(f"   ❌ {description}: HTTP {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ {description}: Error - {str(e)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Tiingo test failed: {str(e)}")
        return False

async def create_optimized_configuration():
    """Create optimized configuration for free tiers."""
    print(f"\n🔧 CREATING OPTIMIZED FREE-TIER CONFIGURATION")
    print("=" * 60)
    
    config = {
        "yfinance": {
            "enabled": True,
            "priority": 1,
            "best_for": ["recent_data", "major_stocks", "ETFs"],
            "limitations": ["weekend_availability", "rate_limits"],
            "optimal_usage": {
                "periods": ["5d", "1mo", "3mo", "1y", "2y"],
                "max_requests_per_minute": 60,
                "recommended_batch_size": 10
            }
        },
        "alphavantage": {
            "enabled": True,
            "priority": 2,
            "best_for": ["daily_data", "weekly_data", "monthly_data"],
            "free_functions": ["TIME_SERIES_DAILY", "TIME_SERIES_WEEKLY", "TIME_SERIES_MONTHLY", "GLOBAL_QUOTE"],
            "limitations": ["25_requests_per_day", "no_intraday"],
            "optimal_usage": {
                "max_requests_per_day": 25,
                "cache_for_hours": 24,
                "use_for": "fallback_only"
            }
        },
        "finnhub": {
            "enabled": True,
            "priority": 3,
            "best_for": ["real_time_quotes", "company_profiles"],
            "free_endpoints": ["quote", "profile2", "search"],
            "limitations": ["limited_historical", "60_calls_per_minute"],
            "optimal_usage": {
                "max_requests_per_minute": 60,
                "use_for": "current_data_only"
            }
        },
        "tiingo": {
            "enabled": True,
            "priority": 4,
            "best_for": ["daily_prices", "historical_data"],
            "limitations": ["1000_requests_per_month"],
            "optimal_usage": {
                "max_requests_per_month": 1000,
                "cache_for_hours": 48,
                "use_for": "premium_fallback"
            }
        }
    }
    
    print("📋 Optimized free-tier configuration:")
    for source, details in config.items():
        print(f"\n   📊 {source.upper()}:")
        print(f"      Priority: {details['priority']}")
        print(f"      Best for: {', '.join(details['best_for'])}")
        if 'optimal_usage' in details:
            for key, value in details['optimal_usage'].items():
                print(f"      {key}: {value}")
    
    return config

async def main():
    """Run comprehensive free tier analysis."""
    print("🔍 FREE TIER API CAPABILITIES ANALYSIS")
    print("Optimizing configuration for maximum free usage")
    print("=" * 80)
    
    # Test each API's actual capabilities
    results = {}
    results['yfinance'] = await test_yfinance_free_capabilities()
    results['alphavantage'] = await test_alphavantage_free_endpoints()
    results['finnhub'] = await test_finnhub_free_endpoints()
    results['tiingo'] = await test_tiingo_free_endpoints()
    
    # Create optimized configuration
    config = await create_optimized_configuration()
    
    print(f"\n" + "=" * 80)
    print(f"📊 FREE TIER ANALYSIS SUMMARY")
    print(f"=" * 80)
    
    working_sources = sum(1 for result in results.values() if result)
    total_sources = len(results)
    
    print(f"Working sources: {working_sources}/{total_sources}")
    
    for source, working in results.items():
        status = "✅ Configured" if working else "❌ Needs fixing"
        print(f"   {source}: {status}")
    
    print(f"\n💡 RECOMMENDATIONS FOR FREE TIER SUCCESS:")
    print(f"   1. Use YFinance for recent data (last 2 years)")
    print(f"   2. Use AlphaVantage sparingly (25 calls/day limit)")
    print(f"   3. Use Finnhub for current quotes only")
    print(f"   4. Use Tiingo as premium fallback")
    print(f"   5. Implement aggressive caching")
    print(f"   6. Use period-based queries instead of date ranges")
    
    return 0

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)