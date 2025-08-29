#!/usr/bin/env python3
"""Test request validation in isolation"""

import json
import logging
from hybrid_simulation_api import HybridSimulationRequest

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Test data
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

# Test 1: Direct instantiation
try:
    logger.info("Test 1: Direct instantiation")
    request = HybridSimulationRequest(**test_data)
    logger.info(f"✓ Success: {request}")
except Exception as e:
    logger.error(f"✗ Failed: {e}")

# Test 2: JSON parsing
try:
    logger.info("\nTest 2: JSON parsing")
    json_str = json.dumps(test_data)
    request = HybridSimulationRequest.parse_raw(json_str)
    logger.info(f"✓ Success: {request}")
except Exception as e:
    logger.error(f"✗ Failed: {e}")

# Test 3: Field validation
try:
    logger.info("\nTest 3: Testing field validators")
    
    # Test ticker validation
    test_data_copy = test_data.copy()
    test_data_copy["tickers"] = ["spy", "bnd"]  # lowercase
    request = HybridSimulationRequest(**test_data_copy)
    logger.info(f"✓ Ticker validation passed: {request.tickers}")
    
    # Test weight validation
    test_data_copy = test_data.copy()
    test_data_copy["portfolio_weights"] = [0.5, 0.5]
    request = HybridSimulationRequest(**test_data_copy)
    logger.info(f"✓ Weight validation passed: {request.portfolio_weights}")
    
except Exception as e:
    logger.error(f"✗ Validation failed: {e}")

# Test 4: Check for any blocking operations
try:
    logger.info("\nTest 4: Checking for blocking operations")
    import time
    start = time.time()
    request = HybridSimulationRequest(**test_data)
    elapsed = time.time() - start
    logger.info(f"✓ Instantiation took {elapsed:.4f} seconds")
    
    if elapsed > 0.1:
        logger.warning("Instantiation seems slow!")
except Exception as e:
    logger.error(f"✗ Failed: {e}")