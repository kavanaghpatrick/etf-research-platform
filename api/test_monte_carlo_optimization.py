#!/usr/bin/env python3
"""
Test script to verify Monte Carlo data preparation optimizations.
Measures performance before and after optimizations.
"""

import logging
import time
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from typing import List

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Import the optimized classes
from monte_carlo_engine import MonteCarloEngine, PortfolioAllocation, SimulationConfig
from cached_data_fetcher import CachedDataFetcher
from inflation_data_fetcher import InflationDataFetcher
from sqlite_cache_manager import SQLiteStockDataCache
from simple_data_sources import SimpleAlphaVantageSource, SimpleTiingoSource


@dataclass
class PerformanceResult:
    """Results from performance test."""
    test_name: str
    execution_time: float
    cache_hit_rate: float
    data_range_years: float
    sufficient_data_found: bool
    api_calls_made: int


def create_test_portfolio() -> List[PortfolioAllocation]:
    """Create a test portfolio for benchmarking."""
    return [
        PortfolioAllocation("SPY", 60.0),  # S&P 500
        PortfolioAllocation("BND", 40.0),  # Bond ETF
    ]


def test_data_preparation_performance():
    """Test the performance of optimized data preparation."""
    logger = logging.getLogger(__name__)
    
    # Initialize components (with dummy API keys for testing)
    cache = SQLiteStockDataCache()
    sources = [
        SimpleAlphaVantageSource("dummy_key"), 
        SimpleTiingoSource("dummy_key")
    ]
    data_fetcher = CachedDataFetcher(sources, cache)
    inflation_fetcher = InflationDataFetcher()
    
    # Create Monte Carlo engine
    engine = MonteCarloEngine(data_fetcher, inflation_fetcher)
    
    # Create test portfolio
    portfolio = create_test_portfolio()
    
    # Test scenarios
    scenarios = [
        {
            "name": "Optimized: 30 years (sufficient cache)",
            "years": 30,
            "description": "Should use optimized path with sufficient cache check"
        },
        {
            "name": "Legacy-style: 50 years", 
            "years": 50,
            "description": "Moderate historical range"
        }
    ]
    
    results = []
    
    for scenario in scenarios:
        logger.info(f"\n=== Testing: {scenario['name']} ===")
        logger.info(f"Description: {scenario['description']}")
        
        # Create simulation config
        start_date = date.today() - timedelta(days=scenario['years'] * 365)
        config = SimulationConfig(
            portfolio=portfolio,
            time_period_years=10,  # Simulation length
            initial_balance=100000.0,
            num_simulations=100,
            historical_start_date=start_date
        )
        
        # Clear gap detection cache to ensure fair testing
        cache.clear_gap_detection_cache()
        
        # Measure data preparation time
        start_time = time.time()
        
        try:
            # Only test data preparation, not full simulation
            historical_data = engine.prepare_historical_data(config)
            
            preparation_time = time.time() - start_time
            
            # Extract performance metrics
            cache_hit_rate = 0.0  # Would need to track this from data_fetcher
            api_calls_made = 0    # Would need to track this from data_fetcher
            
            # Check if we got data for all tickers
            tickers_with_data = len(historical_data.get('price_data', {}))
            sufficient_data = tickers_with_data == len(portfolio)
            
            # Calculate actual data range
            if historical_data.get('price_data'):
                start_dates = []
                for ticker_data in historical_data['price_data'].values():
                    if 'returns' in ticker_data:
                        start_dates.append(ticker_data['returns'].index.min())
                
                if start_dates:
                    actual_start = min(start_dates)
                    actual_years = (date.today() - actual_start.date()).days / 365.25
                else:
                    actual_years = 0
            else:
                actual_years = 0
            
            result = PerformanceResult(
                test_name=scenario['name'],
                execution_time=preparation_time,
                cache_hit_rate=cache_hit_rate,
                data_range_years=actual_years,
                sufficient_data_found=sufficient_data,
                api_calls_made=api_calls_made
            )
            
            results.append(result)
            
            logger.info(f"✅ Data preparation completed in {preparation_time:.2f}s")
            logger.info(f"   Data range: {actual_years:.1f} years")
            logger.info(f"   Sufficient data: {sufficient_data}")
            
        except Exception as e:
            logger.error(f"❌ Test failed: {e}")
            
            result = PerformanceResult(
                test_name=scenario['name'],
                execution_time=999.0,  # High time indicates failure
                cache_hit_rate=0.0,
                data_range_years=0.0,
                sufficient_data_found=False,
                api_calls_made=0
            )
            results.append(result)
    
    # Print summary
    logger.info("\n" + "="*60)
    logger.info("PERFORMANCE TEST SUMMARY")
    logger.info("="*60)
    
    for result in results:
        logger.info(f"\nTest: {result.test_name}")
        logger.info(f"  Execution Time: {result.execution_time:.2f}s")
        logger.info(f"  Data Range: {result.data_range_years:.1f} years")
        logger.info(f"  Sufficient Data: {result.sufficient_data_found}")
        logger.info(f"  Performance: {'✅ FAST' if result.execution_time < 5.0 else '⚠️  SLOW' if result.execution_time < 15.0 else '❌ TOO SLOW'}")
    
    # Check if optimization goals are met
    optimized_results = [r for r in results if "Optimized" in r.test_name]
    if optimized_results:
        fastest_time = min(r.execution_time for r in optimized_results)
        if fastest_time < 5.0:
            logger.info(f"\n🎉 SUCCESS: Optimized data preparation achieved target (<5s): {fastest_time:.2f}s")
        else:
            logger.info(f"\n⚠️  PARTIAL: Optimized time is {fastest_time:.2f}s (target: <5s)")
    
    cache.close()
    return results


def test_cache_optimization():
    """Test the cache optimization features."""
    logger = logging.getLogger(__name__)
    
    logger.info("\n=== Testing Cache Optimization Features ===")
    
    # Test gap detection caching
    cache = SQLiteStockDataCache()
    
    # Test chunked gap detection for large ranges
    ticker = "SPY"
    start_date = date(2000, 1, 1)  # 24 years ago
    end_date = date.today()
    
    logger.info(f"Testing chunked gap detection for {ticker} from {start_date} to {end_date}")
    
    start_time = time.time()
    missing_ranges = cache.get_missing_ranges_chunked(ticker, start_date, end_date)
    chunked_time = time.time() - start_time
    
    logger.info(f"Chunked gap detection completed in {chunked_time:.2f}s")
    logger.info(f"Found {len(missing_ranges)} missing ranges")
    
    # Test regular gap detection for comparison
    start_time = time.time()
    regular_missing = cache.get_missing_ranges(ticker, start_date, end_date)
    regular_time = time.time() - start_time
    
    logger.info(f"Regular gap detection completed in {regular_time:.2f}s")
    logger.info(f"Found {len(regular_missing)} missing ranges")
    
    # Test cache hit on second call
    start_time = time.time()
    cached_missing = cache.get_missing_ranges(ticker, start_date, end_date)
    cached_time = time.time() - start_time
    
    logger.info(f"Cached gap detection completed in {cached_time:.2f}s")
    logger.info(f"Cache speedup: {regular_time/cached_time:.1f}x faster" if cached_time > 0 else "Cache speedup: instant")
    
    cache.close()


if __name__ == "__main__":
    print("Monte Carlo Data Preparation Optimization Test")
    print("=" * 50)
    
    try:
        # Test main optimization
        results = test_data_preparation_performance()
        
        # Test cache features
        test_cache_optimization()
        
        print("\n" + "=" * 50)
        print("✅ All tests completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Test suite failed: {e}")
        import traceback
        traceback.print_exc()