'use client'

// Service Worker registration and management utilities

interface ServiceWorkerAPI {
  register: () => Promise<ServiceWorkerRegistration | null>
  unregister: () => Promise<boolean>
  update: () => Promise<ServiceWorkerRegistration | null>
  clearCache: () => Promise<void>
  clearAPICache: () => Promise<void>
  getCacheSize: () => Promise<number>
  isSupported: boolean
  isRegistered: boolean
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null
  private updateAvailable = false
  private listeners: { [event: string]: Function[] } = {}

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupUpdateListener()
    }
  }

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator
  }

  get isRegistered(): boolean {
    return this.registration !== null
  }

  private setupUpdateListener() {
    if (!this.isSupported) return

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      this.emit('controllerchange')
      // Reload the page when new service worker takes control
      if (this.updateAvailable) {
        window.location.reload()
      }
    })
  }

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isSupported) {
      console.warn('Service Workers not supported')
      return null
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none' // Always check for updates
      })

      console.log('Service Worker registered successfully')

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration!.installing
        if (newWorker) {
          this.handleNewWorker(newWorker)
        }
      })

      // Check if there's already an update available
      if (this.registration.waiting) {
        this.updateAvailable = true
        this.emit('updateavailable', this.registration.waiting)
      }

      // Check if service worker is controlling the page
      if (!navigator.serviceWorker.controller) {
        console.log('Service Worker not controlling page yet')
      }

      return this.registration
    } catch (error) {
      console.error('Service Worker registration failed:', error)
      return null
    }
  }

  private handleNewWorker(worker: ServiceWorker) {
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New worker is available
          this.updateAvailable = true
          this.emit('updateavailable', worker)
        } else {
          // First install
          this.emit('firstinstall')
        }
      }
    })
  }

  async update(): Promise<ServiceWorkerRegistration | null> {
    if (!this.registration) {
      return await this.register()
    }

    try {
      await this.registration.update()
      return this.registration
    } catch (error) {
      console.error('Service Worker update failed:', error)
      return null
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false
    }

    try {
      const result = await this.registration.unregister()
      if (result) {
        this.registration = null
        console.log('Service Worker unregistered successfully')
      }
      return result
    } catch (error) {
      console.error('Service Worker unregistration failed:', error)
      return false
    }
  }

  async clearCache(): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker to clear cache')
      return
    }

    const messageChannel = new MessageChannel()
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = () => {
        resolve()
      }
      
      navigator.serviceWorker.controller!.postMessage(
        { type: 'CLEAR_CACHE' },
        [messageChannel.port2]
      )
    })
  }

  async clearAPICache(): Promise<void> {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker to clear API cache')
      return
    }

    const messageChannel = new MessageChannel()
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = () => {
        resolve()
      }
      
      navigator.serviceWorker.controller!.postMessage(
        { type: 'CLEAR_API_CACHE' },
        [messageChannel.port2]
      )
    })
  }

  async getCacheSize(): Promise<number> {
    if (!navigator.serviceWorker.controller) {
      return 0
    }

    const messageChannel = new MessageChannel()
    
    return new Promise((resolve) => {
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.size || 0)
      }
      
      navigator.serviceWorker.controller!.postMessage(
        { type: 'GET_CACHE_SIZE' },
        [messageChannel.port2]
      )
    })
  }

  activateWaitingWorker(): void {
    if (!this.registration?.waiting) {
      return
    }

    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' })
  }

  // Event emitter methods
  on(event: string, callback: Function): void {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  off(event: string, callback: Function): void {
    if (!this.listeners[event]) return
    
    const index = this.listeners[event].indexOf(callback)
    if (index > -1) {
      this.listeners[event].splice(index, 1)
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (!this.listeners[event]) return
    
    this.listeners[event].forEach(callback => {
      try {
        callback(...args)
      } catch (error) {
        console.error('Service Worker event handler error:', error)
      }
    })
  }
}

// Global instance
export const serviceWorker = new ServiceWorkerManager()

// React hook for service worker
export function useServiceWorker(): ServiceWorkerAPI & {
  updateAvailable: boolean
  activateUpdate: () => void
} {
  const [updateAvailable, setUpdateAvailable] = React.useState(false)

  React.useEffect(() => {
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true)
    }

    const handleControllerChange = () => {
      setUpdateAvailable(false)
    }

    serviceWorker.on('updateavailable', handleUpdateAvailable)
    serviceWorker.on('controllerchange', handleControllerChange)

    // Register service worker on mount
    serviceWorker.register()

    return () => {
      serviceWorker.off('updateavailable', handleUpdateAvailable)
      serviceWorker.off('controllerchange', handleControllerChange)
    }
  }, [])

  const activateUpdate = React.useCallback(() => {
    serviceWorker.activateWaitingWorker()
  }, [])

  return {
    register: serviceWorker.register.bind(serviceWorker),
    unregister: serviceWorker.unregister.bind(serviceWorker),
    update: serviceWorker.update.bind(serviceWorker),
    clearCache: serviceWorker.clearCache.bind(serviceWorker),
    clearAPICache: serviceWorker.clearAPICache.bind(serviceWorker),
    getCacheSize: serviceWorker.getCacheSize.bind(serviceWorker),
    isSupported: serviceWorker.isSupported,
    isRegistered: serviceWorker.isRegistered,
    updateAvailable,
    activateUpdate
  }
}

// Utility function to check if app is running offline
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// Add React import for hooks
import React from 'react'