#!/usr/bin/env python3
"""
Comprehensive testing suite for the ETF Research Platform caching system.
Tests all caching functionality, edge cases, and performance characteristics.
"""

import os
import sys
import time
import requests
import json
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List
import concurrent.futures
import asyncio

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

API_BASE = "http://localhost:8000"

class CachingTestSuite:
    """Comprehensive test suite for caching functionality."""
    
    def __init__(self):
        self.test_results = []
        self.api_base = API_BASE
        
    def log_test_result(self, test_name: str, passed: bool, details: str = "", execution_time: float = 0):
        """Log test result."""
        status = "✅ PASS" if passed else "❌ FAIL"
        result = {
            "test_name": test_name,
            "passed": passed,
            "details": details,
            "execution_time": execution_time,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        print(f"{status} {test_name} ({execution_time:.3f}s)")
        if details:
            print(f"    {details}")
    
    def test_api_health(self):
        """Test that API is responsive and caching-enabled."""
        start_time = time.time()
        try:
            response = requests.get(f"{self.api_base}/health", timeout=5)
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                self.log_test_result(
                    "API Health Check", 
                    True, 
                    f"API responding: {data.get('service', 'Unknown')}", 
                    execution_time
                )
                return True
            else:
                self.log_test_result(
                    "API Health Check", 
                    False, 
                    f"HTTP {response.status_code}", 
                    execution_time
                )
                return False
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("API Health Check", False, f"Error: {e}", execution_time)
            return False
    
    def test_data_sources_available(self):
        """Test that real data sources are available."""
        start_time = time.time()
        try:
            response = requests.get(f"{self.api_base}/data/health", timeout=10)
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                sources = data.get('sources', [])
                healthy_sources = data.get('healthy_sources', 0)
                total_sources = data.get('total_sources', 0)
                
                # Check for real sources (not sample data)
                real_sources = [s for s in sources if s['name'] in ['AlphaVantage', 'Tiingo']]
                
                if len(real_sources) >= 1 and healthy_sources >= 1:
                    source_names = [s['name'] for s in real_sources]
                    self.log_test_result(
                        "Real Data Sources", 
                        True, 
                        f"{healthy_sources}/{total_sources} sources healthy: {', '.join(source_names)}", 
                        execution_time
                    )
                    return True
                else:
                    self.log_test_result(
                        "Real Data Sources", 
                        False, 
                        f"Only sample data available", 
                        execution_time
                    )
                    return False
            else:
                self.log_test_result("Real Data Sources", False, f"HTTP {response.status_code}", execution_time)
                return False
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Real Data Sources", False, f"Error: {e}", execution_time)
            return False
    
    def test_single_ticker_fetch(self):
        """Test fetching data for a single ticker."""
        start_time = time.time()
        try:
            payload = {
                "tickers": ["AAPL"],
                "start_date": "2024-01-01",
                "end_date": "2024-01-10"
            }
            
            response = requests.post(
                f"{self.api_base}/data/fetch",
                json=payload,
                timeout=30
            )
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if (data.get('status') == 'success' and 
                    'AAPL' in data.get('data', {}) and
                    data.get('metadata', {}).get('successful_tickers', 0) > 0):
                    
                    aapl_data = data['data']['AAPL']
                    data_points = len(aapl_data.get('data', []))
                    source_used = data.get('data_sources_used', ['Unknown'])[0]
                    
                    self.log_test_result(
                        "Single Ticker Fetch", 
                        True, 
                        f"AAPL: {data_points} data points from {source_used}", 
                        execution_time
                    )
                    return data
                else:
                    self.log_test_result(
                        "Single Ticker Fetch", 
                        False, 
                        f"Invalid response structure", 
                        execution_time
                    )
                    return None
            else:
                self.log_test_result("Single Ticker Fetch", False, f"HTTP {response.status_code}", execution_time)
                return None
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Single Ticker Fetch", False, f"Error: {e}", execution_time)
            return None
    
    def test_multiple_tickers_fetch(self):
        """Test fetching data for multiple tickers."""
        start_time = time.time()
        try:
            payload = {
                "tickers": ["AAPL", "SPY", "QQQ"],
                "start_date": "2024-01-01", 
                "end_date": "2024-01-05"
            }
            
            response = requests.post(
                f"{self.api_base}/data/fetch",
                json=payload,
                timeout=60
            )
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                successful = data.get('metadata', {}).get('successful_tickers', 0)
                total = data.get('metadata', {}).get('total_tickers', 0)
                
                if successful == total and successful >= 2:
                    self.log_test_result(
                        "Multiple Tickers Fetch", 
                        True, 
                        f"{successful}/{total} tickers successful", 
                        execution_time
                    )
                    return data
                else:
                    self.log_test_result(
                        "Multiple Tickers Fetch", 
                        False, 
                        f"Only {successful}/{total} tickers successful", 
                        execution_time
                    )
                    return None
            else:
                self.log_test_result("Multiple Tickers Fetch", False, f"HTTP {response.status_code}", execution_time)
                return None
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Multiple Tickers Fetch", False, f"Error: {e}", execution_time)
            return None
    
    def test_cache_efficiency_repeat_request(self):
        """Test that repeated requests show caching benefits."""
        print("\n🔄 Testing cache efficiency with repeat requests...")
        
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-10"
        }
        
        # First request (should hit API or initialize cache)
        start_time = time.time()
        try:
            response1 = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
            first_time = time.time() - start_time
            
            if response1.status_code == 200:
                first_data = response1.json()
                
                # Wait a moment, then make identical request
                time.sleep(1)
                
                # Second request (should be faster due to caching)
                start_time = time.time()
                response2 = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
                second_time = time.time() - start_time
                
                if response2.status_code == 200:
                    second_data = response2.json()
                    
                    # Compare performance
                    speedup = first_time / second_time if second_time > 0 else 1
                    
                    # Check if cache stats are available in response
                    cache_info = ""
                    if 'AAPL' in second_data.get('data', {}):
                        aapl_cache = second_data['data']['AAPL'].get('cache_stats', {})
                        if aapl_cache:
                            cache_hit_rate = aapl_cache.get('cache_hit_rate', 0)
                            cache_info = f", Cache hit rate: {cache_hit_rate:.1%}"
                    
                    if speedup > 1.5 or second_time < first_time * 0.8:
                        self.log_test_result(
                            "Cache Efficiency (Repeat)", 
                            True, 
                            f"First: {first_time:.2f}s, Second: {second_time:.2f}s, Speedup: {speedup:.1f}x{cache_info}", 
                            second_time
                        )
                        return True
                    else:
                        self.log_test_result(
                            "Cache Efficiency (Repeat)", 
                            False, 
                            f"No significant speedup: {first_time:.2f}s vs {second_time:.2f}s", 
                            second_time
                        )
                        return False
                else:
                    self.log_test_result("Cache Efficiency (Repeat)", False, f"Second request failed: HTTP {response2.status_code}", second_time)
                    return False
            else:
                self.log_test_result("Cache Efficiency (Repeat)", False, f"First request failed: HTTP {response1.status_code}", first_time)
                return False
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Cache Efficiency (Repeat)", False, f"Error: {e}", execution_time)
            return False
    
    def test_date_range_extension(self):
        """Test caching behavior when extending date ranges."""
        print("\n📅 Testing date range extension caching...")
        
        # First request: Small range
        payload1 = {
            "tickers": ["SPY"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-05"
        }
        
        start_time = time.time()
        try:
            response1 = requests.post(f"{self.api_base}/data/fetch", json=payload1, timeout=30)
            first_time = time.time() - start_time
            
            if response1.status_code == 200:
                time.sleep(1)
                
                # Second request: Extended range (should partially use cache)
                payload2 = {
                    "tickers": ["SPY"],
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-15"  # Extended range
                }
                
                start_time = time.time()
                response2 = requests.post(f"{self.api_base}/data/fetch", json=payload2, timeout=30)
                second_time = time.time() - start_time
                
                if response2.status_code == 200:
                    data2 = response2.json()
                    spy_data = data2.get('data', {}).get('SPY', {})
                    data_points = len(spy_data.get('data', []))
                    
                    # Should be faster than fetching full range from scratch
                    self.log_test_result(
                        "Date Range Extension", 
                        True, 
                        f"Extended range fetched in {second_time:.2f}s, got {data_points} data points", 
                        second_time
                    )
                    return True
                else:
                    self.log_test_result("Date Range Extension", False, f"Extended request failed: HTTP {response2.status_code}", second_time)
                    return False
            else:
                self.log_test_result("Date Range Extension", False, f"Initial request failed: HTTP {response1.status_code}", first_time)
                return False
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Date Range Extension", False, f"Error: {e}", execution_time)
            return False
    
    def test_cache_endpoints(self):
        """Test cache monitoring endpoints."""
        print("\n📊 Testing cache monitoring endpoints...")
        
        tests = [
            ("/cache/dashboard", "Cache Dashboard"),
            ("/cache/stats/AAPL", "AAPL Cache Stats")
        ]
        
        all_passed = True
        
        for endpoint, test_name in tests:
            start_time = time.time()
            try:
                response = requests.get(f"{self.api_base}{endpoint}", timeout=10)
                execution_time = time.time() - start_time
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') in ['success', None]:  # Some endpoints may not have status field
                        self.log_test_result(test_name, True, "Endpoint responding correctly", execution_time)
                    else:
                        self.log_test_result(test_name, False, f"Unexpected status: {data.get('status')}", execution_time)
                        all_passed = False
                else:
                    self.log_test_result(test_name, False, f"HTTP {response.status_code}", execution_time)
                    all_passed = False
                    
            except Exception as e:
                execution_time = time.time() - start_time
                self.log_test_result(test_name, False, f"Error: {e}", execution_time)
                all_passed = False
        
        return all_passed
    
    def test_cache_optimization_endpoint(self):
        """Test cache optimization analysis endpoint."""
        start_time = time.time()
        try:
            payload = {
                "tickers": ["AAPL", "SPY"],
                "start_date": "2024-01-01",
                "end_date": "2024-01-31"
            }
            
            response = requests.post(f"{self.api_base}/cache/optimize", json=payload, timeout=10)
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                if data.get('status') == 'success' and 'optimizations' in data:
                    optimizations = data['optimizations']
                    analyzed_tickers = len(optimizations)
                    self.log_test_result(
                        "Cache Optimization Analysis", 
                        True, 
                        f"Analyzed {analyzed_tickers} tickers for optimization", 
                        execution_time
                    )
                    return True
                else:
                    self.log_test_result(
                        "Cache Optimization Analysis", 
                        False, 
                        "Invalid response format", 
                        execution_time
                    )
                    return False
            else:
                self.log_test_result("Cache Optimization Analysis", False, f"HTTP {response.status_code}", execution_time)
                return False
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Cache Optimization Analysis", False, f"Error: {e}", execution_time)
            return False
    
    def test_concurrent_requests(self):
        """Test behavior under concurrent load."""
        print("\n🔀 Testing concurrent request handling...")
        
        def make_request(ticker):
            """Make a single request for testing concurrency."""
            try:
                payload = {
                    "tickers": [ticker],
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-05"
                }
                response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
                return response.status_code == 200, response.json() if response.status_code == 200 else None
            except Exception as e:
                return False, str(e)
        
        start_time = time.time()
        tickers = ["AAPL", "SPY", "QQQ", "VTI", "MSFT"]
        
        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = [executor.submit(make_request, ticker) for ticker in tickers]
                results = [future.result() for future in concurrent.futures.as_completed(futures)]
            
            execution_time = time.time() - start_time
            
            successful = sum(1 for success, _ in results if success)
            total = len(results)
            
            if successful >= total * 0.8:  # At least 80% success rate
                self.log_test_result(
                    "Concurrent Requests", 
                    True, 
                    f"{successful}/{total} requests successful in parallel", 
                    execution_time
                )
                return True
            else:
                self.log_test_result(
                    "Concurrent Requests", 
                    False, 
                    f"Only {successful}/{total} requests successful", 
                    execution_time
                )
                return False
                
        except Exception as e:
            execution_time = time.time() - start_time
            self.log_test_result("Concurrent Requests", False, f"Error: {e}", execution_time)
            return False
    
    def test_error_handling(self):
        """Test error handling for invalid requests."""
        print("\n🚨 Testing error handling...")
        
        error_tests = [
            ({"tickers": [], "start_date": "2024-01-01"}, "Empty tickers list"),
            ({"tickers": ["INVALID_TICKER_SYMBOL_123"], "start_date": "2024-01-01", "end_date": "2024-01-02"}, "Invalid ticker"),
            ({"tickers": ["AAPL"], "start_date": "invalid-date"}, "Invalid date format"),
            ({"tickers": ["AAPL"], "start_date": "2024-01-01", "end_date": "2023-01-01"}, "End date before start date")
        ]
        
        all_passed = True
        
        for payload, description in error_tests:
            start_time = time.time()
            try:
                response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=10)
                execution_time = time.time() - start_time
                
                # Should either handle gracefully (200 with error info) or return appropriate error code
                if response.status_code in [200, 400, 422]:
                    if response.status_code == 200:
                        data = response.json()
                        # Check if error was handled gracefully
                        if (data.get('metadata', {}).get('failed_tickers', 0) > 0 or 
                            data.get('metadata', {}).get('successful_tickers', 0) == 0):
                            self.log_test_result(f"Error Handling: {description}", True, "Graceful error handling", execution_time)
                        else:
                            self.log_test_result(f"Error Handling: {description}", False, "Should have failed but didn't", execution_time)
                            all_passed = False
                    else:
                        self.log_test_result(f"Error Handling: {description}", True, f"Proper error response: HTTP {response.status_code}", execution_time)
                else:
                    self.log_test_result(f"Error Handling: {description}", False, f"Unexpected HTTP {response.status_code}", execution_time)
                    all_passed = False
                    
            except Exception as e:
                execution_time = time.time() - start_time
                self.log_test_result(f"Error Handling: {description}", False, f"Exception: {e}", execution_time)
                all_passed = False
        
        return all_passed
    
    def run_all_tests(self):
        """Run all tests and generate comprehensive report."""
        print("🧪 ETF Research Platform - Comprehensive Caching Tests")
        print("=" * 70)
        
        # Core functionality tests
        api_ok = self.test_api_health()
        if not api_ok:
            print("❌ API not available - stopping tests")
            return self.generate_report()
        
        sources_ok = self.test_data_sources_available()
        
        # Data fetching tests
        self.test_single_ticker_fetch()
        self.test_multiple_tickers_fetch()
        
        # Caching efficiency tests
        self.test_cache_efficiency_repeat_request()
        self.test_date_range_extension()
        
        # Cache monitoring tests
        self.test_cache_endpoints()
        self.test_cache_optimization_endpoint()
        
        # Stress and error tests
        self.test_concurrent_requests()
        self.test_error_handling()
        
        return self.generate_report()
    
    def generate_report(self):
        """Generate comprehensive test report."""
        print("\n" + "=" * 70)
        print("📊 TEST REPORT SUMMARY")
        print("=" * 70)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['passed'])
        failed_tests = total_tests - passed_tests
        
        success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
        total_time = sum(result['execution_time'] for result in self.test_results)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {success_rate:.1f}%")
        print(f"Total Execution Time: {total_time:.2f}s")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result['passed']:
                    print(f"  • {result['test_name']}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result['passed']:
                print(f"  • {result['test_name']} ({result['execution_time']:.3f}s)")
        
        # Overall assessment
        if success_rate >= 90:
            print(f"\n🎉 EXCELLENT: Caching system is working very well!")
        elif success_rate >= 75:
            print(f"\n✅ GOOD: Caching system is working with minor issues")
        elif success_rate >= 50:
            print(f"\n⚠️ PARTIAL: Caching system has significant issues")
        else:
            print(f"\n❌ CRITICAL: Caching system has major problems")
        
        return {
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'success_rate': success_rate,
            'total_time': total_time,
            'results': self.test_results
        }


if __name__ == "__main__":
    # Check if API is running
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ API not responding at {API_BASE}")
            print("   Please make sure the API is running with: python3 api/main.py")
            sys.exit(1)
    except:
        print(f"❌ Cannot connect to API at {API_BASE}")
        print("   Please make sure the API is running with: python3 api/main.py")
        sys.exit(1)
    
    # Run comprehensive tests
    test_suite = CachingTestSuite()
    report = test_suite.run_all_tests()
    
    # Save detailed report
    with open('caching_test_report.json', 'w') as f:
        json.dump(report, f, indent=2, default=str)
    
    print(f"\n💾 Detailed report saved to: caching_test_report.json")
    print("=" * 70)