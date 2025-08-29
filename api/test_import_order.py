#!/usr/bin/env python3
"""Test script to verify import order issue"""

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# First, let's test if we can import the problematic endpoint
try:
    logger.info("Importing hybrid_simulation_api...")
    from hybrid_simulation_api import router, HybridSimulationRequest, HybridSimulationResponse
    logger.info("✓ Import successful")
    
    # Check if the endpoint is registered
    logger.info(f"Router routes: {[r.path for r in router.routes]}")
    
    # Find the problematic endpoint
    for route in router.routes:
        if route.path == "/simulate":
            logger.info(f"Found /simulate endpoint: {route}")
            logger.info(f"Response model: {route.response_model}")
            logger.info(f"Dependencies: {route.dependencies}")
            
except Exception as e:
    logger.error(f"Import failed: {e}")
    import traceback
    traceback.print_exc()

# Now let's test creating the response model
try:
    logger.info("\nTesting response model creation...")
    response = HybridSimulationResponse(
        task_id="test-123",
        status="started",
        message="Test message",
        estimated_completion_time="2024-01-01T00:00:00"
    )
    logger.info(f"✓ Response model created: {response}")
except Exception as e:
    logger.error(f"Response model creation failed: {e}")
    import traceback
    traceback.print_exc()

# Test if there's a circular import or initialization issue
try:
    logger.info("\nChecking for circular imports...")
    import sys
    modules_before = set(sys.modules.keys())
    
    # Re-import to check for side effects
    import hybrid_simulation_api
    
    modules_after = set(sys.modules.keys())
    new_modules = modules_after - modules_before
    logger.info(f"New modules loaded during import: {new_modules}")
    
except Exception as e:
    logger.error(f"Circular import check failed: {e}")
    import traceback
    traceback.print_exc()