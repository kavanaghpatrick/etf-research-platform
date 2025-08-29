/**
 * @fileoverview UI component library exports
 * @description Central export file for all reusable UI components
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

// Button components
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

// Export component groups for easier imports
export const ButtonComponents = {
  Button,
} as const;

// Re-export all UI components as a namespace
export * as UIComponents from './Button';