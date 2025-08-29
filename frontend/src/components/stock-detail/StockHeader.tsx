/**
 * @fileoverview Stock header component displaying stock symbol, price, and key metrics
 * @description Extracted from StockDetailClient for better separation of concerns
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

'use client';

import { memo } from 'react';
import { SingleStockResponse } from '@/types/stock';

interface StockHeaderProps {
  /** Stock data containing price and metadata */
  readonly stockData: SingleStockResponse;
}

/**
 * Displays the main stock header with price information and key metrics
 * 
 * @param props - Component props
 * @param props.stockData - Stock data object containing price and metadata
 * @returns JSX element representing the stock header
 * 
 * @example
 * ```tsx
 * <StockHeader stockData={stockData} />
 * ```
 */
export const StockHeader = memo<StockHeaderProps>(function StockHeader({ stockData }) {
  const isPositive = (stockData.price_change ?? 0) >= 0;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{stockData.symbol}</h1>
            {stockData.company_name && (
              <p className="text-lg text-gray-600 mt-1">{stockData.company_name}</p>
            )}
          </div>
          
          {/* Stock Badge */}
          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            Stock
          </div>
        </div>

        {/* Price Information */}
        <div className="text-right">
          {stockData.current_price && (
            <div className="text-3xl font-bold text-gray-900">
              ${stockData.current_price.toFixed(2)}
            </div>
          )}
          {stockData.price_change !== undefined && stockData.price_change_percent !== undefined && (
            <div className={`text-lg font-medium flex items-center justify-end ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
              <span 
                className={`inline-flex items-center mr-1 ${isPositive ? 'text-green-700' : 'text-red-600'}`}
                aria-label={isPositive ? 'Price increased' : 'Price decreased'}
              >
                {isPositive ? (
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414 6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                {isPositive ? '+' : ''}${stockData.price_change.toFixed(2)}
              </span>
              <span className="ml-1">
                ({isPositive ? '+' : ''}{stockData.price_change_percent.toFixed(2)}%)
              </span>
            </div>
          )}
          <div className="text-sm text-gray-500 mt-1">
            Last updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* Key Metrics Row */}
      {(stockData.market_cap || stockData.pe_ratio || stockData.dividend_yield) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          {stockData.market_cap && (
            <div className="text-center">
              <p className="text-sm text-gray-500">Market Cap</p>
              <p className="text-lg font-medium">${(stockData.market_cap / 1e9).toFixed(1)}B</p>
            </div>
          )}
          {stockData.pe_ratio && (
            <div className="text-center">
              <p className="text-sm text-gray-500">P/E Ratio</p>
              <p className="text-lg font-medium">{stockData.pe_ratio.toFixed(2)}</p>
            </div>
          )}
          {stockData.dividend_yield && (
            <div className="text-center">
              <p className="text-sm text-gray-500">Dividend Yield</p>
              <p className="text-lg font-medium">{stockData.dividend_yield.toFixed(2)}%</p>
            </div>
          )}
          {stockData.fifty_two_week_high && stockData.fifty_two_week_low && (
            <div className="text-center">
              <p className="text-sm text-gray-500">52W Range</p>
              <p className="text-lg font-medium">
                ${stockData.fifty_two_week_low.toFixed(2)} - ${stockData.fifty_two_week_high.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

StockHeader.displayName = 'StockHeader';