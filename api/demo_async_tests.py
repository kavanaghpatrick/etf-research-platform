#!/usr/bin/env python3
"""
Demonstration script for async testing suite
Shows how to use the testing infrastructure programmatically
"""

import asyncio
import json
import time
from datetime import datetime
from async_performance_benchmark import AsyncPerformanceBenchmark
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def demo_basic_performance_test():
    """Demonstrate basic performance testing"""
    logger.info("=== Basic Performance Test Demo ===")
    
    benchmark = AsyncPerformanceBenchmark()
    
    # Test with different ticker counts
    ticker_counts = [1, 3, 5]
    
    for count in ticker_counts:
        logger.info(f"\nTesting with {count} tickers...")
        
        # Create async session
        import aiohttp
        async with aiohttp.ClientSession() as session:
            try:
                result = await benchmark.benchmark_async_endpoint(session, count, iterations=2)
                
                logger.info(f"Results for {count} tickers:")
                logger.info(f"  Duration: {result.duration:.2f}s")
                logger.info(f"  Avg Response Time: {result.avg_response_time:.2f}s")
                logger.info(f"  Memory Used: {result.memory_peak - result.memory_baseline:.1f}MB")
                logger.info(f"  Success Rate: {result.success_rate:.1%}")
                logger.info(f"  Throughput: {result.throughput:.2f} req/s")
                
                if result.error_count > 0:
                    logger.warning(f"  Errors: {result.error_count}")
                    
            except Exception as e:
                logger.error(f"Test failed for {count} tickers: {e}")
        
        # Brief pause between tests
        await asyncio.sleep(1)

async def demo_concurrent_testing():
    """Demonstrate concurrent load testing"""
    logger.info("\n=== Concurrent Load Test Demo ===")
    
    benchmark = AsyncPerformanceBenchmark()
    
    try:
        result = await benchmark.benchmark_concurrent_load(
            concurrent_users=5,
            requests_per_user=2
        )
        
        logger.info("Concurrent load test results:")
        logger.info(f"  Total Duration: {result.duration:.2f}s")
        logger.info(f"  Average Response Time: {result.avg_response_time:.2f}s")
        logger.info(f"  Success Rate: {result.success_rate:.1%}")
        logger.info(f"  Throughput: {result.throughput:.2f} req/s")
        logger.info(f"  Memory Used: {result.memory_peak - result.memory_baseline:.1f}MB")
        
        if result.error_count > 0:
            logger.warning(f"  Errors encountered: {result.error_count}")
            
    except Exception as e:
        logger.error(f"Concurrent test failed: {e}")

async def demo_streaming_test():
    """Demonstrate streaming performance test"""
    logger.info("\n=== Streaming Performance Test Demo ===")
    
    benchmark = AsyncPerformanceBenchmark()
    
    try:
        result = await benchmark.test_streaming_performance(ticker_count=5)
        
        logger.info("Streaming test results:")
        logger.info(f"  Duration: {result.duration:.2f}s")
        logger.info(f"  First Result Time: {result.avg_response_time:.2f}s")
        logger.info(f"  Throughput: {result.throughput:.2f} results/s")
        logger.info(f"  Memory Used: {result.memory_peak - result.memory_baseline:.1f}MB")
        logger.info(f"  Success Rate: {result.success_rate:.1%}")
        
    except Exception as e:
        logger.error(f"Streaming test failed: {e}")

async def demo_memory_analysis():
    """Demonstrate memory usage analysis"""
    logger.info("\n=== Memory Usage Analysis Demo ===")
    
    benchmark = AsyncPerformanceBenchmark()
    
    try:
        memory_analysis = await benchmark.test_memory_efficiency(ticker_count=10)
        
        logger.info("Memory analysis results:")
        logger.info(f"  Baseline Memory: {memory_analysis['baseline_memory']:.1f}MB")
        logger.info(f"  Peak Memory: {memory_analysis['peak_memory']:.1f}MB")
        logger.info(f"  Memory Growth: {memory_analysis['memory_growth']:.1f}MB")
        logger.info(f"  Average Memory: {memory_analysis['avg_memory']:.1f}MB")
        logger.info(f"  Measurements Taken: {len(memory_analysis['measurements'])}")
        
        # Check Vercel compliance
        if memory_analysis['peak_memory'] > 400:
            logger.warning("  ⚠️  Memory usage exceeds recommended 400MB limit")
        else:
            logger.info("  ✅ Memory usage within acceptable limits")
            
    except Exception as e:
        logger.error(f"Memory analysis failed: {e}")

async def demo_vercel_compliance_check():
    """Demonstrate Vercel compliance checking"""
    logger.info("\n=== Vercel Compliance Check Demo ===")
    
    benchmark = AsyncPerformanceBenchmark()
    
    # Test with parameters that might stress Vercel limits
    test_scenarios = [
        {"tickers": 5, "name": "Light Load"},
        {"tickers": 10, "name": "Medium Load"},
        {"tickers": 15, "name": "Heavy Load"}
    ]
    
    compliance_results = []
    
    for scenario in test_scenarios:
        logger.info(f"\nTesting {scenario['name']} ({scenario['tickers']} tickers)...")
        
        import aiohttp
        async with aiohttp.ClientSession() as session:
            try:
                result = await benchmark.benchmark_async_endpoint(
                    session, 
                    scenario['tickers'], 
                    iterations=1
                )
                
                # Check Vercel compliance
                timeout_compliant = result.duration < 10.0  # 10 second limit
                memory_compliant = (result.memory_peak - result.memory_baseline) < 400  # 400MB safe limit
                
                compliance_results.append({
                    "scenario": scenario['name'],
                    "duration": result.duration,
                    "memory_used": result.memory_peak - result.memory_baseline,
                    "timeout_compliant": timeout_compliant,
                    "memory_compliant": memory_compliant,
                    "overall_compliant": timeout_compliant and memory_compliant
                })
                
                status = "✅ COMPLIANT" if timeout_compliant and memory_compliant else "❌ NON-COMPLIANT"
                logger.info(f"  {status}")
                logger.info(f"  Duration: {result.duration:.2f}s (limit: 10s)")
                logger.info(f"  Memory: {result.memory_peak - result.memory_baseline:.1f}MB (limit: 400MB)")
                
            except Exception as e:
                logger.error(f"Test failed for {scenario['name']}: {e}")
                compliance_results.append({
                    "scenario": scenario['name'],
                    "error": str(e),
                    "overall_compliant": False
                })
    
    # Summary
    compliant_count = sum(1 for r in compliance_results if r.get("overall_compliant", False))
    total_count = len(compliance_results)
    
    logger.info(f"\n=== Vercel Compliance Summary ===")
    logger.info(f"Compliant Scenarios: {compliant_count}/{total_count}")
    
    if compliant_count == total_count:
        logger.info("🎉 All scenarios are Vercel compliant!")
    else:
        logger.warning("⚠️  Some scenarios exceed Vercel limits")
        logger.info("Consider optimizing for:")
        logger.info("- Response streaming for large datasets")
        logger.info("- Memory-efficient data processing")
        logger.info("- Connection pooling")
        logger.info("- Caching strategies")

def demo_test_report_analysis():
    """Demonstrate test report analysis"""
    logger.info("\n=== Test Report Analysis Demo ===")
    
    # This would analyze existing test reports
    report_files = [
        "async_performance_report.json",
        "async_test_report.json"
    ]
    
    for report_file in report_files:
        try:
            with open(report_file, 'r') as f:
                report_data = json.load(f)
            
            logger.info(f"\nAnalyzing {report_file}:")
            logger.info(f"  Generated: {report_data.get('timestamp', 'Unknown')}")
            
            # Analyze performance data
            if 'performance_summary' in report_data:
                perf_summary = report_data['performance_summary']
                if 'async_performance' in perf_summary:
                    async_perf = perf_summary['async_performance']
                    logger.info(f"  Avg Response Time: {async_perf.get('avg_response_time', 0):.2f}s")
                    logger.info(f"  Avg Throughput: {async_perf.get('avg_throughput', 0):.2f} req/s")
                    logger.info(f"  Avg Success Rate: {async_perf.get('avg_success_rate', 0):.1%}")
            
            # Analyze recommendations
            if 'recommendations' in report_data:
                recommendations = report_data['recommendations']
                logger.info(f"  Recommendations: {len(recommendations)}")
                for i, rec in enumerate(recommendations[:3], 1):
                    logger.info(f"    {i}. {rec}")
                    
        except FileNotFoundError:
            logger.info(f"  {report_file} not found (run tests first)")
        except json.JSONDecodeError:
            logger.error(f"  {report_file} contains invalid JSON")
        except Exception as e:
            logger.error(f"  Error analyzing {report_file}: {e}")

async def main():
    """Run all demo functions"""
    logger.info("🚀 Starting Async Testing Suite Demo")
    logger.info("=" * 50)
    
    demos = [
        demo_basic_performance_test,
        demo_concurrent_testing,
        demo_streaming_test,
        demo_memory_analysis,
        demo_vercel_compliance_check
    ]
    
    for demo_func in demos:
        try:
            await demo_func()
            await asyncio.sleep(0.5)  # Brief pause between demos
        except Exception as e:
            logger.error(f"Demo {demo_func.__name__} failed: {e}")
    
    # Non-async demo
    demo_test_report_analysis()
    
    logger.info("\n" + "=" * 50)
    logger.info("🎯 Demo completed!")
    logger.info("\nTo run full test suite:")
    logger.info("  python run_async_tests.py")
    logger.info("\nTo run performance benchmarks:")
    logger.info("  python async_performance_benchmark.py")
    logger.info("\nTo run specific tests:")
    logger.info("  pytest test_async_implementation.py -v")

if __name__ == "__main__":
    asyncio.run(main())