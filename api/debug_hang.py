#!/usr/bin/env python3
"""Debug script to trace where the hang occurs"""

import logging
import sys
import importlib.util

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Trace imports
original_import = __builtins__.__import__

def traced_import(name, *args, **kwargs):
    if 'hybrid' in name or 'simulation' in name:
        logger.debug(f"Importing: {name}")
    return original_import(name, *args, **kwargs)

__builtins__.__import__ = traced_import

try:
    logger.info("Starting import trace...")
    
    # Import step by step
    logger.info("1. Importing FastAPI components...")
    from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
    logger.info("   ✓ FastAPI imports successful")
    
    logger.info("2. Importing Pydantic...")
    from pydantic import BaseModel, validator, Field
    logger.info("   ✓ Pydantic imports successful")
    
    logger.info("3. Importing standard libraries...")
    from typing import List, Optional, Dict, Any, Union
    from datetime import datetime, date
    import pandas as pd
    import numpy as np
    logger.info("   ✓ Standard library imports successful")
    
    logger.info("4. Importing hybrid simulation modules...")
    from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig, SimulationResults
    logger.info("   ✓ Hybrid engine imports successful")
    
    from hybrid_simulation.validation.distribution_validation import DistributionValidation, ValidationReport
    logger.info("   ✓ Validation imports successful")
    
    from hybrid_simulation.benchmarking.performance_benchmarks import PerformanceBenchmarks, BenchmarkConfig
    logger.info("   ✓ Benchmarking imports successful")
    
    logger.info("5. Importing service dependencies...")
    from service_dependencies import get_data_fetcher
    logger.info("   ✓ Service dependencies imports successful")
    
    logger.info("\nAll imports successful! No hanging during imports.")
    
except Exception as e:
    logger.error(f"Import failed: {e}")
    import traceback
    traceback.print_exc()

finally:
    __builtins__.__import__ = original_import