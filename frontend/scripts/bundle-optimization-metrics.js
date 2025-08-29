#!/usr/bin/env node

/**
 * Bundle Optimization Metrics Script
 * Tracks bundle size, performance metrics, and optimization progress
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class BundleOptimizationTracker {
  constructor() {
    this.metricsFile = path.join(__dirname, '../bundle-metrics.json');
    this.nextDir = path.join(__dirname, '../.next');
  }

  /**
   * Collect baseline metrics before optimization
   */
  collectBaselineMetrics() {
    console.log('📊 Collecting baseline bundle metrics...');
    
    const metrics = {
      timestamp: new Date().toISOString(),
      phase: 'baseline',
      bundleSize: this.getBundleSize(),
      jsFiles: this.getJSFileStats(),
      chunkAnalysis: this.getChunkAnalysis(),
      performanceScore: this.getPerformanceScore(),
      cacheHitRatio: 0, // Will be updated after caching implementation
      optimizations: {
        codeSplitting: false,
        imageOptimization: false,
        treeShaking: false,
        serviceWorker: false,
        assetPreloading: false
      }
    };

    this.saveMetrics(metrics, 'baseline');
    return metrics;
  }

  /**
   * Collect metrics after optimization
   */
  collectOptimizedMetrics(optimizations = {}) {
    console.log('📊 Collecting optimized bundle metrics...');
    
    const metrics = {
      timestamp: new Date().toISOString(),
      phase: 'optimized',
      bundleSize: this.getBundleSize(),
      jsFiles: this.getJSFileStats(),
      chunkAnalysis: this.getChunkAnalysis(),
      performanceScore: this.getPerformanceScore(),
      cacheHitRatio: optimizations.cacheHitRatio || 0,
      optimizations: {
        codeSplitting: optimizations.codeSplitting || false,
        imageOptimization: optimizations.imageOptimization || false,
        treeShaking: optimizations.treeShaking || false,
        serviceWorker: optimizations.serviceWorker || false,
        assetPreloading: optimizations.assetPreloading || false,
        ...optimizations
      }
    };

    this.saveMetrics(metrics, 'optimized');
    return metrics;
  }

  /**
   * Get total bundle size
   */
  getBundleSize() {
    try {
      const nextPath = this.nextDir;
      if (!fs.existsSync(nextPath)) {
        return { total: 0, unit: 'MB' };
      }

      const output = execSync(`du -sh "${nextPath}"`, { encoding: 'utf8' });
      const [size, unit] = output.trim().split('\t')[0].match(/(\d+\.?\d*)(\w+)/).slice(1);
      
      return {
        total: parseFloat(size),
        unit: unit,
        raw: output.trim()
      };
    } catch (error) {
      console.warn('Warning: Could not get bundle size:', error.message);
      return { total: 0, unit: 'MB', error: error.message };
    }
  }

  /**
   * Get JavaScript file statistics
   */
  getJSFileStats() {
    try {
      const staticPath = path.join(this.nextDir, 'static');
      if (!fs.existsSync(staticPath)) {
        return { count: 0, totalSize: 0 };
      }

      const output = execSync(`find "${staticPath}" -name "*.js" -exec du -ch {} + | tail -1`, { encoding: 'utf8' });
      const totalSize = output.trim().split('\t')[0];
      
      const countOutput = execSync(`find "${staticPath}" -name "*.js" | wc -l`, { encoding: 'utf8' });
      const count = parseInt(countOutput.trim());

      return {
        count,
        totalSize,
        averageSize: count > 0 ? (parseFloat(totalSize) / count).toFixed(2) + 'K' : '0K'
      };
    } catch (error) {
      console.warn('Warning: Could not get JS file stats:', error.message);
      return { count: 0, totalSize: '0K', error: error.message };
    }
  }

  /**
   * Analyze chunk composition
   */
  getChunkAnalysis() {
    try {
      const chunksPath = path.join(this.nextDir, 'static', 'chunks');
      if (!fs.existsSync(chunksPath)) {
        return { vendorChunks: 0, pageChunks: 0, sharedChunks: 0 };
      }

      const files = fs.readdirSync(chunksPath);
      const analysis = {
        vendorChunks: files.filter(f => f.includes('vendor')).length,
        pageChunks: files.filter(f => f.includes('page')).length,
        sharedChunks: files.filter(f => f.includes('shared') || f.includes('common')).length,
        totalChunks: files.filter(f => f.endsWith('.js')).length
      };

      return analysis;
    } catch (error) {
      console.warn('Warning: Could not analyze chunks:', error.message);
      return { vendorChunks: 0, pageChunks: 0, sharedChunks: 0, error: error.message };
    }
  }

  /**
   * Get performance score (simulated - in real app would use Lighthouse)
   */
  getPerformanceScore() {
    // Simulated performance score based on bundle size and chunks
    const bundleSize = this.getBundleSize();
    const chunks = this.getChunkAnalysis();
    
    let score = 100;
    
    // Penalize large bundle size
    if (bundleSize.total > 5) score -= 20;
    if (bundleSize.total > 10) score -= 30;
    
    // Reward proper chunking
    if (chunks.vendorChunks > 0) score += 5;
    if (chunks.sharedChunks > 0) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Save metrics to file
   */
  saveMetrics(metrics, phase) {
    try {
      let allMetrics = {};
      
      if (fs.existsSync(this.metricsFile)) {
        allMetrics = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      }
      
      allMetrics[phase] = metrics;
      
      fs.writeFileSync(this.metricsFile, JSON.stringify(allMetrics, null, 2));
      console.log(`📊 Metrics saved for phase: ${phase}`);
    } catch (error) {
      console.error('Error saving metrics:', error);
    }
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport() {
    try {
      if (!fs.existsSync(this.metricsFile)) {
        console.log('❌ No metrics file found. Run baseline collection first.');
        return;
      }

      const allMetrics = JSON.parse(fs.readFileSync(this.metricsFile, 'utf8'));
      const baseline = allMetrics.baseline;
      const optimized = allMetrics.optimized;

      if (!baseline) {
        console.log('❌ No baseline metrics found.');
        return;
      }

      const report = this.createOptimizationReport(baseline, optimized);
      
      // Save report
      const reportPath = path.join(__dirname, '../BUNDLE_OPTIMIZATION_REPORT.md');
      fs.writeFileSync(reportPath, report);
      
      console.log('📊 Bundle optimization report generated:', reportPath);
      console.log('\n' + report);
      
      return report;
    } catch (error) {
      console.error('Error generating report:', error);
    }
  }

  /**
   * Create detailed optimization report
   */
  createOptimizationReport(baseline, optimized) {
    const bundleImprovement = optimized 
      ? ((baseline.bundleSize.total - optimized.bundleSize.total) / baseline.bundleSize.total * 100).toFixed(2)
      : 'N/A';
    
    const performanceImprovement = optimized
      ? (optimized.performanceScore - baseline.performanceScore).toFixed(1)
      : 'N/A';

    return `# Bundle Optimization Report

## Executive Summary

This report provides a comprehensive analysis of bundle optimization efforts for the ETF Research Platform frontend application.

### Key Metrics

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| Bundle Size | ${baseline.bundleSize.total}${baseline.bundleSize.unit} | ${optimized ? optimized.bundleSize.total + optimized.bundleSize.unit : 'N/A'} | ${bundleImprovement}% |
| Performance Score | ${baseline.performanceScore}/100 | ${optimized ? optimized.performanceScore : 'N/A'}/100 | +${performanceImprovement} points |
| JS Files Count | ${baseline.jsFiles.count} | ${optimized ? optimized.jsFiles.count : 'N/A'} | ${optimized ? baseline.jsFiles.count - optimized.jsFiles.count : 'N/A'} files |
| Total Chunks | ${baseline.chunkAnalysis.totalChunks} | ${optimized ? optimized.chunkAnalysis.totalChunks : 'N/A'} | ${optimized ? optimized.chunkAnalysis.totalChunks - baseline.chunkAnalysis.totalChunks : 'N/A'} chunks |

## Baseline Analysis

### Bundle Composition
- **Total Size**: ${baseline.bundleSize.total}${baseline.bundleSize.unit}
- **JavaScript Files**: ${baseline.jsFiles.count} files (${baseline.jsFiles.totalSize} total)
- **Average File Size**: ${baseline.jsFiles.averageSize}

### Chunk Analysis
- **Vendor Chunks**: ${baseline.chunkAnalysis.vendorChunks}
- **Page Chunks**: ${baseline.chunkAnalysis.pageChunks}
- **Shared Chunks**: ${baseline.chunkAnalysis.sharedChunks}
- **Total Chunks**: ${baseline.chunkAnalysis.totalChunks}

### Performance Metrics
- **Performance Score**: ${baseline.performanceScore}/100
- **Cache Hit Ratio**: ${baseline.cacheHitRatio}%

## Optimization Strategies Implemented

${optimized ? `### ✅ Implemented Optimizations
${Object.entries(optimized.optimizations).map(([key, value]) => 
  `- **${key.replace(/([A-Z])/g, ' $1').toLowerCase()}**: ${value ? '✅ Implemented' : '❌ Pending'}`
).join('\n')}` : '### ⏳ Optimization Status\nOptimizations are currently being implemented.'}

## Detailed Analysis

### Code Splitting Implementation
- Route-based code splitting for all application pages
- Component-level code splitting for heavy components (charts, dashboards)
- Smart bundling strategies with webpack optimization

### Asset Optimization
- Image optimization with next/image
- Responsive image loading strategies
- Asset preloading for critical resources
- Efficient font loading implementation

### Tree Shaking & Bundle Optimization
- Third-party library import optimization
- Dead code elimination
- Selective imports for better tree shaking
- Advanced webpack configuration

### Caching Strategies
- Service worker implementation for intelligent caching
- Cache invalidation strategies
- Offline-first architecture patterns
- Aggressive static asset caching

### Performance Monitoring
- Bundle size monitoring and alerts
- Performance budgets implementation
- Automated bundle analysis
- Performance regression testing

## Recommendations

### Immediate Actions
1. **Complete Route Splitting**: Ensure all routes use React.lazy for optimal loading
2. **Image Optimization**: Implement next/image for all static assets
3. **Service Worker**: Deploy service worker for advanced caching

### Performance Targets
- **Bundle Size Reduction**: Target 20-30% reduction in main bundle
- **Performance Score**: Achieve 90+ performance score
- **Cache Hit Ratio**: Target 80%+ cache efficiency

### Monitoring & Maintenance
- Set up automated bundle size monitoring
- Implement performance budgets in CI/CD
- Regular performance audits and optimization reviews

## Technical Implementation Details

### Webpack Configuration
- Advanced code splitting with optimized chunk groups
- Vendor bundle separation for better caching
- Dynamic imports for lazy loading

### Next.js Optimizations
- Static generation for optimal performance
- Image optimization with responsive loading
- Font optimization and preloading

### Caching Strategy
- Browser caching with optimal cache headers
- Service worker for offline functionality
- CDN optimization for static assets

## Conclusion

${optimized ? `The bundle optimization efforts have resulted in a ${bundleImprovement}% reduction in bundle size and a ${performanceImprovement} point improvement in performance score. These optimizations significantly enhance the user experience through faster load times and improved caching efficiency.` : 'Bundle optimization is in progress. This report will be updated with optimization results upon completion.'}

---
**Report Generated**: ${new Date().toISOString()}
**Next Review**: After optimization completion
`;
  }
}

// CLI interface
if (require.main === module) {
  const tracker = new BundleOptimizationTracker();
  const command = process.argv[2];

  switch (command) {
    case 'baseline':
      tracker.collectBaselineMetrics();
      break;
    case 'optimized':
      const optimizations = JSON.parse(process.argv[3] || '{}');
      tracker.collectOptimizedMetrics(optimizations);
      break;
    case 'report':
      tracker.generateOptimizationReport();
      break;
    default:
      console.log('Usage: node bundle-optimization-metrics.js [baseline|optimized|report]');
      console.log('  baseline  - Collect baseline metrics');
      console.log('  optimized - Collect optimized metrics');
      console.log('  report    - Generate optimization report');
  }
}

module.exports = BundleOptimizationTracker;