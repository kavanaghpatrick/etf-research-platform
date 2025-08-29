'use client'

import React from 'react'

interface LoadingStateProps {
  /** The text to announce to screen readers */
  message?: string
  /** Whether to show a visual spinner */
  showSpinner?: boolean
  /** Size of the loading indicator */
  size?: 'sm' | 'md' | 'lg'
  /** Additional CSS classes */
  className?: string
}

/**
 * Accessible loading state component with proper ARIA live region
 */
export function LoadingState({ 
  message = 'Loading content, please wait',
  showSpinner = true,
  size = 'md',
  className = ''
}: LoadingStateProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div 
      className={`flex items-center justify-center p-4 ${className}`}
      role="status"
      aria-live="polite"
      aria-label={message}
    >
      {showSpinner && (
        <svg 
          className={`animate-spin ${sizeClasses[size]} text-blue-600 mr-3`}
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      <span className="text-gray-600 font-medium">{message}</span>
      <span className="sr-only">Loading</span>
    </div>
  )
}

interface ErrorStateProps {
  /** The error message to display */
  message: string
  /** Optional error details for technical users */
  details?: string
  /** Callback to retry the failed operation */
  onRetry?: () => void
  /** Whether to show a retry button */
  showRetry?: boolean
  /** Additional CSS classes */
  className?: string
  /** Severity level of the error */
  severity?: 'error' | 'warning' | 'info'
}

/**
 * Accessible error state component with proper ARIA labeling
 */
export function ErrorState({
  message,
  details,
  onRetry,
  showRetry = true,
  className = '',
  severity = 'error'
}: ErrorStateProps) {
  const severityConfig = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      buttonBg: 'bg-red-600 hover:bg-red-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    warning: {
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
      buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
      buttonBg: 'bg-blue-600 hover:bg-blue-700',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  }

  const config = severityConfig[severity]

  return (
    <div 
      className={`rounded-lg border p-4 ${config.bgColor} ${config.borderColor} ${className}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start">
        <div className={`flex-shrink-0 ${config.iconColor}`}>
          {config.icon}
        </div>
        <div className="ml-3 flex-1">
          <h3 className={`text-sm font-medium ${config.textColor}`}>
            {severity === 'error' ? 'Error' : severity === 'warning' ? 'Warning' : 'Information'}
          </h3>
          <p className={`mt-1 text-sm ${config.textColor}`}>
            {message}
          </p>
          {details && (
            <details className="mt-2">
              <summary className={`cursor-pointer text-xs ${config.textColor} opacity-75 hover:opacity-100`}>
                Technical details
              </summary>
              <pre className={`mt-1 text-xs ${config.textColor} opacity-75 whitespace-pre-wrap font-mono`}>
                {details}
              </pre>
            </details>
          )}
          {showRetry && onRetry && (
            <div className="mt-3">
              <button
                onClick={onRetry}
                className={`inline-flex items-center px-3 py-2 text-sm font-medium text-white rounded-md ${config.buttonBg} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600`}
                aria-label="Retry the failed operation"
              >
                <svg 
                  className="w-4 h-4 mr-2" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  /** The title to display */
  title: string
  /** Description text */
  description?: string
  /** Icon to display */
  icon?: React.ReactNode
  /** Action button */
  action?: {
    label: string
    onClick: () => void
  }
  /** Additional CSS classes */
  className?: string
}

/**
 * Accessible empty state component for when no data is available
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 max-w-md mx-auto mb-4">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          aria-label={action.label}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

/**
 * Higher-order component for adding accessible loading/error states to any component
 */
interface WithAccessibleStatesProps {
  loading?: boolean
  error?: string | Error | null
  loadingMessage?: string
  onRetry?: () => void
  children: React.ReactNode
  className?: string
}

export function WithAccessibleStates({
  loading = false,
  error,
  loadingMessage,
  onRetry,
  children,
  className = ''
}: WithAccessibleStatesProps) {
  if (loading) {
    return <LoadingState message={loadingMessage} className={className} />
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : error
    return (
      <ErrorState 
        message={errorMessage}
        onRetry={onRetry}
        className={className}
      />
    )
  }

  return <>{children}</>
}