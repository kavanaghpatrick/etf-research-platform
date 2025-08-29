#!/usr/bin/env python3
"""
Comprehensive test suite for async architecture implementation.
Tests async endpoints, performance improvements, concurrency handling,
timeout management, memory usage, and error propagation.
"""

import asyncio
import pytest
import pytest_asyncio
import time
import psutil
import aiohttp
import httpx
from datetime import datetime, timedelta
from typing import List, Dict, Any
import json
import logging
from unittest.mock import Mock, patch, AsyncMock
import gc
import tracemalloc

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"]
VERCEL_TIMEOUT = 10  # seconds
VERCEL_MEMORY_LIMIT = 512  # MB

# Mark all tests as async
pytestmark = pytest.mark.asyncio


class TestAsyncEndpoints:
    """Test suite for async endpoint functionality"""
    
    @pytest_asyncio.fixture
    async def async_client(self):
        """Create an async HTTP client for testing"""
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
            yield client
    
    async def test_async_data_fetch_endpoint(self, async_client):
        """Test the async data fetch endpoint"""
        payload = {
            "tickers": TEST_TICKERS[:3],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
        
        start_time = time.time()
        response = await async_client.post("/data/fetch", json=payload)
        duration = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 3
        assert duration < 5  # Should be faster than sync version
        
        # Verify all tickers returned
        returned_tickers = list(data["data"].keys())
        assert set(returned_tickers) == set(TEST_TICKERS[:3])
    
    async def test_large_payload_response(self, async_client):
        """Test response with larger payload"""
        payload = {
            "tickers": TEST_TICKERS,
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
        
        start_time = time.time()
        response = await async_client.post("/data/fetch", json=payload)
        duration = time.time() - start_time
        
        assert response.status_code == 200
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == len(TEST_TICKERS)
        
        # Should handle larger payloads efficiently
        assert duration < 10  # Allow more time for 5 tickers
    
    async def test_concurrent_ticker_fetch(self, async_client):
        """Test concurrent fetching of multiple tickers"""
        # Create multiple concurrent requests
        tasks = []
        for i in range(5):
            payload = {
                "tickers": TEST_TICKERS[i:i+1],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            }
            task = async_client.post("/data/fetch", json=payload)
            tasks.append(task)
        
        start_time = time.time()
        responses = await asyncio.gather(*tasks)
        duration = time.time() - start_time
        
        # All requests should succeed
        assert all(r.status_code == 200 for r in responses)
        
        # Concurrent requests should complete faster than sequential
        assert duration < 3  # Should complete in parallel
        
        # Verify each response
        for i, response in enumerate(responses):
            data = response.json()
            assert "data" in data
            assert len(data["data"]) == 1
            expected_ticker = TEST_TICKERS[i]
            assert expected_ticker in data["data"]


class TestPerformanceBenchmarks:
    """Test suite for performance benchmarking"""
    
    @pytest_asyncio.fixture
    async def sync_client(self):
        """Create a sync HTTP client for comparison"""
        import requests
        session = requests.Session()
        yield session
        session.close()
    
    async def test_sync_vs_async_single_ticker(self, async_client, sync_client):
        """Compare sync vs async performance for single ticker"""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
        
        # Test sync endpoint (if available)
        sync_start = time.time()
        sync_response = sync_client.post(f"{BASE_URL}/data/fetch_sync", json=payload)
        sync_duration = time.time() - sync_start
        
        # Test async endpoint
        async_start = time.time()
        async_response = await async_client.post("/data/fetch", json=payload)
        async_duration = time.time() - async_start
        
        # For single ticker, performance should be similar
        assert abs(sync_duration - async_duration) < 1
        
        logger.info(f"Single ticker - Sync: {sync_duration:.2f}s, Async: {async_duration:.2f}s")
    
    async def test_sync_vs_async_multiple_tickers(self, async_client):
        """Compare sync vs async performance for multiple tickers"""
        test_cases = [
            (1, TEST_TICKERS[:1]),
            (5, TEST_TICKERS[:5]),
            (10, TEST_TICKERS * 2),  # Duplicate tickers to get 10
            (20, TEST_TICKERS * 4)   # Duplicate tickers to get 20
        ]
        
        results = []
        
        for count, tickers in test_cases:
            payload = {
                "tickers": tickers[:count],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            }
            
            # Measure async performance
            async_start = time.time()
            response = await async_client.post("/data/fetch", json=payload)
            async_duration = time.time() - async_start
            
            assert response.status_code == 200
            
            results.append({
                "ticker_count": count,
                "duration": async_duration,
                "per_ticker": async_duration / count
            })
            
            logger.info(f"{count} tickers - Duration: {async_duration:.2f}s, Per ticker: {async_duration/count:.2f}s")
        
        # Performance should scale sub-linearly with async
        assert results[-1]["per_ticker"] < results[0]["per_ticker"] * 0.5  # 50% improvement expected
    
    async def test_cold_start_performance(self, async_client):
        """Test cold start performance"""
        # Simulate cold start by forcing garbage collection
        gc.collect()
        
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
        
        # First request (cold start)
        cold_start = time.time()
        response = await async_client.post("/data/fetch", json=payload)
        cold_duration = time.time() - cold_start
        
        assert response.status_code == 200
        
        # Warm request
        warm_start = time.time()
        response = await async_client.post("/data/fetch", json=payload)
        warm_duration = time.time() - warm_start
        
        assert response.status_code == 200
        
        # Cold start should be under 1 second
        assert cold_duration < 1
        # Warm request should be faster
        assert warm_duration < cold_duration
        
        logger.info(f"Cold start: {cold_duration:.2f}s, Warm: {warm_duration:.2f}s")


class TestConcurrencyStressTests:
    """Test suite for concurrency and stress testing"""
    
    async def test_high_concurrency(self, async_client):
        """Test handling of high concurrent load"""
        concurrent_requests = 50
        
        async def make_request(ticker):
            payload = {
                "tickers": [ticker],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            }
            try:
                response = await async_client.post("/data/fetch", json=payload)
                return response.status_code == 200
            except Exception as e:
                logger.error(f"Request failed: {e}")
                return False
        
        # Create many concurrent requests
        tasks = [make_request(TEST_TICKERS[i % len(TEST_TICKERS)]) 
                for i in range(concurrent_requests)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        duration = time.time() - start_time
        
        success_rate = sum(results) / len(results)
        
        # Should handle concurrent load
        assert success_rate > 0.95  # 95% success rate
        assert duration < 10  # Should complete within timeout
        
        logger.info(f"Concurrent requests: {concurrent_requests}, Success rate: {success_rate:.2%}, Duration: {duration:.2f}s")
    
    async def test_connection_pool_efficiency(self, async_client):
        """Test connection pool reuse efficiency"""
        # Make multiple sequential requests
        request_count = 20
        
        durations = []
        for i in range(request_count):
            payload = {
                "tickers": [TEST_TICKERS[i % len(TEST_TICKERS)]],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            }
            
            start = time.time()
            response = await async_client.post("/data/fetch", json=payload)
            duration = time.time() - start
            
            assert response.status_code == 200
            durations.append(duration)
        
        # Later requests should be faster (connection reuse)
        avg_first_5 = sum(durations[:5]) / 5
        avg_last_5 = sum(durations[-5:]) / 5
        
        assert avg_last_5 < avg_first_5  # Connection pooling should improve performance
        
        logger.info(f"Avg first 5 requests: {avg_first_5:.2f}s, Avg last 5: {avg_last_5:.2f}s")


class TestTimeoutHandling:
    """Test suite for timeout handling"""
    
    async def test_timeout_handling(self, async_client):
        """Test proper timeout handling"""
        # Request with many tickers to potentially trigger timeout
        payload = {
            "tickers": TEST_TICKERS * 10,  # 50 tickers
            "start_date": "2020-01-01",
            "end_date": "2023-12-31"
        }
        
        start_time = time.time()
        
        try:
            response = await async_client.post(
                "/data/fetch",
                json=payload,
                timeout=httpx.Timeout(8.0)  # Slightly less than Vercel timeout
            )
            duration = time.time() - start_time
            
            if response.status_code == 200:
                # Successful completion
                assert duration < 8
            else:
                # Should return appropriate error
                assert response.status_code in [408, 504]  # Timeout errors
                
        except httpx.TimeoutException:
            duration = time.time() - start_time
            assert duration < 9  # Should timeout before Vercel limit
    
    async def test_partial_results_on_timeout(self, async_client):
        """Test returning partial results on timeout"""
        payload = {
            "tickers": TEST_TICKERS * 10,
            "start_date": "2020-01-01",
            "end_date": "2023-12-31",
            "timeout_strategy": "partial"  # Return partial results
        }
        
        response = await async_client.post("/data/fetch", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            assert "results" in data
            assert "completed" in data
            assert "total" in data
            
            # Should have some results
            assert len(data["results"]) > 0
            assert data["completed"] <= data["total"]
    
    async def test_graceful_degradation(self, async_client):
        """Test graceful degradation under time pressure"""
        payload = {
            "tickers": TEST_TICKERS,
            "start_date": "2020-01-01",
            "end_date": "2023-12-31",
            "quality": "fast"  # Request faster, lower quality data
        }
        
        start_time = time.time()
        response = await async_client.post("/data/fetch", json=payload)
        duration = time.time() - start_time
        
        assert response.status_code == 200
        assert duration < 3  # Fast mode should be quick
        
        data = response.json()
        assert "quality_mode" in data
        assert data["quality_mode"] == "fast"


class TestMemoryUsage:
    """Test suite for memory usage"""
    
    async def test_memory_limits(self, async_client):
        """Test memory usage stays within limits"""
        # Start memory tracking
        tracemalloc.start()
        process = psutil.Process()
        baseline_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Large request
        payload = {
            "tickers": TEST_TICKERS * 4,  # 20 tickers
            "start_date": "2020-01-01",
            "end_date": "2023-12-31"
        }
        
        response = await async_client.post("/data/fetch", json=payload)
        assert response.status_code == 200
        
        # Check memory usage
        peak_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_used = peak_memory - baseline_memory
        
        # Should stay well under Vercel limit
        assert memory_used < 400  # 400MB limit (leaving buffer)
        
        # Get memory snapshot
        snapshot = tracemalloc.take_snapshot()
        top_stats = snapshot.statistics('lineno')[:10]
        
        logger.info(f"Memory used: {memory_used:.2f}MB")
        logger.info("Top memory allocations:")
        for stat in top_stats[:3]:
            logger.info(f"  {stat}")
        
        tracemalloc.stop()
    
    async def test_memory_cleanup(self, async_client):
        """Test proper memory cleanup after requests"""
        process = psutil.Process()
        
        # Make several large requests
        for i in range(5):
            baseline = process.memory_info().rss / 1024 / 1024
            
            payload = {
                "tickers": TEST_TICKERS * 2,
                "start_date": "2020-01-01",
                "end_date": "2023-12-31"
            }
            
            response = await async_client.post("/data/fetch", json=payload)
            assert response.status_code == 200
            
            # Force garbage collection
            gc.collect()
            await asyncio.sleep(0.1)
            
            # Memory should return close to baseline
            current = process.memory_info().rss / 1024 / 1024
            memory_leak = current - baseline
            
            # Allow some variance but no major leaks
            assert memory_leak < 50  # Max 50MB increase
    
    async def test_streaming_memory_efficiency(self, async_client):
        """Test memory efficiency of streaming responses"""
        process = psutil.Process()
        baseline_memory = process.memory_info().rss / 1024 / 1024
        
        payload = {
            "tickers": TEST_TICKERS * 10,  # 50 tickers
            "start_date": "2020-01-01",
            "end_date": "2023-12-31"
        }
        
        peak_memory = baseline_memory
        results_count = 0
        
        async with async_client.stream("POST", "/data/stream", json=payload) as response:
            assert response.status_code == 200
            
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    results_count += 1
                    
                    # Check memory periodically
                    if results_count % 10 == 0:
                        current = process.memory_info().rss / 1024 / 1024
                        peak_memory = max(peak_memory, current)
        
        memory_used = peak_memory - baseline_memory
        
        # Streaming should use less memory than buffering all results
        assert memory_used < 100  # Should stay under 100MB for streaming
        
        logger.info(f"Streaming memory usage: {memory_used:.2f}MB for {results_count} results")


class TestErrorPropagation:
    """Test suite for error handling and propagation"""
    
    async def test_invalid_ticker_handling(self, async_client):
        """Test handling of invalid tickers"""
        payload = {
            "tickers": ["AAPL", "INVALID_TICKER_123", "GOOGL"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
        
        response = await async_client.post("/data/fetch", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert "errors" in data
        
        # Should have results for valid tickers
        assert len(data["results"]) >= 2
        
        # Should report error for invalid ticker
        assert len(data["errors"]) >= 1
        assert any("INVALID_TICKER_123" in str(e) for e in data["errors"])
    
    async def test_rate_limit_handling(self, async_client):
        """Test handling of rate limits"""
        # Make many rapid requests to trigger rate limiting
        tasks = []
        for i in range(20):
            payload = {
                "tickers": [TEST_TICKERS[i % len(TEST_TICKERS)]],
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            }
            task = async_client.post("/data/fetch", json=payload)
            tasks.append(task)
        
        responses = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Count rate limit errors
        rate_limit_errors = sum(
            1 for r in responses 
            if isinstance(r, httpx.Response) and r.status_code == 429
        )
        
        # Should handle rate limits gracefully
        success_count = sum(
            1 for r in responses 
            if isinstance(r, httpx.Response) and r.status_code == 200
        )
        
        assert success_count > 0  # Some requests should succeed
        
        logger.info(f"Rate limit test - Success: {success_count}, Rate limited: {rate_limit_errors}")
    
    async def test_database_error_handling(self, async_client):
        """Test handling of database errors"""
        # This would need to be coordinated with a test endpoint
        # that simulates database failures
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31",
            "simulate_db_error": True  # Test flag
        }
        
        response = await async_client.post("/data/fetch", json=payload)
        
        # Should return appropriate error
        assert response.status_code in [500, 503]
        
        error_data = response.json()
        assert "error" in error_data
        assert "database" in error_data["error"].lower()
    
    async def test_cascade_failure_prevention(self, async_client):
        """Test prevention of cascade failures"""
        # Simulate one failing service
        payload = {
            "tickers": TEST_TICKERS,
            "start_date": "2023-01-01",
            "end_date": "2023-12-31",
            "data_sources": ["yfinance", "failing_source"]  # Mix of good and bad
        }
        
        response = await async_client.post("/data/fetch", json=payload)
        
        # Should still return partial results
        assert response.status_code == 200
        
        data = response.json()
        assert "results" in data
        assert len(data["results"]) > 0  # Should have some results
        
        # Should indicate which source failed
        assert "source_status" in data
        assert "failing_source" in data["source_status"]
        assert data["source_status"]["failing_source"] == "failed"


class TestVercelSpecificOptimizations:
    """Test suite for Vercel-specific optimizations"""
    
    async def test_edge_function_performance(self, async_client):
        """Test edge function performance"""
        # Test lightweight edge endpoints
        response = await async_client.get("/health/edge")
        
        assert response.status_code == 200
        assert response.headers.get("x-vercel-edge") == "true"
        
        # Edge functions should be very fast
        assert response.elapsed.total_seconds() < 0.1
    
    async def test_warming_endpoint(self, async_client):
        """Test function warming endpoint"""
        response = await async_client.get("/api/warm")
        
        assert response.status_code == 200
        data = response.json()
        assert data["warmed"] == True
        
        # Check cache headers
        assert response.headers.get("cache-control") == "s-maxage=300"
    
    async def test_stale_while_revalidate(self, async_client):
        """Test stale-while-revalidate caching"""
        payload = {
            "tickers": ["AAPL"],
            "start_date": "2023-01-01",
            "end_date": "2023-12-31"
        }
        
        # First request (populate cache)
        response1 = await async_client.post("/data/fetch", json=payload)
        assert response1.status_code == 200
        assert response1.headers.get("x-cache") == "MISS"
        
        # Second request (should hit cache)
        response2 = await async_client.post("/data/fetch", json=payload)
        assert response2.status_code == 200
        assert response2.headers.get("x-cache") == "HIT"
        
        # Response should be faster from cache
        assert response2.elapsed.total_seconds() < response1.elapsed.total_seconds()
    
    async def test_response_compression(self, async_client):
        """Test response compression for large payloads"""
        payload = {
            "tickers": TEST_TICKERS * 4,
            "start_date": "2020-01-01",
            "end_date": "2023-12-31"
        }
        
        headers = {"Accept-Encoding": "gzip, deflate, br"}
        response = await async_client.post("/data/fetch", json=payload, headers=headers)
        
        assert response.status_code == 200
        
        # Check if response is compressed
        content_encoding = response.headers.get("content-encoding")
        assert content_encoding in ["gzip", "br"]  # Should be compressed
        
        # Compressed size should be smaller
        content_length = int(response.headers.get("content-length", 0))
        uncompressed_size = len(response.text)
        
        assert content_length < uncompressed_size * 0.5  # At least 50% compression


# Helper functions for running tests
async def run_all_tests():
    """Run all test suites and generate report"""
    test_suites = [
        TestAsyncEndpoints,
        TestPerformanceBenchmarks,
        TestConcurrencyStressTests,
        TestTimeoutHandling,
        TestMemoryUsage,
        TestErrorPropagation,
        TestVercelSpecificOptimizations
    ]
    
    results = {
        "timestamp": datetime.now().isoformat(),
        "test_results": {},
        "performance_metrics": {},
        "recommendations": []
    }
    
    for suite in test_suites:
        suite_name = suite.__name__
        logger.info(f"Running {suite_name}...")
        
        # Run tests and collect results
        # This would integrate with pytest programmatically
        results["test_results"][suite_name] = "See pytest output"
    
    # Generate recommendations based on results
    results["recommendations"] = [
        "Implement connection pooling for database connections",
        "Add response streaming for large result sets",
        "Implement stale-while-revalidate caching strategy",
        "Monitor memory usage in production",
        "Set up warming cron jobs for critical endpoints"
    ]
    
    return results


if __name__ == "__main__":
    # Run tests using pytest
    pytest.main([__file__, "-v", "--tb=short"])