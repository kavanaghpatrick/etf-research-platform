"""
Service dependency injection for FastAPI application.
Provides clean access to initialized services from lifespan events.
"""

from fastapi import Request, HTTPException
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def get_data_fetcher(request: Request):
    """Get the data fetcher service from app state"""
    logger.info("[DEPENDENCY] get_data_fetcher called")
    logger.info(f"[DEPENDENCY] Request type: {type(request)}")
    logger.info(f"[DEPENDENCY] App state attributes: {dir(request.app.state) if hasattr(request.app, 'state') else 'No app.state'}")
    
    data_fetcher = getattr(request.app.state, 'data_fetcher', None)
    logger.info(f"[DEPENDENCY] data_fetcher retrieved: {type(data_fetcher) if data_fetcher else 'None'}")
    
    if data_fetcher is None:
        logger.error("[DEPENDENCY] Data fetcher is None, raising HTTPException")
        raise HTTPException(
            status_code=503,
            detail="Data fetching service not available"
        )
    return data_fetcher


def get_total_return_calculator(request: Request):
    """Get the total return calculator service from app state"""
    calculator = getattr(request.app.state, 'total_return_calculator', None)
    if calculator is None:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator service not available"
        )
    return calculator


def get_monte_carlo_engine(request: Request):
    """Get the Monte Carlo engine service from app state"""
    engine = getattr(request.app.state, 'monte_carlo_engine', None)
    if engine is None:
        raise HTTPException(
            status_code=503,
            detail="Monte Carlo engine service not available"
        )
    return engine


def get_inflation_fetcher(request: Request):
    """Get the inflation fetcher service from app state"""
    fetcher = getattr(request.app.state, 'inflation_fetcher', None)
    if fetcher is None:
        raise HTTPException(
            status_code=503,
            detail="Inflation fetcher service not available"
        )
    return fetcher


def get_data_fetcher_optional(request: Request) -> Optional[object]:
    """Get the data fetcher service from app state, returns None if not available"""
    return getattr(request.app.state, 'data_fetcher', None)


def get_total_return_calculator_optional(request: Request) -> Optional[object]:
    """Get the total return calculator service from app state, returns None if not available"""
    return getattr(request.app.state, 'total_return_calculator', None)


def get_monte_carlo_engine_optional(request: Request) -> Optional[object]:
    """Get the Monte Carlo engine service from app state, returns None if not available"""
    return getattr(request.app.state, 'monte_carlo_engine', None)


def get_inflation_fetcher_optional(request: Request) -> Optional[object]:
    """Get the inflation fetcher service from app state, returns None if not available"""
    return getattr(request.app.state, 'inflation_fetcher', None)