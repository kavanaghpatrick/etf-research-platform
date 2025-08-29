'use client'

import { Profiler, ProfilerOnRenderCallback, ReactNode } from 'react'
import { usePerformanceMetrics } from '@/utils/performance'

interface PerformanceProfilerProps {
  children: ReactNode
  id: string
  logToConsole?: boolean
  trackSlowRenders?: boolean
  slowRenderThreshold?: number
}

interface RenderInfo {
  id: string
  phase: 'mount' | 'update'
  actualDuration: number
  baseDuration: number
  startTime: number
  commitTime: number
}

export function PerformanceProfiler({
  children,
  id,
  logToConsole = false,
  trackSlowRenders = true,
  slowRenderThreshold = 16 // 16ms = 60fps
}: PerformanceProfilerProps) {
  const { addMetric } = usePerformanceMetrics()

  const onRender: ProfilerOnRenderCallback = (
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    interactions
  ) => {
    const renderInfo: RenderInfo = {
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime
    }

    // Track all renders
    addMetric(`${id}-render-${phase}`, actualDuration, 'ms', id)
    addMetric(`${id}-base-duration`, baseDuration, 'ms', id)

    // Track slow renders specifically
    if (trackSlowRenders && actualDuration > slowRenderThreshold) {
      addMetric(`${id}-slow-render`, actualDuration, 'ms', id)
      
      if (logToConsole) {
        console.warn(`Slow render detected in ${id}:`, {
          ...renderInfo,
          threshold: slowRenderThreshold,
          interactions: interactions ? Array.from(interactions) : []
        })
      }
    }

    // Development logging
    if (process.env.NODE_ENV === 'development' && logToConsole) {
      const interactionsList = interactions ? Array.from(interactions) : []
      console.log(`Profiler: ${id}`, {
        ...renderInfo,
        interactions: interactionsList
      })
    }
  }

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  )
}

// Higher-order component for easy profiling
export function withProfiler<P extends object>(
  Component: React.ComponentType<P>,
  profilerId?: string,
  options?: Omit<PerformanceProfilerProps, 'children' | 'id'>
) {
  const WrappedComponent = (props: P) => {
    const id = profilerId || Component.displayName || Component.name || 'Anonymous'
    
    return (
      <PerformanceProfiler id={id} {...options}>
        <Component {...props} />
      </PerformanceProfiler>
    )
  }

  WrappedComponent.displayName = `withProfiler(${Component.displayName || Component.name})`
  
  return WrappedComponent
}

// Specific profiler for chart components
export function ChartProfiler({ children }: { children: ReactNode }) {
  return (
    <PerformanceProfiler
      id="chart-component"
      trackSlowRenders
      slowRenderThreshold={32} // Charts can be more expensive
      logToConsole={process.env.NODE_ENV === 'development'}
    >
      {children}
    </PerformanceProfiler>
  )
}

// Dashboard profiler for complex UIs
export function DashboardProfiler({ children }: { children: ReactNode }) {
  return (
    <PerformanceProfiler
      id="dashboard-component"
      trackSlowRenders
      slowRenderThreshold={50} // Dashboards can be complex
      logToConsole={process.env.NODE_ENV === 'development'}
    >
      {children}
    </PerformanceProfiler>
  )
}