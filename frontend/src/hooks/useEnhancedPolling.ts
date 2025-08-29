/**
 * Enhanced polling hook with exponential backoff and comprehensive timeout handling
 * Based on Grok-4 recommendations for production-ready polling
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface PollingConfig {
  initialInterval: number;
  maxInterval: number;
  backoffFactor: number;
  maxTotalTime: number;
  timeoutPerRequest: number;
  maxRetries: number;
}

interface PollingState<T> {
  data: T | null;
  error: string | null;
  isPolling: boolean;
  retryCount: number;
  totalElapsedTime: number;
  currentInterval: number;
}

interface PollingResult<T> extends PollingState<T> {
  startPolling: () => void;
  stopPolling: () => void;
  resetPolling: () => void;
}

const DEFAULT_CONFIG: PollingConfig = {
  initialInterval: 2000,   // Start with 2 seconds
  maxInterval: 30000,      // Max 30 seconds between polls
  backoffFactor: 1.5,      // Exponential backoff
  maxTotalTime: 600000,    // 10 minutes total
  timeoutPerRequest: 60000, // 60 seconds per request
  maxRetries: 10
};

export function useEnhancedPolling<T>(
  pollFunction: () => Promise<T>,
  isComplete: (data: T) => boolean,
  config: Partial<PollingConfig> = {}
): PollingResult<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  const [state, setState] = useState<PollingState<T>>({
    data: null,
    error: null,
    isPolling: false,
    retryCount: 0,
    totalElapsedTime: 0,
    currentInterval: finalConfig.initialInterval
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastPollTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setState(prev => ({ ...prev, isPolling: false }));
  }, []);

  const resetPolling = useCallback(() => {
    stopPolling();
    setState({
      data: null,
      error: null,
      isPolling: false,
      retryCount: 0,
      totalElapsedTime: 0,
      currentInterval: finalConfig.initialInterval
    });
    startTimeRef.current = 0;
    lastPollTimeRef.current = 0;
  }, [stopPolling, finalConfig.initialInterval]);

  const performPoll = useCallback(async (): Promise<void> => {
    const now = Date.now();
    const elapsedTime = now - startTimeRef.current;
    
    // Check if we've exceeded the maximum total time
    if (elapsedTime > finalConfig.maxTotalTime) {
      setState(prev => ({
        ...prev,
        error: `Polling timeout: exceeded maximum time of ${finalConfig.maxTotalTime / 1000}s`,
        isPolling: false
      }));
      stopPolling();
      return;
    }

    // Check if we've exceeded maximum retries
    if (state.retryCount >= finalConfig.maxRetries) {
      setState(prev => ({
        ...prev,
        error: `Polling failed: exceeded maximum retries (${finalConfig.maxRetries})`,
        isPolling: false
      }));
      stopPolling();
      return;
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, finalConfig.timeoutPerRequest);

    try {
      setState(prev => ({
        ...prev,
        totalElapsedTime: elapsedTime,
        error: null // Clear previous errors on retry
      }));

      const data = await pollFunction();
      
      clearTimeout(timeoutId);
      
      setState(prev => ({
        ...prev,
        data,
        error: null,
        totalElapsedTime: elapsedTime,
        retryCount: 0, // Reset retry count on success
        currentInterval: finalConfig.initialInterval // Reset interval on success
      }));

      // Check if polling is complete
      if (isComplete(data)) {
        stopPolling();
        return;
      }

      // Continue polling with current interval
      lastPollTimeRef.current = now;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('aborted');
      
      console.warn(`Polling attempt ${state.retryCount + 1} failed:`, errorMessage);
      
      setState(prev => {
        const newRetryCount = prev.retryCount + 1;
        const newInterval = Math.min(
          prev.currentInterval * finalConfig.backoffFactor,
          finalConfig.maxInterval
        );
        
        return {
          ...prev,
          error: errorMessage,
          retryCount: newRetryCount,
          currentInterval: newInterval,
          totalElapsedTime: elapsedTime
        };
      });

      // If this was a timeout and we haven't exceeded max retries, continue with backoff
      if (isTimeout && state.retryCount < finalConfig.maxRetries - 1) {
        // The interval will be updated by the effect based on the new currentInterval
        return;
      }
      
      // If it's not a timeout error or we've exceeded retries, stop polling
      if (!isTimeout || state.retryCount >= finalConfig.maxRetries - 1) {
        stopPolling();
      }
    }
  }, [
    pollFunction,
    isComplete,
    stopPolling,
    finalConfig,
    state.retryCount
  ]);

  const startPolling = useCallback(() => {
    if (state.isPolling) return;
    
    startTimeRef.current = Date.now();
    lastPollTimeRef.current = Date.now();
    
    setState(prev => ({
      ...prev,
      isPolling: true,
      error: null
    }));

    // Immediate first poll
    performPoll();
  }, [state.isPolling, performPoll]);

  // Effect to handle interval-based polling
  useEffect(() => {
    if (!state.isPolling) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set up new interval with current backoff
    intervalRef.current = setInterval(performPoll, state.currentInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isPolling, state.currentInterval, performPoll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    ...state,
    startPolling,
    stopPolling,
    resetPolling
  };
}

export default useEnhancedPolling;