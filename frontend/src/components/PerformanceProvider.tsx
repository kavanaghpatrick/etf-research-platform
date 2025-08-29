'use client'

import { useEffect, ReactNode } from 'react'
import { performanceMonitor, monitorBundleSize, detectMemoryLeaks } from '@/utils/performance'
import { initializeRUM } from '@/utils/realUserMonitoring'
import { useServiceWorker } from '@/utils/serviceWorker'

interface PerformanceProviderProps {
  children: ReactNode
}

export function PerformanceProvider({ children }: PerformanceProviderProps) {
  const { register: registerServiceWorker, updateAvailable } = useServiceWorker()

  useEffect(() => {
    // Initialize performance monitoring
    monitorBundleSize()
    detectMemoryLeaks()

    // Initialize Real User Monitoring
    const rum = initializeRUM({
      sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1, // 10% in production, 100% in dev
      debug: process.env.NODE_ENV === 'development',
      enableWebVitals: true,
      enableResourceTiming: true,
      enableUserInteractions: true,
      enableErrors: true
    })

    // Register service worker for caching
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker()
    }

    // Log initial performance metrics
    setTimeout(() => {
      const report = performanceMonitor.getPerformanceReport()
      console.log('Initial Performance Report:', report)
    }, 5000)

    // Cleanup on unmount
    return () => {
      performanceMonitor.cleanup()
      rum.cleanup()
    }
  }, [registerServiceWorker])

  // Show update notification if available
  useEffect(() => {
    if (updateAvailable) {
      console.log('App update available')
      // You could show a notification UI here
    }
  }, [updateAvailable])

  return <>{children}</>
}