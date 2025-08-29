"""
Pydantic response models for ETF Research Platform API.
Provides consistent response structure and type safety.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from enum import Enum

class ResponseStatus(str, Enum):
    """Possible response statuses."""
    SUCCESS = "success"
    ERROR = "error"
    PROCESSING = "processing"
    PARTIAL = "partial"

class APIResponse(BaseModel):
    """Base response model for all API endpoints."""
    status: ResponseStatus = Field(..., description="Response status")
    message: Optional[str] = Field(None, description="Human-readable message")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")
    execution_time: Optional[float] = Field(None, description="Execution time in seconds")

class ErrorResponse(APIResponse):
    """Error response model."""
    status: ResponseStatus = ResponseStatus.ERROR
    error_code: Optional[str] = Field(None, description="Machine-readable error code")
    detail: Optional[str] = Field(None, description="Detailed error information")
    errors: List[str] = Field(default=[], description="List of specific errors")

class DataSourceHealth(BaseModel):
    """Health status of a data source."""
    name: str = Field(..., description="Data source name")
    healthy: bool = Field(..., description="Whether source is healthy")
    success_rate: str = Field(..., description="Success rate percentage")
    total_requests: int = Field(..., description="Total requests made")
    average_response_time: str = Field(..., description="Average response time")
    last_error: Optional[str] = Field(None, description="Last error message if any")

class DataFetchResponse(APIResponse):
    """Response for data fetching operations."""
    data: Dict[str, Any] = Field(..., description="Fetched ticker data")
    metadata: Dict[str, Any] = Field(default={}, description="Metadata about the fetch operation")
    data_sources_used: List[str] = Field(default=[], description="Data sources that provided data")
    cache_hit_rate: Optional[float] = Field(None, description="Cache hit rate (0.0 to 1.0)")
    source_health: List[DataSourceHealth] = Field(default=[], description="Health status of data sources")

class OptimizationResult(BaseModel):
    """Portfolio optimization result."""
    weights: Dict[str, float] = Field(..., description="Optimal portfolio weights")
    expected_return: float = Field(..., description="Expected annual return")
    volatility: float = Field(..., description="Expected annual volatility")
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    method_used: str = Field(..., description="Optimization method used")

class EfficientFrontierPoint(BaseModel):
    """Single point on the efficient frontier."""
    return_: float = Field(..., alias="return", description="Expected return")
    volatility: float = Field(..., description="Expected volatility")
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    weights: Dict[str, float] = Field(..., description="Portfolio weights")

class OptimizationResponse(APIResponse):
    """Response for portfolio optimization."""
    result: Union[OptimizationResult, List[EfficientFrontierPoint]] = Field(
        ..., 
        description="Optimization result (single portfolio or efficient frontier)"
    )
    input_data_summary: Dict[str, Any] = Field(
        default={}, 
        description="Summary of input data used"
    )

class PerformanceMetrics(BaseModel):
    """Portfolio performance metrics."""
    total_return: float = Field(..., description="Total return")
    annualized_return: float = Field(..., description="Annualized return")
    volatility: float = Field(..., description="Annualized volatility")
    sharpe_ratio: float = Field(..., description="Sharpe ratio")
    max_drawdown: float = Field(..., description="Maximum drawdown")
    calmar_ratio: float = Field(..., description="Calmar ratio")
    sortino_ratio: float = Field(..., description="Sortino ratio")
    var_95: float = Field(..., description="Value at Risk (95%)")
    cvar_95: float = Field(..., description="Conditional Value at Risk (95%)")

class BacktestResult(BaseModel):
    """Backtest result for a single strategy."""
    strategy_name: str = Field(..., description="Name of the strategy")
    final_value: float = Field(..., description="Final portfolio value")
    metrics: PerformanceMetrics = Field(..., description="Performance metrics")
    portfolio_history: List[Dict[str, Any]] = Field(
        default=[], 
        description="Daily portfolio values and positions"
    )
    transactions: List[Dict[str, Any]] = Field(
        default=[], 
        description="All transactions made during backtest"
    )

class BacktestResponse(APIResponse):
    """Response for backtesting operations."""
    result: Union[BacktestResult, List[BacktestResult]] = Field(
        ..., 
        description="Backtest result(s)"
    )
    benchmark_data: Optional[Dict[str, Any]] = Field(
        None, 
        description="Benchmark performance data"
    )

class CorrelationMatrix(BaseModel):
    """Correlation matrix data."""
    matrix: Dict[str, Dict[str, float]] = Field(..., description="Correlation matrix")
    tickers: List[str] = Field(..., description="List of tickers in matrix")

class RiskMetrics(BaseModel):
    """Risk metrics for a portfolio or asset."""
    ticker: str = Field(..., description="Ticker symbol")
    volatility: float = Field(..., description="Annualized volatility")
    var_95: float = Field(..., description="Value at Risk (95%)")
    cvar_95: float = Field(..., description="Conditional Value at Risk (95%)")
    beta: Optional[float] = Field(None, description="Beta vs benchmark")
    max_drawdown: float = Field(..., description="Maximum drawdown")

class AnalyticsResponse(APIResponse):
    """Response for analytics operations."""
    analysis_type: str = Field(..., description="Type of analysis performed")
    result: Union[CorrelationMatrix, List[RiskMetrics], Dict[str, Any]] = Field(
        ..., 
        description="Analysis results"
    )
    summary_stats: Dict[str, Any] = Field(
        default={}, 
        description="Summary statistics"
    )

class ChartData(BaseModel):
    """Chart data and metadata."""
    chart_type: str = Field(..., description="Type of chart generated")
    data: Dict[str, Any] = Field(..., description="Chart data in JSON format")
    image_url: Optional[str] = Field(None, description="URL to generated chart image")
    download_url: Optional[str] = Field(None, description="URL to download chart")

class VisualizationResponse(APIResponse):
    """Response for visualization operations."""
    chart: ChartData = Field(..., description="Generated chart data")
    format: str = Field(..., description="Output format")
    size: Dict[str, float] = Field(..., description="Chart dimensions")

class HealthCheckResponse(APIResponse):
    """Health check response."""
    service: str = Field(..., description="Service name")
    version: str = Field(..., description="Service version")
    uptime: Optional[float] = Field(None, description="Service uptime in seconds")
    data_sources: List[DataSourceHealth] = Field(
        default=[], 
        description="Health status of all data sources"
    )