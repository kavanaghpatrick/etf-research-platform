'use client'

import React, { useEffect, useRef } from 'react'
import { KeyboardShortcut } from '@/hooks/useKeyboardNavigation'

interface KeyboardShortcutsHelpProps {
  isVisible: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
}

/**
 * Accessible keyboard shortcuts help dialog
 * Provides comprehensive documentation of all available keyboard shortcuts
 */
export function KeyboardShortcutsHelp({ isVisible, onClose, shortcuts }: KeyboardShortcutsHelpProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Manage dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isVisible) {
      dialog.showModal()
      closeButtonRef.current?.focus()
    } else {
      dialog.close()
    }
  }, [isVisible])

  // Handle escape key and backdrop click
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }

    const handleClick = (event: MouseEvent) => {
      if (event.target === dialog) {
        onClose()
      }
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('click', handleClick)

    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('click', handleClick)
    }
  }, [onClose])

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((groups, shortcut) => {
    // Determine category based on shortcut properties
    let category = 'General'
    
    if (shortcut.key.startsWith('Arrow') || ['Home', 'End', 'Tab'].includes(shortcut.key)) {
      category = 'Navigation'
    } else if (shortcut.key.match(/^[1-9]$/)) {
      category = 'Quick Access'
    } else if (shortcut.ctrlKey || shortcut.metaKey) {
      category = 'Application'
    } else if (shortcut.key.length === 1 && shortcut.key.match(/[a-z]/i)) {
      category = 'Actions'
    }

    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(shortcut)
    return groups
  }, {} as Record<string, KeyboardShortcut[]>)

  /**
   * Format keyboard shortcut for display
   */
  const formatShortcut = (shortcut: KeyboardShortcut): string => {
    const modifiers = []
    
    if (shortcut.ctrlKey) modifiers.push('Ctrl')
    if (shortcut.metaKey) modifiers.push('Cmd')
    if (shortcut.altKey) modifiers.push('Alt')
    if (shortcut.shiftKey) modifiers.push('Shift')
    
    const keyName = shortcut.key === ' ' ? 'Space' : shortcut.key
    
    return [...modifiers, keyName].join(' + ')
  }

  if (!isVisible) return null

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black backdrop:bg-opacity-50 bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      aria-labelledby="shortcuts-title"
      aria-describedby="shortcuts-description"
    >
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="shortcuts-title" className="text-2xl font-bold">
              Keyboard Shortcuts
            </h2>
            <p id="shortcuts-description" className="text-blue-100 mt-1">
              Navigate efficiently using these keyboard shortcuts
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-white hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded-lg p-2"
            aria-label="Close keyboard shortcuts help"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
        {Object.keys(groupedShortcuts).length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Shortcuts Available</h3>
            <p className="text-gray-600">
              Keyboard shortcuts have not been configured for this page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
              <div key={category} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                  {category}
                </h3>
                <div className="space-y-3">
                  {categoryShortcuts.map((shortcut, index) => (
                    <div
                      key={`${category}-${index}`}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {shortcut.description}
                        </p>
                        {shortcut.disabled && (
                          <p className="text-xs text-gray-500 mt-1">
                            Currently disabled
                          </p>
                        )}
                      </div>
                      <div className="ml-4">
                        <kbd 
                          className={`inline-flex items-center px-2 py-1 text-xs font-mono bg-white border border-gray-300 rounded shadow-sm ${
                            shortcut.disabled ? 'text-gray-400 bg-gray-100' : 'text-gray-700'
                          }`}
                          aria-label={`Keyboard shortcut: ${formatShortcut(shortcut)}`}
                        >
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Tips for Better Navigation</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use Tab to move forward through interactive elements</li>
            <li>• Use Shift + Tab to move backward through interactive elements</li>
            <li>• Press Enter or Space to activate buttons and links</li>
            <li>• Use arrow keys to navigate within components like tabs and menus</li>
            <li>• Press Escape to close dialogs and menus</li>
            <li>• Press ? (Shift + /) to open this help dialog</li>
          </ul>
        </div>

        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="text-sm font-medium text-green-900 mb-2">Screen Reader Support</h4>
          <p className="text-sm text-green-800">
            This application is optimized for screen readers including NVDA, JAWS, and VoiceOver. 
            All interactive elements include proper ARIA labels and live regions announce important changes.
          </p>
        </div>
      </div>

      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Press <kbd className="px-2 py-1 text-xs font-mono bg-white border border-gray-300 rounded">Escape</kbd> to close
          </p>
          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </dialog>
  )
}

/**
 * Skip links component for keyboard navigation
 */
interface SkipLinksProps {
  links: Array<{ href: string; label: string }>
}

export function SkipLinks({ links }: SkipLinksProps) {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <div className="fixed top-0 left-0 z-50 p-4 bg-blue-600 text-white">
        <h2 className="text-sm font-semibold mb-2">Skip Navigation</h2>
        <nav role="navigation" aria-label="Skip navigation links">
          <ul className="space-y-1">
            {links.map((link, index) => (
              <li key={index}>
                <a
                  href={link.href}
                  className="inline-block px-3 py-2 text-sm bg-blue-700 hover:bg-blue-800 focus:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}