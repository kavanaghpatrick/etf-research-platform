// Real User Monitoring (RUM) implementation

interface RUMConfig {
  sampleRate: number // 0-1, percentage of users to monitor
  endpoint?: string // Where to send metrics
  debug?: boolean
  enableWebVitals?: boolean
  enableResourceTiming?: boolean
  enableUserInteractions?: boolean
  enableErrors?: boolean
}

interface UserSession {
  sessionId: string
  userId?: string
  startTime: number
  pageViews: number
  interactions: number
  errors: number
}

interface PerformanceEvent {
  type: 'webvital' | 'resource' | 'interaction' | 'error' | 'custom'
  name: string
  value: number
  metadata?: Record<string, any>
  timestamp: number
  sessionId: string
  page: string
}

class RealUserMonitor {
  private config: RUMConfig
  private session: UserSession
  private events: PerformanceEvent[] = []
  private observers: PerformanceObserver[] = []
  private flushTimer?: NodeJS.Timeout
  private isActive: boolean = false

  constructor(config: RUMConfig) {
    this.config = {
      sampleRate: 1,
      enableWebVitals: true,
      enableResourceTiming: true,
      enableUserInteractions: true,
      enableErrors: true,
      ...config
    }

    // Initialize session
    this.session = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      pageViews: 0,
      interactions: 0,
      errors: 0
    }

    // Decide if this session should be monitored based on sample rate
    this.isActive = Math.random() < this.config.sampleRate

    if (this.isActive && typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize() {
    if (this.config.enableWebVitals) {
      this.initializeWebVitals()
    }

    if (this.config.enableResourceTiming) {
      this.initializeResourceTiming()
    }

    if (this.config.enableUserInteractions) {
      this.initializeInteractionTracking()
    }

    if (this.config.enableErrors) {
      this.initializeErrorTracking()
    }

    // Track page views
    this.trackPageView()
    this.initializeNavigationTracking()

    // Set up periodic flushing
    this.flushTimer = setInterval(() => this.flush(), 30000) // Every 30 seconds

    // Flush on page unload
    if ('onbeforeunload' in window) {
      window.addEventListener('beforeunload', () => {
        this.flush(true) // Force sync flush
      })
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeWebVitals() {
    if (!('PerformanceObserver' in window)) return

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        this.recordEvent('webvital', 'LCP', lastEntry.startTime, {
          element: (lastEntry as any).element?.tagName,
          size: (lastEntry as any).size,
          loadTime: (lastEntry as any).loadTime
        })
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })
      this.observers.push(lcpObserver)
    } catch (e) {
      this.debug('LCP observer failed:', e)
    }

    // First Input Delay
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const firstInput = list.getEntries()[0] as any
        this.recordEvent('webvital', 'FID', firstInput.processingStart - firstInput.startTime, {
          eventType: firstInput.name,
          target: firstInput.target?.tagName
        })
      })
      fidObserver.observe({ entryTypes: ['first-input'] })
      this.observers.push(fidObserver)
    } catch (e) {
      this.debug('FID observer failed:', e)
    }

    // Cumulative Layout Shift
    try {
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value
            this.recordEvent('webvital', 'CLS', clsValue, {
              sources: (entry as any).sources?.length || 0
            })
          }
        }
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(clsObserver)
    } catch (e) {
      this.debug('CLS observer failed:', e)
    }

    // First Contentful Paint & Time to First Byte
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigationEntry) {
      this.recordEvent('webvital', 'TTFB', navigationEntry.responseStart - navigationEntry.requestStart)
    }

    const paintEntries = performance.getEntriesByType('paint')
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    if (fcp) {
      this.recordEvent('webvital', 'FCP', fcp.startTime)
    }
  }

  private initializeResourceTiming() {
    if (!('PerformanceObserver' in window)) return

    try {
      const resourceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resourceEntry = entry as PerformanceResourceTiming
          
          // Only track significant resources
          if (resourceEntry.duration > 100 || resourceEntry.transferSize > 50000) {
            this.recordEvent('resource', 'resource-load', resourceEntry.duration, {
              url: this.sanitizeUrl(resourceEntry.name),
              type: this.getResourceType(resourceEntry.name),
              size: resourceEntry.transferSize,
              cached: resourceEntry.transferSize === 0,
              protocol: resourceEntry.nextHopProtocol
            })
          }
        }
      })
      resourceObserver.observe({ entryTypes: ['resource'] })
      this.observers.push(resourceObserver)
    } catch (e) {
      this.debug('Resource timing observer failed:', e)
    }
  }

  private initializeInteractionTracking() {
    // Track clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      const selector = this.getElementSelector(target)
      
      this.recordEvent('interaction', 'click', 1, {
        selector,
        text: target.textContent?.substring(0, 50),
        href: (target as HTMLAnchorElement).href
      })
      
      this.session.interactions++
    }, { passive: true, capture: true })

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement
      this.recordEvent('interaction', 'form-submit', 1, {
        formName: form.name || form.id || 'unnamed',
        method: form.method,
        action: this.sanitizeUrl(form.action)
      })
    }, { passive: true, capture: true })

    // Track input changes (debounced)
    let inputTimer: NodeJS.Timeout
    document.addEventListener('input', (event) => {
      clearTimeout(inputTimer)
      inputTimer = setTimeout(() => {
        const target = event.target as HTMLInputElement
        this.recordEvent('interaction', 'input', 1, {
          type: target.type,
          name: target.name || target.id
        })
      }, 1000)
    }, { passive: true, capture: true })
  }

  private initializeErrorTracking() {
    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.recordEvent('error', 'javascript-error', 1, {
        message: event.message,
        filename: this.sanitizeUrl(event.filename || ''),
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack?.substring(0, 500)
      })
      
      this.session.errors++
    })

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordEvent('error', 'unhandled-rejection', 1, {
        reason: String(event.reason).substring(0, 500)
      })
      
      this.session.errors++
    })

    // Resource loading errors
    window.addEventListener('error', (event) => {
      const target = event.target as HTMLElement
      if (target !== window && target.tagName) {
        this.recordEvent('error', 'resource-error', 1, {
          tagName: target.tagName,
          src: this.sanitizeUrl((target as any).src || (target as any).href || '')
        })
      }
    }, true)
  }

  private initializeNavigationTracking() {
    // Track navigation timing
    if ('navigation' in performance && performance.navigation.type === 2) {
      this.recordEvent('custom', 'back-forward-cache-hit', 1)
    }

    // Track route changes (for SPAs)
    let lastPath = window.location.pathname
    const checkNavigation = () => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname
        this.trackPageView()
      }
    }

    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', checkNavigation)

    // Override pushState and replaceState
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function(...args) {
      originalPushState.apply(history, args)
      checkNavigation()
    }

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args)
      checkNavigation()
    }
  }

  private trackPageView() {
    this.session.pageViews++
    
    this.recordEvent('custom', 'page-view', 1, {
      referrer: document.referrer,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth
      },
      connection: this.getConnectionInfo()
    })
  }

  private getConnectionInfo() {
    if ('connection' in navigator) {
      const conn = (navigator as any).connection
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData
      }
    }
    return null
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase() || ''
    const typeMap: Record<string, string> = {
      js: 'script',
      css: 'stylesheet',
      png: 'image',
      jpg: 'image',
      jpeg: 'image',
      gif: 'image',
      svg: 'image',
      webp: 'image',
      woff: 'font',
      woff2: 'font',
      ttf: 'font',
      otf: 'font'
    }
    return typeMap[extension] || 'other'
  }

  private getElementSelector(element: HTMLElement): string {
    const id = element.id ? `#${element.id}` : ''
    const classes = element.className ? `.${element.className.split(' ').join('.')}` : ''
    const tag = element.tagName.toLowerCase()
    return `${tag}${id}${classes}`
  }

  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url)
      // Remove sensitive query parameters
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth']
      sensitiveParams.forEach(param => parsed.searchParams.delete(param))
      return parsed.toString()
    } catch {
      return url
    }
  }

  private recordEvent(
    type: PerformanceEvent['type'],
    name: string,
    value: number,
    metadata?: Record<string, any>
  ) {
    if (!this.isActive) return

    const event: PerformanceEvent = {
      type,
      name,
      value,
      metadata,
      timestamp: Date.now(),
      sessionId: this.session.sessionId,
      page: window.location.pathname
    }

    this.events.push(event)

    if (this.config.debug) {
      console.log('RUM Event:', event)
    }

    // Flush if we have too many events
    if (this.events.length >= 50) {
      this.flush()
    }
  }

  private flush(sync: boolean = false) {
    if (this.events.length === 0) return

    const payload = {
      session: this.session,
      events: [...this.events],
      timestamp: Date.now()
    }

    this.events = [] // Clear events

    if (this.config.endpoint) {
      if (sync && 'sendBeacon' in navigator) {
        // Use sendBeacon for reliable delivery on page unload
        navigator.sendBeacon(this.config.endpoint, JSON.stringify(payload))
      } else {
        // Regular async fetch
        fetch(this.config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(error => {
          this.debug('Failed to send RUM data:', error)
        })
      }
    }

    if (this.config.debug) {
      console.log('RUM Flush:', payload)
    }
  }

  private debug(...args: any[]) {
    if (this.config.debug) {
      console.log('[RUM]', ...args)
    }
  }

  public recordCustomMetric(name: string, value: number, metadata?: Record<string, any>) {
    this.recordEvent('custom', name, value, metadata)
  }

  public setUser(userId: string) {
    this.session.userId = userId
  }

  public cleanup() {
    // Disconnect observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect()
      } catch (e) {
        this.debug('Failed to disconnect observer:', e)
      }
    })
    this.observers = []

    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }

    // Final flush
    this.flush(true)
  }
}

// Global RUM instance
let rumInstance: RealUserMonitor | null = null

export function initializeRUM(config: RUMConfig): RealUserMonitor {
  if (rumInstance) {
    rumInstance.cleanup()
  }
  
  rumInstance = new RealUserMonitor(config)
  
  // Expose to window for debugging
  if (typeof window !== 'undefined' && config.debug) {
    (window as any).__RUM__ = rumInstance
  }
  
  return rumInstance
}

export function getRUM(): RealUserMonitor | null {
  return rumInstance
}

// React hook for RUM
export function useRUM() {
  return {
    recordMetric: (name: string, value: number, metadata?: Record<string, any>) => {
      rumInstance?.recordCustomMetric(name, value, metadata)
    },
    setUser: (userId: string) => {
      rumInstance?.setUser(userId)
    }
  }
}

// Performance marks and measures wrapper
export function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const startMark = `${name}-start`
  const endMark = `${name}-end`
  
  performance.mark(startMark)
  
  const result = fn()
  
  if (result instanceof Promise) {
    return result.finally(() => {
      performance.mark(endMark)
      performance.measure(name, startMark, endMark)
      
      const measure = performance.getEntriesByName(name, 'measure')[0]
      rumInstance?.recordCustomMetric(`timing-${name}`, measure.duration)
    })
  } else {
    performance.mark(endMark)
    performance.measure(name, startMark, endMark)
    
    const measure = performance.getEntriesByName(name, 'measure')[0]
    rumInstance?.recordCustomMetric(`timing-${name}`, measure.duration)
    
    return result
  }
}