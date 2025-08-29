/**
 * Color contrast utility functions for WCAG 2.1 AA compliance testing
 */

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 guidelines
 */
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)
  
  if (!rgb1 || !rgb2) {
    throw new Error('Invalid hex color format')
  }
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)
  
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  
  return (brightest + 0.05) / (darkest + 0.05)
}

/**
 * Check if contrast ratio meets WCAG 2.1 standards
 */
export function isWCAGCompliant(
  foreground: string, 
  background: string, 
  level: 'AA' | 'AAA' = 'AA',
  textSize: 'normal' | 'large' = 'normal'
): { compliant: boolean; ratio: number; required: number } {
  const ratio = getContrastRatio(foreground, background)
  
  // WCAG 2.1 requirements
  const requirements = {
    'AA': {
      normal: 4.5,
      large: 3.0
    },
    'AAA': {
      normal: 7.0,
      large: 4.5
    }
  }
  
  const required = requirements[level][textSize]
  const compliant = ratio >= required
  
  return { compliant, ratio, required }
}

/**
 * Common Tailwind CSS colors used in the application
 */
export const TailwindColors = {
  // Blue variants
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'blue-800': '#1e40af',
  'blue-900': '#1e3a8a',
  
  // Green variants
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'green-800': '#166534',
  'green-900': '#14532d',
  
  // Red variants
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'red-800': '#991b1b',
  'red-900': '#7f1d1d',
  
  // Gray variants
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-200': '#e5e7eb',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'gray-800': '#1f2937',
  'gray-900': '#111827',
  
  // White and black
  'white': '#ffffff',
  'black': '#000000'
}

/**
 * Test all color combinations used in the application
 */
export function testApplicationColors(): {
  compliant: Array<{ name: string; ratio: number; compliant: boolean }>
  nonCompliant: Array<{ name: string; ratio: number; required: number; compliant: boolean }>
} {
  const testCases = [
    // Primary text combinations
    { name: 'Primary text on white', fg: TailwindColors['gray-900'], bg: TailwindColors.white },
    { name: 'Secondary text on white', fg: TailwindColors['gray-600'], bg: TailwindColors.white },
    { name: 'Blue text on white', fg: TailwindColors['blue-600'], bg: TailwindColors.white },
    
    // Button combinations
    { name: 'White text on blue button', fg: TailwindColors.white, bg: TailwindColors['blue-600'] },
    { name: 'White text on green button', fg: TailwindColors.white, bg: TailwindColors['green-600'] },
    { name: 'White text on red button', fg: TailwindColors.white, bg: TailwindColors['red-600'] },
    
    // Card backgrounds
    { name: 'Dark text on blue-50', fg: TailwindColors['blue-900'], bg: TailwindColors['blue-50'] },
    { name: 'Dark text on green-50', fg: TailwindColors['green-900'], bg: TailwindColors['green-50'] },
    { name: 'Dark text on red-50', fg: TailwindColors['red-900'], bg: TailwindColors['red-50'] },
    
    // Price indicators
    { name: 'Green price text', fg: TailwindColors['green-600'], bg: TailwindColors.white },
    { name: 'Red price text', fg: TailwindColors['red-600'], bg: TailwindColors.white },
    
    // Link colors
    { name: 'Blue link on white', fg: TailwindColors['blue-600'], bg: TailwindColors.white },
    { name: 'Blue link hover', fg: TailwindColors['blue-800'], bg: TailwindColors.white },
  ]
  
  const results = testCases.map(test => {
    const result = isWCAGCompliant(test.fg, test.bg)
    return {
      name: test.name,
      ratio: result.ratio,
      required: result.required,
      compliant: result.compliant
    }
  })
  
  return {
    compliant: results.filter(r => r.compliant),
    nonCompliant: results.filter(r => !r.compliant)
  }
}

/**
 * Suggest accessible color alternatives
 */
export function suggestAccessibleColors(
  originalForeground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): string[] {
  const suggestions: string[] = []
  
  // Test darker variants for better contrast
  const darkerVariants = [
    TailwindColors['gray-700'],
    TailwindColors['gray-800'],
    TailwindColors['gray-900'],
    TailwindColors['blue-700'],
    TailwindColors['blue-800'],
    TailwindColors['blue-900'],
    TailwindColors['green-700'],
    TailwindColors['green-800'],
    TailwindColors['green-900'],
    TailwindColors['red-700'],
    TailwindColors['red-800'],
    TailwindColors['red-900']
  ]
  
  for (const color of darkerVariants) {
    const result = isWCAGCompliant(color, background, level)
    if (result.compliant) {
      suggestions.push(color)
    }
  }
  
  return [...new Set(suggestions)] // Remove duplicates
}

/**
 * Generate a contrast report for the application
 */
export function generateContrastReport(): string {
  const results = testApplicationColors()
  
  let report = '# WCAG 2.1 AA Color Contrast Report\n\n'
  
  report += '## ✅ Compliant Color Combinations\n\n'
  results.compliant.forEach(result => {
    report += `- **${result.name}**: ${result.ratio.toFixed(2)}:1 ✓\n`
  })
  
  if (results.nonCompliant.length > 0) {
    report += '\n## ❌ Non-Compliant Color Combinations\n\n'
    results.nonCompliant.forEach(result => {
      report += `- **${result.name}**: ${result.ratio.toFixed(2)}:1 (Required: ${result.required}:1) ❌\n`
    })
    
    report += '\n## 🔧 Recommendations\n\n'
    report += 'For non-compliant combinations, consider:\n'
    report += '1. Using darker text colors for better contrast\n'
    report += '2. Adjusting background colors to lighter variants\n'
    report += '3. Adding visual indicators beyond color (icons, patterns)\n'
    report += '4. Testing with actual users who have color vision deficiencies\n'
  }
  
  report += '\n---\n'
  report += `Generated on: ${new Date().toISOString()}\n`
  report += 'WCAG 2.1 AA Standard: 4.5:1 for normal text, 3:1 for large text\n'
  
  return report
}