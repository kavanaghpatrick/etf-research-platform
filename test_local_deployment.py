#!/usr/bin/env python3
"""
Local deployment test script for ETF Research Platform.
Tests the full integration between frontend and backend.
"""

import requests
import json
import time
from datetime import datetime

def test_api_endpoints():
    """Test all API endpoints."""
    base_url = "http://localhost:8000"
    
    print("🧪 Testing ETF Research Platform Local Deployment")
    print("=" * 60)
    
    # Test 1: Root endpoint
    print("\n1. Testing root endpoint...")
    try:
        response = requests.get(f"{base_url}/")
        if response.status_code == 200:
            print("✅ Root endpoint working")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Root endpoint error: {e}")
    
    # Test 2: Health endpoint
    print("\n2. Testing health endpoint...")
    try:
        response = requests.get(f"{base_url}/health")
        if response.status_code == 200:
            print("✅ Health endpoint working")
            data = response.json()
            print(f"   Service: {data.get('service')}")
            print(f"   Version: {data.get('version')}")
        else:
            print(f"❌ Health endpoint failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Health endpoint error: {e}")
    
    # Test 3: Data source health
    print("\n3. Testing data source health...")
    try:
        response = requests.get(f"{base_url}/data/health")
        if response.status_code == 200:
            print("✅ Data source health working")
            data = response.json()
            print(f"   Overall health: {data.get('overall_health')}")
            print(f"   Healthy sources: {data.get('healthy_sources')}/{data.get('total_sources')}")
            for source in data.get('sources', []):
                print(f"   - {source['name']}: {source['success_rate']} success rate")
        else:
            print(f"❌ Data source health failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Data source health error: {e}")
    
    # Test 4: Data fetch endpoint
    print("\n4. Testing data fetch endpoint...")
    try:
        test_payload = {
            "tickers": ["AAPL", "SPY", "QQQ"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-31",
            "force_refresh": False,
            "max_workers": 3
        }
        
        start_time = time.time()
        response = requests.post(
            f"{base_url}/data/fetch",
            headers={"Content-Type": "application/json"},
            json=test_payload
        )
        execution_time = time.time() - start_time
        
        if response.status_code == 200:
            print("✅ Data fetch endpoint working")
            data = response.json()
            print(f"   Execution time: {execution_time:.3f}s")
            print(f"   API execution time: {data.get('execution_time', 0):.6f}s")
            print(f"   Status: {data.get('status')}")
            print(f"   Message: {data.get('message')}")
            
            metadata = data.get('metadata', {})
            print(f"   Total tickers: {metadata.get('total_tickers')}")
            print(f"   Successful: {metadata.get('successful_tickers')}")
            print(f"   Success rate: {metadata.get('success_rate', 0):.1%}")
            print(f"   Data sources: {', '.join(data.get('data_sources_used', []))}")
            
            # Check data structure
            ticker_data = data.get('data', {})
            if ticker_data:
                first_ticker = list(ticker_data.keys())[0]
                first_data = ticker_data[first_ticker]
                print(f"   Sample data points for {first_ticker}: {len(first_data.get('data', []))}")
                
        else:
            print(f"❌ Data fetch failed: {response.status_code}")
            print(f"   Response: {response.text}")
    except Exception as e:
        print(f"❌ Data fetch error: {e}")
    
    print("\n" + "=" * 60)
    print("🎯 Local deployment test complete!")
    print("\n📱 Frontend should be accessible at: http://localhost:3000")
    print("🔧 Backend API accessible at: http://localhost:8000")
    print("📚 API docs available at: http://localhost:8000/docs")

def test_frontend_connectivity():
    """Test if frontend is accessible."""
    print("\n5. Testing frontend connectivity...")
    try:
        response = requests.get("http://localhost:3000", timeout=5)
        if response.status_code == 200:
            print("✅ Frontend is accessible")
            print("   Frontend running on http://localhost:3000")
        else:
            print(f"❌ Frontend returned status: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("⚠️ Frontend not accessible (may still be starting)")
    except Exception as e:
        print(f"❌ Frontend test error: {e}")

if __name__ == "__main__":
    test_api_endpoints()
    test_frontend_connectivity()
    
    print("\n🚀 Ready for testing!")
    print("1. Open http://localhost:3000 in your browser")
    print("2. Enter some tickers (e.g., AAPL, SPY, QQQ)")
    print("3. Click 'Analyze Portfolio'")
    print("4. Check the results dashboard")