'use client'

// Memory management and leak detection utilities

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface SubscriptionTracker {
  id: string
  type: string
  component: string
  created: number
  cleanup?: () => void
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
  size?: number
}

class MemoryManager {
  private subscriptions = new Map<string, SubscriptionTracker>()
  private memoryChecks: number[] = []
  private caches = new Map<string, Map<string, CacheEntry<any>>>()
  private memoryCheckInterval: NodeJS.Timeout | null = null
  private leakDetectionThreshold = 50 * 1024 * 1024 // 50MB
  private maxCacheSize = 100 * 1024 * 1024 // 100MB total cache
  private maxCacheAge = 30 * 60 * 1000 // 30 minutes

  constructor() {
    if (typeof window !== 'undefined') {
      this.startMemoryMonitoring()
    }
  }

  // Subscription tracking
  trackSubscription(
    id: string,
    type: 'event' | 'interval' | 'timeout' | 'observer' | 'websocket' | 'other',
    component: string,
    cleanup?: () => void
  ): string {
    const subscriptionId = `${component}-${type}-${id}-${Date.now()}`
    
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      type,
      component,
      created: Date.now(),
      cleanup
    })

    return subscriptionId
  }

  untrackSubscription(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (subscription) {
      try {
        subscription.cleanup?.()
      } catch (error) {
        console.warn('Error during subscription cleanup:', error)
      }
      return this.subscriptions.delete(subscriptionId)
    }
    return false
  }

  // Component cleanup - removes all subscriptions for a component
  cleanupComponent(componentName: string): number {
    let cleaned = 0
    
    this.subscriptions.forEach((subscription, id) => {
      if (subscription.component === componentName) {
        try {
          subscription.cleanup?.()
          this.subscriptions.delete(id)
          cleaned++
        } catch (error) {
          console.warn(`Error cleaning up subscription ${id}:`, error)
        }
      }
    })

    return cleaned
  }

  // Cache management
  createCache<T>(name: string): {
    set: (key: string, value: T, ttl?: number) => void
    get: (key: string) => T | null
    delete: (key: string) => boolean
    clear: () => void
    size: () => number
  } {
    if (!this.caches.has(name)) {
      this.caches.set(name, new Map())
    }

    const cache = this.caches.get(name)!

    return {
      set: (key: string, value: T, ttl?: number) => {
        const entry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          accessCount: 0,
          lastAccessed: Date.now(),
          size: this.estimateObjectSize(value)
        }

        cache.set(key, entry)
        this.enforceMemoryLimits()
      },

      get: (key: string) => {
        const entry = cache.get(key)
        if (!entry) return null

        // Check if expired
        const maxAge = ttl || this.maxCacheAge
        if (Date.now() - entry.timestamp > maxAge) {
          cache.delete(key)
          return null
        }

        // Update access info
        entry.accessCount++
        entry.lastAccessed = Date.now()

        return entry.data
      },

      delete: (key: string) => {
        return cache.delete(key)
      },

      clear: () => {
        cache.clear()
      },

      size: () => {
        return cache.size
      }
    }
  }

  // Memory monitoring
  private startMemoryMonitoring(): void {
    if (!this.supportsMemoryAPI()) return

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage()
    }, 10000) // Check every 10 seconds
  }

  private checkMemoryUsage(): void {
    if (!this.supportsMemoryAPI()) return

    const memory = (performance as any).memory as MemoryInfo
    const currentUsage = memory.usedJSHeapSize

    this.memoryChecks.push(currentUsage)

    // Keep only last 10 checks
    if (this.memoryChecks.length > 10) {
      this.memoryChecks.shift()
    }

    // Detect potential memory leaks
    if (this.memoryChecks.length >= 5) {
      const trend = this.calculateMemoryTrend()
      if (trend > this.leakDetectionThreshold) {
        this.handlePotentialLeak(currentUsage, trend)
      }
    }

    // Enforce memory limits
    if (currentUsage > memory.jsHeapSizeLimit * 0.8) {
      this.performEmergencyCleanup()
    }
  }

  private calculateMemoryTrend(): number {
    if (this.memoryChecks.length < 2) return 0

    const recent = this.memoryChecks.slice(-3)
    const older = this.memoryChecks.slice(-6, -3)

    if (older.length === 0) return 0

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length

    return recentAvg - olderAvg
  }

  private handlePotentialLeak(currentUsage: number, trend: number): void {
    console.warn('Potential memory leak detected:', {
      currentUsage: `${(currentUsage / 1024 / 1024).toFixed(2)}MB`,
      trend: `+${(trend / 1024 / 1024).toFixed(2)}MB`,
      activeSubscriptions: this.subscriptions.size,
      cacheSize: this.getTotalCacheSize()
    })

    // Perform cleanup
    this.performCleanup()

    // Emit warning event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memoryWarning', {
        detail: { currentUsage, trend }
      }))
    }
  }

  private performCleanup(): void {
    // Clean up old cache entries
    this.caches.forEach((cache, name) => {
      const entries = Array.from(cache.entries())
      
      // Sort by last accessed (least recently used first)
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      
      // Remove old entries (older than max age)
      const now = Date.now()
      let removed = 0
      
      entries.forEach(([key, entry]) => {
        if (now - entry.timestamp > this.maxCacheAge) {
          cache.delete(key)
          removed++
        }
      })

      if (removed > 0) {
        console.log(`Cleaned up ${removed} expired entries from ${name} cache`)
      }
    })

    // Clean up orphaned subscriptions (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    let cleanedSubscriptions = 0
    
    this.subscriptions.forEach((subscription, id) => {
      if (subscription.created < oneHourAgo) {
        this.untrackSubscription(id)
        cleanedSubscriptions++
      }
    })

    if (cleanedSubscriptions > 0) {
      console.log(`Cleaned up ${cleanedSubscriptions} orphaned subscriptions`)
    }
  }

  private performEmergencyCleanup(): void {
    console.warn('Emergency memory cleanup triggered')
    
    // Clear all caches
    this.caches.forEach((cache) => cache.clear())
    
    // Force garbage collection if available
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc()
      } catch (e) {
        // Ignore if GC is not available
      }
    }
    
    // Emit emergency cleanup event
    window.dispatchEvent(new CustomEvent('emergencyMemoryCleanup'))
  }

  private enforceMemoryLimits(): void {
    const totalSize = this.getTotalCacheSize()
    
    if (totalSize > this.maxCacheSize) {
      // Remove least recently used entries across all caches
      const allEntries: Array<{ cacheName: string; key: string; entry: CacheEntry<any> }> = []
      
      this.caches.forEach((cache, cacheName) => {
        cache.forEach((entry, key) => {
          allEntries.push({ cacheName, key, entry })
        })
      })
      
      // Sort by access count and last accessed time
      allEntries.sort((a, b) => {
        if (a.entry.accessCount !== b.entry.accessCount) {
          return a.entry.accessCount - b.entry.accessCount
        }
        return a.entry.lastAccessed - b.entry.lastAccessed
      })
      
      // Remove entries until under limit
      let currentSize = totalSize
      let removed = 0
      
      for (const { cacheName, key, entry } of allEntries) {
        if (currentSize <= this.maxCacheSize * 0.8) break // Leave some headroom
        
        const cache = this.caches.get(cacheName)
        if (cache && cache.delete(key)) {
          currentSize -= entry.size || 0
          removed++
        }
      }
      
      if (removed > 0) {
        console.log(`Removed ${removed} cache entries to enforce memory limits`)
      }
    }
  }

  private getTotalCacheSize(): number {
    let totalSize = 0
    
    this.caches.forEach((cache) => {
      cache.forEach((entry) => {
        totalSize += entry.size || 0
      })
    })
    
    return totalSize
  }

  private estimateObjectSize(obj: any): number {
    try {
      // Rough estimation of object size
      const jsonString = JSON.stringify(obj)
      return jsonString.length * 2 // UTF-16 uses 2 bytes per character
    } catch (e) {
      return 1000 // Default estimate for non-serializable objects
    }
  }

  private supportsMemoryAPI(): boolean {
    return typeof performance !== 'undefined' && 'memory' in performance
  }

  // Public API
  getMemoryInfo(): MemoryInfo | null {
    if (!this.supportsMemoryAPI()) return null
    return (performance as any).memory
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size
  }

  getActiveSubscriptions(): SubscriptionTracker[] {
    return Array.from(this.subscriptions.values())
  }

  clearAllCaches(): void {
    this.caches.forEach((cache) => cache.clear())
  }

  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
    }
    
    // Cleanup all subscriptions
    this.subscriptions.forEach((subscription, id) => {
      this.untrackSubscription(id)
    })
    
    this.clearAllCaches()
  }
}

// Global instance
export const memoryManager = new MemoryManager()

// React hooks
export function useMemoryTracking(componentName: string) {
  const subscriptionIds = React.useRef<string[]>([])

  const trackSubscription = React.useCallback((
    id: string,
    type: 'event' | 'interval' | 'timeout' | 'observer' | 'websocket' | 'other',
    cleanup?: () => void
  ) => {
    const subscriptionId = memoryManager.trackSubscription(id, type, componentName, cleanup)
    subscriptionIds.current.push(subscriptionId)
    return subscriptionId
  }, [componentName])

  const untrackSubscription = React.useCallback((subscriptionId: string) => {
    const index = subscriptionIds.current.indexOf(subscriptionId)
    if (index > -1) {
      subscriptionIds.current.splice(index, 1)
    }
    return memoryManager.untrackSubscription(subscriptionId)
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      subscriptionIds.current.forEach(id => {
        memoryManager.untrackSubscription(id)
      })
      subscriptionIds.current = []
    }
  }, [])

  return { trackSubscription, untrackSubscription }
}

export function useMemoryCache<T>(cacheName: string) {
  const cache = React.useMemo(() => memoryManager.createCache<T>(cacheName), [cacheName])
  
  React.useEffect(() => {
    return () => {
      cache.clear()
    }
  }, [cache])
  
  return cache
}

export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = React.useState<MemoryInfo | null>(null)
  const [subscriptionCount, setSubscriptionCount] = React.useState(0)

  React.useEffect(() => {
    const updateInfo = () => {
      setMemoryInfo(memoryManager.getMemoryInfo())
      setSubscriptionCount(memoryManager.getSubscriptionCount())
    }

    updateInfo()
    const interval = setInterval(updateInfo, 5000)

    return () => clearInterval(interval)
  }, [])

  return { memoryInfo, subscriptionCount }
}

// Add React import
import React from 'react'