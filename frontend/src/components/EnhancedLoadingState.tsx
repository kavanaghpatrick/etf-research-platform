'use client';

import React, { useMemo, useEffect, useRef } from 'react';
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon, ClockIcon } from '@heroicons/react/24/outline';

interface LoadingPhase {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration?: number;
}

interface EnhancedLoadingStateProps {
  isLoading: boolean;
  progress: number;
  phase: string;
  simulationMethod: 'traditional' | 'hybrid';
  estimatedTimeRemaining?: number;
  onCancel?: () => void;
  taskId?: string;
}

const EnhancedLoadingState = React.memo(({
  isLoading,
  progress,
  phase,
  simulationMethod,
  estimatedTimeRemaining,
  onCancel,
  taskId
}: EnhancedLoadingStateProps) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Add timeout handling
  useEffect(() => {
    if (isLoading) {
      timeoutRef.current = setTimeout(() => {
        console.error('Loading timeout - consider showing error state');
      }, 120000); // 2 minute timeout
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isLoading]);

  if (!isLoading) return null;

  // Define phases for different simulation methods
  const getPhases = useMemo((): (() => LoadingPhase[]) => () => {
    if (simulationMethod === 'hybrid') {
      return [
        {
          id: 'initializing',
          title: 'Initializing',
          description: 'Setting up simulation parameters',
          status: progress > 10 ? 'completed' : phase.includes('initializing') ? 'in_progress' : 'pending'
        },
        {
          id: 'fetching_data',
          title: 'Fetching Data',
          description: 'Retrieving historical market data',
          status: progress > 30 ? 'completed' : phase.includes('fetching') ? 'in_progress' : 'pending'
        },
        {
          id: 'fitting_models',
          title: 'Fitting Models',
          description: 'Training VAR and GARCH models',
          status: progress > 60 ? 'completed' : phase.includes('fitting') ? 'in_progress' : 'pending'
        },
        {
          id: 'running_simulation',
          title: 'Running Simulation',
          description: 'Generating portfolio paths',
          status: progress > 85 ? 'completed' : phase.includes('simulation') ? 'in_progress' : 'pending'
        },
        {
          id: 'validating',
          title: 'Validating',
          description: 'Running statistical validation',
          status: progress > 95 ? 'completed' : phase.includes('validating') ? 'in_progress' : 'pending'
        }
      ];
    } else {
      return [
        {
          id: 'preparing',
          title: 'Preparing',
          description: 'Loading historical data',
          status: progress > 20 ? 'completed' : phase.includes('Preparing') ? 'in_progress' : 'pending'
        },
        {
          id: 'sampling',
          title: 'Bootstrap Sampling',
          description: 'Resampling historical data blocks',
          status: progress > 70 ? 'completed' : phase.includes('sampling') ? 'in_progress' : 'pending'
        },
        {
          id: 'simulating',
          title: 'Simulating',
          description: 'Running Monte Carlo paths',
          status: progress > 90 ? 'completed' : phase.includes('simulating') ? 'in_progress' : 'pending'
        }
      ];
    }
  }, [simulationMethod, progress, phase]);

  const phases = getPhases();

  const getStatusIcon = (status: LoadingPhase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-300" />;
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 min-h-[600px]">
      <div className="p-6">
        {/* Header */}
        <div className="text-center mb-6" role="status" aria-live="polite" aria-busy="true">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            Running {simulationMethod === 'hybrid' ? 'Hybrid Econometric' : 'Monte Carlo'} Simulation
          </h3>
          <p className="text-gray-500">
            {simulationMethod === 'hybrid' 
              ? 'Generating bias-free portfolio projections using advanced econometric models'
              : 'Analyzing thousands of market scenarios using bootstrap resampling'
            }
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm text-gray-500">{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                simulationMethod === 'hybrid' ? 'bg-green-600' : 'bg-blue-600'
              }`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          {estimatedTimeRemaining && (
            <div className="mt-2 text-sm text-gray-600 text-center">
              Estimated time remaining: {formatTime(estimatedTimeRemaining)}
            </div>
          )}
        </div>

        {/* Phase Progress */}
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium text-gray-700">Simulation Phases</h4>
          
          {phases.map((phaseItem, index) => (
            <div key={phaseItem.id} className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {getStatusIcon(phaseItem.status)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${
                    phaseItem.status === 'completed' ? 'text-green-700' :
                    phaseItem.status === 'in_progress' ? 'text-blue-700' :
                    phaseItem.status === 'failed' ? 'text-red-700' :
                    'text-gray-500'
                  }`}>
                    {phaseItem.title}
                  </span>
                  {phaseItem.status === 'in_progress' && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{phaseItem.description}</p>
              </div>
              {phaseItem.status === 'completed' && phaseItem.duration && (
                <div className="text-xs text-gray-400">
                  {formatTime(phaseItem.duration)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Current Phase Details */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <ArrowPathIcon className="h-4 w-4 text-blue-600 animate-spin" />
            <span className="text-sm font-medium text-blue-900">Current Phase</span>
          </div>
          <p className="text-sm text-blue-800">{phase}</p>
        </div>

        {/* Simulation Details */}
        {simulationMethod === 'hybrid' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h5 className="text-sm font-medium text-green-900 mb-2">Hybrid Econometric Features</h5>
            <ul className="text-xs text-green-800 space-y-1">
              <li>• VAR models capture mean reversion patterns</li>
              <li>• GARCH models volatility clustering effects</li>
              <li>• Bootstrap preserves dependency structure</li>
              <li>• Statistical validation ensures quality</li>
            </ul>
          </div>
        )}

        {/* Task Information */}
        {taskId && (
          <div className="text-center text-xs text-gray-500 mb-4">
            Task ID: <span className="font-mono">{taskId}</span>
          </div>
        )}

        {/* Cancel Button */}
        {onCancel && (
          <div className="text-center">
            <button
              onClick={onCancel}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel Simulation
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

EnhancedLoadingState.displayName = 'EnhancedLoadingState';

export default EnhancedLoadingState;