import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

// Security headers that should be applied to all responses
const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Get client identifier for rate limiting
function getClientId(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return ip;
}

// Check rate limit
function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const clientData = rateLimitMap.get(clientId);

  if (!clientData || now > clientData.resetTime) {
    rateLimitMap.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (clientData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  clientData.count++;
  return true;
}

// Clean up expired rate limit entries
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [clientId, data] of rateLimitMap.entries()) {
    if (now > data.resetTime) {
      rateLimitMap.delete(clientId);
    }
  }
}

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  // Add request ID to headers for tracing
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  // Log incoming request
  logger.info('Incoming request', {
    requestId,
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    referer: request.headers.get('referer'),
  });

  // Apply rate limiting
  const clientId = getClientId(request);
  if (!checkRateLimit(clientId)) {
    logger.warn('Rate limit exceeded', {
      requestId,
      clientId,
      url: request.url,
    });

    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': '60',
        ...securityHeaders,
      },
    });
  }

  // Clean up rate limit map periodically
  if (Math.random() < 0.01) {
    cleanupRateLimitMap();
  }

  // Security checks for API routes
  if (request.nextUrl.pathname.startsWith('/api')) {
    // CSRF protection for state-changing methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const csrfToken = request.headers.get('x-csrf-token');
      if (!csrfToken) {
        logger.warn('Missing CSRF token', {
          requestId,
          method: request.method,
          url: request.url,
        });

        return new NextResponse('Forbidden', {
          status: 403,
          headers: securityHeaders,
        });
      }
    }
  }

  // Block requests to sensitive paths
  const blockedPaths = [
    '/.env',
    '/config',
    '/.git',
    '/admin',
    '/wp-admin',
    '/phpmyadmin',
  ];

  if (blockedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    logger.warn('Blocked suspicious request', {
      requestId,
      url: request.url,
      clientId,
    });

    return new NextResponse('Not Found', {
      status: 404,
      headers: securityHeaders,
    });
  }

  // Process the request
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Add security headers to response
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add request ID to response for tracing
  response.headers.set('x-request-id', requestId);

  // Log response
  const duration = Date.now() - startTime;
  logger.info('Response sent', {
    requestId,
    duration,
    status: response.status,
    url: request.url,
  });

  // Log slow requests
  if (duration > 1000) {
    logger.warn('Slow request detected', {
      requestId,
      duration,
      url: request.url,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};