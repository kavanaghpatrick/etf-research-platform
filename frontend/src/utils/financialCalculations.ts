/**
 * Financial calculations for stock and ETF analysis
 * Implements key metrics like Sharpe ratio, volatility, returns, etc.
 */

import { ApiTickerData } from '@/components/chartUtils'

export interface PerformanceMetrics {
  // Return Metrics
  totalReturn: number
  annualizedReturn: number
  priceReturn: number
  dividendReturn?: number
  
  // Risk Metrics
  volatility: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  
  // Statistical Metrics
  beta?: number
  alpha?: number
  skewness: number
  kurtosis: number
  
  // Additional Metrics
  calmarRatio: number
  winRate: number
  averageGain: number
  averageLoss: number
  
  // Meta
  periodDays: number
  tradingDays: number
}

/**
 * Calculate comprehensive performance metrics from price data
 */
export function calculatePerformanceMetrics(
  data: ApiTickerData[], 
  riskFreeRate: number = 0.02, // 2% default risk-free rate (consider using dynamic rate)
  dividendData?: { amount: number; ex_date: string }[]
): PerformanceMetrics {
  if (!data || data.length < 2) {
    return getEmptyMetrics()
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime())
  const prices = sortedData.map(d => d.Close).filter(p => p != null)
  const returns = calculateReturns(prices)
  
  // Time period calculations
  const startDate = new Date(sortedData[0].Date)
  const endDate = new Date(sortedData[sortedData.length - 1].Date)
  const periodDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const tradingDays = sortedData.length
  const yearsInPeriod = periodDays / 365.25

  // Return calculations
  const startPrice = prices[0]
  const endPrice = prices[prices.length - 1]
  const priceReturn = (endPrice - startPrice) / startPrice
  
  // Dividend return calculation
  let dividendReturn = 0
  if (dividendData && dividendData.length > 0) {
    const totalDividends = dividendData.reduce((sum, div) => sum + div.amount, 0)
    dividendReturn = totalDividends / startPrice
  }
  
  const totalReturn = priceReturn + dividendReturn
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / yearsInPeriod) - 1

  // Risk calculations
  const volatility = calculateVolatility(returns) * Math.sqrt(252) // Annualized
  const sharpeRatio = (annualizedReturn - riskFreeRate) / volatility
  const sortinoRatio = calculateSortinoRatio(returns, riskFreeRate)
  const maxDrawdown = calculateMaxDrawdown(prices)
  const calmarRatio = volatility > 0 ? annualizedReturn / Math.abs(maxDrawdown) : 0

  // Statistical measures
  const skewness = calculateSkewness(returns)
  const kurtosis = calculateKurtosis(returns)

  // Win/loss metrics
  const positiveReturns = returns.filter(r => r > 0)
  const negativeReturns = returns.filter(r => r < 0)
  const winRate = positiveReturns.length / returns.length
  const averageGain = positiveReturns.length > 0 ? 
    positiveReturns.reduce((sum, r) => sum + r, 0) / positiveReturns.length : 0
  const averageLoss = negativeReturns.length > 0 ? 
    negativeReturns.reduce((sum, r) => sum + r, 0) / negativeReturns.length : 0

  return {
    totalReturn,
    annualizedReturn,
    priceReturn,
    dividendReturn: dividendReturn > 0 ? dividendReturn : undefined,
    volatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    calmarRatio,
    skewness,
    kurtosis,
    winRate,
    averageGain,
    averageLoss,
    periodDays,
    tradingDays
  }
}

/**
 * Calculate daily returns from price array
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i-1] > 0 && prices[i] > 0) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1])
    }
  }
  return returns
}

/**
 * Calculate annualized volatility
 */
function calculateVolatility(returns: number[]): number {
  if (returns.length < 2) return 0
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1)
  
  return Math.sqrt(variance)
}

/**
 * Calculate Sortino ratio (downside risk-adjusted return)
 */
function calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
  const annualizedReturns = returns.map(r => r * 252) // Annualize daily returns
  const excessReturns = annualizedReturns.map(r => r - riskFreeRate)
  const meanExcessReturn = excessReturns.reduce((sum, r) => sum + r, 0) / excessReturns.length
  
  const downsideReturns = excessReturns.filter(r => r < 0)
  if (downsideReturns.length === 0) return Infinity
  
  const downsideVariance = downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length
  const downsideDeviation = Math.sqrt(downsideVariance)
  
  return downsideDeviation > 0 ? meanExcessReturn / downsideDeviation : 0
}

/**
 * Calculate maximum drawdown
 */
function calculateMaxDrawdown(prices: number[]): number {
  let maxDrawdown = 0
  let peak = prices[0]
  
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > peak) {
      peak = prices[i]
    }
    
    const drawdown = (peak - prices[i]) / peak
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }
  
  return maxDrawdown
}

/**
 * Calculate skewness of returns
 */
function calculateSkewness(returns: number[]): number {
  if (returns.length < 3) return 0
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return 0
  
  const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length
  
  return skewness
}

/**
 * Calculate kurtosis of returns
 */
function calculateKurtosis(returns: number[]): number {
  if (returns.length < 4) return 0
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
  const stdDev = Math.sqrt(variance)
  
  if (stdDev === 0) return 0
  
  const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length
  
  return kurtosis - 3 // Excess kurtosis (subtract 3 for normal distribution)
}

/**
 * Get empty metrics object for error cases
 */
function getEmptyMetrics(): PerformanceMetrics {
  return {
    totalReturn: 0,
    annualizedReturn: 0,
    priceReturn: 0,
    volatility: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    maxDrawdown: 0,
    calmarRatio: 0,
    skewness: 0,
    kurtosis: 0,
    winRate: 0,
    averageGain: 0,
    averageLoss: 0,
    periodDays: 0,
    tradingDays: 0
  }
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Format number with appropriate precision
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2)
  }
  return value.toFixed(decimals)
}

/**
 * Get risk level description based on Sharpe ratio
 */
export function getRiskLevel(sharpeRatio: number): { level: string; color: string; description: string } {
  if (sharpeRatio > 2) {
    return { level: 'Excellent', color: 'text-green-600', description: 'Outstanding risk-adjusted returns' }
  } else if (sharpeRatio > 1) {
    return { level: 'Good', color: 'text-blue-600', description: 'Good risk-adjusted returns' }
  } else if (sharpeRatio > 0) {
    return { level: 'Acceptable', color: 'text-yellow-600', description: 'Acceptable risk-adjusted returns' }
  } else {
    return { level: 'Poor', color: 'text-red-600', description: 'Poor risk-adjusted returns' }
  }
}