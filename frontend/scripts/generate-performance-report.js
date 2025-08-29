const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

// Performance report generator
class PerformanceReportGenerator {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {},
      webVitals: {},
      bundleAnalysis: {},
      loadTests: {},
      stressTests: {},
      optimizations: {},
      recommendations: []
    }
  }

  async generate() {
    console.log('🚀 Starting comprehensive performance analysis...\n')

    try {
      // Run all performance tests
      await this.runLoadTests()
      await this.runBenchmarks()
      await this.runStressTests()
      await this.analyzeBundle()
      await this.collectMetrics()
      
      // Generate insights
      this.analyzeResults()
      this.generateRecommendations()
      
      // Save report
      await this.saveReport()
      
      console.log('\n✅ Performance report generated successfully!')
      
    } catch (error) {
      console.error('❌ Error generating performance report:', error)
      process.exit(1)
    }
  }

  async runLoadTests() {
    console.log('📊 Running load tests...')
    
    try {
      const { stdout } = await execAsync(
        'npm run test:e2e -- src/tests/performance/load-testing.test.ts --reporter=json',
        { maxBuffer: 10 * 1024 * 1024 }
      )
      
      const results = this.parseTestOutput(stdout)
      this.results.loadTests = {
        ...results,
        status: 'completed',
        duration: results.duration || 0
      }
      
    } catch (error) {
      console.warn('Load tests failed:', error.message)
      this.results.loadTests = { status: 'failed', error: error.message }
    }
  }

  async runBenchmarks() {
    console.log('📏 Running performance benchmarks...')
    
    try {
      const { stdout } = await execAsync(
        'npm run test:e2e -- src/tests/performance/benchmark.test.ts --reporter=json',
        { maxBuffer: 10 * 1024 * 1024 }
      )
      
      const results = this.parseTestOutput(stdout)
      
      // Extract Web Vitals from benchmark results
      if (results.webVitals) {
        this.results.webVitals = results.webVitals
      }
      
      this.results.benchmarks = {
        ...results,
        status: 'completed'
      }
      
    } catch (error) {
      console.warn('Benchmarks failed:', error.message)
      this.results.benchmarks = { status: 'failed', error: error.message }
    }
  }

  async runStressTests() {
    console.log('💪 Running stress tests...')
    
    try {
      const { stdout } = await execAsync(
        'npm run test:e2e -- src/tests/performance/stress-testing.test.ts --reporter=json',
        { maxBuffer: 10 * 1024 * 1024 }
      )
      
      const results = this.parseTestOutput(stdout)
      this.results.stressTests = {
        ...results,
        status: 'completed'
      }
      
    } catch (error) {
      console.warn('Stress tests failed:', error.message)
      this.results.stressTests = { status: 'failed', error: error.message }
    }
  }

  async analyzeBundle() {
    console.log('📦 Analyzing bundle size...')
    
    try {
      // Build the project
      await execAsync('npm run build', { maxBuffer: 10 * 1024 * 1024 })
      
      // Get bundle stats
      const { stdout } = await execAsync('du -sh .next', { maxBuffer: 1024 * 1024 })
      const totalSize = stdout.trim().split('\t')[0]
      
      // Analyze individual chunks
      const { stdout: chunkStats } = await execAsync(
        'find .next -name "*.js" -exec du -h {} + | sort -hr | head -20',
        { maxBuffer: 1024 * 1024 }
      )
      
      const chunks = chunkStats.trim().split('\n').map(line => {
        const [size, file] = line.split('\t')
        return { size, file: path.basename(file) }
      })
      
      this.results.bundleAnalysis = {
        totalSize,
        chunks,
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      console.warn('Bundle analysis failed:', error.message)
      this.results.bundleAnalysis = { status: 'failed', error: error.message }
    }
  }

  async collectMetrics() {
    console.log('📈 Collecting performance metrics...')
    
    // Read any existing metrics files
    try {
      const metricsPath = path.join(process.cwd(), 'performance-metrics.json')
      if (await this.fileExists(metricsPath)) {
        const metricsData = await fs.readFile(metricsPath, 'utf-8')
        const metrics = JSON.parse(metricsData)
        this.results.historicalMetrics = metrics
      }
    } catch (error) {
      console.warn('Could not read historical metrics:', error.message)
    }
  }

  parseTestOutput(output) {
    try {
      // Extract JSON from test output
      const jsonMatch = output.match(/\{[\s\S]*\}/m)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
      
      // Parse console output for metrics
      const metrics = {}
      
      // Extract Web Vitals
      const lcpMatch = output.match(/LCP[:\s]+(\d+(?:\.\d+)?)\s*ms/i)
      const fidMatch = output.match(/FID[:\s]+(\d+(?:\.\d+)?)\s*ms/i)
      const clsMatch = output.match(/CLS[:\s]+(\d+(?:\.\d+)?)/i)
      const fcpMatch = output.match(/FCP[:\s]+(\d+(?:\.\d+)?)\s*ms/i)
      const ttfbMatch = output.match(/TTFB[:\s]+(\d+(?:\.\d+)?)\s*ms/i)
      
      if (lcpMatch || fidMatch || clsMatch || fcpMatch || ttfbMatch) {
        metrics.webVitals = {
          LCP: lcpMatch ? parseFloat(lcpMatch[1]) : null,
          FID: fidMatch ? parseFloat(fidMatch[1]) : null,
          CLS: clsMatch ? parseFloat(clsMatch[1]) : null,
          FCP: fcpMatch ? parseFloat(fcpMatch[1]) : null,
          TTFB: ttfbMatch ? parseFloat(ttfbMatch[1]) : null
        }
      }
      
      // Extract test results
      const passedMatch = output.match(/(\d+)\s+passed/i)
      const failedMatch = output.match(/(\d+)\s+failed/i)
      const durationMatch = output.match(/(\d+(?:\.\d+)?)\s*s/i)
      
      if (passedMatch || failedMatch) {
        metrics.tests = {
          passed: passedMatch ? parseInt(passedMatch[1]) : 0,
          failed: failedMatch ? parseInt(failedMatch[1]) : 0,
          total: (passedMatch ? parseInt(passedMatch[1]) : 0) + (failedMatch ? parseInt(failedMatch[1]) : 0)
        }
      }
      
      if (durationMatch) {
        metrics.duration = parseFloat(durationMatch[1]) * 1000 // Convert to ms
      }
      
      return metrics
      
    } catch (error) {
      console.warn('Failed to parse test output:', error.message)
      return { raw: output }
    }
  }

  analyzeResults() {
    console.log('\n🔍 Analyzing results...')
    
    // Calculate summary metrics
    const summary = {
      overallScore: 0,
      webVitalsScore: 0,
      performanceScore: 0,
      bundleScore: 0,
      testsPassRate: 0
    }
    
    // Web Vitals scoring
    if (this.results.webVitals) {
      const vitals = this.results.webVitals
      let vitalsScore = 100
      
      // Score based on thresholds
      if (vitals.LCP > 4000) vitalsScore -= 20
      else if (vitals.LCP > 2500) vitalsScore -= 10
      
      if (vitals.FID > 300) vitalsScore -= 20
      else if (vitals.FID > 100) vitalsScore -= 10
      
      if (vitals.CLS > 0.25) vitalsScore -= 20
      else if (vitals.CLS > 0.1) vitalsScore -= 10
      
      if (vitals.FCP > 3000) vitalsScore -= 20
      else if (vitals.FCP > 1800) vitalsScore -= 10
      
      summary.webVitalsScore = Math.max(0, vitalsScore)
    }
    
    // Bundle size scoring
    if (this.results.bundleAnalysis && this.results.bundleAnalysis.totalSize) {
      const sizeMatch = this.results.bundleAnalysis.totalSize.match(/(\d+(?:\.\d+)?)\s*([KMG])/i)
      if (sizeMatch) {
        const size = parseFloat(sizeMatch[1])
        const unit = sizeMatch[2].toUpperCase()
        let sizeInMB = size
        
        if (unit === 'K') sizeInMB = size / 1024
        else if (unit === 'G') sizeInMB = size * 1024
        
        let bundleScore = 100
        if (sizeInMB > 5) bundleScore -= 30
        else if (sizeInMB > 3) bundleScore -= 20
        else if (sizeInMB > 2) bundleScore -= 10
        
        summary.bundleScore = Math.max(0, bundleScore)
      }
    }
    
    // Test pass rate
    let totalTests = 0
    let passedTests = 0
    
    for (const testSuite of ['loadTests', 'benchmarks', 'stressTests']) {
      if (this.results[testSuite] && this.results[testSuite].tests) {
        totalTests += this.results[testSuite].tests.total || 0
        passedTests += this.results[testSuite].tests.passed || 0
      }
    }
    
    if (totalTests > 0) {
      summary.testsPassRate = (passedTests / totalTests) * 100
    }
    
    // Overall score
    const weights = {
      webVitals: 0.4,
      bundle: 0.2,
      tests: 0.4
    }
    
    summary.overallScore = Math.round(
      summary.webVitalsScore * weights.webVitals +
      summary.bundleScore * weights.bundle +
      summary.testsPassRate * weights.tests
    )
    
    // Performance grade
    if (summary.overallScore >= 90) summary.grade = 'A'
    else if (summary.overallScore >= 80) summary.grade = 'B'
    else if (summary.overallScore >= 70) summary.grade = 'C'
    else if (summary.overallScore >= 60) summary.grade = 'D'
    else summary.grade = 'F'
    
    this.results.summary = summary
  }

  generateRecommendations() {
    console.log('💡 Generating recommendations...')
    
    const recommendations = []
    
    // Web Vitals recommendations
    if (this.results.webVitals) {
      const vitals = this.results.webVitals
      
      if (vitals.LCP > 2500) {
        recommendations.push({
          category: 'Web Vitals',
          severity: vitals.LCP > 4000 ? 'high' : 'medium',
          issue: `Largest Contentful Paint is ${vitals.LCP}ms (target: <2500ms)`,
          recommendation: 'Optimize server response times, implement resource hints (preload/preconnect), and optimize critical rendering path'
        })
      }
      
      if (vitals.FID > 100) {
        recommendations.push({
          category: 'Web Vitals',
          severity: vitals.FID > 300 ? 'high' : 'medium',
          issue: `First Input Delay is ${vitals.FID}ms (target: <100ms)`,
          recommendation: 'Break up long tasks, implement web workers for heavy computations, and optimize JavaScript execution'
        })
      }
      
      if (vitals.CLS > 0.1) {
        recommendations.push({
          category: 'Web Vitals',
          severity: vitals.CLS > 0.25 ? 'high' : 'medium',
          issue: `Cumulative Layout Shift is ${vitals.CLS} (target: <0.1)`,
          recommendation: 'Add size attributes to images/videos, avoid inserting content above existing content, and use CSS aspect-ratio'
        })
      }
    }
    
    // Bundle size recommendations
    if (this.results.bundleAnalysis && this.results.bundleAnalysis.chunks) {
      const largeChunks = this.results.bundleAnalysis.chunks.filter(chunk => {
        const sizeMatch = chunk.size.match(/(\d+(?:\.\d+)?)\s*([KMG])/i)
        if (sizeMatch) {
          const size = parseFloat(sizeMatch[1])
          const unit = sizeMatch[2].toUpperCase()
          return (unit === 'M' && size > 0.2) || unit === 'G'
        }
        return false
      })
      
      if (largeChunks.length > 0) {
        recommendations.push({
          category: 'Bundle Size',
          severity: 'medium',
          issue: `Found ${largeChunks.length} large JavaScript chunks`,
          recommendation: 'Implement code splitting, lazy loading, and tree shaking. Consider using dynamic imports for large dependencies'
        })
      }
    }
    
    // Performance test recommendations
    if (this.results.loadTests && this.results.loadTests.status === 'failed') {
      recommendations.push({
        category: 'Load Testing',
        severity: 'high',
        issue: 'Load tests failed to complete',
        recommendation: 'Investigate server capacity, optimize API response times, and implement caching strategies'
      })
    }
    
    if (this.results.stressTests && this.results.stressTests.memoryLeaks) {
      recommendations.push({
        category: 'Memory Management',
        severity: 'high',
        issue: 'Potential memory leaks detected',
        recommendation: 'Review component lifecycle methods, ensure proper cleanup of event listeners and subscriptions'
      })
    }
    
    // Sort by severity
    recommendations.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    
    this.results.recommendations = recommendations
  }

  async saveReport() {
    console.log('\n📝 Saving report...')
    
    const reportPath = path.join(process.cwd(), 'performance-report.json')
    const reportMdPath = path.join(process.cwd(), 'PERFORMANCE_TESTING_REPORT.md')
    
    // Save JSON report
    await fs.writeFile(reportPath, JSON.stringify(this.results, null, 2))
    
    // Generate and save markdown report
    const markdown = this.generateMarkdownReport()
    await fs.writeFile(reportMdPath, markdown)
    
    console.log(`\n📄 Reports saved:`)
    console.log(`   - JSON: ${reportPath}`)
    console.log(`   - Markdown: ${reportMdPath}`)
  }

  generateMarkdownReport() {
    const { summary, webVitals, bundleAnalysis, recommendations } = this.results
    
    let md = `# Performance Testing Report

Generated: ${this.results.timestamp}

## Executive Summary

**Overall Performance Score: ${summary.overallScore}/100 (Grade: ${summary.grade})**

- Web Vitals Score: ${summary.webVitalsScore}/100
- Bundle Size Score: ${summary.bundleScore}/100
- Test Pass Rate: ${summary.testsPassRate.toFixed(1)}%

## Core Web Vitals

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| LCP (Largest Contentful Paint) | ${webVitals.LCP || 'N/A'}ms | <2500ms | ${this.getStatus(webVitals.LCP, 2500, 4000)} |
| FID (First Input Delay) | ${webVitals.FID || 'N/A'}ms | <100ms | ${this.getStatus(webVitals.FID, 100, 300)} |
| CLS (Cumulative Layout Shift) | ${webVitals.CLS || 'N/A'} | <0.1 | ${this.getStatus(webVitals.CLS, 0.1, 0.25)} |
| FCP (First Contentful Paint) | ${webVitals.FCP || 'N/A'}ms | <1800ms | ${this.getStatus(webVitals.FCP, 1800, 3000)} |
| TTFB (Time to First Byte) | ${webVitals.TTFB || 'N/A'}ms | <800ms | ${this.getStatus(webVitals.TTFB, 800, 1800)} |

## Bundle Analysis

Total Build Size: **${bundleAnalysis.totalSize || 'N/A'}**

### Largest Chunks
`

    if (bundleAnalysis.chunks && bundleAnalysis.chunks.length > 0) {
      bundleAnalysis.chunks.slice(0, 10).forEach(chunk => {
        md += `- ${chunk.file}: ${chunk.size}\n`
      })
    }

    md += `
## Performance Test Results

### Load Testing
- Status: ${this.results.loadTests.status || 'N/A'}
- Duration: ${this.results.loadTests.duration ? `${(this.results.loadTests.duration / 1000).toFixed(1)}s` : 'N/A'}
- Tests: ${this.results.loadTests.tests ? `${this.results.loadTests.tests.passed}/${this.results.loadTests.tests.total} passed` : 'N/A'}

### Stress Testing
- Status: ${this.results.stressTests.status || 'N/A'}
- Duration: ${this.results.stressTests.duration ? `${(this.results.stressTests.duration / 1000).toFixed(1)}s` : 'N/A'}
- Tests: ${this.results.stressTests.tests ? `${this.results.stressTests.tests.passed}/${this.results.stressTests.tests.total} passed` : 'N/A'}

## Recommendations

`

    if (recommendations.length > 0) {
      const highPriority = recommendations.filter(r => r.severity === 'high')
      const mediumPriority = recommendations.filter(r => r.severity === 'medium')
      const lowPriority = recommendations.filter(r => r.severity === 'low')
      
      if (highPriority.length > 0) {
        md += '### High Priority\n\n'
        highPriority.forEach(rec => {
          md += `**${rec.category}**: ${rec.issue}\n`
          md += `- **Recommendation**: ${rec.recommendation}\n\n`
        })
      }
      
      if (mediumPriority.length > 0) {
        md += '### Medium Priority\n\n'
        mediumPriority.forEach(rec => {
          md += `**${rec.category}**: ${rec.issue}\n`
          md += `- **Recommendation**: ${rec.recommendation}\n\n`
        })
      }
      
      if (lowPriority.length > 0) {
        md += '### Low Priority\n\n'
        lowPriority.forEach(rec => {
          md += `**${rec.category}**: ${rec.issue}\n`
          md += `- **Recommendation**: ${rec.recommendation}\n\n`
        })
      }
    } else {
      md += 'No specific recommendations at this time. Performance is within acceptable parameters.\n'
    }

    md += `
## Next Steps

1. Address high-priority recommendations first
2. Re-run performance tests after implementing changes
3. Set up continuous performance monitoring
4. Establish performance budgets for ongoing development

---

*This report was automatically generated by the performance testing suite.*
`

    return md
  }

  getStatus(value, goodThreshold, poorThreshold) {
    if (!value && value !== 0) return '❓'
    if (value <= goodThreshold) return '✅'
    if (value <= poorThreshold) return '⚠️'
    return '❌'
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

// Run the report generator
const generator = new PerformanceReportGenerator()
generator.generate()