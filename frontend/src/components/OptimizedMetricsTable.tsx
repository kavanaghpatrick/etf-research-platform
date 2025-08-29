'use client';

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { formatLargeNumber, formatPercentage } from '../services/monteCarloApi';

interface MetricsTableProps {
  metrics: any;
  className?: string;
}

interface MetricRow {
  label: string;
  values: string[];
  category: string;
}

const Row = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: MetricRow[] }) => {
  const row = data[index];
  const isHeader = row.category === 'header';
  
  return (
    <div style={style} className={`flex items-center ${isHeader ? 'font-bold bg-gray-100' : index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex-1 px-4 py-2 text-sm">{row.label}</div>
      {row.values.map((value, i) => (
        <div key={i} className="w-32 px-4 py-2 text-sm text-right">
          {value}
        </div>
      ))}
    </div>
  );
});

Row.displayName = 'MetricRow';

export default function OptimizedMetricsTable({ metrics, className = '' }: MetricsTableProps) {
  const tableData = useMemo((): MetricRow[] => {
    const rows: MetricRow[] = [];
    
    // Headers
    rows.push({
      label: 'Metric',
      values: ['10th %ile', '25th %ile', 'Median', '75th %ile', '90th %ile'],
      category: 'header'
    });
    
    // Final Balance
    rows.push({
      label: 'Final Balance (Nominal)',
      values: [
        formatLargeNumber(metrics.final_balance_nominal.percentile_10th),
        formatLargeNumber(metrics.final_balance_nominal.percentile_25th),
        formatLargeNumber(metrics.final_balance_nominal.percentile_50th),
        formatLargeNumber(metrics.final_balance_nominal.percentile_75th),
        formatLargeNumber(metrics.final_balance_nominal.percentile_90th)
      ],
      category: 'balance'
    });
    
    rows.push({
      label: 'Final Balance (Real)',
      values: [
        formatLargeNumber(metrics.final_balance_real.percentile_10th),
        formatLargeNumber(metrics.final_balance_real.percentile_25th),
        formatLargeNumber(metrics.final_balance_real.percentile_50th),
        formatLargeNumber(metrics.final_balance_real.percentile_75th),
        formatLargeNumber(metrics.final_balance_real.percentile_90th)
      ],
      category: 'balance'
    });
    
    // Returns
    rows.push({
      label: 'Annual Return (Nominal)',
      values: [
        formatPercentage(metrics.annual_mean_return.percentile_10th),
        formatPercentage(metrics.annual_mean_return.percentile_25th),
        formatPercentage(metrics.annual_mean_return.percentile_50th),
        formatPercentage(metrics.annual_mean_return.percentile_75th),
        formatPercentage(metrics.annual_mean_return.percentile_90th)
      ],
      category: 'returns'
    });
    
    rows.push({
      label: 'TWRR (Real)',
      values: [
        formatPercentage(metrics.twrr_real.percentile_10th),
        formatPercentage(metrics.twrr_real.percentile_25th),
        formatPercentage(metrics.twrr_real.percentile_50th),
        formatPercentage(metrics.twrr_real.percentile_75th),
        formatPercentage(metrics.twrr_real.percentile_90th)
      ],
      category: 'returns'
    });
    
    // Risk Metrics
    rows.push({
      label: 'Annual Volatility',
      values: [
        formatPercentage(metrics.annual_volatility.percentile_10th),
        formatPercentage(metrics.annual_volatility.percentile_25th),
        formatPercentage(metrics.annual_volatility.percentile_50th),
        formatPercentage(metrics.annual_volatility.percentile_75th),
        formatPercentage(metrics.annual_volatility.percentile_90th)
      ],
      category: 'risk'
    });
    
    rows.push({
      label: 'Max Drawdown',
      values: [
        formatPercentage(metrics.max_drawdown.percentile_10th),
        formatPercentage(metrics.max_drawdown.percentile_25th),
        formatPercentage(metrics.max_drawdown.percentile_50th),
        formatPercentage(metrics.max_drawdown.percentile_75th),
        formatPercentage(metrics.max_drawdown.percentile_90th)
      ],
      category: 'risk'
    });
    
    // Risk-Adjusted Returns
    rows.push({
      label: 'Sharpe Ratio',
      values: [
        metrics.sharpe_ratio.percentile_10th.toFixed(2),
        metrics.sharpe_ratio.percentile_25th.toFixed(2),
        metrics.sharpe_ratio.percentile_50th.toFixed(2),
        metrics.sharpe_ratio.percentile_75th.toFixed(2),
        metrics.sharpe_ratio.percentile_90th.toFixed(2)
      ],
      category: 'risk-adjusted'
    });
    
    rows.push({
      label: 'Sortino Ratio',
      values: [
        metrics.sortino_ratio.percentile_10th.toFixed(2),
        metrics.sortino_ratio.percentile_25th.toFixed(2),
        metrics.sortino_ratio.percentile_50th.toFixed(2),
        metrics.sortino_ratio.percentile_75th.toFixed(2),
        metrics.sortino_ratio.percentile_90th.toFixed(2)
      ],
      category: 'risk-adjusted'
    });
    
    // Withdrawal Rates
    rows.push({
      label: 'Safe Withdrawal Rate',
      values: [
        formatPercentage(metrics.safe_withdrawal_rate.percentile_10th),
        formatPercentage(metrics.safe_withdrawal_rate.percentile_25th),
        formatPercentage(metrics.safe_withdrawal_rate.percentile_50th),
        formatPercentage(metrics.safe_withdrawal_rate.percentile_75th),
        formatPercentage(metrics.safe_withdrawal_rate.percentile_90th)
      ],
      category: 'withdrawal'
    });
    
    rows.push({
      label: 'Perpetual Withdrawal Rate',
      values: [
        formatPercentage(metrics.perpetual_withdrawal_rate.percentile_10th),
        formatPercentage(metrics.perpetual_withdrawal_rate.percentile_25th),
        formatPercentage(metrics.perpetual_withdrawal_rate.percentile_50th),
        formatPercentage(metrics.perpetual_withdrawal_rate.percentile_75th),
        formatPercentage(metrics.perpetual_withdrawal_rate.percentile_90th)
      ],
      category: 'withdrawal'
    });
    
    return rows;
  }, [metrics]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Detailed Metrics by Percentile</h3>
      </div>
      
      <List
        height={400}
        itemCount={tableData.length}
        itemSize={48}
        width="100%"
        itemData={tableData}
      >
        {Row}
      </List>
      
      <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        <p>• All monetary values are in today&apos;s dollars (inflation-adjusted where noted)</p>
        <p>• Percentiles show the range of possible outcomes from the simulation</p>
        <p>• Risk metrics help evaluate portfolio stability and downside protection</p>
      </div>
    </div>
  );
}