'use client';

import { useState } from 'react';
import { InformationCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

export type SimulationMethod = 'traditional' | 'hybrid';

interface SimulationMethodSelectorProps {
  selectedMethod: SimulationMethod;
  onMethodChange: (method: SimulationMethod) => void;
  className?: string;
}

export default function SimulationMethodSelector({
  selectedMethod,
  onMethodChange,
  className = ""
}: SimulationMethodSelectorProps) {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className={`p-6 border-b border-gray-200 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <div className="h-5 w-5 bg-blue-100 rounded-full flex items-center justify-center mr-2">
          <div className="h-2 w-2 bg-blue-600 rounded-full"></div>
        </div>
        Simulation Method
      </h3>
      
      <div className="space-y-3">
        {/* Traditional Monte Carlo Option */}
        <label className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
          selectedMethod === 'traditional' 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}>
          <input
            type="radio"
            value="traditional"
            checked={selectedMethod === 'traditional'}
            onChange={() => onMethodChange('traditional')}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-900">
                Traditional Monte Carlo
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Bootstrap resampling methodology
            </div>
            <div className="text-xs text-gray-400 mt-1">
              • Uses historical data blocks
              • Established method
              • Fast execution
            </div>
          </div>
        </label>

        {/* Hybrid Econometric Option */}
        <label className={`relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
          selectedMethod === 'hybrid' 
            ? 'border-green-500 bg-green-50' 
            : 'border-green-200 hover:border-green-300 hover:bg-green-50'
        }`}>
          <input
            type="radio"
            value="hybrid"
            checked={selectedMethod === 'hybrid'}
            onChange={() => onMethodChange('hybrid')}
            className="mt-1 h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-900">
                Hybrid Econometric
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full font-medium">
                Recommended ✨
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Bias-free VAR+GARCH+Bootstrap methodology
            </div>
            <div className="text-xs text-gray-400 mt-1">
              • Eliminates crisis concentration bias
              • More realistic volatility modeling
              • Statistical validation included
            </div>
          </div>
        </label>
      </div>

      {/* Comparison Info Toggle */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="mt-4 flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <InformationCircleIcon className="h-4 w-4 mr-1" />
        {showComparison ? 'Hide' : 'Show'} detailed comparison
        {showComparison ? (
          <ChevronUpIcon className="h-4 w-4 ml-1" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 ml-1" />
        )}
      </button>

      {/* Comparison Details */}
      {showComparison && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-3">Method Comparison</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Traditional Monte Carlo</h5>
              <ul className="text-blue-700 space-y-1">
                <li>• Bootstrap resamples historical data blocks</li>
                <li>• Preserves historical correlations</li>
                <li>• Can concentrate market crises</li>
                <li>• May show negative bias in projections</li>
                <li>• Faster execution (~2-5 seconds)</li>
              </ul>
            </div>
            
            <div>
              <h5 className="font-medium text-green-800 mb-2">Hybrid Econometric</h5>
              <ul className="text-green-700 space-y-1">
                <li>• VAR models capture mean dynamics</li>
                <li>• GARCH models volatility clustering</li>
                <li>• Bootstrap preserves dependence structure</li>
                <li>• Eliminates crisis concentration bias</li>
                <li>• Includes statistical validation</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-green-100 border border-green-200 rounded-md">
            <p className="text-xs text-green-800">
              <strong>Why Hybrid is Recommended:</strong> Our analysis found that traditional bootstrap methods 
              can concentrate market crises, leading to unrealistically negative projections. The hybrid approach 
              eliminates this bias while maintaining statistical rigor.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}