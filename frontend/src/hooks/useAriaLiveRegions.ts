'use client'

import { useRef, useCallback, useEffect, useState } from 'react'

export type AriaLiveRegionType = 'polite' | 'assertive' | 'off'
export type AnnouncementPriority = 'low' | 'medium' | 'high'

export interface AriaAnnouncement {
  id: string
  message: string
  priority: AnnouncementPriority
  type: AriaLiveRegionType
  timestamp: number
  duration?: number
  category?: string
}

/**
 * Advanced ARIA live regions hook with intelligent content announcements
 * Manages multiple live regions and announcement queuing for optimal screen reader experience
 */
export function useAriaLiveRegions() {
  const politeRef = useRef<HTMLDivElement>(null)
  const assertiveRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  
  const [announcements, setAnnouncements] = useState<AriaAnnouncement[]>([])
  const [isAnnouncingEnabled, setIsAnnouncingEnabled] = useState(true)
  const [announcementQueue, setAnnouncementQueue] = useState<AriaAnnouncement[]>([])
  
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const lastAnnouncementTime = useRef<number>(0)
  const duplicateAnnouncementCache = useRef<Map<string, number>>(new Map())

  /**
   * Clean up expired announcements
   */
  const cleanupAnnouncements = useCallback(() => {
    const now = Date.now()
    setAnnouncements(prev => prev.filter(announcement => {
      const age = now - announcement.timestamp
      const maxAge = announcement.duration || 10000 // Default 10 seconds
      return age < maxAge
    }))
  }, [])

  /**
   * Check if announcement is a duplicate
   */
  const isDuplicateAnnouncement = useCallback((message: string, category?: string): boolean => {
    const key = `${category || 'default'}:${message}`
    const lastTime = duplicateAnnouncementCache.current.get(key)
    const now = Date.now()
    
    // Consider duplicate if same message within 2 seconds
    if (lastTime && (now - lastTime) < 2000) {
      return true
    }
    
    duplicateAnnouncementCache.current.set(key, now)
    return false
  }, [])

  /**
   * Announce message to screen readers
   */
  const announce = useCallback((
    message: string,
    options: {
      priority?: AnnouncementPriority
      type?: AriaLiveRegionType
      duration?: number
      category?: string
      allowDuplicates?: boolean
      delay?: number
    } = {}
  ) => {
    if (!isAnnouncingEnabled || !message.trim()) return

    const {
      priority = 'medium',
      type = priority === 'high' ? 'assertive' : 'polite',
      duration = 10000,
      category,
      allowDuplicates = false,
      delay = 0
    } = options

    // Check for duplicates unless explicitly allowed
    if (!allowDuplicates && isDuplicateAnnouncement(message, category)) {
      return
    }

    const announcement: AriaAnnouncement = {
      id: `announcement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message: message.trim(),
      priority,
      type,
      timestamp: Date.now(),
      duration,
      category
    }

    if (delay > 0) {
      setTimeout(() => {
        announceImmediate(announcement)
      }, delay)
    } else {
      announceImmediate(announcement)
    }
  }, [isAnnouncingEnabled, isDuplicateAnnouncement])

  /**
   * Announce immediately without queuing
   */
  const announceImmediate = useCallback((announcement: AriaAnnouncement) => {
    const now = Date.now()
    
    // Rate limiting: don't announce more than once every 500ms for non-high priority
    if (announcement.priority !== 'high' && (now - lastAnnouncementTime.current) < 500) {
      setAnnouncementQueue(prev => [...prev, announcement])
      return
    }

    lastAnnouncementTime.current = now

    // Add to announcements state
    setAnnouncements(prev => [...prev, announcement])

    // Update the appropriate live region
    const targetRef = announcement.type === 'assertive' ? assertiveRef : politeRef
    if (targetRef.current) {
      targetRef.current.textContent = announcement.message
      
      // Clear the message after a short delay to allow for new announcements
      const timeoutId = setTimeout(() => {
        if (targetRef.current) {
          targetRef.current.textContent = ''
        }
        timeoutRefs.current.delete(announcement.id)
      }, Math.min(announcement.duration || 5000, 5000))
      
      timeoutRefs.current.set(announcement.id, timeoutId)
    }

    // Auto-cleanup
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== announcement.id))
    }, announcement.duration || 10000)
  }, [])

  /**
   * Process announcement queue
   */
  useEffect(() => {
    if (announcementQueue.length === 0) return

    const processQueue = () => {
      setAnnouncementQueue(prev => {
        if (prev.length === 0) return prev
        
        const [next, ...rest] = prev
        announceImmediate(next)
        return rest
      })
    }

    const interval = setInterval(processQueue, 600) // Process queue every 600ms
    return () => clearInterval(interval)
  }, [announcementQueue, announceImmediate])

  /**
   * Specialized announcement functions
   */
  const announceNavigation = useCallback((destination: string) => {
    announce(`Navigated to ${destination}`, {
      priority: 'medium',
      category: 'navigation',
      duration: 5000
    })
  }, [announce])

  const announceDataUpdate = useCallback((description: string) => {
    announce(`Data updated: ${description}`, {
      priority: 'medium',
      category: 'data-update',
      duration: 7000
    })
  }, [announce])

  const announceError = useCallback((error: string) => {
    announce(`Error: ${error}`, {
      priority: 'high',
      type: 'assertive',
      category: 'error',
      duration: 15000
    })
  }, [announce])

  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, {
      priority: 'medium',
      category: 'success',
      duration: 7000
    })
  }, [announce])

  const announceLoading = useCallback((description: string) => {
    announce(`Loading ${description}`, {
      priority: 'low',
      category: 'loading',
      duration: 5000
    })
  }, [announce])

  const announceProgress = useCallback((current: number, total: number, description?: string) => {
    const percentage = Math.round((current / total) * 100)
    const progressText = description 
      ? `${description}: ${percentage}% complete, ${current} of ${total}` 
      : `${percentage}% complete, ${current} of ${total}`
    
    announce(progressText, {
      priority: 'low',
      category: 'progress',
      duration: 3000,
      allowDuplicates: true // Allow progress updates
    })
  }, [announce])

  const announceStatusChange = useCallback((status: string, context?: string) => {
    const message = context ? `${context}: ${status}` : status
    announce(message, {
      priority: 'medium',
      category: 'status',
      duration: 7000
    })
  }, [announce])

  /**
   * Clear all announcements
   */
  const clearAnnouncements = useCallback(() => {
    setAnnouncements([])
    setAnnouncementQueue([])
    
    // Clear all timeouts
    timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
    timeoutRefs.current.clear()
    
    // Clear live regions
    if (politeRef.current) politeRef.current.textContent = ''
    if (assertiveRef.current) assertiveRef.current.textContent = ''
    if (statusRef.current) statusRef.current.textContent = ''
  }, [])

  /**
   * Toggle announcement system
   */
  const toggleAnnouncements = useCallback((enabled?: boolean) => {
    setIsAnnouncingEnabled(prev => enabled !== undefined ? enabled : !prev)
    if (enabled === false) {
      clearAnnouncements()
    }
  }, [clearAnnouncements])

  /**
   * Get announcement statistics
   */
  const getStats = useCallback(() => {
    const now = Date.now()
    const recent = announcements.filter(a => (now - a.timestamp) < 60000) // Last minute
    
    return {
      total: announcements.length,
      recent: recent.length,
      queued: announcementQueue.length,
      byPriority: {
        high: announcements.filter(a => a.priority === 'high').length,
        medium: announcements.filter(a => a.priority === 'medium').length,
        low: announcements.filter(a => a.priority === 'low').length
      },
      byCategory: announcements.reduce((acc, a) => {
        const cat = a.category || 'uncategorized'
        acc[cat] = (acc[cat] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }
  }, [announcements, announcementQueue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout))
      timeoutRefs.current.clear()
    }
  }, [])

  // Periodic cleanup
  useEffect(() => {
    const interval = setInterval(cleanupAnnouncements, 30000) // Every 30 seconds
    return () => clearInterval(interval)
  }, [cleanupAnnouncements])

  return {
    // Refs for live region elements
    politeRef,
    assertiveRef,
    statusRef,
    
    // State
    announcements,
    announcementQueue,
    isAnnouncingEnabled,
    
    // Core functions
    announce,
    clearAnnouncements,
    toggleAnnouncements,
    
    // Specialized announcement functions
    announceNavigation,
    announceDataUpdate,
    announceError,
    announceSuccess,
    announceLoading,
    announceProgress,
    announceStatusChange,
    
    // Utilities
    getStats
  }
}