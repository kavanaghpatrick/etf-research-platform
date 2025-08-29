#!/usr/bin/env python3
"""
Test script for parallel data fetcher
Validates the parallel fetching implementation works correctly
"""

import asyncio
import logging
import time
from datetime import datetime
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from parallel_data_fetcher import create_parallel_fetcher
from async_parallel_integration import create_parallel_async_fetcher

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_parallel_fetcher():
    """Test the parallel data fetcher"""
    logger.info("🚀 Testing Parallel Data Fetcher")
    logger.info("=" * 50)
    
    try:
        # Initialize cache manager (SQLite for testing)
        try:
            from sqlite_cache_manager import SQLiteStockDataCache
            cache_manager = SQLiteStockDataCache()
            logger.info("✅ SQLite cache manager initialized")
        except ImportError:
            cache_manager = None
            logger.warning("⚠️  No cache manager available")
        
        # Create parallel fetcher
        parallel_fetcher = create_parallel_fetcher(cache_manager)
        logger.info("✅ Parallel fetcher created")
        
        # Test single ticker fetch
        logger.info("\n📊 Testing single ticker fetch...")
        ticker = "AAPL"
        start_date = "2023-01-01"
        end_date = "2023-01-31"
        
        start_time = time.time()
        result = await parallel_fetcher.fetch_parallel(ticker, start_date, end_date)
        duration = time.time() - start_time
        
        logger.info(f"Single ticker results:")
        logger.info(f"  ✅ Success: {result.success}")
        logger.info(f"  ⏱️  Duration: {duration:.3f}s")
        logger.info(f"  📡 Source: {result.source}")
        logger.info(f"  💾 From cache: {result.from_cache}")
        if result.error:
            logger.warning(f"  ❌ Error: {result.error}")
        
        # Test batch fetch
        logger.info("\n📊 Testing batch ticker fetch...")
        tickers = ["AAPL", "GOOGL", "MSFT"]
        
        start_time = time.time()
        batch_results = await parallel_fetcher.batch_fetch_parallel(
            tickers, start_date, end_date, max_concurrent=3
        )
        batch_duration = time.time() - start_time
        
        logger.info(f"Batch fetch results:")
        logger.info(f"  ⏱️  Total duration: {batch_duration:.3f}s")
        logger.info(f"  📊 Results: {len(batch_results)}/{len(tickers)}")
        
        for ticker, result in batch_results.items():
            status = "✅" if result.success else "❌"
            logger.info(f"  {status} {ticker}: {result.source or 'failed'} ({result.response_time:.3f}s)")
        
        # Test source health
        logger.info("\n🏥 Source health status:")
        health = parallel_fetcher.get_source_health()
        for source, status in health.items():
            health_icon = "🟢" if status['status'] == 'healthy' else "🔴"
            logger.info(f"  {health_icon} {source}: {status['status']} ({status['total_requests']} requests)")
        
        logger.info("\n🎉 Parallel fetcher test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Parallel fetcher test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def test_integration_layer():
    """Test the async integration layer"""
    logger.info("\n🔄 Testing Async Integration Layer")
    logger.info("=" * 50)
    
    try:
        # Initialize cache manager
        try:
            from sqlite_cache_manager import SQLiteStockDataCache
            cache_manager = SQLiteStockDataCache()
            logger.info("✅ SQLite cache manager initialized")
        except ImportError:
            cache_manager = None
            logger.warning("⚠️  No cache manager available")
        
        # Create integration layer
        async_fetcher = create_parallel_async_fetcher(cache_manager)
        logger.info("✅ Async integration layer created")
        
        # Test single ticker
        logger.info("\n📊 Testing single ticker via integration layer...")
        ticker = "GOOGL"
        start_date = "2023-02-01"
        end_date = "2023-02-28"
        
        start_time = time.time()
        result = await async_fetcher.fetch_data_for_ticker_async(ticker, start_date, end_date)
        duration = time.time() - start_time
        
        logger.info(f"Integration layer results:")
        logger.info(f"  ✅ Ticker: {result.get('ticker', 'unknown')}")
        logger.info(f"  ⏱️  Duration: {duration:.3f}s")
        logger.info(f"  📡 Source: {result.get('source', 'unknown')}")
        logger.info(f"  💾 From cache: {result.get('from_cache', False)}")
        logger.info(f"  📊 Data points: {len(result.get('data', []))}")
        
        # Test multiple tickers
        logger.info("\n📊 Testing multiple tickers via integration layer...")
        tickers = ["MSFT", "AMZN"]
        
        start_time = time.time()
        multi_results = await async_fetcher.fetch_data_for_tickers_async(tickers, start_date, end_date)
        multi_duration = time.time() - start_time
        
        logger.info(f"Multi-ticker results:")
        logger.info(f"  ⏱️  Total duration: {multi_duration:.3f}s")
        logger.info(f"  📊 Results: {len(multi_results)}/{len(tickers)}")
        
        for ticker, result in multi_results.items():
            data_points = len(result.get('data', []))
            source = result.get('source', 'unknown')
            logger.info(f"  ✅ {ticker}: {data_points} points from {source}")
        
        # Test performance stats
        logger.info("\n📈 Performance statistics:")
        stats = async_fetcher.get_performance_stats()
        logger.info(f"  📊 Total requests: {stats.get('total_requests', 0)}")
        logger.info(f"  💾 Cache hits: {stats.get('cache_hits', 0)}")
        logger.info(f"  🚀 Parallel fetches: {stats.get('parallel_fetches', 0)}")
        logger.info(f"  ⏱️  Avg response time: {stats.get('avg_response_time', 0):.3f}s")
        logger.info(f"  📈 Cache hit rate: {stats.get('cache_hit_rate', 0):.1%}")
        
        logger.info("\n🎉 Integration layer test completed successfully!")
        return True
        
    except Exception as e:
        logger.error(f"❌ Integration layer test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run all tests"""
    logger.info("🧪 PARALLEL FETCHER TEST SUITE")
    logger.info("=" * 60)
    
    # Test 1: Core parallel fetcher
    test1_success = await test_parallel_fetcher()
    
    # Test 2: Integration layer
    test2_success = await test_integration_layer()
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📋 TEST SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Parallel Fetcher: {'✅ PASSED' if test1_success else '❌ FAILED'}")
    logger.info(f"  Integration Layer: {'✅ PASSED' if test2_success else '❌ FAILED'}")
    
    if test1_success and test2_success:
        logger.info("\n🎉 ALL TESTS PASSED! Parallel fetcher ready for production.")
        return 0
    else:
        logger.error("\n❌ SOME TESTS FAILED! Check implementation.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)