import { defineConfig, devices } from '@playwright/test'
import baseConfig from './playwright.config'

/**
 * Visual regression testing configuration
 * @see https://playwright.dev/docs/test-snapshots
 */
export default defineConfig({
  ...baseConfig,
  
  // Visual tests specific directory
  testDir: './src/tests/visual',
  
  // Visual regression specific settings
  use: {
    ...baseConfig.use,
    
    // Capture full page screenshots
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },
    
    // Visual comparison options
    ignoreHTTPSErrors: true,
    
    // Consistent viewport for visual tests
    viewport: { width: 1280, height: 720 },
  },

  // Configure snapshot options
  snapshotDir: './src/tests/visual/__screenshots__',
  snapshotPathTemplate: '{snapshotDir}/{testFileDir}/{testFileName}-{arg}-{projectName}-{platform}{ext}',
  
  // Update snapshots with --update-snapshots flag
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',

  // Visual regression specific projects
  projects: [
    {
      name: 'Desktop Chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Disable animations for consistent screenshots
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
      },
    },
    {
      name: 'Desktop Chrome Dark',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
      },
    },
    {
      name: 'Desktop Chrome High Contrast',
      use: { 
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        forcedColors: 'active',
        launchOptions: {
          args: ['--force-prefers-reduced-motion', '--force-colors=active'],
        },
      },
    },
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
      },
    },
    {
      name: 'Tablet Safari',
      use: { 
        ...devices['iPad Pro'],
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
      },
    },
  ],

  // Reporter configuration for visual tests
  reporter: [
    ['html', { outputFolder: 'reports/visual', open: 'never' }],
    ['json', { outputFile: 'reports/visual/results.json' }],
  ],
})