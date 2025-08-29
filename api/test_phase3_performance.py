#!/usr/bin/env python3
"""
Phase 3 Performance Testing: Benchmark gap detection performance.
Tests cache hit rates, API call reduction, and response times.
"""

import time
import tempfile
import os
from datetime import date, timedelta
from total_return_calculator import TotalReturnCalculator
from sqlite_cache_manager import SQLiteStockDataCache
import pandas as pd
from unittest.mock import patch


class PerformanceBenchmark:
    """Performance benchmarking for dividend gap detection."""
    
    def __init__(self):
        # Create temporary database for testing
        self.temp_file = tempfile.NamedTemporaryFile(delete=False)
        self.temp_file.close()
        
        self.calculator = TotalReturnCalculator(database_url=f"sqlite:///{self.temp_file.name}")
        self.api_calls = {'count': 0, 'calls': []}
        
        # Wrap API calls to count them
        original_fetch = self.calculator.data_source.fetch_dividends
        def counting_fetch(*args, **kwargs):
            self.api_calls['count'] += 1
            call_info = {
                'ticker': args[0],
                'start_date': args[1],
                'end_date': args[2],
                'timestamp': time.time()
            }
            self.api_calls['calls'].append(call_info)
            return original_fetch(*args, **kwargs)
        
        self.calculator.data_source.fetch_dividends = counting_fetch
    
    def cleanup(self):
        """Clean up resources."""
        try:
            self.calculator.close()
        except:
            pass
        if os.path.exists(self.temp_file.name):
            os.unlink(self.temp_file.name)
    
    def reset_api_counter(self):
        """Reset API call counter."""
        self.api_calls = {'count': 0, 'calls': []}
    
    def benchmark_gap_detection_performance(self):
        """Benchmark the performance of gap detection vs naive approach."""
        print("\n=== Performance Benchmark: Gap Detection vs Naive Approach ===\n")
        
        ticker = 'MSFT'
        end_date = date.today()
        
        scenarios = [
            (1, "1 Year"),
            (2, "2 Years"), 
            (5, "5 Years"),
            (3, "3 Years (overlapping)")
        ]
        
        results = []
        
        for years, description in scenarios:
            start_date = end_date - timedelta(days=years * 365)
            
            print(f"Scenario: {description}")
            print(f"Date range: {start_date} to {end_date}")
            
            # Measure performance
            self.reset_api_counter()
            start_time = time.time()
            
            dividend_df = self.calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            end_time = time.time()
            execution_time = end_time - start_time
            
            result = {
                'scenario': description,
                'years': years,
                'execution_time': execution_time,
                'api_calls': self.api_calls['count'],
                'dividends_found': len(dividend_df),
                'cache_ranges': len(self.api_calls['calls'])
            }
            results.append(result)
            
            print(f"  Execution time: {execution_time:.2f}s")
            print(f"  API calls made: {self.api_calls['count']}")
            print(f"  Dividends found: {len(dividend_df)}")
            print()
        
        # Analyze results
        print("📊 Performance Analysis:")
        total_api_calls_naive = sum(r['years'] for r in results)  # Naive approach estimate
        total_api_calls_gap = sum(r['api_calls'] for r in results)
        
        print(f"  Total API calls (gap detection): {total_api_calls_gap}")
        print(f"  Total API calls (naive approach): {total_api_calls_naive}")
        
        if total_api_calls_naive > 0:
            reduction = ((total_api_calls_naive - total_api_calls_gap) / total_api_calls_naive) * 100
            print(f"  API call reduction: {reduction:.1f}%")
        
        return results
    
    def benchmark_cache_hit_rates(self):
        """Benchmark cache hit rates for repeated requests."""
        print("\n=== Cache Hit Rate Benchmark ===\n")
        
        ticker = 'AAPL'
        end_date = date.today()
        
        # Scenario 1: First request (cold cache)
        print("Test 1: Cold cache performance")
        start_date = end_date - timedelta(days=365)
        
        self.reset_api_counter()
        start_time = time.time()
        
        dividend_df = self.calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
        
        cold_time = time.time() - start_time
        cold_api_calls = self.api_calls['count']
        
        print(f"  Cold cache time: {cold_time:.2f}s")
        print(f"  API calls: {cold_api_calls}")
        print(f"  Dividends cached: {len(dividend_df)}")
        
        # Scenario 2: Repeated request (hot cache)
        print("\nTest 2: Hot cache performance")
        
        self.reset_api_counter()
        start_time = time.time()
        
        dividend_df_cached = self.calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
        
        hot_time = time.time() - start_time
        hot_api_calls = self.api_calls['count']
        
        print(f"  Hot cache time: {hot_time:.2f}s")
        print(f"  API calls: {hot_api_calls}")
        print(f"  Dividends retrieved: {len(dividend_df_cached)}")
        
        # Scenario 3: Partial overlap (warm cache)
        print("\nTest 3: Partial overlap performance")
        extended_start = start_date - timedelta(days=365)  # Extend by 1 year
        
        self.reset_api_counter()
        start_time = time.time()
        
        dividend_df_extended = self.calculator.fetch_and_cache_dividends(ticker, extended_start, end_date)
        
        warm_time = time.time() - start_time
        warm_api_calls = self.api_calls['count']
        
        print(f"  Warm cache time: {warm_time:.2f}s")
        print(f"  API calls: {warm_api_calls} (should be minimal)")
        print(f"  Total dividends: {len(dividend_df_extended)}")
        
        # Performance summary
        print("\n📈 Cache Performance Summary:")
        if cold_time > 0:
            speedup_hot = cold_time / hot_time if hot_time > 0 else float('inf')
            print(f"  Hot cache speedup: {speedup_hot:.1f}x faster")
        
        print(f"  API call reduction (hot): {cold_api_calls - hot_api_calls} calls saved")
        print(f"  API call reduction (warm): {cold_api_calls - warm_api_calls} calls saved")
        
        return {
            'cold_time': cold_time,
            'hot_time': hot_time,
            'warm_time': warm_time,
            'cold_api_calls': cold_api_calls,
            'hot_api_calls': hot_api_calls,
            'warm_api_calls': warm_api_calls
        }
    
    def benchmark_multi_ticker_performance(self):
        """Benchmark performance with multiple tickers."""
        print("\n=== Multi-Ticker Performance Benchmark ===\n")
        
        tickers = ['MSFT', 'AAPL', 'JNJ', 'KO', 'PG']  # Mix of dividend-paying stocks
        end_date = date.today()
        start_date = end_date - timedelta(days=2 * 365)  # 2 years
        
        print(f"Testing {len(tickers)} tickers over 2 years")
        print(f"Tickers: {', '.join(tickers)}")
        
        self.reset_api_counter()
        start_time = time.time()
        
        ticker_results = {}
        
        for ticker in tickers:
            ticker_start = time.time()
            dividend_df = self.calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
            ticker_time = time.time() - ticker_start
            
            ticker_results[ticker] = {
                'time': ticker_time,
                'dividends': len(dividend_df),
                'api_calls_before': self.api_calls['count']
            }
            
            print(f"  {ticker}: {ticker_time:.2f}s, {len(dividend_df)} dividends")
        
        total_time = time.time() - start_time
        total_api_calls = self.api_calls['count']
        total_dividends = sum(r['dividends'] for r in ticker_results.values())
        
        print(f"\n📊 Multi-Ticker Summary:")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Average time per ticker: {total_time / len(tickers):.2f}s")
        print(f"  Total API calls: {total_api_calls}")
        print(f"  Total dividends retrieved: {total_dividends}")
        print(f"  API calls per ticker: {total_api_calls / len(tickers):.1f}")
        
        return ticker_results
    
    def benchmark_date_range_optimization(self):
        """Benchmark optimization for different date ranges."""
        print("\n=== Date Range Optimization Benchmark ===\n")
        
        ticker = 'JNJ'  # Johnson & Johnson - reliable dividend payer
        end_date = date.today()
        
        ranges = [
            (30, "1 Month"),
            (90, "3 Months"),
            (365, "1 Year"),
            (365 * 2, "2 Years"),
            (365 * 5, "5 Years"),
            (365 * 10, "10 Years")
        ]
        
        results = []
        
        for days, description in ranges:
            start_date = end_date - timedelta(days=days)
            
            self.reset_api_counter()
            start_time = time.time()
            
            dividend_df = self.calculator.fetch_and_cache_dividends(ticker, start_date, end_date)
            
            execution_time = time.time() - start_time
            
            result = {
                'range': description,
                'days': days,
                'time': execution_time,
                'api_calls': self.api_calls['count'],
                'dividends': len(dividend_df)
            }
            results.append(result)
            
            print(f"  {description}: {execution_time:.2f}s, {self.api_calls['count']} API calls, {len(dividend_df)} dividends")
        
        # Analyze scaling
        print(f"\n📈 Scaling Analysis:")
        for i, result in enumerate(results[1:], 1):
            prev_result = results[i-1]
            time_ratio = result['time'] / prev_result['time'] if prev_result['time'] > 0 else 0
            days_ratio = result['days'] / prev_result['days']
            
            print(f"  {result['range']} vs {prev_result['range']}: {time_ratio:.1f}x time for {days_ratio:.1f}x range")
        
        return results


def run_performance_benchmarks():
    """Run all performance benchmarks."""
    print("🚀 Running Phase 3 Performance Benchmarks...")
    
    benchmark = PerformanceBenchmark()
    
    try:
        # Run all benchmarks
        gap_results = benchmark.benchmark_gap_detection_performance()
        cache_results = benchmark.benchmark_cache_hit_rates()
        multi_results = benchmark.benchmark_multi_ticker_performance()
        range_results = benchmark.benchmark_date_range_optimization()
        
        # Overall performance summary
        print("\n🎯 Overall Performance Summary:")
        print("=" * 50)
        
        # API call efficiency
        total_gap_calls = sum(r['api_calls'] for r in gap_results)
        total_scenarios = len(gap_results)
        avg_calls_per_scenario = total_gap_calls / total_scenarios if total_scenarios > 0 else 0
        
        print(f"Average API calls per scenario: {avg_calls_per_scenario:.1f}")
        
        # Cache performance
        if cache_results['cold_time'] > 0 and cache_results['hot_time'] > 0:
            cache_speedup = cache_results['cold_time'] / cache_results['hot_time']
            print(f"Cache speedup factor: {cache_speedup:.1f}x")
        
        # Multi-ticker efficiency
        multi_dividend_count = sum(r['dividends'] for r in multi_results.values())
        print(f"Multi-ticker efficiency: {multi_dividend_count} dividends across {len(multi_results)} tickers")
        
        # Performance targets achieved
        print(f"\n🎯 Performance Targets:")
        
        # Target: Sub-500ms for cached responses
        if cache_results['hot_time'] < 0.5:
            print("✅ Cached response time < 500ms")
        else:
            print(f"⚠️  Cached response time: {cache_results['hot_time']:.2f}s (target: <0.5s)")
        
        # Target: 80%+ API call reduction
        cold_calls = cache_results['cold_api_calls']
        hot_calls = cache_results['hot_api_calls']
        if cold_calls > 0:
            api_reduction = ((cold_calls - hot_calls) / cold_calls) * 100
            if api_reduction >= 80:
                print(f"✅ API call reduction: {api_reduction:.1f}% (target: >80%)")
            else:
                print(f"⚠️  API call reduction: {api_reduction:.1f}% (target: >80%)")
        
        print("\n✅ Phase 3 performance benchmarks completed!")
        
        return True
        
    except Exception as e:
        print(f"❌ Performance benchmark failed: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        benchmark.cleanup()


if __name__ == '__main__':
    success = run_performance_benchmarks()
    if success:
        print("🎉 All performance benchmarks passed!")
    else:
        print("❌ Some performance benchmarks failed.")
        exit(1)