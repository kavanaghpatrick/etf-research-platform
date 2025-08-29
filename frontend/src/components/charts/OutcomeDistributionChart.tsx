'use client';

import { ResponsiveBar } from '@nivo/bar';
import { useMemo, memo, useCallback } from 'react';
import { MonteCarloResponse, formatLargeNumber } from '../../services/monteCarloApi';

// Static Nivo props to prevent re-creation
const staticMargin = { top: 20, right: 20, bottom: 60, left: 100 };
const staticPadding = 0.3;
const staticValueScale = { type: 'linear' };
const staticIndexScale = { type: 'band', round: true };
const staticBorderColor = {
  from: 'color',
  modifiers: [['darker', 1.6]],
};
const staticTheme = {
  axis: {
    ticks: {
      text: {
        fontSize: 11,
        fill: '#666',
      },
    },
    legend: {
      text: {
        fontSize: 12,
        fill: '#666',
        fontWeight: 500,
      },
    },
  },
  labels: {
    text: {
      fontSize: 11,
      fill: '#fff',
      fontWeight: 500,
    },
  },
  grid: {
    line: {
      stroke: '#e0e0e0',
      strokeWidth: 1,
    },
  },
};

interface OutcomeDistributionChartProps {
  data: MonteCarloResponse;
  showReal?: boolean;
}

const OutcomeDistributionChart = memo(function OutcomeDistributionChart({ data, showReal = true }: OutcomeDistributionChartProps) {
  const metrics = data.aggregated_metrics;
  
  // Memoize percentile data for nominal values
  const nominalPercentileData = useMemo(() => [
    {
      range: '0-10%',
      label: 'Worst 10%',
      value: metrics.final_balance_nominal.percentile_10th,
      color: '#dc2626', // red-600
    },
    {
      range: '10-25%',
      label: '10-25th',
      value: metrics.final_balance_nominal.percentile_25th,
      color: '#ea580c', // orange-600
    },
    {
      range: '25-50%',
      label: '25-50th',
      value: metrics.final_balance_nominal.percentile_50th,
      color: '#f59e0b', // amber-500
    },
    {
      range: '50-75%',
      label: '50-75th',
      value: metrics.final_balance_nominal.percentile_75th,
      color: '#84cc16', // lime-500
    },
    {
      range: '75-90%',
      label: '75-90th',
      value: metrics.final_balance_nominal.percentile_90th,
      color: '#22c55e', // green-500
    },
    {
      range: '90-100%',
      label: 'Best 10%',
      value: metrics.final_balance_nominal.percentile_90th * 1.2, // Estimate
      color: '#059669', // emerald-600
    },
  ], [metrics.final_balance_nominal]);

  // Memoize percentile data for real values
  const realPercentileData = useMemo(() => [
    {
      range: '0-10%',
      label: 'Worst 10%',
      value: metrics.final_balance_real.percentile_10th,
      color: '#dc2626', // red-600
    },
    {
      range: '10-25%',
      label: '10-25th',
      value: metrics.final_balance_real.percentile_25th,
      color: '#ea580c', // orange-600
    },
    {
      range: '25-50%',
      label: '25-50th',
      value: metrics.final_balance_real.percentile_50th,
      color: '#f59e0b', // amber-500
    },
    {
      range: '50-75%',
      label: '50-75th',
      value: metrics.final_balance_real.percentile_75th,
      color: '#84cc16', // lime-500
    },
    {
      range: '75-90%',
      label: '75-90th',
      value: metrics.final_balance_real.percentile_90th,
      color: '#22c55e', // green-500
    },
    {
      range: '90-100%',
      label: 'Best 10%',
      value: metrics.final_balance_real.percentile_90th * 1.2, // Estimate
      color: '#059669', // emerald-600
    },
  ], [metrics.final_balance_real]);

  // Select the appropriate pre-computed dataset
  const percentileData = showReal ? realPercentileData : nominalPercentileData;

  // Memoize axis objects to prevent re-creation
  const axisBottom = useMemo(() => ({
    tickSize: 5,
    tickPadding: 5,
    tickRotation: -45,
    legend: 'Outcome Percentiles',
    legendPosition: 'middle' as const,
    legendOffset: 50,
  }), []);

  const axisLeft = useMemo(() => ({
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: showReal ? 'Final Portfolio Value (Inflation-Adjusted)' : 'Final Portfolio Value (Nominal)',
    legendPosition: 'middle' as const,
    legendOffset: -80,
    format: (value: any) => formatLargeNumber(Number(value)),
  }), [showReal]);

  const labelTextColor = useMemo(() => ({
    from: 'color' as const,
    modifiers: [['darker', 3]] as const,
  }), []);

  // Stable tooltip callback
  const tooltip = useCallback(({ data }: any) => (
    <div className="bg-white px-3 py-2 shadow-lg rounded border border-gray-200">
      <div className="text-sm font-medium text-gray-900">{data.range} of Simulations</div>
      <div className="text-xs text-gray-600 mt-1">
        Outcome: <span className="font-medium">{formatLargeNumber(data.value as number)}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {data.label === 'Worst 10%' && 'Only 10% of simulations had worse outcomes'}
        {data.label === 'Best 10%' && 'Only 10% of simulations had better outcomes'}
        {data.label === '25-50th' && '25% of simulations fell in this range'}
        {data.label === '50-75th' && '25% of simulations fell in this range'}
      </div>
    </div>
  ), []);

  const labelFormatter = useCallback((d: any) => formatLargeNumber(d.value as number), []);
  const colorAccessor = useCallback((bar: any) => bar.data.color, []);

  return (
    <div style={{ height: '400px' }}>
      <ResponsiveBar
        data={percentileData}
        keys={['value']}
        indexBy="label"
        margin={staticMargin}
        padding={staticPadding}
        valueScale={staticValueScale}
        indexScale={staticIndexScale}
        colors={colorAccessor}
        borderColor={staticBorderColor}
        axisTop={null}
        axisRight={null}
        axisBottom={axisBottom}
        axisLeft={axisLeft}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor={labelTextColor}
        label={labelFormatter}
        tooltip={tooltip}
        theme={staticTheme}
      />
    </div>
  );
});

export default OutcomeDistributionChart;