'use client';

import React, { useMemo } from 'react';
import { 
  CpuChipIcon, 
  ChartBarIcon, 
  ClockIcon,
  MemoryIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
  Cog6ToothIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { HybridSimulationResults } from '../services/hybridSimulationApi';

interface ModelDiagnosticsProps {
  results: HybridSimulationResults;
  className?: string;
}

const ModelDiagnostics = React.memo(({ results, className = '' }: ModelDiagnosticsProps) => {
  if (!results.results) {
    return (
      <div className={`p-6 text-center text-gray-500 ${className}`}>
        <CpuChipIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No model diagnostics available</p>
      </div>
    );
  }

  const { performance_metrics } = results.results;
  const config = results.simulation_config;

  const getConvergenceStatus = (rate: number) => {
    if (rate >= 0.95) return { color: 'text-green-600', icon: CheckCircleIcon, label: 'Excellent' };
    if (rate >= 0.85) return { color: 'text-yellow-600', icon: ExclamationTriangleIcon, label: 'Good' };
    return { color: 'text-red-600', icon: XCircleIcon, label: 'Poor' };
  };

  const getPerformanceRating = (pathsPerSecond: number) => {
    if (pathsPerSecond >= 1000) return { color: 'text-green-600', label: 'Excellent' };
    if (pathsPerSecond >= 500) return { color: 'text-yellow-600', label: 'Good' };
    return { color: 'text-red-600', label: 'Needs Optimization' };
  };

  const getMemoryUsageColor = (mb: number) => {
    if (mb <= 100) return 'text-green-600';
    if (mb <= 500) return 'text-yellow-600';
    return 'text-red-600';
  };

  const convergenceStatus = useMemo(
    () => getConvergenceStatus(performance_metrics.convergence_rate),
    [performance_metrics.convergence_rate]
  );
  const performanceRating = useMemo(
    () => getPerformanceRating(performance_metrics.paths_per_second),
    [performance_metrics.paths_per_second]
  );
  const ConvergenceIcon = convergenceStatus.icon;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Model Performance Overview */}
      <div className="bg-white border border-gray-200 rounded-lg p-6" role="region" aria-label="Model Performance Overview">
        <div className="flex items-center space-x-2 mb-4">
          <ArrowTrendingUpIcon className="h-5 w-5 text-blue-600" />
          <h4 className="text-lg font-medium text-gray-900">Model Performance Overview</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {Number.isFinite(performance_metrics.paths_per_second) ? performance_metrics.paths_per_second.toFixed(0) : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Paths/Second</div>
            <div className={`text-xs font-medium mt-1 ${performanceRating.color}`}>
              {performanceRating.label}
            </div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {Number.isFinite(performance_metrics.simulation_time) ? `${performance_metrics.simulation_time.toFixed(1)}s` : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Execution Time</div>
            <div className="text-xs text-gray-500 mt-1">
              {results.results.n_simulations.toLocaleString()} simulations
            </div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className={`text-2xl font-bold ${getMemoryUsageColor(performance_metrics.memory_usage_mb)}`}>
              {Number.isFinite(performance_metrics.memory_usage_mb) ? `${performance_metrics.memory_usage_mb.toFixed(1)}MB` : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Memory Usage</div>
            <div className="text-xs text-gray-500 mt-1">
              Peak consumption
            </div>
          </div>
        </div>
      </div>

      {/* Model Convergence Analysis */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <ChartBarIcon className="h-5 w-5 text-green-600" />
          <h4 className="text-lg font-medium text-gray-900">Model Convergence Analysis</h4>
        </div>
        
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <ConvergenceIcon className={`h-6 w-6 ${convergenceStatus.color}`} />
            <div>
              <div className="font-medium text-gray-900">Overall Convergence Rate</div>
              <div className="text-sm text-gray-600">
                VAR and GARCH models convergence success rate
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${convergenceStatus.color}`}>
              {(performance_metrics.convergence_rate * 100).toFixed(1)}%
            </div>
            <div className={`text-sm font-medium ${convergenceStatus.color}`}>
              {convergenceStatus.label}
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="text-sm font-medium text-blue-900 mb-2">Convergence Guidelines</h5>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• <strong>Excellent (95%+):</strong> Models converge reliably, results are stable</li>
            <li>• <strong>Good (85-94%):</strong> Most models converge, minor fallback usage</li>
            <li>• <strong>Poor (&lt;85%):</strong> Frequent convergence issues, consider parameter adjustment</li>
          </ul>
        </div>
      </div>

      {/* VAR Model Diagnostics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Cog6ToothIcon className="h-5 w-5 text-purple-600" />
          <h4 className="text-lg font-medium text-gray-900">VAR Model Configuration</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Max Lags Evaluated</span>
              <span className="text-sm text-gray-900">{config.var_max_lags}</span>
            </div>
            <div className="text-xs text-gray-600">
              Models tested with 1 to {config.var_max_lags} lags for optimal fit
            </div>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Selection Criterion</span>
              <span className="text-sm text-gray-900 uppercase">AIC/BIC</span>
            </div>
            <div className="text-xs text-gray-600">
              Automatic lag selection using information criteria
            </div>
          </div>
        </div>
      </div>

      {/* GARCH Model Diagnostics */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <SparklesIcon className="h-5 w-5 text-orange-600" />
          <h4 className="text-lg font-medium text-gray-900">GARCH Volatility Configuration</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Error Distribution</span>
              <span className="text-sm text-gray-900 capitalize">{config.garch_distribution}</span>
            </div>
            <div className="text-xs text-gray-600">
              {config.garch_distribution === 'normal' && 'Gaussian assumption for volatility innovations'}
              {config.garch_distribution === 't' && 'Student-t distribution for fat-tailed errors'}
              {config.garch_distribution === 'skewt' && 'Skewed-t distribution for asymmetric errors'}
            </div>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Fallback Method</span>
              <span className="text-sm text-gray-900 uppercase">EWMA</span>
            </div>
            <div className="text-xs text-gray-600">
              Exponentially weighted moving average when GARCH fails
            </div>
          </div>
        </div>
      </div>

      {/* Bootstrap Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <ClockIcon className="h-5 w-5 text-teal-600" />
          <h4 className="text-lg font-medium text-gray-900">Bootstrap Configuration</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Block Length</span>
              <span className="text-sm text-gray-900">
                {config.bootstrap_block_length || 'Auto-Optimal'}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {config.bootstrap_block_length 
                ? `Fixed ${config.bootstrap_block_length}-day blocks for resampling`
                : 'Politis-Romano optimal block length selection'
              }
            </div>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Mean Preservation</span>
              <span className="text-sm text-gray-900">
                {config.preserve_mean ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {config.preserve_mean 
                ? 'Bootstrap samples adjusted to preserve historical mean'
                : 'Raw bootstrap samples without mean adjustment'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Processing Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <CpuChipIcon className="h-5 w-5 text-indigo-600" />
          <h4 className="text-lg font-medium text-gray-900">Processing Configuration</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Parallel Processing</span>
              <span className={`text-sm font-medium ${config.use_parallel ? 'text-green-600' : 'text-red-600'}`}>
                {config.use_parallel ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {config.use_parallel 
                ? 'Multi-core processing for faster execution'
                : 'Single-threaded processing'
              }
            </div>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Max Workers</span>
              <span className="text-sm text-gray-900">
                {config.max_workers || 'Auto'}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {config.max_workers 
                ? `Limited to ${config.max_workers} CPU cores`
                : 'Automatically detected optimal worker count'
              }
            </div>
          </div>
          
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Random Seed</span>
              <span className="text-sm text-gray-900">
                {config.random_seed || 'Random'}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              {config.random_seed 
                ? 'Reproducible results with fixed seed'
                : 'Random execution for each run'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-yellow-900 mb-4">⚡ Performance Recommendations</h4>
        
        <div className="space-y-3">
          {performance_metrics.paths_per_second < 500 && (
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
              <div className="text-sm text-yellow-800">
                <strong>Performance:</strong> Enable parallel processing to improve simulation speed
              </div>
            </div>
          )}
          
          {performance_metrics.memory_usage_mb > 500 && (
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
              <div className="text-sm text-yellow-800">
                <strong>Memory:</strong> Consider reducing simulation count or using smaller block lengths
              </div>
            </div>
          )}
          
          {performance_metrics.convergence_rate < 0.85 && (
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-1.5 flex-shrink-0"></div>
              <div className="text-sm text-yellow-800">
                <strong>Convergence:</strong> Try reducing VAR max lags or using different GARCH distribution
              </div>
            </div>
          )}
          
          {performance_metrics.convergence_rate >= 0.95 && performance_metrics.paths_per_second >= 1000 && (
            <div className="flex items-start space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
              <div className="text-sm text-green-800">
                <strong>Excellent:</strong> All models performing optimally with high convergence and speed
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ModelDiagnostics.displayName = 'ModelDiagnostics';

export default ModelDiagnostics;