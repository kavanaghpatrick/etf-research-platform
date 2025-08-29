'use client'

import React, { useEffect, useState } from 'react'
import { performanceMonitor } from '@/utils/performance'
import { getRUM } from '@/utils/realUserMonitoring'

interface WebVitalData {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  threshold: { good: number; poor: number }
}

interface PerformanceMetricData {
  name: string
  value: number
  unit: string
  component?: string
}

export function PerformanceDashboard() {
  const [webVitals, setWebVitals] = useState<WebVitalData[]>([])
  const [metrics, setMetrics] = useState<PerformanceMetricData[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(updateMetrics, 5000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const updateMetrics = () => {
    // Get Web Vitals
    const vitals = performanceMonitor.getWebVitals()
    const vitalsData: WebVitalData[] = vitals.map(vital => ({
      name: vital.name,
      value: vital.value,
      rating: vital.rating,
      threshold: getThreshold(vital.name)
    }))
    setWebVitals(vitalsData)

    // Get other metrics
    const allMetrics = performanceMonitor.getMetrics()
    const recentMetrics = allMetrics.slice(-20) // Last 20 metrics
    setMetrics(recentMetrics)
  }

  const getThreshold = (name: string) => {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 }
    }
    return thresholds[name as keyof typeof thresholds] || { good: 0, poor: 0 }
  }

  const formatValue = (value: number, name: string) => {
    if (name === 'CLS') {
      return value.toFixed(3)
    }
    return `${Math.round(value)}ms`
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'text-green-600 bg-green-100'
      case 'needs-improvement':
        return 'text-yellow-600 bg-yellow-100'
      case 'poor':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getMetricColor = (value: number, unit: string) => {
    if (unit === 'ms') {
      if (value < 100) return 'text-green-600'
      if (value < 300) return 'text-yellow-600'
      return 'text-red-600'
    }
    if (unit === 'bytes') {
      if (value < 100000) return 'text-green-600'
      if (value < 500000) return 'text-yellow-600'
      return 'text-red-600'
    }
    return 'text-gray-600'
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  const generateReport = () => {
    const report = performanceMonitor.getPerformanceReport()
    const rum = getRUM()
    
    console.log('Performance Report:', report)
    
    // Download as JSON
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-report-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => {
          setIsVisible(true)
          updateMetrics()
        }}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors z-50"
        aria-label="Show performance dashboard"
      >
        📊 Performance
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
      <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
        <h3 className="font-semibold">Performance Dashboard</h3>
        <div className="flex items-center gap-2">
          <label className="text-sm flex items-center gap-1">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => setIsVisible(false)}
            className="text-white hover:text-gray-300"
            aria-label="Close dashboard"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[calc(80vh-4rem)]">
        {/* Web Vitals Section */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="font-semibold mb-3 flex items-center justify-between">
            Core Web Vitals
            <button
              onClick={updateMetrics}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Refresh
            </button>
          </h4>
          <div className="space-y-2">
            {webVitals.map((vital) => (
              <div key={vital.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{vital.name}</span>
                  <span className={`text-xs px-2 py-1 rounded ${getRatingColor(vital.rating)}`}>
                    {vital.rating}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-mono">{formatValue(vital.value, vital.name)}</div>
                  <div className="text-xs text-gray-500">
                    Good: {formatValue(vital.threshold.good, vital.name)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Metrics Section */}
        <div className="p-4 border-b border-gray-200">
          <h4 className="font-semibold mb-3">Recent Metrics</h4>
          <div className="space-y-1 text-sm">
            {metrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{metric.name}</span>
                  {metric.component && (
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                      {metric.component}
                    </span>
                  )}
                </div>
                <span className={`font-mono ${getMetricColor(metric.value, metric.unit)}`}>
                  {metric.unit === 'bytes' ? formatBytes(metric.value) : `${Math.round(metric.value)}${metric.unit}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-4 space-y-2">
          <button
            onClick={generateReport}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
          >
            Download Full Report
          </button>
          <div className="text-xs text-gray-500 text-center">
            Performance monitoring is active
          </div>
        </div>
      </div>
    </div>
  )
}