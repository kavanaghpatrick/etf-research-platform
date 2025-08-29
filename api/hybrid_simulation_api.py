"""
API endpoints for Hybrid Econometric Simulation Engine
Integration with existing FastAPI backend
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, validator, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
import logging
import asyncio
import pandas as pd
import numpy as np
import json
import uuid
import time
from pathlib import Path

from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig, SimulationResults
from hybrid_simulation.validation.distribution_validation import DistributionValidation, ValidationReport
from hybrid_simulation.benchmarking.performance_benchmarks import PerformanceBenchmarks, BenchmarkConfig
from service_dependencies import get_data_fetcher

logger = logging.getLogger(__name__)

# Create router for hybrid simulation endpoints
router = APIRouter(prefix="/api/hybrid-simulation", tags=["hybrid-simulation"])

# Background task storage for long-running simulations
simulation_tasks = {}


class HybridSimulationRequest(BaseModel):
    """Request model for hybrid econometric simulation"""
    tickers: List[str] = Field(..., description="List of ticker symbols")
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")
    n_simulations: int = Field(10000, ge=1000, le=100000, description="Number of simulation paths")
    time_horizon_years: int = Field(10, ge=1, le=50, description="Investment time horizon in years")
    initial_portfolio_value: float = Field(100000.0, gt=0, description="Initial portfolio value")
    portfolio_weights: Optional[List[float]] = Field(None, description="Portfolio weights (will be equal-weighted if not provided)")
    
    # Advanced configuration
    var_max_lags: int = Field(5, ge=1, le=20, description="Maximum lags for VAR model selection")
    garch_distribution: str = Field("normal", description="GARCH error distribution")
    bootstrap_block_length: Optional[int] = Field(None, description="Bootstrap block length (auto-selected if None)")
    preserve_mean: bool = Field(True, description="Preserve historical mean in bootstrap")
    use_parallel: bool = Field(True, description="Enable parallel processing")
    max_workers: Optional[int] = Field(None, description="Maximum parallel workers")
    random_seed: Optional[int] = Field(None, description="Random seed for reproducibility")
    use_gpu: bool = Field(True, description="Enable M4 GPU acceleration via MLX")
    gpu_memory_fraction: float = Field(0.8, ge=0.1, le=0.95, description="GPU memory usage fraction")
    
    # Validation options
    enable_validation: bool = Field(True, description="Enable distribution validation")
    run_benchmarks: bool = Field(False, description="Run performance benchmarks")
    
    @validator('tickers')
    def validate_tickers(cls, v):
        if not v:
            raise ValueError("At least one ticker is required")
        if len(v) > 20:
            raise ValueError("Maximum 20 tickers allowed")
        return [ticker.upper().strip() for ticker in v]
    
    @validator('portfolio_weights')
    def validate_weights(cls, v, values):
        if v is not None:
            if 'tickers' in values and len(v) != len(values['tickers']):
                raise ValueError("Number of weights must match number of tickers")
            if abs(sum(v) - 1.0) > 0.01:
                raise ValueError("Portfolio weights must sum to 1.0")
            if any(w < 0 for w in v):
                raise ValueError("Portfolio weights must be non-negative")
        return v
    
    @validator('garch_distribution')
    def validate_distribution(cls, v):
        valid_distributions = ['normal', 't', 'skewt']
        if v.lower() not in valid_distributions:
            raise ValueError(f"Distribution must be one of: {valid_distributions}")
        return v.lower()


class HybridSimulationResponse(BaseModel):
    """Response model for hybrid econometric simulation"""
    task_id: str
    status: str
    message: str
    estimated_completion_time: Optional[str] = None


class SimulationResultsResponse(BaseModel):
    """Response model for simulation results"""
    task_id: str
    status: str
    simulation_config: Dict[str, Any]
    results: Optional[Dict[str, Any]] = None
    validation_report: Optional[Dict[str, Any]] = None
    benchmark_report: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time: Optional[float] = None


class ValidationRequest(BaseModel):
    """Request model for standalone validation"""
    simulation_results: List[float] = Field(..., description="Simulation results to validate")
    historical_data: List[float] = Field(..., description="Historical data for comparison")
    bootstrap_results: Optional[List[float]] = Field(None, description="Original bootstrap results for bias analysis")


@router.post("/simulate-test")
async def run_hybrid_simulation_test(
    request: HybridSimulationRequest
):
    """Test simulation endpoint without background tasks"""
    logger.info("[HYBRID_SIM_TEST] Test simulation called")
    return {"status": "ok", "request_received": True, "tickers": request.tickers}

@router.post("/simulate", response_model=HybridSimulationResponse)
async def run_hybrid_simulation(
    request: HybridSimulationRequest,
    background_tasks: BackgroundTasks,
    data_fetcher=Depends(get_data_fetcher)
):
    """
    Run hybrid econometric simulation
    
    This endpoint runs a bias-free portfolio simulation using the Hybrid Econometric 
    Simulation Engine, which combines VAR models, GARCH volatility, and stationary 
    block bootstrap to eliminate the crisis concentration issues found in traditional 
    Monte Carlo bootstrap methods.
    """
    logger.info("[HYBRID_SIM] Endpoint called - before try block")
    try:
        # Generate unique task ID
        task_id = str(uuid.uuid4())
        logger.info(f"[HYBRID_SIM] Starting hybrid simulation with task_id: {task_id}")
        logger.info(f"[HYBRID_SIM] Request parameters: tickers={request.tickers}, n_simulations={request.n_simulations}, time_horizon={request.time_horizon_years}")
        logger.info(f"[HYBRID_SIM] Advanced config: var_max_lags={request.var_max_lags}, garch_dist={request.garch_distribution}, parallel={request.use_parallel}")
        
        # Initialize task status
        simulation_tasks[task_id] = {
            'status': 'initializing',
            'message': 'Preparing simulation...',
            'created_at': datetime.utcnow(),
            'request': request.dict()
        }
        logger.info(f"[HYBRID_SIM] Task {task_id} initialized in memory")
        
        # Estimate completion time based on simulation size
        estimated_seconds = estimate_simulation_time(request.n_simulations, request.time_horizon_years, len(request.tickers))
        estimated_completion = datetime.utcnow().timestamp() + estimated_seconds
        logger.info(f"[HYBRID_SIM] Estimated completion time: {estimated_seconds} seconds")
        
        # Schedule background task
        logger.info(f"[HYBRID_SIM] Scheduling background task for {task_id}")
        background_tasks.add_task(
            execute_hybrid_simulation,
            task_id,
            request,
            data_fetcher
        )
        logger.info(f"[HYBRID_SIM] Background task scheduled successfully for {task_id}")
        
        return HybridSimulationResponse(
            task_id=task_id,
            status="started",
            message=f"Hybrid simulation started for {len(request.tickers)} assets with {request.n_simulations:,} paths",
            estimated_completion_time=datetime.fromtimestamp(estimated_completion).isoformat()
        )
        
    except Exception as e:
        logger.error(f"Failed to start hybrid simulation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}", response_model=SimulationResultsResponse)
async def get_simulation_status(task_id: str):
    """Get status and results of a simulation task"""
    
    logger.info(f"[HYBRID_SIM_STATUS] Status check for task_id: {task_id}")
    
    if task_id not in simulation_tasks:
        logger.warning(f"[HYBRID_SIM_STATUS] Task {task_id} not found in memory")
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = simulation_tasks[task_id]
    logger.info(f"[HYBRID_SIM_STATUS] Task {task_id} current status: {task['status']}, message: {task.get('message', 'N/A')}")
    
    return SimulationResultsResponse(
        task_id=task_id,
        status=task['status'],
        simulation_config=task.get('request', {}),
        results=task.get('results'),
        validation_report=task.get('validation_report'),
        benchmark_report=task.get('benchmark_report'),
        error=task.get('error'),
        execution_time=task.get('execution_time')
    )


@router.post("/validate", response_model=Dict[str, Any])
async def validate_simulation_results(request: ValidationRequest):
    """
    Standalone validation of simulation results
    
    Compare simulation results against historical data using statistical tests
    and bias analysis to ensure the hybrid engine is producing valid results.
    """
    try:
        # Initialize validation framework
        validator = DistributionValidation()
        
        # Convert lists to numpy arrays
        simulation_array = np.array(request.simulation_results)
        historical_array = np.array(request.historical_data)
        bootstrap_array = np.array(request.bootstrap_results) if request.bootstrap_results else None
        
        # Run validation
        validation_report = validator.validate_simulation_results(
            simulation_array,
            historical_array,
            bootstrap_array
        )
        
        # Generate human-readable report
        report_text = validator.generate_validation_report(validation_report)
        
        return {
            'validation_passed': validation_report.passed_validation,
            'overall_score': validation_report.overall_score,
            'test_results': [
                {
                    'test_name': test.test_name,
                    'passed': test.passed,
                    'p_value': test.p_value,
                    'test_statistic': test.test_statistic
                }
                for test in validation_report.validation_tests
            ],
            'bias_analysis': [
                {
                    'metric': analysis.metric,
                    'bias_reduction_percent': analysis.bias_reduction_percent,
                    'improvement_score': analysis.improvement_score
                }
                for analysis in validation_report.bias_analysis
            ],
            'recommendations': validation_report.recommendations,
            'detailed_report': report_text
        }
        
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/benchmark")
async def run_performance_benchmark(
    config: Optional[Dict[str, Any]] = None,
    background_tasks: BackgroundTasks = None
):
    """
    Run performance benchmarks for the hybrid simulation engine
    
    Test scalability, memory usage, and performance characteristics
    across different simulation configurations.
    """
    try:
        # Generate test data for benchmarking
        test_data = generate_benchmark_test_data()
        
        # Initialize benchmarking suite
        benchmarks = PerformanceBenchmarks()
        
        # Configure benchmark parameters
        if config:
            benchmark_config = BenchmarkConfig(**config)
        else:
            benchmark_config = BenchmarkConfig()
        
        # Run benchmarks
        benchmark_report = benchmarks.run_comprehensive_benchmarks(test_data, benchmark_config)
        
        # Generate human-readable report
        report_text = benchmarks.generate_benchmark_report(benchmark_report)
        
        return {
            'overall_performance_score': benchmark_report.execution_summary['overall_performance_score'],
            'mvp_compliance': benchmark_report.mvp_compliance,
            'scaling_analysis': benchmark_report.scaling_analysis,
            'optimization_recommendations': benchmark_report.optimization_recommendations,
            'detailed_report': report_text,
            'execution_summary': benchmark_report.execution_summary
        }
        
    except Exception as e:
        logger.error(f"Benchmark failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify API is working"""
    logger.info("[HYBRID_SIM_TEST] Test endpoint called")
    return {"status": "ok", "message": "Hybrid simulation API is working"}

@router.get("/test-dependency")
async def test_with_dependency(data_fetcher=Depends(get_data_fetcher)):
    """Test endpoint with data fetcher dependency"""
    logger.info("[HYBRID_SIM_TEST] Test endpoint with dependency called")
    logger.info(f"[HYBRID_SIM_TEST] Data fetcher type: {type(data_fetcher)}")
    return {"status": "ok", "message": "Dependency injection working", "data_fetcher_type": str(type(data_fetcher))}

@router.get("/tasks")
async def list_simulation_tasks():
    """List all simulation tasks and their status"""
    
    task_list = []
    for task_id, task in simulation_tasks.items():
        task_list.append({
            'task_id': task_id,
            'status': task['status'],
            'created_at': task['created_at'].isoformat(),
            'message': task.get('message', ''),
            'tickers': task.get('request', {}).get('tickers', []),
            'n_simulations': task.get('request', {}).get('n_simulations', 0)
        })
    
    return {'tasks': task_list}


@router.delete("/tasks/{task_id}")
async def cancel_simulation_task(task_id: str):
    """Cancel a running simulation task"""
    
    if task_id not in simulation_tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task = simulation_tasks[task_id]
    
    if task['status'] in ['completed', 'failed']:
        raise HTTPException(status_code=400, detail="Task is already finished")
    
    # Mark task as cancelled
    task['status'] = 'cancelled'
    task['message'] = 'Task cancelled by user'
    
    return {'message': f'Task {task_id} cancelled'}


async def execute_hybrid_simulation(task_id: str, request: HybridSimulationRequest, data_fetcher_instance):
    """Execute hybrid simulation in background"""
    
    logger.info(f"[HYBRID_SIM_EXEC] Starting background execution for task {task_id}")
    
    try:
        # Update task status with progress
        simulation_tasks[task_id].update({
            'status': 'fetching_data',
            'message': 'Fetching historical data...',
            'progress': 10
        })
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Status updated to 'fetching_data' with progress 10%")
        
        # Fetch historical data
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Starting data fetch for tickers: {request.tickers}")
        historical_data = await fetch_simulation_data(request, data_fetcher_instance)
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Data fetched successfully, shape: {historical_data.shape}")
        
        # Update task status with progress
        simulation_tasks[task_id].update({
            'status': 'fitting_models',
            'message': 'Fitting econometric models...',
            'progress': 30
        })
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Status updated to 'fitting_models' with progress 30%")
        
        # Initialize hybrid engine with GPU acceleration
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Initializing hybrid engine with GPU={request.use_gpu}")
        engine = HybridEconometricEngine(
            numerical_stability=True, 
            enable_caching=True, 
            enable_gpu=request.use_gpu
        )
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Hybrid engine initialized (GPU: {engine.enable_gpu})")
        
        # Configure simulation
        config = SimulationConfig(
            n_simulations=request.n_simulations,
            time_horizon_years=request.time_horizon_years,
            initial_portfolio_value=request.initial_portfolio_value,
            portfolio_weights=request.portfolio_weights,
            var_max_lags=request.var_max_lags,
            garch_distribution=request.garch_distribution,
            bootstrap_block_length=request.bootstrap_block_length,
            preserve_mean=request.preserve_mean,
            use_parallel=request.use_parallel,
            max_workers=request.max_workers,
            random_seed=request.random_seed,
            use_gpu=request.use_gpu,
            gpu_memory_fraction=request.gpu_memory_fraction
        )
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Simulation config created")
        
        # Fit models
        start_time = time.time()
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Starting model fitting (VAR + GARCH)")
        fit_summary = engine.fit_models(historical_data, config)
        fitting_time = time.time() - start_time
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Model fitting completed in {fitting_time:.2f}s")
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Fit summary: {fit_summary}")
        
        # Update task status with progress
        simulation_tasks[task_id].update({
            'status': 'running_simulation',
            'message': f'Running {request.n_simulations:,} simulation paths...',
            'progress': 50
        })
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Status updated to 'running_simulation' with progress 50%")
        
        # Run simulation
        simulation_start = time.time()
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Starting simulation with {request.n_simulations} paths")
        results = engine.simulate(config)
        simulation_time = time.time() - simulation_start
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Simulation completed in {simulation_time:.2f}s")
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Results type: {type(results)}")
        
        # Process results
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Processing simulation results")
        simulation_results = process_simulation_results(results, request.tickers)
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Results processed successfully")
        
        execution_time = time.time() - start_time
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Total execution time: {execution_time:.2f}s")
        
        # Run validation if requested
        validation_report = None
        if request.enable_validation:
            simulation_tasks[task_id].update({
                'message': 'Running validation tests...',
                'progress': 90
            })
            validation_report = await run_validation_analysis(results, historical_data)
        
        # Run benchmarks if requested
        benchmark_report = None
        if request.run_benchmarks:
            simulation_tasks[task_id]['message'] = 'Running performance benchmarks...'
            benchmark_report = await run_benchmark_analysis(historical_data.values, config)
        
        # Store results
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - Storing final results")
        simulation_tasks[task_id].update({
            'status': 'completed',
            'message': 'Simulation completed successfully',
            'progress': 100,  # Add completion progress
            'results': simulation_results,
            'validation_report': validation_report,
            'benchmark_report': benchmark_report,
            'execution_time': execution_time,
            'fit_summary': {
                'fitting_time': fit_summary['fitting_time'],
                'n_assets': fit_summary['n_assets'],
                'n_observations': fit_summary['n_observations'],
                'convergence_summary': fit_summary['convergence_summary']
            }
        })
        logger.info(f"[HYBRID_SIM_EXEC] Task {task_id} - COMPLETED SUCCESSFULLY")
        
    except Exception as e:
        logger.error(f"[HYBRID_SIM_EXEC] Task {task_id} - FAILED: {str(e)}", exc_info=True)
        simulation_tasks[task_id].update({
            'status': 'failed',
            'message': f'Simulation failed: {str(e)}',
            'error': str(e)
        })
        logger.error(f"[HYBRID_SIM_EXEC] Task {task_id} - Error details stored in task status")


async def fetch_simulation_data(request: HybridSimulationRequest, data_fetcher) -> pd.DataFrame:
    """Fetch historical data for simulation"""
    
    logger.info(f"[FETCH_DATA] Starting data fetch for tickers: {request.tickers}")
    
    try:
        # Convert dates
        start_date = datetime.strptime(request.start_date, '%Y-%m-%d').date()
        end_date = datetime.strptime(request.end_date, '%Y-%m-%d').date()
        logger.info(f"[FETCH_DATA] Date range: {start_date} to {end_date}")
        
        # Fetch data for all tickers
        all_data = {}
        
        for ticker in request.tickers:
            try:
                logger.info(f"[FETCH_DATA] Fetching data for ticker: {ticker}")
                # Fetch historical price data
                fetch_result = await asyncio.to_thread(
                    data_fetcher.fetch_ticker_data,
                    ticker=ticker,
                    start_date=start_date,
                    end_date=end_date
                )
                logger.info(f"[FETCH_DATA] Data fetched for {ticker}, result type: {type(fetch_result)}")
                
                if fetch_result is not None and fetch_result.data is not None and not fetch_result.data.empty:
                    # Calculate returns
                    prices = fetch_result.data['Close'].dropna()
                    returns = prices.pct_change().dropna()
                    
                    # Store returns for this ticker
                    all_data[ticker] = returns
                else:
                    logger.warning(f"No data available for ticker {ticker}")
                    
            except Exception as e:
                logger.error(f"Failed to fetch data for {ticker}: {e}")
                continue
        
        if not all_data:
            raise ValueError("No data available for any of the requested tickers")
        
        # Combine into DataFrame
        returns_df = pd.DataFrame(all_data)
        returns_df = returns_df.dropna()
        
        if len(returns_df) < 100:
            raise ValueError(f"Insufficient data: only {len(returns_df)} observations available")
        
        return returns_df
        
    except Exception as e:
        raise ValueError(f"Data fetching failed: {e}")


def process_simulation_results(results: SimulationResults, tickers: List[str]) -> Dict[str, Any]:
    """Process simulation results for API response"""
    
    try:
        # Extract key metrics
        final_values = results.final_values
        annualized_returns = results.annualized_returns
        volatilities = results.volatilities
        max_drawdowns = results.max_drawdowns
        sharpe_ratios = results.sharpe_ratios
        
        # Calculate summary statistics - ensure all values are JSON serializable
        def safe_float(value):
            """Convert numpy values to safe JSON floats"""
            if isinstance(value, (np.ndarray, np.floating, np.integer)):
                result = float(value) if hasattr(value, 'item') else float(value)
                return None if (np.isnan(result) or np.isinf(result)) else result
            return float(value) if value is not None else None

        summary_stats = {
            'mean_final_value': safe_float(np.mean(final_values)),
            'median_final_value': safe_float(np.median(final_values)),
            'std_final_value': safe_float(np.std(final_values)),
            'mean_annual_return': safe_float(np.mean(annualized_returns)),
            'median_annual_return': safe_float(np.median(annualized_returns)),
            'mean_volatility': safe_float(np.mean(volatilities)),
            'mean_max_drawdown': safe_float(np.mean(max_drawdowns)),
            'mean_sharpe_ratio': safe_float(np.mean(sharpe_ratios))
        }
        
        # Calculate percentiles
        percentiles = [5, 10, 25, 50, 75, 90, 95]
        percentile_results = {}
        
        for p in percentiles:
            percentile_results[f'p{p}'] = {
                'final_value': safe_float(np.percentile(final_values, p)),
                'annual_return': safe_float(np.percentile(annualized_returns, p)),
                'volatility': safe_float(np.percentile(volatilities, p)),
                'max_drawdown': safe_float(np.percentile(max_drawdowns, p)),
                'sharpe_ratio': safe_float(np.percentile(sharpe_ratios, p)),
                'safe_withdrawal_rate': safe_float(results.safe_withdrawal_rates.get(f'p{p}', 0.0)) if results.safe_withdrawal_rates else 0.0,
                'perpetual_withdrawal_rate': safe_float(results.perpetual_withdrawal_rates.get(f'p{p}', 0.0)) if results.perpetual_withdrawal_rates else 0.0
            }
        
        # Performance metrics - ensure all values are JSON serializable
        performance_metrics = {}
        if hasattr(results, 'performance_metrics') and results.performance_metrics:
            for key, value in results.performance_metrics.items():
                if isinstance(value, np.ndarray):
                    performance_metrics[key] = value.tolist()
                elif isinstance(value, (np.floating, np.integer)):
                    performance_metrics[key] = value.item()
                elif pd.isna(value) if 'pd' in globals() else (isinstance(value, float) and np.isnan(value)):
                    performance_metrics[key] = None
                else:
                    performance_metrics[key] = value
        else:
            performance_metrics = {
                'simulation_time': 0.0,
                'paths_per_second': 0.0,
                'memory_usage_mb': 0.0,
                'convergence_rate': 0.0
            }
        
        # Calculate percentile paths for visualization (10th, 50th, 90th)
        paths_sample = []
        time_years = []
        days_per_year = 252  # Default to trading days
        
        # Validate portfolio_paths exists and has data
        if results.portfolio_paths is None or len(results.portfolio_paths) == 0:
            logger.warning("No portfolio paths available for percentile calculation")
            paths_sample = []
            time_years = []
        else:
            # Calculate percentile paths across all simulations
            try:
                n_paths = len(results.portfolio_paths)
                
                # Handle edge cases for small simulations
                if n_paths < 10:
                    logger.warning(f"Only {n_paths} paths available, adjusting percentile calculation")
                    if n_paths >= 3:
                        # Use min, median, max for small samples
                        percentile_10 = np.min(results.portfolio_paths, axis=0).tolist()
                        percentile_50 = np.median(results.portfolio_paths, axis=0).tolist()
                        percentile_90 = np.max(results.portfolio_paths, axis=0).tolist()
                    else:
                        # Return available paths padded with median if needed
                        paths = list(results.portfolio_paths)
                        median_path = np.median(results.portfolio_paths, axis=0)
                        while len(paths) < 3:
                            paths.append(median_path)
                        percentile_10 = paths[0].tolist()
                        percentile_50 = paths[1].tolist() if len(paths) > 1 else median_path.tolist()
                        percentile_90 = paths[2].tolist() if len(paths) > 2 else median_path.tolist()
                else:
                    # Normal percentile calculation for larger samples
                    percentile_10 = np.percentile(results.portfolio_paths, 10, axis=0).tolist()
                    percentile_50 = np.percentile(results.portfolio_paths, 50, axis=0).tolist()
                    percentile_90 = np.percentile(results.portfolio_paths, 90, axis=0).tolist()
                
                paths_sample = [percentile_10, percentile_50, percentile_90]
                
                # Calculate time axis based on simulation parameters
                num_steps = len(percentile_10) if percentile_10 else 0
                # TODO: Get days_per_year from simulation config when available
                time_years = [safe_float(i / days_per_year) for i in range(num_steps)]
                
            except Exception as e:
                logger.error(f"Failed to calculate percentile paths: {e}")
                # Fallback to first 3 paths if percentile calculation fails
                if len(results.portfolio_paths) >= 3:
                    paths_sample = [
                        results.portfolio_paths[0].tolist(),
                        results.portfolio_paths[1].tolist(),
                        results.portfolio_paths[2].tolist()
                    ]
                else:
                    paths_sample = [path.tolist() for path in results.portfolio_paths]
                
                # Calculate time_years based on first available path
                if paths_sample and len(paths_sample[0]) > 0:
                    time_years = [i / days_per_year for i in range(len(paths_sample[0]))]
        
        # Prepare response - ensure all values are JSON serializable
        return {
            'summary_statistics': summary_stats,
            'percentile_analysis': percentile_results,
            'performance_metrics': performance_metrics,
            'n_simulations': int(len(final_values)),
            'simulation_time': safe_float(results.simulation_time) if hasattr(results, 'simulation_time') else 0.0,
            'tickers': list(tickers),  # Ensure it's a list
            'paths_sample': paths_sample,  # Now contains actual percentile paths
            'time_years': time_years,  # Add time axis for frontend
            'days_per_year': int(days_per_year)  # Add for frontend reference
        }
        
    except Exception as e:
        logger.error(f"Error processing simulation results: {e}")
        return {'error': str(e)}


async def run_validation_analysis(results: SimulationResults, historical_data: pd.DataFrame) -> Dict[str, Any]:
    """Run validation analysis on simulation results"""
    
    try:
        validator = DistributionValidation()
        
        # Use final values for validation
        simulation_array = results.final_values
        historical_array = historical_data.values.flatten()
        
        # Run validation
        validation_report = validator.validate_simulation_results(
            simulation_array,
            historical_array
        )
        
        return {
            'validation_passed': validation_report.passed_validation,
            'overall_score': validation_report.overall_score,
            'recommendations': validation_report.recommendations,
            'test_summary': {
                'total_tests': len(validation_report.validation_tests),
                'tests_passed': sum(1 for test in validation_report.validation_tests if test.passed),
                'tests_failed': sum(1 for test in validation_report.validation_tests if not test.passed)
            }
        }
        
    except Exception as e:
        logger.warning(f"Validation analysis failed: {e}")
        return {'error': str(e)}


async def run_benchmark_analysis(historical_data: np.ndarray, config: SimulationConfig) -> Dict[str, Any]:
    """Run benchmark analysis"""
    
    try:
        # Generate test data
        test_data = {'historical': historical_data}
        
        # Initialize benchmarks
        benchmarks = PerformanceBenchmarks()
        
        # Run subset of benchmarks (reduced for API responsiveness)
        benchmark_config = BenchmarkConfig(
            n_simulations=[1000, 5000],  # Reduced for faster execution
            time_horizons=[1, 5],
            asset_counts=[min(3, historical_data.shape[1])],
            parallel_workers=[1, 2]
        )
        
        # Run benchmarks
        benchmark_report = benchmarks.run_comprehensive_benchmarks(test_data, benchmark_config)
        
        return {
            'overall_performance_score': benchmark_report.execution_summary['overall_performance_score'],
            'mvp_compliance': benchmark_report.mvp_compliance,
            'optimization_recommendations': benchmark_report.optimization_recommendations[:5]  # Top 5 recommendations
        }
        
    except Exception as e:
        logger.warning(f"Benchmark analysis failed: {e}")
        return {'error': str(e)}


def estimate_simulation_time(n_simulations: int, time_horizon: int, n_assets: int) -> int:
    """Estimate simulation completion time in seconds"""
    
    # Base time per simulation (milliseconds) - adjusted for more realistic times
    base_time_ms = 0.5  # Increased from 0.1 to reflect actual model fitting time
    
    # Scaling factors
    time_factor = time_horizon * 252 / 1000  # Daily steps
    asset_factor = n_assets * 1.5  # Increased factor for multi-asset complexity
    simulation_factor = n_simulations / 1000
    
    # Model fitting overhead (significant for econometric models)
    fitting_overhead = 10 + (n_assets * 2)  # 10s base + 2s per asset
    
    # Total estimated time
    estimated_ms = base_time_ms * time_factor * asset_factor * simulation_factor * 1000
    estimated_seconds = max(30, int(estimated_ms / 1000) + fitting_overhead)  # Minimum 30 seconds
    
    return estimated_seconds


def generate_benchmark_test_data() -> Dict[str, np.ndarray]:
    """Generate synthetic test data for benchmarking"""
    
    np.random.seed(42)  # Reproducible test data
    
    # Generate synthetic return series
    n_obs = 1000
    n_assets = 3
    
    # AR(1) + GARCH(1,1) style data
    returns = np.zeros((n_obs, n_assets))
    
    for i in range(n_assets):
        # AR(1) for mean
        ar_coef = 0.05
        innovations = np.random.normal(0, 0.02, n_obs)
        
        for t in range(1, n_obs):
            returns[t, i] = ar_coef * returns[t-1, i] + innovations[t]
    
    return {
        'test_portfolio': returns,
        'single_asset': returns[:, 0],
        'multi_asset': returns
    }