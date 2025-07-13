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
    
    # Run pytest with coverage
    cmd = [
        sys.executable, "-m", "pytest",
        "-v",  # Verbose
        "--tb=short",  # Short traceback
        "--cov=src",  # Coverage for src directory
        "--cov-report=term-missing",  # Show missing lines in terminal
        "--cov-report=html",  # Generate HTML coverage report
        "tests/"  # Test directory
    ]
    
    result = subprocess.run(cmd)
    
    if result.returncode == 0:
        print("\n" + "=" * 60)
        print("All tests passed! ✅")
        print("Coverage report generated in htmlcov/index.html")
    else:
        print("\n" + "=" * 60)
        print("Some tests failed! ❌")
        sys.exit(1)


if __name__ == "__main__":
    main()