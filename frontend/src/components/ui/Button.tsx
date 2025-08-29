/**
 * @fileoverview Button component with multiple variants and accessibility features
 * @description Reusable button component following design system principles
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

'use client';

import { forwardRef, memo } from 'react';
import { ComponentErrorBoundary } from '@/components/errors/ErrorBoundaryHierarchy';

/** Button variants */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'ghost';

/** Button sizes */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

/** Button props interface */
export interface ButtonProps {
  /** Button content */
  readonly children: React.ReactNode;
  /** Button variant styling */
  readonly variant?: ButtonVariant;
  /** Button size */
  readonly size?: ButtonSize;
  /** Whether button is disabled */
  readonly disabled?: boolean;
  /** Whether button is loading */
  readonly loading?: boolean;
  /** Button type */
  readonly type?: 'button' | 'submit' | 'reset';
  /** Additional CSS classes */
  readonly className?: string;
  /** Click handler */
  readonly onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** ARIA label for accessibility */
  readonly 'aria-label'?: string;
  /** Test identifier */
  readonly 'data-testid'?: string;
  /** Icon to display before text */
  readonly iconBefore?: React.ReactNode;
  /** Icon to display after text */
  readonly iconAfter?: React.ReactNode;
  /** Whether button takes full width */
  readonly fullWidth?: boolean;
}

/**
 * Gets variant-specific CSS classes
 * 
 * @param variant - Button variant
 * @returns CSS classes for the variant
 */
const getVariantClasses = (variant: ButtonVariant): string => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 border-transparent',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 border-gray-300',
    tertiary: 'bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500 border-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 border-transparent',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 border-transparent',
  };
  
  return variants[variant];
};

/**
 * Gets size-specific CSS classes
 * 
 * @param size - Button size
 * @returns CSS classes for the size
 */
const getSizeClasses = (size: ButtonSize): string => {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  };
  
  return sizes[size];
};

/**
 * Loading spinner component
 */
const LoadingSpinner = memo(function LoadingSpinner({ size }: { size: ButtonSize }) {
  const spinnerSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
  };

  return (
    <svg
      className={`animate-spin ${spinnerSizes[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

/**
 * Button component with comprehensive styling and accessibility features
 * 
 * @param props - Button props
 * @param ref - Forward ref to button element
 * @returns JSX element representing the button
 * 
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
export const Button = memo(forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  type = 'button',
  className = '',
  onClick,
  'aria-label': ariaLabel,
  'data-testid': testId = 'button',
  iconBefore,
  iconAfter,
  fullWidth = false,
}, ref) {
  const baseClasses = [
    'inline-flex items-center justify-center',
    'font-medium rounded-md border',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'transition-colors duration-200',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    'disabled:hover:bg-current', // Prevent hover effects when disabled
  ];

  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);
  const widthClasses = fullWidth ? 'w-full' : '';

  const allClasses = [
    ...baseClasses,
    variantClasses,
    sizeClasses,
    widthClasses,
    className,
  ].filter(Boolean).join(' ');

  const isDisabled = disabled || loading;

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <ComponentErrorBoundary componentName="Button" severity="low">
      <button
        ref={ref}
        type={type}
        className={allClasses}
        disabled={isDisabled}
        onClick={handleClick}
        aria-label={ariaLabel}
        aria-disabled={isDisabled}
        data-testid={testId}
      >
        {loading && (
          <LoadingSpinner size={size} />
        )}
        {!loading && iconBefore && (
          <span className="mr-2">{iconBefore}</span>
        )}
        {!loading && children}
        {!loading && iconAfter && (
          <span className="ml-2">{iconAfter}</span>
        )}
      </button>
    </ComponentErrorBoundary>
  );
}));

Button.displayName = 'Button';