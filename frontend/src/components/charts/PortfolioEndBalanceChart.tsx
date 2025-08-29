'use client';

import { ResponsiveLine, Serie } from '@nivo/line';
import { MonteCarloResponse, formatLargeNumber } from '../../services/monteCarloApi';

interface PortfolioEndBalanceChartProps {
  data: MonteCarloResponse;
  initialBalance: number;
}

export default function PortfolioEndBalanceChart({ data, initialBalance }: PortfolioEndBalanceChartProps) {
  const metrics = data.aggregated_metrics;
  const years = data.simulation_metadata.time_period_years;
  
  // Generate data points for percentile lines
  const generatePercentileLine = (
    percentileData: any,
    label: string,
    color: string
  ): Serie => {
    const points = [];
    
    // Generate smooth curve points
    for (let year = 0; year <= years; year++) {
      const progress = year / years;
      
      // Interpolate between initial balance and final balance
      const value = initialBalance + (percentileData - initialBalance) * progress;
      
      points.push({
        x: year,
        y: value
      });
    }
    
    return {
      id: label,
      color: color,
      data: points
    };
  };

  const chartData: Serie[] = [
    generatePercentileLine(
      metrics.final_balance_real.percentile_10th,
      '10th Percentile',
      '#DC2626' // red-600
    ),
    generatePercentileLine(
      metrics.final_balance_real.percentile_25th,
      '25th Percentile',
      '#F97316' // orange-500
    ),
    generatePercentileLine(
      metrics.final_balance_real.percentile_50th,
      'Median',
      '#3B82F6' // blue-500
    ),
    generatePercentileLine(
      metrics.final_balance_real.percentile_75th,
      '75th Percentile',
      '#10B981' // emerald-500
    ),
    generatePercentileLine(
      metrics.final_balance_real.percentile_90th,
      '90th Percentile',
      '#059669' // emerald-600
    ),
  ];

  return (
    <div style={{ height: '400px' }}>
      <ResponsiveLine
        data={chartData}
        margin={{ top: 20, right: 110, bottom: 60, left: 80 }}
        xScale={{ type: 'linear', min: 0, max: years }}
        yScale={{
          type: 'linear',
          min: 0,
          max: 'auto',
          stacked: false,
          reverse: false
        }}
        yFormat={(value) => formatLargeNumber(Number(value))}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Years',
          legendOffset: 36,
          legendPosition: 'middle',
          truncateTickAt: 0
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Portfolio Value (Real)',
          legendOffset: -60,
          legendPosition: 'middle',
          format: (value) => formatLargeNumber(Number(value)),
          truncateTickAt: 0
        }}
        colors={{ datum: 'color' }}
        lineWidth={2}
        pointSize={0}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        enablePoints={false}
        enableArea={true}
        areaOpacity={0.1}
        useMesh={true}
        legends={[
          {
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 100,
            translateY: 0,
            itemsSpacing: 0,
            itemDirection: 'left-to-right',
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.75,
            symbolSize: 12,
            symbolShape: 'circle',
            symbolBorderColor: 'rgba(0, 0, 0, .5)',
            effects: [
              {
                on: 'hover',
                style: {
                  itemBackground: 'rgba(0, 0, 0, .03)',
                  itemOpacity: 1
                }
              }
            ]
          }
        ]}
        tooltip={({ point }) => (
          <div className="bg-white px-3 py-2 shadow-lg rounded border border-gray-200">
            <div className="text-xs font-medium text-gray-900">{point.serieId}</div>
            <div className="text-xs text-gray-600 mt-1">
              Year {point.data.x}: <span className="font-medium">{formatLargeNumber(Number(point.data.y))}</span>
            </div>
          </div>
        )}
        theme={{
          axis: {
            ticks: {
              text: {
                fontSize: 11,
                fill: '#666'
              }
            },
            legend: {
              text: {
                fontSize: 12,
                fill: '#666'
              }
            }
          },
          legends: {
            text: {
              fontSize: 11,
              fill: '#666'
            }
          },
          grid: {
            line: {
              stroke: '#e0e0e0',
              strokeWidth: 1
            }
          }
        }}
      />
    </div>
  );
}