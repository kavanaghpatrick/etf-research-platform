#!/usr/bin/env python3
"""Test script to debug validation issue"""

from hybrid_simulation_api import HybridSimulationRequest
import json

# Test data that should work
test_data = {
    "tickers": ["SPY", "BND"],
    "start_date": "2020-01-01",
    "end_date": "2023-12-31",
    "n_simulations": 1000,
    "time_horizon_years": 5,
    "initial_portfolio_value": 100000,
    "portfolio_weights": [0.6, 0.4],
    "var_max_lags": 3,
    "garch_distribution": "normal",
    "preserve_mean": True,
    "use_parallel": True,
    "enable_validation": False,
    "run_benchmarks": False
}

print("Testing HybridSimulationRequest validation...")
print(f"Test data: {json.dumps(test_data, indent=2)}")

try:
    request = HybridSimulationRequest(**test_data)
    print("✓ Validation successful!")
    print(f"Request object created: {request}")
except Exception as e:
    print(f"✗ Validation failed: {e}")
    import traceback
    traceback.print_exc()