"""
API Integration for Total Return Calculator
Shows how to integrate the calculator with existing FastAPI endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional, Union
from datetime import date, datetime, timedelta
from pydantic import BaseModel, Field
import pandas as pd

from total_return_calculator import TotalReturnCalculator, TotalReturnMetrics
from models.responses import APIResponse, ResponseStatus


# Request/Response Models
class TotalReturnRequest(BaseModel):
    """Request model for total return calculations"""
    ticker: str = Field(..., description="Stock ticker symbol")
    start_date: date = Field(..., description="Start date for calculation")
    end_date: date = Field(..., description="End date for calculation")
    include_reinvestment: bool = Field(default=False, description="Calculate dividend reinvestment")
    initial_investment: float = Field(default=10000, description="Initial investment for reinvestment calc")


class DividendMetricsRequest(BaseModel):
    """Request model for dividend metrics"""
    ticker: str = Field(..., description="Stock ticker symbol")
    years: int = Field(default=5, ge=1, le=20, description="Number of years to analyze")


class DividendCalendarRequest(BaseModel):
    """Request model for dividend calendar"""
    tickers: List[str] = Field(..., description="List of ticker symbols")
    days_ahead: int = Field(default=30, ge=1, le=365, description="Days to look ahead")


class TotalReturnResponse(APIResponse):
    """Response model for total return calculations"""
    data: dict = Field(..., description="Total return calculation results")
    calculation_type: str = Field(..., description="Type of calculation performed")


class DividendMetricsResponse(APIResponse):
    """Response model for dividend metrics"""
    data: dict = Field(..., description="Dividend metrics")


class DividendCalendarResponse(APIResponse):
    """Response model for dividend calendar"""
    data: List[dict] = Field(..., description="Upcoming dividend events")
    period: dict = Field(..., description="Calendar period information")


class YearOverYearResponse(APIResponse):
    """Response model for year-over-year returns"""
    data: List[dict] = Field(..., description="Yearly return breakdown")
    summary: dict = Field(..., description="Summary statistics")


# Create router
router = APIRouter(
    prefix="/api/v1/returns",
    tags=["total_returns"],
    responses={404: {"description": "Not found"}}
)

# Initialize calculator (in production, this would be a dependency)
calculator = TotalReturnCalculator()


@router.post("/calculate", response_model=TotalReturnResponse)
async def calculate_total_return(request: TotalReturnRequest):
    """
    Calculate total return for a stock including dividends.
    
    Supports both simple total return and dividend reinvestment calculations.
    """
    try:
        if request.include_reinvestment:
            # Calculate with dividend reinvestment
            metrics = calculator.calculate_dividend_reinvested_return(
                request.ticker,
                request.start_date,
                request.end_date,
                request.initial_investment
            )
            calculation_type = "dividend_reinvested"
        else:
            # Simple total return
            metrics = calculator.calculate_simple_total_return(
                request.ticker,
                request.start_date,
                request.end_date
            )
            calculation_type = "simple_total_return"
        
        # Convert to dict for response
        data = calculator.export_results(metrics, format='dict')
        
        return TotalReturnResponse(
            status=ResponseStatus.SUCCESS,
            message=f"Total return calculated for {request.ticker}",
            data=data,
            calculation_type=calculation_type
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation failed: {str(e)}")


@router.get("/year-over-year/{ticker}", response_model=YearOverYearResponse)
async def get_year_over_year_returns(
    ticker: str,
    years: int = Query(default=5, ge=1, le=20, description="Number of years")
):
    """
    Get year-over-year returns including dividends for a stock.
    """
    try:
        # Calculate year-over-year returns
        yoy_df = calculator.calculate_year_over_year_returns(ticker, years)
        
        if yoy_df.empty:
            raise HTTPException(status_code=404, detail=f"No data available for {ticker}")
        
        # Convert to list of dicts
        data = yoy_df.to_dict('records')
        
        # Calculate summary statistics
        summary = {
            "average_total_return": float(yoy_df['total_return'].mean()),
            "average_price_return": float(yoy_df['price_return'].mean()),
            "average_dividend_return": float(yoy_df['dividend_return'].mean()),
            "best_year": int(yoy_df.loc[yoy_df['total_return'].idxmax(), 'year']),
            "worst_year": int(yoy_df.loc[yoy_df['total_return'].idxmin(), 'year']),
            "years_analyzed": len(yoy_df)
        }
        
        return YearOverYearResponse(
            status=ResponseStatus.SUCCESS,
            message=f"Year-over-year returns calculated for {ticker}",
            data=data,
            summary=summary
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation failed: {str(e)}")


@router.post("/dividend-metrics", response_model=DividendMetricsResponse)
async def get_dividend_metrics(request: DividendMetricsRequest):
    """
    Get comprehensive dividend metrics for a stock.
    """
    try:
        metrics = calculator.calculate_dividend_metrics(request.ticker, request.years)
        
        if 'error' in metrics:
            raise HTTPException(status_code=500, detail=metrics['error'])
        
        return DividendMetricsResponse(
            status=ResponseStatus.SUCCESS,
            message=f"Dividend metrics calculated for {request.ticker}",
            data=metrics
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/dividend-calendar", response_model=DividendCalendarResponse)
async def get_dividend_calendar(request: DividendCalendarRequest):
    """
    Get estimated upcoming dividend dates for multiple stocks.
    """
    try:
        calendar_df = calculator.get_dividend_calendar(request.tickers, request.days_ahead)
        
        # Convert to list of dicts
        if not calendar_df.empty:
            data = calendar_df.to_dict('records')
            # Convert timestamps to strings
            for item in data:
                item['estimated_ex_date'] = item['estimated_ex_date'].isoformat()
                item['last_ex_date'] = item['last_ex_date'].isoformat()
        else:
            data = []
        
        period = {
            "start_date": date.today().isoformat(),
            "end_date": (date.today() + timedelta(days=request.days_ahead)).isoformat(),
            "days_ahead": request.days_ahead,
            "tickers_analyzed": len(request.tickers),
            "events_found": len(data)
        }
        
        return DividendCalendarResponse(
            status=ResponseStatus.SUCCESS,
            message="Dividend calendar generated",
            data=data,
            period=period
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calendar generation failed: {str(e)}")


@router.get("/compare", response_model=TotalReturnResponse)
async def compare_returns(
    tickers: List[str] = Query(..., description="Comma-separated list of tickers"),
    start_date: date = Query(..., description="Start date"),
    end_date: date = Query(..., description="End date"),
    include_dividends: bool = Query(default=True, description="Include dividends in calculation")
):
    """
    Compare total returns across multiple stocks.
    """
    try:
        comparison_data = []
        
        for ticker in tickers:
            try:
                metrics = calculator.calculate_simple_total_return(ticker, start_date, end_date)
                
                comparison_data.append({
                    "ticker": ticker,
                    "total_return": metrics.total_return,
                    "price_return": metrics.price_return,
                    "dividend_return": metrics.dividend_return,
                    "annualized_return": metrics.annualized_return,
                    "dividend_yield": metrics.dividend_yield
                })
            except Exception as e:
                comparison_data.append({
                    "ticker": ticker,
                    "error": str(e)
                })
        
        # Sort by total return
        comparison_data.sort(key=lambda x: x.get('total_return', -float('inf')), reverse=True)
        
        return TotalReturnResponse(
            status=ResponseStatus.SUCCESS,
            message=f"Compared returns for {len(tickers)} stocks",
            data={"comparison": comparison_data},
            calculation_type="comparison"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {str(e)}")


@router.get("/cache-stats")
async def get_cache_statistics():
    """
    Get statistics about cached dividend data.
    """
    try:
        stats = calculator.get_cache_stats()
        
        return APIResponse(
            status=ResponseStatus.SUCCESS,
            message="Cache statistics retrieved",
            data=stats
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")


# Example of how to add these routes to main FastAPI app
def setup_total_return_routes(app):
    """
    Add total return routes to main FastAPI application.
    
    Usage in main.py:
    ```python
    from total_return_api_integration import setup_total_return_routes
    
    app = FastAPI()
    setup_total_return_routes(app)
    ```
    """
    app.include_router(router)


# Example usage documentation
EXAMPLE_REQUESTS = {
    "simple_total_return": {
        "endpoint": "POST /api/v1/returns/calculate",
        "body": {
            "ticker": "AAPL",
            "start_date": "2023-01-01",
            "end_date": "2024-01-01",
            "include_reinvestment": False
        }
    },
    "dividend_reinvestment": {
        "endpoint": "POST /api/v1/returns/calculate",
        "body": {
            "ticker": "JNJ",
            "start_date": "2021-01-01",
            "end_date": "2024-01-01",
            "include_reinvestment": True,
            "initial_investment": 10000
        }
    },
    "year_over_year": {
        "endpoint": "GET /api/v1/returns/year-over-year/MSFT?years=5"
    },
    "dividend_metrics": {
        "endpoint": "POST /api/v1/returns/dividend-metrics",
        "body": {
            "ticker": "KO",
            "years": 5
        }
    },
    "dividend_calendar": {
        "endpoint": "POST /api/v1/returns/dividend-calendar",
        "body": {
            "tickers": ["JNJ", "PG", "KO", "PEP"],
            "days_ahead": 90
        }
    },
    "compare_returns": {
        "endpoint": "GET /api/v1/returns/compare?tickers=AAPL,MSFT,GOOGL&start_date=2023-01-01&end_date=2024-01-01"
    }
}


if __name__ == "__main__":
    # Print example requests for documentation
    import json
    print("Total Return Calculator API Examples")
    print("=" * 50)
    for name, example in EXAMPLE_REQUESTS.items():
        print(f"\n{name}:")
        print(json.dumps(example, indent=2))