/**
 * Optimized Import Utilities
 * Provides tree-shakeable imports and selective loading for third-party libraries
 */

// Optimized Nivo Chart Imports
// Import only the required components to reduce bundle size
export const loadLineChart = () => import('@nivo/line').then(m => ({
  ResponsiveLine: m.ResponsiveLine,
  LineDefaultProps: m.LineDefaultProps,
}));

export const loadAxes = () => import('@nivo/axes').then(m => ({
  Axes: m.Axes,
  Axis: m.Axis,
}));

export const loadTooltip = () => import('@nivo/tooltip').then(m => ({
  BasicTooltip: m.BasicTooltip,
  Chip: m.Chip,
  TableTooltip: m.TableTooltip,
}));

export const loadCore = () => import('@nivo/core').then(m => ({
  Container: m.Container,
  SvgWrapper: m.SvgWrapper,
  CartesianMarkers: m.CartesianMarkers,
}));

// Optimized React Utilities
export const loadReactMemo = () => import('react').then(m => ({
  memo: m.memo,
  useMemo: m.useMemo,
  useCallback: m.useCallback,
  lazy: m.lazy,
  Suspense: m.Suspense,
}));

// Progressive Chart Loading Strategy
export interface ChartLoadingStrategy {
  essential: () => Promise<any>;
  enhanced: () => Promise<any>;
  advanced: () => Promise<any>;
}

export const chartLoadingStrategy: ChartLoadingStrategy = {
  // Essential: Load only basic line chart functionality
  essential: async () => {
    const [lineChart] = await Promise.all([
      loadLineChart(),
    ]);
    return { lineChart };
  },

  // Enhanced: Add tooltip and axis functionality
  enhanced: async () => {
    const [lineChart, axes, tooltip] = await Promise.all([
      loadLineChart(),
      loadAxes(),
      loadTooltip(),
    ]);
    return { lineChart, axes, tooltip };
  },

  // Advanced: Full chart functionality with core utilities
  advanced: async () => {
    const [lineChart, axes, tooltip, core] = await Promise.all([
      loadLineChart(),
      loadAxes(),
      loadTooltip(),
      loadCore(),
    ]);
    return { lineChart, axes, tooltip, core };
  },
};

// Dynamic Feature Loading
export interface FeatureLoader {
  accessibility: () => Promise<any>;
  performance: () => Promise<any>;
  testing: () => Promise<any>;
}

export const featureLoader: FeatureLoader = {
  // Load accessibility features on demand
  accessibility: async () => {
    const [axeCore, ariaAttributes] = await Promise.all([
      import('@axe-core/react').catch(() => null),
      import('../hooks/useAriaLiveRegions').catch(() => null),
    ]);
    return { axeCore, ariaAttributes };
  },

  // Load performance monitoring on demand
  performance: async () => {
    const [profiler, memoryManager] = await Promise.all([
      import('../components/PerformanceProfiler').catch(() => null),
      import('../utils/memoryManager').catch(() => null),
    ]);
    return { profiler, memoryManager };
  },

  // Load testing utilities on demand (development only)
  testing: async () => {
    if (process.env.NODE_ENV === 'production') {
      return null;
    }
    
    const [testingLibrary, jest] = await Promise.all([
      import('@testing-library/react').catch(() => null),
      import('jest-axe').catch(() => null),
    ]);
    return { testingLibrary, jest };
  },
};

// Bundle Splitting Utilities
export class BundleSplitter {
  private static loadedModules = new Map<string, Promise<any>>();

  /**
   * Load module with caching to prevent duplicate loads
   */
  static async loadModule<T>(
    moduleId: string,
    loader: () => Promise<T>
  ): Promise<T> {
    if (!this.loadedModules.has(moduleId)) {
      this.loadedModules.set(moduleId, loader());
    }
    return this.loadedModules.get(moduleId)!;
  }

  /**
   * Preload critical modules for better performance
   */
  static preloadCritical() {
    // Preload essential chart components
    this.loadModule('line-chart', loadLineChart);
    
    // Preload React utilities
    this.loadModule('react-utils', loadReactMemo);
  }

  /**
   * Clean up loaded modules (for memory management)
   */
  static cleanup() {
    this.loadedModules.clear();
  }
}

// Tree Shaking Optimization
export const optimizeImports = {
  /**
   * Chart imports optimized for tree shaking
   */
  charts: {
    // Use specific imports instead of barrel imports
    line: () => import('@nivo/line/dist/nivo-line.es.js').catch(() => loadLineChart()),
    axes: () => import('@nivo/axes/dist/nivo-axes.es.js').catch(() => loadAxes()),
    tooltip: () => import('@nivo/tooltip/dist/nivo-tooltip.es.js').catch(() => loadTooltip()),
    core: () => import('@nivo/core/dist/nivo-core.es.js').catch(() => loadCore()),
  },

  /**
   * Utility imports with selective loading
   */
  utils: {
    react: () => import('react/index.js'),
    reactDom: () => import('react-dom/client'),
  },

  /**
   * Development-only imports
   */
  development: {
    testing: process.env.NODE_ENV !== 'production' 
      ? () => import('@testing-library/react')
      : () => Promise.resolve(null),
    axe: process.env.NODE_ENV !== 'production' 
      ? () => import('@axe-core/react')
      : () => Promise.resolve(null),
  },
};

// Export utilities for global use
export default {
  chartLoadingStrategy,
  featureLoader,
  BundleSplitter,
  optimizeImports,
};