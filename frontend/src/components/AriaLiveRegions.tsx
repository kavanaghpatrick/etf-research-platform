'use client'

import React, { forwardRef, useImperativeHandle } from 'react'
import { useAriaLiveRegions } from '@/hooks/useAriaLiveRegions'

export interface AriaLiveRegionsRef {
  announce: ReturnType<typeof useAriaLiveRegions>['announce']
  announceNavigation: ReturnType<typeof useAriaLiveRegions>['announceNavigation']
  announceDataUpdate: ReturnType<typeof useAriaLiveRegions>['announceDataUpdate']
  announceError: ReturnType<typeof useAriaLiveRegions>['announceError']
  announceSuccess: ReturnType<typeof useAriaLiveRegions>['announceSuccess']
  announceLoading: ReturnType<typeof useAriaLiveRegions>['announceLoading']
  announceProgress: ReturnType<typeof useAriaLiveRegions>['announceProgress']
  announceStatusChange: ReturnType<typeof useAriaLiveRegions>['announceStatusChange']
  clearAnnouncements: ReturnType<typeof useAriaLiveRegions>['clearAnnouncements']
  toggleAnnouncements: ReturnType<typeof useAriaLiveRegions>['toggleAnnouncements']
  getStats: ReturnType<typeof useAriaLiveRegions>['getStats']
}

interface AriaLiveRegionsProps {
  showDebugInfo?: boolean
  className?: string
}

/**
 * ARIA Live Regions component that provides accessible announcements
 * This component should be placed once at the app level
 */
export const AriaLiveRegions = forwardRef<AriaLiveRegionsRef, AriaLiveRegionsProps>(
  function AriaLiveRegions({ showDebugInfo = false, className = '' }, ref) {
    const {
      politeRef,
      assertiveRef,
      statusRef,
      announcements,
      announcementQueue,
      isAnnouncingEnabled,
      announce,
      announceNavigation,
      announceDataUpdate,
      announceError,
      announceSuccess,
      announceLoading,
      announceProgress,
      announceStatusChange,
      clearAnnouncements,
      toggleAnnouncements,
      getStats
    } = useAriaLiveRegions()

    // Expose methods through ref
    useImperativeHandle(ref, () => ({
      announce,
      announceNavigation,
      announceDataUpdate,
      announceError,
      announceSuccess,
      announceLoading,
      announceProgress,
      announceStatusChange,
      clearAnnouncements,
      toggleAnnouncements,
      getStats
    }), [
      announce,
      announceNavigation,
      announceDataUpdate,
      announceError,
      announceSuccess,
      announceLoading,
      announceProgress,
      announceStatusChange,
      clearAnnouncements,
      toggleAnnouncements,
      getStats
    ])

    const stats = getStats()

    return (
      <div className={`sr-only ${className}`}>
        {/* Polite live region for non-urgent announcements */}
        <div
          ref={politeRef}
          aria-live="polite"
          aria-atomic="true"
          role="status"
          className="sr-only"
          aria-label="Non-urgent notifications"
        />
        
        {/* Assertive live region for urgent announcements */}
        <div
          ref={assertiveRef}
          aria-live="assertive"
          aria-atomic="true"
          role="alert"
          className="sr-only"
          aria-label="Important notifications"
        />
        
        {/* Status region for status updates */}
        <div
          ref={statusRef}
          aria-live="polite"
          aria-atomic="false"
          role="status"
          className="sr-only"
          aria-label="Status updates"
        />

        {/* Debug information (only visible when showDebugInfo is true) */}
        {showDebugInfo && (
          <div className="not-sr-only fixed bottom-4 right-4 bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs max-w-sm z-50">
            <h3 className="font-bold mb-2">ARIA Live Regions Debug</h3>
            <div className="space-y-1">
              <div>Status: {isAnnouncingEnabled ? 'Enabled' : 'Disabled'}</div>
              <div>Total Announcements: {stats.total}</div>
              <div>Recent (1min): {stats.recent}</div>
              <div>Queued: {stats.queued}</div>
              <div>High Priority: {stats.byPriority.high}</div>
              <div>Medium Priority: {stats.byPriority.medium}</div>
              <div>Low Priority: {stats.byPriority.low}</div>
            </div>
            
            {Object.keys(stats.byCategory).length > 0 && (
              <>
                <h4 className="font-semibold mt-2 mb-1">By Category:</h4>
                <div className="space-y-1">
                  {Object.entries(stats.byCategory).map(([category, count]) => (
                    <div key={category} className="text-xs">
                      {category}: {count}
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {announcements.length > 0 && (
              <>
                <h4 className="font-semibold mt-2 mb-1">Recent Announcements:</h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {announcements.slice(-5).map(announcement => (
                    <div key={announcement.id} className="text-xs border-l-2 border-blue-400 pl-2">
                      <div className="font-mono text-blue-200">
                        {announcement.priority} | {announcement.type}
                      </div>
                      <div className="truncate">
                        {announcement.message}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            <button
              onClick={() => toggleAnnouncements()}
              className="mt-2 px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
            >
              {isAnnouncingEnabled ? 'Disable' : 'Enable'}
            </button>
            
            <button
              onClick={clearAnnouncements}
              className="mt-2 ml-2 px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
            >
              Clear
            </button>
          </div>
        )}
      </div>
    )
  }
)

/**
 * Hook to use ARIA live regions context
 * This can be used by components that need to make announcements
 */
export function useAnnouncementContext() {
  const ariaLiveRegionsRef = React.useRef<AriaLiveRegionsRef>(null)
  
  const announce = React.useCallback((message: string, options?: Parameters<AriaLiveRegionsRef['announce']>[1]) => {
    ariaLiveRegionsRef.current?.announce(message, options)
  }, [])
  
  const announceNavigation = React.useCallback((destination: string) => {
    ariaLiveRegionsRef.current?.announceNavigation(destination)
  }, [])
  
  const announceDataUpdate = React.useCallback((description: string) => {
    ariaLiveRegionsRef.current?.announceDataUpdate(description)
  }, [])
  
  const announceError = React.useCallback((error: string) => {
    ariaLiveRegionsRef.current?.announceError(error)
  }, [])
  
  const announceSuccess = React.useCallback((message: string) => {
    ariaLiveRegionsRef.current?.announceSuccess(message)
  }, [])
  
  const announceLoading = React.useCallback((description: string) => {
    ariaLiveRegionsRef.current?.announceLoading(description)
  }, [])
  
  const announceProgress = React.useCallback((current: number, total: number, description?: string) => {
    ariaLiveRegionsRef.current?.announceProgress(current, total, description)
  }, [])
  
  const announceStatusChange = React.useCallback((status: string, context?: string) => {
    ariaLiveRegionsRef.current?.announceStatusChange(status, context)
  }, [])

  return {
    ariaLiveRegionsRef,
    announce,
    announceNavigation,
    announceDataUpdate,
    announceError,
    announceSuccess,
    announceLoading,
    announceProgress,
    announceStatusChange
  }
}