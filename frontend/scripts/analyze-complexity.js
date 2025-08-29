#!/usr/bin/env node

/**
 * @fileoverview Code complexity analysis tool for the ETF Research Platform
 * @description Analyzes TypeScript/JavaScript files for complexity metrics
 * @author Claude Code Quality Agent F
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Configuration for complexity analysis
 */
const CONFIG = {
  // Thresholds for different metrics
  thresholds: {
    cyclomaticComplexity: 10,
    cognitiveComplexity: 15,
    linesOfCode: 300,
    functionsPerFile: 10,
    parametersPerFunction: 5,
    nestingDepth: 4,
  },
  // File patterns to analyze
  patterns: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.stories.ts',
    '!src/**/*.stories.tsx',
    '!src/**/*.d.ts',
  ],
  // Output configuration
  output: {
    format: 'json', // 'json' | 'html' | 'csv'
    file: 'complexity-report.json',
    includeDetails: true,
  },
};

/**
 * File complexity metrics
 */
class FileMetrics {
  constructor(filePath) {
    this.filePath = filePath;
    this.linesOfCode = 0;
    this.physicalLines = 0;
    this.commentLines = 0;
    this.blankLines = 0;
    this.functions = [];
    this.complexity = {
      cyclomatic: 0,
      cognitive: 0,
      halstead: {},
    };
    this.maintainabilityIndex = 0;
    this.issues = [];
  }

  /**
   * Adds a function to the metrics
   */
  addFunction(name, startLine, endLine, complexity, parameters) {
    this.functions.push({
      name,
      startLine,
      endLine,
      linesOfCode: endLine - startLine + 1,
      complexity,
      parameters: parameters || 0,
    });
  }

  /**
   * Calculates the maintainability index
   */
  calculateMaintainabilityIndex() {
    const avgComplexity = this.functions.length > 0 
      ? this.functions.reduce((sum, fn) => sum + fn.complexity, 0) / this.functions.length
      : 1;
    
    const logLOC = Math.log(Math.max(this.linesOfCode, 1));
    const avgFunctionLength = this.functions.length > 0
      ? this.functions.reduce((sum, fn) => sum + fn.linesOfCode, 0) / this.functions.length
      : 1;
    
    // Simplified maintainability index calculation
    this.maintainabilityIndex = Math.max(0, 
      (171 - 5.2 * logLOC - 0.23 * avgComplexity - 16.2 * Math.log(avgFunctionLength)) * 100 / 171
    );
  }

  /**
   * Checks metrics against thresholds and adds issues
   */
  checkThresholds() {
    const { thresholds } = CONFIG;
    
    if (this.linesOfCode > thresholds.linesOfCode) {
      this.issues.push({
        type: 'lines_of_code',
        severity: 'warning',
        message: `File has ${this.linesOfCode} lines (threshold: ${thresholds.linesOfCode})`,
        value: this.linesOfCode,
        threshold: thresholds.linesOfCode,
      });
    }

    if (this.functions.length > thresholds.functionsPerFile) {
      this.issues.push({
        type: 'functions_per_file',
        severity: 'warning',
        message: `File has ${this.functions.length} functions (threshold: ${thresholds.functionsPerFile})`,
        value: this.functions.length,
        threshold: thresholds.functionsPerFile,
      });
    }

    this.functions.forEach(fn => {
      if (fn.complexity > thresholds.cyclomaticComplexity) {
        this.issues.push({
          type: 'cyclomatic_complexity',
          severity: fn.complexity > thresholds.cyclomaticComplexity * 2 ? 'error' : 'warning',
          message: `Function '${fn.name}' has complexity ${fn.complexity} (threshold: ${thresholds.cyclomaticComplexity})`,
          function: fn.name,
          line: fn.startLine,
          value: fn.complexity,
          threshold: thresholds.cyclomaticComplexity,
        });
      }

      if (fn.parameters > thresholds.parametersPerFunction) {
        this.issues.push({
          type: 'parameters_per_function',
          severity: 'warning',
          message: `Function '${fn.name}' has ${fn.parameters} parameters (threshold: ${thresholds.parametersPerFunction})`,
          function: fn.name,
          line: fn.startLine,
          value: fn.parameters,
          threshold: thresholds.parametersPerFunction,
        });
      }
    });
  }
}

/**
 * Analyzes a single TypeScript/JavaScript file
 */
function analyzeFile(filePath) {
  const metrics = new FileMetrics(filePath);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    metrics.physicalLines = lines.length;
    
    // Basic line counting
    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine === '') {
        metrics.blankLines++;
      } else if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        metrics.commentLines++;
      } else {
        metrics.linesOfCode++;
      }
    });

    // Function analysis using regex (simplified)
    const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=.*?(?:function|\(.*?\)\s*=>)|(\w+)\s*\(.*?\)\s*{)/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2] || match[3] || 'anonymous';
      const lineNumber = content.substring(0, match.index).split('\n').length;
      
      // Simplified complexity calculation
      const functionBody = extractFunctionBody(content, match.index);
      const complexity = calculateCyclomaticComplexity(functionBody);
      const parameters = countParameters(match[0]);
      
      metrics.addFunction(functionName, lineNumber, lineNumber + functionBody.split('\n').length, complexity, parameters);
    }

    metrics.calculateMaintainabilityIndex();
    metrics.checkThresholds();
    
  } catch (error) {
    metrics.issues.push({
      type: 'analysis_error',
      severity: 'error',
      message: `Failed to analyze file: ${error.message}`,
    });
  }
  
  return metrics;
}

/**
 * Extracts function body for analysis (simplified implementation)
 */
function extractFunctionBody(content, startIndex) {
  let braceCount = 0;
  let inFunction = false;
  let body = '';
  
  for (let i = startIndex; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') {
      braceCount++;
      inFunction = true;
    } else if (char === '}') {
      braceCount--;
    }
    
    if (inFunction) {
      body += char;
    }
    
    if (inFunction && braceCount === 0) {
      break;
    }
  }
  
  return body;
}

/**
 * Calculates cyclomatic complexity (simplified)
 */
function calculateCyclomaticComplexity(code) {
  // Count decision points
  const decisionPoints = [
    /if\s*\(/g,
    /else\s+if\s*\(/g,
    /while\s*\(/g,
    /for\s*\(/g,
    /switch\s*\(/g,
    /case\s+/g,
    /catch\s*\(/g,
    /\?\s*.*?\s*:/g, // ternary operators
    /&&/g,
    /\|\|/g,
  ];
  
  let complexity = 1; // Base complexity
  
  decisionPoints.forEach(pattern => {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  });
  
  return complexity;
}

/**
 * Counts function parameters
 */
function countParameters(functionSignature) {
  const paramMatch = functionSignature.match(/\(([^)]*)\)/);
  if (!paramMatch || !paramMatch[1].trim()) {
    return 0;
  }
  
  return paramMatch[1].split(',').filter(param => param.trim()).length;
}

/**
 * Gets all files matching the patterns
 */
function getFiles() {
  const { execSync } = require('child_process');
  
  try {
    // Use find command to get files (Unix-like systems)
    const result = execSync(`find src -name "*.ts" -o -name "*.tsx" | grep -v ".test." | grep -v ".stories." | grep -v ".d.ts"`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    });
    
    return result.trim().split('\n').filter(file => file.length > 0);
  } catch (error) {
    // Fallback: recursive directory traversal
    const files = [];
    
    function traverse(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      entries.forEach(entry => {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          traverse(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (!entry.name.includes('.test.') && !entry.name.includes('.stories.') && !entry.name.endsWith('.d.ts')) {
            files.push(fullPath);
          }
        }
      });
    }
    
    traverse('src');
    return files;
  }
}

/**
 * Generates complexity report
 */
function generateReport(fileMetrics) {
  const report = {
    summary: {
      totalFiles: fileMetrics.length,
      totalLinesOfCode: fileMetrics.reduce((sum, m) => sum + m.linesOfCode, 0),
      totalFunctions: fileMetrics.reduce((sum, m) => sum + m.functions.length, 0),
      averageComplexity: 0,
      averageMaintainabilityIndex: 0,
      issueCount: {
        error: 0,
        warning: 0,
      },
    },
    files: [],
    issues: [],
    timestamp: new Date().toISOString(),
  };

  let totalComplexity = 0;
  let totalMaintainability = 0;

  fileMetrics.forEach(metrics => {
    const fileReport = {
      path: metrics.filePath,
      linesOfCode: metrics.linesOfCode,
      physicalLines: metrics.physicalLines,
      commentLines: metrics.commentLines,
      blankLines: metrics.blankLines,
      functionCount: metrics.functions.length,
      complexity: Math.max(...metrics.functions.map(f => f.complexity), 0),
      maintainabilityIndex: Math.round(metrics.maintainabilityIndex * 100) / 100,
      functions: metrics.functions.map(fn => ({
        name: fn.name,
        line: fn.startLine,
        complexity: fn.complexity,
        parameters: fn.parameters,
        linesOfCode: fn.linesOfCode,
      })),
      issues: metrics.issues,
    };

    report.files.push(fileReport);
    report.issues.push(...metrics.issues);

    totalComplexity += fileReport.complexity;
    totalMaintainability += fileReport.maintainabilityIndex;

    metrics.issues.forEach(issue => {
      if (issue.severity === 'error') {
        report.summary.issueCount.error++;
      } else if (issue.severity === 'warning') {
        report.summary.issueCount.warning++;
      }
    });
  });

  report.summary.averageComplexity = Math.round((totalComplexity / fileMetrics.length) * 100) / 100;
  report.summary.averageMaintainabilityIndex = Math.round((totalMaintainability / fileMetrics.length) * 100) / 100;

  return report;
}

/**
 * Outputs the report in the specified format
 */
function outputReport(report) {
  const { output } = CONFIG;
  
  switch (output.format) {
    case 'json':
      fs.writeFileSync(output.file, JSON.stringify(report, null, 2));
      console.log(`📊 Complexity report saved to ${output.file}`);
      break;
      
    case 'html':
      const htmlReport = generateHtmlReport(report);
      const htmlFile = output.file.replace('.json', '.html');
      fs.writeFileSync(htmlFile, htmlReport);
      console.log(`📊 HTML report saved to ${htmlFile}`);
      break;
      
    case 'csv':
      const csvReport = generateCsvReport(report);
      const csvFile = output.file.replace('.json', '.csv');
      fs.writeFileSync(csvFile, csvReport);
      console.log(`📊 CSV report saved to ${csvFile}`);
      break;
  }
  
  // Always output summary to console
  printSummary(report);
}

/**
 * Prints summary to console
 */
function printSummary(report) {
  const { summary } = report;
  
  console.log('\n📊 Complexity Analysis Summary');
  console.log('================================');
  console.log(`Total Files: ${summary.totalFiles}`);
  console.log(`Total Lines of Code: ${summary.totalLinesOfCode}`);
  console.log(`Total Functions: ${summary.totalFunctions}`);
  console.log(`Average Complexity: ${summary.averageComplexity}`);
  console.log(`Average Maintainability Index: ${summary.averageMaintainabilityIndex}`);
  console.log(`Issues: ${summary.issueCount.error} errors, ${summary.issueCount.warning} warnings`);
  
  // Show top 5 most complex files
  const complexFiles = report.files
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 5);
    
  if (complexFiles.length > 0) {
    console.log('\n🔥 Most Complex Files:');
    complexFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path} (complexity: ${file.complexity})`);
    });
  }
  
  // Show files with low maintainability
  const lowMaintainability = report.files
    .filter(file => file.maintainabilityIndex < 65)
    .sort((a, b) => a.maintainabilityIndex - b.maintainabilityIndex)
    .slice(0, 5);
    
  if (lowMaintainability.length > 0) {
    console.log('\n⚠️  Files Needing Attention (Low Maintainability):');
    lowMaintainability.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path} (MI: ${file.maintainabilityIndex})`);
    });
  }
}

/**
 * Generates HTML report
 */
function generateHtmlReport(report) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Code Complexity Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .file { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
        .issues { margin-top: 10px; }
        .error { color: #d32f2f; }
        .warning { color: #f57c00; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Code Complexity Report</h1>
    <div class="summary">
        <h2>Summary</h2>
        <p>Total Files: ${report.summary.totalFiles}</p>
        <p>Total Lines of Code: ${report.summary.totalLinesOfCode}</p>
        <p>Average Complexity: ${report.summary.averageComplexity}</p>
        <p>Average Maintainability Index: ${report.summary.averageMaintainabilityIndex}</p>
    </div>
    
    ${report.files.map(file => `
        <div class="file">
            <h3>${file.path}</h3>
            <p>Lines of Code: ${file.linesOfCode}, Complexity: ${file.complexity}, MI: ${file.maintainabilityIndex}</p>
            ${file.issues.length > 0 ? `
                <div class="issues">
                    <h4>Issues:</h4>
                    ${file.issues.map(issue => `
                        <p class="${issue.severity}">${issue.message}</p>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `).join('')}
</body>
</html>`;
}

/**
 * Generates CSV report
 */
function generateCsvReport(report) {
  const header = 'File,Lines of Code,Complexity,Maintainability Index,Function Count,Issues\n';
  const rows = report.files.map(file => 
    `"${file.path}",${file.linesOfCode},${file.complexity},${file.maintainabilityIndex},${file.functionCount},${file.issues.length}`
  ).join('\n');
  
  return header + rows;
}

/**
 * Main execution function
 */
function main() {
  console.log('🔍 Analyzing code complexity...');
  
  const files = getFiles();
  console.log(`Found ${files.length} files to analyze`);
  
  const fileMetrics = files.map(file => {
    console.log(`Analyzing: ${file}`);
    return analyzeFile(file);
  });
  
  const report = generateReport(fileMetrics);
  outputReport(report);
}

// Run the analysis
if (require.main === module) {
  main();
}

module.exports = {
  analyzeFile,
  generateReport,
  CONFIG,
};