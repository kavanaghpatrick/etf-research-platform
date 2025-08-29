#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function generateTestReport() {
  console.log('🧪 Generating comprehensive test report...\n');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      coverage: {
        lines: 0,
        statements: 0,
        functions: 0,
        branches: 0,
      },
    },
    testTypes: {},
    files: [],
    performance: {},
    accessibility: {},
    visualRegression: {},
  };

  try {
    // Run tests with coverage
    console.log('📊 Running tests with coverage...');
    const jestOutput = execSync('npm run test:ci -- --json --outputFile=test-results.json', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // Parse Jest results
    const jestResults = JSON.parse(await fs.readFile('test-results.json', 'utf8'));
    
    report.summary.totalTests = jestResults.numTotalTests;
    report.summary.passedTests = jestResults.numPassedTests;
    report.summary.failedTests = jestResults.numFailedTests;
    report.summary.skippedTests = jestResults.numPendingTests;

    // Parse coverage data
    if (await fileExists('coverage/coverage-summary.json')) {
      const coverage = JSON.parse(await fs.readFile('coverage/coverage-summary.json', 'utf8'));
      report.summary.coverage = {
        lines: coverage.total.lines.pct,
        statements: coverage.total.statements.pct,
        functions: coverage.total.functions.pct,
        branches: coverage.total.branches.pct,
      };
    }

    // Analyze test types
    console.log('📈 Analyzing test types...');
    const testFiles = jestResults.testResults;
    
    const testTypes = {
      unit: { pattern: /\.test\.(ts|tsx)$/, results: [] },
      integration: { pattern: /\.integration\.(ts|tsx)$/, results: [] },
      accessibility: { pattern: /\.accessibility\.(ts|tsx)$/, results: [] },
      performance: { pattern: /\.perf\.(ts|tsx)$/, results: [] },
    };

    testFiles.forEach(file => {
      for (const [type, config] of Object.entries(testTypes)) {
        if (config.pattern.test(file.testFilePath)) {
          config.results.push(file);
        }
      }
    });

    // Aggregate test type metrics
    for (const [type, config] of Object.entries(testTypes)) {
      const tests = config.results;
      const totalTests = tests.reduce((sum, t) => sum + t.numTotalTests, 0);
      const passedTests = tests.reduce((sum, t) => sum + t.numPassedTests, 0);
      const duration = tests.reduce((sum, t) => sum + (t.endTime - t.startTime), 0) / 1000;

      report.testTypes[type] = {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        duration: duration.toFixed(2),
        files: tests.length,
      };
    }

    // Check for E2E test results
    if (await fileExists('playwright-report/results.json')) {
      console.log('🌐 Processing E2E test results...');
      const e2eResults = JSON.parse(await fs.readFile('playwright-report/results.json', 'utf8'));
      
      report.testTypes.e2e = {
        total: e2eResults.stats.total,
        passed: e2eResults.stats.passed,
        failed: e2eResults.stats.failed,
        duration: e2eResults.stats.duration / 1000,
        browsers: e2eResults.browsers || [],
      };
    }

    // Performance metrics
    console.log('⚡ Gathering performance metrics...');
    report.performance = await gatherPerformanceMetrics();

    // Accessibility report
    console.log('♿ Compiling accessibility report...');
    report.accessibility = await gatherAccessibilityReport();

    // File-level coverage details
    if (await fileExists('coverage/lcov-report/index.html')) {
      console.log('📁 Processing file-level coverage...');
      const coverageDetails = await parseFileCoverage();
      report.files = coverageDetails
        .filter(file => file.lines.pct < 90)
        .sort((a, b) => a.lines.pct - b.lines.pct)
        .slice(0, 10); // Top 10 files with lowest coverage
    }

    // Generate HTML report
    console.log('📝 Generating HTML report...');
    await generateHTMLReport(report);

    // Generate markdown summary
    console.log('📄 Generating markdown summary...');
    await generateMarkdownSummary(report);

    // Output to console
    console.log('\n✅ Test Report Summary:');
    console.log('=======================');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests} (${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log(`Skipped: ${report.summary.skippedTests}`);
    console.log('\nCoverage:');
    console.log(`  Lines: ${report.summary.coverage.lines}%`);
    console.log(`  Statements: ${report.summary.coverage.statements}%`);
    console.log(`  Functions: ${report.summary.coverage.functions}%`);
    console.log(`  Branches: ${report.summary.coverage.branches}%`);

    // Check if coverage meets thresholds
    const coverageThresholds = { lines: 90, statements: 90, functions: 90, branches: 90 };
    let failedThresholds = false;

    for (const [metric, threshold] of Object.entries(coverageThresholds)) {
      if (report.summary.coverage[metric] < threshold) {
        console.log(`\n❌ Coverage threshold not met for ${metric}: ${report.summary.coverage[metric]}% < ${threshold}%`);
        failedThresholds = true;
      }
    }

    if (failedThresholds) {
      process.exit(1);
    }

    console.log('\n✅ All tests passed and coverage thresholds met!');

  } catch (error) {
    console.error('❌ Error generating test report:', error);
    process.exit(1);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function gatherPerformanceMetrics() {
  const metrics = {
    renderTimes: [],
    bundleSize: null,
    memoryUsage: [],
  };

  // Parse performance test results if available
  if (await fileExists('reports/performance/metrics.json')) {
    const perfData = JSON.parse(await fs.readFile('reports/performance/metrics.json', 'utf8'));
    metrics.renderTimes = perfData.renderTimes || [];
    metrics.memoryUsage = perfData.memoryUsage || [];
  }

  // Check bundle size
  try {
    const buildDir = path.join(process.cwd(), '.next');
    const stats = await fs.stat(buildDir);
    if (stats.isDirectory()) {
      const size = await getDirSize(buildDir);
      metrics.bundleSize = (size / 1024 / 1024).toFixed(2) + ' MB';
    }
  } catch (error) {
    // Build directory might not exist
  }

  return metrics;
}

async function getDirSize(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  const sizes = await Promise.all(
    files.map(async file => {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        return getDirSize(filePath);
      }
      const stats = await fs.stat(filePath);
      return stats.size;
    })
  );
  return sizes.reduce((acc, size) => acc + size, 0);
}

async function gatherAccessibilityReport() {
  const report = {
    violations: [],
    passes: 0,
    incomplete: 0,
  };

  if (await fileExists('reports/accessibility/axe-results.json')) {
    const axeResults = JSON.parse(await fs.readFile('reports/accessibility/axe-results.json', 'utf8'));
    report.violations = axeResults.violations || [];
    report.passes = axeResults.passes?.length || 0;
    report.incomplete = axeResults.incomplete?.length || 0;
  }

  return report;
}

async function parseFileCoverage() {
  // This would parse the lcov file for detailed coverage info
  // For now, return mock data
  return [
    { file: 'src/components/StockChart.tsx', lines: { pct: 85.5 } },
    { file: 'src/hooks/useStockData.ts', lines: { pct: 78.2 } },
  ];
}

async function generateHTMLReport(report) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Report - ${new Date(report.timestamp).toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .metric { display: inline-block; margin-right: 30px; }
    .metric-value { font-size: 2em; font-weight: bold; color: #333; }
    .metric-label { font-size: 0.9em; color: #666; }
    .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; }
    .progress-fill { height: 100%; transition: width 0.3s; }
    .success { background: #4caf50; }
    .warning { background: #ff9800; }
    .error { background: #f44336; }
    h1, h2 { color: #333; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Test Report</h1>
    <p>Generated on ${new Date(report.timestamp).toLocaleString()}</p>
    
    <div class="card">
      <h2>Summary</h2>
      <div class="metric">
        <div class="metric-value">${report.summary.totalTests}</div>
        <div class="metric-label">Total Tests</div>
      </div>
      <div class="metric">
        <div class="metric-value" style="color: #4caf50">${report.summary.passedTests}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric">
        <div class="metric-value" style="color: ${report.summary.failedTests > 0 ? '#f44336' : '#666'}">${report.summary.failedTests}</div>
        <div class="metric-label">Failed</div>
      </div>
    </div>
    
    <div class="card">
      <h2>Coverage</h2>
      ${Object.entries(report.summary.coverage).map(([metric, value]) => `
        <div style="margin-bottom: 15px">
          <div style="display: flex; justify-content: space-between; margin-bottom: 5px">
            <span>${metric.charAt(0).toUpperCase() + metric.slice(1)}</span>
            <span>${value}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill ${value >= 90 ? 'success' : value >= 80 ? 'warning' : 'error'}" style="width: ${value}%"></div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="card">
      <h2>Test Types</h2>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Total</th>
            <th>Passed</th>
            <th>Failed</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(report.testTypes).map(([type, data]) => `
            <tr>
              <td>${type.charAt(0).toUpperCase() + type.slice(1)}</td>
              <td>${data.total}</td>
              <td style="color: #4caf50">${data.passed}</td>
              <td style="color: ${data.failed > 0 ? '#f44336' : '#666'}">${data.failed}</td>
              <td>${data.duration}s</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `;

  await fs.mkdir('reports', { recursive: true });
  await fs.writeFile('reports/test-report.html', html);
}

async function generateMarkdownSummary(report) {
  const markdown = `# Test Report Summary

Generated: ${new Date(report.timestamp).toLocaleString()}

## 📊 Overview

- **Total Tests**: ${report.summary.totalTests}
- **Passed**: ${report.summary.passedTests} ✅
- **Failed**: ${report.summary.failedTests} ${report.summary.failedTests > 0 ? '❌' : '✅'}
- **Skipped**: ${report.summary.skippedTests}
- **Success Rate**: ${((report.summary.passedTests / report.summary.totalTests) * 100).toFixed(1)}%

## 📈 Coverage

| Metric | Coverage | Status |
|--------|----------|--------|
| Lines | ${report.summary.coverage.lines}% | ${report.summary.coverage.lines >= 90 ? '✅' : '⚠️'} |
| Statements | ${report.summary.coverage.statements}% | ${report.summary.coverage.statements >= 90 ? '✅' : '⚠️'} |
| Functions | ${report.summary.coverage.functions}% | ${report.summary.coverage.functions >= 90 ? '✅' : '⚠️'} |
| Branches | ${report.summary.coverage.branches}% | ${report.summary.coverage.branches >= 90 ? '✅' : '⚠️'} |

## 🧪 Test Breakdown

${Object.entries(report.testTypes).map(([type, data]) => 
  `### ${type.charAt(0).toUpperCase() + type.slice(1)} Tests
- Total: ${data.total}
- Passed: ${data.passed}
- Failed: ${data.failed}
- Duration: ${data.duration}s`
).join('\n\n')}

## 📝 Notes

${report.summary.failedTests > 0 ? '⚠️ There are failing tests that need attention.' : '✅ All tests are passing!'}
${Object.values(report.summary.coverage).some(v => v < 90) ? '⚠️ Some coverage metrics are below the 90% threshold.' : '✅ All coverage thresholds met!'}
`;

  await fs.writeFile('reports/test-summary.md', markdown);
}

// Run the report generator
generateTestReport().catch(console.error);