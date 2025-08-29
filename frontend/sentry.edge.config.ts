// Sentry configuration for edge runtime (middleware)
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_ENV || 'development';

// Initialize Sentry only in production
if (SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    
    // Performance Monitoring (lower rate for edge)
    tracesSampleRate: 0.05, // 5% of transactions
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown',
    
    // Edge-specific settings
    autoSessionTracking: false,
    
    // Error filtering for edge runtime
    ignoreErrors: [
      'EdgeRuntimeError',
      'FetchError',
    ],
    
    // Before send hook for data sanitization
    beforeSend(event, hint) {
      // Add edge runtime context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'edge',
        },
      };
      
      // Remove sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sensitiveHeaders.forEach(header => {
          delete event.request.headers[header];
        });
      }
      
      return event;
    },
    
    // Minimal integrations for edge runtime
    integrations: [
      // Basic HTTP integration
      Sentry.httpIntegration({
        tracing: true,
      }),
    ],
    
    // Transport options
    transportOptions: {
      // Edge runtime specific timeout
      timeout: 5000,
    },
    
    // Debugging
    debug: false,
  });
}