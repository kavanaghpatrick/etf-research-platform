# ETF Research Platform - Developer Onboarding Guide

Welcome to the ETF Research Platform development team! This comprehensive guide will help you get up and running quickly while understanding our development practices, code quality standards, and architectural decisions.

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Development Environment](#development-environment)
3. [Code Quality Standards](#code-quality-standards)
4. [Architecture Overview](#architecture-overview)
5. [Development Workflow](#development-workflow)
6. [Testing Strategy](#testing-strategy)
7. [Component Guidelines](#component-guidelines)
8. [Performance Best Practices](#performance-best-practices)
9. [Security Guidelines](#security-guidelines)
10. [Deployment Process](#deployment-process)
11. [Resources & References](#resources--references)

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Git**
- **VS Code** (recommended) with our extension pack

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/etf-research-platform.git
   cd etf-research-platform/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Verify your setup**
   - Open http://localhost:3000 in your browser
   - Run tests: `npm test`
   - Check linting: `npm run lint`

### VS Code Setup

Install the recommended extensions:
- ESLint
- Prettier
- TypeScript Importer
- Tailwind CSS IntelliSense
- Auto Rename Tag
- GitLens
- Thunder Client (for API testing)

Copy our workspace settings:
```bash
cp .vscode/settings.example.json .vscode/settings.json
```

## 🛠 Development Environment

### Project Structure

```
src/
├── app/                 # Next.js 13+ app directory
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── stock/          # Stock-related pages
├── components/         # Reusable components
│   ├── stock-detail/   # Stock detail components
│   ├── errors/         # Error boundary components
│   └── ui/             # Basic UI components
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── workers/            # Web Workers
└── tests/              # Test utilities and E2E tests
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues |
| `npm run type-check` | Run TypeScript compiler |
| `npm test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:e2e` | Run E2E tests |
| `npm run storybook` | Start Storybook |
| `npm run analyze` | Analyze bundle size |

### Development Tools

- **Code Quality**: ESLint, Prettier, TypeScript strict mode
- **Testing**: Jest, React Testing Library, Playwright
- **Documentation**: Storybook, TypeDoc
- **Performance**: Bundle analyzer, Lighthouse CI
- **Security**: npm audit, Snyk, automated security scanning

## 📏 Code Quality Standards

### ESLint Configuration

We use strict ESLint rules to maintain code quality:

```javascript
// Key rules enforced:
- no-console: "warn"
- @typescript-eslint/no-unused-vars: "error"
- @typescript-eslint/no-explicit-any: "error"
- react-hooks/exhaustive-deps: "warn"
- complexity: ["warn", { "max": 15 }]
```

### TypeScript Standards

- **Strict mode enabled**: All TypeScript strict flags are on
- **No `any` types**: Use proper type definitions
- **Explicit return types**: For complex functions
- **Readonly interfaces**: Use `readonly` for immutable data

### Code Style

- **Prettier formatting**: Automated code formatting
- **Functional components**: Use React function components
- **Hooks**: Prefer hooks over class components
- **Immutability**: Use readonly types and immutable patterns

### Performance Standards

- **Bundle size**: Maximum 500KB for main bundle
- **Lighthouse scores**: Minimum 90 for Performance, Accessibility, SEO
- **Core Web Vitals**: LCP < 2.5s, FID < 100ms, CLS < 0.1

## 🏗 Architecture Overview

### Frontend Architecture

```
┌─────────────────────────────────────────┐
│                 UI Layer                │
│  (React Components, Pages, Layouts)    │
├─────────────────────────────────────────┤
│              Business Logic             │
│     (Custom Hooks, Context, Utils)     │
├─────────────────────────────────────────┤
│               Data Layer                │
│    (API Calls, State Management)       │
├─────────────────────────────────────────┤
│             Infrastructure              │
│  (Error Handling, Performance, PWA)    │
└─────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Separation of Concerns**: Components focus on UI, hooks handle logic
2. **Error Boundaries**: Hierarchical error handling
3. **Performance First**: Lazy loading, memoization, efficient rendering
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Progressive Enhancement**: Works without JavaScript

### State Management

- **React State**: For component-local state
- **Context API**: For shared application state
- **URL State**: For shareable and bookmarkable state
- **Local Storage**: For user preferences

## 🔄 Development Workflow

### Git Workflow

We use **Git Flow** with the following branches:

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: New features
- `hotfix/*`: Critical bug fixes
- `release/*`: Release preparation

### Branch Naming Convention

```
feature/TICKET-123-add-stock-comparison
bugfix/TICKET-456-fix-chart-rendering
hotfix/TICKET-789-critical-security-fix
```

### Commit Messages

Follow **Conventional Commits**:

```
feat(stock-chart): add dividend overlay functionality
fix(api): handle timeout errors gracefully
docs(readme): update installation instructions
test(hooks): add tests for useStockData hook
```

### Pull Request Process

1. **Create feature branch** from `develop`
2. **Implement changes** following our standards
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run quality checks** locally
6. **Create PR** with descriptive title and description
7. **Address review feedback**
8. **Merge after approval** and CI/CD success

### Pre-commit Hooks

Our pre-commit hooks automatically run:
- TypeScript type checking
- ESLint with auto-fix
- Prettier formatting
- Related tests
- Security checks
- Complexity analysis

## 🧪 Testing Strategy

### Testing Pyramid

```
    E2E Tests (Playwright)
         /\
        /  \
       /    \
      /      \
     /________\
  Integration Tests
         /\
        /  \
       /    \
      /      \
     /________\
    Unit Tests (Jest + RTL)
```

### Test Types

1. **Unit Tests**: Individual functions and components
2. **Integration Tests**: Component interactions
3. **E2E Tests**: Full user workflows
4. **Accessibility Tests**: WCAG compliance
5. **Performance Tests**: Core Web Vitals
6. **Visual Regression Tests**: Screenshot comparisons

### Testing Best Practices

- **Test user behavior**, not implementation details
- **Use proper semantics** in test queries
- **Mock external dependencies** appropriately
- **Keep tests simple** and focused
- **Use descriptive test names**

### Test Coverage

Maintain minimum coverage thresholds:
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

## 🎨 Component Guidelines

### Component Structure

```typescript
/**
 * @fileoverview Component description
 * @description Detailed component purpose
 * @author Developer Name
 * @version 1.0.0
 */

'use client';

import { memo } from 'react';

interface ComponentProps {
  /** Prop description */
  readonly prop1: string;
  /** Optional prop description */
  readonly prop2?: number;
}

/**
 * Component documentation
 * 
 * @param props - Component props
 * @returns JSX element
 * 
 * @example
 * ```tsx
 * <Component prop1="value" prop2={42} />
 * ```
 */
export const Component = memo<ComponentProps>(function Component({
  prop1,
  prop2 = 0,
}) {
  return (
    <div data-testid="component">
      {/* Component content */}
    </div>
  );
});

Component.displayName = 'Component';
```

### Component Best Practices

1. **Use TypeScript**: Proper type definitions
2. **Memo for performance**: Wrap in `memo` when appropriate
3. **Props interface**: Use readonly properties
4. **Default props**: Provide sensible defaults
5. **Error boundaries**: Wrap components appropriately
6. **Accessibility**: ARIA labels, semantic HTML
7. **Testing**: Add test IDs for reliable testing

### Styling Guidelines

- **Tailwind CSS**: Use utility classes
- **Responsive design**: Mobile-first approach
- **Dark mode**: Support system preferences
- **CSS custom properties**: For dynamic values
- **Component variants**: Use consistent patterns

## ⚡ Performance Best Practices

### React Performance

1. **Use React.memo**: For expensive re-renders
2. **Optimize useCallback**: Prevent unnecessary recreations
3. **Lazy loading**: Code splitting with React.lazy
4. **Efficient state updates**: Minimize re-renders
5. **Web Workers**: For heavy computations

### Next.js Optimizations

1. **Image optimization**: Use next/image
2. **Font optimization**: Use next/font
3. **Bundle analysis**: Regular bundle size monitoring
4. **Caching strategies**: Implement proper cache headers
5. **Static generation**: Use SSG when possible

### Bundle Size Management

- **Tree shaking**: Import only what you need
- **Dynamic imports**: Load components on demand
- **Bundle analyzer**: Monitor bundle size regularly
- **Dependencies audit**: Regular dependency cleanup

## 🔒 Security Guidelines

### Frontend Security

1. **Input validation**: Sanitize all user inputs
2. **XSS prevention**: Use proper escaping
3. **CSRF protection**: Implement CSRF tokens
4. **Content Security Policy**: Configure CSP headers
5. **Dependency security**: Regular audit and updates

### Data Protection

1. **No secrets in frontend**: Never store API keys
2. **Secure communication**: Always use HTTPS
3. **Error handling**: Don't expose sensitive errors
4. **Authentication**: Implement proper auth flows
5. **Authorization**: Check permissions client-side

### Best Practices

- **Regular security audits**: npm audit, Snyk scans
- **Dependency updates**: Keep dependencies current
- **Code reviews**: Security-focused reviews
- **Security headers**: Implement security headers
- **Error boundaries**: Prevent error information leakage

## 🚀 Deployment Process

### Environments

1. **Development**: Local development
2. **Staging**: Testing environment
3. **Production**: Live application

### CI/CD Pipeline

```yaml
Trigger: Push to main/develop
  ↓
Install Dependencies
  ↓
Run Tests (Unit, Integration, E2E)
  ↓
Quality Checks (Lint, Type Check, Security)
  ↓
Build Application
  ↓
Deploy to Environment
  ↓
Post-deployment Tests
  ↓
Notification
```

### Deployment Checklist

- [ ] All tests passing
- [ ] Code review approved
- [ ] Security scan clean
- [ ] Performance tests passed
- [ ] Documentation updated
- [ ] Feature flags configured
- [ ] Monitoring alerts set up

## 📚 Resources & References

### Documentation

- [Component Library (Storybook)](http://localhost:6006)
- [API Documentation](./API_DOCUMENTATION.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Performance Guide](./PERFORMANCE_GUIDE.md)

### External Resources

- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Testing Library Docs](https://testing-library.com/docs/)

### Tools & Extensions

- [React Developer Tools](https://github.com/facebook/react/tree/main/packages/react-devtools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Team Communication

- **Slack**: #dev-frontend channel
- **Stand-ups**: Daily at 9:00 AM
- **Code reviews**: Within 24 hours
- **Tech debt discussions**: Weekly architecture meetings

---

## 🎯 Quick Start Checklist

- [ ] Development environment set up
- [ ] VS Code configured with extensions
- [ ] First successful build completed
- [ ] Tests running successfully
- [ ] Storybook accessible
- [ ] Read architecture documentation
- [ ] Understand Git workflow
- [ ] Join team communication channels
- [ ] Set up IDE debugging
- [ ] Review code quality standards

Welcome to the team! 🎉

For questions or help, reach out to:
- **Technical Lead**: @tech-lead
- **Frontend Team**: #dev-frontend
- **Documentation**: Create an issue on GitHub