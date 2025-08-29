/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
module.exports = {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'json', 'dashboard'],
  testRunner: 'jest',
  coverageAnalysis: 'perTest',
  jest: {
    configFile: 'jest.config.js',
    enableFindRelatedTests: true,
  },
  mutate: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/tests/**/*',
    '!src/app/**/layout.tsx',
    '!src/app/**/page.tsx',
    '!src/app/**/loading.tsx',
    '!src/app/**/error.tsx',
    '!src/app/**/not-found.tsx',
  ],
  mutator: {
    name: 'typescript',
    excludedMutations: ['BooleanSubstitution', 'StringLiteral'],
  },
  thresholds: {
    high: 90,
    low: 80,
    break: 70,
  },
  timeoutMS: 60000,
  timeoutFactor: 2,
  maxConcurrentTestRunners: 4,
  htmlReporter: {
    fileName: 'reports/mutation/html/index.html',
  },
  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },
  dashboard: {
    project: 'github.com/patrickkavanagh/etf-research-platform',
    version: 'main',
    module: 'frontend',
    reportType: 'full',
  },
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  logLevel: 'info',
  fileLogLevel: 'trace',
  allowConsoleColors: true,
}