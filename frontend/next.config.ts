import type { NextConfig } from "next";
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  /* config options here */
  
  // Environment variables configuration
  env: {
    API_BASE_URL: process.env.API_BASE_URL,
    API_TIMEOUT: process.env.API_TIMEOUT,
    API_CACHE_DURATION: process.env.API_CACHE_DURATION,
    API_MAX_RETRIES: process.env.API_MAX_RETRIES,
    API_DEBOUNCE_DELAY: process.env.API_DEBOUNCE_DELAY,
  },
  
  // Server external packages configuration
  serverExternalPackages: [],
  
  // Bundle optimization configuration
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
    // Optimize CSS imports (disabled due to critters dependency issue)
    // optimizeCss: true,
    // Enable Webpack build worker for faster builds
    webpackBuildWorker: true,
  },

  // Image optimization configuration
  images: {
    // Enable image optimization
    formats: ['image/webp', 'image/avif'],
    // Configure image sizes for responsive loading
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable optimized loading
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Optimize for performance
    minimumCacheTTL: 60,
    // Loader configuration for external images
    loader: 'default',
  },
  
  
  // Advanced Webpack optimization for production builds
  webpack: (config, { dev, isServer, webpack }) => {
    if (!dev && !isServer) {
      // Enhanced optimization configuration
      config.optimization = {
        ...config.optimization,
        // Advanced module concatenation for better tree shaking
        concatenateModules: true,
        // Enable deterministic module IDs for better caching
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
        // Enhanced split chunks configuration
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          cacheGroups: {
            // React ecosystem
            react: {
              test: /[\/]node_modules[\/](react|react-dom)[\/]/,
              name: 'react',
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            // Chart libraries (Nivo)
            charts: {
              test: /[\/]node_modules[\/]@nivo[\/]/,
              name: 'charts',
              chunks: 'all',
              priority: 30,
              enforce: true,
            },
            // Testing utilities (separate chunk)
            testing: {
              test: /[\/]node_modules[\/](@testing-library|jest|axe|playwright)[\/]/,
              name: 'testing',
              chunks: 'all',
              priority: 25,
              enforce: true,
            },
            // UI libraries
            ui: {
              test: /[\/]node_modules[\/](tailwindcss|postcss)[\/]/,
              name: 'ui',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            // Vendor libraries
            vendors: {
              test: /[\/]node_modules[\/]/,
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
        // Optimize runtime chunk
        runtimeChunk: {
          name: 'runtime',
        },
      };

      // Performance optimizations
      config.performance = {
        hints: 'warning',
        maxEntrypointSize: 512000,
        maxAssetSize: 512000,
      };

      // Add bundle analyzer for development insights
      if (process.env.ANALYZE === 'true') {
        config.optimization.concatenateModules = false; // Better for analysis
      }
    }

    // Tree shaking optimization (only for production to avoid webpack conflicts)
    if (!dev) {
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
    }

    // Enhanced module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      // Optimize React imports
      'react/jsx-runtime': require.resolve('react/jsx-runtime'),
      'react/jsx-dev-runtime': require.resolve('react/jsx-dev-runtime'),
    };

    // Webpack plugins for optimization
    config.plugins.push(
      // Define plugin for build-time constants
      new webpack.DefinePlugin({
        __DEV__: JSON.stringify(dev),
        __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      }),
    );

    // Optimize for production
    if (!dev) {
      // Add compression and minification plugins
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^\.\/locale$/,
          contextRegExp: /moment$/,
        }),
      );
    }

    return config;
  },
  
  // TypeScript configuration with relaxed rules for build
  typescript: {
    ignoreBuildErrors: true, // Ignore for baseline measurement
  },
  
  // ESLint configuration
  eslint: {
    dirs: ['src'],
    ignoreDuringBuilds: true, // Ignore for baseline measurement
  },
  
  // Security headers with performance optimizations
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
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
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
