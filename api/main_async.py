"""
FastAPI backend service for ETF Research Platform - Async Version.
Phase 1: Minimal async conversion with feature flag support.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import re
import os
import asyncio
import sys
import logging
import time
from error_handler import configure_logging, error_handler

# Feature flags
ASYNC_MODE = os.getenv("ENABLE_ASYNC_MODE", "false").lower() == "true"
PARALLEL_FETCH_MODE = os.getenv("ENABLE_PARALLEL_FETCH", "false").lower() == "true"

# Configure logging with smart error suppression
configure_logging(log_level='INFO', suppress_expected_errors=True)

# Add the project root and src directory to the path for imports
project_root = os.path.dirname(os.path.dirname(__file__))
src_path = os.path.join(project_root, 'src')
sys.path.insert(0, project_root)
sys.path.insert(0, src_path)

try:
    # Import cache-optimized data sources
    from simple_data_sources import (
        SimpleAlphaVantageSource, SimpleTiingoSource, SimpleFinnhubSource, SimplePolygonSource,
        YFINANCE_AVAILABLE, FINNHUB_AVAILABLE, POLYGON_AVAILABLE
    )
    if YFINANCE_AVAILABLE:
        from yfinance_source import YFinanceSource
    
    # Try SQLite cache manager first (for local development)
    try:
        from sqlite_cache_manager import SQLiteStockDataCache as StockDataCache
        CACHE_TYPE = "SQLite"
        logging.info("Using SQLite cache manager for local development")
    except ImportError:
        # Fallback to PostgreSQL cache manager
        from cache_manager import StockDataCache
        CACHE_TYPE = "PostgreSQL"
        logging.info("Using PostgreSQL cache manager")
    
    from cached_data_fetcher import CachedDataFetcher
    from total_return_calculator import TotalReturnCalculator
    
    # Import parallel fetcher if enabled
    if PARALLEL_FETCH_MODE:
        try:
            from async_parallel_integration import create_parallel_async_fetcher
            PARALLEL_AVAILABLE = True
            logging.info("Parallel fetching mode enabled")
        except ImportError as e:
            PARALLEL_AVAILABLE = False
            logging.warning(f"Parallel fetcher not available: {e}")
    else:
        PARALLEL_AVAILABLE = False
    
    REAL_DATA_AVAILABLE = True
    logging.info(f"Successfully loaded cache-optimized data sources with {CACHE_TYPE}")
except Exception as e:
    logging.warning(f"Could not import data services: {e}")
    REAL_DATA_AVAILABLE = False

# Initialize data fetcher and total return calculator if available
data_fetcher = None
total_return_calculator = None
if REAL_DATA_AVAILABLE:
    try:
        # Get API keys from environment variables
        alpha_vantage_key = os.getenv('ALPHA_VANTAGE_API_KEY')
        tiingo_key = os.getenv('TIINGO_API_KEY')
        finnhub_key = os.getenv('FINNHUB_API_KEY')
        polygon_key = os.getenv('POLYGON_API_KEY')
        
        # Initialize available data sources
        sources = []
        
        if alpha_vantage_key:
            alphavantage_source = SimpleAlphaVantageSource(api_key=alpha_vantage_key)
            sources.append(alphavantage_source)
            logging.info("AlphaVantage source added")
        
        if tiingo_key:
            tiingo_source = SimpleTiingoSource(api_key=tiingo_key)
            sources.append(tiingo_source)
            logging.info("Tiingo source added")
        
        # Add YFinance as fallback (no API key required)
        if YFINANCE_AVAILABLE:
            yfinance_source = YFinanceSource()
            sources.append(yfinance_source)
            logging.info("YFinance source added as fallback")
        
        # Add Finnhub source if available
        if FINNHUB_AVAILABLE and finnhub_key:
            finnhub_source = SimpleFinnhubSource(api_key=finnhub_key)
            sources.append(finnhub_source)
            logging.info("Finnhub source added")
        
        # Add Polygon source if available
        if POLYGON_AVAILABLE and polygon_key:
            polygon_source = SimplePolygonSource(api_key=polygon_key)
            sources.append(polygon_source)
            logging.info("Polygon source added")
        
        if sources:
            # Initialize cache manager
            cache_manager = StockDataCache()
            
            # Choose fetcher based on feature flags
            if PARALLEL_FETCH_MODE and PARALLEL_AVAILABLE:
                # Use parallel fetcher for improved performance
                data_fetcher = create_parallel_async_fetcher(cache_manager)
                logging.info(f"Parallel data fetcher initialized with {len(sources)} sources")
            else:
                # Use traditional fetcher
                data_fetcher = CachedDataFetcher(
                    sources=sources,
                    cache_manager=cache_manager
                )
                logging.info(f"Traditional data fetcher initialized with {len(sources)} sources")
            
            # Initialize total return calculator
            try:
                # Find YFinance source for dividend data
                yfinance_source = next((s for s in sources if isinstance(s, YFinanceSource)), None)
                if yfinance_source:
                    # TotalReturnCalculator uses the same database as cache_manager
                    total_return_calculator = TotalReturnCalculator()
                    # Set the data source for dividend fetching
                    total_return_calculator.data_source = yfinance_source
                    logging.info("Total return calculator initialized with YFinance dividend support")
                else:
                    logging.warning("YFinance source not available for dividend data")
            except Exception as e:
                logging.error(f"Failed to initialize total return calculator: {e}")
        else:
            logging.warning("API keys not found, using sample data")
    except Exception as e:
        logging.error(f"Failed to initialize data fetcher: {e}")

# Create FastAPI app
app = FastAPI(
    title="ETF Research Platform API - Async",
    description="Professional ETF research and portfolio analytics platform with async support",
    version="1.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],  # Include both ports
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Request models
class DataFetchRequest(BaseModel):
    tickers: List[str]
    start_date: str = "2023-01-01"
    end_date: Optional[str] = None
    force_refresh: bool = False
    max_workers: int = 5
    include_dividends: bool = False

class APIResponse(BaseModel):
    status: str
    message: Optional[str] = None
    timestamp: str
    execution_time: Optional[float] = None

class TotalReturnRequest(BaseModel):
    ticker: str
    start_date: str
    end_date: Optional[str] = None
    reinvest_dividends: bool = True
    include_reinvestment: bool = True
    initial_investment: float = 10000.0
    
    @validator('ticker')
    def validate_ticker(cls, v):
        if not re.match(r'^[A-Z]{1,8}$', v.upper()):
            raise ValueError('Ticker must be 1-8 uppercase letters')
        return v.upper()
    
    @validator('start_date', 'end_date')
    def validate_dates(cls, v):
        if v is None:
            return v
        try:
            datetime.strptime(v, '%Y-%m-%d')
            return v
        except ValueError:
            raise ValueError('Date must be in YYYY-MM-DD format')
    
    @validator('initial_investment')
    def validate_investment(cls, v):
        if v <= 0 or v > 1000000:
            raise ValueError('Initial investment must be between $1 and $1,000,000')
        return v

class DividendHistoryRequest(BaseModel):
    ticker: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    
class DividendCalendarRequest(BaseModel):
    tickers: List[str]
    months_forward: int = 12

class TotalReturnResponse(BaseModel):
    status: str
    ticker: str
    start_date: str
    end_date: str
    price_return: float
    dividend_return: float
    total_return: float
    annualized_return: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    timestamp: Optional[str] = None
    execution_time: Optional[float] = None
    data: Optional[Dict[str, Any]] = None
    calculation_type: Optional[str] = None

class DividendResponse(BaseModel):
    status: str
    timestamp: str
    ticker: Optional[str] = None
    data: Optional[Any] = None
    metadata: Optional[Dict[str, Any]] = None
    execution_time: Optional[float] = None

# Performance tracking decorator
def track_performance(endpoint: str):
    """Decorator to track endpoint performance"""
    def decorator(func):
        async def wrapper(request=None, **kwargs):
            start_time = time.time()
            try:
                if request is not None:
                    result = await func(request, **kwargs)
                else:
                    result = await func(**kwargs)
                execution_time = time.time() - start_time
                logging.info(f"{endpoint} completed in {execution_time:.2f}s")
                return result
            except Exception as e:
                execution_time = time.time() - start_time
                logging.error(f"{endpoint} failed after {execution_time:.2f}s: {e}")
                raise
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator

# Root and health endpoints
@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "ETF Research Platform API - Async Version",
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "async_mode": ASYNC_MODE
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.2.0",
        "service": "ETF Research Platform API - Async",
        "async_mode": ASYNC_MODE,
        "parallel_fetch_mode": PARALLEL_FETCH_MODE
    }

# Async wrapper for synchronous data fetching
async def fetch_real_data_async(tickers: List[str], start_date: str, end_date: Optional[str]) -> Dict[str, Any]:
    """Fetch real data using our cached data fetcher with async support."""
    if not data_fetcher:
        raise HTTPException(
            status_code=503,
            detail="Data fetcher not initialized. Please check API keys and database configuration."
        )
    
    # Parse dates
    start_dt = datetime.strptime(start_date, '%Y-%m-%d')
    end_dt = datetime.strptime(end_date, '%Y-%m-%d') if end_date else datetime.now()
    
    # Wrap synchronous call with asyncio.to_thread for better concurrency
    # Add timeout protection (8 seconds to leave buffer for Vercel's 10s limit)
    try:
        results = await asyncio.wait_for(
            asyncio.to_thread(
                data_fetcher.fetch_multiple_tickers,
                tickers,
                start_dt,
                end_dt
            ),
            timeout=8.0
        )
        return results
    except asyncio.TimeoutError:
        logging.error(f"Timeout fetching data for {len(tickers)} tickers")
        raise HTTPException(
            status_code=504,
            detail="Request timeout - try fetching fewer tickers or a smaller date range"
        )

@app.post("/data/fetch")
async def fetch_ticker_data(request: DataFetchRequest):
    """
    Fetch ticker data using our resilient cached data fetching system.
    Only returns real data - no sample/fallback data.
    Phase 1: Basic async conversion with timeout protection.
    """
    try:
        start_time = datetime.now()
        
        # Fetch real data with async support
        results = await fetch_real_data_async(request.tickers, request.start_date, request.end_date)
        
        # Optionally fetch dividend data
        dividend_data = {}
        if request.include_dividends and total_return_calculator:
            try:
                # Parse dates
                start_dt = datetime.strptime(request.start_date, '%Y-%m-%d').date()
                end_dt = datetime.strptime(request.end_date, '%Y-%m-%d').date() if request.end_date else date.today()
                
                # Process dividends concurrently for all tickers
                dividend_tasks = []
                for ticker in request.tickers:
                    task = asyncio.create_task(
                        fetch_dividend_data_async(ticker.upper(), start_dt, end_dt)
                    )
                    dividend_tasks.append((ticker.upper(), task))
                
                # Wait for all dividend fetches with timeout
                try:
                    done_tasks = await asyncio.wait_for(
                        asyncio.gather(*[task for _, task in dividend_tasks], return_exceptions=True),
                        timeout=3.0  # 3 second timeout for dividend fetching
                    )
                    
                    for (ticker, _), result in zip(dividend_tasks, done_tasks):
                        if isinstance(result, Exception):
                            logging.warning(f"Failed to fetch dividends for {ticker}: {result}")
                            dividend_data[ticker] = {'error': str(result)}
                        else:
                            dividend_data[ticker] = result
                            
                except asyncio.TimeoutError:
                    logging.warning("Dividend fetching timed out")
                    
            except Exception as e:
                logging.error(f"Failed to fetch dividend data: {e}")
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        response_data = {
            "status": "success",
            "message": f"Successfully fetched data for {results.get('successful_tickers', 0)} tickers",
            "timestamp": datetime.now().isoformat(),
            "execution_time": execution_time,
            "data": results.get('data', {}),
            "metadata": {
                "execution_time": execution_time,
                "total_tickers": results.get('total_tickers', 0),
                "successful_tickers": results.get('successful_tickers', 0),
                "failed_tickers": results.get('failed_tickers', 0),
                "success_rate": results.get('successful_tickers', 0) / max(results.get('total_tickers', 1), 1),
                "failed_ticker_list": results.get('failed_ticker_list', []),
                "date_range": {
                    "start": request.start_date,
                    "end": request.end_date or datetime.now().strftime('%Y-%m-%d')
                },
                "async_mode": ASYNC_MODE
            },
            "data_sources_used": results.get('data_sources_used', []),
            "cache_hit_rate": results.get('cache_hit_rate', 0.0),
            "source_health": results.get('source_health', [])
        }
        
        # Add dividend data if requested
        if request.include_dividends and dividend_data:
            response_data['dividend_data'] = dividend_data
        
        return response_data
        
    except HTTPException:
        # Re-raise HTTP exceptions (like 503 from fetch_real_data)
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch ticker data: {str(e)}"
        )

async def fetch_dividend_data_async(ticker: str, start_dt: date, end_dt: date) -> Dict[str, Any]:
    """Async wrapper for fetching dividend data"""
    try:
        # Wrap synchronous call with asyncio.to_thread
        dividend_df = await asyncio.to_thread(
            total_return_calculator.fetch_and_cache_dividends,
            ticker,
            start_dt,
            end_dt
        )
        
        if not dividend_df.empty:
            # Convert to list of dicts
            dividends = dividend_df.to_dict('records')
            for div in dividends:
                if hasattr(div.get('ex_date'), 'isoformat'):
                    div['ex_date'] = div['ex_date'].isoformat()
                if hasattr(div.get('payment_date'), 'isoformat'):
                    div['payment_date'] = div['payment_date'].isoformat()
            
            return {
                'dividends': dividends,
                'total_dividends': float(dividend_df['dividend_amount'].sum()),
                'dividend_count': len(dividends)
            }
        else:
            return {
                'dividends': [],
                'total_dividends': 0.0,
                'dividend_count': 0
            }
    except Exception as e:
        logging.warning(f"Failed to fetch dividends for {ticker}: {e}")
        raise

@app.get("/data/health")
async def get_data_source_health():
    """Get health status of all data sources."""
    if not data_fetcher or not REAL_DATA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Data sources not available. Please check API keys and database configuration."
        )
    
    try:
        # Check if using parallel fetcher
        if PARALLEL_FETCH_MODE and hasattr(data_fetcher, 'get_source_health'):
            # Get health data from parallel fetcher
            source_health = data_fetcher.get_source_health()
            health_data = [
                {
                    'name': source_name,
                    'healthy': status['status'] == 'healthy',
                    'success_rate': f"{(status.get('success_rate', 0) * 100):.1f}%",
                    'total_requests': status.get('total_requests', 0),
                    'average_response_time': f"{status.get('avg_response_time', 0):.1f}s",
                    'consecutive_failures': status.get('consecutive_failures', 0),
                    'last_success': status.get('last_success'),
                    'last_failure': status.get('last_failure')
                }
                for source_name, status in source_health.items()
            ]
            
            # Get performance stats if available
            perf_stats = data_fetcher.get_performance_stats() if hasattr(data_fetcher, 'get_performance_stats') else {}
        else:
            # Traditional fetcher health data
            health_data = await asyncio.to_thread(lambda: [
                {
                    'name': source.name,
                    'healthy': source.is_available(),
                    'success_rate': '100.0%' if source.is_available() else '0.0%',
                    'total_requests': getattr(source, '_request_count', 0),
                    'average_response_time': '1.2s'
                }
                for source in data_fetcher.sources
            ])
            perf_stats = {}
        
        healthy_sources = sum(1 for source in health_data if source.get('healthy', False))
        total_sources = len(health_data)
        
        result = {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "overall_health": healthy_sources / max(total_sources, 1),
            "healthy_sources": healthy_sources,
            "total_sources": total_sources,
            "sources": health_data,
            "async_mode": ASYNC_MODE,
            "parallel_fetch_mode": PARALLEL_FETCH_MODE
        }
        
        # Add performance stats if available
        if perf_stats:
            result["performance_stats"] = perf_stats
        
        return result
    except Exception as e:
        logging.error(f"Failed to get source health: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get data source health: {str(e)}"
        )

@app.get("/cache/dashboard")
async def get_cache_dashboard():
    """Get comprehensive cache performance dashboard."""
    if not data_fetcher or not REAL_DATA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Cache dashboard not available. Please check database configuration."
        )
    
    try:
        dashboard = await asyncio.to_thread(data_fetcher.get_cache_dashboard)
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "async_mode": ASYNC_MODE,
            **dashboard
        }
    except Exception as e:
        logging.error(f"Failed to get cache dashboard: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache dashboard: {str(e)}"
        )

@app.get("/cache/stats/{ticker}")
async def get_ticker_cache_stats(ticker: str):
    """Get cache statistics for a specific ticker."""
    if not data_fetcher or not REAL_DATA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Cache statistics not available. Please check database configuration."
        )
    
    try:
        stats = await asyncio.to_thread(
            data_fetcher.cache.get_cache_stats,
            ticker.upper()
        )
        
        if stats:
            stat = stats[0]
            return {
                "status": "success",
                "timestamp": datetime.now().isoformat(),
                "ticker": stat.ticker,
                "total_records": stat.total_records,
                "coverage_percentage": stat.coverage_percentage,
                "first_date": stat.first_date.isoformat() if stat.first_date else None,
                "last_date": stat.last_date.isoformat() if stat.last_date else None,
                "freshness_status": stat.freshness_status,
                "cached_ranges": stat.cached_ranges,
                "async_mode": ASYNC_MODE
            }
        else:
            return {
                "status": "success",
                "timestamp": datetime.now().isoformat(),
                "ticker": ticker.upper(),
                "message": "No cache data found for this ticker",
                "async_mode": ASYNC_MODE
            }
    except Exception as e:
        logging.error(f"Failed to get cache stats for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache stats for {ticker}: {str(e)}"
        )

@app.post("/cache/optimize")
async def get_cache_optimization(request: DataFetchRequest):
    """Get cache optimization analysis for a data request."""
    if not data_fetcher or not REAL_DATA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Cache optimization not available. Please check database configuration."
        )
    
    try:
        start_date = datetime.strptime(request.start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(request.end_date, '%Y-%m-%d').date() if request.end_date else datetime.now().date()
        
        # Process optimizations concurrently
        optimization_tasks = []
        for ticker in request.tickers:
            task = asyncio.create_task(
                asyncio.to_thread(
                    data_fetcher.cache.optimize_api_usage,
                    ticker.upper(),
                    start_date,
                    end_date
                )
            )
            optimization_tasks.append((ticker.upper(), task))
        
        # Wait for all optimizations
        optimizations = {}
        for ticker, task in optimization_tasks:
            try:
                optimization = await task
                optimizations[ticker] = optimization
            except Exception as e:
                logging.error(f"Failed to optimize {ticker}: {e}")
                optimizations[ticker] = {"error": str(e)}
        
        return {
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "optimizations": optimizations,
            "async_mode": ASYNC_MODE
        }
    except Exception as e:
        logging.error(f"Failed to get cache optimization: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get cache optimization: {str(e)}"
        )

@app.get("/errors/summary")
async def get_error_summary():
    """Get summary of errors encountered during data fetching."""
    return {
        "status": "success",
        "timestamp": datetime.now().isoformat(),
        "error_summary": error_handler.get_error_summary(),
        "async_mode": ASYNC_MODE
    }

# Dividend and Total Return Endpoints
@app.get("/dividends/{ticker}")
async def get_dividend_history(ticker: str, years: int = 5):
    # Input validation
    if not re.match(r'^[A-Z]{1,8}$', ticker.upper()):
        raise HTTPException(status_code=400, detail="Invalid ticker format")
    if years < 1 or years > 20:
        raise HTTPException(status_code=400, detail="Years must be between 1 and 20")
    
    ticker = ticker.upper()
    """Get dividend history for a ticker."""
    if not total_return_calculator:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator not available. Please check configuration."
        )
    
    try:
        start_time = datetime.now()
        end_date = date.today()
        start_date = end_date - timedelta(days=years * 365)
        
        # Fetch dividend data with timeout protection
        try:
            dividend_df = await asyncio.wait_for(
                asyncio.to_thread(
                    total_return_calculator.fetch_and_cache_dividends,
                    ticker.upper(),
                    start_date,
                    end_date
                ),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Timeout fetching dividend history"
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        if dividend_df.empty:
            return DividendResponse(
                status="success",
                message=f"No dividend history found for {ticker}",
                timestamp=datetime.now().isoformat(),
                execution_time=execution_time,
                data={"ticker": ticker.upper(), "dividends": []}
            )
        
        # Convert DataFrame to list of dicts
        dividends = dividend_df.to_dict('records')
        for div in dividends:
            if hasattr(div.get('ex_date'), 'isoformat'):
                div['ex_date'] = div['ex_date'].isoformat()
            if hasattr(div.get('payment_date'), 'isoformat'):
                div['payment_date'] = div['payment_date'].isoformat()
        
        return DividendResponse(
            status="success",
            message=f"Retrieved {len(dividends)} dividend records for {ticker}",
            timestamp=datetime.now().isoformat(),
            execution_time=execution_time,
            data={
                "ticker": ticker.upper(),
                "dividends": dividends,
                "total_dividends": float(dividend_df['dividend_amount'].sum()),
                "dividend_count": len(dividends),
                "async_mode": ASYNC_MODE
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get dividend history for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while fetching dividend history"
        )

@app.get("/returns/{ticker}")
async def get_total_returns(ticker: str, start_date: str, end_date: str, include_reinvestment: bool = False):
    """Get total returns including dividends for a ticker."""
    if not total_return_calculator:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator not available. Please check configuration."
        )
    
    try:
        start_time = datetime.now()
        
        # Calculate returns with timeout protection
        try:
            if include_reinvestment:
                metrics = await asyncio.wait_for(
                    asyncio.to_thread(
                        total_return_calculator.calculate_dividend_reinvested_return,
                        ticker.upper(),
                        start_date,
                        end_date
                    ),
                    timeout=8.0
                )
                calculation_type = "dividend_reinvested"
            else:
                metrics = await asyncio.wait_for(
                    asyncio.to_thread(
                        total_return_calculator.calculate_simple_total_return,
                        ticker.upper(),
                        start_date,
                        end_date
                    ),
                    timeout=8.0
                )
                calculation_type = "simple_total_return"
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Timeout calculating returns"
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Convert metrics to dict
        data = total_return_calculator.export_results(metrics, format='dict')
        
        # Format dates in response
        if 'start_date' in data and hasattr(data['start_date'], 'isoformat'):
            data['start_date'] = data['start_date'].isoformat()
        if 'end_date' in data and hasattr(data['end_date'], 'isoformat'):
            data['end_date'] = data['end_date'].isoformat()
        
        data['async_mode'] = ASYNC_MODE
        
        return TotalReturnResponse(
            status="success",
            message=f"Total return calculated for {ticker}",
            timestamp=datetime.now().isoformat(),
            execution_time=execution_time,
            data=data,
            calculation_type=calculation_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to calculate total returns for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while calculating total returns"
        )

@app.post("/returns/calculate")
async def calculate_custom_returns(request: TotalReturnRequest):
    """Calculate custom return scenarios with dividends."""
    if not total_return_calculator:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator not available. Please check configuration."
        )
    
    try:
        start_time = datetime.now()
        
        # Calculate returns with timeout protection
        try:
            if request.include_reinvestment:
                metrics = await asyncio.wait_for(
                    asyncio.to_thread(
                        total_return_calculator.calculate_dividend_reinvested_return,
                        request.ticker.upper(),
                        request.start_date,
                        request.end_date,
                        request.initial_investment
                    ),
                    timeout=8.0
                )
                calculation_type = "dividend_reinvested"
            else:
                metrics = await asyncio.wait_for(
                    asyncio.to_thread(
                        total_return_calculator.calculate_simple_total_return,
                        request.ticker.upper(),
                        request.start_date,
                        request.end_date
                    ),
                    timeout=8.0
                )
                calculation_type = "simple_total_return"
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Timeout calculating returns"
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        # Convert metrics to dict
        data = total_return_calculator.export_results(metrics, format='dict')
        
        # Format dates in response
        if 'start_date' in data and hasattr(data['start_date'], 'isoformat'):
            data['start_date'] = data['start_date'].isoformat()
        if 'end_date' in data and hasattr(data['end_date'], 'isoformat'):
            data['end_date'] = data['end_date'].isoformat()
        
        # Add comparison data if reinvestment was calculated
        if request.include_reinvestment and hasattr(metrics, 'reinvested_return'):
            data['comparison'] = {
                'simple_return': metrics.total_return,
                'reinvested_return': metrics.reinvested_return,
                'benefit_of_reinvestment': metrics.reinvested_return - metrics.total_return
            }
        
        data['async_mode'] = ASYNC_MODE
        
        return TotalReturnResponse(
            status="success",
            message=f"Custom return calculation completed for {request.ticker}",
            timestamp=datetime.now().isoformat(),
            execution_time=execution_time,
            data=data,
            calculation_type=calculation_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to calculate custom returns: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error while calculating custom returns"
        )

@app.get("/dividends/calendar/{ticker}")
async def get_dividend_calendar(ticker: str, days_ahead: int = 30):
    """Get dividend calendar for a ticker."""
    if not total_return_calculator:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator not available. Please check configuration."
        )
    
    try:
        start_time = datetime.now()
        
        # Get dividend calendar with timeout protection
        try:
            calendar_df = await asyncio.wait_for(
                asyncio.to_thread(
                    total_return_calculator.get_dividend_calendar,
                    [ticker.upper()],
                    days_ahead
                ),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Timeout fetching dividend calendar"
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        if calendar_df.empty:
            return DividendResponse(
                status="success",
                message=f"No upcoming dividends found for {ticker}",
                timestamp=datetime.now().isoformat(),
                execution_time=execution_time,
                data=[],
                metadata={
                    "ticker": ticker.upper(),
                    "days_ahead": days_ahead,
                    "period_start": date.today().isoformat(),
                    "period_end": (date.today() + timedelta(days=days_ahead)).isoformat(),
                    "async_mode": ASYNC_MODE
                }
            )
        
        # Convert DataFrame to list of dicts
        calendar_data = calendar_df.to_dict('records')
        for item in calendar_data:
            # Convert timestamps to strings
            for date_field in ['estimated_ex_date', 'last_ex_date']:
                if date_field in item and hasattr(item[date_field], 'isoformat'):
                    item[date_field] = item[date_field].isoformat()
        
        return DividendResponse(
            status="success",
            message=f"Dividend calendar retrieved for {ticker}",
            timestamp=datetime.now().isoformat(),
            execution_time=execution_time,
            data=calendar_data,
            metadata={
                "ticker": ticker.upper(),
                "days_ahead": days_ahead,
                "period_start": date.today().isoformat(),
                "period_end": (date.today() + timedelta(days=days_ahead)).isoformat(),
                "events_found": len(calendar_data),
                "async_mode": ASYNC_MODE
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get dividend calendar for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dividend calendar: {str(e)}"
        )

@app.get("/dividends/yield/{ticker}")
async def get_dividend_yield(ticker: str, years: int = 5):
    """Get current yield and dividend metrics for a ticker."""
    if not total_return_calculator:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator not available. Please check configuration."
        )
    
    try:
        start_time = datetime.now()
        
        # Get dividend metrics with timeout protection
        try:
            metrics = await asyncio.wait_for(
                asyncio.to_thread(
                    total_return_calculator.calculate_dividend_metrics,
                    ticker.upper(),
                    years
                ),
                timeout=5.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Timeout calculating dividend metrics"
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        if 'error' in metrics:
            raise HTTPException(
                status_code=500,
                detail=metrics['error']
            )
        
        metrics['async_mode'] = ASYNC_MODE
        
        return DividendResponse(
            status="success",
            message=f"Dividend metrics calculated for {ticker}",
            timestamp=datetime.now().isoformat(),
            execution_time=execution_time,
            data=metrics
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get dividend yield for {ticker}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dividend yield: {str(e)}"
        )

@app.post("/dividends/calendar")
async def get_multi_ticker_dividend_calendar(request: DividendCalendarRequest):
    """Get dividend calendar for multiple tickers."""
    if not total_return_calculator:
        raise HTTPException(
            status_code=503,
            detail="Total return calculator not available. Please check configuration."
        )
    
    try:
        start_time = datetime.now()
        
        # Get dividend calendar for all tickers with timeout protection
        try:
            calendar_df = await asyncio.wait_for(
                asyncio.to_thread(
                    total_return_calculator.get_dividend_calendar,
                    [ticker.upper() for ticker in request.tickers],
                    request.days_ahead
                ),
                timeout=8.0
            )
        except asyncio.TimeoutError:
            raise HTTPException(
                status_code=504,
                detail="Timeout fetching dividend calendar"
            )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        if calendar_df.empty:
            calendar_data = []
        else:
            # Convert DataFrame to list of dicts
            calendar_data = calendar_df.to_dict('records')
            for item in calendar_data:
                # Convert timestamps to strings
                for date_field in ['estimated_ex_date', 'last_ex_date']:
                    if date_field in item and hasattr(item[date_field], 'isoformat'):
                        item[date_field] = item[date_field].isoformat()
        
        return DividendResponse(
            status="success",
            message="Multi-ticker dividend calendar generated",
            timestamp=datetime.now().isoformat(),
            execution_time=execution_time,
            data=calendar_data,
            metadata={
                "tickers_analyzed": len(request.tickers),
                "days_ahead": request.days_ahead,
                "period_start": date.today().isoformat(),
                "period_end": (date.today() + timedelta(days=request.days_ahead)).isoformat(),
                "events_found": len(calendar_data),
                "async_mode": ASYNC_MODE
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Failed to get multi-ticker dividend calendar: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get dividend calendar: {str(e)}"
        )

# For Vercel, we need to expose the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)