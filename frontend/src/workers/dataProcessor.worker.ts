// Web Worker for heavy data processing operations
// This handles chart data transformation, statistical calculations, and other CPU-intensive tasks

export interface WorkerMessage {
  id: string
  type: 'TRANSFORM_CHART_DATA' | 'CALCULATE_STATISTICS' | 'DOWNSAMPLE_DATA' | 'CALCULATE_TECHNICAL_INDICATORS'
  payload: any
}

export interface WorkerResponse {
  id: string
  type: 'SUCCESS' | 'ERROR'
  result?: any
  error?: string
}

// Chart data transformation
interface ChartDataTransform {
  data: any[]
  priceField: 'Open' | 'High' | 'Low' | 'Close'
  ticker: string
  maxDataPoints?: number
}

// Statistical calculations
interface StatisticsPayload {
  data: number[]
  calculations: ('mean' | 'median' | 'stdDev' | 'variance' | 'min' | 'max' | 'percentile')[]
  percentile?: number
}

// Technical indicators
interface TechnicalIndicatorPayload {
  data: any[]
  indicators: ('sma' | 'ema' | 'rsi' | 'bollinger' | 'macd')[]
  periods?: { [key: string]: number }
}

// Utility functions for data processing
function transformToNivoFormat(data: any[], priceField: string, ticker: string) {
  return [{
    id: ticker,
    data: data.map(d => ({
      x: new Date(d.Date),
      y: d[priceField]
    })).filter(d => d.y !== null && d.y !== undefined)
  }]
}

function downsampleData(data: any[], maxDataPoints: number) {
  if (data.length <= maxDataPoints) return data
  
  const step = Math.ceil(data.length / maxDataPoints)
  const downsampled = []
  
  for (let i = 0; i < data.length; i += step) {
    downsampled.push(data[i])
  }
  
  return downsampled
}

function calculateStatistics(data: number[], calculations: string[], percentile?: number) {
  const sorted = [...data].sort((a, b) => a - b)
  const n = data.length
  const results: { [key: string]: number } = {}
  
  if (calculations.includes('mean')) {
    results.mean = data.reduce((sum, val) => sum + val, 0) / n
  }
  
  if (calculations.includes('median')) {
    const mid = Math.floor(n / 2)
    results.median = n % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid]
  }
  
  if (calculations.includes('min')) {
    results.min = Math.min(...data)
  }
  
  if (calculations.includes('max')) {
    results.max = Math.max(...data)
  }
  
  if (calculations.includes('variance') || calculations.includes('stdDev')) {
    const mean = results.mean || data.reduce((sum, val) => sum + val, 0) / n
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
    
    if (calculations.includes('variance')) {
      results.variance = variance
    }
    
    if (calculations.includes('stdDev')) {
      results.stdDev = Math.sqrt(variance)
    }
  }
  
  if (calculations.includes('percentile') && percentile !== undefined) {
    const index = Math.ceil((percentile / 100) * n) - 1
    results.percentile = sorted[Math.max(0, index)]
  }
  
  return results
}

function calculateSMA(data: number[], period: number): number[] {
  const sma = []
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0)
    sma.push(sum / period)
  }
  return sma
}

function calculateEMA(data: number[], period: number): number[] {
  const ema = []
  const multiplier = 2 / (period + 1)
  
  // Start with SMA for first value
  const firstSMA = data.slice(0, period).reduce((a, b) => a + b, 0) / period
  ema.push(firstSMA)
  
  // Calculate EMA for rest
  for (let i = period; i < data.length; i++) {
    const emaValue = (data[i] * multiplier) + (ema[ema.length - 1] * (1 - multiplier))
    ema.push(emaValue)
  }
  
  return ema
}

function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi = []
  const gains = []
  const losses = []
  
  // Calculate price changes
  for (let i = 1; i < data.length; i++) {
    const change = data[i] - data[i - 1]
    gains.push(change > 0 ? change : 0)
    losses.push(change < 0 ? Math.abs(change) : 0)
  }
  
  // Calculate RSI
  for (let i = period - 1; i < gains.length; i++) {
    const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
    const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
    
    if (avgLoss === 0) {
      rsi.push(100)
    } else {
      const rs = avgGain / avgLoss
      rsi.push(100 - (100 / (1 + rs)))
    }
  }
  
  return rsi
}

function calculateTechnicalIndicators(data: any[], indicators: string[], periods: { [key: string]: number } = {}) {
  const prices = data.map(d => d.Close).filter(p => p !== null && p !== undefined)
  const results: { [key: string]: number[] } = {}
  
  if (indicators.includes('sma')) {
    const period = periods.sma || 20
    results.sma = calculateSMA(prices, period)
  }
  
  if (indicators.includes('ema')) {
    const period = periods.ema || 20
    results.ema = calculateEMA(prices, period)
  }
  
  if (indicators.includes('rsi')) {
    const period = periods.rsi || 14
    results.rsi = calculateRSI(prices, period)
  }
  
  // Add more indicators as needed
  
  return results
}

// Main message handler
self.onmessage = function(event: MessageEvent<WorkerMessage>) {
  const { id, type, payload } = event.data
  
  try {
    let result: any
    
    switch (type) {
      case 'TRANSFORM_CHART_DATA':
        const { data, priceField, ticker, maxDataPoints } = payload as ChartDataTransform
        let processedData = data
        
        if (maxDataPoints && data.length > maxDataPoints) {
          processedData = downsampleData(data, maxDataPoints)
        }
        
        result = transformToNivoFormat(processedData, priceField, ticker)
        break
        
      case 'CALCULATE_STATISTICS':
        const { data: statsData, calculations, percentile } = payload as StatisticsPayload
        result = calculateStatistics(statsData, calculations, percentile)
        break
        
      case 'DOWNSAMPLE_DATA':
        const { data: downsampleData, maxDataPoints: maxPoints } = payload
        result = downsampleData(downsampleData, maxPoints)
        break
        
      case 'CALCULATE_TECHNICAL_INDICATORS':
        const { data: indicatorData, indicators, periods } = payload as TechnicalIndicatorPayload
        result = calculateTechnicalIndicators(indicatorData, indicators, periods)
        break
        
      default:
        throw new Error(`Unknown message type: ${type}`)
    }
    
    const response: WorkerResponse = {
      id,
      type: 'SUCCESS',
      result
    }
    
    self.postMessage(response)
    
  } catch (error) {
    const response: WorkerResponse = {
      id,
      type: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
    
    self.postMessage(response)
  }
}

// Export types for TypeScript
export type { ChartDataTransform, StatisticsPayload, TechnicalIndicatorPayload }