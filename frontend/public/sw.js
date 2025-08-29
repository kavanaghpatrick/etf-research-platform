// Service Worker for advanced caching and performance optimization

const CACHE_NAME = 'etf-research-v1'
const STATIC_CACHE_NAME = 'etf-research-static-v1'
const DYNAMIC_CACHE_NAME = 'etf-research-dynamic-v1'
const API_CACHE_NAME = 'etf-research-api-v1'

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/_next/static/css/app/layout.css',
  '/_next/static/css/app/page.css'
]

// API endpoints to cache with different strategies
const API_ENDPOINTS = {
  STOCK_DATA: '/api/fetch-data',
  DIVIDEND_DATA: '/api/dividend-data'
}

// Cache duration in milliseconds
const CACHE_DURATIONS = {
  STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days
  API: 5 * 60 * 1000, // 5 minutes
  DYNAMIC: 24 * 60 * 60 * 1000 // 24 hours
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...')
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        return cache.addAll(STATIC_ASSETS)
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME && 
                cacheName !== API_CACHE_NAME) {
              console.log('Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      }),
      // Take control of all pages immediately
      self.clients.claim()
    ])
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Handle different types of requests
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE_NAME))
  } else if (isAPIRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE_NAME))
  } else if (isNavigationRequest(request)) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME))
  } else {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE_NAME))
  }
})

// Cache strategies

// Cache First - for static assets
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      // Check if cache is still valid
      const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0)
      const now = new Date()
      const isExpired = (now - cachedDate) > CACHE_DURATIONS.STATIC
      
      if (!isExpired) {
        return cachedResponse
      }
    }
    
    // Fetch from network
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      // Clone and cache the response
      const responseToCache = networkResponse.clone()
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cached-date', new Date().toISOString())
      
      const responseWithHeaders = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      })
      
      cache.put(request, responseWithHeaders)
    }
    
    return networkResponse
  } catch (error) {
    // Return cached version if network fails
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for navigation requests
    if (isNavigationRequest(request)) {
      return caches.match('/offline.html') || new Response('Offline', { status: 503 })
    }
    
    throw error
  }
}

// Network First - for dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      const responseToCache = networkResponse.clone()
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cached-date', new Date().toISOString())
      
      const responseWithHeaders = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      })
      
      cache.put(request, responseWithHeaders)
    }
    
    return networkResponse
  } catch (error) {
    // Fallback to cache
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    throw error
  }
}

// Stale While Revalidate - for API requests
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  // Fetch from network in background
  const networkResponsePromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone()
      const headers = new Headers(responseToCache.headers)
      headers.set('sw-cached-date', new Date().toISOString())
      
      const responseWithHeaders = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      })
      
      cache.put(request, responseWithHeaders)
    }
    return networkResponse
  }).catch(() => {
    // Network failed, but we might have cached response
    return null
  })
  
  // Return cached response immediately if available and not expired
  if (cachedResponse) {
    const cachedDate = new Date(cachedResponse.headers.get('sw-cached-date') || 0)
    const now = new Date()
    const isExpired = (now - cachedDate) > CACHE_DURATIONS.API
    
    if (!isExpired) {
      // Update cache in background
      networkResponsePromise
      return cachedResponse
    }
  }
  
  // Wait for network response if no valid cache
  try {
    const networkResponse = await networkResponsePromise
    return networkResponse || cachedResponse || new Response('Service Unavailable', { status: 503 })
  } catch (error) {
    return cachedResponse || new Response('Service Unavailable', { status: 503 })
  }
}

// Helper functions

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/') || 
         url.pathname.includes('.css') ||
         url.pathname.includes('.js') ||
         url.pathname.includes('.png') ||
         url.pathname.includes('.jpg') ||
         url.pathname.includes('.svg') ||
         url.pathname.includes('.ico')
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/')
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'))
}

// Message handling for cache management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'CLEAR_CACHE':
        event.waitUntil(clearAllCaches())
        break
      case 'CLEAR_API_CACHE':
        event.waitUntil(clearAPICache())
        break
      case 'GET_CACHE_SIZE':
        event.waitUntil(getCacheSize().then(size => {
          event.ports[0].postMessage({ size })
        }))
        break
    }
  }
})

async function clearAllCaches() {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map(name => caches.delete(name)))
  console.log('All caches cleared')
}

async function clearAPICache() {
  await caches.delete(API_CACHE_NAME)
  console.log('API cache cleared')
}

async function getCacheSize() {
  let totalSize = 0
  const cacheNames = await caches.keys()
  
  for (const name of cacheNames) {
    const cache = await caches.open(name)
    const keys = await cache.keys()
    
    for (const request of keys) {
      const response = await cache.match(request)
      if (response) {
        const blob = await response.blob()
        totalSize += blob.size
      }
    }
  }
  
  return totalSize
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-api-sync') {
    event.waitUntil(syncOfflineActions())
  }
})

async function syncOfflineActions() {
  // Handle any offline actions that need to be synced
  console.log('Background sync triggered')
}