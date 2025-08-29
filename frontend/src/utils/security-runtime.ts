/**
 * Runtime Security Utilities
 * Provides runtime security checks and protections for the ETF Research Platform
 */

/**
 * Content Security Policy configuration
 */
export const CSP_CONFIG = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Note: unsafe-eval should be removed in production
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"],
  sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
  reportUri: '/api/csp-report',
  upgradeInsecureRequests: true
};

/**
 * Generate CSP header string
 */
export function generateCSPHeader(): string {
  const directives = Object.entries(CSP_CONFIG).map(([key, value]) => {
    if (key === 'upgradeInsecureRequests' && value) {
      return 'upgrade-insecure-requests';
    }
    if (Array.isArray(value)) {
      return `${key.replace(/([A-Z])/g, '-$1').toLowerCase()} ${value.join(' ')}`;
    }
    return `${key.replace(/([A-Z])/g, '-$1').toLowerCase()} ${value}`;
  });

  return directives.join('; ');
}

/**
 * XSS Protection: Sanitize user input
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';

  // Basic HTML entity encoding
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * SQL Injection Protection: Validate and sanitize SQL-like inputs
 */
export function sanitizeSQLInput(input: string): string {
  if (!input) return '';

  // Remove common SQL injection patterns
  const sqlPatterns = [
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/gi,
    /(--|#|\/\*|\*\/)/g,
    /(\bor\b\s*\d+\s*=\s*\d+)/gi,
    /(\band\b\s*\d+\s*=\s*\d+)/gi
  ];

  let sanitized = input;
  sqlPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });

  return sanitized.trim();
}

/**
 * CSRF Token Management
 */
export class CSRFTokenManager {
  private static token: string | null = null;

  static generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    this.token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    return this.token;
  }

  static validateToken(token: string): boolean {
    return this.token !== null && this.token === token;
  }

  static getToken(): string | null {
    return this.token;
  }
}

/**
 * Rate Limiting for API calls
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    
    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }
}

/**
 * Secure cookie options
 */
export const SECURE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 86400 // 24 hours
};

/**
 * Input validation utilities
 */
export const InputValidation = {
  /**
   * Validate email format
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate URL format
   */
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate ticker symbol
   */
  isValidTicker(ticker: string): boolean {
    const tickerRegex = /^[A-Z]{1,10}$/;
    return tickerRegex.test(ticker.toUpperCase());
  },

  /**
   * Validate numeric input
   */
  isValidNumber(value: string): boolean {
    return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
  },

  /**
   * Validate date format
   */
  isValidDate(date: string): boolean {
    const parsed = Date.parse(date);
    return !isNaN(parsed);
  }
};

/**
 * Security event logger
 */
export class SecurityLogger {
  private static logs: Array<{
    timestamp: number;
    type: string;
    message: string;
    details?: any;
  }> = [];

  static log(type: 'warning' | 'error' | 'info', message: string, details?: any): void {
    const entry = {
      timestamp: Date.now(),
      type,
      message,
      details
    };

    this.logs.push(entry);

    // In production, send to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Implement actual security monitoring service integration
      console.warn('[Security Event]', entry);
    } else {
      console.log('[Security Event]', entry);
    }
  }

  static getLogs(): typeof SecurityLogger.logs {
    return [...this.logs];
  }

  static clearLogs(): void {
    this.logs = [];
  }
}

/**
 * Detect potential security threats
 */
export function detectSecurityThreats(request: {
  url?: string;
  headers?: Record<string, string>;
  body?: any;
}): string[] {
  const threats: string[] = [];

  // Check for SQL injection attempts
  if (request.url && /(\b(union|select|drop|delete)\b)/i.test(request.url)) {
    threats.push('Potential SQL injection in URL');
  }

  // Check for XSS attempts
  if (request.body && typeof request.body === 'string') {
    if (/<script|javascript:|onerror=/i.test(request.body)) {
      threats.push('Potential XSS attempt in request body');
    }
  }

  // Check for suspicious headers
  if (request.headers) {
    if (request.headers['x-forwarded-for']?.split(',').length > 5) {
      threats.push('Suspicious proxy chain detected');
    }
  }

  return threats;
}

/**
 * Secure random string generator
 */
export function generateSecureRandomString(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Password strength checker
 */
export function checkPasswordStrength(password: string): {
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('Password should be at least 8 characters');

  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add numbers');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('Add special characters');

  return { score: Math.min(score / 6, 1), feedback };
}

/**
 * Session timeout manager
 */
export class SessionTimeoutManager {
  private static timeoutId: NodeJS.Timeout | null = null;
  private static lastActivity: number = Date.now();
  private static readonly TIMEOUT_DURATION = 30 * 60 * 1000; // 30 minutes

  static resetTimeout(onTimeout: () => void): void {
    this.lastActivity = Date.now();
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      SecurityLogger.log('info', 'Session timeout triggered');
      onTimeout();
    }, this.TIMEOUT_DURATION);
  }

  static getTimeRemaining(): number {
    const elapsed = Date.now() - this.lastActivity;
    return Math.max(0, this.TIMEOUT_DURATION - elapsed);
  }

  static clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Export all security utilities
 */
export const SecurityUtils = {
  sanitizeInput,
  sanitizeSQLInput,
  CSRFTokenManager,
  RateLimiter,
  InputValidation,
  SecurityLogger,
  detectSecurityThreats,
  generateSecureRandomString,
  checkPasswordStrength,
  SessionTimeoutManager,
  generateCSPHeader,
  SECURE_COOKIE_OPTIONS
};