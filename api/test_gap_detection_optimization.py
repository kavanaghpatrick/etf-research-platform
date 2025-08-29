#!/usr/bin/env python3
"""
Simple test to verify gap detection optimizations work.
Tests the cache optimization features without requiring API calls.
"""

import logging
import time
import pandas as pd
from datetime import datetime, date, timedelta
from sqlite_cache_manager import SQLiteStockDataCache

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def populate_test_cache(cache: SQLiteStockDataCache, ticker: str, years: int = 25):
    """Populate cache with test data to simulate real scenario."""
    logger.info(f"Populating cache with {years} years of test data for {ticker}")
    
    # Create sample data for the last N years
    end_date = date.today()
    start_date = end_date - timedelta(days=years * 365)
    
    # Generate daily data (simulating trading days)
    dates = pd.bdate_range(start_date, end_date)
    
    # Create sample stock data
    test_data = pd.DataFrame({
        'Open': range(len(dates)),
        'High': range(1, len(dates) + 1),
        'Low': range(len(dates)),
        'Close': range(len(dates)),
        'Volume': [1000] * len(dates),
        'Adj Close': range(len(dates))
    }, index=dates)
    
    # Cache the data in chunks to simulate realistic caching
    chunk_size = 252 * 2  # 2 years at a time
    for i in range(0, len(test_data), chunk_size):
        chunk = test_data.iloc[i:i+chunk_size]
        if not chunk.empty:
            cache.cache_data(ticker, chunk, "test_source")
    
    logger.info(f"Cached {len(test_data)} records for {ticker}")


def test_gap_detection_performance():
    """Test gap detection performance with different optimizations."""
    logger.info("=" * 60)
    logger.info("GAP DETECTION OPTIMIZATION TEST")
    logger.info("=" * 60)
    
    # Initialize cache
    cache = SQLiteStockDataCache()
    
    # Test ticker
    ticker = "TEST_SPY"
    
    # Populate cache with test data (25 years)
    populate_test_cache(cache, ticker, 25)
    
    # Test scenarios
    scenarios = [
        {
            "name": "Small Range (1 year)",
            "years": 1,
            "expected": "Fast with regular detection"
        },
        {
            "name": "Medium Range (10 years)", 
            "years": 10,
            "expected": "Fast with regular detection"
        },
        {
            "name": "Large Range (25 years)",
            "years": 25,
            "expected": "Should use chunked detection"
        },
        {
            "name": "Very Large Range (50 years)",
            "years": 50,
            "expected": "Should use chunked detection + early exit"
        }
    ]
    
    results = []
    
    for scenario in scenarios:
        logger.info(f"\n--- Testing: {scenario['name']} ---")
        logger.info(f"Expected: {scenario['expected']}")
        
        # Calculate date range
        end_date = date.today()
        start_date = end_date - timedelta(days=scenario['years'] * 365)
        
        # Clear cache between tests
        cache.clear_gap_detection_cache()
        
        # Test 1: First call (no cache)
        start_time = time.time()
        missing_ranges = cache.get_missing_ranges(ticker, start_date, end_date)
        first_call_time = time.time() - start_time
        
        # Test 2: Second call (should use cache)
        start_time = time.time()
        missing_ranges_cached = cache.get_missing_ranges(ticker, start_date, end_date)
        cached_call_time = time.time() - start_time
        
        # Test 3: Chunked detection for large ranges
        if scenario['years'] > 20:
            start_time = time.time()
            chunked_ranges = cache.get_missing_ranges_chunked(ticker, start_date, end_date)
            chunked_time = time.time() - start_time
        else:
            chunked_time = None
            chunked_ranges = []
        
        # Calculate speedup
        speedup = first_call_time / cached_call_time if cached_call_time > 0 else float('inf')
        
        result = {
            'scenario': scenario['name'],
            'years': scenario['years'],
            'first_call_ms': first_call_time * 1000,
            'cached_call_ms': cached_call_time * 1000,
            'chunked_time_ms': chunked_time * 1000 if chunked_time else None,
            'speedup': speedup,
            'missing_ranges': len(missing_ranges),
            'chunked_ranges': len(chunked_ranges) if chunked_ranges else None
        }
        results.append(result)
        
        # Log results
        logger.info(f"  First call: {first_call_time*1000:.1f}ms")
        logger.info(f"  Cached call: {cached_call_time*1000:.1f}ms")
        if chunked_time:
            logger.info(f"  Chunked call: {chunked_time*1000:.1f}ms")
        logger.info(f"  Cache speedup: {speedup:.1f}x")
        logger.info(f"  Missing ranges found: {len(missing_ranges)}")
        
        # Verify correctness
        if missing_ranges == missing_ranges_cached:
            logger.info("  ✅ Cache correctness: PASSED")
        else:
            logger.info("  ❌ Cache correctness: FAILED")
    
    # Print summary
    logger.info("\n" + "=" * 60)
    logger.info("OPTIMIZATION SUMMARY")
    logger.info("=" * 60)
    
    for result in results:
        logger.info(f"\n{result['scenario']}:")
        logger.info(f"  Range: {result['years']} years")
        logger.info(f"  Performance: {result['first_call_ms']:.1f}ms → {result['cached_call_ms']:.1f}ms")
        logger.info(f"  Speedup: {result['speedup']:.1f}x")
        
        if result['chunked_time_ms']:
            logger.info(f"  Chunked: {result['chunked_time_ms']:.1f}ms")
        
        # Performance assessment
        if result['cached_call_ms'] < 10:
            logger.info("  Status: ✅ EXCELLENT (<10ms)")
        elif result['cached_call_ms'] < 100:
            logger.info("  Status: ✅ GOOD (<100ms)")
        elif result['cached_call_ms'] < 1000:
            logger.info("  Status: ⚠️  ACCEPTABLE (<1s)")
        else:
            logger.info("  Status: ❌ TOO SLOW (>1s)")
    
    # Test early exit optimization
    logger.info(f"\n--- Testing Early Exit Optimization ---")
    
    # Test with well-cached data (should trigger early exit)
    end_date = date.today()
    start_date = end_date - timedelta(days=20 * 365)  # 20 years
    
    start_time = time.time()
    missing_ranges = cache.get_missing_ranges(ticker, start_date, end_date)
    early_exit_time = time.time() - start_time
    
    logger.info(f"Early exit test: {early_exit_time*1000:.1f}ms")
    logger.info(f"Missing ranges: {len(missing_ranges)}")
    
    if early_exit_time < 0.1:  # Less than 100ms
        logger.info("✅ Early exit optimization working!")
    else:
        logger.info("⚠️  Early exit may need tuning")
    
    # Clean up
    cache.close()
    
    return results


def test_sufficient_data_check():
    """Test the sufficient data check optimization."""
    logger.info(f"\n--- Testing Sufficient Data Check ---")
    
    # This would normally be tested with the Monte Carlo engine
    # For now, just test the cache stats functionality
    
    cache = SQLiteStockDataCache()
    ticker = "TEST_SPY"
    
    # Get cache stats
    stats = cache.get_cache_stats(ticker)
    
    if stats:
        stat = stats[0]
        logger.info(f"Cache stats for {ticker}:")
        logger.info(f"  Total records: {stat.total_records}")
        logger.info(f"  Date range: {stat.first_date} to {stat.last_date}")
        logger.info(f"  Coverage: {stat.coverage_percentage:.1f}%")
        
        # Estimate years of data
        if stat.first_date and stat.last_date:
            years = (stat.last_date - stat.first_date).days / 365.25
            logger.info(f"  Years of data: {years:.1f}")
            
            if years >= 20:
                logger.info("  ✅ Sufficient data for Monte Carlo (20+ years)")
            else:
                logger.info("  ⚠️  Limited data for Monte Carlo (<20 years)")
    else:
        logger.info(f"No cache stats found for {ticker}")
    
    cache.close()


if __name__ == "__main__":
    print("Monte Carlo Gap Detection Optimization Test")
    print("=" * 50)
    
    try:
        # Test gap detection optimizations
        results = test_gap_detection_performance()
        
        # Test sufficient data check
        test_sufficient_data_check()
        
        print("\n" + "=" * 50)
        print("✅ All gap detection tests completed!")
        
        # Check if optimization goals are met
        fast_results = [r for r in results if r['cached_call_ms'] < 100]
        if len(fast_results) == len(results):
            print("🎉 SUCCESS: All gap detection calls are fast (<100ms)")
        else:
            slow_count = len(results) - len(fast_results)
            print(f"⚠️  {slow_count} tests were slower than expected")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()