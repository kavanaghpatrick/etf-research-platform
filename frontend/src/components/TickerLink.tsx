'use client'

import { forwardRef } from 'react'
import Link from 'next/link'

export interface TickerLinkProps {
  /** The ticker symbol to display and link to */
  ticker: string
  /** Optional display text - if not provided, ticker symbol is used */
  displayText?: string
  /** Display variant */
  variant?: 'default' | 'button' | 'inline' | 'badge'
  /** Size variant for touch-friendly interaction */
  size?: 'sm' | 'md' | 'lg'
  /** Whether the link should open in a new tab */
  openInNewTab?: boolean
  /** Additional CSS classes */
  className?: string
  /** Optional click handler (called before navigation) */
  onClick?: (ticker: string) => void
  /** Whether the component is disabled */
  disabled?: boolean
  /** Whether to show an external link icon */
  showIcon?: boolean
  /** ARIA label for accessibility */
  ariaLabel?: string
}

/**
 * TickerLink - A reusable component for displaying clickable ticker symbols
 * 
 * Features:
 * - Mobile-friendly with minimum 44px touch targets
 * - Keyboard accessible with proper focus indicators
 * - Multiple display variants for different contexts
 * - Screen reader support with descriptive ARIA labels
 * - Consistent hover and active states
 */
export const TickerLink = forwardRef<HTMLAnchorElement, TickerLinkProps>(({
  ticker,
  displayText,
  variant = 'default',
  size = 'md',
  openInNewTab = false,
  className = '',
  onClick,
  disabled = false,
  showIcon = false,
  ariaLabel,
  ...props
}, ref) => {
  const upperTicker = ticker.toUpperCase()
  const displayContent = displayText || upperTicker
  const href = `/stock/${ticker.toLowerCase()}`
  
  // Generate appropriate ARIA label
  const defaultAriaLabel = `View ${upperTicker} stock details`
  const finalAriaLabel = ariaLabel || defaultAriaLabel

  // Size classes for minimum touch targets
  const sizeClasses = {
    sm: 'min-h-[32px] min-w-[32px] px-2 py-1 text-xs',
    md: 'min-h-[44px] min-w-[44px] px-3 py-2 text-sm',
    lg: 'min-h-[48px] min-w-[48px] px-4 py-3 text-base'
  }

  // Base classes for all variants
  const baseClasses = `
    inline-flex items-center justify-center
    font-medium
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    ${sizeClasses[size]}
    ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}
  `.trim()

  // Variant-specific classes
  const variantClasses = {
    default: `
      text-blue-600 hover:text-blue-800 
      hover:underline underline-offset-2
      active:text-blue-900
    `,
    button: `
      bg-blue-600 text-white rounded-lg
      hover:bg-blue-700 active:bg-blue-800
      shadow-sm hover:shadow-md
      border border-blue-600 hover:border-blue-700
    `,
    inline: `
      text-blue-600 hover:text-blue-800
      hover:bg-blue-50 rounded px-1
      active:bg-blue-100
    `,
    badge: `
      bg-gray-100 text-gray-800 rounded-full
      hover:bg-blue-100 hover:text-blue-800
      active:bg-blue-200
      border border-gray-200 hover:border-blue-200
    `
  }

  const finalClassName = `
    ${baseClasses}
    ${variantClasses[variant]}
    ${className}
  `.trim()

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(upperTicker)
    }
  }

  const linkProps = {
    href,
    className: finalClassName,
    'aria-label': finalAriaLabel,
    'tabIndex': disabled ? -1 : 0,
    onClick: handleClick,
    ...(openInNewTab && {
      target: '_blank',
      rel: 'noopener noreferrer'
    }),
    ...props
  }

  // Icon component for external links or decorative purposes
  const LinkIcon = showIcon ? (
    <svg 
      className="w-3 h-3 ml-1 flex-shrink-0" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
      />
    </svg>
  ) : null

  if (disabled) {
    return (
      <span 
        className={finalClassName}
        aria-label={finalAriaLabel}
        aria-disabled="true"
        role="text"
      >
        {displayContent}
        {LinkIcon}
      </span>
    )
  }

  return (
    <Link 
      ref={ref}
      {...linkProps}
    >
      <span className="truncate">
        {displayContent}
      </span>
      {LinkIcon}
    </Link>
  )
})

TickerLink.displayName = 'TickerLink'

// Export variant-specific convenience components
export const TickerButton = (props: Omit<TickerLinkProps, 'variant'>) => (
  <TickerLink {...props} variant="button" />
)

export const TickerBadge = (props: Omit<TickerLinkProps, 'variant'>) => (
  <TickerLink {...props} variant="badge" />
)

export const InlineTickerLink = (props: Omit<TickerLinkProps, 'variant'>) => (
  <TickerLink {...props} variant="inline" />
)

// Higher-order component for wrapping text with ticker links
export interface TickerTextProps {
  children: string
  className?: string
  /** Regex pattern to match tickers (default matches 1-5 uppercase letters) */
  tickerPattern?: RegExp
  /** Variant to use for matched tickers */
  linkVariant?: TickerLinkProps['variant']
  /** Size to use for matched tickers */
  linkSize?: TickerLinkProps['size']
}

/**
 * TickerText - Automatically converts ticker symbols in text to clickable links
 * 
 * Example: "I own AAPL and MSFT stocks" -> "I own [AAPL] and [MSFT] stocks"
 * where [AAPL] and [MSFT] are clickable links
 */
export function TickerText({ 
  children, 
  className = '',
  tickerPattern = /\b[A-Z]{1,5}\b/g,
  linkVariant = 'inline',
  linkSize = 'sm'
}: TickerTextProps) {
  const parts = children.split(tickerPattern)
  const matches = children.match(tickerPattern) || []
  
  let matchIndex = 0
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const result = [part]
        
        if (matchIndex < matches.length && index < parts.length - 1) {
          const ticker = matches[matchIndex]
          result.push(
            <TickerLink
              key={`${ticker}-${matchIndex}`}
              ticker={ticker}
              variant={linkVariant}
              size={linkSize}
            />
          )
          matchIndex++
        }
        
        return result
      })}
    </span>
  )
}