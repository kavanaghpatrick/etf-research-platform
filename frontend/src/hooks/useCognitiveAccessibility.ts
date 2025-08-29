'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccessibilityPreferences } from './useAccessibilityPreferences'

export interface CognitiveSupport {
  readingAssistance: {
    enabled: boolean
    highlightText: boolean
    readingGuide: boolean
    wordSpacing: number
    lineHeight: number
    fontSize: number
    font: 'default' | 'dyslexic-friendly' | 'high-contrast'
  }
  memoryAids: {
    enabled: boolean
    breadcrumbs: boolean
    progressIndicators: boolean
    formAutoSave: boolean
    contextualHelp: boolean
    shortcuts: boolean
  }
  focusSupport: {
    enabled: boolean
    distractionReduction: boolean
    focusMode: boolean
    timeoutExtension: number
    autoFocus: boolean
    focusReminders: boolean
  }
  timeManagement: {
    enabled: boolean
    extendedTimeouts: boolean
    pauseOptions: boolean
    progressSaving: boolean
    sessionReminders: boolean
    breakReminders: boolean
  }
  errorPrevention: {
    enabled: boolean
    confirmationDialogs: boolean
    undoActions: boolean
    inputValidation: boolean
    progressWarnings: boolean
    destructiveActionProtection: boolean
  }
}

export interface ReadingState {
  currentPosition: number
  totalWords: number
  estimatedTimeRemaining: number
  isReading: boolean
  readingSpeed: number // words per minute
}

/**
 * Comprehensive cognitive accessibility support hook
 * Provides features to support users with cognitive disabilities
 */
export function useCognitiveAccessibility() {
  const [cognitiveSupport, setCognitiveSupport] = useState<CognitiveSupport>({
    readingAssistance: {
      enabled: false,
      highlightText: false,
      readingGuide: false,
      wordSpacing: 1,
      lineHeight: 1.5,
      fontSize: 16,
      font: 'default'
    },
    memoryAids: {
      enabled: false,
      breadcrumbs: true,
      progressIndicators: true,
      formAutoSave: true,
      contextualHelp: true,
      shortcuts: true
    },
    focusSupport: {
      enabled: false,
      distractionReduction: false,
      focusMode: false,
      timeoutExtension: 300, // 5 minutes
      autoFocus: false,
      focusReminders: false
    },
    timeManagement: {
      enabled: false,
      extendedTimeouts: true,
      pauseOptions: true,
      progressSaving: true,
      sessionReminders: true,
      breakReminders: false
    },
    errorPrevention: {
      enabled: false,
      confirmationDialogs: true,
      undoActions: true,
      inputValidation: true,
      progressWarnings: true,
      destructiveActionProtection: true
    }
  })

  const [readingState, setReadingState] = useState<ReadingState>({
    currentPosition: 0,
    totalWords: 0,
    estimatedTimeRemaining: 0,
    isReading: false,
    readingSpeed: 200 // default words per minute
  })

  const [sessionData, setSessionData] = useState({
    startTime: Date.now(),
    lastActivity: Date.now(),
    totalTime: 0,
    breaksTaken: 0,
    tasksCompleted: 0
  })

  const [undoStack, setUndoStack] = useState<Array<{
    action: string
    data: any
    timestamp: number
    description: string
  }>>([])

  const timeoutExtensionRef = useRef<NodeJS.Timeout | null>(null)
  const sessionReminderRef = useRef<NodeJS.Timeout | null>(null)
  const breakReminderRef = useRef<NodeJS.Timeout | null>(null)
  const focusReminderRef = useRef<NodeJS.Timeout | null>(null)
  const currentHighlightRef = useRef<HTMLElement | null>(null)

  const { preferences } = useAccessibilityPreferences()

  /**
   * Initialize cognitive accessibility based on user preferences
   */
  const initializeCognitiveSupport = useCallback(() => {
    setCognitiveSupport(prev => ({
      ...prev,
      readingAssistance: {
        ...prev.readingAssistance,
        enabled: preferences.readingAssistance
      },
      memoryAids: {
        ...prev.memoryAids,
        enabled: preferences.memoryAids
      },
      focusSupport: {
        ...prev.focusSupport,
        enabled: preferences.distractionReduction,
        distractionReduction: preferences.distractionReduction
      },
      timeManagement: {
        ...prev.timeManagement,
        enabled: preferences.contentPacing !== 'normal'
      },
      errorPrevention: {
        ...prev.errorPrevention,
        enabled: true // Generally helpful for all users
      }
    }))
  }, [preferences])

  /**
   * Apply reading assistance styles
   */
  const applyReadingAssistance = useCallback(() => {
    if (typeof document === 'undefined') return

    const { readingAssistance } = cognitiveSupport
    
    if (!readingAssistance.enabled) return

    // Create or update reading assistance styles
    let style = document.getElementById('cognitive-reading-styles') as HTMLStyleElement
    if (!style) {
      style = document.createElement('style')
      style.id = 'cognitive-reading-styles'
      document.head.appendChild(style)
    }

    const fontFamily = {
      'default': 'inherit',
      'dyslexic-friendly': '"OpenDyslexic", "Comic Sans MS", cursive',
      'high-contrast': 'Arial, sans-serif'
    }[readingAssistance.font]

    style.textContent = `
      .cognitive-reading-assistance {
        font-family: ${fontFamily} !important;
        font-size: ${readingAssistance.fontSize}px !important;
        line-height: ${readingAssistance.lineHeight} !important;
        word-spacing: ${readingAssistance.wordSpacing}px !important;
      }
      
      .cognitive-reading-guide {
        position: relative;
      }
      
      .cognitive-reading-guide::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: #007bff;
        z-index: 1000;
        pointer-events: none;
      }
      
      .cognitive-text-highlight {
        background-color: #ffeb3b !important;
        color: #000 !important;
        padding: 2px 4px;
        border-radius: 2px;
        transition: all 0.3s ease;
      }
      
      .cognitive-word-highlight {
        background-color: #4caf50 !important;
        color: white !important;
        font-weight: bold;
        border-radius: 3px;
        padding: 1px 2px;
      }
    `

    // Apply classes to content elements
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th, span')
    textElements.forEach(el => {
      el.classList.add('cognitive-reading-assistance')
    })
  }, [cognitiveSupport])

  /**
   * Enable reading guide that follows cursor or focus
   */
  const enableReadingGuide = useCallback(() => {
    if (typeof document === 'undefined') return

    const handleMouseMove = (e: MouseEvent) => {
      if (!cognitiveSupport.readingAssistance.readingGuide) return

      const target = e.target as HTMLElement
      if (target && target.tagName && ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'].includes(target.tagName)) {
        // Remove previous guide
        document.querySelectorAll('.cognitive-reading-guide').forEach(el => {
          el.classList.remove('cognitive-reading-guide')
        })

        // Add guide to current element
        target.classList.add('cognitive-reading-guide')
      }
    }

    const handleFocus = (e: FocusEvent) => {
      if (!cognitiveSupport.readingAssistance.readingGuide) return

      const target = e.target as HTMLElement
      if (target && target.tagName) {
        // Remove previous guide
        document.querySelectorAll('.cognitive-reading-guide').forEach(el => {
          el.classList.remove('cognitive-reading-guide')
        })

        // Add guide to focused element
        target.classList.add('cognitive-reading-guide')
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('focus', handleFocus, true)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('focus', handleFocus, true)
    }
  }, [cognitiveSupport.readingAssistance.readingGuide])

  /**
   * Track reading progress through content
   */
  const trackReadingProgress = useCallback((element: HTMLElement) => {
    const text = element.textContent || ''
    const words = text.split(/\s+/).filter(word => word.length > 0)
    const totalWords = words.length
    
    setReadingState(prev => ({
      ...prev,
      totalWords,
      estimatedTimeRemaining: Math.ceil(totalWords / prev.readingSpeed)
    }))

    // Track scroll position to estimate reading progress
    const handleScroll = () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      const currentPosition = Math.round((scrollPercent / 100) * totalWords)
      const remainingWords = totalWords - currentPosition
      const timeRemaining = Math.ceil(remainingWords / readingState.readingSpeed)

      setReadingState(prev => ({
        ...prev,
        currentPosition,
        estimatedTimeRemaining: timeRemaining
      }))
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [readingState.readingSpeed])

  /**
   * Highlight text for reading assistance
   */
  const highlightText = useCallback((element: HTMLElement, wordIndex?: number) => {
    if (!cognitiveSupport.readingAssistance.highlightText) return

    // Remove previous highlights
    element.querySelectorAll('.cognitive-text-highlight, .cognitive-word-highlight').forEach(el => {
      el.classList.remove('cognitive-text-highlight', 'cognitive-word-highlight')
    })

    if (wordIndex !== undefined) {
      // Highlight specific word
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
      )

      let wordCount = 0
      let currentNode
      
      while (currentNode = walker.nextNode()) {
        const text = currentNode.textContent || ''
        const words = text.split(/\s+/)
        
        if (wordCount + words.length > wordIndex) {
          const localIndex = wordIndex - wordCount
          const word = words[localIndex]
          
          if (word && currentNode.parentElement) {
            const span = document.createElement('span')
            span.className = 'cognitive-word-highlight'
            span.textContent = word
            
            // Replace word with highlighted version
            const textContent = currentNode.textContent || ''
            const beforeWord = words.slice(0, localIndex).join(' ')
            const afterWord = words.slice(localIndex + 1).join(' ')
            
            currentNode.parentElement.innerHTML = beforeWord + ' ' + span.outerHTML + ' ' + afterWord
            currentHighlightRef.current = span
            break
          }
        }
        
        wordCount += words.length
      }
    } else {
      // Highlight entire element
      element.classList.add('cognitive-text-highlight')
      currentHighlightRef.current = element
    }

    // Auto-remove highlight after delay
    setTimeout(() => {
      if (currentHighlightRef.current) {
        currentHighlightRef.current.classList.remove('cognitive-text-highlight', 'cognitive-word-highlight')
      }
    }, 3000)
  }, [cognitiveSupport.readingAssistance.highlightText])

  /**
   * Implement distraction reduction
   */
  const applyDistractionReduction = useCallback(() => {
    if (typeof document === 'undefined') return

    const { focusSupport } = cognitiveSupport
    
    if (!focusSupport.distractionReduction) return

    // Create styles to reduce distractions
    let style = document.getElementById('distraction-reduction-styles') as HTMLStyleElement
    if (!style) {
      style = document.createElement('style')
      style.id = 'distraction-reduction-styles'
      document.head.appendChild(style)
    }

    style.textContent = `
      .distraction-reduced {
        background: white !important;
        color: #333 !important;
      }
      
      .distraction-reduced * {
        animation: none !important;
        transition: none !important;
      }
      
      .distraction-reduced .advertisement,
      .distraction-reduced .popup,
      .distraction-reduced .notification:not([aria-live]),
      .distraction-reduced .sidebar:not(.main-navigation),
      .distraction-reduced .social-media,
      .distraction-reduced .related-content,
      .distraction-reduced .comments {
        display: none !important;
      }
      
      .distraction-reduced img:not(.essential),
      .distraction-reduced video:not(.essential) {
        opacity: 0.3;
        filter: grayscale(100%);
      }
      
      .focus-mode-content {
        max-width: 700px;
        margin: 0 auto;
        padding: 2rem;
        line-height: 1.8;
        font-size: 1.1rem;
      }
    `

    if (focusSupport.focusMode) {
      document.body.classList.add('distraction-reduced')
      const main = document.querySelector('main, [role="main"]')
      if (main) {
        main.classList.add('focus-mode-content')
      }
    }
  }, [cognitiveSupport.focusSupport])

  /**
   * Auto-save form data
   */
  const enableFormAutoSave = useCallback(() => {
    if (typeof document === 'undefined') return

    const saveFormData = (form: HTMLFormElement) => {
      const formData = new FormData(form)
      const data: Record<string, string> = {}
      
      formData.forEach((value, key) => {
        data[key] = value.toString()
      })
      
      const formId = form.id || form.action || 'default-form'
      localStorage.setItem(`autosave-${formId}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }))
    }

    const restoreFormData = (form: HTMLFormElement) => {
      const formId = form.id || form.action || 'default-form'
      const saved = localStorage.getItem(`autosave-${formId}`)
      
      if (saved) {
        try {
          const { data, timestamp } = JSON.parse(saved)
          
          // Only restore if saved within last 24 hours
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            Object.entries(data).forEach(([key, value]) => {
              const input = form.querySelector(`[name="${key}"]`) as HTMLInputElement
              if (input && input.type !== 'password') {
                input.value = value
              }
            })
          }
        } catch (error) {
          console.error('Failed to restore form data:', error)
        }
      }
    }

    // Set up auto-save for all forms
    const forms = document.querySelectorAll('form')
    forms.forEach(form => {
      if (cognitiveSupport.memoryAids.formAutoSave) {
        restoreFormData(form)
        
        const inputs = form.querySelectorAll('input, textarea, select')
        inputs.forEach(input => {
          input.addEventListener('input', () => saveFormData(form))
          input.addEventListener('change', () => saveFormData(form))
        })
      }
    })
  }, [cognitiveSupport.memoryAids.formAutoSave])

  /**
   * Add action to undo stack
   */
  const addToUndoStack = useCallback((action: string, data: any, description: string) => {
    if (!cognitiveSupport.errorPrevention.undoActions) return

    setUndoStack(prev => [
      ...prev.slice(-9), // Keep last 10 actions
      {
        action,
        data,
        timestamp: Date.now(),
        description
      }
    ])
  }, [cognitiveSupport.errorPrevention.undoActions])

  /**
   * Undo last action
   */
  const undoLastAction = useCallback(() => {
    if (undoStack.length === 0) return null

    const lastAction = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    
    return lastAction
  }, [undoStack])

  /**
   * Set up session reminders
   */
  const setupSessionReminders = useCallback(() => {
    if (!cognitiveSupport.timeManagement.sessionReminders) return

    // Clear existing reminders
    if (sessionReminderRef.current) {
      clearInterval(sessionReminderRef.current)
    }

    // Set up 30-minute session reminders
    sessionReminderRef.current = setInterval(() => {
      const event = new CustomEvent('sessionReminder', {
        detail: {
          message: 'You\'ve been working for 30 minutes. Consider taking a break.',
          sessionTime: Date.now() - sessionData.startTime
        }
      })
      document.dispatchEvent(event)
    }, 30 * 60 * 1000) // 30 minutes
  }, [cognitiveSupport.timeManagement.sessionReminders, sessionData.startTime])

  /**
   * Set up break reminders
   */
  const setupBreakReminders = useCallback(() => {
    if (!cognitiveSupport.timeManagement.breakReminders) return

    // Clear existing reminder
    if (breakReminderRef.current) {
      clearInterval(breakReminderRef.current)
    }

    // Set up hourly break reminders
    breakReminderRef.current = setInterval(() => {
      const event = new CustomEvent('breakReminder', {
        detail: {
          message: 'Time for a break! Take 5-10 minutes to rest your eyes and mind.',
          totalTime: Date.now() - sessionData.startTime
        }
      })
      document.dispatchEvent(event)
    }, 60 * 60 * 1000) // 1 hour
  }, [cognitiveSupport.timeManagement.breakReminders, sessionData.startTime])

  /**
   * Extend timeouts for cognitive accessibility
   */
  const extendTimeouts = useCallback(() => {
    if (!cognitiveSupport.timeManagement.extendedTimeouts) return

    // Find and extend session timeouts
    const originalSetTimeout = window.setTimeout
    window.setTimeout = function(callback, delay, ...args) {
      const extendedDelay = delay + (cognitiveSupport.focusSupport.timeoutExtension * 1000)
      return originalSetTimeout.call(window, callback, extendedDelay, ...args)
    }
  }, [cognitiveSupport.timeManagement.extendedTimeouts, cognitiveSupport.focusSupport.timeoutExtension])

  /**
   * Update cognitive support settings
   */
  const updateCognitiveSupport = useCallback((updates: Partial<CognitiveSupport>) => {
    setCognitiveSupport(prev => {
      const updated = { ...prev }
      
      Object.entries(updates).forEach(([category, settings]) => {
        if (updated[category as keyof CognitiveSupport]) {
          updated[category as keyof CognitiveSupport] = {
            ...updated[category as keyof CognitiveSupport],
            ...settings
          }
        }
      })
      
      return updated
    })
  }, [])

  /**
   * Get cognitive accessibility statistics
   */
  const getCognitiveStats = useCallback(() => {
    return {
      session: sessionData,
      reading: readingState,
      undoStackSize: undoStack.length,
      featuresEnabled: {
        readingAssistance: cognitiveSupport.readingAssistance.enabled,
        memoryAids: cognitiveSupport.memoryAids.enabled,
        focusSupport: cognitiveSupport.focusSupport.enabled,
        timeManagement: cognitiveSupport.timeManagement.enabled,
        errorPrevention: cognitiveSupport.errorPrevention.enabled
      }
    }
  }, [sessionData, readingState, undoStack.length, cognitiveSupport])

  // Initialize cognitive support when preferences change
  useEffect(() => {
    initializeCognitiveSupport()
  }, [initializeCognitiveSupport])

  // Apply reading assistance when enabled
  useEffect(() => {
    if (cognitiveSupport.readingAssistance.enabled) {
      applyReadingAssistance()
      const cleanup = enableReadingGuide()
      return cleanup
    }
  }, [cognitiveSupport.readingAssistance, applyReadingAssistance, enableReadingGuide])

  // Apply distraction reduction when enabled
  useEffect(() => {
    applyDistractionReduction()
  }, [applyDistractionReduction])

  // Set up form auto-save when enabled
  useEffect(() => {
    enableFormAutoSave()
  }, [enableFormAutoSave])

  // Set up session and break reminders
  useEffect(() => {
    setupSessionReminders()
    setupBreakReminders()
    extendTimeouts()

    return () => {
      if (sessionReminderRef.current) clearInterval(sessionReminderRef.current)
      if (breakReminderRef.current) clearInterval(breakReminderRef.current)
      if (timeoutExtensionRef.current) clearTimeout(timeoutExtensionRef.current)
      if (focusReminderRef.current) clearInterval(focusReminderRef.current)
    }
  }, [setupSessionReminders, setupBreakReminders, extendTimeouts])

  // Track user activity
  useEffect(() => {
    const updateActivity = () => {
      setSessionData(prev => ({
        ...prev,
        lastActivity: Date.now(),
        totalTime: Date.now() - prev.startTime
      }))
    }

    const events = ['click', 'keydown', 'scroll', 'mousemove']
    events.forEach(event => document.addEventListener(event, updateActivity))

    return () => {
      events.forEach(event => document.removeEventListener(event, updateActivity))
    }
  }, [])

  return {
    // State
    cognitiveSupport,
    readingState,
    sessionData,
    undoStack,
    
    // Actions
    updateCognitiveSupport,
    highlightText,
    trackReadingProgress,
    addToUndoStack,
    undoLastAction,
    
    // Utilities
    getCognitiveStats
  }
}