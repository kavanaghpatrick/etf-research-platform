'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  description: string
  action: () => void
  disabled?: boolean
}

export interface FocusableElement {
  element: HTMLElement
  priority: number
  group?: string
}

/**
 * Advanced keyboard navigation hook with focus management
 * Supports custom shortcuts, focus trapping, and accessible navigation
 */
export function useKeyboardNavigation() {
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([])
  const [focusableElements, setFocusableElements] = useState<FocusableElement[]>([])
  const [currentFocus, setCurrentFocus] = useState<number>(-1)
  const [isHelpVisible, setIsHelpVisible] = useState(false)
  const [focusTrap, setFocusTrap] = useState<HTMLElement | null>(null)
  
  const containerRef = useRef<HTMLElement | null>(null)
  const helpDialogRef = useRef<HTMLDialogElement | null>(null)

  /**
   * Register a keyboard shortcut
   */
  const registerShortcut = useCallback((shortcut: KeyboardShortcut) => {
    setShortcuts(prev => {
      const existingIndex = prev.findIndex(s => 
        s.key === shortcut.key && 
        s.ctrlKey === shortcut.ctrlKey &&
        s.shiftKey === shortcut.shiftKey &&
        s.altKey === shortcut.altKey &&
        s.metaKey === shortcut.metaKey
      )
      
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = shortcut
        return updated
      }
      
      return [...prev, shortcut]
    })
  }, [])

  /**
   * Unregister a keyboard shortcut
   */
  const unregisterShortcut = useCallback((key: string, modifiers?: Partial<Pick<KeyboardShortcut, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>>) => {
    setShortcuts(prev => prev.filter(shortcut => 
      !(shortcut.key === key && 
        shortcut.ctrlKey === modifiers?.ctrlKey &&
        shortcut.shiftKey === modifiers?.shiftKey &&
        shortcut.altKey === modifiers?.altKey &&
        shortcut.metaKey === modifiers?.metaKey)
    ))
  }, [])

  /**
   * Find all focusable elements in the container
   */
  const updateFocusableElements = useCallback(() => {
    if (!containerRef.current) return

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]'
    ].join(', ')

    const elements = Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[]
    
    const focusableElements: FocusableElement[] = elements
      .filter(el => {
        const style = window.getComputedStyle(el)
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               el.offsetParent !== null
      })
      .map((element, index) => ({
        element,
        priority: parseInt(element.getAttribute('data-focus-priority') || '0'),
        group: element.getAttribute('data-focus-group') || undefined
      }))
      .sort((a, b) => b.priority - a.priority)

    setFocusableElements(focusableElements)
  }, [])

  /**
   * Focus management functions
   */
  const focusFirst = useCallback(() => {
    if (focusableElements.length > 0) {
      focusableElements[0].element.focus()
      setCurrentFocus(0)
    }
  }, [focusableElements])

  const focusLast = useCallback(() => {
    if (focusableElements.length > 0) {
      const lastIndex = focusableElements.length - 1
      focusableElements[lastIndex].element.focus()
      setCurrentFocus(lastIndex)
    }
  }, [focusableElements])

  const focusNext = useCallback(() => {
    if (focusableElements.length === 0) return
    
    const nextIndex = currentFocus < focusableElements.length - 1 ? currentFocus + 1 : 0
    focusableElements[nextIndex].element.focus()
    setCurrentFocus(nextIndex)
  }, [focusableElements, currentFocus])

  const focusPrevious = useCallback(() => {
    if (focusableElements.length === 0) return
    
    const prevIndex = currentFocus > 0 ? currentFocus - 1 : focusableElements.length - 1
    focusableElements[prevIndex].element.focus()
    setCurrentFocus(prevIndex)
  }, [focusableElements, currentFocus])

  const focusByGroup = useCallback((group: string) => {
    const groupElements = focusableElements.filter(el => el.group === group)
    if (groupElements.length > 0) {
      groupElements[0].element.focus()
      setCurrentFocus(focusableElements.indexOf(groupElements[0]))
    }
  }, [focusableElements])

  /**
   * Focus trap management
   */
  const trapFocus = useCallback((element: HTMLElement) => {
    setFocusTrap(element)
  }, [])

  const releaseFocusTrap = useCallback(() => {
    setFocusTrap(null)
  }, [])

  /**
   * Show keyboard shortcuts help
   */
  const showHelp = useCallback(() => {
    setIsHelpVisible(true)
    if (helpDialogRef.current) {
      helpDialogRef.current.showModal()
    }
  }, [])

  const hideHelp = useCallback(() => {
    setIsHelpVisible(false)
    if (helpDialogRef.current) {
      helpDialogRef.current.close()
    }
  }, [])

  /**
   * Handle keyboard events
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Check if focus is trapped
    if (focusTrap && !focusTrap.contains(event.target as Node)) {
      event.preventDefault()
      focusTrap.focus()
      return
    }

    // Handle help shortcut
    if (event.key === '?' && event.shiftKey) {
      event.preventDefault()
      showHelp()
      return
    }

    // Handle help dialog navigation
    if (isHelpVisible && event.key === 'Escape') {
      event.preventDefault()
      hideHelp()
      return
    }

    // Find matching shortcut
    const matchingShortcut = shortcuts.find(shortcut => 
      shortcut.key === event.key &&
      !!shortcut.ctrlKey === event.ctrlKey &&
      !!shortcut.shiftKey === event.shiftKey &&
      !!shortcut.altKey === event.altKey &&
      !!shortcut.metaKey === event.metaKey &&
      !shortcut.disabled
    )

    if (matchingShortcut) {
      event.preventDefault()
      matchingShortcut.action()
      return
    }

    // Handle arrow key navigation
    if (!event.ctrlKey && !event.altKey && !event.metaKey) {
      switch (event.key) {
        case 'ArrowDown':
          if (event.target && (event.target as HTMLElement).getAttribute('role') !== 'textbox') {
            event.preventDefault()
            focusNext()
          }
          break
        case 'ArrowUp':
          if (event.target && (event.target as HTMLElement).getAttribute('role') !== 'textbox') {
            event.preventDefault()
            focusPrevious()
          }
          break
        case 'Home':
          if (event.ctrlKey) {
            event.preventDefault()
            focusFirst()
          }
          break
        case 'End':
          if (event.ctrlKey) {
            event.preventDefault()
            focusLast()
          }
          break
      }
    }
  }, [shortcuts, focusTrap, isHelpVisible, focusNext, focusPrevious, focusFirst, focusLast, showHelp, hideHelp])

  /**
   * Track focus changes
   */
  const handleFocusChange = useCallback(() => {
    if (document.activeElement) {
      const currentIndex = focusableElements.findIndex(el => el.element === document.activeElement)
      setCurrentFocus(currentIndex)
    }
  }, [focusableElements])

  // Set up event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('focusin', handleFocusChange)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('focusin', handleFocusChange)
    }
  }, [handleKeyDown, handleFocusChange])

  // Update focusable elements when container changes
  useEffect(() => {
    updateFocusableElements()
    
    // Set up mutation observer to track DOM changes
    if (containerRef.current) {
      const observer = new MutationObserver(updateFocusableElements)
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'tabindex', 'role']
      })
      
      return () => observer.disconnect()
    }
  }, [updateFocusableElements])

  return {
    containerRef,
    helpDialogRef,
    shortcuts,
    focusableElements,
    currentFocus,
    isHelpVisible,
    registerShortcut,
    unregisterShortcut,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusByGroup,
    trapFocus,
    releaseFocusTrap,
    showHelp,
    hideHelp,
    updateFocusableElements
  }
}

/**
 * Hook for managing skip links
 */
export function useSkipLinks() {
  const skipLinks = [
    { href: '#main-content', label: 'Skip to main content' },
    { href: '#navigation', label: 'Skip to navigation' },
    { href: '#search', label: 'Skip to search' },
    { href: '#footer', label: 'Skip to footer' }
  ]

  return { skipLinks }
}