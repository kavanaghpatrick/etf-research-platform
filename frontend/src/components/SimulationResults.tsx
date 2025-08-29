'use client';

import { useState, useCallback, useTransition } from 'react';
import { 
  ChartBarIcon, 
  ArrowTrendingUpIcon, 
  ShieldCheckIcon,
  BanknotesIcon,
  TableCellsIcon,
  ArrowDownTrayIcon,
  BeakerIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import { MonteCarloResponse, formatLargeNumber, formatPercentage, getRiskLevel } from '../services/monteCarloApi';
import { HybridSimulationResults } from '../services/hybridSimulationApi';
import OutcomeDistributionChart from './charts/OutcomeDistributionChart';
import MetricsTable from './MetricsTable';
import GrowthChart from './GrowthChart';
import ExpectedReturnTable from './ExpectedReturnTable';
import ValidationReport from './ValidationReport';
import ModelDiagnostics from './ModelDiagnostics';
import EnhancedLoadingState from './EnhancedLoadingState';
import ReportExporter from './ReportExporter';

interface SimulationResultsProps {
  results: MonteCarloResponse | null;
  loading: boolean;
  error: string | null;
  progress?: number;
  phase?: string;
  hybridResults?: HybridSimulationResults | null;
  simulationMethod?: 'traditional' | 'hybrid';
}

export default function SimulationResults({ 
  results, 
  loading, 
  error, 
  progress = 0, 
  phase = '',
  hybridResults = null,
  simulationMethod = 'traditional' 
}: SimulationResultsProps) {
  const [activeView, setActiveView] = useState<'growth' | 'chart' | 'table' | 'validation' | 'diagnostics'>('growth');
  const [showRealValues, setShowRealValues] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Memoize event handlers to prevent unnecessary re-renders
  const handleShowNominal = useCallback(() => {
    startTransition(() => setShowRealValues(false));
  }, []);
  
  const handleShowReal = useCallback(() => {
    startTransition(() => setShowRealValues(true));
  }, []);
  
  const handleViewChange = useCallback((view: 'growth' | 'chart' | 'table' | 'validation' | 'diagnostics') => {
    startTransition(() => setActiveView(view));
  }, []);

  if (loading) {
    return (
      <EnhancedLoadingState
        isLoading={loading}
        progress={progress}
        phase={phase}
        simulationMethod={simulationMethod}
      />
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 min-h-[600px]">
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <div className="rounded-full bg-red-100 p-3 mb-4">
            <svg className="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">Simulation Failed</h3>
          <p className="text-red-600 max-w-md mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 min-h-[600px]">
        <div className="flex flex-col items-center justify-center h-96 text-center p-8">
          <ChartBarIcon className="h-16 w-16 text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">Ready to Simulate</h3>
          <p className="text-gray-500 max-w-md">
            Configure your portfolio allocation and simulation parameters, then click "Run Simulation" to analyze thousands of potential market scenarios.
          </p>
          <div className="mt-6 text-sm text-gray-400">
            <p>• Bootstrap resampling methodology</p>
            <p>• Risk-adjusted performance metrics</p>
            <p>• Inflation-adjusted returns</p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = results.aggregated_metrics;
  const riskLevel = getRiskLevel(metrics.annual_volatility.percentile_50th);

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Simulation Results</h2>
            <p className="text-sm text-gray-500 mt-1">
              {results.simulation_metadata.num_simulations.toLocaleString()} scenarios • {results.simulation_metadata.time_period_years} years • {results.historical_data_range}
            </p>
          </div>
          <ReportExporter
            results={results}
            hybridResults={hybridResults}
            simulationMethod={simulationMethod}
            portfolio={results.portfolio_summary.map(item => ({
              ticker: item.ticker,
              percentage: item.allocation * 100
            }))}
          />
        </div>
      </div>

      {/* Data Disclosures Section */}
      {results.data_disclosures && results.data_disclosures.some(d => d.disclosure) && (
        <div className={`p-6 border-b border-gray-200 ${
          results.data_disclosures.some(d => d.limited_data_risk) ? 'bg-red-50' : 'bg-yellow-50'
        }`}>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {results.data_disclosures.some(d => d.limited_data_risk) ? (
                <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-medium ${
                results.data_disclosures.some(d => d.limited_data_risk) ? 'text-red-800' : 'text-yellow-800'
              }`}>
                {results.data_disclosures.some(d => d.limited_data_risk) ? 'Critical Data Limitation Warning' : 'Data Availability Notice'}
              </h3>
              <div className={`mt-2 text-sm ${
                results.data_disclosures.some(d => d.limited_data_risk) ? 'text-red-700' : 'text-yellow-700'
              }`}>
                <p className="mb-2">Some tickers have limited historical data available:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {results.data_disclosures
                    .filter(d => d.disclosure)
                    .map((disclosure, idx) => (
                      <li key={idx} className={disclosure.limited_data_risk ? 'font-medium' : ''}>
                        <strong>{disclosure.ticker}</strong>: {disclosure.disclosure}
                        <span className={`ml-2 ${disclosure.limited_data_risk ? 'text-red-600 font-medium' : 'text-yellow-600'}`}>
                          (using {disclosure.years_actual.toFixed(1)} years instead of {disclosure.years_requested.toFixed(1)} years)
                          {disclosure.limited_data_risk && ' ⚠️ HIGH RISK'}
                        </span>
                      </li>
                    ))}
                </ul>
                {results.data_disclosures.some(d => d.limited_data_risk) && (
                  <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-md">
                    <p className="text-xs text-red-800 font-medium">
                      🚨 <strong>HIGH RISK:</strong> Several tickers have less than 15 years of historical data. 
                      This can cause unrealistic projections due to limited bootstrap sampling scenarios.
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      <strong>Recommendation:</strong> Consider using ETFs with longer trading histories (20+ years) 
                      for more reliable long-term projections.
                    </p>
                  </div>
                )}
                <p className={`mt-2 text-xs ${
                  results.data_disclosures.some(d => d.limited_data_risk) ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  This may affect the reliability of long-term projections for these assets.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Summary Cards */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Expected Return Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-900">Expected Return</h3>
            <ArrowTrendingUpIcon className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {formatPercentage(metrics.twrr_real.percentile_50th)}
          </div>
          <div className="text-xs text-blue-700 mt-1">
            Real (inflation-adjusted)
          </div>
          <div className="text-xs text-blue-600 mt-2">
            Range: {formatPercentage(metrics.twrr_real.percentile_25th)} - {formatPercentage(metrics.twrr_real.percentile_75th)}
          </div>
        </div>

        {/* Risk Level Card */}
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-amber-900">Risk Level</h3>
            <ShieldCheckIcon className="h-5 w-5 text-amber-600" />
          </div>
          <div className={`text-2xl font-bold ${riskLevel.color}`}>
            {riskLevel.level}
          </div>
          <div className="text-xs text-amber-700 mt-1">
            Volatility: {formatPercentage(metrics.annual_volatility.percentile_50th)}
          </div>
          <div className="text-xs text-amber-600 mt-2">
            Sharpe: {metrics.sharpe_ratio.percentile_50th.toFixed(2)} • Sortino: {metrics.sortino_ratio.percentile_50th.toFixed(2)}
          </div>
        </div>

        {/* Safe Withdrawal Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-900">Safe Withdrawal</h3>
            <BanknotesIcon className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatPercentage(metrics.safe_withdrawal_rate.percentile_50th)}
          </div>
          <div className="text-xs text-green-700 mt-1">
            Annual withdrawal rate
          </div>
          <div className="text-xs text-green-600 mt-2">
            Perpetual: {formatPercentage(metrics.perpetual_withdrawal_rate.percentile_50th)}
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="px-6 pb-4">
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleViewChange('growth')}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'growth'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ArrowTrendingUpIcon className="h-4 w-4 mr-2" />
            Growth
          </button>
          <button
            onClick={() => handleViewChange('chart')}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'chart'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Distribution
          </button>
          <button
            onClick={() => handleViewChange('table')}
            className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'table'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <TableCellsIcon className="h-4 w-4 mr-2" />
            Table
          </button>
          
          {/* Hybrid-specific tabs */}
          {hybridResults?.validation_report && (
            <button
              onClick={() => handleViewChange('validation')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'validation'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BeakerIcon className="h-4 w-4 mr-2" />
              Validation
            </button>
          )}
          
          {hybridResults && simulationMethod === 'hybrid' && (
            <button
              onClick={() => handleViewChange('diagnostics')}
              className={`flex-1 flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeView === 'diagnostics'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CpuChipIcon className="h-4 w-4 mr-2" />
              Diagnostics
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="px-6 pb-6">
        {activeView === 'growth' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Portfolio Growth Over Time</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Show:</span>
                <button
                  onClick={handleShowNominal}
                  disabled={isPending}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${
                    !showRealValues
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  Nominal
                </button>
                <button
                  onClick={handleShowReal}
                  disabled={isPending}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${
                    showRealValues
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'text-gray-500 hover:text-gray-700'
                  } ${isPending ? 'opacity-50 cursor-wait' : ''}`}
                >
                  Real (Inflation-Adjusted)
                </button>
              </div>
            </div>
            {results.percentile_paths ? (
              <>
                <GrowthChart data={results.percentile_paths} showReal={showRealValues} />
                <ExpectedReturnTable 
                  data={results.aggregated_metrics.expected_returns_by_horizon ? {
                    timeHorizons: results.aggregated_metrics.expected_returns_by_horizon.time_horizons,
                    percentiles: [
                      { 
                        name: '10th Percentile', 
                        values: results.aggregated_metrics.expected_returns_by_horizon.time_horizons.map(h => 
                          results.aggregated_metrics.expected_returns_by_horizon[showRealValues ? 'real' : 'nominal']?.[`${h}_years`]?.percentile_10th || 0
                        ),
                        color: 'text-red-600'
                      },
                      { 
                        name: '25th Percentile', 
                        values: results.aggregated_metrics.expected_returns_by_horizon.time_horizons.map(h => 
                          results.aggregated_metrics.expected_returns_by_horizon[showRealValues ? 'real' : 'nominal']?.[`${h}_years`]?.percentile_25th || 0
                        ),
                        color: 'text-orange-600'
                      },
                      { 
                        name: '50th Percentile', 
                        values: results.aggregated_metrics.expected_returns_by_horizon.time_horizons.map(h => 
                          results.aggregated_metrics.expected_returns_by_horizon[showRealValues ? 'real' : 'nominal']?.[`${h}_years`]?.percentile_50th || 0
                        ),
                        color: 'text-blue-600'
                      },
                      { 
                        name: '75th Percentile', 
                        values: results.aggregated_metrics.expected_returns_by_horizon.time_horizons.map(h => 
                          results.aggregated_metrics.expected_returns_by_horizon[showRealValues ? 'real' : 'nominal']?.[`${h}_years`]?.percentile_75th || 0
                        ),
                        color: 'text-green-600'
                      },
                      { 
                        name: '90th Percentile', 
                        values: results.aggregated_metrics.expected_returns_by_horizon.time_horizons.map(h => 
                          results.aggregated_metrics.expected_returns_by_horizon[showRealValues ? 'real' : 'nominal']?.[`${h}_years`]?.percentile_90th || 0
                        ),
                        color: 'text-emerald-600'
                      }
                    ]
                  } : null}
                  showReal={showRealValues}
                />
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Growth chart data not available. Please run a new simulation.
              </div>
            )}
          </div>
        ) : activeView === 'chart' ? (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Outcome Distribution</h3>
            <OutcomeDistributionChart 
              data={results}
              showReal={showRealValues}
            />
            
            {/* Final Balance Summary */}
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500">10th Percentile</p>
                <p className="text-sm font-medium text-red-600">
                  {formatLargeNumber(metrics.final_balance_real.percentile_10th)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">25th Percentile</p>
                <p className="text-sm font-medium text-orange-600">
                  {formatLargeNumber(metrics.final_balance_real.percentile_25th)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Median (50th)</p>
                <p className="text-sm font-medium text-blue-600">
                  {formatLargeNumber(metrics.final_balance_real.percentile_50th)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">75th Percentile</p>
                <p className="text-sm font-medium text-green-600">
                  {formatLargeNumber(metrics.final_balance_real.percentile_75th)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">90th Percentile</p>
                <p className="text-sm font-medium text-emerald-600">
                  {formatLargeNumber(metrics.final_balance_real.percentile_90th)}
                </p>
              </div>
            </div>
          </div>
        ) : activeView === 'validation' ? (
          hybridResults?.validation_report ? (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Statistical Validation</h3>
              <ValidationReport report={hybridResults.validation_report} />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BeakerIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Validation report not available</p>
            </div>
          )
        ) : activeView === 'diagnostics' ? (
          hybridResults ? (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Model Diagnostics</h3>
              <ModelDiagnostics results={hybridResults} />
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <CpuChipIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Model diagnostics not available</p>
            </div>
          )
        ) : (
          <MetricsTable metrics={metrics} />
        )}
      </div>

      {/* Execution Info */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        Simulation completed in {results.execution_time.toFixed(2)}s • 
        {' '}{results.simulation_metadata.historical_trading_days.toLocaleString()} trading days analyzed
      </div>
    </div>
  );
}