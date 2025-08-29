'use client'

import { lazy, Suspense } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

// Dynamically import the heavy ResultsDashboard component
const ResultsDashboard = lazy(() => import('./ResultsDashboard').then(module => ({ default: module.ResultsDashboard })))

// Loading fallback for results dashboard
const ResultsLoadingFallback = () => (
  <div className="space-y-6">
    {/* Header skeleton */}
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        <div className="flex space-x-4">
          <div className="h-10 bg-gray-200 rounded w-24"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
          <div className="h-10 bg-gray-200 rounded w-24"></div>
        </div>
      </div>
    </div>
    
    {/* Chart area skeleton */}
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="animate-pulse space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="flex space-x-2">
            <div className="h-8 bg-gray-200 rounded w-16"></div>
            <div className="h-8 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
        <div className="h-80 bg-gray-200 rounded"></div>
      </div>
    </div>
    
    {/* Stats grid skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="bg-white rounded-xl shadow-lg p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      ))}
    </div>
    
    {/* Table skeleton */}
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex space-x-4">
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 rounded w-1/6"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)

interface LazyResultsDashboardProps {
  results: any
  onNewAnalysis: () => void
}

export function LazyResultsDashboard({ results, onNewAnalysis }: LazyResultsDashboardProps) {
  return (
    <Suspense fallback={<ResultsLoadingFallback />}>
      <ResultsDashboard results={results} onNewAnalysis={onNewAnalysis} />
    </Suspense>
  )
}