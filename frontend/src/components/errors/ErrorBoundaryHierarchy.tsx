/**
 * @fileoverview Advanced error boundary hierarchy with recovery mechanisms
 * @description Provides a comprehensive error handling system with different levels of error boundaries
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

'use client';

import React, { Component, ReactNode, ErrorInfo } from 'react';

/** Error severity levels */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Error boundary configuration */
export interface ErrorBoundaryConfig {
  /** Error severity level */
  readonly severity: ErrorSeverity;
  /** Custom fallback component */
  readonly fallback?: React.ComponentType<ErrorFallbackProps>;
  /** Whether to enable error reporting */
  readonly enableReporting?: boolean;
  /** Custom error reporting function */
  readonly onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show retry functionality */
  readonly showRetry?: boolean;
  /** Component context name for error reporting */
  readonly context?: string;
}

/** Props for error fallback components */
export interface ErrorFallbackProps {
  /** The error that occurred */
  readonly error: Error;
  /** React error info */
  readonly errorInfo: ErrorInfo;
  /** Function to reset the error boundary */
  readonly resetError: () => void;
  /** Error severity level */
  readonly severity: ErrorSeverity;
  /** Component context */
  readonly context?: string;
}

/** Error boundary state */
interface ErrorBoundaryState {
  /** Whether an error has occurred */
  hasError: boolean;
  /** The error object */
  error: Error | null;
  /** React error info */
  errorInfo: ErrorInfo | null;
  /** Error occurrence timestamp */
  timestamp: number;
  /** Number of retry attempts */
  retryCount: number;
}

/** Maximum retry attempts before showing permanent error */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Reports error to logging service
 * 
 * @param error - Error object
 * @param errorInfo - React error info
 * @param severity - Error severity level
 * @param context - Component context
 */
const reportError = (
  error: Error,
  errorInfo: ErrorInfo,
  severity: ErrorSeverity,
  context?: string
): void => {
  const errorReport = {
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack,
    severity,
    context,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
  };

  // In a real app, send to error reporting service
  console.error('Error Boundary Report:', errorReport);

  // Example: Send to external service
  // if (process.env.NODE_ENV === 'production') {
  //   sendToErrorReportingService(errorReport);
  // }
};

/**
 * Advanced error boundary with configurable severity levels and recovery
 */
export class AdvancedErrorBoundary extends Component<
  ErrorBoundaryConfig & { children: ReactNode },
  ErrorBoundaryState
> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryConfig & { children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      timestamp: 0,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      timestamp: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Report error if enabled
    if (this.props.enableReporting !== false) {
      reportError(error, errorInfo, this.props.severity, this.props.context);
    }

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  private resetError = (): void => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));
  };

  private handleRetry = (): void => {
    if (this.state.retryCount < MAX_RETRY_ATTEMPTS) {
      this.resetError();
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      const { fallback: CustomFallback } = this.props;

      if (CustomFallback) {
        return (
          <CustomFallback
            error={this.state.error}
            errorInfo={this.state.errorInfo}
            resetError={this.resetError}
            severity={this.props.severity}
            context={this.props.context}
          />
        );
      }

      // Default fallback based on severity
      return this.renderDefaultFallback();
    }

    return this.props.children;
  }

  private renderDefaultFallback(): ReactNode {
    const { severity, showRetry = true, context } = this.props;
    const { error, retryCount } = this.state;
    const canRetry = showRetry && retryCount < MAX_RETRY_ATTEMPTS;

    const severityConfig = {
      low: {
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        iconColor: 'text-yellow-500',
        titleColor: 'text-yellow-800',
        textColor: 'text-yellow-700',
        icon: '⚠️',
        title: 'Minor Issue',
      },
      medium: {
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        iconColor: 'text-orange-500',
        titleColor: 'text-orange-800',
        textColor: 'text-orange-700',
        icon: '🔧',
        title: 'Component Error',
      },
      high: {
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        iconColor: 'text-red-500',
        titleColor: 'text-red-800',
        textColor: 'text-red-700',
        icon: '🚨',
        title: 'Serious Error',
      },
      critical: {
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
        iconColor: 'text-red-600',
        titleColor: 'text-red-900',
        textColor: 'text-red-800',
        icon: '💥',
        title: 'Critical Failure',
      },
    };

    const config = severityConfig[severity];

    return (
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-6 m-4`}>
        <div className="flex items-start">
          <div className={`${config.iconColor} text-2xl mr-3 mt-1`}>
            {config.icon}
          </div>
          <div className="flex-1">
            <h3 className={`${config.titleColor} text-lg font-medium mb-2`}>
              {config.title}
              {context && <span className="text-sm font-normal"> in {context}</span>}
            </h3>
            <p className={`${config.textColor} text-sm mb-4`}>
              {severity === 'low' || severity === 'medium'
                ? 'This component encountered an issue but the rest of the application should work normally.'
                : 'A serious error occurred that prevented this component from rendering properly.'}
            </p>
            {process.env.NODE_ENV === 'development' && (
              <details className={`${config.textColor} text-xs mb-4`}>
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details (Development)
                </summary>
                <pre className="whitespace-pre-wrap font-mono bg-white p-2 rounded border">
                  {error?.message}
                  {error?.stack && `\n\nStack trace:\n${error.stack}`}
                </pre>
              </details>
            )}
            <div className="flex space-x-3">
              {canRetry && (
                <button
                  onClick={this.handleRetry}
                  className="bg-white px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Try Again ({MAX_RETRY_ATTEMPTS - retryCount} attempts left)
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * High-level application error boundary
 */
export const AppErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <AdvancedErrorBoundary
    severity="critical"
    context="Application"
    enableReporting={true}
    showRetry={true}
  >
    {children}
  </AdvancedErrorBoundary>
);

/**
 * Page-level error boundary
 */
export const PageErrorBoundary: React.FC<{ children: ReactNode; pageName?: string }> = ({ 
  children, 
  pageName = 'Page' 
}) => (
  <AdvancedErrorBoundary
    severity="high"
    context={pageName}
    enableReporting={true}
    showRetry={true}
  >
    {children}
  </AdvancedErrorBoundary>
);

/**
 * Component-level error boundary
 */
export const ComponentErrorBoundary: React.FC<{ 
  children: ReactNode; 
  componentName?: string;
  severity?: ErrorSeverity;
}> = ({ 
  children, 
  componentName = 'Component',
  severity = 'medium'
}) => (
  <AdvancedErrorBoundary
    severity={severity}
    context={componentName}
    enableReporting={true}
    showRetry={true}
  >
    {children}
  </AdvancedErrorBoundary>
);

/**
 * Widget-level error boundary for non-critical components
 */
export const WidgetErrorBoundary: React.FC<{ 
  children: ReactNode; 
  widgetName?: string;
}> = ({ 
  children, 
  widgetName = 'Widget'
}) => (
  <AdvancedErrorBoundary
    severity="low"
    context={widgetName}
    enableReporting={false}
    showRetry={true}
  >
    {children}
  </AdvancedErrorBoundary>
);