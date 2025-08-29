# ETF Research Platform - Comprehensive Testing Guide

## Table of Contents
1. [Overview](#overview)
2. [Test Architecture](#test-architecture)
3. [Testing Stack](#testing-stack)
4. [Test Types](#test-types)
5. [Running Tests](#running-tests)
6. [Writing Tests](#writing-tests)
7. [Test Maintenance](#test-maintenance)
8. [CI/CD Integration](#cicd-integration)
9. [Troubleshooting](#troubleshooting)

## Overview

This guide provides comprehensive documentation for maintaining and extending the test suite for the ETF Research Platform frontend. Our testing strategy ensures 95%+ code coverage, production readiness, and high code quality across all features.

### Testing Philosophy
- **Test Pyramid**: Unit tests form the base, with integration tests in the middle, and E2E tests at the top
- **Shift Left**: Catch issues early in development
- **Test Quality**: Use mutation testing to verify test effectiveness
- **Accessibility First**: All components must pass WCAG 2.1 AA standards

## Test Architecture

```
src/
├── components/
│   └── __tests__/              # Component unit tests
├── hooks/
│   └── __tests__/              # Hook unit tests
├── utils/
│   └── __tests__/              # Utility unit tests
├── tests/
│   ├── test-utils/             # Shared test utilities
│   ├── integration/            # Integration tests
│   ├── e2e/                    # End-to-end tests
│   └── visual/                 # Visual regression tests
```

## Testing Stack

### Core Dependencies
- **Jest**: Unit and integration testing framework
- **React Testing Library**: Component testing utilities
- **Playwright**: E2E and visual regression testing
- **Stryker**: Mutation testing framework
- **jest-axe**: Accessibility testing
- **MSW**: API mocking for tests

### Configuration Files
- `jest.config.js`: Jest configuration
- `jest.setup.js`: Global test setup
- `playwright.config.ts`: E2E test configuration
- `playwright-visual.config.ts`: Visual regression configuration
- `stryker.config.js`: Mutation testing configuration

## Test Types

### 1. Unit Tests
Test individual components, hooks, and utilities in isolation.

**Coverage Requirements**: 95%+ for all files

**Example**:
```typescript
import { render, screen } from '@testing-library/react'
import { TimeRangeSelector } from '../TimeRangeSelector'

test('renders all time range options', () => {
  render(<TimeRangeSelector selectedRange="1M" onRangeChange={jest.fn()} />)
  expect(screen.getByText('1D')).toBeInTheDocument()
  expect(screen.getByText('1M')).toBeInTheDocument()
})
```

### 2. Integration Tests
Test component interactions and data flow between multiple components.

**Focus Areas**:
- Component communication
- State management
- API integration with mocked responses

**Example**:
```typescript
test('complete stock analysis workflow', async () => {
  const { rerender } = renderWithProviders(<StockDetailPage symbol="AAPL" />)
  // Test loading state
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  // Simulate data load
  mockUseStockData.mockReturnValue({ data: mockData, loading: false })
  rerender(<StockDetailPage symbol="AAPL" />)
  // Verify data display
  expect(screen.getByText('AAPL Price Chart')).toBeInTheDocument()
})
```

### 3. End-to-End Tests
Test complete user workflows from start to finish.

**Key Scenarios**:
- Stock search and analysis
- Time range selection
- Error handling and recovery
- Mobile workflows

**Example**:
```typescript
test('complete user journey', async ({ page }) => {
  await page.goto('/')
  await page.fill('[data-testid="ticker-search"]', 'AAPL')
  await page.press('[data-testid="ticker-search"]', 'Enter')
  await expect(page).toHaveURL(/\/stock\/AAPL/)
})
```

### 4. Visual Regression Tests
Ensure UI consistency across changes.

**Coverage**:
- All components in different states
- Responsive layouts
- Theme variations
- Accessibility states

**Example**:
```typescript
test('stock chart appearance', async ({ page }) => {
  await page.goto('/stock/AAPL')
  await expect(page.locator('[data-testid="stock-chart"]'))
    .toHaveScreenshot('stock-chart-default.png')
})
```

### 5. Accessibility Tests
Ensure WCAG 2.1 AA compliance.

**Automated Checks**:
- Color contrast
- ARIA labels and roles
- Keyboard navigation
- Screen reader compatibility

**Example**:
```typescript
test('meets WCAG standards', async ({ page }) => {
  await page.goto('/stock/AAPL')
  await injectAxe(page)
  await checkA11y(page)
})
```

### 6. Performance Tests
Monitor and validate performance metrics.

**Metrics**:
- Bundle size
- Load time
- Interaction responsiveness
- Memory usage

## Running Tests

### Unit Tests
```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test StockDetailPage.test.tsx
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration

# Debug integration tests
npm test -- --verbose
```

### E2E Tests
```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run specific test
npm run test:e2e -- stock-analysis-workflow.spec.ts

# Run in headed mode
npm run test:e2e -- --headed
```

### Visual Regression Tests
```bash
# Run visual tests
npm run test:visual

# Update snapshots
UPDATE_SNAPSHOTS=true npm run test:visual

# Run for specific browser
npm run test:visual -- --project="Desktop Chrome"
```

### Mutation Tests
```bash
# Run mutation testing
npm run test:mutation

# View mutation report
npm run test:mutation:report
```

### Accessibility Tests
```bash
# Run accessibility tests
npm run test:accessibility

# Run E2E accessibility tests
npm run test:e2e:accessibility
```

## Writing Tests

### Test Structure
```typescript
describe('ComponentName', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Feature/Behavior', () => {
    it('should do something specific', () => {
      // Arrange
      const props = { /* ... */ }
      
      // Act
      render(<Component {...props} />)
      
      // Assert
      expect(screen.getByText('Expected')).toBeInTheDocument()
    })
  })
})
```

### Best Practices

1. **Test Behavior, Not Implementation**
   ```typescript
   // ❌ Bad - Testing implementation
   expect(component.state.isOpen).toBe(true)
   
   // ✅ Good - Testing behavior
   expect(screen.getByRole('dialog')).toBeVisible()
   ```

2. **Use Testing Library Queries Correctly**
   ```typescript
   // Priority order:
   // 1. getByRole
   // 2. getByLabelText
   // 3. getByPlaceholderText
   // 4. getByText
   // 5. getByTestId (last resort)
   ```

3. **Mock External Dependencies**
   ```typescript
   jest.mock('@/hooks/useStockData')
   const mockUseStockData = useStockData as jest.MockedFunction<typeof useStockData>
   ```

4. **Test Edge Cases**
   ```typescript
   test.each([
     { input: '', expected: 'error' },
     { input: null, expected: 'error' },
     { input: 'AAPL', expected: 'success' },
   ])('handles $input correctly', ({ input, expected }) => {
     // Test implementation
   })
   ```

5. **Ensure Accessibility**
   ```typescript
   it('should be accessible', async () => {
     const { container } = render(<Component />)
     await checkAccessibility(container)
   })
   ```

### Testing Utilities

Our custom test utilities provide helpful functions:

```typescript
import {
  renderWithProviders,    // Render with necessary providers
  checkAccessibility,     // Run axe accessibility checks
  mockFetch,             // Mock fetch responses
  testDataFactories,     // Generate test data
  fireKeyboardEvent,     // Simulate keyboard events
  captureVisualSnapshot, // Take visual snapshots
} from '@/tests/test-utils'
```

## Test Maintenance

### Regular Tasks

1. **Weekly**
   - Review failing tests
   - Update snapshots if UI changed intentionally
   - Check test coverage reports

2. **Monthly**
   - Run mutation testing
   - Review and update test documentation
   - Audit test performance

3. **Quarterly**
   - Review test strategy
   - Update dependencies
   - Refactor slow tests

### Updating Tests

When making changes:
1. Run affected tests before committing
2. Update tests to match new behavior
3. Add tests for new features
4. Remove tests for deleted features

### Snapshot Updates

```bash
# Update specific snapshots
npm test -- -u StockChart.test.tsx

# Update all snapshots
npm test -- -u

# Update visual snapshots
UPDATE_SNAPSHOTS=true npm run test:visual
```

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Pull requests
- Pushes to main branch
- Nightly scheduled runs

### Test Requirements for Merge
- All tests must pass
- Code coverage must remain above 95%
- No accessibility violations
- Visual regression tests must pass

### Performance Budget
```javascript
// scripts/performance-budget.js
const BUDGETS = {
  'main.js': 250 * 1024,        // 250KB
  'vendor.js': 300 * 1024,      // 300KB
  firstLoad: 500 * 1024,        // 500KB total
  lighthouse: {
    performance: 90,
    accessibility: 100,
    bestPractices: 95,
    seo: 90,
  }
}
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   ```typescript
   // Increase timeout for specific test
   test('slow operation', async () => {
     // Test code
   }, 10000)
   ```

2. **Flaky tests**
   ```typescript
   // Use waitFor for async operations
   await waitFor(() => {
     expect(screen.getByText('Loaded')).toBeInTheDocument()
   })
   ```

3. **Mock not working**
   ```typescript
   // Ensure mock is before import
   jest.mock('@/hooks/useStockData')
   import { StockDetailPage } from '@/components/StockDetailPage'
   ```

4. **Visual test differences**
   ```bash
   # View diff report
   npx playwright show-report reports/visual
   ```

### Debug Mode

```bash
# Jest debug
node --inspect-brk node_modules/.bin/jest --runInBand

# Playwright debug
PWDEBUG=1 npm run test:e2e

# Verbose output
npm test -- --verbose
```

### Performance Profiling

```typescript
// Use React DevTools Profiler
import { Profiler } from 'react'

<Profiler id="StockChart" onRender={onRenderCallback}>
  <StockChart {...props} />
</Profiler>
```

## Test Coverage Goals

### Current Coverage Requirements
- Statements: 95%+
- Branches: 90%+
- Functions: 90%+
- Lines: 95%+

### Viewing Coverage Reports
```bash
# Generate HTML report
npm run test:coverage:report

# View in browser
open coverage/lcov-report/index.html
```

### Improving Coverage
1. Focus on untested branches
2. Add edge case tests
3. Test error scenarios
4. Cover all component states

## Continuous Improvement

### Metrics to Track
- Test execution time
- Flakiness rate
- Coverage trends
- Mutation score

### Regular Reviews
- Test effectiveness (via mutation testing)
- Test maintainability
- Test performance
- Documentation accuracy

---

## Quick Reference

### Essential Commands
```bash
npm test                    # Run unit tests
npm run test:coverage       # Run with coverage
npm run test:e2e           # Run E2E tests
npm run test:visual        # Run visual tests
npm run test:mutation      # Run mutation tests
npm run test:all           # Run all test suites
```

### Key Files
- `/src/tests/test-utils/index.tsx` - Shared test utilities
- `/jest.setup.js` - Global test setup
- `/.github/workflows/test.yml` - CI configuration

### Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Stryker Mutator](https://stryker-mutator.io/docs/)

---

Last Updated: 2025-07-13
Version: 1.0.0