/**
 * Comprehensive accessibility tests for AccessibleStates components
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import {
  LoadingState,
  ErrorState,
  EmptyState,
  WithAccessibleStates
} from '../AccessibleStates'
import {
  testAccessibility,
  testWCAGCompliance,
  testScreenReaderCompatibility,
  testKeyboardNavigation,
  AccessibilityTestPatterns
} from '@/utils/accessibilityTesting'

describe('AccessibleStates Accessibility Tests', () => {
  describe('LoadingState', () => {
    it('should have no accessibility violations', async () => {
      const renderResult = render(<LoadingState message="Loading data" />)
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should meet WCAG 2.1 AA standards', async () => {
      const renderResult = render(<LoadingState message="Loading data" />)
      const results = await testWCAGCompliance(renderResult, 'AA')
      expect(results.violations).toHaveLength(0)
    })

    it('should be screen reader compatible', async () => {
      const renderResult = render(<LoadingState message="Loading data" />)
      const results = await testScreenReaderCompatibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should have proper ARIA live region', () => {
      render(<LoadingState message="Loading data" />)
      
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-label', 'Loading data')
    })

    it('should have proper spinner accessibility', () => {
      render(<LoadingState message="Loading data" showSpinner={true} />)
      
      const spinner = screen.getByRole('status').querySelector('svg')
      expect(spinner).toHaveAttribute('aria-hidden', 'true')
    })

    it('should provide screen reader text', () => {
      render(<LoadingState message="Loading data" />)
      
      const srOnly = screen.getByText('Loading')
      expect(srOnly).toHaveClass('sr-only')
    })

    it('should handle different sizes accessibly', async () => {
      const sizes = ['sm', 'md', 'lg'] as const
      
      for (const size of sizes) {
        const { container } = render(<LoadingState size={size} />)
        const results = await axe(container)
        expect(results.violations).toHaveLength(0)
      }
    })
  })

  describe('ErrorState', () => {
    const mockRetry = jest.fn()

    beforeEach(() => {
      mockRetry.mockClear()
    })

    it('should have no accessibility violations', async () => {
      const renderResult = render(
        <ErrorState 
          message="Something went wrong" 
          onRetry={mockRetry} 
        />
      )
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should meet WCAG 2.1 AA standards', async () => {
      const renderResult = render(
        <ErrorState 
          message="Something went wrong" 
          onRetry={mockRetry} 
        />
      )
      const results = await testWCAGCompliance(renderResult, 'AA')
      expect(results.violations).toHaveLength(0)
    })

    it('should be keyboard accessible', async () => {
      const renderResult = render(
        <ErrorState 
          message="Something went wrong" 
          onRetry={mockRetry} 
        />
      )
      const results = await testKeyboardNavigation(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should have proper ARIA alert role', () => {
      render(<ErrorState message="Something went wrong" />)
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
    })

    it('should have accessible retry button', async () => {
      const user = userEvent.setup()
      render(<ErrorState message="Something went wrong" onRetry={mockRetry} />)
      
      const retryButton = screen.getByRole('button', { name: /retry the failed operation/i })
      expect(retryButton).toBeInTheDocument()
      expect(retryButton).toHaveAttribute('aria-label', 'Retry the failed operation')
      
      await user.click(retryButton)
      expect(mockRetry).toHaveBeenCalledTimes(1)
    })

    it('should handle different severity levels accessibly', async () => {
      const severities = ['error', 'warning', 'info'] as const
      
      for (const severity of severities) {
        const { container } = render(
          <ErrorState 
            message="Test message" 
            severity={severity} 
            onRetry={mockRetry} 
          />
        )
        const results = await axe(container)
        expect(results.violations).toHaveLength(0)
      }
    })

    it('should have accessible details disclosure', async () => {
      const user = userEvent.setup()
      render(
        <ErrorState 
          message="Something went wrong" 
          details="Detailed error information"
        />
      )
      
      const details = screen.getByText('Technical details')
      expect(details).toBeInTheDocument()
      
      await user.click(details)
      expect(screen.getByText('Detailed error information')).toBeVisible()
    })

    it('should provide proper focus management', async () => {
      const user = userEvent.setup()
      render(<ErrorState message="Something went wrong" onRetry={mockRetry} />)
      
      const retryButton = screen.getByRole('button')
      await user.tab()
      expect(retryButton).toHaveFocus()
    })
  })

  describe('EmptyState', () => {
    const mockAction = jest.fn()

    beforeEach(() => {
      mockAction.mockClear()
    })

    it('should have no accessibility violations', async () => {
      const renderResult = render(
        <EmptyState 
          title="No data found"
          description="Try adjusting your search criteria"
          action={{ label: 'Reset', onClick: mockAction }}
        />
      )
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should meet WCAG 2.1 AA standards', async () => {
      const renderResult = render(
        <EmptyState 
          title="No data found"
          description="Try adjusting your search criteria"
        />
      )
      const results = await testWCAGCompliance(renderResult, 'AA')
      expect(results.violations).toHaveLength(0)
    })

    it('should have proper heading structure', () => {
      render(
        <EmptyState 
          title="No data found"
          description="Try adjusting your search criteria"
        />
      )
      
      const heading = screen.getByRole('heading', { name: 'No data found' })
      expect(heading).toBeInTheDocument()
    })

    it('should have accessible action button', async () => {
      const user = userEvent.setup()
      render(
        <EmptyState 
          title="No data found"
          action={{ label: 'Reset filters', onClick: mockAction }}
        />
      )
      
      const actionButton = screen.getByRole('button', { name: 'Reset filters' })
      expect(actionButton).toHaveAttribute('aria-label', 'Reset filters')
      
      await user.click(actionButton)
      expect(mockAction).toHaveBeenCalledTimes(1)
    })

    it('should handle custom icons accessibly', async () => {
      const customIcon = (
        <svg aria-label="Custom icon" role="img">
          <circle cx="12" cy="12" r="10" />
        </svg>
      )
      
      const renderResult = render(
        <EmptyState 
          title="No data found"
          icon={customIcon}
        />
      )
      
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })
  })

  describe('WithAccessibleStates', () => {
    const TestComponent = () => <div>Test content</div>

    it('should render loading state accessibly', async () => {
      const renderResult = render(
        <WithAccessibleStates loading={true} loadingMessage="Loading test data">
          <TestComponent />
        </WithAccessibleStates>
      )
      
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should render error state accessibly', async () => {
      const mockRetry = jest.fn()
      const renderResult = render(
        <WithAccessibleStates 
          error="Something went wrong" 
          onRetry={mockRetry}
        >
          <TestComponent />
        </WithAccessibleStates>
      )
      
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should render children when no loading or error', async () => {
      const renderResult = render(
        <WithAccessibleStates>
          <TestComponent />
        </WithAccessibleStates>
      )
      
      expect(screen.getByText('Test content')).toBeInTheDocument()
      
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })

    it('should handle Error object type', async () => {
      const error = new Error('Test error message')
      const renderResult = render(
        <WithAccessibleStates error={error}>
          <TestComponent />
        </WithAccessibleStates>
      )
      
      expect(screen.getByText('Test error message')).toBeInTheDocument()
      
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })
  })

  describe('Comprehensive Accessibility Tests', () => {
    it('should pass standard component accessibility test pattern', async () => {
      const renderResult = render(
        <div>
          <LoadingState message="Loading" />
          <ErrorState message="Error occurred" onRetry={() => {}} />
          <EmptyState title="No data" />
        </div>
      )
      
      const results = await AccessibilityTestPatterns.standardComponentTest(renderResult)
      
      expect(results.wcag.violations).toHaveLength(0)
      expect(results.keyboard.violations).toHaveLength(0)
      expect(results.screenReader.violations).toHaveLength(0)
      expect(results.contrast.violations).toHaveLength(0)
    })

    it('should maintain accessibility across all severity levels', async () => {
      const severities = ['error', 'warning', 'info'] as const
      
      for (const severity of severities) {
        const renderResult = render(
          <ErrorState 
            message={`${severity} message`}
            severity={severity}
            onRetry={() => {}}
            details="Additional details"
          />
        )
        
        const results = await testWCAGCompliance(renderResult, 'AA')
        expect(results.violations).toHaveLength(0)
      }
    })

    it('should maintain accessibility with all props combinations', async () => {
      const renderResult = render(
        <div>
          <LoadingState 
            message="Complex loading state"
            showSpinner={true}
            size="lg"
            className="custom-class"
          />
          <ErrorState 
            message="Complex error state"
            details="Detailed error information"
            onRetry={() => {}}
            showRetry={true}
            severity="error"
            className="custom-class"
          />
          <EmptyState 
            title="Complex empty state"
            description="Detailed description"
            icon={<div>📊</div>}
            action={{ label: 'Action', onClick: () => {} }}
            className="custom-class"
          />
        </div>
      )
      
      const results = await testAccessibility(renderResult)
      expect(results.violations).toHaveLength(0)
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support proper tab order', async () => {
      const user = userEvent.setup()
      const mockRetry = jest.fn()
      const mockAction = jest.fn()
      
      render(
        <div>
          <ErrorState message="Error" onRetry={mockRetry} />
          <EmptyState 
            title="Empty" 
            action={{ label: 'Action', onClick: mockAction }} 
          />
        </div>
      )
      
      // Tab through interactive elements
      await user.tab()
      expect(screen.getByRole('button', { name: /retry/i })).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: 'Action' })).toHaveFocus()
    })

    it('should handle Enter and Space key activation', async () => {
      const user = userEvent.setup()
      const mockRetry = jest.fn()
      
      render(<ErrorState message="Error" onRetry={mockRetry} />)
      
      const retryButton = screen.getByRole('button')
      retryButton.focus()
      
      await user.keyboard('{Enter}')
      expect(mockRetry).toHaveBeenCalledTimes(1)
      
      await user.keyboard(' ')
      expect(mockRetry).toHaveBeenCalledTimes(2)
    })
  })

  describe('Screen Reader Announcements', () => {
    it('should announce loading state changes', () => {
      const { rerender } = render(
        <WithAccessibleStates loading={false}>
          <div>Content</div>
        </WithAccessibleStates>
      )
      
      rerender(
        <WithAccessibleStates loading={true} loadingMessage="Loading new data">
          <div>Content</div>
        </WithAccessibleStates>
      )
      
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should announce error state changes', () => {
      const { rerender } = render(
        <WithAccessibleStates>
          <div>Content</div>
        </WithAccessibleStates>
      )
      
      rerender(
        <WithAccessibleStates error="Something went wrong">
          <div>Content</div>
        </WithAccessibleStates>
      )
      
      const alertRegion = screen.getByRole('alert')
      expect(alertRegion).toHaveAttribute('aria-live', 'assertive')
    })
  })
})