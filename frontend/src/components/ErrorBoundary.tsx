'use client'

import React from 'react'

interface ErrorInfo {
  componentStack: string
  errorBoundary?: string
  errorInfo?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{
    error: Error
    errorInfo: ErrorInfo
    resetError: () => void
  }>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
  isolateComponent?: boolean
}

class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorInfoData: ErrorInfo = {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      errorInfo: errorInfo.errorBoundary || undefined
    }

    this.setState({
      errorInfo: errorInfoData
    })

    // Call onError callback if provided
    this.props.onError?.(error, errorInfoData)

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('Error Boundary Caught Error')
      console.error('Error:', error)
      console.error('Error Info:', errorInfoData)
      console.groupEnd()
    }

    // Report to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      // Here you would integrate with your error monitoring service
      // e.g., Sentry, LogRocket, etc.
      this.reportErrorToService(error, errorInfoData)
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    // Reset error state if resetKeys have changed
    if (hasError && resetKeys) {
      const prevResetKeys = prevProps.resetKeys || []
      const hasResetKeyChanged = resetKeys.some((key, index) => 
        key !== prevResetKeys[index]
      )
      
      if (hasResetKeyChanged) {
        this.resetErrorBoundary()
      }
    }

    // Reset error state if resetOnPropsChange is true and props have changed
    if (hasError && resetOnPropsChange && prevProps.children !== this.props.children) {
      this.resetErrorBoundary()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  private reportErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Placeholder for error reporting service integration
    // In a real application, you would send this to your monitoring service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    // Example: Send to your error monitoring service
    // errorMonitoringService.reportError(errorReport)
    console.warn('Error reported to monitoring service:', errorReport)
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback: FallbackComponent, isolateComponent } = this.props

    if (hasError && error && errorInfo) {
      // If a custom fallback component is provided, use it
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo}
            resetError={this.resetErrorBoundary}
          />
        )
      }

      // Default fallback UI
      return (
        <div className={`
          ${isolateComponent ? 'min-h-32' : 'min-h-64'} 
          flex items-center justify-center 
          bg-red-50 border border-red-200 rounded-lg p-6
        `}>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <h3 className="text-lg font-medium text-red-800 mb-2">
              {isolateComponent ? 'Component Error' : 'Application Error'}
            </h3>
            <p className="text-sm text-red-600 mb-4 max-w-md">
              {isolateComponent 
                ? 'This component encountered an error and has been isolated to prevent affecting other parts of the application.'
                : 'Something went wrong. Please try refreshing the page or contact support if the problem persists.'
              }
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-red-700 cursor-pointer hover:text-red-800">
                  Error Details (Development Mode)
                </summary>
                <div className="mt-2 p-3 bg-red-100 rounded text-xs text-red-800 font-mono">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
                    </div>
                  )}
                  {errorInfo.componentStack && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
            
            <button
              onClick={this.resetErrorBoundary}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return children
  }
}

// HOC for easy component wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps} isolateComponent>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Hook for throwing errors that will be caught by error boundaries
export function useErrorHandler() {
  const [, setError] = React.useState()
  
  return React.useCallback((error: Error) => {
    setError(() => {
      throw error
    })
  }, [])
}

// Main ErrorBoundary component export
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorBoundaryClass {...props} />
}

// Default export
export default ErrorBoundary;