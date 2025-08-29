#!/usr/bin/env node

/**
 * Performance Budget Monitoring Script
 * Enforces bundle size limits and performance metrics
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Performance budget thresholds
const PERFORMANCE_BUDGET = {
  // Bundle size limits (in KB)
  bundles: {
    main: 250,        // Main application bundle
    vendors: 500,     // Third-party libraries
    charts: 200,      // Chart library bundle
    react: 150,       // React framework bundle
    common: 100,      // Common shared code
    total: 1000,      // Total bundle size limit
  },
  
  // Asset size limits (in KB)
  assets: {
    images: 2000,     // Total image assets
    fonts: 500,       // Font files
    css: 100,         // Stylesheets
  },
  
  // Performance metrics
  performance: {
    firstContentfulPaint: 2000,   // 2 seconds
    largestContentfulPaint: 4000, // 4 seconds
    cumulativeLayoutShift: 0.1,   // CLS score
    firstInputDelay: 100,         // 100ms
    totalBlockingTime: 300,       // 300ms
  },
  
  // Bundle count limits
  limits: {
    maxChunks: 50,
    maxAssets: 200,
    maxDependencies: 100,
  }
};

class PerformanceBudgetMonitor {
  constructor() {
    this.nextDir = path.join(process.cwd(), '.next');
    this.reportPath = path.join(process.cwd(), 'performance-budget-report.json');
    this.violations = [];
    this.warnings = [];
  }

  /**
   * Run complete performance budget check
   */
  async check() {
    console.log('🔍 Running performance budget check...\n');
    
    try {
      await this.checkBundleSizes();
      await this.checkAssetSizes();
      await this.checkChunkCount();
      await this.generateReport();
      
      return this.displayResults();
    } catch (error) {
      console.error('❌ Performance budget check failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check bundle sizes against budget
   */
  async checkBundleSizes() {
    console.log('📦 Checking bundle sizes...');
    
    if (!fs.existsSync(this.nextDir)) {
      throw new Error('.next directory not found. Run "npm run build" first.');
    }

    const staticPath = path.join(this.nextDir, 'static');
    if (!fs.existsSync(staticPath)) {
      this.addWarning('No static assets found');
      return;
    }

    // Get chunk files
    const chunksPath = path.join(staticPath, 'chunks');
    if (fs.existsSync(chunksPath)) {
      const chunks = fs.readdirSync(chunksPath).filter(file => file.endsWith('.js'));
      
      const bundleSizes = {
        main: 0,
        vendors: 0,
        charts: 0,
        react: 0,
        common: 0,
        other: 0,
      };

      for (const chunk of chunks) {
        const filePath = path.join(chunksPath, chunk);
        const stats = fs.statSync(filePath);
        const sizeKB = Math.round(stats.size / 1024);

        // Categorize chunks
        if (chunk.includes('main')) {
          bundleSizes.main += sizeKB;
        } else if (chunk.includes('vendor') || chunk.includes('node_modules')) {
          bundleSizes.vendors += sizeKB;
        } else if (chunk.includes('chart') || chunk.includes('nivo')) {
          bundleSizes.charts += sizeKB;
        } else if (chunk.includes('react') || chunk.includes('framework')) {
          bundleSizes.react += sizeKB;
        } else if (chunk.includes('common') || chunk.includes('shared')) {
          bundleSizes.common += sizeKB;
        } else {
          bundleSizes.other += sizeKB;
        }
      }

      // Calculate total
      const totalSize = Object.values(bundleSizes).reduce((sum, size) => sum + size, 0);
      bundleSizes.total = totalSize;

      // Check against budget
      for (const [bundleType, actualSize] of Object.entries(bundleSizes)) {
        const budgetSize = PERFORMANCE_BUDGET.bundles[bundleType];
        if (budgetSize && actualSize > budgetSize) {
          this.addViolation(
            `Bundle size violation: ${bundleType} is ${actualSize}KB (limit: ${budgetSize}KB)`,
            'bundle-size',
            { type: bundleType, actual: actualSize, budget: budgetSize }
          );
        } else if (budgetSize) {
          console.log(`  ✅ ${bundleType}: ${actualSize}KB / ${budgetSize}KB`);
        }
      }

      this.bundleSizes = bundleSizes;
    }
  }

  /**
   * Check asset sizes
   */
  async checkAssetSizes() {
    console.log('\n🖼️  Checking asset sizes...');
    
    const assetSizes = { images: 0, fonts: 0, css: 0 };
    
    // Check images
    const publicPath = path.join(process.cwd(), 'public');
    if (fs.existsSync(publicPath)) {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.avif'];
      const fontExtensions = ['.woff', '.woff2', '.ttf', '.otf'];
      
      const getDirectorySize = (dirPath, extensions) => {
        let totalSize = 0;
        if (!fs.existsSync(dirPath)) return totalSize;
        
        const files = fs.readdirSync(dirPath, { recursive: true });
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          if (fs.statSync(filePath).isFile()) {
            const ext = path.extname(file).toLowerCase();
            if (extensions.includes(ext)) {
              totalSize += fs.statSync(filePath).size;
            }
          }
        }
        return Math.round(totalSize / 1024); // Convert to KB
      };

      assetSizes.images = getDirectorySize(publicPath, imageExtensions);
      assetSizes.fonts = getDirectorySize(publicPath, fontExtensions);
    }

    // Check CSS
    const cssPath = path.join(this.nextDir, 'static', 'css');
    if (fs.existsSync(cssPath)) {
      const cssFiles = fs.readdirSync(cssPath, { recursive: true });
      for (const file of cssFiles) {
        if (file.endsWith('.css')) {
          const filePath = path.join(cssPath, file);
          assetSizes.css += Math.round(fs.statSync(filePath).size / 1024);
        }
      }
    }

    // Check against budget
    for (const [assetType, actualSize] of Object.entries(assetSizes)) {
      const budgetSize = PERFORMANCE_BUDGET.assets[assetType];
      if (actualSize > budgetSize) {
        this.addViolation(
          `Asset size violation: ${assetType} is ${actualSize}KB (limit: ${budgetSize}KB)`,
          'asset-size',
          { type: assetType, actual: actualSize, budget: budgetSize }
        );
      } else {
        console.log(`  ✅ ${assetType}: ${actualSize}KB / ${budgetSize}KB`);
      }
    }

    this.assetSizes = assetSizes;
  }

  /**
   * Check chunk and asset counts
   */
  async checkChunkCount() {
    console.log('\n📊 Checking chunk counts...');
    
    const counts = { chunks: 0, assets: 0 };
    
    const chunksPath = path.join(this.nextDir, 'static', 'chunks');
    if (fs.existsSync(chunksPath)) {
      counts.chunks = fs.readdirSync(chunksPath).filter(file => file.endsWith('.js')).length;
    }

    const staticPath = path.join(this.nextDir, 'static');
    if (fs.existsSync(staticPath)) {
      const getAllFiles = (dirPath) => {
        let files = [];
        const items = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const item of items) {
          if (item.isDirectory()) {
            files = files.concat(getAllFiles(path.join(dirPath, item.name)));
          } else {
            files.push(item.name);
          }
        }
        return files;
      };
      
      counts.assets = getAllFiles(staticPath).length;
    }

    // Check against limits
    if (counts.chunks > PERFORMANCE_BUDGET.limits.maxChunks) {
      this.addViolation(
        `Too many chunks: ${counts.chunks} (limit: ${PERFORMANCE_BUDGET.limits.maxChunks})`,
        'chunk-count',
        counts
      );
    } else {
      console.log(`  ✅ Chunks: ${counts.chunks} / ${PERFORMANCE_BUDGET.limits.maxChunks}`);
    }

    if (counts.assets > PERFORMANCE_BUDGET.limits.maxAssets) {
      this.addViolation(
        `Too many assets: ${counts.assets} (limit: ${PERFORMANCE_BUDGET.limits.maxAssets})`,
        'asset-count',
        counts
      );
    } else {
      console.log(`  ✅ Assets: ${counts.assets} / ${PERFORMANCE_BUDGET.limits.maxAssets}`);
    }

    this.counts = counts;
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      budget: PERFORMANCE_BUDGET,
      results: {
        bundleSizes: this.bundleSizes || {},
        assetSizes: this.assetSizes || {},
        counts: this.counts || {},
      },
      violations: this.violations,
      warnings: this.warnings,
      passed: this.violations.length === 0,
      score: this.calculateScore(),
    };

    fs.writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Performance report saved to: ${this.reportPath}`);
    
    return report;
  }

  /**
   * Calculate performance score (0-100)
   */
  calculateScore() {
    const totalChecks = Object.keys(PERFORMANCE_BUDGET.bundles).length + 
                       Object.keys(PERFORMANCE_BUDGET.assets).length + 
                       Object.keys(PERFORMANCE_BUDGET.limits).length;
    
    const violationWeight = this.violations.length;
    const warningWeight = this.warnings.length * 0.5;
    
    const penalty = violationWeight + warningWeight;
    const score = Math.max(0, Math.min(100, 100 - (penalty / totalChecks) * 100));
    
    return Math.round(score);
  }

  /**
   * Display final results
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 PERFORMANCE BUDGET RESULTS');
    console.log('='.repeat(60));

    if (this.violations.length === 0) {
      console.log('✅ All performance budget checks passed!');
      console.log(`📊 Performance Score: ${this.calculateScore()}/100`);
      return true;
    } else {
      console.log('❌ Performance budget violations found:');
      this.violations.forEach((violation, index) => {
        console.log(`  ${index + 1}. ${violation.message}`);
      });

      if (this.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        this.warnings.forEach((warning, index) => {
          console.log(`  ${index + 1}. ${warning}`);
        });
      }

      console.log(`\n📊 Performance Score: ${this.calculateScore()}/100`);
      console.log('\n💡 Recommendations:');
      console.log('  - Review bundle splitting strategy');
      console.log('  - Consider lazy loading for non-critical components');
      console.log('  - Optimize image and asset sizes');
      console.log('  - Remove unused dependencies');

      return false;
    }
  }

  /**
   * Add a budget violation
   */
  addViolation(message, type, data = {}) {
    this.violations.push({
      message,
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Add a warning
   */
  addWarning(message) {
    this.warnings.push(message);
  }

  /**
   * Set up CI/CD integration
   */
  static setupCI() {
    const ciScript = `
# Performance Budget Check for CI/CD
name: Performance Budget
on: [push, pull_request]

jobs:
  performance-budget:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run perf:budget
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('performance-budget-report.json', 'utf8'));
            
            const comment = \`
            ## 🎯 Performance Budget Report
            
            **Score:** \${report.score}/100
            **Status:** \${report.passed ? '✅ Passed' : '❌ Failed'}
            
            \${report.violations.length > 0 ? 
              '### Violations:\\n' + report.violations.map(v => \`- \${v.message}\`).join('\\n') 
              : '### All checks passed! 🎉'}
            \`;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: comment
            });
    `;

    fs.writeFileSync('.github/workflows/performance-budget.yml', ciScript);
    console.log('✅ CI/CD performance budget workflow created');
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new PerformanceBudgetMonitor();
  const command = process.argv[2];

  switch (command) {
    case 'check':
      monitor.check().then(passed => {
        process.exit(passed ? 0 : 1);
      });
      break;
    case 'setup-ci':
      PerformanceBudgetMonitor.setupCI();
      break;
    default:
      console.log('Usage: node performance-budget.js [check|setup-ci]');
      console.log('  check     - Run performance budget check');
      console.log('  setup-ci  - Setup CI/CD integration');
  }
}

module.exports = PerformanceBudgetMonitor;