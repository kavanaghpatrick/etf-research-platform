import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer';
import { withSentryConfig } from '@sentry/nextjs';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Content Security Policy configuration
const generateCSP = () => {
  const policy = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", "data:", "https:", "blob:"],
    'font-src': ["'self'", "data:"],
    'connect-src': ["'self'", process.env.API_BASE_URL, "https://sentry.io", "https://www.google-analytics.com"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'frame-src': ["'none'"],
    'worker-src': ["'self'", "blob:"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': []
  };

  return Object.entries(policy)
    .map(([key, value]) => `${key} ${value.join(' ')}`)
    .join('; ');
};

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), accelerometer=(), gyroscope=()'
  },
  {
    key: 'Content-Security-Policy',
    value: generateCSP()
  }
];

const nextConfig: NextConfig = {
  // Production optimizations
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  generateEtags: true,
  
  // Environment variables configuration
  env: {
    API_BASE_URL: process.env.API_BASE_URL,
    API_TIMEOUT: process.env.API_TIMEOUT,
    API_CACHE_DURATION: process.env.API_CACHE_DURATION,
    API_MAX_RETRIES: process.env.API_MAX_RETRIES,
    API_DEBOUNCE_DELAY: process.env.API_DEBOUNCE_DELAY,
  },
  
  // Production build optimization
  swcMinify: true,
  
  // Experimental features for production
  experimental: {
    // Optimize package imports for better tree shaking
    optimizePackageImports: [
      '@nivo/line', 
      '@nivo/core', 
      '@nivo/axes', 
      '@nivo/tooltip',
      'react',
      'react-dom'
    ],
    // Enable Webpack build worker for faster builds
    webpackBuildWorker: true,
    // Instrument for performance monitoring
    instrumentationHook: true,
  },

  // Image optimization configuration
  images: {
    domains: ['cdn.etf-research.com', 'images.etf-research.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
    loader: 'default',
  },
  
  // Advanced Webpack optimization for production builds
  webpack: (config, { dev, isServer, webpack }) => {
    // Production-only optimizations
    if (!dev) {
      // Strip console logs in production
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            compress: {
              ...minimizer.options.terserOptions?.compress,
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
            },
          };
        }
      });

      // Enhanced optimization configuration
      config.optimization = {
        ...config.optimization,
        concatenateModules: true,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // React ecosystem
            react: {
              test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
              name: 'react',
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            // Chart libraries (Nivo)
            charts: {
              test: /[\\/]node_modules[\\/]@nivo[\\/]/,
              name: 'charts',
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
            // UI libraries
            ui: {
              test: /[\\/]node_modules[\\/](tailwindcss|postcss)[\\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            // Vendor libraries
            vendors: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // Common application code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
              reuseExistingChunk: true,
              enforce: false,
            },
          },
        },
        runtimeChunk: {
          name: 'runtime',
        },
      };

      // Performance budgets
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
      };

      // Add plugins for production
      config.plugins.push(
        new webpack.DefinePlugin({
          __DEV__: JSON.stringify(false),
          __PROD__: JSON.stringify(true),
          __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
          __BUILD_VERSION__: JSON.stringify(process.env.BUILD_VERSION || 'unknown'),
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\/locale$/,
          contextRegExp: /moment$/,
        }),
      );
    }

    // Security: Disable source maps in production
    if (!dev && !isServer) {
      config.devtool = false;
    }

    return config;
  },
  
  // TypeScript configuration - strict for production
  typescript: {
    ignoreBuildErrors: false,
  },
  
  // ESLint configuration - strict for production
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: false,
  },
  
  // Security headers for all routes
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Static assets caching
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Image caching
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // API routes security
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  
  // Redirects for security
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://:path*',
        permanent: true,
      },
    ];
  },
  
  // Production output configuration
  output: 'standalone',
  
  // Disable x-powered-by header
  poweredByHeader: false,
};

// Sentry configuration for production error tracking
const sentryWebpackPluginOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
};

// Export configuration wrapped with Sentry if configured
if (process.env.SENTRY_AUTH_TOKEN) {
  module.exports = withBundleAnalyzer(
    withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  );
} else {
  module.exports = withBundleAnalyzer(nextConfig);
}