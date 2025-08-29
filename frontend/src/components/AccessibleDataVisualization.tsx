'use client'

import React, { useState, useRef, useMemo, useCallback } from 'react'
import { StockDataPoint } from '@/types/stock'

interface AccessibleChartProps {
  data: StockDataPoint[]
  title: string
  description?: string
  xAxisLabel?: string
  yAxisLabel?: string
  ticker?: string
  priceField?: keyof StockDataPoint
  showDataTable?: boolean
  showSummary?: boolean
  className?: string
}

/**
 * Accessible data visualization component that provides multiple ways to consume chart data
 * Includes screen reader optimizations, data tables, and audio representations
 */
export function AccessibleDataVisualization({
  data,
  title,
  description,
  xAxisLabel = 'Date',
  yAxisLabel = 'Price',
  ticker,
  priceField = 'Close',
  showDataTable = true,
  showSummary = true,
  className = ''
}: AccessibleChartProps) {
  const [currentViewMode, setCurrentViewMode] = useState<'visual' | 'table' | 'summary' | 'sonification'>('visual')
  const [currentDataIndex, setCurrentDataIndex] = useState<number>(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  
  const tableRef = useRef<HTMLTableElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Process and validate data
  const processedData = useMemo(() => {
    return data
      .filter(d => d[priceField] !== undefined && d[priceField] !== null && !isNaN(d[priceField] as number))
      .map((d, index) => ({
        ...d,
        index,
        value: d[priceField] as number,
        date: d.Date ? new Date(d.Date) : null
      }))
      .sort((a, b) => {
        if (!a.date || !b.date) return 0
        return a.date.getTime() - b.date.getTime()
      })
  }, [data, priceField])

  // Calculate statistics
  const statistics = useMemo(() => {
    if (processedData.length === 0) return null

    const values = processedData.map(d => d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const sortedValues = [...values].sort((a, b) => a - b)
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
      : sortedValues[Math.floor(sortedValues.length / 2)]

    const firstValue = values[0]
    const lastValue = values[values.length - 1]
    const totalChange = lastValue - firstValue
    const percentChange = (totalChange / firstValue) * 100

    return {
      count: values.length,
      min,
      max,
      mean,
      median,
      range: max - min,
      firstValue,
      lastValue,
      totalChange,
      percentChange,
      startDate: processedData[0]?.date,
      endDate: processedData[processedData.length - 1]?.date
    }
  }, [processedData])

  /**
   * Generate sonification (audio representation) of data
   */
  const generateSonification = useCallback(async () => {
    if (!statistics || processedData.length === 0) return

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      const audioContext = audioContextRef.current
      await audioContext.resume()

      const duration = Math.min(processedData.length * 100, 10000) // Max 10 seconds
      const noteDuration = duration / processedData.length

      // Map values to frequency range (200Hz to 800Hz)
      const minFreq = 200
      const maxFreq = 800
      const freqRange = maxFreq - minFreq

      setIsPlaying(true)

      for (let i = 0; i < processedData.length; i++) {
        const dataPoint = processedData[i]
        const normalizedValue = (dataPoint.value - statistics.min) / (statistics.max - statistics.min)
        const frequency = minFreq + (normalizedValue * freqRange)

        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + (i * noteDuration / 1000))
        oscillator.type = 'sine'

        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime + (i * noteDuration / 1000))
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + ((i + 1) * noteDuration / 1000))

        oscillator.start(audioContext.currentTime + (i * noteDuration / 1000))
        oscillator.stop(audioContext.currentTime + ((i + 1) * noteDuration / 1000))

        // Update current index for visual feedback
        setTimeout(() => {
          setCurrentDataIndex(i)
        }, i * noteDuration)
      }

      setTimeout(() => {
        setIsPlaying(false)
        setCurrentDataIndex(-1)
      }, duration)

    } catch (error) {
      console.error('Error generating sonification:', error)
      setIsPlaying(false)
    }
  }, [processedData, statistics])

  /**
   * Get textual description of trend
   */
  const getTrendDescription = useCallback(() => {
    if (!statistics || processedData.length < 2) return 'Insufficient data for trend analysis'

    const { percentChange, totalChange } = statistics
    const direction = totalChange > 0 ? 'increased' : totalChange < 0 ? 'decreased' : 'remained stable'
    const magnitude = Math.abs(percentChange)

    let intensityWord = 'slightly'
    if (magnitude > 20) intensityWord = 'dramatically'
    else if (magnitude > 10) intensityWord = 'significantly'
    else if (magnitude > 5) intensityWord = 'moderately'

    return `The ${yAxisLabel.toLowerCase()} has ${intensityWord} ${direction} by ${Math.abs(totalChange).toFixed(2)} units (${Math.abs(percentChange).toFixed(2)}%) over the time period.`
  }, [statistics, yAxisLabel])

  /**
   * Navigate through data points with keyboard
   */
  const handleKeyNavigation = useCallback((event: React.KeyboardEvent) => {
    if (currentViewMode !== 'table') return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setCurrentDataIndex(prev => Math.min(prev + 1, processedData.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setCurrentDataIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setCurrentDataIndex(0)
        break
      case 'End':
        event.preventDefault()
        setCurrentDataIndex(processedData.length - 1)
        break
    }
  }, [currentViewMode, processedData.length])

  if (processedData.length === 0) {
    return (
      <div className={`p-6 border-2 border-dashed border-gray-300 rounded-lg text-center ${className}`}>
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
        <p className="text-gray-600">
          No valid data points found for visualization.
        </p>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header with view mode controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {description && (
              <p className="text-sm text-gray-600 mt-1">{description}</p>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <label htmlFor="view-mode-select" className="text-sm font-medium text-gray-700">
              View Mode:
            </label>
            <select
              id="view-mode-select"
              value={currentViewMode}
              onChange={(e) => setCurrentViewMode(e.target.value as any)}
              className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              aria-label="Select data visualization view mode"
            >
              <option value="visual">Visual Chart</option>
              <option value="table">Data Table</option>
              <option value="summary">Summary</option>
              <option value="sonification">Audio</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content based on view mode */}
      <div className="p-6">
        {currentViewMode === 'visual' && (
          <div>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Chart Information</h3>
              <p className="text-sm text-blue-800">
                This chart shows {processedData.length} data points from{' '}
                {statistics?.startDate?.toLocaleDateString()} to{' '}
                {statistics?.endDate?.toLocaleDateString()}. {getTrendDescription()}
              </p>
              <p className="text-sm text-blue-700 mt-2">
                Switch to "Data Table" mode for detailed screen reader access, or "Audio" mode to hear the data trend.
              </p>
            </div>
            
            {/* Placeholder for visual chart - would integrate with existing chart component */}
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-600">Visual chart would be rendered here</p>
                <p className="text-sm text-gray-500 mt-1">
                  Integrate with existing StockChart component
                </p>
              </div>
            </div>
          </div>
        )}

        {currentViewMode === 'table' && (
          <div>
            <div className="mb-4 p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-800">
                Use arrow keys to navigate through data points. Press Home/End to jump to beginning/end.
                Current position: {currentDataIndex >= 0 ? currentDataIndex + 1 : 'None selected'} of {processedData.length}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table
                ref={tableRef}
                className="min-w-full divide-y divide-gray-200"
                role="table"
                aria-label={`${title} data table with ${processedData.length} rows`}
                onKeyDown={handleKeyNavigation}
                tabIndex={0}
              >
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {xAxisLabel}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {yAxisLabel}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volume
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Daily Change
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {processedData.map((dataPoint, index) => {
                    const previousValue = index > 0 ? processedData[index - 1].value : dataPoint.value
                    const dailyChange = dataPoint.value - previousValue
                    const dailyChangePercent = previousValue !== 0 ? (dailyChange / previousValue) * 100 : 0
                    const isSelected = index === currentDataIndex
                    
                    return (
                      <tr
                        key={index}
                        className={`${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-50'} ${
                          isPlaying && index === currentDataIndex ? 'animate-pulse' : ''
                        }`}
                        aria-selected={isSelected}
                        onClick={() => setCurrentDataIndex(index)}
                        role="row"
                        tabIndex={isSelected ? 0 : -1}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {dataPoint.date?.toLocaleDateString() || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${dataPoint.value.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {dataPoint.Volume?.toLocaleString() || 'N/A'}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                          dailyChange > 0 ? 'text-green-600' : dailyChange < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {index === 0 ? 'N/A' : (
                            <span aria-label={`Daily change: ${dailyChange > 0 ? 'positive' : dailyChange < 0 ? 'negative' : 'no change'} ${Math.abs(dailyChange).toFixed(2)} dollars, ${Math.abs(dailyChangePercent).toFixed(2)} percent`}>
                              {dailyChange > 0 ? '+' : ''}${dailyChange.toFixed(2)} ({dailyChange > 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentViewMode === 'summary' && statistics && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Overview</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-blue-700">Data Points:</dt>
                    <dd className="text-sm font-medium text-blue-900">{statistics.count}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-blue-700">Date Range:</dt>
                    <dd className="text-sm font-medium text-blue-900">
                      {statistics.startDate?.toLocaleDateString()} - {statistics.endDate?.toLocaleDateString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-blue-700">Total Change:</dt>
                    <dd className={`text-sm font-medium ${
                      statistics.totalChange > 0 ? 'text-green-700' : statistics.totalChange < 0 ? 'text-red-600' : 'text-gray-700'
                    }`}>
                      ${statistics.totalChange.toFixed(2)} ({statistics.percentChange > 0 ? '+' : ''}{statistics.percentChange.toFixed(2)}%)
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-green-900 mb-3">Statistics</h3>
                <dl className="space-y-2">
                  <div className="flex justify-between">
                    <dt className="text-sm text-green-700">Minimum:</dt>
                    <dd className="text-sm font-medium text-green-900">${statistics.min.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-green-700">Maximum:</dt>
                    <dd className="text-sm font-medium text-green-900">${statistics.max.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-green-700">Average:</dt>
                    <dd className="text-sm font-medium text-green-900">${statistics.mean.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-green-700">Median:</dt>
                    <dd className="text-sm font-medium text-green-900">${statistics.median.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-sm text-green-700">Range:</dt>
                    <dd className="text-sm font-medium text-green-900">${statistics.range.toFixed(2)}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 mb-3">Trend Analysis</h3>
              <p className="text-purple-800">{getTrendDescription()}</p>
              
              {statistics.percentChange !== 0 && (
                <div className="mt-3 p-3 bg-white rounded border border-purple-200">
                  <h4 className="text-sm font-medium text-purple-900 mb-2">Performance Summary</h4>
                  <p className="text-sm text-purple-800">
                    Starting value: ${statistics.firstValue.toFixed(2)}<br/>
                    Ending value: ${statistics.lastValue.toFixed(2)}<br/>
                    Net change: ${statistics.totalChange.toFixed(2)}<br/>
                    Percentage change: {statistics.percentChange > 0 ? '+' : ''}{statistics.percentChange.toFixed(2)}%
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentViewMode === 'sonification' && (
          <div className="space-y-6">
            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3">Audio Data Representation</h3>
              <p className="text-yellow-800 mb-4">
                Listen to your data! This sonification converts data points into audio tones. 
                Higher values produce higher pitched tones, lower values produce lower pitched tones.
              </p>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={generateSonification}
                  disabled={isPlaying}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isPlaying 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500'
                  }`}
                  aria-label={isPlaying ? 'Currently playing audio representation' : 'Play audio representation of data'}
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-5a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {isPlaying ? 'Playing...' : 'Play Audio'}
                </button>
                
                {isPlaying && currentDataIndex >= 0 && (
                  <div className="text-sm text-yellow-700">
                    Current: {currentDataIndex + 1} of {processedData.length} 
                    (${processedData[currentDataIndex]?.value.toFixed(2)})
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-white rounded border border-yellow-200">
                <h4 className="text-sm font-medium text-yellow-900 mb-2">How to Listen</h4>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• Higher pitch = Higher values</li>
                  <li>• Lower pitch = Lower values</li>
                  <li>• Each tone represents one data point</li>
                  <li>• Trends become audible patterns</li>
                  <li>• Duration is scaled to data complexity</li>
                </ul>
              </div>
            </div>

            {statistics && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Audio Mapping</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-gray-700">Frequency Range:</p>
                    <p className="text-gray-600">200Hz (lowest value) to 800Hz (highest value)</p>
                  </div>
                  <div>
                    <p className="font-medium text-gray-700">Value Range:</p>
                    <p className="text-gray-600">${statistics.min.toFixed(2)} to ${statistics.max.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}