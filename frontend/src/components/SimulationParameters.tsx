'use client';

import { useState, useEffect } from 'react';
import { CogIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface SimulationConfig {
  timePeriodYears: number;
  initialBalance: number;
  numSimulations: number;
  historicalStartDate: string;
}

interface SimulationParametersProps {
  onConfigChange: (config: SimulationConfig) => void;
  initialConfig?: Partial<SimulationConfig>;
}

export default function SimulationParameters({ 
  onConfigChange,
  initialConfig = {}
}: SimulationParametersProps) {
  const [config, setConfig] = useState<SimulationConfig>({
    timePeriodYears: 10,     // Reduced from 30 to 10 years for faster processing
    initialBalance: 100000,  // Reduced from 1M to 100K
    numSimulations: 1000,    // Reduced from 5000 to 1000 for faster testing
    historicalStartDate: '2020',  // More recent data for faster processing
    ...initialConfig
  });

  const [balanceInput, setBalanceInput] = useState(formatCurrency(config.initialBalance));

  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  function parseCurrency(value: string): number {
    return parseInt(value.replace(/[^0-9]/g, '')) || 0;
  }

  const updateConfig = (field: keyof SimulationConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const updateBalance = (value: string) => {
    setBalanceInput(value);
    const numericValue = parseCurrency(value);
    updateConfig('initialBalance', numericValue);
  };

  const setPresetBalance = (amount: number) => {
    const formatted = formatCurrency(amount);
    setBalanceInput(formatted);
    updateConfig('initialBalance', amount);
  };

  const getEstimatedRuntime = (simulations: number): string => {
    // Rough estimate based on simulation count
    const baseTime = 2; // seconds for 1000 simulations
    const estimated = (simulations / 1000) * baseTime;
    
    if (estimated < 60) {
      return `~${Math.ceil(estimated)} seconds`;
    } else {
      return `~${Math.ceil(estimated / 60)} minutes`;
    }
  };

  const getDataAvailability = (startYear: string): string => {
    const year = parseInt(startYear);
    const currentYear = new Date().getFullYear();
    const yearsOfData = currentYear - year;
    
    return `${yearsOfData} years of historical data`;
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
        <CogIcon className="h-5 w-5 mr-2" />
        Simulation Parameters
      </h3>
      
      <div className="space-y-6">
        {/* Time Period */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Time Period: <span className="font-bold">{config.timePeriodYears} years</span>
            </label>
            <div className="group relative">
              <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Investment time horizon for simulation
              </div>
            </div>
          </div>
          <input
            type="range"
            min="5"
            max="50"
            value={config.timePeriodYears}
            onChange={(e) => updateConfig('timePeriodYears', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>5 years</span>
            <span>50 years</span>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {config.timePeriodYears <= 10 && '🏃 Short-term analysis'}
            {config.timePeriodYears > 10 && config.timePeriodYears <= 30 && '📈 Medium-term planning'}
            {config.timePeriodYears > 30 && '🎯 Long-term wealth building'}
          </div>
        </div>

        {/* Initial Balance */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Initial Balance
            </label>
            <div className="group relative">
              <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Starting portfolio value
              </div>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              type="text"
              value={balanceInput}
              onChange={(e) => updateBalance(e.target.value)}
              onBlur={() => setBalanceInput(formatCurrency(config.initialBalance))}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="1,000,000"
            />
          </div>
          <div className="flex space-x-2 mt-2">
            {[
              { label: '100K', value: 100000 },
              { label: '500K', value: 500000 },
              { label: '1M', value: 1000000 },
              { label: '5M', value: 5000000 }
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setPresetBalance(preset.value)}
                className={`px-3 py-1 text-xs border rounded transition-colors ${
                  config.initialBalance === preset.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                ${preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Number of Simulations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Simulations: <span className="font-bold">{config.numSimulations.toLocaleString()}</span>
            </label>
            <div className="group relative">
              <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                More simulations = higher accuracy but longer runtime
              </div>
            </div>
          </div>
          <input
            type="range"
            min="1000"
            max="10000"
            step="1000"
            value={config.numSimulations}
            onChange={(e) => updateConfig('numSimulations', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1,000</span>
            <span>10,000</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-gray-600">
              Estimated runtime: {getEstimatedRuntime(config.numSimulations)}
            </span>
            <span className={`px-2 py-1 rounded ${
              config.numSimulations <= 3000 ? 'bg-green-100 text-green-800' :
              config.numSimulations <= 7000 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {config.numSimulations <= 3000 ? 'Fast' :
               config.numSimulations <= 7000 ? 'Moderate' : 'Slow'}
            </span>
          </div>
        </div>

        {/* Historical Start Date */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Historical Start Date
            </label>
            <div className="group relative">
              <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Earlier dates include more market cycles but may have limited data
              </div>
            </div>
          </div>
          <select 
            value={config.historicalStartDate}
            onChange={(e) => updateConfig('historicalStartDate', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="1990">1990 (includes 1990s tech boom)</option>
            <option value="1995">1995 (includes dot-com bubble)</option>
            <option value="2000">2000 (includes 2008 crisis) - Recommended</option>
            <option value="2005">2005 (post dot-com era)</option>
            <option value="2010">2010 (post-2008 recovery)</option>
            <option value="2015">2015 (recent bull market)</option>
          </select>
          <div className="mt-2 text-xs text-gray-600">
            📊 {getDataAvailability(config.historicalStartDate)}
          </div>
        </div>

        {/* Configuration Summary */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Simulation Summary</h4>
          <div className="text-xs text-blue-800 space-y-1">
            <div>• {config.numSimulations.toLocaleString()} Monte Carlo paths over {config.timePeriodYears} years</div>
            <div>• Starting with ${formatCurrency(config.initialBalance)} initial balance</div>
            <div>• Using market data from {config.historicalStartDate} onwards</div>
            <div>• Bootstrap resampling with 1-year block size</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
      `}</style>
    </div>
  );
}