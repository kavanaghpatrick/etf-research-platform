#!/usr/bin/env node

/**
 * Automated Bundle Analysis and Regression Testing
 * Provides comprehensive bundle analysis and performance regression detection
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutomatedBundleAnalyzer {
  constructor() {
    this.analysisDir = path.join(process.cwd(), '.bundle-analysis');
    this.reportPath = path.join(this.analysisDir, 'bundle-analysis.json');
    this.historyPath = path.join(this.analysisDir, 'bundle-history.json');
    this.nextDir = path.join(process.cwd(), '.next');
    
    // Ensure analysis directory exists
    if (!fs.existsSync(this.analysisDir)) {
      fs.mkdirSync(this.analysisDir, { recursive: true });
    }
  }

  /**
   * Run complete bundle analysis
   */
  async analyze() {
    console.log('🔍 Running automated bundle analysis...\n');
    
    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        commit: this.getGitCommit(),
        branch: this.getGitBranch(),
        buildInfo: await this.getBuildInfo(),
        bundleAnalysis: await this.analyzeBundles(),
        dependencyAnalysis: await this.analyzeDependencies(),
        performanceMetrics: await this.getPerformanceMetrics(),
        regressionCheck: await this.checkRegression(),
        recommendations: this.generateRecommendations(),
      };

      await this.saveAnalysis(analysis);
      await this.updateHistory(analysis);
      
      return this.displayResults(analysis);
    } catch (error) {
      console.error('❌ Bundle analysis failed:', error);
      process.exit(1);
    }
  }

  /**
   * Get build information
   */
  async getBuildInfo() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const nextConfig = fs.existsSync('next.config.ts') 
      ? fs.readFileSync('next.config.ts', 'utf8') 
      : '';

    return {
      nodeVersion: process.version,
      npmVersion: execSync('npm --version', { encoding: 'utf8' }).trim(),
      nextVersion: packageJson.dependencies?.next || 'unknown',
      reactVersion: packageJson.dependencies?.react || 'unknown',
      buildTime: this.getBuildTime(),
      optimizations: this.extractOptimizations(nextConfig),
    };
  }

  /**
   * Analyze bundle composition
   */
  async analyzeBundles() {
    if (!fs.existsSync(this.nextDir)) {
      throw new Error('.next directory not found. Run "npm run build" first.');
    }

    const staticPath = path.join(this.nextDir, 'static');
    const analysis = {
      totalSize: 0,
      chunks: [],
      assets: [],
      duplicates: [],
      unusedFiles: [],
      compression: {},
    };

    // Analyze chunks
    const chunksPath = path.join(staticPath, 'chunks');
    if (fs.existsSync(chunksPath)) {
      const chunkFiles = fs.readdirSync(chunksPath).filter(f => f.endsWith('.js'));
      
      for (const chunk of chunkFiles) {
        const filePath = path.join(chunksPath, chunk);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        
        const chunkAnalysis = {
          name: chunk,
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024),
          lines: content.split('\n').length,
          dependencies: this.extractDependencies(content),
          duplicateCode: this.findDuplicateCode(content),
          compression: await this.analyzeCompression(filePath),
        };

        analysis.chunks.push(chunkAnalysis);
        analysis.totalSize += stats.size;
      }
    }

    // Analyze other assets
    const allFiles = this.getAllFiles(staticPath);
    for (const file of allFiles) {
      if (!file.endsWith('.js')) {
        const stats = fs.statSync(file);
        analysis.assets.push({
          name: path.relative(staticPath, file),
          size: stats.size,
          sizeKB: Math.round(stats.size / 1024),
          type: path.extname(file),
        });
        analysis.totalSize += stats.size;
      }
    }

    // Sort by size
    analysis.chunks.sort((a, b) => b.size - a.size);
    analysis.assets.sort((a, b) => b.size - a.size);

    // Find duplicates across chunks
    analysis.duplicates = this.findDuplicatesAcrossChunks(analysis.chunks);

    return analysis;
  }

  /**
   * Analyze dependencies
   */
  async analyzeDependencies() {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const lockfile = fs.existsSync('package-lock.json') 
      ? JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
      : null;

    const dependencies = {
      production: Object.keys(packageJson.dependencies || {}),
      development: Object.keys(packageJson.devDependencies || {}),
      total: 0,
      sizes: {},
      vulnerabilities: await this.checkVulnerabilities(),
      outdated: await this.checkOutdated(),
      unused: await this.findUnusedDependencies(),
    };

    dependencies.total = dependencies.production.length + dependencies.development.length;

    // Analyze dependency sizes (from node_modules)
    if (lockfile && lockfile.packages) {
      for (const [pkg, info] of Object.entries(lockfile.packages)) {
        if (pkg.startsWith('node_modules/')) {
          const name = pkg.replace('node_modules/', '');
          try {
            const pkgPath = path.join(process.cwd(), 'node_modules', name);
            if (fs.existsSync(pkgPath)) {
              dependencies.sizes[name] = this.getDirectorySize(pkgPath);
            }
          } catch (error) {
            // Ignore errors for individual packages
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics() {
    const metrics = {
      buildTime: this.getBuildTime(),
      bundleSize: {
        total: 0,
        gzipped: 0,
        brotli: 0,
      },
      chunks: {
        count: 0,
        averageSize: 0,
        largestChunk: 0,
      },
      treeshaking: {
        eliminated: 0,
        retained: 0,
        efficiency: 0,
      },
    };

    // Calculate bundle metrics
    const staticPath = path.join(this.nextDir, 'static');
    if (fs.existsSync(staticPath)) {
      const allFiles = this.getAllFiles(staticPath);
      
      for (const file of allFiles) {
        const stats = fs.statSync(file);
        metrics.bundleSize.total += stats.size;
        
        if (file.endsWith('.js')) {
          metrics.chunks.count++;
          metrics.chunks.largestChunk = Math.max(metrics.chunks.largestChunk, stats.size);
        }
      }
      
      if (metrics.chunks.count > 0) {
        metrics.chunks.averageSize = Math.round(metrics.bundleSize.total / metrics.chunks.count);
      }
    }

    return metrics;
  }

  /**
   * Check for performance regressions
   */
  async checkRegression() {
    const history = this.loadHistory();
    if (history.length < 2) {
      return { hasRegression: false, message: 'Insufficient history for regression analysis' };
    }

    const current = history[history.length - 1];
    const previous = history[history.length - 2];
    
    const regressions = [];
    const improvements = [];
    
    // Check bundle size regression (>5% increase)
    const sizeDiff = ((current.bundleSize - previous.bundleSize) / previous.bundleSize) * 100;
    if (sizeDiff > 5) {
      regressions.push(`Bundle size increased by ${sizeDiff.toFixed(1)}%`);
    } else if (sizeDiff < -5) {
      improvements.push(`Bundle size decreased by ${Math.abs(sizeDiff).toFixed(1)}%`);
    }

    // Check chunk count regression
    const chunkDiff = current.chunkCount - previous.chunkCount;
    if (chunkDiff > 3) {
      regressions.push(`Chunk count increased by ${chunkDiff}`);
    } else if (chunkDiff < -3) {
      improvements.push(`Chunk count decreased by ${Math.abs(chunkDiff)}`);
    }

    // Check build time regression (>20% increase)
    const timeDiff = ((current.buildTime - previous.buildTime) / previous.buildTime) * 100;
    if (timeDiff > 20) {
      regressions.push(`Build time increased by ${timeDiff.toFixed(1)}%`);
    } else if (timeDiff < -20) {
      improvements.push(`Build time decreased by ${Math.abs(timeDiff).toFixed(1)}%`);
    }

    return {
      hasRegression: regressions.length > 0,
      regressions,
      improvements,
      comparison: {
        current: current.timestamp,
        previous: previous.timestamp,
        sizeDiff: sizeDiff.toFixed(1),
        chunkDiff,
        timeDiff: timeDiff.toFixed(1),
      },
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations() {
    const recommendations = [];

    // Size-based recommendations
    const totalSizeMB = fs.existsSync(this.nextDir) 
      ? this.getDirectorySize(this.nextDir) / (1024 * 1024)
      : 0;

    if (totalSizeMB > 10) {
      recommendations.push({
        type: 'size',
        priority: 'high',
        message: 'Bundle size is over 10MB. Consider implementing aggressive code splitting.',
        action: 'Review large dependencies and implement dynamic imports',
      });
    }

    // Chunk-based recommendations
    const chunksPath = path.join(this.nextDir, 'static', 'chunks');
    if (fs.existsSync(chunksPath)) {
      const chunkCount = fs.readdirSync(chunksPath).filter(f => f.endsWith('.js')).length;
      
      if (chunkCount > 50) {
        recommendations.push({
          type: 'chunks',
          priority: 'medium',
          message: 'High chunk count detected. Consider chunk merging strategies.',
          action: 'Review webpack splitChunks configuration',
        });
      }
    }

    // Dependency recommendations
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const depCount = Object.keys(packageJson.dependencies || {}).length;
    
    if (depCount > 50) {
      recommendations.push({
        type: 'dependencies',
        priority: 'medium',
        message: 'High dependency count. Review for unused or redundant packages.',
        action: 'Run dependency audit and remove unused packages',
      });
    }

    return recommendations;
  }

  /**
   * Save analysis results
   */
  async saveAnalysis(analysis) {
    fs.writeFileSync(this.reportPath, JSON.stringify(analysis, null, 2));
    console.log(`📄 Analysis saved to: ${this.reportPath}`);
  }

  /**
   * Update analysis history
   */
  async updateHistory(analysis) {
    const history = this.loadHistory();
    
    const historyEntry = {
      timestamp: analysis.timestamp,
      commit: analysis.commit,
      branch: analysis.branch,
      bundleSize: analysis.bundleAnalysis.totalSize,
      chunkCount: analysis.bundleAnalysis.chunks.length,
      buildTime: analysis.buildInfo.buildTime,
      score: this.calculateScore(analysis),
    };
    
    history.push(historyEntry);
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    
    fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2));
  }

  /**
   * Load analysis history
   */
  loadHistory() {
    if (fs.existsSync(this.historyPath)) {
      return JSON.parse(fs.readFileSync(this.historyPath, 'utf8'));
    }
    return [];
  }

  /**
   * Calculate optimization score
   */
  calculateScore(analysis) {
    let score = 100;
    
    // Penalize large bundle size
    const sizeMB = analysis.bundleAnalysis.totalSize / (1024 * 1024);
    if (sizeMB > 5) score -= 20;
    if (sizeMB > 10) score -= 30;
    
    // Penalize many chunks
    if (analysis.bundleAnalysis.chunks.length > 30) score -= 10;
    if (analysis.bundleAnalysis.chunks.length > 50) score -= 20;
    
    // Penalize regressions
    if (analysis.regressionCheck.hasRegression) {
      score -= analysis.regressionCheck.regressions.length * 10;
    }
    
    // Reward optimizations
    score += analysis.recommendations.filter(r => r.priority === 'low').length * 5;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Display analysis results
   */
  displayResults(analysis) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 AUTOMATED BUNDLE ANALYSIS RESULTS');
    console.log('='.repeat(60));

    // Summary
    console.log(`\n🔍 Analysis Summary:`);
    console.log(`  Timestamp: ${analysis.timestamp}`);
    console.log(`  Commit: ${analysis.commit || 'unknown'}`);
    console.log(`  Branch: ${analysis.branch || 'unknown'}`);
    console.log(`  Score: ${this.calculateScore(analysis)}/100`);

    // Bundle metrics
    console.log(`\n📦 Bundle Metrics:`);
    console.log(`  Total Size: ${(analysis.bundleAnalysis.totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`  Chunks: ${analysis.bundleAnalysis.chunks.length}`);
    console.log(`  Assets: ${analysis.bundleAnalysis.assets.length}`);

    // Performance
    console.log(`\n⚡ Performance:`);
    console.log(`  Build Time: ${analysis.buildInfo.buildTime}ms`);
    console.log(`  Average Chunk Size: ${analysis.performanceMetrics.chunks.averageSize} bytes`);
    console.log(`  Largest Chunk: ${(analysis.performanceMetrics.chunks.largestChunk / 1024).toFixed(1)} KB`);

    // Regression check
    if (analysis.regressionCheck.hasRegression) {
      console.log(`\n❌ Regressions Detected:`);
      analysis.regressionCheck.regressions.forEach(regression => {
        console.log(`  - ${regression}`);
      });
    } else {
      console.log(`\n✅ No regressions detected`);
    }

    // Improvements
    if (analysis.regressionCheck.improvements?.length > 0) {
      console.log(`\n🎉 Improvements:`);
      analysis.regressionCheck.improvements.forEach(improvement => {
        console.log(`  - ${improvement}`);
      });
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      analysis.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
        console.log(`     Action: ${rec.action}`);
      });
    }

    return analysis.regressionCheck.hasRegression ? false : true;
  }

  // Utility methods
  getGitCommit() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  getGitBranch() {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  getBuildTime() {
    try {
      const buildLog = path.join(this.nextDir, 'trace');
      if (fs.existsSync(buildLog)) {
        // Parse Next.js trace for build time
        return 5000; // Placeholder
      }
      return 0;
    } catch {
      return 0;
    }
  }

  getAllFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  getDirectorySize(dirPath) {
    let totalSize = 0;
    const files = this.getAllFiles(dirPath);
    
    for (const file of files) {
      try {
        totalSize += fs.statSync(file).size;
      } catch {
        // Ignore errors
      }
    }
    
    return totalSize;
  }

  extractOptimizations(config) {
    const optimizations = [];
    
    if (config.includes('splitChunks')) optimizations.push('Code Splitting');
    if (config.includes('optimizePackageImports')) optimizations.push('Package Import Optimization');
    if (config.includes('concatenateModules')) optimizations.push('Module Concatenation');
    if (config.includes('webpackBuildWorker')) optimizations.push('Build Worker');
    
    return optimizations;
  }

  extractDependencies(content) {
    const deps = [];
    const importRegex = /import.*from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      deps.push(match[1]);
    }
    
    return [...new Set(deps)];
  }

  findDuplicateCode(content) {
    // Simple duplicate detection - count repeated function patterns
    const functionRegex = /function\s+\w+\s*\([^)]*\)\s*{[^}]+}/g;
    const functions = content.match(functionRegex) || [];
    const duplicates = functions.filter((func, index) => 
      functions.indexOf(func) !== index
    );
    
    return duplicates.length;
  }

  findDuplicatesAcrossChunks(chunks) {
    const duplicates = [];
    
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const commonDeps = chunks[i].dependencies.filter(dep => 
          chunks[j].dependencies.includes(dep)
        );
        
        if (commonDeps.length > 5) {
          duplicates.push({
            chunks: [chunks[i].name, chunks[j].name],
            commonDependencies: commonDeps,
          });
        }
      }
    }
    
    return duplicates;
  }

  async analyzeCompression(filePath) {
    try {
      const originalSize = fs.statSync(filePath).size;
      // Simulate compression analysis
      return {
        original: originalSize,
        gzipped: Math.round(originalSize * 0.3),
        brotli: Math.round(originalSize * 0.25),
        ratio: 70,
      };
    } catch {
      return null;
    }
  }

  async checkVulnerabilities() {
    try {
      const output = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(output);
      return {
        total: audit.metadata?.vulnerabilities?.total || 0,
        high: audit.metadata?.vulnerabilities?.high || 0,
        critical: audit.metadata?.vulnerabilities?.critical || 0,
      };
    } catch {
      return { total: 0, high: 0, critical: 0 };
    }
  }

  async checkOutdated() {
    try {
      const output = execSync('npm outdated --json', { encoding: 'utf8' });
      const outdated = JSON.parse(output);
      return Object.keys(outdated).length;
    } catch {
      return 0;
    }
  }

  async findUnusedDependencies() {
    // Simple unused dependency detection
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const deps = Object.keys(packageJson.dependencies || {});
    const srcFiles = this.getAllFiles(path.join(process.cwd(), 'src'))
      .filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));
    
    const unused = [];
    
    for (const dep of deps) {
      let isUsed = false;
      
      for (const file of srcFiles) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          if (content.includes(dep)) {
            isUsed = true;
            break;
          }
        } catch {
          // Ignore errors
        }
      }
      
      if (!isUsed) {
        unused.push(dep);
      }
    }
    
    return unused;
  }
}

// CLI interface
if (require.main === module) {
  const analyzer = new AutomatedBundleAnalyzer();
  const command = process.argv[2];

  switch (command) {
    case 'analyze':
      analyzer.analyze().then(passed => {
        process.exit(passed ? 0 : 1);
      });
      break;
    default:
      console.log('Usage: node automated-bundle-analysis.js [analyze]');
      console.log('  analyze  - Run complete bundle analysis');
  }
}

module.exports = AutomatedBundleAnalyzer;