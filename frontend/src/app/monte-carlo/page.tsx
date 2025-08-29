'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ChartBarIcon, PlayIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import PortfolioAllocation from '../../components/PortfolioAllocation';
import SimulationParameters from '../../components/SimulationParameters';
import SimulationResults from '../../components/SimulationResults';
import SimulationMethodSelector, { SimulationMethod } from '../../components/SimulationMethodSelector';
import AdvancedSettingsPanel, { AdvancedSimulationConfig, defaultAdvancedConfig } from '../../components/AdvancedSettingsPanel';
import { monteCarloApi, MonteCarloResponse } from '../../services/monteCarloApi';
import { hybridSimulationApi, HybridSimulationResults, convertToHybridRequest, convertHybridResultsToTraditional } from '../../services/hybridSimulationApi';
import useEnhancedPolling from '../../hooks/useEnhancedPolling';

// Lazy load non-critical components
const HelpDocumentation = dynamic(() => import('../../components/HelpDocumentation'), {
  ssr: false,
  loading: () => null
});

const PerformanceMonitor = dynamic(() => import('../../components/PerformanceMonitor'), {
  ssr: false,
  loading: () => null
});

const UserFeedbackSystem = dynamic(() => import('../../components/UserFeedbackSystem'), {
  ssr: false,
  loading: () => null
});

interface PortfolioItem {
  id: string;
  ticker: string;
  percentage: number;
}

interface SimulationConfig {
  timePeriodYears: number;
  initialBalance: number;
  numSimulations: number;
  historicalStartDate: string;
}

export default function MonteCarloPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([
    { id: '1', ticker: 'SPY', percentage: 60 },
    { id: '2', ticker: 'BND', percentage: 40 }
  ]);
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig | null>(null);
  const [simulationResults, setSimulationResults] = useState<MonteCarloResponse | null>(null);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationPhase, setSimulationPhase] = useState<string>('');
  const [simulationStartTime, setSimulationStartTime] = useState<number | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // New state for hybrid simulation
  const [simulationMethod, setSimulationMethod] = useState<SimulationMethod>('hybrid');
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedSimulationConfig>(defaultAdvancedConfig);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [hybridResults, setHybridResults] = useState<HybridSimulationResults | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handlePortfolioChange = useCallback((newPortfolio: PortfolioItem[]) => {
    console.log('Portfolio changed:', newPortfolio);
    setPortfolio(newPortfolio);
  }, []);

  const handleConfigChange = useCallback((config: SimulationConfig) => {
    setSimulationConfig(config);
  }, []);

  const handleMethodChange = useCallback((method: SimulationMethod) => {
    setSimulationMethod(method);
  }, []);

  const handleAdvancedConfigChange = useCallback((config: AdvancedSimulationConfig) => {
    setAdvancedConfig(config);
  }, []);

  const isValidPortfolio = portfolio.length > 0 && 
    Math.abs(portfolio.reduce((sum, item) => sum + item.percentage, 0) - 100) < 0.01;
  
  console.log('Portfolio validation:', { 
    portfolio, 
    length: portfolio.length, 
    total: portfolio.reduce((sum, item) => sum + item.percentage, 0),
    isValidPortfolio 
  });

  // Poll for simulation progress
  useEffect(() => {
    if (isRunning) {
      progressIntervalRef.current = setInterval(async () => {
        try {
          if (simulationMethod === 'hybrid' && currentTaskId) {
            // Poll hybrid simulation status
            const taskStatus = await hybridSimulationApi.getTaskStatus(currentTaskId);
            
            if (taskStatus.status === 'completed') {
              setHybridResults(taskStatus);
              setSimulationResults(convertHybridResultsToTraditional(taskStatus));
              setIsRunning(false);
              setSimulationProgress(100);
              setSimulationPhase('Completed');
            } else if (taskStatus.status === 'failed') {
              setSimulationError(taskStatus.error || 'Hybrid simulation failed');
              setIsRunning(false);
            } else {
              // Update progress based on phase
              const phaseProgress = {
                'initializing': 10,
                'fetching_data': 30,
                'fitting_models': 60,
                'running_simulation': 85,
                'validating': 95
              };
              setSimulationProgress(phaseProgress[taskStatus.status as keyof typeof phaseProgress] || 50);
              setSimulationPhase(taskStatus.message || 'Processing...');
            }
          } else {
            // Poll traditional Monte Carlo progress
            const response = await fetch('http://localhost:8000/api/monte-carlo/progress');
            const progress = await response.json();
            
            if (progress.is_running) {
              setSimulationProgress(progress.percentage);
              setSimulationPhase(progress.phase || 'Running simulations...');
            }
          }
        } catch (error) {
          console.error('Failed to fetch progress:', error);
        }
      }, 1000); // Poll every second
    } else {
      // Clear interval when not running
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isRunning, simulationMethod, currentTaskId]);

  const runSimulation = async () => {
    if (!isValidPortfolio || !simulationConfig) return;
    
    setIsRunning(true);
    setSimulationError(null);
    setSimulationResults(null);
    setHybridResults(null);
    setCurrentTaskId(null);
    setSimulationProgress(0);
    setSimulationPhase('Preparing simulation...');
    setSimulationStartTime(Date.now());
    
    try {
      if (simulationMethod === 'hybrid') {
        // Run hybrid simulation
        const hybridRequest = convertToHybridRequest(
          portfolio.map(item => ({
            ticker: item.ticker,
            percentage: item.percentage
          })),
          simulationConfig,
          advancedConfig
        );
        
        const taskResponse = await hybridSimulationApi.startSimulation(hybridRequest);
        setCurrentTaskId(taskResponse.task_id);
        setSimulationPhase(taskResponse.message);
        
        // Progress polling will handle the rest
      } else {
        // Run traditional Monte Carlo simulation
        const response = await monteCarloApi.runSimulation({
          portfolio: portfolio.map(item => ({
            ticker: item.ticker,
            percentage: item.percentage
          })),
          time_period_years: simulationConfig.timePeriodYears,
          initial_balance: simulationConfig.initialBalance,
          num_simulations: simulationConfig.numSimulations,
          historical_start_date: `${simulationConfig.historicalStartDate}-01-01`
        });
        
        setSimulationResults(response);
        setIsRunning(false);
      }
    } catch (error) {
      console.error('Simulation failed:', error);
      setSimulationError(error instanceof Error ? error.message : 'Failed to run simulation');
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Performance and Feedback Systems */}
      <PerformanceMonitor
        trackPageViews={true}
        trackUserInteractions={true}
        onMetricsCollected={(metrics) => {
          console.log('Performance metrics:', metrics);
        }}
      />
      <UserFeedbackSystem
        onSubmitFeedback={(feedback) => {
          console.log('User feedback:', feedback);
        }}
      />
      
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <ChartBarIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Simulation Engine</h1>
            {simulationMethod === 'hybrid' && (
              <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full font-medium">
                Hybrid Econometric ✨
              </span>
            )}
          </div>
          <p className="text-lg text-gray-600 max-w-4xl">
            {simulationMethod === 'hybrid' 
              ? 'Analyze portfolio risk with bias-free econometric modeling using VAR+GARCH+Bootstrap methodology.'
              : 'Analyze portfolio risk with thousands of market scenarios using bootstrap resampling methodology.'
            }
          </p>
          <div className="mt-4 flex items-center space-x-4">
            <button
              className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                isValidPortfolio && !isRunning
                  ? simulationMethod === 'hybrid' 
                    ? 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              onClick={runSimulation}
              disabled={!isValidPortfolio || isRunning}
            >
              <PlayIcon className="h-4 w-4 mr-2" />
              {simulationMethod === 'hybrid' ? 'Run Hybrid Simulation' : 'Run Monte Carlo Simulation'}
            </button>
            
            <button
              onClick={() => setShowHelp(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <QuestionMarkCircleIcon className="h-4 w-4 mr-2" />
              Help
            </button>
            
            {isRunning && currentTaskId && (
              <button
                onClick={async () => {
                  try {
                    await hybridSimulationApi.cancelTask(currentTaskId);
                    setIsRunning(false);
                    setSimulationPhase('Cancelled');
                  } catch (error) {
                    console.error('Failed to cancel task:', error);
                  }
                }}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar - Configuration Panel */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow-lg border border-gray-200">
              {/* Simulation Method Selector */}
              <SimulationMethodSelector
                selectedMethod={simulationMethod}
                onMethodChange={handleMethodChange}
              />
              
              {/* Portfolio Allocation Component */}
              <PortfolioAllocation onPortfolioChange={handlePortfolioChange} />
              
              {/* Simulation Parameters Component */}
              <SimulationParameters onConfigChange={handleConfigChange} />

              {/* Advanced Settings Panel (only for hybrid) */}
              <AdvancedSettingsPanel
                config={advancedConfig}
                onConfigChange={handleAdvancedConfigChange}
                visible={simulationMethod === 'hybrid'}
              />

              {/* Run Simulation Button */}
              <div className="p-6 pt-0">
                <button
                  className={`w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white ${
                    isValidPortfolio && !isRunning
                      ? simulationMethod === 'hybrid' 
                        ? 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                        : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                  disabled={!isValidPortfolio || isRunning}
                  onClick={runSimulation}
                >
                  {isRunning ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {simulationMethod === 'hybrid' ? 'Running Hybrid Simulation...' : 'Running Simulation...'}
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-5 w-5 mr-2" />
                      {simulationMethod === 'hybrid' ? 'Run Hybrid Simulation 🚀' : 'Run Monte Carlo 🚀'}
                    </>
                  )}
                </button>
                
                {!isValidPortfolio && (
                  <p className="mt-2 text-sm text-red-600 text-center">
                    Portfolio allocation must total 100% to run simulation
                  </p>
                )}
                
                {/* Enhanced Status Information */}
                {isRunning && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium">{simulationPhase}</div>
                      <div className="flex items-center mt-1">
                        <div className="flex-1 bg-blue-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${simulationProgress}%` }}
                          ></div>
                        </div>
                        <span className="ml-2 text-xs">{simulationProgress}%</span>
                      </div>
                      {simulationMethod === 'hybrid' && currentTaskId && (
                        <div className="mt-2 text-xs text-blue-600">
                          Task ID: {currentTaskId.substring(0, 8)}...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Content - Results Area */}
          <div className="lg:col-span-8">
            <SimulationResults 
              results={simulationResults}
              loading={isRunning}
              error={simulationError}
              progress={simulationProgress}
              phase={simulationPhase}
              hybridResults={hybridResults}
              simulationMethod={simulationMethod}
            />
          </div>
        </div>
      </div>
      
      {/* Help Documentation */}
      <HelpDocumentation
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}