'use client'

import Image from 'next/image'
import React, { useState, useCallback, useEffect } from 'react'

export interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  quality?: number
  fill?: boolean
  sizes?: string
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: () => void
}

/**
 * OptimizedImage Component
 * Provides advanced image optimization with responsive loading,
 * lazy loading, and performance monitoring
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  quality = 80,
  fill = false,
  sizes,
  style,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = useCallback(() => {
    setIsLoading(false)
    onLoad?.()
  }, [onLoad])

  const handleError = useCallback(() => {
    setIsLoading(false)
    setHasError(true)
    onError?.()
  }, [onError])

  // Default responsive sizes if not provided
  const defaultSizes = fill 
    ? '100vw'
    : '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw'

  // Generate blur data URL if not provided
  const generateBlurDataURL = (width: number, height: number) => {
    const canvas = typeof window !== 'undefined' ? document.createElement('canvas') : null
    if (!canvas) return undefined
    
    canvas.width = 10
    canvas.height = 10
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    
    ctx.fillStyle = '#f3f4f6'
    ctx.fillRect(0, 0, 10, 10)
    return canvas.toDataURL()
  }

  const effectiveBlurDataURL = blurDataURL || 
    (width && height && placeholder === 'blur' ? generateBlurDataURL(width, height) : undefined)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Loading state */}
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center"
          style={fill ? {} : { width, height }}
        >
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div 
          className="absolute inset-0 bg-gray-100 flex items-center justify-center border border-gray-200 rounded"
          style={fill ? {} : { width, height }}
        >
          <div className="text-center p-4">
            <div className="w-12 h-12 mx-auto mb-2 text-gray-400">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
              </svg>
            </div>
            <p className="text-xs text-gray-500">Image failed to load</p>
          </div>
        </div>
      )}

      {/* Optimized Image */}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={quality}
        placeholder={placeholder}
        blurDataURL={effectiveBlurDataURL}
        sizes={sizes || defaultSizes}
        style={{
          ...style,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
        onLoad={handleLoad}
        onError={handleError}
        // Performance optimizations
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  )
}

/**
 * ResponsiveImage Component
 * Provides responsive image loading with breakpoint-specific sources
 */
export interface ResponsiveImageProps extends Omit<OptimizedImageProps, 'src'> {
  sources: {
    src: string
    media?: string
    type?: string
  }[]
  fallbackSrc: string
}

export function ResponsiveImage({
  sources,
  fallbackSrc,
  ...imageProps
}: ResponsiveImageProps) {
  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.src}
          media={source.media}
          type={source.type}
        />
      ))}
      <OptimizedImage
        src={fallbackSrc}
        {...imageProps}
      />
    </picture>
  )
}

/**
 * LazyImage Component
 * Image with intersection observer for advanced lazy loading
 */
export interface LazyImageProps extends OptimizedImageProps {
  rootMargin?: string
  threshold?: number
}

export function LazyImage({
  rootMargin = '50px',
  threshold = 0.1,
  ...imageProps
}: LazyImageProps) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [ref, setRef] = useState<HTMLDivElement | null>(null)

  // Use intersection observer for advanced lazy loading
  useEffect(() => {
    if (!ref || shouldLoad) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin,
        threshold,
      }
    )

    observer.observe(ref)

    return () => observer.disconnect()
  }, [ref, shouldLoad, rootMargin, threshold])

  return (
    <div ref={setRef}>
      {shouldLoad ? (
        <OptimizedImage {...imageProps} />
      ) : (
        <div 
          className="bg-gray-200 animate-pulse"
          style={{ 
            width: imageProps.width, 
            height: imageProps.height,
            ...(imageProps.fill && { width: '100%', height: '100%' })
          }}
        />
      )}
    </div>
  )
}

export default OptimizedImage