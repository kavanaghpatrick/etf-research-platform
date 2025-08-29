/**
 * Security Testing Suite
 * Comprehensive tests for security utilities and protections
 */

import { 
  sanitizeInput, 
  sanitizeSQLInput,
  CSRFTokenManager,
  RateLimiter,
  InputValidation,
  SecurityLogger,
  detectSecurityThreats,
  generateSecureRandomString,
  checkPasswordStrength,
  generateCSPHeader
} from '../security-runtime';

describe('Security Utilities', () => {
  describe('Input Sanitization', () => {
    describe('sanitizeInput', () => {
      it('should escape HTML entities', () => {
        expect(sanitizeInput('<script>alert("XSS")</script>')).toBe(
          '&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;'
        );
      });

      it('should handle special characters', () => {
        expect(sanitizeInput('Test & "quoted" <tag>')).toBe(
          'Test &amp; &quot;quoted&quot; &lt;tag&gt;'
        );
      });

      it('should handle empty input', () => {
        expect(sanitizeInput('')).toBe('');
        expect(sanitizeInput(null as any)).toBe('');
        expect(sanitizeInput(undefined as any)).toBe('');
      });

      it('should prevent XSS attacks', () => {
        const xssAttempts = [
          '<img src=x onerror=alert(1)>',
          '<svg onload=alert(1)>',
          'javascript:alert(1)',
          '<iframe src="javascript:alert(1)">',
          '<body onload=alert(1)>'
        ];

        xssAttempts.forEach(attempt => {
          const sanitized = sanitizeInput(attempt);
          expect(sanitized).not.toContain('<');
          expect(sanitized).not.toContain('>');
        });
      });
    });

    describe('sanitizeSQLInput', () => {
      it('should remove SQL keywords', () => {
        expect(sanitizeSQLInput('SELECT * FROM users')).toBe('* FROM users');
        expect(sanitizeSQLInput('1 OR 1=1')).toBe('1');
        expect(sanitizeSQLInput('DROP TABLE users')).toBe('TABLE users');
      });

      it('should remove SQL comments', () => {
        expect(sanitizeSQLInput('value -- comment')).toBe('value  comment');
        expect(sanitizeSQLInput('value /* comment */')).toBe('value');
      });

      it('should handle complex SQL injection attempts', () => {
        const attempts = [
          "1' OR '1'='1",
          "admin'--",
          "1; DROP TABLE users",
          "1 UNION SELECT * FROM passwords"
        ];

        attempts.forEach(attempt => {
          const sanitized = sanitizeSQLInput(attempt);
          expect(sanitized).not.toMatch(/union|select|drop/i);
        });
      });
    });
  });

  describe('CSRF Token Manager', () => {
    beforeEach(() => {
      // Reset token manager
      CSRFTokenManager.generateToken();
    });

    it('should generate unique tokens', () => {
      const token1 = CSRFTokenManager.generateToken();
      const token2 = CSRFTokenManager.generateToken();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes * 2 hex chars
    });

    it('should validate correct tokens', () => {
      const token = CSRFTokenManager.generateToken();
      expect(CSRFTokenManager.validateToken(token)).toBe(true);
    });

    it('should reject invalid tokens', () => {
      CSRFTokenManager.generateToken();
      expect(CSRFTokenManager.validateToken('invalid-token')).toBe(false);
    });
  });

  describe('Rate Limiter', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter(3, 1000);
      const identifier = 'test-user';

      expect(limiter.isAllowed(identifier)).toBe(true);
      expect(limiter.isAllowed(identifier)).toBe(true);
      expect(limiter.isAllowed(identifier)).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter(2, 1000);
      const identifier = 'test-user';

      expect(limiter.isAllowed(identifier)).toBe(true);
      expect(limiter.isAllowed(identifier)).toBe(true);
      expect(limiter.isAllowed(identifier)).toBe(false);
    });

    it('should reset after time window', async () => {
      const limiter = new RateLimiter(1, 100);
      const identifier = 'test-user';

      expect(limiter.isAllowed(identifier)).toBe(true);
      expect(limiter.isAllowed(identifier)).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(limiter.isAllowed(identifier)).toBe(true);
    });
  });

  describe('Input Validation', () => {
    describe('Email validation', () => {
      it('should validate correct emails', () => {
        expect(InputValidation.isValidEmail('test@example.com')).toBe(true);
        expect(InputValidation.isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(InputValidation.isValidEmail('invalid')).toBe(false);
        expect(InputValidation.isValidEmail('@example.com')).toBe(false);
        expect(InputValidation.isValidEmail('test@')).toBe(false);
      });
    });

    describe('URL validation', () => {
      it('should validate correct URLs', () => {
        expect(InputValidation.isValidURL('https://example.com')).toBe(true);
        expect(InputValidation.isValidURL('http://localhost:3000')).toBe(true);
      });

      it('should reject invalid URLs', () => {
        expect(InputValidation.isValidURL('not-a-url')).toBe(false);
        expect(InputValidation.isValidURL('javascript:alert(1)')).toBe(false);
      });
    });

    describe('Ticker validation', () => {
      it('should validate correct tickers', () => {
        expect(InputValidation.isValidTicker('AAPL')).toBe(true);
        expect(InputValidation.isValidTicker('MSFT')).toBe(true);
        expect(InputValidation.isValidTicker('A')).toBe(true);
      });

      it('should reject invalid tickers', () => {
        expect(InputValidation.isValidTicker('123')).toBe(false);
        expect(InputValidation.isValidTicker('TOOLONGticker')).toBe(false);
        expect(InputValidation.isValidTicker('')).toBe(false);
      });
    });
  });

  describe('Security Threat Detection', () => {
    it('should detect SQL injection in URL', () => {
      const threats = detectSecurityThreats({
        url: '/api/data?id=1 UNION SELECT * FROM users'
      });
      expect(threats).toContain('Potential SQL injection in URL');
    });

    it('should detect XSS in request body', () => {
      const threats = detectSecurityThreats({
        body: '<script>alert("XSS")</script>'
      });
      expect(threats).toContain('Potential XSS attempt in request body');
    });

    it('should detect suspicious proxy chains', () => {
      const threats = detectSecurityThreats({
        headers: {
          'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3, 4.4.4.4, 5.5.5.5, 6.6.6.6'
        }
      });
      expect(threats).toContain('Suspicious proxy chain detected');
    });

    it('should return empty array for safe requests', () => {
      const threats = detectSecurityThreats({
        url: '/api/data?id=123',
        body: { name: 'John Doe' },
        headers: { 'content-type': 'application/json' }
      });
      expect(threats).toHaveLength(0);
    });
  });

  describe('Password Strength Checker', () => {
    it('should score weak passwords low', () => {
      const result = checkPasswordStrength('password');
      expect(result.score).toBeLessThan(0.5);
      expect(result.feedback).toContain('Add uppercase letters');
      expect(result.feedback).toContain('Add numbers');
      expect(result.feedback).toContain('Add special characters');
    });

    it('should score strong passwords high', () => {
      const result = checkPasswordStrength('Str0ng!P@ssw0rd123');
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.feedback).toHaveLength(0);
    });

    it('should provide appropriate feedback', () => {
      const result = checkPasswordStrength('short');
      expect(result.feedback).toContain('Password should be at least 8 characters');
    });
  });

  describe('Secure Random String Generator', () => {
    it('should generate strings of correct length', () => {
      expect(generateSecureRandomString(16).length).toBe(32); // 16 bytes * 2 hex chars
      expect(generateSecureRandomString(32).length).toBe(64);
    });

    it('should generate unique strings', () => {
      const strings = new Set();
      for (let i = 0; i < 100; i++) {
        strings.add(generateSecureRandomString());
      }
      expect(strings.size).toBe(100);
    });
  });

  describe('CSP Header Generation', () => {
    it('should generate valid CSP header', () => {
      const csp = generateCSPHeader();
      expect(csp).toContain('default-src');
      expect(csp).toContain('script-src');
      expect(csp).toContain('style-src');
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('should include all configured directives', () => {
      const csp = generateCSPHeader();
      expect(csp).toMatch(/default-src\s+'self'/);
      expect(csp).toMatch(/object-src\s+'none'/);
      expect(csp).toMatch(/frame-src\s+'none'/);
    });
  });

  describe('Security Logger', () => {
    beforeEach(() => {
      SecurityLogger.clearLogs();
    });

    it('should log security events', () => {
      SecurityLogger.log('warning', 'Suspicious activity detected', { ip: '1.2.3.4' });
      const logs = SecurityLogger.getLogs();
      
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('warning');
      expect(logs[0].message).toBe('Suspicious activity detected');
      expect(logs[0].details).toEqual({ ip: '1.2.3.4' });
    });

    it('should maintain log history', () => {
      SecurityLogger.log('info', 'Event 1');
      SecurityLogger.log('error', 'Event 2');
      SecurityLogger.log('warning', 'Event 3');

      const logs = SecurityLogger.getLogs();
      expect(logs).toHaveLength(3);
    });

    it('should clear logs', () => {
      SecurityLogger.log('info', 'Test event');
      expect(SecurityLogger.getLogs()).toHaveLength(1);
      
      SecurityLogger.clearLogs();
      expect(SecurityLogger.getLogs()).toHaveLength(0);
    });
  });
});