'use client';

import { AggregatedMetrics, formatPercentage, formatLargeNumber } from '../services/monteCarloApi';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface MetricsTableProps {
  metrics: AggregatedMetrics;
}

interface MetricRow {
  name: string;
  category: string;
  description: string;
  formatter: (value: number) => string;
  key: keyof AggregatedMetrics;
}

const metricDefinitions: MetricRow[] = [
  {
    name: 'Time-Weighted Return (Nominal)',
    category: 'Returns',
    description: 'Annualized return before inflation adjustment',
    formatter: formatPercentage,
    key: 'twrr_nominal'
  },
  {
    name: 'Time-Weighted Return (Real)',
    category: 'Returns',
    description: 'Annualized return after inflation adjustment',
    formatter: formatPercentage,
    key: 'twrr_real'
  },
  {
    name: 'Annual Mean Return',
    category: 'Returns',
    description: 'Average annual return across all simulation paths',
    formatter: formatPercentage,
    key: 'annual_mean_return'
  },
  {
    name: 'Final Balance (Nominal)',
    category: 'Portfolio Value',
    description: 'Ending portfolio value in future dollars',
    formatter: formatLargeNumber,
    key: 'final_balance_nominal'
  },
  {
    name: 'Final Balance (Real)',
    category: 'Portfolio Value',
    description: 'Ending portfolio value in today\'s dollars',
    formatter: formatLargeNumber,
    key: 'final_balance_real'
  },
  {
    name: 'Annual Volatility',
    category: 'Risk',
    description: 'Standard deviation of annual returns',
    formatter: formatPercentage,
    key: 'annual_volatility'
  },
  {
    name: 'Sharpe Ratio',
    category: 'Risk-Adjusted',
    description: 'Excess return per unit of total risk',
    formatter: (v) => v.toFixed(2),
    key: 'sharpe_ratio'
  },
  {
    name: 'Sortino Ratio',
    category: 'Risk-Adjusted',
    description: 'Excess return per unit of downside risk',
    formatter: (v) => v.toFixed(2),
    key: 'sortino_ratio'
  },
  {
    name: 'Maximum Drawdown',
    category: 'Risk',
    description: 'Largest peak-to-trough decline',
    formatter: (v) => formatPercentage(Math.abs(v)),
    key: 'max_drawdown'
  },
  {
    name: 'Max Drawdown (ex. Cashflows)',
    category: 'Risk',
    description: 'Time-weighted drawdown based on investment performance only',
    formatter: (v) => formatPercentage(Math.abs(v)),
    key: 'max_drawdown_excl_cashflows'
  },
  {
    name: 'Safe Withdrawal Rate',
    category: 'Withdrawal',
    description: 'Sustainable annual withdrawal rate',
    formatter: formatPercentage,
    key: 'safe_withdrawal_rate'
  },
  {
    name: 'Perpetual Withdrawal Rate',
    category: 'Withdrawal',
    description: 'Withdrawal rate that preserves capital indefinitely',
    formatter: formatPercentage,
    key: 'perpetual_withdrawal_rate'
  }
];

export default function MetricsTable({ metrics }: MetricsTableProps) {
  const categories = [...new Set(metricDefinitions.map(m => m.category))];

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Metric
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              10th %ile
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              25th %ile
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
              Median
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              75th %ile
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              90th %ile
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {categories.map((category, categoryIndex) => (
            <React.Fragment key={category}>
              {/* Category Header */}
              <tr className="bg-gray-50">
                <td colSpan={6} className="px-6 py-2 text-sm font-medium text-gray-700">
                  {category}
                </td>
              </tr>
              
              {/* Metrics in this category */}
              {metricDefinitions
                .filter(metric => metric.category === category)
                .map((metric, index) => {
                  const data = metrics[metric.key];
                  
                  return (
                    <tr key={metric.key} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <span>{metric.name}</span>
                          <div className="group relative ml-2">
                            <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                              {metric.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {metric.formatter(data.percentile_10th)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {metric.formatter(data.percentile_25th)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center bg-blue-50">
                        {metric.formatter(data.percentile_50th)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {metric.formatter(data.percentile_75th)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        {metric.formatter(data.percentile_90th)}
                      </td>
                    </tr>
                  );
                })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      
      {/* Table Footer with Export Options */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            All values shown are based on {metrics.twrr_nominal.percentile_50th > 0 ? 'historical' : 'simulated'} market data
          </p>
          <div className="flex space-x-2">
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Export as CSV
            </button>
            <span className="text-gray-400">|</span>
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              Export as PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Fix for React fragment import
import React from 'react';