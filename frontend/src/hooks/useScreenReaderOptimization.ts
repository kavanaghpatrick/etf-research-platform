'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export type ScreenReaderType = 'nvda' | 'jaws' | 'voiceover' | 'talkback' | 'unknown'

export interface ScreenReaderOptimizations {
  verbosityLevel: 'minimal' | 'normal' | 'verbose'
  announcementTiming: 'immediate' | 'polite' | 'assertive'
  navigationMode: 'browse' | 'focus' | 'forms'
  skipRepeatedContent: boolean
  enhancedDescriptions: boolean
  structuralNavigation: boolean
}

/**
 * Hook for optimizing content for specific screen readers
 * Provides screen reader detection and optimization strategies
 */
export function useScreenReaderOptimization() {
  const [detectedScreenReader, setDetectedScreenReader] = useState<ScreenReaderType>('unknown')
  const [optimizations, setOptimizations] = useState<ScreenReaderOptimizations>({
    verbosityLevel: 'normal',
    announcementTiming: 'polite',
    navigationMode: 'browse',
    skipRepeatedContent: true,
    enhancedDescriptions: false,
    structuralNavigation: true
  })
  
  const contentCache = useRef<Map<string, string>>(new Map())
  const lastAnnouncementTime = useRef<number>(0)
  const announcementQueue = useRef<Array<{ content: string; priority: number }>>([])

  /**
   * Detect screen reader type based on user agent and other signals
   */
  const detectScreenReader = useCallback((): ScreenReaderType => {
    if (typeof window === 'undefined') return 'unknown'
    
    const userAgent = navigator.userAgent.toLowerCase()
    
    // NVDA detection
    if (userAgent.includes('nvda') || 
        document.documentElement.hasAttribute('data-nvda')) {
      return 'nvda'
    }
    
    // JAWS detection
    if (userAgent.includes('jaws') || 
        userAgent.includes('jfw') ||
        document.documentElement.hasAttribute('data-jaws')) {
      return 'jaws'
    }
    
    // VoiceOver detection (macOS/iOS)
    if (userAgent.includes('mac') && 
        (userAgent.includes('safari') || userAgent.includes('webkit'))) {
      // Additional VoiceOver specific detection
      try {
        // Check for VoiceOver specific API
        if ('speechSynthesis' in window && navigator.platform.includes('Mac')) {
          return 'voiceover'
        }
      } catch (e) {
        // Fallback detection
      }
    }
    
    // TalkBack detection (Android)
    if (userAgent.includes('android') && 
        userAgent.includes('chrome')) {
      return 'talkback'
    }
    
    // Generic screen reader detection
    try {
      // Check for screen reader specific properties
      if ('speechSynthesis' in window || 
          document.documentElement.hasAttribute('data-screen-reader')) {
        return 'unknown' // Screen reader present but type unknown
      }
    } catch (e) {
      // Not a screen reader environment
    }
    
    return 'unknown'
  }, [])

  /**
   * Get optimized content based on screen reader type
   */
  const optimizeContent = useCallback((content: string, context: {
    type: 'heading' | 'link' | 'button' | 'form' | 'table' | 'list' | 'description'
    level?: number
    role?: string
    important?: boolean
  }): string => {
    const { type, level, role, important = false } = context
    
    let optimized = content.trim()
    
    switch (detectedScreenReader) {
      case 'nvda':
        // NVDA optimizations
        switch (type) {
          case 'heading':
            optimized = `Heading ${level || 1}, ${optimized}`
            break
          case 'link':
            if (!optimized.toLowerCase().includes('link')) {
              optimized = `Link, ${optimized}`
            }
            break
          case 'button':
            if (!optimized.toLowerCase().includes('button')) {
              optimized = `Button, ${optimized}`
            }
            break
          case 'table':
            optimized = `Table, ${optimized}`
            break
          case 'list':
            optimized = `List with items, ${optimized}`
            break
        }
        break
        
      case 'jaws':
        // JAWS optimizations
        switch (type) {
          case 'heading':
            optimized = `Heading level ${level || 1}, ${optimized}`
            break
          case 'link':
            optimized = `Link: ${optimized}`
            break
          case 'button':
            optimized = `${optimized} button`
            break
          case 'form':
            optimized = `Form field: ${optimized}`
            break
          case 'table':
            optimized = `Data table: ${optimized}`
            break
        }
        break
        
      case 'voiceover':
        // VoiceOver optimizations
        switch (type) {
          case 'heading':
            optimized = `${optimized}, heading ${level || 1}`
            break
          case 'link':
            optimized = `${optimized}, link`
            break
          case 'button':
            optimized = `${optimized}, button`
            break
          case 'description':
            optimized = `Description: ${optimized}`
            break
        }
        break
        
      case 'talkback':
        // TalkBack optimizations
        switch (type) {
          case 'heading':
            optimized = `Heading ${level || 1}: ${optimized}`
            break
          case 'button':
            optimized = `${optimized}. Double-tap to activate`
            break
          case 'link':
            optimized = `${optimized}. Double-tap to follow link`
            break
        }
        break
    }
    
    // Add importance indicator for critical content
    if (important) {
      optimized = `Important: ${optimized}`
    }
    
    return optimized
  }, [detectedScreenReader])

  /**
   * Create optimized ARIA labels
   */
  const createAriaLabel = useCallback((baseLabel: string, context: {
    state?: string
    position?: string
    count?: number
    total?: number
    expanded?: boolean
    selected?: boolean
  }): string => {
    const { state, position, count, total, expanded, selected } = context
    
    let label = baseLabel
    
    // Add state information
    if (state) {
      label += `, ${state}`
    }
    
    // Add position information
    if (position) {
      label += `, ${position}`
    }
    
    // Add count information
    if (count !== undefined && total !== undefined) {
      label += `, ${count} of ${total}`
    }
    
    // Add expanded state
    if (expanded !== undefined) {
      label += expanded ? ', expanded' : ', collapsed'
    }
    
    // Add selected state
    if (selected !== undefined) {
      label += selected ? ', selected' : ', not selected'
    }
    
    return optimizeContent(label, { type: 'description' })
  }, [optimizeContent])

  /**
   * Generate smart table announcements
   */
  const generateTableAnnouncement = useCallback((
    rowIndex: number,
    columnIndex: number,
    cellContent: string,
    headers: string[],
    totalRows: number,
    totalColumns: number
  ): string => {
    const header = headers[columnIndex] || `Column ${columnIndex + 1}`
    
    switch (detectedScreenReader) {
      case 'nvda':
        return `Row ${rowIndex + 1}, ${header}, ${cellContent}`
      case 'jaws':
        return `${header}: ${cellContent}, row ${rowIndex + 1} of ${totalRows}`
      case 'voiceover':
        return `${cellContent}, ${header}, row ${rowIndex + 1}, column ${columnIndex + 1}`
      case 'talkback':
        return `${header}: ${cellContent}. Row ${rowIndex + 1} of ${totalRows}`
      default:
        return `${header}: ${cellContent}`
    }
  }, [detectedScreenReader])

  /**
   * Create navigation instructions
   */
  const createNavigationInstructions = useCallback((elementType: string): string => {
    switch (detectedScreenReader) {
      case 'nvda':
        switch (elementType) {
          case 'table':
            return 'Use arrow keys to navigate table cells. Press Ctrl+Alt+arrow keys for table navigation.'
          case 'menu':
            return 'Use arrow keys to navigate menu items. Press Enter to select.'
          case 'tabs':
            return 'Use arrow keys to navigate tabs. Press Space or Enter to activate.'
          default:
            return 'Use Tab key to navigate between elements.'
        }
        
      case 'jaws':
        switch (elementType) {
          case 'table':
            return 'Use Ctrl+Alt+arrow keys to navigate table. Press Ctrl+Alt+5 for table info.'
          case 'menu':
            return 'Use arrow keys for menu navigation. Press Enter to activate items.'
          case 'tabs':
            return 'Use left and right arrow keys to navigate tabs.'
          default:
            return 'Use Tab and Shift+Tab to navigate.'
        }
        
      case 'voiceover':
        switch (elementType) {
          case 'table':
            return 'Use VO+arrow keys to navigate table cells. Use VO+C for column headers.'
          case 'menu':
            return 'Use VO+arrow keys to navigate menu. Press VO+Space to select.'
          case 'tabs':
            return 'Use VO+left/right arrow to navigate tabs. Press VO+Space to activate.'
          default:
            return 'Use VO+arrow keys or Tab key to navigate.'
        }
        
      case 'talkback':
        switch (elementType) {
          case 'table':
            return 'Swipe to navigate table cells. Double-tap and hold for options.'
          case 'menu':
            return 'Swipe to navigate menu items. Double-tap to select.'
          case 'tabs':
            return 'Swipe left or right to navigate tabs. Double-tap to activate.'
          default:
            return 'Swipe right to navigate forward, left to go back.'
        }
        
      default:
        return 'Use standard navigation keys for this element.'
    }
  }, [detectedScreenReader])

  /**
   * Queue announcements with priority
   */
  const queueAnnouncement = useCallback((content: string, priority: number = 1) => {
    announcementQueue.current.push({ content, priority })
    announcementQueue.current.sort((a, b) => b.priority - a.priority)
  }, [])

  /**
   * Process announcement queue
   */
  const processAnnouncementQueue = useCallback(() => {
    if (announcementQueue.current.length === 0) return null
    
    const now = Date.now()
    const timeSinceLastAnnouncement = now - lastAnnouncementTime.current
    
    // Rate limiting based on screen reader
    const minInterval = detectedScreenReader === 'voiceover' ? 1000 : 
                       detectedScreenReader === 'jaws' ? 800 : 600
    
    if (timeSinceLastAnnouncement >= minInterval) {
      const announcement = announcementQueue.current.shift()
      if (announcement) {
        lastAnnouncementTime.current = now
        return announcement.content
      }
    }
    
    return null
  }, [detectedScreenReader])

  /**
   * Get content reading preferences
   */
  const getReadingPreferences = useCallback(() => {
    switch (detectedScreenReader) {
      case 'nvda':
        return {
          readPunctuation: false,
          readCapitalization: true,
          readAttributes: true,
          readEmptyElements: false,
          skipRepeatedContent: true
        }
      case 'jaws':
        return {
          readPunctuation: true,
          readCapitalization: true,
          readAttributes: true,
          readEmptyElements: false,
          skipRepeatedContent: true
        }
      case 'voiceover':
        return {
          readPunctuation: false,
          readCapitalization: false,
          readAttributes: false,
          readEmptyElements: false,
          skipRepeatedContent: true
        }
      case 'talkback':
        return {
          readPunctuation: false,
          readCapitalization: true,
          readAttributes: true,
          readEmptyElements: false,
          skipRepeatedContent: true
        }
      default:
        return {
          readPunctuation: false,
          readCapitalization: true,
          readAttributes: true,
          readEmptyElements: false,
          skipRepeatedContent: true
        }
    }
  }, [detectedScreenReader])

  /**
   * Initialize screen reader detection
   */
  useEffect(() => {
    const detected = detectScreenReader()
    setDetectedScreenReader(detected)
    
    // Update optimizations based on detected screen reader
    switch (detected) {
      case 'nvda':
        setOptimizations({
          verbosityLevel: 'normal',
          announcementTiming: 'polite',
          navigationMode: 'browse',
          skipRepeatedContent: true,
          enhancedDescriptions: true,
          structuralNavigation: true
        })
        break
      case 'jaws':
        setOptimizations({
          verbosityLevel: 'verbose',
          announcementTiming: 'assertive',
          navigationMode: 'forms',
          skipRepeatedContent: true,
          enhancedDescriptions: true,
          structuralNavigation: true
        })
        break
      case 'voiceover':
        setOptimizations({
          verbosityLevel: 'minimal',
          announcementTiming: 'polite',
          navigationMode: 'browse',
          skipRepeatedContent: true,
          enhancedDescriptions: false,
          structuralNavigation: true
        })
        break
      case 'talkback':
        setOptimizations({
          verbosityLevel: 'normal',
          announcementTiming: 'polite',
          navigationMode: 'browse',
          skipRepeatedContent: true,
          enhancedDescriptions: true,
          structuralNavigation: false
        })
        break
    }
  }, [detectScreenReader])

  /**
   * Set up periodic announcement processing
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const announcement = processAnnouncementQueue()
      if (announcement) {
        // Trigger announcement through live region
        const event = new CustomEvent('screenReaderAnnouncement', {
          detail: { content: announcement }
        })
        document.dispatchEvent(event)
      }
    }, 100)
    
    return () => clearInterval(interval)
  }, [processAnnouncementQueue])

  return {
    detectedScreenReader,
    optimizations,
    optimizeContent,
    createAriaLabel,
    generateTableAnnouncement,
    createNavigationInstructions,
    queueAnnouncement,
    getReadingPreferences,
    setOptimizations
  }
}