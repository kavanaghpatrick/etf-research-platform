/**
 * @fileoverview Standardized error handling utilities and patterns
 * @description Provides consistent error handling, logging, and recovery mechanisms
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

/** Error severity levels */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/** Error categories for classification */
export type ErrorCategory = 
  | 'network'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'business'
  | 'system'
  | 'unknown';

/** Structured error information */
export interface StructuredError {
  /** Error code for identification */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Error severity level */
  readonly severity: ErrorSeverity;
  /** Error category */
  readonly category: ErrorCategory;
  /** Additional context data */
  readonly context?: Record<string, unknown>;
  /** Original error object */
  readonly originalError?: Error;
  /** Timestamp when error occurred */
  readonly timestamp: string;
  /** Suggested recovery actions */
  readonly recoveryActions?: readonly string[];
}

/** Error handler configuration */
export interface ErrorHandlerConfig {
  /** Whether to log errors */
  readonly enableLogging?: boolean;
  /** Whether to report errors to external service */
  readonly enableReporting?: boolean;
  /** Custom logging function */
  readonly logger?: (error: StructuredError) => void;
  /** Custom error reporter */
  readonly reporter?: (error: StructuredError) => void;
}

/** Result wrapper for operations that can fail */
export type Result<T, E = StructuredError> = 
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

/**
 * Creates a structured error object
 * 
 * @param code - Error code for identification
 * @param message - Human-readable error message
 * @param severity - Error severity level
 * @param category - Error category
 * @param context - Additional context data
 * @param originalError - Original error object
 * @returns Structured error object
 */
export const createStructuredError = (
  code: string,
  message: string,
  severity: ErrorSeverity = 'medium',
  category: ErrorCategory = 'unknown',
  context?: Record<string, unknown>,
  originalError?: Error
): StructuredError => ({
  code,
  message,
  severity,
  category,
  context,
  originalError,
  timestamp: new Date().toISOString(),
  recoveryActions: getRecoveryActions(category, severity),
});

/**
 * Gets suggested recovery actions based on error category and severity
 * 
 * @param category - Error category
 * @param severity - Error severity level
 * @returns Array of suggested recovery actions
 */
const getRecoveryActions = (category: ErrorCategory, severity: ErrorSeverity): readonly string[] => {
  const baseActions = ['Contact support if the problem persists'];
  
  switch (category) {
    case 'network':
      return [
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again',
        ...baseActions,
      ];
    case 'validation':
      return [
        'Check your input values',
        'Ensure all required fields are filled',
        'Verify data formats are correct',
        ...baseActions,
      ];
    case 'authentication':
      return [
        'Please log in again',
        'Check your credentials',
        'Clear browser cache and cookies',
        ...baseActions,
      ];
    case 'authorization':
      return [
        'Contact an administrator for access',
        'Ensure you have the required permissions',
        ...baseActions,
      ];
    case 'business':
      return [
        'Review the operation requirements',
        'Check if all conditions are met',
        ...baseActions,
      ];
    case 'system':
      return severity === 'critical' 
        ? ['System maintenance may be in progress', ...baseActions]
        : ['Try again in a few minutes', ...baseActions];
    default:
      return baseActions;
  }
};

/**
 * Default error handler configuration
 */
const defaultConfig: Required<ErrorHandlerConfig> = {
  enableLogging: true,
  enableReporting: process.env.NODE_ENV === 'production',
  logger: (error: StructuredError) => {
    const logLevel = error.severity === 'critical' || error.severity === 'high' ? 'error' : 'warn';
    console[logLevel]('Structured Error:', error);
  },
  reporter: (error: StructuredError) => {
    // In a real app, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry, LogRocket, etc.
      console.error('Error Report:', error);
    }
  },
};

/**
 * Global error handler with configurable behavior
 */
export class ErrorHandler {
  private config: Required<ErrorHandlerConfig>;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Handles a structured error
   * 
   * @param error - Structured error to handle
   */
  handle(error: StructuredError): void {
    if (this.config.enableLogging) {
      this.config.logger(error);
    }

    if (this.config.enableReporting && (error.severity === 'high' || error.severity === 'critical')) {
      this.config.reporter(error);
    }
  }

  /**
   * Creates and handles an error from basic parameters
   * 
   * @param code - Error code
   * @param message - Error message
   * @param severity - Error severity
   * @param category - Error category
   * @param context - Additional context
   * @param originalError - Original error object
   * @returns Structured error object
   */
  createAndHandle(
    code: string,
    message: string,
    severity: ErrorSeverity = 'medium',
    category: ErrorCategory = 'unknown',
    context?: Record<string, unknown>,
    originalError?: Error
  ): StructuredError {
    const error = createStructuredError(code, message, severity, category, context, originalError);
    this.handle(error);
    return error;
  }
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Wraps an async function to return a Result type
 * 
 * @param fn - Async function to wrap
 * @returns Function that returns Result<T>
 */
export const wrapAsync = <T, A extends readonly unknown[]>(
  fn: (...args: A) => Promise<T>
) => {
  return async (...args: A): Promise<Result<T>> => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      const structuredError = error instanceof Error
        ? createStructuredError(
            'ASYNC_OPERATION_FAILED',
            error.message,
            'medium',
            'system',
            { functionName: fn.name },
            error
          )
        : createStructuredError(
            'UNKNOWN_ASYNC_ERROR',
            'An unknown error occurred',
            'medium',
            'unknown',
            { functionName: fn.name }
          );
      
      globalErrorHandler.handle(structuredError);
      return { success: false, error: structuredError };
    }
  };
};

/**
 * Wraps a sync function to return a Result type
 * 
 * @param fn - Sync function to wrap
 * @returns Function that returns Result<T>
 */
export const wrapSync = <T, A extends readonly unknown[]>(
  fn: (...args: A) => T
) => {
  return (...args: A): Result<T> => {
    try {
      const data = fn(...args);
      return { success: true, data };
    } catch (error) {
      const structuredError = error instanceof Error
        ? createStructuredError(
            'SYNC_OPERATION_FAILED',
            error.message,
            'medium',
            'system',
            { functionName: fn.name },
            error
          )
        : createStructuredError(
            'UNKNOWN_SYNC_ERROR',
            'An unknown error occurred',
            'medium',
            'unknown',
            { functionName: fn.name }
          );
      
      globalErrorHandler.handle(structuredError);
      return { success: false, error: structuredError };
    }
  };
};

/**
 * Common error codes for the application
 */
export const ErrorCodes = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  SERVER_ERROR: 'SERVER_ERROR',
  
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  
  // Business logic errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  OPERATION_NOT_ALLOWED: 'OPERATION_NOT_ALLOWED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // System errors
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
} as const;

/**
 * Utility functions for common error scenarios
 */
export const ErrorUtils = {
  /**
   * Creates a network error
   */
  networkError: (message: string, context?: Record<string, unknown>) =>
    createStructuredError(ErrorCodes.NETWORK_ERROR, message, 'high', 'network', context),

  /**
   * Creates a validation error
   */
  validationError: (message: string, context?: Record<string, unknown>) =>
    createStructuredError(ErrorCodes.INVALID_INPUT, message, 'low', 'validation', context),

  /**
   * Creates an authentication error
   */
  authError: (message: string, context?: Record<string, unknown>) =>
    createStructuredError(ErrorCodes.UNAUTHORIZED, message, 'medium', 'authentication', context),

  /**
   * Creates a system error
   */
  systemError: (message: string, context?: Record<string, unknown>) =>
    createStructuredError(ErrorCodes.SYSTEM_ERROR, message, 'critical', 'system', context),
};