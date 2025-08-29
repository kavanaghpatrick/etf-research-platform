import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { TimeRangeSelector } from '../TimeRangeSelector'
import { TimeRange } from '@/types/stock'
import {
  checkAccessibility,
  fireKeyboardEvent,
  captureVisualSnapshot,
  expectScreenReaderAnnouncement,
} from '@/tests/test-utils'

// Mock alert
const mockAlert = jest.spyOn(window, 'alert').mockImplementation()

describe('TimeRangeSelector', () => {
  const mockOnRangeChange = jest.fn()

  beforeEach(() => {
    mockOnRangeChange.mockClear()
    mockAlert.mockClear()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders all time range buttons', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    // Check that main time range buttons are present
    expect(screen.getByText('1D')).toBeInTheDocument()
    expect(screen.getByText('5D')).toBeInTheDocument()
    expect(screen.getByText('1M')).toBeInTheDocument()
    expect(screen.getByText('3M')).toBeInTheDocument()
    expect(screen.getByText('6M')).toBeInTheDocument()
    expect(screen.getByText('1Y')).toBeInTheDocument()
    expect(screen.getByText('5Y')).toBeInTheDocument()
    expect(screen.getByText('MAX')).toBeInTheDocument()
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })

  it('highlights the selected range', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    const selectedButton = screen.getByText('1M')
    expect(selectedButton).toHaveClass('bg-blue-600', 'text-white')
  })

  it('calls onRangeChange when a range button is clicked', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    fireEvent.click(screen.getByText('3M'))
    expect(mockOnRangeChange).toHaveBeenCalledWith('3M')
  })

  it('shows custom date picker when Custom button is clicked', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    fireEvent.click(screen.getByText('Custom'))
    
    expect(screen.getByText('Custom Date Range')).toBeInTheDocument()
    expect(screen.getByLabelText('Start Date')).toBeInTheDocument()
    expect(screen.getByLabelText('End Date')).toBeInTheDocument()
  })

  it('validates custom date range inputs', async () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    // Open custom date picker
    fireEvent.click(screen.getByText('Custom'))

    // Try to submit without dates
    const applyButton = screen.getByText('Apply')
    fireEvent.click(applyButton)

    expect(mockAlert).toHaveBeenCalledWith('Please select both start and end dates')
    expect(mockOnRangeChange).not.toHaveBeenCalled()
  })

  it('validates start date is before end date', async () => {
    const user = userEvent.setup()
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    // Open custom date picker
    await user.click(screen.getByText('Custom'))

    // Fill in invalid date range (start after end)
    const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
    const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement

    await user.type(startDateInput, '2024-12-31')
    await user.type(endDateInput, '2024-01-01')

    // Try to apply
    await user.click(screen.getByText('Apply'))

    expect(mockAlert).toHaveBeenCalledWith('Start date must be before end date')
    expect(mockOnRangeChange).not.toHaveBeenCalled()
  })

  it('disables buttons when disabled prop is true', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
        disabled={true}
      />
    )

    const button = screen.getByText('1M')
    expect(button).toBeDisabled()
  })

  it('displays date range when showDateRange is true', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
        showDateRange={true}
      />
    )

    expect(screen.getByText(/Date Range:/)).toBeInTheDocument()
  })

  it('handles custom date submission correctly', async () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    // Open custom date picker
    fireEvent.click(screen.getByText('Custom'))

    // Fill in dates
    const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
    const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement

    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })
    fireEvent.change(endDateInput, { target: { value: '2024-01-31' } })

    // Apply the custom range
    fireEvent.click(screen.getByText('Apply'))

    expect(mockOnRangeChange).toHaveBeenCalledWith('CUSTOM', '2024-01-01', '2024-01-31')
  })

  it('cancels custom date picker correctly', () => {
    render(
      <TimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    // Open custom date picker
    fireEvent.click(screen.getByText('Custom'))
    expect(screen.getByText('Custom Date Range')).toBeInTheDocument()

    // Cancel
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Custom Date Range')).not.toBeInTheDocument()
  })
})

  describe('Accessibility', () => {
    it('passes accessibility audit', async () => {
      const { container } = render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      await checkAccessibility(container)
    })

    it('supports keyboard navigation', async () => {
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      const firstButton = screen.getByText('1D')
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)

      // Test Enter key
      fireKeyboardEvent(firstButton, 'Enter')
      expect(mockOnRangeChange).toHaveBeenCalledWith('1D')
    })

    it('has proper ARIA labels and titles', () => {
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      // Check title attributes
      expect(screen.getByTitle('Select 1 Day time range')).toBeInTheDocument()
      expect(screen.getByTitle('Select 1 Month time range')).toBeInTheDocument()
      expect(screen.getByTitle('Select custom date range')).toBeInTheDocument()
    })

    it('properly handles focus management in custom date picker', async () => {
      const user = userEvent.setup()
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      await user.click(screen.getByText('Custom'))
      
      const startDateInput = screen.getByLabelText('Start Date')
      expect(startDateInput).toBeInTheDocument()
      
      // Tab through form elements
      await user.tab()
      const endDateInput = screen.getByLabelText('End Date')
      expect(document.activeElement).toBe(endDateInput)
    })
  })

  describe('Performance', () => {
    it('memoizes expensive calculations', () => {
      const { rerender } = render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      // Re-render with same props
      rerender(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      // Callbacks should not have been called again
      expect(mockOnRangeChange).not.toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid clicking without issues', async () => {
      const user = userEvent.setup({ delay: null })
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      // Rapid clicks
      const button = screen.getByText('3M')
      await user.click(button)
      await user.click(button)
      await user.click(button)

      expect(mockOnRangeChange).toHaveBeenCalledTimes(3)
      expect(mockOnRangeChange).toHaveBeenCalledWith('3M')
    })

    it('handles empty custom date inputs gracefully', async () => {
      const user = userEvent.setup()
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      await user.click(screen.getByText('Custom'))
      
      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
      await user.type(startDateInput, '2024-01-01')
      
      // Leave end date empty
      await user.click(screen.getByText('Apply'))
      
      expect(mockAlert).toHaveBeenCalledWith('Please select both start and end dates')
    })

    it('prevents selecting future dates', () => {
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
        />
      )

      fireEvent.click(screen.getByText('Custom'))
      
      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
      const maxDate = startDateInput.getAttribute('max')
      
      // Max date should be today
      expect(maxDate).toBe(new Date().toISOString().split('T')[0])
    })
  })

  describe('Visual States', () => {
    it('applies correct styles for selected state', () => {
      const { container } = render(
        <TimeRangeSelector
          selectedRange="3M"
          onRangeChange={mockOnRangeChange}
        />
      )

      const selectedButton = screen.getByText('3M')
      expect(selectedButton).toHaveClass('bg-blue-600', 'text-white', 'shadow-md')
      
      const unselectedButton = screen.getByText('1M')
      expect(unselectedButton).toHaveClass('bg-gray-100', 'text-gray-700')
      
      captureVisualSnapshot(container, 'time-range-selector-states')
    })

    it('applies disabled styles correctly', () => {
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
          disabled={true}
        />
      )

      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
        expect(button).toBeDisabled()
      })
    })
  })

  describe('Custom Date Functionality', () => {
    it('retains custom date values when reopening picker', async () => {
      const user = userEvent.setup()
      render(
        <TimeRangeSelector
          selectedRange="CUSTOM"
          onRangeChange={mockOnRangeChange}
        />
      )

      // Open custom picker
      await user.click(screen.getByText('Custom'))
      
      // Set dates
      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement
      
      await user.type(startDateInput, '2024-01-01')
      await user.type(endDateInput, '2024-01-31')
      
      // Cancel
      await user.click(screen.getByText('Cancel'))
      
      // Reopen - values should be cleared
      await user.click(screen.getByText('Custom'))
      
      expect(screen.getByLabelText('Start Date')).toHaveValue('')
      expect(screen.getByLabelText('End Date')).toHaveValue('')
    })

    it('formats custom date range correctly in display', async () => {
      const user = userEvent.setup()
      render(
        <TimeRangeSelector
          selectedRange="1M"
          onRangeChange={mockOnRangeChange}
          showDateRange={true}
        />
      )

      await user.click(screen.getByText('Custom'))
      
      const startDateInput = screen.getByLabelText('Start Date') as HTMLInputElement
      const endDateInput = screen.getByLabelText('End Date') as HTMLInputElement
      
      await user.type(startDateInput, '2024-01-01')
      await user.type(endDateInput, '2024-01-31')
      
      await user.click(screen.getByText('Apply'))
      
      expect(mockOnRangeChange).toHaveBeenCalledWith('CUSTOM', '2024-01-01', '2024-01-31')
    })
  })
})

describe('CompactTimeRangeSelector', () => {
  const mockOnRangeChange = jest.fn()

  beforeEach(() => {
    mockOnRangeChange.mockClear()
  })

  it('renders compact buttons without custom option', () => {
    const { CompactTimeRangeSelector } = require('../TimeRangeSelector')
    
    render(
      <CompactTimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    // Should have main buttons
    expect(screen.getByText('1D')).toBeInTheDocument()
    expect(screen.getByText('1M')).toBeInTheDocument()
    
    // Should not have custom button
    expect(screen.queryByText('Custom')).not.toBeInTheDocument()
  })

  it('uses smaller styling for compact variant', () => {
    const { CompactTimeRangeSelector } = require('../TimeRangeSelector')
    
    render(
      <CompactTimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    const button = screen.getByText('1M')
    expect(button).toHaveClass('text-xs') // Compact styling
  })

  it('passes accessibility audit for compact variant', async () => {
    const { CompactTimeRangeSelector } = require('../TimeRangeSelector')
    
    const { container } = render(
      <CompactTimeRangeSelector
        selectedRange="1M"
        onRangeChange={mockOnRangeChange}
      />
    )

    await checkAccessibility(container)
  })
})