/**
 * Security validation utilities for testing API configuration
 */

import { API_CONFIG, API_ENDPOINTS } from './api'

/**
 * Validate that no hardcoded localhost URLs exist
 */
export function validateNoHardcodedUrls(): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check if API_CONFIG is using environment variables properly
  if (API_CONFIG.BASE_URL.includes('localhost:8000') && process.env.NODE_ENV === 'production') {
    issues.push('Production environment still using localhost API base URL')
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Validate timeout configurations
 */
export function validateTimeoutConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  if (API_CONFIG.TIMEOUT < 1000) {
    issues.push('API timeout is too low (should be at least 1000ms)')
  }
  
  if (API_CONFIG.TIMEOUT > 30000) {
    issues.push('API timeout is too high (should be at most 30000ms)')
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Validate retry configuration
 */
export function validateRetryConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  if (API_CONFIG.MAX_RETRIES < 0) {
    issues.push('Max retries should be non-negative')
  }
  
  if (API_CONFIG.MAX_RETRIES > 5) {
    issues.push('Max retries is too high (should be at most 5)')
  }
  
  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Validate environment variables are properly configured
 */
export function validateEnvironmentConfig(): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  
  // Check that environment-based configuration is working
  const expectedEnvVars = [
    'API_BASE_URL',
    'API_TIMEOUT',
    'API_CACHE_DURATION',
    'API_MAX_RETRIES',
    'API_DEBOUNCE_DELAY'
  ]
  
  expectedEnvVars.forEach(envVar => {
    const value = process.env[envVar] || process.env[`NEXT_PUBLIC_${envVar}`]
    if (!value) {
      issues.push(`Environment variable ${envVar} is not set`)
    }
  })
  
  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Run all security validations
 */
export function runSecurityValidation(): {
  overall: boolean
  results: Record<string, { valid: boolean; issues: string[] }>
} {
  const results = {
    urls: validateNoHardcodedUrls(),
    timeouts: validateTimeoutConfig(),
    retries: validateRetryConfig(),
    environment: validateEnvironmentConfig(),
  }
  
  const overall = Object.values(results).every(result => result.valid)
  
  return { overall, results }
}

/**
 * Log security validation results
 */
export function logSecurityValidation(): void {
  const validation = runSecurityValidation()
  
  console.log('🔒 Security Validation Results:')
  console.log(`Overall Status: ${validation.overall ? '✅ PASS' : '❌ FAIL'}`)
  
  Object.entries(validation.results).forEach(([category, result]) => {
    console.log(`\n${category.toUpperCase()}:`)
    console.log(`  Status: ${result.valid ? '✅ PASS' : '❌ FAIL'}`)
    if (result.issues.length > 0) {
      result.issues.forEach(issue => console.log(`  - ${issue}`))
    }
  })
  
  console.log('\n📊 Configuration:')
  console.log(`  API Base URL: ${API_CONFIG.BASE_URL}`)
  console.log(`  Timeout: ${API_CONFIG.TIMEOUT}ms`)
  console.log(`  Max Retries: ${API_CONFIG.MAX_RETRIES}`)
  console.log(`  Cache Duration: ${API_CONFIG.CACHE_DURATION}ms`)
  console.log(`  Debounce Delay: ${API_CONFIG.DEBOUNCE_DELAY}ms`)
}