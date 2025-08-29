'use client'

import React, { useEffect, useState } from 'react'

interface TestReport {
  timestamp: string
  summary: {
    totalTests: number
    passedTests: number
    failedTests: number
    skippedTests: number
    coverage: {
      lines: number
      statements: number
      functions: number
      branches: number
    }
  }
  testTypes: {
    unit: { total: number; passed: number; duration: number }
    integration: { total: number; passed: number; duration: number }
    e2e: { total: number; passed: number; duration: number }
    visual: { total: number; passed: number; duration: number }
    accessibility: { total: number; passed: number; duration: number }
    performance: { total: number; passed: number; duration: number }
  }
  mutationScore?: number
}

export function TestReportDashboard() {
  const [report, setReport] = useState<TestReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In a real app, this would fetch from an API
    const mockReport: TestReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 245,
        passedTests: 242,
        failedTests: 2,
        skippedTests: 1,
        coverage: {
          lines: 94.5,
          statements: 93.8,
          functions: 92.1,
          branches: 91.3,
        },
      },
      testTypes: {
        unit: { total: 150, passed: 149, duration: 12.5 },
        integration: { total: 40, passed: 39, duration: 25.3 },
        e2e: { total: 25, passed: 25, duration: 45.2 },
        visual: { total: 15, passed: 14, duration: 30.1 },
        accessibility: { total: 10, passed: 10, duration: 8.7 },
        performance: { total: 5, passed: 5, duration: 5.2 },
      },
      mutationScore: 87.3,
    }

    setTimeout(() => {
      setReport(mockReport)
      setLoading(false)
    }, 1000)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading test report...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Failed to load test report</p>
      </div>
    )
  }

  const successRate = (report.summary.passedTests / report.summary.totalTests) * 100

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Test Report Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Tests</h3>
          <p className="text-3xl font-bold mt-2">{report.summary.totalTests}</p>
        </div>
        
        <div className="bg-green-50 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-green-600">Passed</h3>
          <p className="text-3xl font-bold text-green-700 mt-2">
            {report.summary.passedTests}
          </p>
        </div>
        
        <div className={`rounded-lg shadow p-6 ${
          report.summary.failedTests > 0 ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <h3 className={`text-sm font-medium ${
            report.summary.failedTests > 0 ? 'text-red-600' : 'text-gray-500'
          }`}>Failed</h3>
          <p className={`text-3xl font-bold mt-2 ${
            report.summary.failedTests > 0 ? 'text-red-700' : 'text-gray-700'
          }`}>
            {report.summary.failedTests}
          </p>
        </div>
        
        <div className="bg-blue-50 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-blue-600">Success Rate</h3>
          <p className="text-3xl font-bold text-blue-700 mt-2">
            {successRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Coverage Metrics */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Code Coverage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(report.summary.coverage).map(([metric, value]) => (
            <div key={metric}>
              <h4 className="text-sm font-medium text-gray-500 capitalize">
                {metric}
              </h4>
              <div className="mt-2">
                <div className="flex items-center">
                  <span className="text-2xl font-bold">{value}%</span>
                </div>
                <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      value >= 90 ? 'bg-green-500' : 
                      value >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Types Breakdown */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Test Types</h2>
        <div className="space-y-4">
          {Object.entries(report.testTypes).map(([type, data]) => (
            <div key={type} className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-medium capitalize">{type} Tests</h4>
                <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                  <span>{data.passed}/{data.total} passed</span>
                  <span>{data.duration}s</span>
                </div>
              </div>
              <div className="w-32">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      data.passed === data.total ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${(data.passed / data.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mutation Testing Score */}
      {report.mutationScore && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Mutation Testing</h2>
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm text-gray-500">
                Mutation score indicates how effective your tests are at catching bugs
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{report.mutationScore}%</p>
              <p className="text-sm text-gray-500">Mutation Score</p>
            </div>
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="text-sm text-gray-500 text-center">
        Report generated at {new Date(report.timestamp).toLocaleString()}
      </div>
    </div>
  )
}