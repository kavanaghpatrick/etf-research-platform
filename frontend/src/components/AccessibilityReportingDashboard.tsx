'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useAccessibilityPreferences } from '@/hooks/useAccessibilityPreferences'
import { useAriaLiveRegions } from '@/hooks/useAriaLiveRegions'

interface AccessibilityMetrics {
  compliance: {
    wcagA: number
    wcagAA: number
    wcagAAA: number
    lastChecked: string
  }
  usage: {
    screenReaderUsers: number
    keyboardUsers: number
    highContrastUsers: number
    reducedMotionUsers: number
    totalUsers: number
  }
  performance: {
    accessibilityFeatureImpact: number
    averageLoadTime: number
    accessibilityErrorRate: number
  }
  violations: Array<{
    id: string
    impact: 'minor' | 'moderate' | 'serious' | 'critical'
    count: number
    rule: string
    description: string
    pages: string[]
    trend: 'increasing' | 'stable' | 'decreasing'
  }>
  userFeedback: Array<{
    id: string
    type: 'issue' | 'suggestion' | 'praise'
    category: string
    description: string
    status: 'open' | 'in-progress' | 'resolved'
    priority: 'low' | 'medium' | 'high'
    submittedAt: string
  }>
}

interface AccessibilityReportingDashboardProps {
  className?: string
  showDetailedMetrics?: boolean
}

/**
 * Comprehensive accessibility reporting and monitoring dashboard
 * Provides insights into accessibility compliance, usage patterns, and user feedback
 */
export function AccessibilityReportingDashboard({
  className = '',
  showDetailedMetrics = true
}: AccessibilityReportingDashboardProps) {
  const [metrics, setMetrics] = useState<AccessibilityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [activeTab, setActiveTab] = useState<'overview' | 'compliance' | 'usage' | 'violations' | 'feedback'>('overview')
  
  const { preferences, systemPreferences } = useAccessibilityPreferences()

  // Mock data - in real implementation, this would come from analytics service
  const mockMetrics: AccessibilityMetrics = useMemo(() => ({
    compliance: {
      wcagA: 100,
      wcagAA: 98,
      wcagAAA: 85,
      lastChecked: new Date().toISOString()
    },
    usage: {
      screenReaderUsers: 156,
      keyboardUsers: 892,
      highContrastUsers: 234,
      reducedMotionUsers: 167,
      totalUsers: 4500
    },
    performance: {
      accessibilityFeatureImpact: 2.3,
      averageLoadTime: 1850,
      accessibilityErrorRate: 0.02
    },
    violations: [
      {
        id: 'color-contrast',
        impact: 'serious',
        count: 3,
        rule: 'WCAG 2.1 AA Color Contrast',
        description: 'Some text elements do not meet minimum color contrast ratios',
        pages: ['/stock/AAPL', '/search'],
        trend: 'decreasing'
      },
      {
        id: 'missing-alt',
        impact: 'moderate',
        count: 8,
        rule: 'Image Alternative Text',
        description: 'Images missing alternative text descriptions',
        pages: ['/dashboard', '/charts'],
        trend: 'stable'
      },
      {
        id: 'keyboard-trap',
        impact: 'critical',
        count: 1,
        rule: 'Keyboard Navigation',
        description: 'Modal dialog creates keyboard trap',
        pages: ['/settings'],
        trend: 'decreasing'
      }
    ],
    userFeedback: [
      {
        id: 'fb-001',
        type: 'issue',
        category: 'Screen Reader',
        description: 'Chart data not accessible via screen reader',
        status: 'in-progress',
        priority: 'high',
        submittedAt: '2025-01-10T10:00:00Z'
      },
      {
        id: 'fb-002',
        type: 'suggestion',
        category: 'Keyboard Navigation',
        description: 'Add shortcut to jump to main content',
        status: 'resolved',
        priority: 'medium',
        submittedAt: '2025-01-08T14:30:00Z'
      },
      {
        id: 'fb-003',
        type: 'praise',
        category: 'High Contrast',
        description: 'High contrast mode works perfectly',
        status: 'open',
        priority: 'low',
        submittedAt: '2025-01-12T09:15:00Z'
      }
    ]
  }), [])

  useEffect(() => {
    // Simulate API call
    const timer = setTimeout(() => {
      setMetrics(mockMetrics)
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [selectedTimeRange, mockMetrics])

  const complianceScore = useMemo(() => {
    if (!metrics) return 0
    return Math.round((metrics.compliance.wcagA + metrics.compliance.wcagAA + metrics.compliance.wcagAAA) / 3)
  }, [metrics])

  const accessibilityAdoptionRate = useMemo(() => {
    if (!metrics) return 0
    const { usage } = metrics
    const accessibilityUsers = usage.screenReaderUsers + usage.keyboardUsers + usage.highContrastUsers + usage.reducedMotionUsers
    return Math.round((accessibilityUsers / usage.totalUsers) * 100)
  }, [metrics])

  const criticalViolations = useMemo(() => {
    if (!metrics) return []
    return metrics.violations.filter(v => v.impact === 'critical')
  }, [metrics])

  const openFeedback = useMemo(() => {
    if (!metrics) return []
    return metrics.userFeedback.filter(f => f.status === 'open' || f.status === 'in-progress')
  }, [metrics])

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Accessibility Data Unavailable
          </h2>
          <p className="text-gray-600">
            Unable to load accessibility metrics at this time.
          </p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'compliance', label: 'Compliance', icon: '✓' },
    { id: 'usage', label: 'Usage', icon: '👥' },
    { id: 'violations', label: 'Issues', icon: '⚠️', count: metrics.violations.length },
    { id: 'feedback', label: 'Feedback', icon: '💬', count: openFeedback.length }
  ]

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">
              Accessibility Dashboard
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Comprehensive accessibility monitoring and reporting
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Select time range"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              complianceScore >= 95 ? 'bg-green-100 text-green-800' :
              complianceScore >= 85 ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              {complianceScore}% Compliant
            </span>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-blue-600 font-semibold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">WCAG AA Compliance</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.compliance.wcagAA}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-600 font-semibold">👥</span>
              </div>
              <div>
                <p className="text-sm font-medium text-green-900">Adoption Rate</p>
                <p className="text-2xl font-bold text-green-600">{accessibilityAdoptionRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-yellow-600 font-semibold">⚠️</span>
              </div>
              <div>
                <p className="text-sm font-medium text-yellow-900">Critical Issues</p>
                <p className="text-2xl font-bold text-yellow-600">{criticalViolations.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-purple-600 font-semibold">⚡</span>
              </div>
              <div>
                <p className="text-sm font-medium text-purple-900">Performance Impact</p>
                <p className="text-2xl font-bold text-purple-600">{metrics.performance.accessibilityFeatureImpact}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              aria-pressed={activeTab === tab.id}
            >
              <span className="mr-2" aria-hidden="true">{tab.icon}</span>
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  tab.count > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Compliance Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">WCAG 2.1 A</span>
                    <span className="text-sm font-medium">{metrics.compliance.wcagA}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">WCAG 2.1 AA</span>
                    <span className="text-sm font-medium">{metrics.compliance.wcagAA}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">WCAG 2.1 AAA</span>
                    <span className="text-sm font-medium">{metrics.compliance.wcagAAA}%</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">User Preferences</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Screen Reader Users</span>
                    <span className="text-sm font-medium">{metrics.usage.screenReaderUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Keyboard Navigation</span>
                    <span className="text-sm font-medium">{metrics.usage.keyboardUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">High Contrast Mode</span>
                    <span className="text-sm font-medium">{metrics.usage.highContrastUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Reduced Motion</span>
                    <span className="text-sm font-medium">{metrics.usage.reducedMotionUsers}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {criticalViolations.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-red-900 mb-3">🚨 Critical Issues Requiring Immediate Attention</h3>
                <div className="space-y-2">
                  {criticalViolations.map((violation) => (
                    <div key={violation.id} className="text-sm text-red-800">
                      <strong>{violation.rule}:</strong> {violation.description}
                      <span className="text-red-600 ml-2">({violation.count} instances)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-green-900 mb-3">Overall Compliance Status</h3>
              <p className="text-green-800">
                Your application maintains {complianceScore}% compliance with WCAG 2.1 guidelines.
                Last checked: {new Date(metrics.compliance.lastChecked).toLocaleDateString()}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { level: 'A', score: metrics.compliance.wcagA, description: 'Essential accessibility features' },
                { level: 'AA', score: metrics.compliance.wcagAA, description: 'Standard accessibility compliance' },
                { level: 'AAA', score: metrics.compliance.wcagAAA, description: 'Enhanced accessibility features' }
              ].map((level) => (
                <div key={level.level} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 mb-2">
                      WCAG 2.1 {level.level}
                    </div>
                    <div className={`text-3xl font-bold mb-2 ${
                      level.score >= 95 ? 'text-green-600' :
                      level.score >= 85 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {level.score}%
                    </div>
                    <p className="text-sm text-gray-600">{level.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Statistics</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Screen Reader Users', value: metrics.usage.screenReaderUsers, color: 'blue' },
                    { label: 'Keyboard Navigation', value: metrics.usage.keyboardUsers, color: 'green' },
                    { label: 'High Contrast Mode', value: metrics.usage.highContrastUsers, color: 'purple' },
                    { label: 'Reduced Motion', value: metrics.usage.reducedMotionUsers, color: 'orange' }
                  ].map((stat) => (
                    <div key={stat.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-700">{stat.label}</span>
                        <span className="text-sm text-gray-900">{stat.value} users</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`bg-${stat.color}-600 h-2 rounded-full`}
                          style={{ width: `${(stat.value / metrics.usage.totalUsers) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">System Preferences Detected</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Prefers Reduced Motion</span>
                    <span className={`text-sm font-medium ${systemPreferences.prefersReducedMotion ? 'text-green-600' : 'text-gray-400'}`}>
                      {systemPreferences.prefersReducedMotion ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Prefers Dark Mode</span>
                    <span className={`text-sm font-medium ${systemPreferences.prefersColorScheme === 'dark' ? 'text-green-600' : 'text-gray-400'}`}>
                      {systemPreferences.prefersColorScheme === 'dark' ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Prefers High Contrast</span>
                    <span className={`text-sm font-medium ${systemPreferences.prefersContrast === 'more' ? 'text-green-600' : 'text-gray-400'}`}>
                      {systemPreferences.prefersContrast === 'more' ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'violations' && (
          <div className="space-y-4">
            {metrics.violations.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Violations Found</h3>
                <p className="text-gray-600">
                  Great job! No accessibility violations were detected in the latest scan.
                </p>
              </div>
            ) : (
              metrics.violations.map((violation) => (
                <div
                  key={violation.id}
                  className={`border rounded-lg p-4 ${
                    violation.impact === 'critical' ? 'border-red-300 bg-red-50' :
                    violation.impact === 'serious' ? 'border-orange-300 bg-orange-50' :
                    violation.impact === 'moderate' ? 'border-yellow-300 bg-yellow-50' :
                    'border-blue-300 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h4 className="text-lg font-medium text-gray-900">{violation.rule}</h4>
                        <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          violation.impact === 'critical' ? 'bg-red-100 text-red-800' :
                          violation.impact === 'serious' ? 'bg-orange-100 text-orange-800' :
                          violation.impact === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {violation.impact}
                        </span>
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          violation.trend === 'decreasing' ? 'bg-green-100 text-green-800' :
                          violation.trend === 'increasing' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {violation.trend === 'decreasing' ? '↓' : violation.trend === 'increasing' ? '↑' : '→'} {violation.trend}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-3">{violation.description}</p>
                      <div className="text-sm text-gray-600">
                        <strong>Affected pages:</strong> {violation.pages.join(', ')}
                        <br />
                        <strong>Instances:</strong> {violation.count}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="space-y-4">
            {metrics.userFeedback.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Feedback Yet</h3>
                <p className="text-gray-600">
                  User feedback will appear here when submitted.
                </p>
              </div>
            ) : (
              metrics.userFeedback.map((feedback) => (
                <div
                  key={feedback.id}
                  className={`border rounded-lg p-4 ${
                    feedback.type === 'issue' ? 'border-red-200 bg-red-50' :
                    feedback.type === 'suggestion' ? 'border-blue-200 bg-blue-50' :
                    'border-green-200 bg-green-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="text-lg mr-2">
                          {feedback.type === 'issue' ? '🐛' : feedback.type === 'suggestion' ? '💡' : '👍'}
                        </span>
                        <h4 className="text-lg font-medium text-gray-900">{feedback.category}</h4>
                        <span className={`ml-3 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          feedback.priority === 'high' ? 'bg-red-100 text-red-800' :
                          feedback.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {feedback.priority} priority
                        </span>
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          feedback.status === 'resolved' ? 'bg-green-100 text-green-800' :
                          feedback.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {feedback.status}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2">{feedback.description}</p>
                      <div className="text-sm text-gray-600">
                        Submitted: {new Date(feedback.submittedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}