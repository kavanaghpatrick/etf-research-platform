// Performance alerting and regression detection

interface PerformanceThreshold {
  metric: string
  threshold: number
  unit: 'ms' | 'bytes' | 'score' | 'percentage'
  severity: 'warning' | 'critical'
}

interface PerformanceAlert {
  id: string
  timestamp: number
  metric: string
  value: number
  threshold: number
  severity: 'warning' | 'critical'
  message: string
  page?: string
  component?: string
}

class PerformanceAlerting {
  private thresholds: PerformanceThreshold[] = [
    // Core Web Vitals
    { metric: 'LCP', threshold: 2500, unit: 'ms', severity: 'warning' },
    { metric: 'LCP', threshold: 4000, unit: 'ms', severity: 'critical' },
    { metric: 'FID', threshold: 100, unit: 'ms', severity: 'warning' },
    { metric: 'FID', threshold: 300, unit: 'ms', severity: 'critical' },
    { metric: 'CLS', threshold: 0.1, unit: 'score', severity: 'warning' },
    { metric: 'CLS', threshold: 0.25, unit: 'score', severity: 'critical' },
    { metric: 'FCP', threshold: 1800, unit: 'ms', severity: 'warning' },
    { metric: 'FCP', threshold: 3000, unit: 'ms', severity: 'critical' },
    { metric: 'TTFB', threshold: 800, unit: 'ms', severity: 'warning' },
    { metric: 'TTFB', threshold: 1800, unit: 'ms', severity: 'critical' },
    
    // Resource metrics
    { metric: 'bundle-size', threshold: 500000, unit: 'bytes', severity: 'warning' },
    { metric: 'bundle-size', threshold: 1000000, unit: 'bytes', severity: 'critical' },
    { metric: 'memory-usage', threshold: 50 * 1024 * 1024, unit: 'bytes', severity: 'warning' },
    { metric: 'memory-usage', threshold: 100 * 1024 * 1024, unit: 'bytes', severity: 'critical' },
    
    // Performance metrics
    { metric: 'render-time', threshold: 50, unit: 'ms', severity: 'warning' },
    { metric: 'render-time', threshold: 100, unit: 'ms', severity: 'critical' },
    { metric: 'api-response', threshold: 1000, unit: 'ms', severity: 'warning' },
    { metric: 'api-response', threshold: 3000, unit: 'ms', severity: 'critical' },
  ]

  private alerts: PerformanceAlert[] = []
  private alertHandlers: ((alert: PerformanceAlert) => void)[] = []
  private historicalData: Map<string, number[]> = new Map()

  checkMetric(metric: string, value: number, page?: string, component?: string) {
    // Store historical data
    this.storeHistoricalData(metric, value)

    // Check against thresholds
    const relevantThresholds = this.thresholds
      .filter(t => t.metric === metric)
      .sort((a, b) => b.threshold - a.threshold) // Check critical first

    for (const threshold of relevantThresholds) {
      if (this.shouldAlert(metric, value, threshold)) {
        const alert = this.createAlert(metric, value, threshold, page, component)
        this.triggerAlert(alert)
        break // Only trigger highest severity alert
      }
    }

    // Check for regression
    this.checkForRegression(metric, value, page, component)
  }

  private shouldAlert(metric: string, value: number, threshold: PerformanceThreshold): boolean {
    switch (threshold.unit) {
      case 'ms':
      case 'bytes':
        return value > threshold.threshold
      case 'score':
      case 'percentage':
        return metric === 'CLS' ? value > threshold.threshold : value < threshold.threshold
      default:
        return false
    }
  }

  private createAlert(
    metric: string,
    value: number,
    threshold: PerformanceThreshold,
    page?: string,
    component?: string
  ): PerformanceAlert {
    const id = `${metric}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const message = this.generateAlertMessage(metric, value, threshold)

    return {
      id,
      timestamp: Date.now(),
      metric,
      value,
      threshold: threshold.threshold,
      severity: threshold.severity,
      message,
      page,
      component
    }
  }

  private generateAlertMessage(metric: string, value: number, threshold: PerformanceThreshold): string {
    const formatted = this.formatValue(value, threshold.unit)
    const thresholdFormatted = this.formatValue(threshold.threshold, threshold.unit)

    const metricNames: Record<string, string> = {
      'LCP': 'Largest Contentful Paint',
      'FID': 'First Input Delay',
      'CLS': 'Cumulative Layout Shift',
      'FCP': 'First Contentful Paint',
      'TTFB': 'Time to First Byte',
      'bundle-size': 'Bundle Size',
      'memory-usage': 'Memory Usage',
      'render-time': 'Render Time',
      'api-response': 'API Response Time'
    }

    const metricName = metricNames[metric] || metric
    const severityText = threshold.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING'

    return `${severityText}: ${metricName} (${formatted}) exceeds ${threshold.severity} threshold (${thresholdFormatted})`
  }

  private formatValue(value: number, unit: string): string {
    switch (unit) {
      case 'ms':
        return `${Math.round(value)}ms`
      case 'bytes':
        if (value < 1024) return `${value}B`
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
        return `${(value / 1024 / 1024).toFixed(1)}MB`
      case 'score':
        return value.toFixed(3)
      case 'percentage':
        return `${value.toFixed(1)}%`
      default:
        return String(value)
    }
  }

  private storeHistoricalData(metric: string, value: number) {
    if (!this.historicalData.has(metric)) {
      this.historicalData.set(metric, [])
    }

    const history = this.historicalData.get(metric)!
    history.push(value)

    // Keep only last 100 values
    if (history.length > 100) {
      history.shift()
    }
  }

  private checkForRegression(metric: string, value: number, page?: string, component?: string) {
    const history = this.historicalData.get(metric)
    if (!history || history.length < 10) return // Need enough data

    // Calculate moving average
    const recentValues = history.slice(-10)
    const avgRecent = recentValues.reduce((a, b) => a + b, 0) / recentValues.length

    const olderValues = history.slice(-20, -10)
    if (olderValues.length === 0) return

    const avgOlder = olderValues.reduce((a, b) => a + b, 0) / olderValues.length

    // Check for significant regression (>20% worse)
    const regressionThreshold = 0.2
    const isRegression = metric === 'CLS' 
      ? value > avgOlder * (1 + regressionThreshold)
      : value > avgOlder * (1 + regressionThreshold)

    if (isRegression) {
      const percentChange = ((value - avgOlder) / avgOlder * 100).toFixed(1)
      const alert: PerformanceAlert = {
        id: `regression-${metric}-${Date.now()}`,
        timestamp: Date.now(),
        metric,
        value,
        threshold: avgOlder,
        severity: 'warning',
        message: `Performance regression detected: ${metric} degraded by ${percentChange}% from baseline`,
        page,
        component
      }
      this.triggerAlert(alert)
    }
  }

  private triggerAlert(alert: PerformanceAlert) {
    this.alerts.push(alert)

    // Notify all handlers
    this.alertHandlers.forEach(handler => {
      try {
        handler(alert)
      } catch (error) {
        console.error('Error in alert handler:', error)
      }
    })

    // Log to console
    console.warn('Performance Alert:', alert.message, {
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      page: alert.page,
      component: alert.component
    })

    // Send to monitoring service (if configured)
    this.sendToMonitoringService(alert)
  }

  private sendToMonitoringService(alert: PerformanceAlert) {
    // This would send to your monitoring service (e.g., Sentry, DataDog, etc.)
    if (typeof window !== 'undefined' && window.fetch) {
      // Example implementation
      const endpoint = process.env.NEXT_PUBLIC_MONITORING_ENDPOINT
      if (endpoint) {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'performance-alert',
            alert,
            timestamp: alert.timestamp,
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        }).catch(error => {
          console.error('Failed to send alert to monitoring service:', error)
        })
      }
    }
  }

  onAlert(handler: (alert: PerformanceAlert) => void) {
    this.alertHandlers.push(handler)
    
    // Return unsubscribe function
    return () => {
      const index = this.alertHandlers.indexOf(handler)
      if (index > -1) {
        this.alertHandlers.splice(index, 1)
      }
    }
  }

  getAlerts(severity?: 'warning' | 'critical'): PerformanceAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity)
    }
    return [...this.alerts]
  }

  clearAlerts() {
    this.alerts = []
  }

  getMetricHistory(metric: string): number[] {
    return [...(this.historicalData.get(metric) || [])]
  }

  getMetricStats(metric: string) {
    const history = this.historicalData.get(metric)
    if (!history || history.length === 0) return null

    const sorted = [...history].sort((a, b) => a - b)
    const sum = history.reduce((a, b) => a + b, 0)

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / history.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      count: history.length,
      trend: this.calculateTrend(history)
    }
  }

  private calculateTrend(values: number[]): 'improving' | 'stable' | 'degrading' {
    if (values.length < 5) return 'stable'

    const recent = values.slice(-5)
    const older = values.slice(-10, -5)

    if (older.length === 0) return 'stable'

    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length
    const avgOlder = older.reduce((a, b) => a + b, 0) / older.length

    const changePercent = Math.abs((avgRecent - avgOlder) / avgOlder) * 100

    if (changePercent < 5) return 'stable'
    return avgRecent < avgOlder ? 'improving' : 'degrading'
  }

  // Custom threshold configuration
  setThreshold(metric: string, threshold: number, unit: PerformanceThreshold['unit'], severity: PerformanceThreshold['severity']) {
    // Remove existing threshold
    this.thresholds = this.thresholds.filter(t => !(t.metric === metric && t.severity === severity))
    
    // Add new threshold
    this.thresholds.push({ metric, threshold, unit, severity })
  }

  // Export configuration
  exportConfiguration() {
    return {
      thresholds: [...this.thresholds],
      historicalDataSummary: Array.from(this.historicalData.entries()).map(([metric, values]) => ({
        metric,
        stats: this.getMetricStats(metric)
      }))
    }
  }
}

// Global instance
export const performanceAlerting = new PerformanceAlerting()

// React hook
export function usePerformanceAlerts() {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])

  useEffect(() => {
    const unsubscribe = performanceAlerting.onAlert((alert) => {
      setAlerts(prev => [...prev, alert])
    })

    return unsubscribe
  }, [])

  return {
    alerts,
    clearAlerts: () => {
      performanceAlerting.clearAlerts()
      setAlerts([])
    },
    getMetricStats: (metric: string) => performanceAlerting.getMetricStats(metric)
  }
}