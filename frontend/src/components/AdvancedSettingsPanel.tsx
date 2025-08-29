'use client';

import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

export interface AdvancedSimulationConfig {
  // VAR Model Settings
  varMaxLags: number;
  varSelectionCriterion: 'aic' | 'bic';
  
  // GARCH Model Settings  
  garchDistribution: 'normal' | 't' | 'skewt';
  garchFallbackMethod: 'ewma' | 'constant';
  
  // Bootstrap Settings
  bootstrapBlockLength: number | null;
  preserveMean: boolean;
  
  // Processing Settings
  useParallel: boolean;
  maxWorkers: number | null;
  randomSeed: number | null;
  
  // GPU Acceleration Settings
  useGpu: boolean;
  gpuMemoryFraction: number;
  
  // Validation Settings
  enableValidation: boolean;
  runBenchmarks: boolean;
}

interface AdvancedSettingsPanelProps {
  config: AdvancedSimulationConfig;
  onConfigChange: (config: AdvancedSimulationConfig) => void;
  visible: boolean;
}

export const defaultAdvancedConfig: AdvancedSimulationConfig = {
  varMaxLags: 5,
  varSelectionCriterion: 'aic',
  garchDistribution: 'normal',
  garchFallbackMethod: 'ewma',
  bootstrapBlockLength: null,
  preserveMean: true,
  useParallel: true,
  maxWorkers: null,
  randomSeed: null,
  useGpu: true,  // Enable M4 GPU acceleration by default
  gpuMemoryFraction: 0.8,
  enableValidation: false,  // Disabled by default for faster simulations
  runBenchmarks: false
};

export default function AdvancedSettingsPanel({
  config,
  onConfigChange,
  visible
}: AdvancedSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!visible) return null;

  const updateConfig = (field: keyof AdvancedSimulationConfig, value: any) => {
    onConfigChange({ ...config, [field]: value });
  };

  const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
    <div className="relative group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        {text}
      </div>
    </div>
  );

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center">
          <div className="h-5 w-5 bg-purple-100 rounded-full flex items-center justify-center mr-2">
            <div className="h-2 w-2 bg-purple-600 rounded-full"></div>
          </div>
          <span className="text-sm font-medium text-gray-700">
            Advanced Settings
          </span>
          <span className="ml-2 text-xs text-gray-500">
            (Optional - Smart defaults applied)
          </span>
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-6 bg-gray-50">
          {/* Model Configuration Section */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center">
              <div className="h-4 w-4 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                <div className="h-1.5 w-1.5 bg-blue-600 rounded-full"></div>
              </div>
              Econometric Model Configuration
            </h4>
            
            <div className="space-y-4">
              {/* VAR Max Lags */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    VAR Max Lags: <span className="font-bold">{config.varMaxLags}</span>
                  </label>
                  <Tooltip text="Maximum number of lags for VAR model selection. Higher values capture more complex dynamics but may overfit.">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={config.varMaxLags}
                  onChange={(e) => updateConfig('varMaxLags', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1 (simple)</span>
                  <span>20 (complex)</span>
                </div>
              </div>

              {/* VAR Selection Criterion */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    VAR Selection Criterion
                  </label>
                  <Tooltip text="Information criterion for lag selection. AIC tends to select more lags, BIC is more conservative.">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
                <select
                  value={config.varSelectionCriterion}
                  onChange={(e) => updateConfig('varSelectionCriterion', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="aic">AIC (Akaike Information Criterion)</option>
                  <option value="bic">BIC (Bayesian Information Criterion)</option>
                </select>
              </div>

              {/* GARCH Distribution */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    GARCH Error Distribution
                  </label>
                  <Tooltip text="Distribution assumption for GARCH errors. Student-t handles fat tails, Skewed-t handles asymmetry.">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
                <select
                  value={config.garchDistribution}
                  onChange={(e) => updateConfig('garchDistribution', e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="normal">Normal (recommended for most cases)</option>
                  <option value="t">Student-t (for fat tails)</option>
                  <option value="skewt">Skewed-t (for asymmetric returns)</option>
                </select>
              </div>

              {/* Bootstrap Block Length */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    Bootstrap Block Length
                  </label>
                  <Tooltip text="Block length for bootstrap resampling. Auto uses optimal selection based on autocorrelation.">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
                <select
                  value={config.bootstrapBlockLength || 'auto'}
                  onChange={(e) => updateConfig('bootstrapBlockLength', e.target.value === 'auto' ? null : parseInt(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto (Politis-Romano optimal)</option>
                  <option value="5">5 days</option>
                  <option value="10">10 days</option>
                  <option value="20">20 days</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Processing Settings Section */}
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center">
              <div className="h-4 w-4 bg-green-100 rounded-full flex items-center justify-center mr-2">
                <div className="h-1.5 w-1.5 bg-green-600 rounded-full"></div>
              </div>
              Processing & Validation Settings
            </h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.useParallel}
                    onChange={(e) => updateConfig('useParallel', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable parallel processing</span>
                </label>
                <Tooltip text="Use multiple CPU cores for faster simulation. Recommended for large simulations.">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.useGpu}
                    onChange={(e) => updateConfig('useGpu', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">🚀 M4 GPU acceleration</span>
                </label>
                <Tooltip text="Use Apple M4 GPU with MLX for ultra-fast matrix operations. 5-10x speedup on compatible hardware.">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>

              {config.useGpu && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">
                      GPU Memory Usage: <span className="font-bold">{(config.gpuMemoryFraction * 100).toFixed(0)}%</span>
                    </label>
                    <Tooltip text="Percentage of GPU memory to use. Lower values leave more memory for other apps.">
                      <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                    </Tooltip>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="0.95"
                    step="0.05"
                    value={config.gpuMemoryFraction}
                    onChange={(e) => updateConfig('gpuMemoryFraction', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>30% (Conservative)</span>
                    <span>95% (Aggressive)</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.enableValidation}
                    onChange={(e) => updateConfig('enableValidation', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Statistical validation</span>
                </label>
                <Tooltip text="Run distribution tests and bias analysis. Highly recommended for quality assurance.">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.runBenchmarks}
                    onChange={(e) => updateConfig('runBenchmarks', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Performance benchmarking</span>
                </label>
                <Tooltip text="Run performance tests and MVP compliance checks. Adds execution time.">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.preserveMean}
                    onChange={(e) => updateConfig('preserveMean', e.target.checked)}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Preserve historical mean</span>
                </label>
                <Tooltip text="Adjust bootstrap samples to maintain historical mean. Recommended for unbiased results.">
                  <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                </Tooltip>
              </div>

              {/* Random Seed */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">
                    Random Seed (for reproducibility)
                  </label>
                  <Tooltip text="Set a fixed seed for reproducible results. Leave empty for random execution.">
                    <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
                  </Tooltip>
                </div>
                <input
                  type="number"
                  value={config.randomSeed || ''}
                  onChange={(e) => updateConfig('randomSeed', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Leave empty for random"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Configuration Summary */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-900 mb-2">Configuration Summary</h4>
            <div className="text-xs text-purple-800 space-y-1">
              <div>• VAR model with up to {config.varMaxLags} lags ({config.varSelectionCriterion.toUpperCase()} selection)</div>
              <div>• GARCH volatility with {config.garchDistribution} distribution</div>
              <div>• Bootstrap block length: {config.bootstrapBlockLength || 'Auto-optimal'}</div>
              <div>• Parallel processing: {config.useParallel ? 'Enabled' : 'Disabled'}</div>
              <div>• M4 GPU acceleration: {config.useGpu ? `Enabled (${(config.gpuMemoryFraction * 100).toFixed(0)}% memory)` : 'Disabled'}</div>
              <div>• Statistical validation: {config.enableValidation ? 'Enabled' : 'Disabled'}</div>
              {config.randomSeed && <div>• Random seed: {config.randomSeed} (reproducible)</div>}
            </div>
          </div>
        </div>
      )}

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