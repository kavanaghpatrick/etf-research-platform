#!/usr/bin/env node

/**
 * Comprehensive Security Audit Script for ETF Research Platform
 * Performs systematic security testing across multiple categories
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Security audit configuration
const SECURITY_AUDIT_CONFIG = {
  timestamp: new Date().toISOString(),
  projectRoot: path.resolve(__dirname, '..'),
  reportPath: path.join(__dirname, '..', 'SECURITY_AUDIT_REPORT.md'),
  categories: [
    'dependencies',
    'configuration',
    'headers',
    'content',
    'authentication',
    'dataHandling',
    'compliance'
  ]
};

// Severity levels
const SEVERITY = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Informational'
};

// Initialize audit results
const auditResults = {
  summary: {
    totalVulnerabilities: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    passedChecks: 0,
    failedChecks: 0
  },
  findings: [],
  recommendations: [],
  compliance: {
    owaspTop10: {},
    securityHeaders: {},
    dataProtection: {}
  }
};

/**
 * Log message with timestamp
 */
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'warning' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Add finding to audit results
 */
function addFinding(category, title, severity, description, remediation, cwe = null) {
  const finding = {
    id: `SEC-${auditResults.findings.length + 1}`,
    category,
    title,
    severity,
    description,
    remediation,
    cwe,
    timestamp: new Date().toISOString()
  };

  auditResults.findings.push(finding);
  auditResults.summary.totalVulnerabilities++;
  auditResults.summary[severity.toLowerCase()]++;
  auditResults.summary.failedChecks++;

  log(`Found ${severity} vulnerability: ${title}`, 'warning');
}

/**
 * Mark check as passed
 */
function passCheck(category, checkName) {
  auditResults.summary.passedChecks++;
  log(`Passed: ${category} - ${checkName}`, 'success');
}

/**
 * 1. Dependency Vulnerability Scanning
 */
function scanDependencies() {
  log('Starting dependency vulnerability scan...');
  
  try {
    // Run npm audit
    const auditOutput = execSync('npm audit --json', { 
      cwd: SECURITY_AUDIT_CONFIG.projectRoot,
      encoding: 'utf8'
    });
    
    const auditData = JSON.parse(auditOutput);
    
    if (auditData.vulnerabilities) {
      Object.entries(auditData.vulnerabilities).forEach(([pkg, vuln]) => {
        if (vuln.severity === 'critical' || vuln.severity === 'high') {
          addFinding(
            'dependencies',
            `Vulnerable package: ${pkg}`,
            vuln.severity === 'critical' ? SEVERITY.CRITICAL : SEVERITY.HIGH,
            `Package ${pkg} has known vulnerabilities: ${vuln.via.map(v => v.title || v).join(', ')}`,
            `Update ${pkg} to a patched version or find an alternative package`,
            'CWE-1035'
          );
        }
      });
    }

    // Check for outdated packages
    try {
      const outdatedOutput = execSync('npm outdated --json', {
        cwd: SECURITY_AUDIT_CONFIG.projectRoot,
        encoding: 'utf8'
      });
      
      if (outdatedOutput) {
        const outdated = JSON.parse(outdatedOutput);
        const criticalPackages = ['react', 'next', 'react-dom'];
        
        Object.entries(outdated).forEach(([pkg, info]) => {
          if (criticalPackages.includes(pkg) && info.current !== info.wanted) {
            addFinding(
              'dependencies',
              `Outdated critical package: ${pkg}`,
              SEVERITY.MEDIUM,
              `Package ${pkg} is outdated (current: ${info.current}, latest: ${info.latest})`,
              `Update ${pkg} to the latest version to ensure security patches are applied`,
              'CWE-1104'
            );
          }
        });
      }
    } catch (e) {
      // npm outdated returns non-zero exit code if packages are outdated
      log('Some packages are outdated', 'warning');
    }

    passCheck('dependencies', 'Dependency scanning completed');
  } catch (error) {
    log(`Error scanning dependencies: ${error.message}`, 'error');
  }
}

/**
 * 2. Configuration Security Checks
 */
function checkConfiguration() {
  log('Checking security configuration...');

  // Check Next.js configuration
  const nextConfigPath = path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'next.config.ts');
  if (fs.existsSync(nextConfigPath)) {
    const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');

    // Check for security headers
    if (!nextConfig.includes('X-Frame-Options')) {
      addFinding(
        'configuration',
        'Missing X-Frame-Options header',
        SEVERITY.MEDIUM,
        'X-Frame-Options header is not configured, making the application vulnerable to clickjacking',
        'Add X-Frame-Options: DENY or SAMEORIGIN to security headers',
        'CWE-1021'
      );
    } else {
      passCheck('configuration', 'X-Frame-Options header configured');
    }

    // Check for CSP
    if (!nextConfig.includes('Content-Security-Policy')) {
      addFinding(
        'configuration',
        'Missing Content Security Policy',
        SEVERITY.HIGH,
        'Content Security Policy (CSP) is not configured, increasing XSS vulnerability',
        'Implement a strict Content Security Policy',
        'CWE-1021'
      );
    }

    // Check for HTTPS enforcement
    if (!nextConfig.includes('Strict-Transport-Security')) {
      addFinding(
        'configuration',
        'Missing HSTS header',
        SEVERITY.HIGH,
        'Strict-Transport-Security header is not configured',
        'Add Strict-Transport-Security header with appropriate max-age',
        'CWE-523'
      );
    }

    passCheck('configuration', 'Configuration security check completed');
  }

  // Check environment variable usage
  const srcFiles = getAllFiles(path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'src'));
  let hardcodedSecrets = 0;

  srcFiles.forEach(file => {
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for hardcoded API keys or secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi,
        /secret\s*[:=]\s*["'][^"']+["']/gi,
        /password\s*[:=]\s*["'][^"']+["']/gi,
        /token\s*[:=]\s*["'][^"']+["']/gi
      ];

      secretPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          hardcodedSecrets++;
          addFinding(
            'configuration',
            `Potential hardcoded secret in ${path.relative(SECURITY_AUDIT_CONFIG.projectRoot, file)}`,
            SEVERITY.CRITICAL,
            'Hardcoded secrets detected in source code',
            'Move all secrets to environment variables and use proper secret management',
            'CWE-798'
          );
        }
      });
    }
  });

  if (hardcodedSecrets === 0) {
    passCheck('configuration', 'No hardcoded secrets detected');
  }
}

/**
 * 3. Security Headers Validation
 */
function validateSecurityHeaders() {
  log('Validating security headers...');

  const nextConfigPath = path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'next.config.ts');
  const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');

  const requiredHeaders = [
    { name: 'X-Content-Type-Options', value: 'nosniff', cwe: 'CWE-16' },
    { name: 'X-Frame-Options', value: 'DENY', cwe: 'CWE-1021' },
    { name: 'Referrer-Policy', value: 'origin-when-cross-origin', cwe: 'CWE-1021' },
    { name: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()', cwe: 'CWE-1021' }
  ];

  requiredHeaders.forEach(header => {
    if (nextConfig.includes(header.name)) {
      passCheck('headers', `${header.name} header configured`);
      auditResults.compliance.securityHeaders[header.name] = true;
    } else {
      addFinding(
        'headers',
        `Missing security header: ${header.name}`,
        SEVERITY.MEDIUM,
        `Security header ${header.name} is not configured`,
        `Add ${header.name}: ${header.value} to security headers`,
        header.cwe
      );
      auditResults.compliance.securityHeaders[header.name] = false;
    }
  });

  // Check CORS configuration
  if (!nextConfig.includes('Access-Control-Allow-Origin')) {
    log('CORS headers not explicitly configured (Next.js handles this)', 'info');
  }
}

/**
 * 4. Content Security Testing
 */
function testContentSecurity() {
  log('Testing content security...');

  const componentsPath = path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'src', 'components');
  const components = getAllFiles(componentsPath).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

  let xssVulnerabilities = 0;
  let injectionVulnerabilities = 0;

  components.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for dangerouslySetInnerHTML usage
    if (content.includes('dangerouslySetInnerHTML')) {
      xssVulnerabilities++;
      addFinding(
        'content',
        `Potential XSS vulnerability in ${path.basename(file)}`,
        SEVERITY.HIGH,
        'Usage of dangerouslySetInnerHTML detected which can lead to XSS',
        'Avoid dangerouslySetInnerHTML or ensure proper sanitization',
        'CWE-79'
      );
    }

    // Check for eval() usage
    if (content.includes('eval(') || content.includes('Function(')) {
      injectionVulnerabilities++;
      addFinding(
        'content',
        `Code injection risk in ${path.basename(file)}`,
        SEVERITY.CRITICAL,
        'Usage of eval() or Function() constructor detected',
        'Remove eval() usage and use safer alternatives',
        'CWE-94'
      );
    }

    // Check for proper input validation
    if (content.includes('innerHTML') && !content.includes('textContent')) {
      xssVulnerabilities++;
      addFinding(
        'content',
        `Direct innerHTML usage in ${path.basename(file)}`,
        SEVERITY.HIGH,
        'Direct innerHTML manipulation can lead to XSS',
        'Use textContent or proper sanitization libraries',
        'CWE-79'
      );
    }
  });

  if (xssVulnerabilities === 0) {
    passCheck('content', 'No XSS vulnerabilities detected');
    auditResults.compliance.owaspTop10.A03_Injection = 'Pass';
  } else {
    auditResults.compliance.owaspTop10.A03_Injection = 'Fail';
  }

  if (injectionVulnerabilities === 0) {
    passCheck('content', 'No code injection vulnerabilities detected');
  }
}

/**
 * 5. Authentication and Authorization Testing
 */
function testAuthentication() {
  log('Testing authentication and authorization...');

  // Check for authentication implementation
  const authFiles = getAllFiles(path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'src'))
    .filter(f => f.includes('auth') || f.includes('session'));

  if (authFiles.length === 0) {
    addFinding(
      'authentication',
      'No authentication implementation detected',
      SEVERITY.INFO,
      'The application does not appear to have authentication implemented',
      'If authentication is required, implement proper authentication mechanisms',
      'CWE-287'
    );
  } else {
    passCheck('authentication', 'Authentication files detected');
  }

  // Check for proper session handling
  const apiUtils = path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'src', 'utils', 'api.ts');
  if (fs.existsSync(apiUtils)) {
    const apiContent = fs.readFileSync(apiUtils, 'utf8');
    
    // Check for token handling
    if (apiContent.includes('Bearer') || apiContent.includes('Authorization')) {
      passCheck('authentication', 'Authorization header handling detected');
    }

    // Check for secure cookie flags
    if (!apiContent.includes('httpOnly') && !apiContent.includes('secure')) {
      addFinding(
        'authentication',
        'Missing secure cookie configuration',
        SEVERITY.MEDIUM,
        'Cookies may not be configured with secure flags',
        'Ensure cookies use httpOnly and secure flags',
        'CWE-614'
      );
    }
  }
}

/**
 * 6. Data Security Testing
 */
function testDataSecurity() {
  log('Testing data security...');

  const utilsPath = path.join(SECURITY_AUDIT_CONFIG.projectRoot, 'src', 'utils');
  const utils = getAllFiles(utilsPath).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

  utils.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // Check for proper error sanitization
    if (file.includes('api.ts')) {
      if (content.includes('sanitizeErrorMessage')) {
        passCheck('dataHandling', 'Error message sanitization implemented');
        auditResults.compliance.dataProtection.errorSanitization = true;
      } else {
        auditResults.compliance.dataProtection.errorSanitization = false;
      }
    }

    // Check for console.log of sensitive data
    if (content.includes('console.log') && (content.includes('password') || content.includes('token'))) {
      addFinding(
        'dataHandling',
        `Potential sensitive data logging in ${path.basename(file)}`,
        SEVERITY.HIGH,
        'Sensitive data may be logged to console',
        'Remove console.log statements that may expose sensitive data',
        'CWE-532'
      );
    }
  });

  // Check for HTTPS enforcement
  const apiConfig = fs.readFileSync(path.join(utilsPath, 'api.ts'), 'utf8');
  if (apiConfig.includes('http://') && !apiConfig.includes('localhost')) {
    addFinding(
      'dataHandling',
      'Insecure HTTP usage detected',
      SEVERITY.HIGH,
      'API configuration uses HTTP instead of HTTPS',
      'Use HTTPS for all external API calls',
      'CWE-319'
    );
  } else {
    passCheck('dataHandling', 'HTTPS usage verified');
    auditResults.compliance.dataProtection.encryptionInTransit = true;
  }
}

/**
 * 7. OWASP Top 10 Compliance Check
 */
function checkOwaspCompliance() {
  log('Checking OWASP Top 10 compliance...');

  // A01:2021 – Broken Access Control
  auditResults.compliance.owaspTop10.A01_BrokenAccessControl = 
    auditResults.findings.filter(f => f.cwe === 'CWE-285').length === 0 ? 'Pass' : 'Fail';

  // A02:2021 – Cryptographic Failures
  auditResults.compliance.owaspTop10.A02_CryptographicFailures = 
    auditResults.findings.filter(f => f.cwe === 'CWE-327' || f.cwe === 'CWE-319').length === 0 ? 'Pass' : 'Fail';

  // A03:2021 – Injection (already checked in content security)

  // A04:2021 – Insecure Design
  auditResults.compliance.owaspTop10.A04_InsecureDesign = 
    auditResults.findings.filter(f => f.severity === SEVERITY.CRITICAL).length === 0 ? 'Pass' : 'Fail';

  // A05:2021 – Security Misconfiguration
  auditResults.compliance.owaspTop10.A05_SecurityMisconfiguration = 
    auditResults.findings.filter(f => f.category === 'configuration').length === 0 ? 'Pass' : 'Fail';

  // A06:2021 – Vulnerable and Outdated Components
  auditResults.compliance.owaspTop10.A06_VulnerableComponents = 
    auditResults.findings.filter(f => f.category === 'dependencies').length === 0 ? 'Pass' : 'Fail';

  // A07:2021 – Identification and Authentication Failures
  auditResults.compliance.owaspTop10.A07_AuthenticationFailures = 
    auditResults.findings.filter(f => f.category === 'authentication').length === 0 ? 'Pass' : 'Fail';

  // A08:2021 – Software and Data Integrity Failures
  auditResults.compliance.owaspTop10.A08_DataIntegrityFailures = 
    auditResults.findings.filter(f => f.cwe === 'CWE-494').length === 0 ? 'Pass' : 'Fail';

  // A09:2021 – Security Logging and Monitoring Failures
  auditResults.compliance.owaspTop10.A09_LoggingFailures = 
    auditResults.findings.filter(f => f.cwe === 'CWE-778').length === 0 ? 'Pass' : 'Fail';

  // A10:2021 – Server-Side Request Forgery
  auditResults.compliance.owaspTop10.A10_SSRF = 
    auditResults.findings.filter(f => f.cwe === 'CWE-918').length === 0 ? 'Pass' : 'Fail';
}

/**
 * Generate comprehensive security report
 */
function generateReport() {
  log('Generating security audit report...');

  const report = `# Security Audit Report

**Generated:** ${SECURITY_AUDIT_CONFIG.timestamp}  
**Project:** ETF Research Platform Frontend  
**Audit Type:** Comprehensive Security Assessment  

## Executive Summary

### Overall Security Score: ${calculateSecurityScore()}/100

### Vulnerability Summary
- **Total Vulnerabilities:** ${auditResults.summary.totalVulnerabilities}
- **Critical:** ${auditResults.summary.critical}
- **High:** ${auditResults.summary.high}
- **Medium:** ${auditResults.summary.medium}
- **Low:** ${auditResults.summary.low}
- **Informational:** ${auditResults.summary.info}

### Test Results
- **Passed Checks:** ${auditResults.summary.passedChecks}
- **Failed Checks:** ${auditResults.summary.failedChecks}
- **Success Rate:** ${((auditResults.summary.passedChecks / (auditResults.summary.passedChecks + auditResults.summary.failedChecks)) * 100).toFixed(1)}%

## Detailed Findings

${generateFindingsSection()}

## OWASP Top 10 Compliance

${generateOwaspSection()}

## Security Headers Status

${generateHeadersSection()}

## Data Protection Compliance

${generateDataProtectionSection()}

## Recommendations

${generateRecommendations()}

## Remediation Priority

### Critical Priority (Immediate Action Required)
${auditResults.findings.filter(f => f.severity === SEVERITY.CRITICAL).map(f => `- ${f.title}`).join('\n') || '- None'}

### High Priority (Within 1 Week)
${auditResults.findings.filter(f => f.severity === SEVERITY.HIGH).map(f => `- ${f.title}`).join('\n') || '- None'}

### Medium Priority (Within 1 Month)
${auditResults.findings.filter(f => f.severity === SEVERITY.MEDIUM).map(f => `- ${f.title}`).join('\n') || '- None'}

### Low Priority (As Time Permits)
${auditResults.findings.filter(f => f.severity === SEVERITY.LOW).map(f => `- ${f.title}`).join('\n') || '- None'}

## Security Best Practices Implemented

${generateBestPractices()}

## Conclusion

${generateConclusion()}

---

*This report was generated automatically by the security audit script.*
`;

  fs.writeFileSync(SECURITY_AUDIT_CONFIG.reportPath, report);
  log(`Security audit report generated: ${SECURITY_AUDIT_CONFIG.reportPath}`, 'success');
}

/**
 * Helper function to get all files recursively
 */
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory() && !file.includes('node_modules') && !file.includes('.next')) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * Calculate overall security score
 */
function calculateSecurityScore() {
  const baseScore = 100;
  const deductions = {
    critical: 20,
    high: 10,
    medium: 5,
    low: 2,
    info: 0
  };

  let score = baseScore;
  score -= auditResults.summary.critical * deductions.critical;
  score -= auditResults.summary.high * deductions.high;
  score -= auditResults.summary.medium * deductions.medium;
  score -= auditResults.summary.low * deductions.low;

  return Math.max(0, score);
}

/**
 * Generate findings section
 */
function generateFindingsSection() {
  if (auditResults.findings.length === 0) {
    return '### No security vulnerabilities detected! 🎉\n';
  }

  return auditResults.findings.map(finding => `
### ${finding.id}: ${finding.title}

**Severity:** ${finding.severity}  
**Category:** ${finding.category}  
**CWE:** ${finding.cwe || 'N/A'}  
**Timestamp:** ${finding.timestamp}  

**Description:**  
${finding.description}

**Remediation:**  
${finding.remediation}
`).join('\n');
}

/**
 * Generate OWASP compliance section
 */
function generateOwaspSection() {
  return Object.entries(auditResults.compliance.owaspTop10).map(([key, value]) => {
    const status = value === 'Pass' ? '✅' : '❌';
    const name = key.replace(/_/g, ' - ');
    return `- ${status} ${name}`;
  }).join('\n');
}

/**
 * Generate security headers section
 */
function generateHeadersSection() {
  return Object.entries(auditResults.compliance.securityHeaders).map(([header, configured]) => {
    const status = configured ? '✅' : '❌';
    return `- ${status} ${header}`;
  }).join('\n') || '- No headers checked';
}

/**
 * Generate data protection section
 */
function generateDataProtectionSection() {
  return Object.entries(auditResults.compliance.dataProtection).map(([feature, enabled]) => {
    const status = enabled ? '✅' : '❌';
    const name = feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    return `- ${status} ${name}`;
  }).join('\n') || '- No data protection features checked';
}

/**
 * Generate recommendations
 */
function generateRecommendations() {
  const recommendations = [
    '1. **Implement Content Security Policy (CSP)**: Add a strict CSP to prevent XSS attacks',
    '2. **Enable HSTS**: Configure Strict-Transport-Security header for HTTPS enforcement',
    '3. **Regular Security Updates**: Implement automated dependency updates and vulnerability scanning',
    '4. **Security Testing in CI/CD**: Add security tests to the continuous integration pipeline',
    '5. **Rate Limiting**: Implement API rate limiting to prevent abuse',
    '6. **Input Validation**: Strengthen input validation across all user inputs',
    '7. **Error Handling**: Ensure all errors are properly sanitized before display',
    '8. **Security Monitoring**: Implement real-time security monitoring and alerting',
    '9. **Regular Audits**: Schedule quarterly security audits',
    '10. **Security Training**: Provide security training for the development team'
  ];

  return recommendations.join('\n');
}

/**
 * Generate best practices section
 */
function generateBestPractices() {
  const practices = [];

  if (auditResults.findings.filter(f => f.cwe === 'CWE-798').length === 0) {
    practices.push('✅ No hardcoded secrets detected');
  }

  if (auditResults.compliance.dataProtection.errorSanitization) {
    practices.push('✅ Error message sanitization implemented');
  }

  if (auditResults.compliance.dataProtection.encryptionInTransit) {
    practices.push('✅ HTTPS enforced for API communications');
  }

  if (auditResults.findings.filter(f => f.cwe === 'CWE-79').length === 0) {
    practices.push('✅ XSS prevention measures in place');
  }

  if (practices.length === 0) {
    return '- Implement security best practices as outlined in recommendations';
  }

  return practices.join('\n');
}

/**
 * Generate conclusion
 */
function generateConclusion() {
  const score = calculateSecurityScore();
  
  if (score >= 90) {
    return 'The application demonstrates excellent security posture with minimal vulnerabilities. Continue with regular security maintenance and monitoring.';
  } else if (score >= 70) {
    return 'The application has good security practices but requires attention to address identified vulnerabilities. Focus on high and critical severity issues first.';
  } else if (score >= 50) {
    return 'The application has significant security concerns that need immediate attention. Prioritize critical and high severity vulnerabilities for remediation.';
  } else {
    return 'The application has serious security vulnerabilities requiring urgent remediation. Implement security fixes before deployment to production.';
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔒 Starting Comprehensive Security Audit...\n');

  try {
    // Run all security tests
    scanDependencies();
    checkConfiguration();
    validateSecurityHeaders();
    testContentSecurity();
    testAuthentication();
    testDataSecurity();
    checkOwaspCompliance();

    // Generate report
    generateReport();

    // Summary
    console.log('\n📊 Audit Summary:');
    console.log(`Security Score: ${calculateSecurityScore()}/100`);
    console.log(`Total Vulnerabilities: ${auditResults.summary.totalVulnerabilities}`);
    console.log(`Critical: ${auditResults.summary.critical}, High: ${auditResults.summary.high}, Medium: ${auditResults.summary.medium}, Low: ${auditResults.summary.low}`);
    console.log(`\n✅ Security audit completed successfully!`);
    console.log(`📄 Full report available at: ${SECURITY_AUDIT_CONFIG.reportPath}`);

  } catch (error) {
    console.error('❌ Security audit failed:', error);
    process.exit(1);
  }
}

// Run the security audit
main();