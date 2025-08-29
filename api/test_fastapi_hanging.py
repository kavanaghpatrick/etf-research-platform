#!/usr/bin/env python3
"""Test script to reproduce the FastAPI hanging issue"""

import logging
import asyncio
import sys
from fastapi import FastAPI, APIRouter, HTTPException, BackgroundTasks, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import time

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Reproduce the exact setup
app = FastAPI()
router = APIRouter(prefix="/api/test")

# Models - exact copies
class HybridSimulationRequest(BaseModel):
    """Request model for hybrid econometric simulation"""
    tickers: List[str] = Field(..., description="List of ticker symbols")
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")
    n_simulations: int = Field(10000, ge=1000, le=100000)
    portfolio_weights: Optional[List[float]] = None

class HybridSimulationResponse(BaseModel):
    """Response model for hybrid econometric simulation"""
    task_id: str
    status: str
    message: str
    estimated_completion_time: Optional[str] = None

# Dependency function
def get_data_fetcher(request: Request):
    """Get the data fetcher service from app state"""
    logger.info("[DEPENDENCY] get_data_fetcher called")
    # Simulate the dependency
    return {"type": "MockDataFetcher"}

# The problematic endpoint
@router.post("/simulate", response_model=HybridSimulationResponse)
async def run_hybrid_simulation(
    request: HybridSimulationRequest,
    background_tasks: BackgroundTasks,
    data_fetcher=Depends(get_data_fetcher)
):
    logger.info("[ENDPOINT] Handler called!")
    return HybridSimulationResponse(
        task_id="test-123",
        status="started",
        message="Test",
        estimated_completion_time="2024-01-01T00:00:00"
    )

# Test endpoint without response_model
@router.post("/simulate-nomodel")
async def run_simulation_nomodel(
    request: HybridSimulationRequest,
    background_tasks: BackgroundTasks,
    data_fetcher=Depends(get_data_fetcher)
):
    logger.info("[ENDPOINT] No model handler called!")
    return {
        "task_id": "test-123",
        "status": "started",
        "message": "Test"
    }

# Add router to app
app.include_router(router)

# Test running the app
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting test server on port 8001...")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="debug")