/**
 * @fileoverview Storybook stories for StockHeader component
 * @description Demonstrates various states and configurations of the StockHeader component
 */

import type { Meta, StoryObj } from '@storybook/react';
import { StockHeader } from './StockHeader';
import { SingleStockResponse } from '@/types/stock';

const meta: Meta<typeof StockHeader> = {
  title: 'Components/Stock Detail/StockHeader',
  component: StockHeader,
  parameters: {
    layout: 'fullwidth',
    docs: {
      description: {
        component: `
The StockHeader component displays essential stock information including symbol, price, 
and key financial metrics. It provides a clean, professional layout with proper 
accessibility features and responsive design.

## Features
- **Price Display**: Current price with change indicators
- **Visual Indicators**: Color-coded price changes with icons
- **Key Metrics**: Market cap, P/E ratio, dividend yield, and 52-week range
- **Responsive Design**: Adapts to different screen sizes
- **Accessibility**: Proper ARIA labels and semantic markup
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    stockData: {
      description: 'Stock data object containing all necessary information',
      control: false,
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for stories
const baseMockData: SingleStockResponse = {
  symbol: 'AAPL',
  company_name: 'Apple Inc.',
  current_price: 175.43,
  price_change: 2.34,
  price_change_percent: 1.35,
  market_cap: 2800000000000,
  pe_ratio: 28.5,
  dividend_yield: 0.52,
  fifty_two_week_high: 198.23,
  fifty_two_week_low: 164.08,
  data: [],
  date_range: {
    start: '2023-01-01',
    end: '2024-01-01',
  },
};

/**
 * Default state showing positive price movement
 */
export const Default: Story = {
  args: {
    stockData: baseMockData,
  },
};

/**
 * Stock with negative price movement
 */
export const NegativeChange: Story = {
  args: {
    stockData: {
      ...baseMockData,
      symbol: 'TSLA',
      company_name: 'Tesla, Inc.',
      current_price: 242.68,
      price_change: -5.12,
      price_change_percent: -2.07,
      market_cap: 770000000000,
      pe_ratio: 65.2,
      dividend_yield: 0,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how the component displays negative price changes with red coloring and down arrow.',
      },
    },
  },
};

/**
 * Stock with minimal data (no company name, limited metrics)
 */
export const MinimalData: Story = {
  args: {
    stockData: {
      ...baseMockData,
      symbol: 'XYZ',
      company_name: undefined,
      market_cap: undefined,
      pe_ratio: undefined,
      dividend_yield: undefined,
      fifty_two_week_high: undefined,
      fifty_two_week_low: undefined,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates the component with minimal data, showing how it gracefully handles missing information.',
      },
    },
  },
};

/**
 * High-value stock with large market cap
 */
export const HighValueStock: Story = {
  args: {
    stockData: {
      ...baseMockData,
      symbol: 'BRK.A',
      company_name: 'Berkshire Hathaway Inc.',
      current_price: 542800.00,
      price_change: 1240.00,
      price_change_percent: 0.23,
      market_cap: 780000000000,
      pe_ratio: 8.9,
      dividend_yield: 0,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows how the component handles very high stock prices and large market capitalizations.',
      },
    },
  },
};

/**
 * Dividend-focused stock
 */
export const DividendStock: Story = {
  args: {
    stockData: {
      ...baseMockData,
      symbol: 'KO',
      company_name: 'The Coca-Cola Company',
      current_price: 59.87,
      price_change: 0.23,
      price_change_percent: 0.39,
      market_cap: 259000000000,
      pe_ratio: 25.4,
      dividend_yield: 3.12,
      fifty_two_week_high: 64.99,
      fifty_two_week_low: 51.55,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Example of a dividend-paying stock with higher yield percentage.',
      },
    },
  },
};

/**
 * Zero price change
 */
export const NoChange: Story = {
  args: {
    stockData: {
      ...baseMockData,
      price_change: 0,
      price_change_percent: 0,
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the component when there is no price change, demonstrating neutral state styling.',
      },
    },
  },
};

/**
 * Long company name test
 */
export const LongCompanyName: Story = {
  args: {
    stockData: {
      ...baseMockData,
      symbol: 'ABCDEFGH',
      company_name: 'A Very Long Company Name That Might Cause Layout Issues Inc.',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests how the component handles very long company names and symbols.',
      },
    },
  },
};

/**
 * Component in mobile viewport
 */
export const Mobile: Story = {
  args: {
    stockData: baseMockData,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile',
    },
    docs: {
      description: {
        story: 'Shows how the component adapts to mobile screen sizes.',
      },
    },
  },
};

/**
 * Component in tablet viewport
 */
export const Tablet: Story = {
  args: {
    stockData: baseMockData,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Shows the component layout on tablet-sized screens.',
      },
    },
  },
};

/**
 * Interactive example for testing
 */
export const Interactive: Story = {
  args: {
    stockData: baseMockData,
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive version where you can modify all the stock data properties.',
      },
    },
  },
  argTypes: {
    stockData: {
      control: {
        type: 'object',
      },
    },
  },
};