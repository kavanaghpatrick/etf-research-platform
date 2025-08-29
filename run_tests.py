#!/usr/bin/env python3
"""
Test runner for the ETF Research Platform
"""

import subprocess
import sys


def main():
    """Run all tests with coverage report."""
    print("Running ETF Research Platform Tests...")
    print("=" * 60)
    
    # Run pytest with coverage for main tests
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",  # Verbose
        "--tb=short",  # Short traceback
        "--cov=src",  # Coverage for src directory
        "--cov=api",  # Coverage for api directory
        "--cov-report=term-missing",  # Show missing lines in terminal
        "--cov-report=html",  # Generate HTML coverage report
        "tests/",  # Test directory
        "api/test_async_implementation.py"  # Async tests
    ]
    
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("\n" + "=" * 60)
        print("All tests passed! ✅")
        print("Coverage report generated in htmlcov/index.html")
        
        # Run async performance benchmarks if tests pass
        print("\nRunning async performance benchmarks...")
        benchmark_cmd = [
            sys.executable, "api/async_performance_benchmark.py"
        ]
        
        benchmark_result = subprocess.run(benchmark_cmd, cwd=".")
        
        if benchmark_result.returncode == 0:
            print("Performance benchmarks completed! 📊")
            print("Reports generated:")
            print("- async_performance_report.json")
            print("- async_performance_report.md")
            print("- async_performance_benchmark.png")
        else:
            print("Performance benchmarks failed! ⚠️")
            print("Check logs for details")
    else:
        print("\n" + "=" * 60)
        print("Some tests failed! ❌")
        sys.exit(1)


if __name__ == "__main__":
    main()