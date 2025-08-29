import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

// Centralized timeout configuration based on Grok-4 recommendations
const TIMEOUTS = {
  TASK_CREATION: 10000,     // 10 seconds for starting simulation (should be very fast)
  TASK_STATUS: 60000,       // 60 seconds for status checks
  TASK_MANAGEMENT: 30000,   // 30 seconds for cancel/list operations
  VALIDATION: 120000,       // 2 minutes for validation
  BENCHMARKS: 300000,       // 5 minutes for benchmarks
  SIMULATION_TOTAL: 600000  // 10 minutes total for simulation
};

export interface HybridSimulationRequest {
  tickers: string[];
  start_date: string;
  end_date: string;
  n_simulations: number;
  time_horizon_years: number;
  initial_portfolio_value: number;
  portfolio_weights?: number[];
  
  // Advanced parameters
  var_max_lags: number;
  garch_distribution: string;
  bootstrap_block_length?: number;
  preserve_mean: boolean;
  use_parallel: boolean;
  max_workers?: number;
  random_seed?: number;
  use_gpu: boolean;
  gpu_memory_fraction: number;
  enable_validation: boolean;
  run_benchmarks: boolean;
}

export interface HybridSimulationTaskResponse {
  task_id: string;
  status: 'started' | 'initializing' | 'fetching_data' | 'fitting_models' | 'running_simulation' | 'completed' | 'failed';
  message: string;
  estimated_completion_time?: string;
}

export interface ValidationReport {
  validation_passed: boolean;
  overall_score: number;
  test_results: Array<{
    test_name: string;
    passed: boolean;
    p_value: number;
    test_statistic: number;
  }>;
  bias_analysis: Array<{
    metric: string;
    bias_reduction_percent: number;
    improvement_score: number;
  }>;
  recommendations: string[];
  detailed_report: string;
}

export interface BenchmarkReport {
  overall_performance_score: number;
  mvp_compliance: Record<string, boolean>;
  scaling_analysis: Record<string, any>;
  optimization_recommendations: string[];
  detailed_report: string;
  execution_summary: Record<string, any>;
}

export interface HybridSimulationResults {
  task_id: string;
  status: string;
  simulation_config: Record<string, any>;
  progress?: number;  // Add progress field
  message?: string;   // Add message field
  results?: {
    summary_statistics: {
      mean_final_value: number;
      median_final_value: number;
      std_final_value: number;
      mean_annual_return: number;
      median_annual_return: number;
      mean_volatility: number;
      mean_max_drawdown: number;
      mean_sharpe_ratio: number;
    };
    percentile_analysis: {
      [key: string]: {
        final_value: number;
        annual_return: number;
        volatility: number;
        max_drawdown: number;
        sharpe_ratio: number;
      };
    };
    performance_metrics: {
      simulation_time: number;
      paths_per_second: number;
      memory_usage_mb: number;
      convergence_rate: number;
    };
    n_simulations: number;
    tickers: string[];
    paths_sample: number[][];  // Now contains [10th percentile, 50th percentile, 90th percentile]
    time_years?: number[];     // Add time axis from backend
    days_per_year?: number;    // Add days per year from backend
  };
  validation_report?: ValidationReport;
  benchmark_report?: BenchmarkReport;
  error?: string;
  execution_time?: number;
}

export interface ValidationRequest {
  simulation_results: number[];
  historical_data: number[];
  bootstrap_results?: number[];
}

export interface TaskListResponse {
  tasks: Array<{
    task_id: string;
    status: string;
    created_at: string;
    message: string;
    tickers: string[];
    n_simulations: number;
  }>;
}

export const hybridSimulationApi = {
  async startSimulation(request: HybridSimulationRequest): Promise<HybridSimulationTaskResponse> {
    try {
      const response = await axios.post<HybridSimulationTaskResponse>(
        `${API_BASE_URL}/api/hybrid-simulation/simulate`,
        request,
        {
          timeout: TIMEOUTS.TASK_CREATION,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Hybrid simulation API error details:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        isAxiosError: axios.isAxiosError(error),
        code: axios.isAxiosError(error) ? error.code : 'N/A',
        status: axios.isAxiosError(error) ? error.response?.status : 'N/A',
        url: `${API_BASE_URL}/api/hybrid-simulation/simulate`
      });
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 422) {
          throw new Error(`Invalid simulation parameters: ${error.response.data.detail || 'Please check your inputs'}`);
        } else if (error.response?.status === 503) {
          throw new Error('Data fetching service not available. Please try again later.');
        } else if (error.response?.status === 500) {
          throw new Error('Server error during simulation setup. Please try again.');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Request timed out. Please check your connection and try again.');
        } else if (error.code === 'ECONNREFUSED') {
          throw new Error('Cannot connect to simulation server. Please check if the backend is running.');
        } else if (!error.response) {
          throw new Error('Network error: Unable to reach simulation server. Please check your connection.');
        }
      }
      
      throw new Error(`Failed to start hybrid simulation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async getTaskStatus(taskId: string): Promise<HybridSimulationResults> {
    try {
      const response = await axios.get<HybridSimulationResults>(
        `${API_BASE_URL}/api/hybrid-simulation/status/${taskId}`,
        { timeout: TIMEOUTS.TASK_STATUS }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Task status API error:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
          throw new Error('Simulation task not found');
        }
      }
      
      throw new Error('Failed to get task status');
    }
  },

  async cancelTask(taskId: string): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/hybrid-simulation/tasks/${taskId}`,
        { timeout: TIMEOUTS.TASK_MANAGEMENT }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Cancel task API error:', error.response?.data || error.message);
        
        if (error.response?.status === 404) {
          throw new Error('Task not found');
        } else if (error.response?.status === 400) {
          throw new Error('Task cannot be cancelled (already finished)');
        }
      }
      
      throw new Error('Failed to cancel task');
    }
  },

  async getAllTasks(): Promise<TaskListResponse> {
    try {
      const response = await axios.get<TaskListResponse>(
        `${API_BASE_URL}/api/hybrid-simulation/tasks`,
        { timeout: TIMEOUTS.TASK_MANAGEMENT }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch task list:', error);
      return { tasks: [] };
    }
  },

  async validateResults(request: ValidationRequest): Promise<ValidationReport> {
    try {
      const response = await axios.post<ValidationReport>(
        `${API_BASE_URL}/api/hybrid-simulation/validate`,
        request,
        {
          timeout: TIMEOUTS.VALIDATION,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Validation API error:', error.response?.data || error.message);
        
        if (error.response?.status === 422) {
          throw new Error('Invalid validation parameters');
        }
      }
      
      throw new Error('Failed to validate results');
    }
  },

  async runBenchmarks(config?: Record<string, any>): Promise<BenchmarkReport> {
    try {
      const response = await axios.post<BenchmarkReport>(
        `${API_BASE_URL}/api/hybrid-simulation/benchmark`,
        config || {},
        {
          timeout: TIMEOUTS.BENCHMARKS,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Benchmark API error:', error.response?.data || error.message);
      }
      
      throw new Error('Failed to run benchmarks');
    }
  }
};

// Helper function to convert traditional portfolio format to hybrid format
export function convertToHybridRequest(
  portfolio: Array<{ ticker: string; percentage: number }>,
  config: {
    timePeriodYears: number;
    initialBalance: number;
    numSimulations: number;
    historicalStartDate: string;
  },
  advancedConfig: {
    varMaxLags: number;
    garchDistribution: string;
    bootstrapBlockLength?: number;
    preserveMean: boolean;
    useParallel: boolean;
    maxWorkers?: number;
    randomSeed?: number;
    useGpu: boolean;
    gpuMemoryFraction: number;
    enableValidation: boolean;
    runBenchmarks: boolean;
  }
): HybridSimulationRequest {
  // Calculate portfolio weights
  const portfolioWeights = portfolio.map(item => item.percentage / 100);
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(parseInt(config.historicalStartDate), 0, 1);
  
  return {
    tickers: portfolio.map(item => item.ticker),
    start_date: startDate.toISOString().split('T')[0],
    end_date: endDate.toISOString().split('T')[0],
    n_simulations: config.numSimulations,
    time_horizon_years: config.timePeriodYears,
    initial_portfolio_value: config.initialBalance,
    portfolio_weights: portfolioWeights,
    
    // Advanced parameters
    var_max_lags: advancedConfig.varMaxLags,
    garch_distribution: advancedConfig.garchDistribution,
    bootstrap_block_length: advancedConfig.bootstrapBlockLength,
    preserve_mean: advancedConfig.preserveMean,
    use_parallel: advancedConfig.useParallel,
    max_workers: advancedConfig.maxWorkers,
    random_seed: advancedConfig.randomSeed,
    use_gpu: advancedConfig.useGpu,
    gpu_memory_fraction: advancedConfig.gpuMemoryFraction,
    enable_validation: advancedConfig.enableValidation,
    run_benchmarks: advancedConfig.runBenchmarks
  };
}

// Helper function to convert hybrid results to traditional format for compatibility
export function convertHybridResultsToTraditional(hybridResults: HybridSimulationResults): any {
  if (!hybridResults.results) {
    console.error('❌ No hybrid results to convert');
    return null;
  }
  
  // Check if paths_sample exists but don't fail if it doesn't
  if (!hybridResults.results.paths_sample) {
    console.warn('⚠️ No paths_sample in results, but continuing with conversion');
  }
  
  // Debug: Log the entire results structure
  console.log('🔍 DEBUGGING HYBRID CONVERSION - FULL RESULTS:', {
    hasResults: !!hybridResults.results,
    resultKeys: Object.keys(hybridResults.results),
    hasPercentileAnalysis: !!hybridResults.results.percentile_analysis,
    percentileAnalysisKeys: hybridResults.results.percentile_analysis ? Object.keys(hybridResults.results.percentile_analysis) : 'none',
    samplePercentileData: hybridResults.results.percentile_analysis?.p50 || 'no p50 data',
    hasSummaryStats: !!hybridResults.results.summary_statistics
  });

  const results = hybridResults.results;
  
  // Validate paths_sample structure if it exists
  let validPaths = true;
  if (results.paths_sample) {
    if (!Array.isArray(results.paths_sample) || results.paths_sample.length < 3) {
      console.warn('Invalid paths_sample: expected array with at least 3 percentile paths');
      validPaths = false;
    } else {
      // Validate each path has data
      validPaths = results.paths_sample.every(path => 
        Array.isArray(path) && path.length > 0
      );
      
      if (!validPaths) {
        console.warn('Invalid path data: some paths are empty or invalid');
      }
    }
  } else {
    validPaths = false;
  }
  
  // Use backend-provided time_years or calculate fallback
  const days_per_year = results.days_per_year || 252;
  const time_years = results.time_years || 
    (validPaths && results.paths_sample && results.paths_sample[0] 
      ? Array.from({length: results.paths_sample[0].length}, (_, i) => i / days_per_year)
      : []);
  
  // Apply simple inflation adjustment (2% annual) if not provided
  const inflationRate = 0.02;
  const calculateRealPath = (nominalPath: number[]): number[] => {
    return nominalPath.map((value, index) => {
      const years = time_years[index] || 0;
      return value / Math.pow(1 + inflationRate, years);
    });
  };
  
  const percentileKeys = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95'];
  
  // Convert percentile analysis to traditional format
  const createPercentileMetrics = (field: string) => {
    const metrics: any = {};
    
    // Debug logging to trace the issue
    console.log('🔍 DEBUG createPercentileMetrics:', {
      field,
      percentileAnalysisExists: !!results.percentile_analysis,
      percentileAnalysisKeys: results.percentile_analysis ? Object.keys(results.percentile_analysis) : 'undefined',
      sampleData: results.percentile_analysis?.p50 || 'no p50 data'
    });
    
    percentileKeys.forEach(key => {
      const percentile = key.substring(1); // Remove 'p' prefix
      if (results.percentile_analysis && results.percentile_analysis[key] && results.percentile_analysis[key][field] !== undefined) {
        const value = results.percentile_analysis[key][field];
        metrics[`percentile_${percentile}th`] = value;
        console.log(`✅ Mapped ${key}.${field} = ${value} to percentile_${percentile}th`);
      } else {
        console.warn(`❌ Missing data for ${key}.${field}:`, {
          keyExists: !!results.percentile_analysis?.[key],
          fieldExists: !!results.percentile_analysis?.[key]?.[field],
          value: results.percentile_analysis?.[key]?.[field]
        });
        // Set default to 0 if missing
        metrics[`percentile_${percentile}th`] = 0;
      }
    });
    
    console.log('📊 Final metrics for', field, ':', metrics);
    return metrics;
  };

  return {
    aggregated_metrics: {
      final_balance_nominal: createPercentileMetrics('final_value'),
      final_balance_real: createPercentileMetrics('final_value'), // Simplified - not inflation adjusted
      annual_mean_return: createPercentileMetrics('annual_return'),
      annual_volatility: createPercentileMetrics('volatility'),
      sharpe_ratio: createPercentileMetrics('sharpe_ratio'),
      max_drawdown: createPercentileMetrics('max_drawdown'),
      
      // Additional metrics from summary statistics
      twrr_nominal: createPercentileMetrics('annual_return'),
      twrr_real: createPercentileMetrics('annual_return'), // TODO: Apply inflation adjustment
      sortino_ratio: createPercentileMetrics('sharpe_ratio'), // TODO: Calculate actual Sortino ratio
      max_drawdown_excl_cashflows: createPercentileMetrics('max_drawdown'),
      // Use API-calculated withdrawal rates based on proper depletion mathematics
      safe_withdrawal_rate: createPercentileMetrics('safe_withdrawal_rate'),
      perpetual_withdrawal_rate: createPercentileMetrics('perpetual_withdrawal_rate')
    },
    
    execution_time: results.performance_metrics.simulation_time,
    historical_data_range: `${hybridResults.simulation_config.start_date} to ${hybridResults.simulation_config.end_date}`,
    
    simulation_metadata: {
      num_simulations: results.n_simulations,
      time_period_years: hybridResults.simulation_config.time_horizon_years,
      block_size_days: hybridResults.simulation_config.bootstrap_block_length || 'Auto',
      historical_trading_days: Math.round(results.performance_metrics.simulation_time * results.performance_metrics.paths_per_second)
    },
    
    portfolio_summary: results.tickers.map((ticker, index) => ({
      ticker,
      allocation: hybridResults.simulation_config.portfolio_weights?.[index] || (1 / results.tickers.length)
    })),
    
    // Sample paths for visualization with validation
    percentile_paths: {
      time_years,
      percentile_paths_nominal: validPaths && results.paths_sample ? {
        '10th': results.paths_sample[0] || [],
        '50th': results.paths_sample[1] || [],
        '90th': results.paths_sample[2] || []
      } : {
        '10th': [],
        '50th': [],
        '90th': []
      },
      percentile_paths_real: validPaths && results.paths_sample ? {
        '10th': calculateRealPath(results.paths_sample[0] || []),
        '50th': calculateRealPath(results.paths_sample[1] || []),
        '90th': calculateRealPath(results.paths_sample[2] || [])
      } : {
        '10th': [],
        '50th': [],
        '90th': []
      },
      initial_balance: hybridResults.simulation_config.initial_portfolio_value
    },
    
    // Additional hybrid-specific data
    hybrid_metadata: {
      method: 'hybrid_econometric',
      validation_score: hybridResults.validation_report?.overall_score,
      convergence_rate: results.performance_metrics.convergence_rate,
      paths_per_second: results.performance_metrics.paths_per_second,
      memory_usage_mb: results.performance_metrics.memory_usage_mb
    }
  };
}

// Helper functions for formatting
export function formatExecutionTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

export function formatPerformanceMetric(value: number, unit: string): string {
  if (unit === 'paths/sec') {
    return `${value.toFixed(1)} paths/sec`;
  } else if (unit === 'MB') {
    return `${value.toFixed(1)} MB`;
  } else if (unit === 'percentage') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return `${value.toFixed(2)}`;
}

export function getValidationStatusColor(score: number): string {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  return 'text-red-600';
}

export function getValidationStatusText(score: number): string {
  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Good';
  return 'Needs Improvement';
}