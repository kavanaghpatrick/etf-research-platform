'use client';

import { ResponsiveLine } from '@nivo/line';
import { useMemo, useCallback, memo } from 'react';
import { formatLargeNumber } from '../services/monteCarloApi';
import { validateChartData } from '../utils/chartValidation';

// Static constants moved outside component for stability
const percentileColors = {
  '10th': '#dc2626', // red-600 - 10th percentile (worst case)
  '50th': '#3b82f6', // blue-600 - 50th percentile (median)  
  '90th': '#059669', // emerald-600 - 90th percentile (best case)
  // Legacy keys for backward compatibility
  p10: '#dc2626',
  p25: '#ea580c', 
  p50: '#3b82f6',
  p75: '#16a34a',
  p90: '#059669',
};

const percentileLabels = {
  '10th': '10th Percentile (Worst Case)',
  '50th': 'Median (50th Percentile)',
  '90th': '90th Percentile (Best Case)',
  // Legacy keys for backward compatibility
  p10: '10th Percentile (Worst Case)',
  p25: '25th Percentile',
  p50: 'Median (50th)',
  p75: '75th Percentile',
  p90: '90th Percentile (Best Case)',
};

// Static Nivo props to prevent re-creation
const staticMargin = { top: 10, right: 110, bottom: 50, left: 80 };
const staticXScale = { type: 'linear' };
const staticYScale = {
  type: 'linear',
  min: 'auto',
  max: 'auto',
  stacked: false,
  reverse: false,
};
const staticAxisBottom = {
  tickSize: 5,
  tickPadding: 5,
  tickRotation: 0,
  legend: 'Years',
  legendOffset: 36,
  legendPosition: 'middle',
  format: (value: number) => `${value}Y`,
};
const staticColors = { datum: 'color' };
const staticLegends = [
  {
    anchor: 'bottom-right' as const,
    direction: 'column' as const,
    justify: false,
    translateX: 100,
    translateY: 0,
    itemsSpacing: 0,
    itemDirection: 'left-to-right' as const,
    itemWidth: 80,
    itemHeight: 20,
    itemOpacity: 0.75,
    symbolSize: 12,
    symbolShape: 'circle' as const,
    symbolBorderColor: 'rgba(0, 0, 0, .5)',
    effects: [
      {
        on: 'hover' as const,
        style: {
          itemBackground: 'rgba(0, 0, 0, .03)',
          itemOpacity: 1,
        },
      },
    ],
  },
];
const staticTheme = {
  axis: {
    domain: {
      line: {
        stroke: '#e5e7eb',
      },
    },
    ticks: {
      line: {
        stroke: '#e5e7eb',
        strokeWidth: 1,
      },
      text: {
        fontSize: 11,
        fill: '#6b7280',
      },
    },
    legend: {
      text: {
        fontSize: 12,
        fill: '#374151',
        fontWeight: 500,
      },
    },
  },
  grid: {
    line: {
      stroke: '#f3f4f6',
      strokeWidth: 1,
    },
  },
  legends: {
    text: {
      fontSize: 11,
      fill: '#4b5563',
    },
  },
};

interface GrowthChartProps {
  data: {
    time_years: number[];
    percentile_paths_nominal: Record<string, number[]>;
    percentile_paths_real: Record<string, number[]>;
    initial_balance: number;
  };
  showReal?: boolean;
}

const GrowthChart = memo(function GrowthChart({ data, showReal = false }: GrowthChartProps) {
  // Validate chart data first
  const validation = useMemo(() => validateChartData(data), [data]);

  // If validation fails, render error state
  if (!validation.valid) {
    return (
      <div className="h-96 w-full flex items-center justify-center bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center p-6">
          <div className="rounded-full bg-red-100 p-3 mb-4 inline-block">
            <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-red-800 mb-2">Unable to render chart</h3>
          <p className="text-red-600 text-sm">{validation.error}</p>
          <p className="text-sm text-red-500 mt-1">Please try running the simulation again.</p>
        </div>
      </div>
    );
  }

  // Log any warnings
  if (validation.warnings) {
    console.warn('Chart data warnings:', validation.warnings);
  }

  // Memoize chart data transformation for nominal values with data decimation
  const nominalChartData = useMemo(() => {
    // Reduce data points for performance - target ~100-200 points max
    const maxPoints = 200;
    const step = Math.max(1, Math.ceil(data.time_years.length / maxPoints));
    
    // Debug: Log data reduction for performance analysis
    const originalCount = data.time_years.length;
    const reducedCount = Math.ceil(originalCount / step);
    console.log(`📊 Chart Performance: Reduced ${originalCount} points to ~${reducedCount} (step: ${step})`);
    
    // Debug: Log percentile data structure and colors
    console.log('📊 Chart Debug - Percentile Data:', Object.keys(data.percentile_paths_nominal));
    
    const chartSeries = Object.entries(data.percentile_paths_nominal).map(([percentile, values]) => {
      const color = percentileColors[percentile];
      const label = percentileLabels[percentile] || percentile;
      
      // Debug: Log each series
      console.log(`📊 Chart Series: ${percentile} -> color: ${color}, label: ${label}, points: ${values.length}`);
      
      return {
        id: label,
        color: color || '#6b7280', // fallback to gray if no color found
        data: data.time_years
          .map((year, index) => ({ x: year, y: values[index], index }))
          .filter((_, index) => index % step === 0 || index === data.time_years.length - 1) // Include first, every nth, and last
          .map(({ x, y }) => ({ x, y })),
      };
    });
    
    console.log(`📊 Chart Debug - Final series count: ${chartSeries.length}`);
    console.log(`📊 Chart Debug - Series colors:`, chartSeries.map(s => ({ id: s.id, color: s.color })));
    
    return chartSeries;
  }, [data.percentile_paths_nominal, data.time_years]);

  // Memoize chart data transformation for real values with data decimation
  const realChartData = useMemo(() => {
    // Reduce data points for performance - target ~100-200 points max
    const maxPoints = 200;
    const step = Math.max(1, Math.ceil(data.time_years.length / maxPoints));
    
    return Object.entries(data.percentile_paths_real).map(([percentile, values]) => {
      const color = percentileColors[percentile];
      const label = percentileLabels[percentile] || percentile;
      
      return {
        id: label,
        color: color || '#6b7280', // fallback to gray if no color found
        data: data.time_years
          .map((year, index) => ({ x: year, y: values[index], index }))
          .filter((_, index) => index % step === 0 || index === data.time_years.length - 1) // Include first, every nth, and last
          .map(({ x, y }) => ({ x, y })),
      };
    });
  }, [data.percentile_paths_real, data.time_years]);

  // Select the appropriate pre-computed dataset
  const chartData = showReal ? realChartData : nominalChartData;

  // Memoize axisLeft (only prop that changes with showReal)
  const axisLeft = useMemo(() => ({
    tickSize: 5,
    tickPadding: 5,
    tickRotation: 0,
    legend: showReal ? 'Portfolio Value (Inflation-Adjusted)' : 'Portfolio Value (Nominal)',
    legendOffset: -60,
    legendPosition: 'middle' as const,
    format: formatLargeNumber,
  }), [showReal]);

  // Stable callback for sliceTooltip
  const sliceTooltip = useCallback(({ slice }: any) => (
    <div className="bg-white px-3 py-2 shadow-lg rounded-md border border-gray-200">
      <div className="text-sm font-medium mb-1">
        Year {slice.points[0].data.x}
      </div>
      {slice.points.map((point: any) => (
        <div
          key={point.id}
          className="flex items-center gap-2 text-xs"
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: point.color }}
          />
          <span className="text-gray-600">{point.id}:</span>
          <span className="font-medium">
            {formatLargeNumber(point.data.y)}
          </span>
        </div>
      ))}
    </div>
  ), []);

  return (
    <div className="h-96 w-full">
      <ResponsiveLine
        data={chartData}
        margin={staticMargin}
        xScale={staticXScale}
        yScale={staticYScale}
        curve="linear"
        axisBottom={staticAxisBottom}
        axisLeft={axisLeft}
        colors={staticColors}
        pointSize={0}
        enableSlices={false}
        enableArea={true}
        areaOpacity={0.1}
        useMesh={false}
        legends={staticLegends}
        sliceTooltip={sliceTooltip}
        theme={staticTheme}
      />
    </div>
  );
});

export default GrowthChart;