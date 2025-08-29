// Sentry configuration for server-side error tracking
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.NEXT_PUBLIC_ENV || 'development';

// Initialize Sentry only in production
if (SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    
    // Performance Monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Enable profiling
    profilesSampleRate: 0.1, // 10% of transactions
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown',
    
    // Server-specific settings
    autoSessionTracking: false,
    
    // Error filtering
    ignoreErrors: [
      // Common non-actionable errors
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EPIPE',
      'ENOTFOUND',
    ],
    
    // Before send hook for data sanitization
    beforeSend(event, hint) {
      // Remove sensitive server data
      if (event.server_name) {
        event.server_name = 'redacted';
      }
      
      // Sanitize environment variables
      if (event.extra?.env) {
        const sensitiveEnvVars = [
          'DATABASE_URL',
          'API_SECRET_KEY',
          'JWT_SECRET',
          'SENTRY_AUTH_TOKEN',
        ];
        
        sensitiveEnvVars.forEach(key => {
          if (event.extra.env[key]) {
            event.extra.env[key] = '[REDACTED]';
          }
        });
      }
      
      // Add server context
      event.contexts = {
        ...event.contexts,
        runtime: {
          name: 'node',
          version: process.version,
        },
        app: {
          app_memory: process.memoryUsage().heapUsed,
        },
      };
      
      return event;
    },
    
    // Integrations
    integrations: [
      // HTTP instrumentation
      Sentry.httpIntegration({
        tracing: true,
        breadcrumbs: true,
      }),
      
      // Capture console errors
      Sentry.captureConsoleIntegration({
        levels: ['error', 'warn'],
      }),
      
      // Node profiling
      Sentry.nodeProfilingIntegration(),
    ],
    
    // Transport options
    transportOptions: {
      // Increase timeout for server environments
      timeout: 10000,
    },
    
    // Debugging
    debug: false,
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.type === 'http' && breadcrumb.data?.status_code < 400) {
        return null;
      }
      
      // Sanitize database queries
      if (breadcrumb.category === 'db') {
        if (breadcrumb.data?.query) {
          breadcrumb.data.query = '[QUERY REDACTED]';
        }
      }
      
      return breadcrumb;
    },
  });
}