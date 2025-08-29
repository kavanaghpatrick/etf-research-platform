/**
 * @fileoverview Overview tab component displaying stock summary information
 * @description Shows key metrics, data points, and recent price data
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

'use client';

import { memo } from 'react';
import { SingleStockResponse } from '@/types/stock';

interface OverviewTabProps {
  /** Stock data containing overview information */
  readonly stockData: SingleStockResponse;
}

/**
 * Formats a date string to locale date format with error handling
 * 
 * @param dateString - ISO date string or undefined
 * @returns Formatted date string or 'N/A' if invalid
 */
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'N/A';
  }
};

/**
 * Formats a number to currency format with error handling
 * 
 * @param value - Number value or undefined
 * @returns Formatted currency string or 'N/A' if invalid
 */
const formatCurrency = (value: number | undefined): string => {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return `$${value.toFixed(2)}`;
};

/**
 * Overview tab showing stock summary and recent data
 * 
 * @param props - Component props
 * @param props.stockData - Stock data object containing overview information
 * @returns JSX element representing the overview tab content
 * 
 * @example
 * ```tsx
 * <OverviewTab stockData={stockData} />
 * ```
 */
export const OverviewTab = memo<OverviewTabProps>(function OverviewTab({ stockData }) {
  // Add defensive checks for data access
  const dataPoints = stockData.data?.length ?? 0;
  const startDate = formatDate(stockData.date_range?.start);
  const endDate = formatDate(stockData.date_range?.end);
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900">Data Points</h3>
          <p className="text-2xl font-bold text-blue-600">{dataPoints}</p>
          <p className="text-sm text-blue-700">Historical records</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h3 className="font-medium text-green-900">Date Range</h3>
          <p className="text-sm font-bold text-green-600">{startDate}</p>
          <p className="text-sm text-green-700">to {endDate}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <h3 className="font-medium text-purple-900">Symbol</h3>
          <p className="text-2xl font-bold text-purple-600">{stockData.symbol}</p>
          <p className="text-sm text-purple-700">Stock ticker</p>
        </div>
      </div>

      {/* Dividend Preview */}
      {stockData.dividend_data && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-green-900 flex items-center">
                <span className="text-lg mr-2">💰</span>
                Dividend Information Available
              </h4>
              <p className="text-sm text-green-700 mt-1">
                {stockData.dividend_data.dividend_count > 0 
                  ? `${stockData.dividend_data.dividend_count} dividend payments totaling ${formatCurrency(stockData.dividend_data.total_dividends)}`
                  : "Dividend analysis completed for this stock"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-green-600">Total Dividends</p>
              <p className="text-xl font-bold text-green-800">
                {formatCurrency(stockData.dividend_data.total_dividends)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Data Preview */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Price Data</h3>
        <div className="overflow-x-auto">
          <table 
            className="min-w-full text-sm"
            role="table"
            aria-label="Recent stock price data for the last 10 trading days"
          >
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2" scope="col">Date</th>
                <th className="text-right py-2" scope="col">Open</th>
                <th className="text-right py-2" scope="col">High</th>
                <th className="text-right py-2" scope="col">Low</th>
                <th className="text-right py-2" scope="col">Close</th>
                <th className="text-right py-2" scope="col">Volume</th>
              </tr>
            </thead>
            <tbody>
              {(stockData.data ?? []).slice(-10).reverse().map((row, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2">{formatDate(row.Date)}</td>
                  <td className="text-right py-2">{formatCurrency(row.Open)}</td>
                  <td className="text-right py-2">{formatCurrency(row.High)}</td>
                  <td className="text-right py-2">{formatCurrency(row.Low)}</td>
                  <td className="text-right py-2">{formatCurrency(row.Close)}</td>
                  <td className="text-right py-2">{row.Volume?.toLocaleString() ?? 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Showing last 10 trading days
        </p>
      </div>
    </div>
  );
});

OverviewTab.displayName = 'OverviewTab';