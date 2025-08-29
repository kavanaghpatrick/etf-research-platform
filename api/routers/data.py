"""
Data fetching router for ETF Research Platform API.
Exposes resilient data fetching capabilities via REST endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import logging
from datetime import datetime

from ..models.requests import DataFetchRequest, TickerListRequest
from ..models.responses import DataFetchResponse, ErrorResponse, ResponseStatus
from ..services.data_service import get_data_service, DataService

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/fetch", response_model=DataFetchResponse)
async def fetch_ticker_data(
    request: DataFetchRequest,
    data_service: DataService = Depends(get_data_service)
) -> DataFetchResponse:
    """
    Fetch historical data for multiple tickers using resilient multi-source fetching.
    
    This endpoint leverages our robust data fetching system with:
    - Multi-source fallback (Yahoo Finance, Alpha Vantage, Finnhub, Tiingo)
    - Intelligent rate limiting per source
    - Automatic retry with exponential backoff
    - Data quality validation and repair
    - Comprehensive caching
    """
    try:
        start_time = datetime.now()
        logger.info(f"Processing data fetch request for {len(request.tickers)} tickers")
        
        # Convert dates to strings for the service
        start_date = request.start_date.strftime('%Y-%m-%d') if hasattr(request.start_date, 'strftime') else str(request.start_date)
        end_date = request.end_date.strftime('%Y-%m-%d') if request.end_date and hasattr(request.end_date, 'strftime') else str(request.end_date) if request.end_date else None
        
        # Call our robust data service
        result = await data_service.fetch_ticker_data(
            tickers=request.tickers,
            start_date=start_date,
            end_date=end_date,
            force_refresh=request.force_refresh,
            max_workers=request.max_workers
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Determine response status based on success rate
        success_rate = result['metadata'].get('success_rate', 0)
        if success_rate == 1.0:
            status = ResponseStatus.SUCCESS
            message = f"Successfully fetched data for all {len(request.tickers)} tickers"
        elif success_rate > 0:
            status = ResponseStatus.PARTIAL
            successful = result['metadata'].get('successful_tickers', 0)
            message = f"Fetched data for {successful}/{len(request.tickers)} tickers"
        else:
            status = ResponseStatus.ERROR
            message = "Failed to fetch data for any tickers"
        
        return DataFetchResponse(
            status=status,
            message=message,
            execution_time=execution_time,
            data=result['data'],
            metadata=result['metadata'],
            data_sources_used=result['data_sources_used'],
            cache_hit_rate=result['cache_hit_rate'],
            source_health=result['source_health']
        )
        
    except Exception as e:
        logger.error(f"Error in fetch_ticker_data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch ticker data: {str(e)}"
        )

@router.get("/health")
async def get_data_source_health(
    data_service: DataService = Depends(get_data_service)
) -> Dict[str, Any]:
    """Get health status of all data sources."""
    try:
        health_data = data_service.get_source_health()
        
        # Calculate overall health
        healthy_sources = sum(1 for source in health_data if source['healthy'])
        total_sources = len(health_data)
        overall_health = healthy_sources / total_sources if total_sources > 0 else 0
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "overall_health": overall_health,
            "healthy_sources": healthy_sources,
            "total_sources": total_sources,
            "sources": health_data
        }
        
    except Exception as e:
        logger.error(f"Error getting data source health: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get data source health: {str(e)}"
        )

@router.post("/validate")
async def validate_tickers(request: TickerListRequest) -> Dict[str, Any]:
    """Validate ticker symbols without fetching data."""
    try:
        # Basic validation is already done by Pydantic model
        # Here we could add more sophisticated validation like checking if tickers exist
        
        return {
            "status": "success",
            "message": f"Validated {len(request.tickers)} tickers",
            "tickers": request.tickers,
            "validation_result": {
                "valid_count": len(request.tickers),
                "invalid_count": 0,
                "duplicates_removed": len(set(request.tickers)) != len(request.tickers)
            }
        }
        
    except Exception as e:
        logger.error(f"Error validating tickers: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail=f"Ticker validation failed: {str(e)}"
        )