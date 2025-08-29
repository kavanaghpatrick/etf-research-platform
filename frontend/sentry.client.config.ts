// Sentry configuration for client-side error tracking
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
    
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Release tracking
    release: process.env.NEXT_PUBLIC_BUILD_VERSION || 'unknown',
    
    // Error filtering
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      
      // Network errors
      'Network request failed',
      'NetworkError',
      'Failed to fetch',
      
      // Third-party scripts
      /graph\.facebook\.com/i,
      /connect\.facebook\.net/i,
      /google-analytics\.com/i,
      /googletagmanager\.com/i,
    ],
    
    // Deny list for sensitive data
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      // Firefox extensions
      /^moz-extension:\/\//i,
      // Safari extensions
      /^safari-extension:\/\//i,
    ],
    
    // Before send hook for data sanitization
    beforeSend(event, hint) {
      // Filter out non-actionable errors
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
        return null;
      }
      
      // Sanitize sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      
      // Remove potentially sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sensitiveHeaders.forEach(header => {
          delete event.request.headers[header];
        });
      }
      
      // Add user context if available
      if (typeof window !== 'undefined' && window.localStorage) {
        const userId = window.localStorage.getItem('userId');
        if (userId) {
          event.user = { id: userId };
        }
      }
      
      return event;
    },
    
    // Integrations
    integrations: [
      // Browser tracing
      Sentry.browserTracingIntegration({
        // Trace navigation
        enableInp: true,
        // Custom transaction names
        beforeStartSpan: (context) => {
          // Sanitize URLs containing IDs
          if (context.attributes?.['http.url']) {
            context.attributes['http.url'] = context.attributes['http.url']
              .replace(/\/stock\/[^\/]+/, '/stock/[symbol]')
              .replace(/\/api\/[^\/]+/, '/api/[endpoint]');
          }
          return context;
        },
      }),
      
      // Session replay
      Sentry.replayIntegration({
        // Mask sensitive content
        maskAllText: false,
        maskAllInputs: true,
        
        // Block sensitive elements
        blockAllMedia: false,
        
        // Privacy settings
        blockSelector: '.sensitive,[data-sensitive]',
        maskTextSelector: '.mask-text,[data-mask]',
        
        // Network recording
        networkDetailAllowUrls: [window.location.origin],
        networkCaptureBodies: false,
        networkRequestHeaders: ['Content-Type'],
        networkResponseHeaders: ['Content-Type'],
      }),
    ],
    
    // Transport options
    transportOptions: {
      // Retry failed requests
      fetchParameters: {
        keepalive: true,
      },
    },
    
    // Debugging
    debug: false,
    
    // Auto session tracking
    autoSessionTracking: true,
    
    // Breadcrumbs configuration
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null;
      }
      
      // Sanitize fetch breadcrumbs
      if (breadcrumb.category === 'fetch') {
        if (breadcrumb.data?.url) {
          breadcrumb.data.url = breadcrumb.data.url
            .replace(/\/stock\/[^\/]+/, '/stock/[symbol]')
            .replace(/api_key=[^&]+/, 'api_key=[REDACTED]');
        }
      }
      
      return breadcrumb;
    },
  });
}