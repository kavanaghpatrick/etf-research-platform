#!/usr/bin/env python3
"""
Async Test Runner
Runs async implementation tests and generates reports
"""

import subprocess
import sys
import os
import json
from datetime import datetime
import argparse

def run_async_tests(test_type="all", verbose=False, coverage=True):
    """Run async tests with specified configuration."""
    
    print("Running Async Implementation Tests...")
    print("=" * 60)
    
    # Base pytest command
    cmd = [sys.executable, "-m", "pytest"]
    
    if verbose:
        cmd.append("-v")
    else:
        cmd.append("-q")
    
    # Add coverage if requested
    if coverage:
        cmd.extend([
            "--cov=.",
            "--cov-report=html:htmlcov_async",
            "--cov-report=term-missing",
            "--cov-fail-under=70"
        ])
    
    # Add specific test filters
    if test_type == "unit":
        cmd.extend(["-k", "not (integration or performance or stress)"])
    elif test_type == "integration":
        cmd.extend(["-k", "integration"])
    elif test_type == "performance":
        cmd.extend(["-k", "performance"])
    elif test_type == "stress":
        cmd.extend(["-k", "stress or concurrency"])
    elif test_type == "vercel":
        cmd.extend(["-k", "vercel"])
    
    # Add test file
    cmd.append("test_async_implementation.py")
    
    print(f"Running command: {' '.join(cmd)}")
    print()
    
    # Run tests
    start_time = datetime.now()
    result = subprocess.run(cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
    end_time = datetime.now()
    
    # Generate summary
    duration = (end_time - start_time).total_seconds()
    
    print("\n" + "=" * 60)
    print(f"Test execution completed in {duration:.2f} seconds")
    
    if result.returncode == 0:
        print("✅ All tests passed!")
        
        if coverage:
            print(f"📊 Coverage report generated: htmlcov_async/index.html")
        
        # Run performance benchmarks if all tests pass
        if test_type in ["all", "performance"]:
            print("\n" + "-" * 40)
            print("Running performance benchmarks...")
            
            benchmark_cmd = [sys.executable, "async_performance_benchmark.py"]
            benchmark_result = subprocess.run(benchmark_cmd, cwd=os.path.dirname(os.path.abspath(__file__)))
            
            if benchmark_result.returncode == 0:
                print("✅ Performance benchmarks completed!")
                print("📈 Reports generated:")
                print("  - async_performance_report.json")
                print("  - async_performance_report.md")
                print("  - async_performance_benchmark.png")
            else:
                print("❌ Performance benchmarks failed!")
                return 1
        
        return 0
    else:
        print("❌ Some tests failed!")
        return 1


def generate_test_report():
    """Generate a comprehensive test report."""
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "test_suite": "async_implementation",
        "environment": {
            "python_version": sys.version,
            "platform": sys.platform,
            "cwd": os.getcwd()
        },
        "test_results": {},
        "performance_results": {},
        "recommendations": []
    }
    
    # Run different test types
    test_types = ["unit", "integration", "performance", "stress", "vercel"]
    
    for test_type in test_types:
        print(f"\n{'='*20} {test_type.upper()} TESTS {'='*20}")
        
        result = run_async_tests(test_type=test_type, verbose=False, coverage=False)
        report["test_results"][test_type] = {
            "passed": result == 0,
            "exit_code": result
        }
    
    # Load performance results if available
    try:
        with open("async_performance_report.json", "r") as f:
            report["performance_results"] = json.load(f)
    except FileNotFoundError:
        pass
    
    # Generate recommendations
    failed_tests = [test_type for test_type, result in report["test_results"].items() if not result["passed"]]
    
    if failed_tests:
        report["recommendations"].append(f"Fix failing tests: {', '.join(failed_tests)}")
    
    if "performance_results" in report and report["performance_results"]:
        perf_summary = report["performance_results"].get("performance_summary", {})
        if perf_summary.get("async_performance", {}).get("avg_response_time", 0) > 2:
            report["recommendations"].append("Optimize response times - currently exceeding 2 second target")
    
    report["recommendations"].extend([
        "Implement connection pooling for better performance",
        "Add response caching for frequently requested data",
        "Monitor memory usage in production",
        "Set up continuous performance monitoring"
    ])
    
    # Save report
    with open("async_test_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print("\n" + "=" * 60)
    print("COMPREHENSIVE TEST REPORT")
    print("=" * 60)
    
    for test_type, result in report["test_results"].items():
        status = "✅ PASSED" if result["passed"] else "❌ FAILED"
        print(f"{test_type.upper():<15} {status}")
    
    print(f"\n📋 Full report saved to: async_test_report.json")
    
    return len(failed_tests) == 0


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Run async implementation tests")
    parser.add_argument(
        "--type", 
        choices=["all", "unit", "integration", "performance", "stress", "vercel"],
        default="all",
        help="Type of tests to run"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output"
    )
    parser.add_argument(
        "--no-coverage",
        action="store_true",
        help="Skip coverage reporting"
    )
    parser.add_argument(
        "--report",
        action="store_true",
        help="Generate comprehensive test report"
    )
    
    args = parser.parse_args()
    
    if args.report:
        success = generate_test_report()
        sys.exit(0 if success else 1)
    else:
        result = run_async_tests(
            test_type=args.type,
            verbose=args.verbose,
            coverage=not args.no_coverage
        )
        sys.exit(result)


if __name__ == "__main__":
    main()