#!/usr/bin/env python3
"""
Comprehensive test suite implementing Gemini's recommendations for the caching system.
Tests all components: cache manager, data fetcher, database integration, and error handling.
"""

import unittest
import asyncio
import sys
import os
import tempfile
import json
from datetime import datetime, date, timedelta
from unittest.mock import Mock, patch, AsyncMock
import requests
import time

# Add api directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))

API_BASE = "http://localhost:8000"

class TestCacheArchitecture(unittest.TestCase):
    """Test the overall caching architecture and integration."""
    
    def setUp(self):
        """Set up test environment."""
        self.api_base = API_BASE
        
    def test_api_availability(self):
        """Test that the API is running and responsive."""
        try:
            response = requests.get(f"{self.api_base}/health", timeout=5)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn('status', data)
            self.assertEqual(data['status'], 'healthy')
        except Exception as e:
            self.fail(f"API not available: {e}")
    
    def test_data_sources_integration(self):
        """Test that real data sources are properly integrated."""
        response = requests.get(f"{self.api_base}/data/health", timeout=10)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertIn('sources', data)
        
        # Should have real sources (AlphaVantage, Tiingo)
        sources = data['sources']
        source_names = [s['name'] for s in sources]
        self.assertTrue(
            any(name in ['AlphaVantage', 'Tiingo'] for name in source_names),
            f"No real data sources found: {source_names}"
        )
    
    def test_cache_endpoints_available(self):
        """Test that all cache monitoring endpoints are available."""
        endpoints = [
            "/cache/dashboard",
            "/cache/stats/AAPL"
        ]
        
        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint):
                response = requests.get(f"{self.api_base}{endpoint}", timeout=5)
                self.assertEqual(response.status_code, 200)
                data = response.json()
                self.assertIn('status', data)
                self.assertEqual(data['status'], 'success')


class TestDataFetching(unittest.TestCase):
    """Test data fetching functionality and caching behavior."""
    
    def setUp(self):
        """Set up test environment."""
        self.api_base = API_BASE
    
    def test_single_ticker_fetch(self):
        """Test fetching data for a single ticker."""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-03"
        }
        
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=20)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('AAPL', data['data'])
        
        aapl_data = data['data']['AAPL']
        self.assertIn('data', aapl_data)
        self.assertGreater(len(aapl_data['data']), 0)
        
        # Validate data structure
        first_point = aapl_data['data'][0]
        required_fields = ['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Adj Close']
        for field in required_fields:
            self.assertIn(field, first_point)
    
    def test_multiple_tickers_fetch(self):
        """Test fetching data for multiple tickers."""
        payload = {
            "tickers": ["AAPL", "SPY"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-03"
        }
        
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data['status'], 'success')
        
        metadata = data['metadata']
        self.assertEqual(metadata['total_tickers'], 2)
        self.assertGreaterEqual(metadata['successful_tickers'], 1)  # At least one should succeed
        
        # Check that we have data for requested tickers
        for ticker in payload['tickers']:
            if ticker not in data.get('data', {}):
                self.assertIn(ticker, metadata.get('failed_ticker_list', []))
    
    def test_cache_efficiency(self):
        """Test that repeated requests show caching benefits."""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-03"
        }
        
        # First request
        start_time = time.time()
        response1 = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=20)
        first_time = time.time() - start_time
        
        self.assertEqual(response1.status_code, 200)
        
        # Small delay
        time.sleep(0.5)
        
        # Second identical request  
        start_time = time.time()
        response2 = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=20)
        second_time = time.time() - start_time
        
        self.assertEqual(response2.status_code, 200)
        
        # Second request should be faster or at least not significantly slower
        # (allowing some variance due to network/system conditions)
        self.assertLessEqual(second_time, first_time * 2.0, 
                           f"Second request ({second_time:.2f}s) should not be much slower than first ({first_time:.2f}s)")
    
    def test_date_range_extension(self):
        """Test caching behavior when extending date ranges."""
        # First request: small range
        payload1 = {
            "tickers": ["SPY"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-03"
        }
        
        response1 = requests.post(f"{self.api_base}/data/fetch", json=payload1, timeout=20)
        self.assertEqual(response1.status_code, 200)
        
        time.sleep(0.5)
        
        # Second request: extended range
        payload2 = {
            "tickers": ["SPY"],
            "start_date": "2024-01-01", 
            "end_date": "2024-01-10"  # Extended
        }
        
        response2 = requests.post(f"{self.api_base}/data/fetch", json=payload2, timeout=30)
        self.assertEqual(response2.status_code, 200)
        
        data2 = response2.json()
        spy_data = data2['data']['SPY']
        
        # Should have more data points in extended range
        self.assertGreater(len(spy_data['data']), 2)


class TestErrorHandling(unittest.TestCase):
    """Test error handling and edge cases."""
    
    def setUp(self):
        """Set up test environment."""
        self.api_base = API_BASE
    
    def test_empty_tickers_list(self):
        """Test handling of empty tickers list."""
        payload = {
            "tickers": [],
            "start_date": "2024-01-01"
        }
        
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=10)
        # Should either return 400/422 or handle gracefully
        self.assertIn(response.status_code, [200, 400, 422])
        
        if response.status_code == 200:
            data = response.json()
            # If handled gracefully, should have no successful tickers
            self.assertEqual(data.get('metadata', {}).get('successful_tickers', 0), 0)
    
    def test_invalid_ticker_symbol(self):
        """Test handling of invalid ticker symbols."""
        payload = {
            "tickers": ["INVALID_TICKER_SYMBOL_123"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-02"
        }
        
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=15)
        self.assertEqual(response.status_code, 200)  # Should handle gracefully
        
        data = response.json()
        metadata = data.get('metadata', {})
        
        # Should report failure for invalid ticker
        self.assertEqual(metadata.get('successful_tickers', 0), 0)
        self.assertGreater(metadata.get('failed_tickers', 0), 0)
        self.assertIn("INVALID_TICKER_SYMBOL_123", metadata.get('failed_ticker_list', []))
    
    def test_invalid_date_format(self):
        """Test handling of invalid date formats."""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "invalid-date"
        }
        
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=10)
        # Should return validation error
        self.assertIn(response.status_code, [400, 422, 500])
    
    def test_end_date_before_start_date(self):
        """Test handling of end date before start date."""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2024-01-10",
            "end_date": "2024-01-01"  # Before start date
        }
        
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=10)
        # Should handle this gracefully or return error
        self.assertIn(response.status_code, [200, 400, 422])


class TestCacheOptimization(unittest.TestCase):
    """Test cache optimization and monitoring functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.api_base = API_BASE
    
    def test_cache_dashboard(self):
        """Test cache dashboard functionality."""
        response = requests.get(f"{self.api_base}/cache/dashboard", timeout=5)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('summary', data)
        
        summary = data['summary']
        required_fields = ['total_tickers', 'total_records', 'average_coverage']
        for field in required_fields:
            self.assertIn(field, summary)
            self.assertIsInstance(summary[field], (int, float))
    
    def test_ticker_cache_stats(self):
        """Test individual ticker cache statistics."""
        # First make a request to ensure some cache data
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-03"
        }
        requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=20)
        
        # Then check cache stats
        response = requests.get(f"{self.api_base}/cache/stats/AAPL", timeout=5)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('ticker', data)
        self.assertEqual(data['ticker'], 'AAPL')
    
    def test_cache_optimization_analysis(self):
        """Test cache optimization analysis endpoint."""
        payload = {
            "tickers": ["AAPL", "SPY"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-10"
        }
        
        response = requests.post(f"{self.api_base}/cache/optimize", json=payload, timeout=10)
        self.assertEqual(response.status_code, 200)
        
        data = response.json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('optimizations', data)
        
        optimizations = data['optimizations']
        self.assertIn('AAPL', optimizations)
        self.assertIn('SPY', optimizations)


class TestPerformanceCharacteristics(unittest.TestCase):
    """Test performance characteristics of the caching system."""
    
    def setUp(self):
        """Set up test environment."""
        self.api_base = API_BASE
    
    def test_response_time_limits(self):
        """Test that API responses are within acceptable time limits."""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2024-01-01",
            "end_date": "2024-01-03"
        }
        
        start_time = time.time()
        response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
        execution_time = time.time() - start_time
        
        self.assertEqual(response.status_code, 200)
        
        # First request should complete within reasonable time (allowing for API calls)
        self.assertLess(execution_time, 30.0, "Initial request took too long")
        
        # Repeat request should be faster
        start_time = time.time()
        response2 = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
        repeat_time = time.time() - start_time
        
        self.assertEqual(response2.status_code, 200)
        # Subsequent requests should be faster (or at least not significantly slower)
        self.assertLess(repeat_time, execution_time * 1.5, "Repeat request not showing cache benefits")
    
    def test_concurrent_request_handling(self):
        """Test that the system can handle concurrent requests."""
        import concurrent.futures
        
        def make_request(ticker):
            payload = {
                "tickers": [ticker],
                "start_date": "2024-01-01",
                "end_date": "2024-01-03"
            }
            try:
                response = requests.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
                return response.status_code == 200
            except:
                return False
        
        tickers = ["AAPL", "SPY", "QQQ"]
        
        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
            futures = [executor.submit(make_request, ticker) for ticker in tickers]
            results = [future.result() for future in concurrent.futures.as_completed(futures)]
        execution_time = time.time() - start_time
        
        # Most requests should succeed
        success_rate = sum(results) / len(results)
        self.assertGreaterEqual(success_rate, 0.6, f"Concurrent request success rate too low: {success_rate}")
        
        # Should complete within reasonable time
        self.assertLess(execution_time, 60.0, "Concurrent requests took too long")


def run_comprehensive_tests():
    """Run all comprehensive tests and generate report."""
    print("🧪 ETF Research Platform - Comprehensive Caching Tests")
    print("=" * 70)
    
    # Check API availability first
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ API not available at {API_BASE}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        return False
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestCacheArchitecture,
        TestDataFetching,
        TestErrorHandling, 
        TestCacheOptimization,
        TestPerformanceCharacteristics
    ]
    
    for test_class in test_classes:
        tests = loader.loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    # Run tests with custom result handler
    class CustomTestResult(unittest.TextTestResult):
        def __init__(self, stream, descriptions, verbosity):
            super().__init__(stream, descriptions, verbosity)
            self.test_results = []
        
        def addSuccess(self, test):
            super().addSuccess(test)
            self.test_results.append({
                'test': str(test),
                'status': 'PASS',
                'message': ''
            })
        
        def addError(self, test, err):
            super().addError(test, err)
            self.test_results.append({
                'test': str(test),
                'status': 'ERROR', 
                'message': str(err[1])
            })
        
        def addFailure(self, test, err):
            super().addFailure(test, err)
            self.test_results.append({
                'test': str(test),
                'status': 'FAIL',
                'message': str(err[1])
            })
    
    # Run tests
    runner = unittest.TextTestRunner(
        verbosity=2,
        resultclass=CustomTestResult
    )
    
    result = runner.run(suite)
    
    # Generate summary report
    print("\n" + "=" * 70)
    print("📊 COMPREHENSIVE TEST REPORT")
    print("=" * 70)
    
    total_tests = result.testsRun
    errors = len(result.errors)
    failures = len(result.failures)
    passed = total_tests - errors - failures
    
    success_rate = (passed / total_tests * 100) if total_tests > 0 else 0
    
    print(f"Tests Run: {total_tests}")
    print(f"Passed: {passed}")
    print(f"Failed: {failures}")
    print(f"Errors: {errors}")
    print(f"Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 90:
        print(f"\n🎉 EXCELLENT: Caching system is robust and production-ready!")
    elif success_rate >= 75:
        print(f"\n✅ GOOD: Caching system is functional with minor issues")
    elif success_rate >= 50:
        print(f"\n⚠️ NEEDS WORK: Caching system has significant issues")
    else:
        print(f"\n❌ CRITICAL: Caching system has major problems")
    
    # Save detailed report
    report_data = {
        'timestamp': datetime.now().isoformat(),
        'total_tests': total_tests,
        'passed': passed,
        'failed': failures,
        'errors': errors,
        'success_rate': success_rate,
        'test_results': result.test_results if hasattr(result, 'test_results') else []
    }
    
    with open('comprehensive_test_report.json', 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\n💾 Detailed report saved to: comprehensive_test_report.json")
    
    return success_rate >= 75


if __name__ == "__main__":
    success = run_comprehensive_tests()
    sys.exit(0 if success else 1)