/**
 * Asset Preloader Utilities
 * Provides intelligent asset preloading strategies for optimal performance
 */

export interface PreloadConfig {
  priority: 'high' | 'medium' | 'low'
  crossOrigin?: 'anonymous' | 'use-credentials'
  type?: string
  media?: string
  as?: 'script' | 'style' | 'font' | 'image' | 'video' | 'audio' | 'document'
}

export interface PreloadResource {
  url: string
  config: PreloadConfig
}

/**
 * Asset Preloader Class
 * Manages intelligent preloading of critical resources
 */
export class AssetPreloader {
  private preloadedResources = new Set<string>()
  private preloadQueue: PreloadResource[] = []
  private isProcessing = false

  /**
   * Add resource to preload queue
   */
  addResource(url: string, config: PreloadConfig): void {
    if (this.preloadedResources.has(url)) {
      return
    }

    this.preloadQueue.push({ url, config })
    this.processQueue()
  }

  /**
   * Process preload queue with priority handling
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.preloadQueue.length === 0) {
      return
    }

    this.isProcessing = true

    // Sort by priority
    this.preloadQueue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.config.priority] - priorityOrder[a.config.priority]
    })

    while (this.preloadQueue.length > 0) {
      const resource = this.preloadQueue.shift()!
      await this.preloadResource(resource)
    }

    this.isProcessing = false
  }

  /**
   * Preload a specific resource
   */
  private async preloadResource(resource: PreloadResource): Promise<void> {
    const { url, config } = resource

    if (this.preloadedResources.has(url)) {
      return
    }

    try {
      // Use different strategies based on resource type
      if (config.as === 'script') {
        await this.preloadScript(url, config)
      } else if (config.as === 'style') {
        await this.preloadStylesheet(url, config)
      } else if (config.as === 'font') {
        await this.preloadFont(url, config)
      } else if (config.as === 'image') {
        await this.preloadImage(url, config)
      } else {
        await this.preloadGeneric(url, config)
      }

      this.preloadedResources.add(url)
    } catch (error) {
      console.warn(`Failed to preload resource: ${url}`, error)
    }
  }

  /**
   * Preload JavaScript modules
   */
  private async preloadScript(url: string, config: PreloadConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      // Use modulepreload for ES modules
      const link = document.createElement('link')
      link.rel = 'modulepreload'
      link.href = url
      if (config.crossOrigin) link.crossOrigin = config.crossOrigin
      
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to preload script: ${url}`))
      
      document.head.appendChild(link)
    })
  }

  /**
   * Preload stylesheets
   */
  private async preloadStylesheet(url: string, config: PreloadConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'style'
      link.href = url
      if (config.media) link.media = config.media
      if (config.crossOrigin) link.crossOrigin = config.crossOrigin
      
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to preload stylesheet: ${url}`))
      
      document.head.appendChild(link)
    })
  }

  /**
   * Preload fonts
   */
  private async preloadFont(url: string, config: PreloadConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'font'
      link.href = url
      link.crossOrigin = 'anonymous' // Required for fonts
      if (config.type) link.type = config.type
      
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to preload font: ${url}`))
      
      document.head.appendChild(link)
    })
  }

  /**
   * Preload images
   */
  private async preloadImage(url: string, config: PreloadConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(`Failed to preload image: ${url}`))
      img.src = url
    })
  }

  /**
   * Generic preload using link rel="preload"
   */
  private async preloadGeneric(url: string, config: PreloadConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = url
      if (config.as) link.as = config.as
      if (config.type) link.type = config.type
      if (config.crossOrigin) link.crossOrigin = config.crossOrigin
      if (config.media) link.media = config.media
      
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to preload resource: ${url}`))
      
      document.head.appendChild(link)
    })
  }

  /**
   * Preload critical resources immediately
   */
  preloadCritical(): void {
    // Critical CSS
    this.addResource('/styles/critical.css', {
      priority: 'high',
      as: 'style',
    })

    // Essential fonts
    this.addResource('/fonts/inter-var.woff2', {
      priority: 'high',
      as: 'font',
      type: 'font/woff2',
    })

    // Chart library modules (critical for stock pages)
    this.addResource('/_next/static/chunks/charts.js', {
      priority: 'high',
      as: 'script',
    })
  }

  /**
   * Preload route-specific resources
   */
  preloadRoute(route: string): void {
    const routeResources = this.getRouteResources(route)
    routeResources.forEach(resource => {
      this.addResource(resource.url, resource.config)
    })
  }

  /**
   * Get resources for specific routes
   */
  private getRouteResources(route: string): PreloadResource[] {
    const resources: PreloadResource[] = []

    if (route.startsWith('/stock/')) {
      // Stock page specific resources
      resources.push(
        {
          url: '/_next/static/chunks/stock-detail.js',
          config: { priority: 'medium', as: 'script' }
        },
        {
          url: '/_next/static/chunks/charts.js',
          config: { priority: 'high', as: 'script' }
        }
      )
    }

    if (route === '/') {
      // Homepage specific resources
      resources.push(
        {
          url: '/_next/static/chunks/dashboard.js',
          config: { priority: 'medium', as: 'script' }
        }
      )
    }

    return resources
  }

  /**
   * Clear preloaded resources (for memory management)
   */
  clear(): void {
    this.preloadedResources.clear()
    this.preloadQueue.length = 0
  }
}

/**
 * Progressive Enhancement Strategy
 */
export class ProgressiveEnhancer {
  private features = new Map<string, boolean>()
  
  /**
   * Check if browser supports a feature
   */
  supports(feature: string): boolean {
    if (this.features.has(feature)) {
      return this.features.get(feature)!
    }

    let supported = false

    switch (feature) {
      case 'webp':
        supported = this.supportsWebP()
        break
      case 'avif':
        supported = this.supportsAVIF()
        break
      case 'intersection-observer':
        supported = 'IntersectionObserver' in window
        break
      case 'service-worker':
        supported = 'serviceWorker' in navigator
        break
      case 'web-workers':
        supported = 'Worker' in window
        break
      case 'local-storage':
        supported = this.supportsLocalStorage()
        break
      default:
        supported = false
    }

    this.features.set(feature, supported)
    return supported
  }

  /**
   * Check WebP support
   */
  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
  }

  /**
   * Check AVIF support
   */
  private supportsAVIF(): boolean {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0
  }

  /**
   * Check localStorage support
   */
  private supportsLocalStorage(): boolean {
    try {
      const test = '__localStorage_test__'
      localStorage.setItem(test, 'test')
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  /**
   * Load enhanced features progressively
   */
  async enhanceFeatures(): Promise<void> {
    // Load service worker if supported
    if (this.supports('service-worker')) {
      await this.loadServiceWorker()
    }

    // Load web workers if supported
    if (this.supports('web-workers')) {
      await this.loadWebWorkers()
    }

    // Enable advanced image formats
    if (this.supports('webp') || this.supports('avif')) {
      this.enableAdvancedImageFormats()
    }
  }

  /**
   * Load service worker
   */
  private async loadServiceWorker(): Promise<void> {
    try {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js')
        console.log('Service Worker registered successfully')
      }
    } catch (error) {
      console.warn('Service Worker registration failed:', error)
    }
  }

  /**
   * Load web workers for background processing
   */
  private async loadWebWorkers(): Promise<void> {
    try {
      // Preload data processing worker
      const worker = new Worker('/workers/dataProcessor.js')
      worker.postMessage({ type: 'init' })
      
      // Store worker reference for later use
      ;(window as any).__dataWorker = worker
    } catch (error) {
      console.warn('Web Worker initialization failed:', error)
    }
  }

  /**
   * Enable advanced image formats
   */
  private enableAdvancedImageFormats(): void {
    // Add CSS class to enable advanced image formats
    document.documentElement.classList.add('supports-modern-images')
  }
}

// Global instances
export const assetPreloader = new AssetPreloader()
export const progressiveEnhancer = new ProgressiveEnhancer()

// Initialize on load
if (typeof window !== 'undefined') {
  // Preload critical resources immediately
  assetPreloader.preloadCritical()
  
  // Progressive enhancement
  progressiveEnhancer.enhanceFeatures()
}

export default {
  AssetPreloader,
  ProgressiveEnhancer,
  assetPreloader,
  progressiveEnhancer,
}