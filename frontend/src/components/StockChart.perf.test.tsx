import React from 'react'
import { StockChart } from './StockChart'
import { testDataFactories } from '@test-utils'
import { ComponentPerformanceTester, PERFORMANCE_THRESHOLDS } from '@test-utils/performance-test-utils'

describe('StockChart Performance Tests', () => {
  const performanceTester = new ComponentPerformanceTester()

  describe('Render Performance', () => {
    it('renders within performance threshold', () => {
      const data = testDataFactories.chartData(100)
      const duration = performanceTester.measureRender(
        'stock-chart-100-points',
        <StockChart data={data} timeRange="1D" height={400} />
      )
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime)
    })

    it('handles large datasets efficiently', () => {
      const testCases = [100, 500, 1000, 5000]
      
      testCases.forEach(size => {
        const data = testDataFactories.chartData(size)
        const duration = performanceTester.measureRender(
          `stock-chart-${size}-points`,
          <StockChart data={data} timeRange="1Y" height={400} />
        )
        
        // Performance should scale sub-linearly
        const expectedMax = PERFORMANCE_THRESHOLDS.renderTime * Math.log10(size)
        expect(duration).toBeLessThan(expectedMax)
      })
    })
  })

  describe('Re-render Performance', () => {
    it('re-renders efficiently on data updates', () => {
      let data = testDataFactories.chartData(100)
      const component = <StockChart data={data} timeRange="1D" height={400} />
      
      const { reRender } = performanceTester.measureReRender(
        'stock-chart-rerender',
        component,
        () => {
          data = testDataFactories.chartData(100)
        }
      )
      
      expect(reRender).toBeLessThan(PERFORMANCE_THRESHOLDS.reRenderTime)
    })

    it('memoizes expensive calculations', () => {
      const data = testDataFactories.chartData(1000)
      let timeRange: '1D' | '1M' = '1D'
      
      const component = <StockChart data={data} timeRange={timeRange} height={400} />
      
      // Measure re-render with only timeRange change
      const { reRender } = performanceTester.measureReRender(
        'stock-chart-memo',
        component,
        () => {
          timeRange = '1M'
        }
      )
      
      // Should be fast since data didn't change
      expect(reRender).toBeLessThan(PERFORMANCE_THRESHOLDS.reRenderTime / 2)
    })
  })

  describe('Memory Usage', () => {
    it('maintains reasonable memory footprint', () => {
      const data = testDataFactories.chartData(1000)
      
      const usage = performanceTester.measureMemoryUsage(
        'stock-chart-memory',
        () => {
          const { unmount } = render(
            <StockChart data={data} timeRange="1D" height={400} />
          )
          unmount()
        }
      )
      
      if (usage !== null) {
        expect(usage).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage)
      }
    })

    it('cleans up memory on unmount', () => {
      const data = testDataFactories.chartData(5000)
      
      const beforeUsage = performance.memory?.usedJSHeapSize || 0
      
      const { unmount } = render(
        <StockChart data={data} timeRange="1Y" height={400} />
      )
      
      unmount()
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }
      
      const afterUsage = performance.memory?.usedJSHeapSize || 0
      
      // Memory should be released after unmount
      expect(afterUsage).toBeLessThanOrEqual(beforeUsage * 1.1) // Allow 10% variance
    })
  })

  describe('Animation Performance', () => {
    it('maintains 60fps during transitions', async () => {
      jest.useFakeTimers()
      
      const data = testDataFactories.chartData(100)
      const { rerender } = render(
        <StockChart data={data} timeRange="1D" height={400} animated />
      )
      
      let frameCount = 0
      const frameCallback = () => {
        frameCount++
      }
      
      // Mock requestAnimationFrame
      const rafSpy = jest.spyOn(window, 'requestAnimationFrame')
        .mockImplementation(cb => {
          frameCallback()
          return setTimeout(cb, 16.67) as any // ~60fps
        })
      
      // Trigger animation by updating data
      const newData = testDataFactories.chartData(100)
      rerender(<StockChart data={newData} timeRange="1D" height={400} animated />)
      
      // Run animation for 1 second
      jest.advanceTimersByTime(1000)
      
      // Should achieve close to 60fps
      expect(frameCount).toBeGreaterThan(55)
      expect(frameCount).toBeLessThan(65)
      
      rafSpy.mockRestore()
      jest.useRealTimers()
    })
  })

  describe('Performance Report', () => {
    afterAll(() => {
      const report = performanceTester.generateReport()
      console.log('Performance Test Report:')
      console.log(JSON.stringify(report, null, 2))
      
      // Assert overall performance
      Object.entries(report).forEach(([metric, stats]) => {
        if (stats && metric.includes('render')) {
          expect(stats.p95).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime * 2)
        }
      })
    })
  })
})