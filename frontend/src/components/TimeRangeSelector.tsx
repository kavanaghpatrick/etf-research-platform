'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import { TimeRange } from '@/types/stock'
import { TIME_RANGE_CONFIGS, formatDateRange, calculateStartDate, calculateEndDate } from '@/utils/timeRange'

interface TimeRangeSelectorProps {
  selectedRange: TimeRange
  onRangeChange: (range: TimeRange, customStart?: string, customEnd?: string) => void
  disabled?: boolean
  showDateRange?: boolean
  className?: string
}

const TimeRangeSelectorComponent = function TimeRangeSelector({
  selectedRange,
  onRangeChange,
  disabled = false,
  showDateRange = true,
  className = ''
}: TimeRangeSelectorProps) {
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Memoize filtered range configurations to prevent recalculation
  const { mainRanges, customRange } = useMemo(() => ({
    mainRanges: TIME_RANGE_CONFIGS.filter(config => config.value !== 'CUSTOM'),
    customRange: TIME_RANGE_CONFIGS.find(config => config.value === 'CUSTOM')
  }), [])

  const handleRangeClick = useCallback((range: TimeRange) => {
    if (disabled) return
    
    if (range === 'CUSTOM') {
      setShowCustomDatePicker(true)
      return
    }
    
    setShowCustomDatePicker(false)
    onRangeChange(range)
  }, [disabled, onRangeChange])

  const [dateError, setDateError] = useState('')

  const handleCustomDateSubmit = useCallback(() => {
    if (!customStartDate || !customEndDate) {
      setDateError('Please select both start and end dates')
      return
    }
    
    if (new Date(customStartDate) >= new Date(customEndDate)) {
      setDateError('Start date must be before end date')
      return
    }
    
    setDateError('')
    onRangeChange('CUSTOM', customStartDate, customEndDate)
    setShowCustomDatePicker(false)
  }, [customStartDate, customEndDate, onRangeChange])

  const handleCustomDateCancel = useCallback(() => {
    setShowCustomDatePicker(false)
    setCustomStartDate('')
    setCustomEndDate('')
  }, [])

  // Memoize current date range calculation to prevent expensive recalculations
  const { currentStartDate, currentEndDate } = useMemo(() => ({
    currentStartDate: selectedRange === 'CUSTOM' && customStartDate 
      ? customStartDate 
      : calculateStartDate(selectedRange, undefined, 1), // Default to single ticker for date display
    currentEndDate: selectedRange === 'CUSTOM' && customEndDate 
      ? customEndDate 
      : calculateEndDate(selectedRange)
  }), [selectedRange, customStartDate, customEndDate])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Time Range Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Main time range buttons */}
        <div className="flex flex-wrap gap-2 flex-1">
          {mainRanges.map((config) => (
            <button
              key={config.value}
              onClick={() => handleRangeClick(config.value)}
              disabled={disabled}
              className={`
                px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${selectedRange === config.value && !showCustomDatePicker
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                }
                ${disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'
                }
                focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                min-w-[44px] md:min-w-[52px]
              `}
              title={`Select ${config.label} time range`}
            >
              {config.label}
            </button>
          ))}
        </div>
        
        {/* Custom range button */}
        {customRange && (
          <button
            onClick={() => handleRangeClick('CUSTOM')}
            disabled={disabled}
            className={`
              px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
              ${selectedRange === 'CUSTOM' || showCustomDatePicker
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
              }
              ${disabled 
                ? 'opacity-50 cursor-not-allowed' 
                : 'cursor-pointer'
              }
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              min-w-[70px]
            `}
            title="Select custom date range"
          >
            {customRange.label}
          </button>
        )}
      </div>

      {/* Custom Date Picker */}
      {showCustomDatePicker && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Custom Date Range</h4>
          {dateError && (
            <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200" role="alert">
              {dateError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="custom-start-date" className="block text-xs font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                id="custom-start-date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label htmlFor="custom-end-date" className="block text-xs font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                id="custom-end-date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white dark:text-gray-100 dark:bg-gray-800 dark:border-gray-600"
                max={new Date().toISOString().split('T')[0]}
                min={customStartDate}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <button
              onClick={handleCustomDateCancel}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCustomDateSubmit}
              className="px-4 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Current Date Range Display */}
      {showDateRange && !showCustomDatePicker && (
        <div className="text-xs text-gray-600">
          <span className="font-medium">Date Range:</span> {formatDateRange(currentStartDate, currentEndDate)}
        </div>
      )}
    </div>
  )
}

// Export memoized component for performance optimization
export const TimeRangeSelector = memo(TimeRangeSelectorComponent)
TimeRangeSelector.displayName = 'TimeRangeSelector'

// Compact variant for smaller spaces  
const CompactTimeRangeSelectorComponent = function CompactTimeRangeSelector({
  selectedRange,
  onRangeChange,
  disabled = false
}: Omit<TimeRangeSelectorProps, 'showDateRange' | 'className'>) {
  return (
    <div className="flex flex-wrap gap-1">
      {TIME_RANGE_CONFIGS.filter(c => c.value !== 'CUSTOM').map((config) => (
        <button
          key={config.value}
          onClick={() => onRangeChange(config.value)}
          disabled={disabled}
          className={`
            px-2 py-1 text-xs font-medium rounded transition-all duration-200
            ${selectedRange === config.value
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
            }
            ${disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'cursor-pointer'
            }
            min-w-[36px]
          `}
        >
          {config.label}
        </button>
      ))}
    </div>
  )
}

// Export memoized compact component
export const CompactTimeRangeSelector = memo(CompactTimeRangeSelectorComponent)
CompactTimeRangeSelector.displayName = 'CompactTimeRangeSelector'