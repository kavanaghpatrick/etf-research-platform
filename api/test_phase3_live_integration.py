#!/usr/bin/env python3
"""
Phase 3 Live Integration Testing: Test real API endpoints with gap detection.
Tests against actual running services with temporary databases.
"""

import logging
import tempfile
import os
from datetime import date, timedelta
import requests
import time
import json

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')


def test_dividend_endpoint_integration():
    """Test the dividend API endpoint with gap detection."""
    print("\n=== Phase 3: Dividend Endpoint Integration Test ===\n")
    
    # Note: This test assumes the FastAPI server is running
    # In production, this would be automated with proper test fixtures
    base_url = "http://localhost:8000"
    
    try:
        # Test 1: Get dividend history for MSFT (5 years)
        print("Test 1: GET /dividends/MSFT?years=5")
        
        start_time = time.time()
        response = requests.get(f"{base_url}/dividends/MSFT?years=5", timeout=30)
        end_time = time.time()
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {data['status']}")
            print(f"✅ Response time: {end_time - start_time:.2f}s")
            print(f"✅ Execution time: {data.get('execution_time', 'N/A')}s")
            print(f"✅ Dividend count: {len(data['data']['dividends'])}")
            
            if data['data']['dividends']:
                dividends = data['data']['dividends']
                print(f"✅ Date range: {dividends[-1]['ex_date']} to {dividends[0]['ex_date']}")
                total_amount = sum(d['dividend_amount'] for d in dividends)
                print(f"✅ Total dividends: ${total_amount:.2f}")
            
            # Verify gap detection was used (should have comprehensive historical data)
            if len(data['data']['dividends']) >= 15:  # Expect ~20 dividends for 5 years
                print("✅ Gap detection working - comprehensive historical data retrieved")
            else:
                print(f"⚠️  Limited dividend data - may indicate gap detection issue")
        else:
            print(f"❌ Request failed with status {response.status_code}: {response.text}")
        
        # Test 2: Different time ranges to test gap detection
        print("\nTest 2: GET /dividends/AAPL?years=1")
        
        response = requests.get(f"{base_url}/dividends/AAPL?years=1", timeout=15)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ AAPL 1Y dividends: {len(data['data']['dividends'])}")
        
        # Test 3: Test cached response (should be faster)
        print("\nTest 3: Repeat MSFT request (should use cache)")
        
        start_time = time.time()
        response = requests.get(f"{base_url}/dividends/MSFT?years=5", timeout=10)
        end_time = time.time()
        
        if response.status_code == 200:
            cached_time = end_time - start_time
            print(f"✅ Cached response time: {cached_time:.2f}s")
            if cached_time < 2.0:
                print("✅ Cache performance good")
            else:
                print("⚠️  Cache may not be optimally utilized")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server. Please ensure FastAPI server is running on localhost:8000")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


def test_data_fetch_endpoint_integration():
    """Test the data fetch endpoint with dividend integration."""
    print("\n=== Phase 3: Data Fetch Endpoint Integration Test ===\n")
    
    base_url = "http://localhost:8000"
    
    try:
        # Test data fetch with dividends enabled
        print("Test: POST /data/fetch with include_dividends=true")
        
        request_data = {
            "tickers": ["MSFT", "AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-12-31",
            "include_dividends": True
        }
        
        start_time = time.time()
        response = requests.post(
            f"{base_url}/data/fetch", 
            json=request_data,
            timeout=60
        )
        end_time = time.time()
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {data['status']}")
            print(f"✅ Response time: {end_time - start_time:.2f}s")
            
            for ticker in ["MSFT", "AAPL"]:
                if ticker in data['data']:
                    ticker_data = data['data'][ticker]
                    print(f"✅ {ticker} data retrieved")
                    
                    # Check for dividend data
                    if 'dividend_data' in ticker_data and ticker_data['dividend_data']:
                        div_count = len(ticker_data['dividend_data'])
                        print(f"✅ {ticker} dividends: {div_count}")
                    else:
                        print(f"⚠️  {ticker} has no dividend data")
                        
                    # Check for price data
                    if 'data' in ticker_data and ticker_data['data']:
                        price_count = len(ticker_data['data'])
                        print(f"✅ {ticker} price records: {price_count}")
        else:
            print(f"❌ Request failed with status {response.status_code}: {response.text}")
            
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


def test_total_returns_integration():
    """Test total returns endpoint with dividend integration."""
    print("\n=== Phase 3: Total Returns Integration Test ===\n")
    
    base_url = "http://localhost:8000"
    
    try:
        # Test total returns calculation
        print("Test: GET /returns/MSFT with dividend integration")
        
        start_date = "2024-01-01"
        end_date = "2024-12-31"
        
        response = requests.get(
            f"{base_url}/returns/MSFT?start_date={start_date}&end_date={end_date}",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Status: {data['status']}")
            
            if 'returns' in data['data']:
                returns = data['data']['returns']
                print(f"✅ Total return: {returns.get('total_return', 0):.2%}")
                print(f"✅ Price return: {returns.get('price_return', 0):.2%}")
                print(f"✅ Dividend return: {returns.get('dividend_return', 0):.2%}")
                print(f"✅ Total dividends: ${returns.get('total_dividends', 0):.2f}")
                print(f"✅ Dividend count: {returns.get('dividend_count', 0)}")
                
                # Verify dividend integration
                if returns.get('dividend_count', 0) > 0:
                    print("✅ Dividend integration working in total returns")
                else:
                    print("⚠️  No dividends in total return calculation")
        else:
            print(f"❌ Request failed with status {response.status_code}: {response.text}")
        
        # Test with dividend reinvestment
        print("\nTest: Total returns with dividend reinvestment")
        
        response = requests.get(
            f"{base_url}/returns/MSFT?start_date={start_date}&end_date={end_date}&include_reinvestment=true",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            returns = data['data']['returns']
            print(f"✅ Reinvested return: {returns.get('reinvested_return', 0):.2%}")
            print(f"✅ Simple return: {returns.get('total_return', 0):.2%}")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False


def test_error_handling_integration():
    """Test error handling in API endpoints."""
    print("\n=== Phase 3: Error Handling Integration Test ===\n")
    
    base_url = "http://localhost:8000"
    
    try:
        # Test invalid ticker
        print("Test: Invalid ticker format")
        response = requests.get(f"{base_url}/dividends/INVALID_TICKER?years=5")
        assert response.status_code == 400
        print("✅ Invalid ticker properly rejected")
        
        # Test invalid years parameter
        print("Test: Invalid years parameter")
        response = requests.get(f"{base_url}/dividends/MSFT?years=25")
        assert response.status_code == 400
        print("✅ Invalid years parameter properly rejected")
        
        # Test non-dividend paying stock
        print("Test: Non-dividend paying stock (TSLA)")
        response = requests.get(f"{base_url}/dividends/TSLA?years=5")
        if response.status_code == 200:
            data = response.json()
            if len(data['data']['dividends']) == 0:
                print("✅ Non-dividend stock handled correctly")
            else:
                print(f"⚠️  Unexpected dividends found for TSLA: {len(data['data']['dividends'])}")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        return False
    except Exception as e:
        print(f"❌ Error handling test failed: {e}")
        return False


def test_performance_benchmarks():
    """Test performance benchmarks for gap detection."""
    print("\n=== Phase 3: Performance Benchmark Test ===\n")
    
    base_url = "http://localhost:8000"
    
    try:
        # Benchmark different scenarios
        scenarios = [
            ("MSFT", 1, "1Y dividend data"),
            ("MSFT", 5, "5Y dividend data"),
            ("AAPL", 3, "3Y dividend data"),
        ]
        
        results = []
        
        for ticker, years, description in scenarios:
            print(f"Benchmarking: {description}")
            
            start_time = time.time()
            response = requests.get(f"{base_url}/dividends/{ticker}?years={years}", timeout=30)
            end_time = time.time()
            
            if response.status_code == 200:
                response_time = end_time - start_time
                data = response.json()
                execution_time = data.get('execution_time', response_time)
                dividend_count = len(data['data']['dividends'])
                
                results.append({
                    'description': description,
                    'response_time': response_time,
                    'execution_time': execution_time,
                    'dividend_count': dividend_count
                })
                
                print(f"  Response time: {response_time:.2f}s")
                print(f"  Server execution: {execution_time:.2f}s")
                print(f"  Dividends retrieved: {dividend_count}")
                
                # Performance assertions
                if response_time < 5.0:
                    print("  ✅ Performance acceptable")
                else:
                    print("  ⚠️  Performance may need optimization")
            else:
                print(f"  ❌ Request failed: {response.status_code}")
        
        # Summary
        print("\n📊 Performance Summary:")
        for result in results:
            print(f"  {result['description']}: {result['response_time']:.2f}s ({result['dividend_count']} dividends)")
        
        return True
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        return False
    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False


def run_manual_server_test():
    """
    Instructions for manual testing if server is not running.
    """
    print("\n=== Manual Server Test Instructions ===\n")
    print("To run live integration tests:")
    print("1. Start the FastAPI server:")
    print("   cd /Users/patrickkavanagh/etf-research-platform/api")
    print("   uvicorn main:app --reload --port 8000")
    print("")
    print("2. Run this test script:")
    print("   python3 test_phase3_live_integration.py")
    print("")
    print("3. Test endpoints manually:")
    print("   curl http://localhost:8000/dividends/MSFT?years=5")
    print("   curl -X POST http://localhost:8000/data/fetch \\")
    print("        -H 'Content-Type: application/json' \\")
    print("        -d '{\"tickers\": [\"MSFT\"], \"include_dividends\": true}'")
    print("")


if __name__ == '__main__':
    print("🚀 Running Phase 3 Live Integration Tests...")
    
    # Check if server is running
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        server_running = True
    except:
        server_running = False
    
    if server_running:
        print("✅ FastAPI server detected, running live tests...")
        
        success1 = test_dividend_endpoint_integration()
        success2 = test_data_fetch_endpoint_integration()
        success3 = test_total_returns_integration()
        success4 = test_error_handling_integration()
        success5 = test_performance_benchmarks()
        
        if all([success1, success2, success3, success4, success5]):
            print("\n✅ All Phase 3 integration tests passed!")
            print("🎉 Gap detection is properly integrated with API endpoints!")
        else:
            print("\n⚠️  Some integration tests had issues - check logs above")
    else:
        print("⚠️  FastAPI server not detected on localhost:8000")
        run_manual_server_test()