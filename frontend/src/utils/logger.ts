// Production-ready logging utility with structured logging support

// Sentry is optional - will be imported dynamically if available
let Sentry: any = null;
try {
  Sentry = require('@sentry/nextjs');
} catch {
  // Sentry not installed yet - that's okay
}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: Error;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private isDevelopment: boolean;
  private isProduction: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logLevel = this.isProduction ? LogLevel.INFO : LogLevel.DEBUG;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: this.sanitizeContext(context),
      error: error ? this.sanitizeError(error) : undefined,
      stack: error?.stack,
    };
  }

  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) return undefined;

    const sanitized: LogContext = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];

    for (const [key, value] of Object.entries(context)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeContext(value as LogContext);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeError(error: Error): any {
    return {
      name: error.name,
      message: error.message,
      stack: this.isProduction ? undefined : error.stack,
    };
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (level < this.logLevel) return;

    const logEntry = this.formatLogEntry(level, message, context, error);

    // In production, send to external logging service
    if (this.isProduction) {
      this.sendToLoggingService(logEntry);
      
      // Send errors to Sentry if available
      if (level >= LogLevel.ERROR && error && Sentry) {
        Sentry.captureException(error, {
          level: level === LogLevel.FATAL ? 'fatal' : 'error',
          contexts: {
            log: context,
          },
        });
      }
    } else {
      // In development, log to console
      this.logToConsole(level, logEntry);
    }

    // Store critical logs locally for debugging
    if (level >= LogLevel.ERROR) {
      this.storeLocalLog(logEntry);
    }
  }

  private logToConsole(level: LogLevel, entry: LogEntry): void {
    const consoleMethod = this.getConsoleMethod(level);
    const formattedMessage = `[${entry.timestamp}] [${entry.level}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      consoleMethod(formattedMessage, entry.context);
    } else {
      consoleMethod(formattedMessage);
    }

    if (entry.error && entry.stack) {
      console.error(entry.stack);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private sendToLoggingService(entry: LogEntry): void {
    // In production, this would send to a service like CloudWatch, Datadog, etc.
    // For now, we'll use a placeholder that could be replaced with actual implementation
    if (typeof window !== 'undefined' && window.fetch) {
      // Client-side logging
      const loggingEndpoint = process.env.NEXT_PUBLIC_LOGGING_ENDPOINT;
      if (loggingEndpoint) {
        fetch(loggingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        }).catch(() => {
          // Silently fail to avoid infinite loops
        });
      }
    } else {
      // Server-side logging
      // Could integrate with Winston, Bunyan, or other Node.js logging libraries
    }
  }

  private storeLocalLog(entry: LogEntry): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const logs = JSON.parse(localStorage.getItem('app_logs') || '[]');
        logs.push(entry);
        
        // Keep only last 50 logs
        if (logs.length > 50) {
          logs.shift();
        }
        
        localStorage.setItem('app_logs', JSON.stringify(logs));
      } catch {
        // Ignore localStorage errors
      }
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  // Performance logging
  time(label: string): void {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }

  // Get stored logs (useful for debugging)
  getStoredLogs(): LogEntry[] {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return JSON.parse(localStorage.getItem('app_logs') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }

  // Clear stored logs
  clearStoredLogs(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('app_logs');
    }
  }

  // Set log level dynamically
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export helper functions for common logging patterns
export const logApiRequest = (
  method: string,
  url: string,
  context?: LogContext
): void => {
  logger.info(`API Request: ${method} ${url}`, {
    ...context,
    type: 'api_request',
    method,
    url,
  });
};

export const logApiResponse = (
  method: string,
  url: string,
  status: number,
  duration: number,
  context?: LogContext
): void => {
  const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
  logger.log(level, `API Response: ${method} ${url} - ${status}`, {
    ...context,
    type: 'api_response',
    method,
    url,
    status,
    duration,
  });
};

export const logPerformance = (
  metric: string,
  value: number,
  context?: LogContext
): void => {
  logger.info(`Performance: ${metric}`, {
    ...context,
    type: 'performance',
    metric,
    value,
  });
};

export const logUserAction = (
  action: string,
  details?: any,
  context?: LogContext
): void => {
  logger.info(`User Action: ${action}`, {
    ...context,
    type: 'user_action',
    action,
    details,
  });
};

// Export for use in error boundaries
export const logErrorBoundary = (
  error: Error,
  errorInfo: any,
  context?: LogContext
): void => {
  logger.error('React Error Boundary', error, {
    ...context,
    type: 'error_boundary',
    componentStack: errorInfo.componentStack,
  });
};