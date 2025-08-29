'use client';

import { useState, useEffect, useRef } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface PortfolioItem {
  id: string;
  ticker: string;
  percentage: number;
}

interface PortfolioAllocationProps {
  onPortfolioChange: (portfolio: PortfolioItem[]) => void;
  initialPortfolio?: PortfolioItem[];
}

export default function PortfolioAllocation({ 
  onPortfolioChange, 
  initialPortfolio = [
    { id: '1', ticker: 'SPY', percentage: 60 },
    { id: '2', ticker: 'BND', percentage: 40 }
  ]
}: PortfolioAllocationProps) {
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(initialPortfolio);
  const [newTicker, setNewTicker] = useState('');
  const [isAddingTicker, setIsAddingTicker] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [inputValues, setInputValues] = useState<{ [key: string]: string }>({});
  const tickerInputRef = useRef<HTMLInputElement>(null);

  const totalPercentage = portfolio.reduce((sum, item) => sum + item.percentage, 0);
  const isValidTotal = Math.abs(totalPercentage - 100) < 0.01; // Allow for small floating point errors

  // Auto-focus the ticker input when the user clicks "Add Ticker"
  useEffect(() => {
    if (isAddingTicker && tickerInputRef.current) {
      tickerInputRef.current.focus();
    }
  }, [isAddingTicker]);

  useEffect(() => {
    onPortfolioChange(portfolio);
  }, [portfolio, onPortfolioChange]);

  const validateTicker = (ticker: string): boolean => {
    // Basic ticker validation - alphanumeric, 1-5 characters
    const tickerRegex = /^[A-Z]{1,5}$/;
    return tickerRegex.test(ticker.toUpperCase());
  };

  const addTicker = () => {
    const ticker = newTicker.toUpperCase().trim();
    
    if (!ticker) {
      setErrors({ ...errors, newTicker: 'Ticker symbol is required' });
      return;
    }

    if (!validateTicker(ticker)) {
      setErrors({ ...errors, newTicker: 'Invalid ticker format (1-5 letters only)' });
      return;
    }

    if (portfolio.some(item => item.ticker === ticker)) {
      setErrors({ ...errors, newTicker: 'Ticker already exists in portfolio' });
      return;
    }

    if (portfolio.length >= 10) {
      setErrors({ ...errors, newTicker: 'Maximum 10 tickers allowed' });
      return;
    }

    const newItem: PortfolioItem = {
      id: Date.now().toString(),
      ticker,
      percentage: Math.max(0.1, 100 - totalPercentage) // Auto-calculate remaining percentage
    };

    setPortfolio([...portfolio, newItem]);
    setNewTicker('');
    setIsAddingTicker(false);
    setErrors({ ...errors, newTicker: undefined });
  };

  const cancelAddTicker = () => {
    setIsAddingTicker(false);
    setNewTicker('');
    setErrors({ ...errors, newTicker: undefined });
  };

  const removeTicker = (id: string) => {
    setPortfolio(portfolio.filter(item => item.id !== id));
    // Clean up input values for removed item
    setInputValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
  };

  const handlePercentageInputChange = (id: string, value: string) => {
    // Store the raw input value for display
    setInputValues(prev => ({ ...prev, [id]: value }));
  };

  const handlePercentageInputBlur = (id: string, value: string) => {
    const numericValue = parseFloat(value);
    
    if (isNaN(numericValue) || value.trim() === '') {
      // If invalid input or empty, reset to current portfolio value
      setInputValues(prev => ({ ...prev, [id]: '' }));
      return;
    }
    
    // Clamp percentage between 0.1 and 99.9 for more flexibility
    const clampedPercentage = Math.max(0.1, Math.min(99.9, numericValue));
    
    setPortfolio(portfolio.map(item => 
      item.id === id ? { ...item, percentage: clampedPercentage } : item
    ));
    
    // Clear the input value so it uses the portfolio value
    setInputValues(prev => ({ ...prev, [id]: '' }));
  };

  const getColorForIndex = (index: number): string => {
    const colors = [
      'bg-blue-600',
      'bg-green-600', 
      'bg-purple-600',
      'bg-red-600',
      'bg-yellow-600',
      'bg-indigo-600',
      'bg-pink-600',
      'bg-gray-600',
      'bg-orange-600',
      'bg-teal-600'
    ];
    return colors[index % colors.length];
  };

  const getBackgroundColorForIndex = (index: number): string => {
    const colors = [
      'bg-blue-200',
      'bg-green-200', 
      'bg-purple-200',
      'bg-red-200',
      'bg-yellow-200',
      'bg-indigo-200',
      'bg-pink-200',
      'bg-gray-200',
      'bg-orange-200',
      'bg-teal-200'
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="p-6 border-b border-gray-200">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Portfolio Allocation</h3>
      
      {/* Add Ticker Section */}
      {!isAddingTicker ? (
        <button 
          className="w-full mb-4 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
          onClick={() => setIsAddingTicker(true)}
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Add Ticker
        </button>
      ) : (
        <div className="mb-4 p-3 border border-gray-300 rounded-lg">
          <div className="flex space-x-2">
            <input
              ref={tickerInputRef}
              type="text"
              placeholder="e.g., AAPL"
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && addTicker()}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={5}
            />
            <button
              onClick={addTicker}
              className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Add
            </button>
            <button
              onClick={cancelAddTicker}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
          </div>
          {errors.newTicker && (
            <p className="mt-2 text-sm text-red-600">{errors.newTicker}</p>
          )}
        </div>
      )}

      {/* Portfolio Items */}
      <div className="space-y-3">
        {portfolio.map((item, index) => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3 flex-1">
              <span className="font-medium text-gray-900 min-w-[60px]">{item.ticker}</span>
              <div className="flex-1 max-w-[120px]">
                <div className={`h-2 ${getBackgroundColorForIndex(index)} rounded-full`}>
                  <div 
                    className={`h-2 ${getColorForIndex(index)} rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                value={inputValues[item.id] !== undefined ? inputValues[item.id] : item.percentage}
                onChange={(e) => handlePercentageInputChange(item.id, e.target.value)}
                onBlur={(e) => handlePercentageInputBlur(item.id, e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min="0.1"
                max="99.9"
                step="0.1"
                placeholder={item.percentage.toString()}
              />
              <span className="text-sm font-medium text-gray-700">%</span>
              {portfolio.length > 1 && (
                <button 
                  onClick={() => removeTicker(item.id)}
                  className="text-gray-400 hover:text-red-500 p-1"
                  title="Remove ticker"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Total Validation */}
      <div className={`mt-4 p-3 border rounded-lg ${
        isValidTotal 
          ? 'bg-green-50 border-green-200' 
          : 'bg-red-50 border-red-200'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${
            isValidTotal ? 'text-green-800' : 'text-red-800'
          }`}>
            Total Allocation
          </span>
          <span className={`text-sm font-bold ${
            isValidTotal ? 'text-green-800' : 'text-red-800'
          }`}>
            {totalPercentage.toFixed(1)}% {isValidTotal ? '✓' : '✗'}
          </span>
        </div>
        {!isValidTotal && (
          <p className="text-xs text-red-600 mt-1">
            Total must equal 100%. Current difference: {(totalPercentage - 100).toFixed(1)}%
          </p>
        )}
      </div>

      {/* Quick Actions */}
      {!isValidTotal && portfolio.length > 1 && (
        <div className="mt-3">
          <button
            onClick={() => {
              const remainder = 100 - totalPercentage;
              const adjustment = remainder / portfolio.length;
              setPortfolio(portfolio.map(item => ({
                ...item,
                percentage: Math.max(0.1, Math.min(99.9, item.percentage + adjustment))
              })));
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Auto-balance allocations
          </button>
        </div>
      )}
    </div>
  );
}