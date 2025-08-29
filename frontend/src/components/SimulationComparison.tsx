'use client';

import React, { useState, useMemo } from 'react';
import { 
  ScaleIcon, 
  ArrowsRightLeftIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { MonteCarloResponse, formatLargeNumber, formatPercentage } from '../services/monteCarloApi';
import { HybridSimulationResults } from '../services/hybridSimulationApi';

interface SimulationComparisonProps {
  traditionalResults: MonteCarloResponse | null;
  hybridResults: HybridSimulationResults | null;
  className?: string;
}

type ComparisonMetric = {
  name: string;
  traditional: number | string;
  hybrid: number | string;
  difference: number | string;
  betterMethod: 'traditional' | 'hybrid' | 'neutral';
  explanation: string;
};

export default function SimulationComparison({ 
  traditionalResults, 
  hybridResults, 
  className = '' 
}: SimulationComparisonProps) {
  const [selectedMetric, setSelectedMetric] = useState<string>('expected_return');

  const comparisonMetrics = useMemo((): ComparisonMetric[] => {
    if (!traditionalResults || !hybridResults?.results) return [];

    const tradMetrics = traditionalResults.aggregated_metrics;
    const hybridStats = hybridResults.results.summary_statistics;
    
    return [
      {
        name: 'Expected Annual Return',
        traditional: formatPercentage(tradMetrics.twrr_real.percentile_50th),
        hybrid: formatPercentage(hybridStats.mean_annual_return),
        difference: formatPercentage(Math.abs(hybridStats.mean_annual_return - tradMetrics.twrr_real.percentile_50th)),
        betterMethod: hybridStats.mean_annual_return > tradMetrics.twrr_real.percentile_50th ? 'hybrid' : 'traditional',
        explanation: 'Hybrid models capture mean reversion patterns that bootstrap may miss'
      },
      {
        name: 'Volatility',
        traditional: formatPercentage(tradMetrics.annual_volatility.percentile_50th),
        hybrid: formatPercentage(hybridStats.mean_volatility),
        difference: formatPercentage(Math.abs(hybridStats.mean_volatility - tradMetrics.annual_volatility.percentile_50th)),
        betterMethod: hybridStats.mean_volatility < tradMetrics.annual_volatility.percentile_50th ? 'hybrid' : 'traditional',
        explanation: 'GARCH models better capture volatility clustering in financial markets'
      },
      {
        name: 'Sharpe Ratio',
        traditional: tradMetrics.sharpe_ratio.percentile_50th.toFixed(3),
        hybrid: hybridStats.mean_sharpe_ratio.toFixed(3),
        difference: Math.abs(hybridStats.mean_sharpe_ratio - tradMetrics.sharpe_ratio.percentile_50th).toFixed(3),
        betterMethod: hybridStats.mean_sharpe_ratio > tradMetrics.sharpe_ratio.percentile_50th ? 'hybrid' : 'traditional',
        explanation: 'Higher Sharpe ratio indicates better risk-adjusted returns'
      },
      {
        name: 'Max Drawdown',
        traditional: formatPercentage(tradMetrics.max_drawdown.percentile_50th),
        hybrid: formatPercentage(hybridStats.mean_max_drawdown),
        difference: formatPercentage(Math.abs(hybridStats.mean_max_drawdown - tradMetrics.max_drawdown.percentile_50th)),
        betterMethod: hybridStats.mean_max_drawdown < tradMetrics.max_drawdown.percentile_50th ? 'hybrid' : 'traditional',
        explanation: 'Lower drawdowns suggest better downside risk management'
      },
      {
        name: 'Execution Time',
        traditional: `${traditionalResults.execution_time.toFixed(1)}s`,
        hybrid: `${hybridResults.execution_time?.toFixed(1) || 'N/A'}s`,
        difference: `${Math.abs((hybridResults.execution_time || 0) - traditionalResults.execution_time).toFixed(1)}s`,
        betterMethod: (hybridResults.execution_time || 0) < traditionalResults.execution_time ? 'hybrid' : 'traditional',
        explanation: 'Faster execution enables more frequent rebalancing analysis'
      },
      {
        name: 'Statistical Validation',
        traditional: 'Not Available',
        hybrid: hybridResults.validation_report ? `${(hybridResults.validation_report.overall_score * 10).toFixed(1)}/10` : 'N/A',
        difference: 'N/A',
        betterMethod: 'hybrid',
        explanation: 'Hybrid provides comprehensive statistical validation of results'
      }
    ];
  }, [traditionalResults, hybridResults]);

  if (!traditionalResults || !hybridResults) {
    return (
      <div className={`bg-gray-50 rounded-lg p-8 text-center ${className}`}>
        <ScaleIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Run both traditional and hybrid simulations to compare results</p>
      </div>
    );
  }

  const getMethodIcon = (method: 'traditional' | 'hybrid' | 'neutral') => {
    switch (method) {
      case 'hybrid':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'traditional':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ArrowsRightLeftIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getMethodColor = (method: 'traditional' | 'hybrid' | 'neutral', isText = true) => {
    const prefix = isText ? 'text' : 'bg';
    switch (method) {
      case 'hybrid':
        return `${prefix}-green-600`;
      case 'traditional':
        return `${prefix}-blue-600`;
      default:
        return `${prefix}-gray-600`;
    }
  };

  const overallWinner = comparisonMetrics.filter(m => m.betterMethod === 'hybrid').length > 
                       comparisonMetrics.filter(m => m.betterMethod === 'traditional').length ? 'hybrid' : 'traditional';

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Summary */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <ScaleIcon className="h-6 w-6 mr-2 text-blue-600" />
            Method Comparison Analysis
          </h3>
          <div className={`px-4 py-2 rounded-full ${overallWinner === 'hybrid' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
            <span className="font-medium">
              {overallWinner === 'hybrid' ? 'Hybrid Performs Better' : 'Traditional Performs Better'}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {comparisonMetrics.map((metric) => (
            <div
              key={metric.name}
              onClick={() => setSelectedMetric(metric.name)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedMetric === metric.name 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{metric.name}</span>
                {getMethodIcon(metric.betterMethod)}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Traditional:</span>
                  <span className={`text-sm font-medium ${
                    metric.betterMethod === 'traditional' ? 'text-blue-600' : 'text-gray-600'
                  }`}>
                    {metric.traditional}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Hybrid:</span>
                  <span className={`text-sm font-medium ${
                    metric.betterMethod === 'hybrid' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {metric.hybrid}
                  </span>
                </div>
                
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Difference:</span>
                    <span className="text-xs font-medium text-gray-700">{metric.difference}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Metric Detail */}
        {selectedMetric && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              {comparisonMetrics.find(m => m.name === selectedMetric)?.name} Analysis
            </h4>
            <p className="text-sm text-blue-800">
              {comparisonMetrics.find(m => m.name === selectedMetric)?.explanation}
            </p>
          </div>
        )}
      </div>

      {/* Method Advantages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Traditional Advantages */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2 text-blue-600" />
            Traditional Bootstrap Advantages
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Simple and well-understood methodology</span>
            </li>
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>No model assumptions required</span>
            </li>
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Preserves actual historical patterns</span>
            </li>
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Computationally efficient for basic analysis</span>
            </li>
          </ul>
        </div>

        {/* Hybrid Advantages */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2 text-green-600" />
            Hybrid Econometric Advantages
          </h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Reduces bootstrap crisis concentration bias</span>
            </li>
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Captures mean reversion and volatility clustering</span>
            </li>
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Statistical validation of results</span>
            </li>
            <li className="flex items-start">
              <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span>Better handling of extreme scenarios</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200 p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-3">Recommendation</h4>
        <p className="text-sm text-gray-700">
          {overallWinner === 'hybrid' ? (
            <>
              <strong className="text-green-700">Use Hybrid Simulation</strong> for production decisions. 
              The econometric approach provides more reliable projections with statistical validation, 
              especially important for long-term financial planning. Traditional bootstrap remains useful 
              for quick estimates and validation.
            </>
          ) : (
            <>
              <strong className="text-blue-700">Traditional Bootstrap</strong> is performing well for your portfolio. 
              However, consider using Hybrid simulation for critical decisions as it provides 
              additional statistical rigor and bias reduction capabilities.
            </>
          )}
        </p>
      </div>
    </div>
  );
}