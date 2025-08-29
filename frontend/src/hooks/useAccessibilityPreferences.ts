'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface AccessibilityPreferences {
  // Visual preferences
  highContrast: boolean
  reducedMotion: boolean
  largeText: boolean
  darkMode: boolean
  colorBlindFriendly: boolean
  
  // Navigation preferences
  keyboardNavigation: boolean
  skipLinks: boolean
  focusIndicators: 'default' | 'enhanced' | 'high-contrast'
  
  // Audio preferences
  screenReaderOptimized: boolean
  soundEnabled: boolean
  audioDescriptions: boolean
  announcementsEnabled: boolean
  
  // Content preferences
  simplifiedLayout: boolean
  descriptiveText: boolean
  autoplay: boolean
  animations: boolean
  
  // Cognitive preferences
  readingAssistance: boolean
  memoryAids: boolean
  distractionReduction: boolean
  contentPacing: 'normal' | 'slow' | 'fast'
}

export interface ColorScheme {
  name: string
  label: string
  colors: {
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    border: string
    muted: string
    success: string
    warning: string
    error: string
    info: string
  }
  contrastRatio: number
}

const defaultPreferences: AccessibilityPreferences = {
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  darkMode: false,
  colorBlindFriendly: false,
  keyboardNavigation: true,
  skipLinks: true,
  focusIndicators: 'default',
  screenReaderOptimized: false,
  soundEnabled: true,
  audioDescriptions: false,
  announcementsEnabled: true,
  simplifiedLayout: false,
  descriptiveText: false,
  autoplay: false,
  animations: true,
  readingAssistance: false,
  memoryAids: false,
  distractionReduction: false,
  contentPacing: 'normal'
}

const colorSchemes: ColorScheme[] = [
  {
    name: 'default',
    label: 'Default',
    colors: {
      background: '#ffffff',
      foreground: '#1f2937',
      primary: '#3b82f6',
      secondary: '#64748b',
      accent: '#8b5cf6',
      border: '#e5e7eb',
      muted: '#f3f4f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4'
    },
    contrastRatio: 4.5
  },
  {
    name: 'high-contrast',
    label: 'High Contrast',
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      primary: '#ffff00',
      secondary: '#ffffff',
      accent: '#ff00ff',
      border: '#ffffff',
      muted: '#333333',
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ffff'
    },
    contrastRatio: 21
  },
  {
    name: 'high-contrast-light',
    label: 'High Contrast Light',
    colors: {
      background: '#ffffff',
      foreground: '#000000',
      primary: '#0000ff',
      secondary: '#000000',
      accent: '#800080',
      border: '#000000',
      muted: '#f0f0f0',
      success: '#008000',
      warning: '#ff8c00',
      error: '#ff0000',
      info: '#0080ff'
    },
    contrastRatio: 21
  },
  {
    name: 'colorblind-friendly',
    label: 'Colorblind Friendly',
    colors: {
      background: '#ffffff',
      foreground: '#2d3748',
      primary: '#2b6cb0',
      secondary: '#4a5568',
      accent: '#805ad5',
      border: '#cbd5e0',
      muted: '#edf2f7',
      success: '#2f855a',
      warning: '#d69e2e',
      error: '#c53030',
      info: '#2c5282'
    },
    contrastRatio: 7
  },
  {
    name: 'dark',
    label: 'Dark Mode',
    colors: {
      background: '#1a202c',
      foreground: '#e2e8f0',
      primary: '#63b3ed',
      secondary: '#a0aec0',
      accent: '#b794f6',
      border: '#2d3748',
      muted: '#2d3748',
      success: '#68d391',
      warning: '#fbd38d',
      error: '#fc8181',
      info: '#76e4f7'
    },
    contrastRatio: 12
  }
]

/**
 * Hook for managing accessibility preferences with persistence and system integration
 */
export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(defaultPreferences)
  const [currentColorScheme, setCurrentColorScheme] = useState<ColorScheme>(colorSchemes[0])
  const [isLoading, setIsLoading] = useState(true)
  const [systemPreferences, setSystemPreferences] = useState({
    prefersReducedMotion: false,
    prefersColorScheme: 'light' as 'light' | 'dark',
    prefersContrast: 'no-preference' as 'no-preference' | 'more' | 'less'
  })
  
  const cssVariablesRef = useRef<HTMLStyleElement | null>(null)
  const storageKey = 'accessibility-preferences'

  /**
   * Detect system preferences using media queries
   */
  const detectSystemPreferences = useCallback(() => {
    if (typeof window === 'undefined') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const contrast = window.matchMedia('(prefers-contrast: more)').matches ? 'more' : 
                    window.matchMedia('(prefers-contrast: less)').matches ? 'less' : 'no-preference'

    setSystemPreferences({
      prefersReducedMotion: reducedMotion,
      prefersColorScheme: colorScheme,
      prefersContrast: contrast
    })

    return { reducedMotion, colorScheme, contrast }
  }, [])

  /**
   * Load preferences from localStorage
   */
  const loadPreferences = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsedPrefs = JSON.parse(stored)
        setPreferences(prev => ({ ...prev, ...parsedPrefs }))
        
        // Load color scheme
        const colorSchemeName = parsedPrefs.colorScheme || 'default'
        const scheme = colorSchemes.find(s => s.name === colorSchemeName) || colorSchemes[0]
        setCurrentColorScheme(scheme)
      } else {
        // Apply system preferences as defaults
        const system = detectSystemPreferences()
        if (system) {
          const initialPrefs = {
            ...defaultPreferences,
            reducedMotion: system.reducedMotion,
            darkMode: system.colorScheme === 'dark',
            highContrast: system.contrast === 'more'
          }
          setPreferences(initialPrefs)
          
          // Set initial color scheme based on system preferences
          let schemeName = 'default'
          if (system.contrast === 'more') {
            schemeName = 'high-contrast'
          } else if (system.colorScheme === 'dark') {
            schemeName = 'dark'
          }
          
          const scheme = colorSchemes.find(s => s.name === schemeName) || colorSchemes[0]
          setCurrentColorScheme(scheme)
        }
      }
    } catch (error) {
      console.error('Failed to load accessibility preferences:', error)
    } finally {
      setIsLoading(false)
    }
  }, [detectSystemPreferences])

  /**
   * Save preferences to localStorage
   */
  const savePreferences = useCallback((newPrefs: Partial<AccessibilityPreferences>) => {
    if (typeof window === 'undefined') return

    try {
      const updatedPrefs = { ...preferences, ...newPrefs }
      localStorage.setItem(storageKey, JSON.stringify({
        ...updatedPrefs,
        colorScheme: currentColorScheme.name
      }))
      setPreferences(updatedPrefs)
    } catch (error) {
      console.error('Failed to save accessibility preferences:', error)
    }
  }, [preferences, currentColorScheme])

  /**
   * Update color scheme and apply CSS variables
   */
  const setColorScheme = useCallback((schemeName: string) => {
    const scheme = colorSchemes.find(s => s.name === schemeName)
    if (!scheme) return

    setCurrentColorScheme(scheme)
    
    // Update preferences
    const newPrefs: Partial<AccessibilityPreferences> = {
      highContrast: schemeName.includes('high-contrast'),
      darkMode: schemeName === 'dark',
      colorBlindFriendly: schemeName === 'colorblind-friendly'
    }
    
    savePreferences(newPrefs)
  }, [savePreferences])

  /**
   * Apply CSS variables for current color scheme
   */
  const applyCSSVariables = useCallback(() => {
    if (typeof document === 'undefined') return

    // Remove existing style element
    if (cssVariablesRef.current) {
      cssVariablesRef.current.remove()
    }

    // Create new style element
    const style = document.createElement('style')
    style.textContent = `
      :root {
        --color-background: ${currentColorScheme.colors.background};
        --color-foreground: ${currentColorScheme.colors.foreground};
        --color-primary: ${currentColorScheme.colors.primary};
        --color-secondary: ${currentColorScheme.colors.secondary};
        --color-accent: ${currentColorScheme.colors.accent};
        --color-border: ${currentColorScheme.colors.border};
        --color-muted: ${currentColorScheme.colors.muted};
        --color-success: ${currentColorScheme.colors.success};
        --color-warning: ${currentColorScheme.colors.warning};
        --color-error: ${currentColorScheme.colors.error};
        --color-info: ${currentColorScheme.colors.info};
        
        /* Animation preferences */
        --animation-duration: ${preferences.reducedMotion ? '0s' : '0.2s'};
        --animation-easing: ${preferences.reducedMotion ? 'none' : 'ease-in-out'};
        
        /* Text size preferences */
        --text-scale: ${preferences.largeText ? '1.25' : '1'};
        
        /* Focus indicator preferences */
        --focus-ring-width: ${preferences.focusIndicators === 'enhanced' ? '3px' : 
                             preferences.focusIndicators === 'high-contrast' ? '4px' : '2px'};
        --focus-ring-color: ${preferences.focusIndicators === 'high-contrast' ? '#ffff00' : 
                             currentColorScheme.colors.primary};
        --focus-ring-offset: ${preferences.focusIndicators === 'enhanced' ? '2px' : '1px'};
      }
      
      /* Apply reduced motion */
      ${preferences.reducedMotion ? `
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
          scroll-behavior: auto !important;
        }
      ` : ''}
      
      /* Apply large text */
      ${preferences.largeText ? `
        body {
          font-size: calc(1rem * var(--text-scale));
        }
      ` : ''}
      
      /* Enhanced focus indicators */
      ${preferences.focusIndicators !== 'default' ? `
        :focus-visible {
          outline: var(--focus-ring-width) solid var(--focus-ring-color) !important;
          outline-offset: var(--focus-ring-offset) !important;
        }
      ` : ''}
      
      /* Simplified layout */
      ${preferences.simplifiedLayout ? `
        .animation,
        .gradient,
        .shadow {
          display: none !important;
        }
        
        .container {
          max-width: 100% !important;
          padding: 1rem !important;
        }
      ` : ''}
      
      /* Distraction reduction */
      ${preferences.distractionReduction ? `
        .advertisement,
        .popup,
        .modal:not([aria-live]),
        .notification:not([aria-live]) {
          display: none !important;
        }
      ` : ''}
    `
    
    document.head.appendChild(style)
    cssVariablesRef.current = style
  }, [currentColorScheme, preferences])

  /**
   * Apply body classes for accessibility features
   */
  const applyBodyClasses = useCallback(() => {
    if (typeof document === 'undefined') return

    const body = document.body
    
    // Remove existing accessibility classes
    body.classList.remove(
      'high-contrast',
      'reduced-motion',
      'large-text',
      'dark-mode',
      'colorblind-friendly',
      'simplified-layout',
      'distraction-reduction',
      'reading-assistance'
    )
    
    // Add current preference classes
    if (preferences.highContrast) body.classList.add('high-contrast')
    if (preferences.reducedMotion) body.classList.add('reduced-motion')
    if (preferences.largeText) body.classList.add('large-text')
    if (preferences.darkMode) body.classList.add('dark-mode')
    if (preferences.colorBlindFriendly) body.classList.add('colorblind-friendly')
    if (preferences.simplifiedLayout) body.classList.add('simplified-layout')
    if (preferences.distractionReduction) body.classList.add('distraction-reduction')
    if (preferences.readingAssistance) body.classList.add('reading-assistance')
  }, [preferences])

  /**
   * Update specific preference
   */
  const updatePreference = useCallback(<K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => {
    savePreferences({ [key]: value })
  }, [savePreferences])

  /**
   * Reset to defaults
   */
  const resetToDefaults = useCallback(() => {
    setPreferences(defaultPreferences)
    setCurrentColorScheme(colorSchemes[0])
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey)
    }
  }, [])

  /**
   * Get preference recommendations based on system settings
   */
  const getRecommendations = useCallback(() => {
    const recommendations: Array<{
      key: keyof AccessibilityPreferences
      value: any
      reason: string
    }> = []
    
    if (systemPreferences.prefersReducedMotion && !preferences.reducedMotion) {
      recommendations.push({
        key: 'reducedMotion',
        value: true,
        reason: 'Your system preferences indicate you prefer reduced motion'
      })
    }
    
    if (systemPreferences.prefersColorScheme === 'dark' && !preferences.darkMode) {
      recommendations.push({
        key: 'darkMode',
        value: true,
        reason: 'Your system preferences indicate you prefer dark mode'
      })
    }
    
    if (systemPreferences.prefersContrast === 'more' && !preferences.highContrast) {
      recommendations.push({
        key: 'highContrast',
        value: true,
        reason: 'Your system preferences indicate you prefer high contrast'
      })
    }
    
    return recommendations
  }, [systemPreferences, preferences])

  /**
   * Listen for system preference changes
   */
  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQueries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-color-scheme: dark)'),
      window.matchMedia('(prefers-contrast: more)')
    ]

    const handleChange = () => {
      detectSystemPreferences()
    }

    mediaQueries.forEach(mq => mq.addEventListener('change', handleChange))
    
    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', handleChange))
    }
  }, [detectSystemPreferences])

  // Initial load
  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  // Apply preferences when they change
  useEffect(() => {
    if (!isLoading) {
      applyCSSVariables()
      applyBodyClasses()
    }
  }, [preferences, currentColorScheme, applyCSSVariables, applyBodyClasses, isLoading])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cssVariablesRef.current) {
        cssVariablesRef.current.remove()
      }
    }
  }, [])

  return {
    preferences,
    currentColorScheme,
    colorSchemes,
    systemPreferences,
    isLoading,
    updatePreference,
    setColorScheme,
    resetToDefaults,
    getRecommendations,
    savePreferences
  }
}