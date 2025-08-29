'use client'

import React, { useState, useRef } from 'react'
import { useAccessibilityPreferences, AccessibilityPreferences } from '@/hooks/useAccessibilityPreferences'

interface AccessibilityPreferencesPanelProps {
  isOpen: boolean
  onClose: () => void
  className?: string
}

/**
 * Comprehensive accessibility preferences panel
 * Allows users to customize their accessibility experience
 */
export function AccessibilityPreferencesPanel({ 
  isOpen, 
  onClose, 
  className = '' 
}: AccessibilityPreferencesPanelProps) {
  const {
    preferences,
    currentColorScheme,
    colorSchemes,
    systemPreferences,
    isLoading,
    updatePreference,
    setColorScheme,
    resetToDefaults,
    getRecommendations
  } = useAccessibilityPreferences()
  
  const [activeTab, setActiveTab] = useState<'visual' | 'navigation' | 'audio' | 'content' | 'cognitive'>('visual')
  const panelRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  
  const recommendations = getRecommendations()

  if (!isOpen) return null

  const tabs = [
    { id: 'visual' as const, label: 'Visual', icon: '👁️' },
    { id: 'navigation' as const, label: 'Navigation', icon: '🧭' },
    { id: 'audio' as const, label: 'Audio', icon: '🔊' },
    { id: 'content' as const, label: 'Content', icon: '📄' },
    { id: 'cognitive' as const, label: 'Cognitive', icon: '🧠' }
  ]

  const PreferenceToggle = ({ 
    label, 
    description, 
    checked, 
    onChange, 
    recommendation 
  }: {
    label: string
    description: string
    checked: boolean
    onChange: (checked: boolean) => void
    recommendation?: boolean
  }) => (
    <div className={`p-4 rounded-lg border ${recommendation ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 mr-4">
          <div className="flex items-center">
            <label className="text-sm font-medium text-gray-900 cursor-pointer">
              {label}
            </label>
            {recommendation && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            checked ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </div>
  )

  const ColorSchemeSelector = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Color Scheme</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {colorSchemes.map((scheme) => (
          <button
            key={scheme.name}
            onClick={() => setColorScheme(scheme.name)}
            className={`p-4 rounded-lg border-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              currentColorScheme.name === scheme.name
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={currentColorScheme.name === scheme.name}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{scheme.label}</span>
              <div className="flex space-x-1">
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300" 
                  style={{ backgroundColor: scheme.colors.background }}
                  aria-label={`Background color: ${scheme.colors.background}`}
                />
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300" 
                  style={{ backgroundColor: scheme.colors.primary }}
                  aria-label={`Primary color: ${scheme.colors.primary}`}
                />
                <div 
                  className="w-4 h-4 rounded-full border border-gray-300" 
                  style={{ backgroundColor: scheme.colors.accent }}
                  aria-label={`Accent color: ${scheme.colors.accent}`}
                />
              </div>
            </div>
            <p className="text-xs text-gray-600">
              Contrast ratio: {scheme.contrastRatio}:1
            </p>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" aria-labelledby="accessibility-panel-title">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Panel */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl">
        <div
          ref={panelRef}
          className={`h-full bg-white shadow-xl overflow-hidden flex flex-col ${className}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="accessibility-panel-title"
        >
          {/* Header */}
          <div className="bg-blue-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 id="accessibility-panel-title" className="text-xl font-semibold">
                  Accessibility Preferences
                </h2>
                <p className="text-blue-100 text-sm mt-1">
                  Customize your experience for better accessibility
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={onClose}
                className="text-white hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600 rounded-lg p-2"
                aria-label="Close accessibility preferences"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* System preferences info */}
            <div className="mt-4 p-3 bg-blue-700 bg-opacity-50 rounded-lg">
              <h3 className="text-sm font-medium text-white mb-2">System Preferences Detected</h3>
              <div className="text-xs text-blue-100 space-y-1">
                <div>Reduced Motion: {systemPreferences.prefersReducedMotion ? 'Enabled' : 'Disabled'}</div>
                <div>Color Scheme: {systemPreferences.prefersColorScheme}</div>
                <div>Contrast: {systemPreferences.prefersContrast}</div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex space-x-8 px-6" aria-label="Accessibility preference categories">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  aria-pressed={activeTab === tab.id}
                >
                  <span className="mr-2" aria-hidden="true">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Recommendations Banner */}
          {recommendations.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Recommendations Available</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    Based on your system preferences, we recommend enabling {recommendations.length} setting{recommendations.length > 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="ml-3 text-gray-600">Loading preferences...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Visual Tab */}
                {activeTab === 'visual' && (
                  <div className="space-y-6">
                    <ColorSchemeSelector />
                    
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium text-gray-900">Visual Options</h3>
                      
                      <PreferenceToggle
                        label="High Contrast"
                        description="Increases contrast between text and background for better readability"
                        checked={preferences.highContrast}
                        onChange={(checked) => updatePreference('highContrast', checked)}
                        recommendation={recommendations.some(r => r.key === 'highContrast')}
                      />
                      
                      <PreferenceToggle
                        label="Large Text"
                        description="Increases text size by 25% for better readability"
                        checked={preferences.largeText}
                        onChange={(checked) => updatePreference('largeText', checked)}
                      />
                      
                      <PreferenceToggle
                        label="Reduced Motion"
                        description="Reduces or removes animations and transitions"
                        checked={preferences.reducedMotion}
                        onChange={(checked) => updatePreference('reducedMotion', checked)}
                        recommendation={recommendations.some(r => r.key === 'reducedMotion')}
                      />
                      
                      <PreferenceToggle
                        label="Colorblind Friendly"
                        description="Uses colors and patterns that are easier to distinguish"
                        checked={preferences.colorBlindFriendly}
                        onChange={(checked) => updatePreference('colorBlindFriendly', checked)}
                      />
                    </div>
                  </div>
                )}

                {/* Navigation Tab */}
                {activeTab === 'navigation' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Navigation Options</h3>
                    
                    <PreferenceToggle
                      label="Enhanced Keyboard Navigation"
                      description="Improves keyboard navigation with additional shortcuts and focus management"
                      checked={preferences.keyboardNavigation}
                      onChange={(checked) => updatePreference('keyboardNavigation', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Skip Links"
                      description="Shows skip navigation links for faster page navigation"
                      checked={preferences.skipLinks}
                      onChange={(checked) => updatePreference('skipLinks', checked)}
                    />
                    
                    <div className="p-4 rounded-lg border border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-900 mb-3">
                        Focus Indicators
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'default', label: 'Default', description: 'Standard browser focus indicators' },
                          { value: 'enhanced', label: 'Enhanced', description: 'Thicker, more visible focus rings' },
                          { value: 'high-contrast', label: 'High Contrast', description: 'Maximum visibility focus indicators' }
                        ].map((option) => (
                          <label key={option.value} className="flex items-start cursor-pointer">
                            <input
                              type="radio"
                              name="focusIndicators"
                              value={option.value}
                              checked={preferences.focusIndicators === option.value}
                              onChange={() => updatePreference('focusIndicators', option.value as any)}
                              className="mt-1 mr-3 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{option.label}</div>
                              <div className="text-sm text-gray-600">{option.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Tab */}
                {activeTab === 'audio' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Audio Options</h3>
                    
                    <PreferenceToggle
                      label="Screen Reader Optimized"
                      description="Optimizes content structure and announcements for screen readers"
                      checked={preferences.screenReaderOptimized}
                      onChange={(checked) => updatePreference('screenReaderOptimized', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Sound Enabled"
                      description="Allows audio feedback and sound-based interactions"
                      checked={preferences.soundEnabled}
                      onChange={(checked) => updatePreference('soundEnabled', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Audio Descriptions"
                      description="Provides audio descriptions for visual content"
                      checked={preferences.audioDescriptions}
                      onChange={(checked) => updatePreference('audioDescriptions', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Announcements"
                      description="Enables automatic announcements for important changes"
                      checked={preferences.announcementsEnabled}
                      onChange={(checked) => updatePreference('announcementsEnabled', checked)}
                    />
                  </div>
                )}

                {/* Content Tab */}
                {activeTab === 'content' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Content Options</h3>
                    
                    <PreferenceToggle
                      label="Simplified Layout"
                      description="Removes decorative elements and simplifies page layouts"
                      checked={preferences.simplifiedLayout}
                      onChange={(checked) => updatePreference('simplifiedLayout', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Descriptive Text"
                      description="Shows additional descriptive text for images and interactive elements"
                      checked={preferences.descriptiveText}
                      onChange={(checked) => updatePreference('descriptiveText', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Disable Autoplay"
                      description="Prevents videos and animations from playing automatically"
                      checked={!preferences.autoplay}
                      onChange={(checked) => updatePreference('autoplay', !checked)}
                    />
                    
                    <PreferenceToggle
                      label="Animations"
                      description="Enables decorative animations and transitions"
                      checked={preferences.animations}
                      onChange={(checked) => updatePreference('animations', checked)}
                    />
                  </div>
                )}

                {/* Cognitive Tab */}
                {activeTab === 'cognitive' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">Cognitive Support</h3>
                    
                    <PreferenceToggle
                      label="Reading Assistance"
                      description="Provides reading guides and text highlighting"
                      checked={preferences.readingAssistance}
                      onChange={(checked) => updatePreference('readingAssistance', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Memory Aids"
                      description="Shows additional context and reminders"
                      checked={preferences.memoryAids}
                      onChange={(checked) => updatePreference('memoryAids', checked)}
                    />
                    
                    <PreferenceToggle
                      label="Distraction Reduction"
                      description="Hides non-essential content and notifications"
                      checked={preferences.distractionReduction}
                      onChange={(checked) => updatePreference('distractionReduction', checked)}
                    />
                    
                    <div className="p-4 rounded-lg border border-gray-200 bg-white">
                      <label className="block text-sm font-medium text-gray-900 mb-3">
                        Content Pacing
                      </label>
                      <div className="space-y-2">
                        {[
                          { value: 'slow', label: 'Slow', description: 'Extra time for reading and interactions' },
                          { value: 'normal', label: 'Normal', description: 'Standard timing for all interactions' },
                          { value: 'fast', label: 'Fast', description: 'Reduced delays and faster transitions' }
                        ].map((option) => (
                          <label key={option.value} className="flex items-start cursor-pointer">
                            <input
                              type="radio"
                              name="contentPacing"
                              value={option.value}
                              checked={preferences.contentPacing === option.value}
                              onChange={() => updatePreference('contentPacing', option.value as any)}
                              className="mt-1 mr-3 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{option.label}</div>
                              <div className="text-sm text-gray-600">{option.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={resetToDefaults}
                className="text-sm text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
              >
                Reset to Defaults
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}