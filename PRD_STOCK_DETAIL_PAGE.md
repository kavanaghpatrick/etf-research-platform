# Product Requirements Document: Stock/ETF Detail Page with Nivo Charting

## Executive Summary

This PRD outlines the implementation of interactive stock/ETF detail pages with professional charting capabilities using Nivo.js, building on our existing ETF Research Platform infrastructure.

## 1. Feature Overview

### Purpose
Create dedicated detail pages for individual stocks/ETFs that users can access by clicking any ticker symbol throughout the platform, providing comprehensive analysis with interactive charts.

### User Stories
- **As an investor**, I want to click any ticker symbol to see detailed information and charts
- **As a portfolio analyst**, I want to view price history with different time ranges
- **As a dividend investor**, I want to see dividend overlays on price charts
- **As a mobile user**, I want responsive charts that work on all devices

### Success Criteria
- ✅ All ticker symbols site-wide become clickable links
- ✅ Detail pages load in <2 seconds with initial chart data
- ✅ Charts are responsive and interactive on mobile/desktop
- ✅ Dividend data integrates seamlessly with existing functionality
- ✅ SEO-friendly URLs for individual stocks

## 2. Technical Requirements

### Frontend Stack Extension
- **Add Nivo Charts**: @nivo/line, @nivo/core, @nivo/axes, @nivo/tooltip
- **Next.js App Router**: Dynamic routes `/stock/[symbol]`
- **Existing Stack**: React 19, Next.js 15.3.5, TailwindCSS v4

### Backend Integration
- **Leverage Existing APIs**: Extend `/data/fetch` endpoint
- **Pandas Processing**: Use existing data manipulation capabilities
- **Dividend Integration**: Connect to working dividend analysis

### Data Flow Architecture
```
User clicks ticker → /stock/[SYMBOL] → SSR with initial data → 
Client-side chart interactions → CSR for time range changes
```

### Performance Requirements
- **Initial Load**: <2s for basic page + 1Y chart data
- **Chart Updates**: <500ms for time range changes
- **Mobile Performance**: 60fps chart interactions on iOS/Android

## 3. UI/UX Specifications

### Page Layout Structure
```
┌─────────────────────────────────────────────────┐
│ Header: AAPL • Apple Inc. • $150.25 (+2.5%)    │
├─────────────────────────────────────────────────┤
│ Time Range: 1D 5D 1M 3M 6M 1Y 5Y MAX [Custom] │
├─────────────────────────────────────────────────┤
│                                                 │
│           Interactive Chart (70vh)              │
│                                                 │
├─────────────────────────────────────────────────┤
│ Tabs: Overview | Dividends | Analytics | Data  │
└─────────────────────────────────────────────────┘
```

### Design System Consistency
- **Colors**: Use existing TailwindCSS color palette
- **Typography**: Match ResultsDashboard font weights
- **Cards**: Consistent with existing rounded-xl shadow-lg pattern
- **Buttons**: Same blue-600 hover:blue-700 pattern

### Mobile Responsive Behavior
- **<768px**: Stack chart above tabs, compress time range selector
- **768px-1024px**: Side-by-side layout with adjusted chart height
- **>1024px**: Full desktop layout with sidebar metrics

## 4. Component Architecture

### Core Components

#### 1. StockDetailPage (Main Layout)
```typescript
interface StockDetailPageProps {
  symbol: string;
  initialData: StockDetailData;
}
```

#### 2. StockChart (Nivo Integration)
```typescript
interface StockChartProps {
  data: ChartDataPoint[];
  timeRange: TimeRange;
  chartType: 'line' | 'area';
  showDividends: boolean;
}
```

#### 3. TimeRangeSelector
```typescript
interface TimeRangeSelectorProps {
  currentRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
  isLoading: boolean;
}
```

#### 4. TickerLink (Global Component)
```typescript
interface TickerLinkProps {
  symbol: string;
  children?: ReactNode;
  className?: string;
}
```

#### 5. KeyMetrics (Sidebar)
```typescript
interface KeyMetricsProps {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  dividendYield?: number;
}
```

## 5. Parallelizable Task Breakdown

### Task A: Routing & Page Structure (Agent A)
**Deliverables:**
- Create `app/stock/[symbol]/page.tsx` with SSR
- Implement `app/stock/[symbol]/loading.tsx`
- Basic page layout with header and tab structure
- SEO meta tags and Open Graph integration

**Dependencies:** None
**Estimated Time:** 4-6 hours

### Task B: Nivo Chart Implementation (Agent B)
**Deliverables:**
- Install and configure Nivo packages
- Create `StockChart.tsx` component with ResponsiveLine
- Implement chart theming to match TailwindCSS
- Add basic interactions (tooltips, hover effects)

**Dependencies:** Task A (for integration testing)
**Estimated Time:** 6-8 hours

### Task C: Time Range Selector & Data Fetching (Agent C)
**Deliverables:**
- Create `TimeRangeSelector.tsx` component
- Implement data fetching hooks for different time ranges
- Add loading states and error handling
- Integrate with existing `/data/fetch` API

**Dependencies:** Task B (for chart data interface)
**Estimated Time:** 5-7 hours

### Task D: Dividend Chart Integration (Agent D)
**Deliverables:**
- Extend chart to show dividend markers
- Add dividend overlay toggle
- Integrate with existing dividend data endpoints
- Create dividend-specific chart interactions

**Dependencies:** Task B, Task C
**Estimated Time:** 4-6 hours

### Task E: Clickable Tickers & Mobile Polish (Agent E)
**Deliverables:**
- Create `TickerLink.tsx` global component
- Update all existing components to use TickerLink
- Implement responsive design for all screen sizes
- Add keyboard navigation and accessibility

**Dependencies:** Task A (for routing)
**Estimated Time:** 6-8 hours

## 6. API Specifications

### New Backend Endpoints

#### GET /api/stock/{symbol}
```typescript
interface StockDetailResponse {
  symbol: string;
  company_name: string;
  current_price: number;
  price_change: number;
  price_change_percent: number;
  volume: number;
  market_cap?: number;
  pe_ratio?: number;
  dividend_yield?: number;
  last_updated: string;
}
```

#### GET /api/stock/{symbol}/chart
```typescript
interface ChartDataRequest {
  symbol: string;
  range: '1d' | '5d' | '1m' | '3m' | '6m' | '1y' | '5y' | 'max';
  interval?: '1m' | '5m' | '1h' | '1d';
}

interface ChartDataResponse {
  symbol: string;
  data: ChartDataPoint[];
  range: string;
  interval: string;
}

interface ChartDataPoint {
  date: string; // ISO format
  price: number;
  volume?: number;
}
```

### Extended Existing Endpoints

#### POST /data/fetch (Enhanced)
Add optional parameters:
```typescript
interface DataFetchRequest {
  // ... existing fields
  include_company_info?: boolean;
  include_key_metrics?: boolean;
  chart_optimized?: boolean; // Returns data in Nivo format
}
```

## 7. Data Structures

### Chart Data Format (Nivo-Compatible)
```typescript
interface NivoChartData {
  id: string; // ticker symbol
  data: {
    x: string; // date
    y: number; // price
  }[];
}

interface DividendMarker {
  date: string;
  amount: number;
  type: 'regular' | 'special';
}
```

### State Management
```typescript
interface StockDetailState {
  symbol: string;
  timeRange: TimeRange;
  chartType: 'line' | 'area';
  showVolume: boolean;
  showDividends: boolean;
  isLoading: boolean;
  error: string | null;
}
```

## 8. Testing Strategy

### Component Testing
- **Chart Rendering**: Test Nivo chart with various data sizes
- **Responsive Design**: Test on multiple viewport sizes
- **Interactions**: Test time range changes and chart updates

### Integration Testing
- **API Integration**: Test data fetching for all time ranges
- **Dividend Integration**: Test dividend overlay functionality
- **Navigation**: Test ticker links from all existing pages

### Performance Testing
- **Load Times**: Measure SSR and CSR performance
- **Memory Usage**: Test with large datasets (5Y+ data)
- **Mobile Performance**: Test on actual iOS/Android devices

### Accessibility Testing
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: Test with NVDA/VoiceOver
- **Color Contrast**: Ensure WCAG AA compliance

## 9. Technical Implementation Details

### Nivo Configuration
```typescript
const chartTheme = {
  background: 'transparent',
  textColor: '#374151', // gray-700
  fontSize: 12,
  axis: {
    domain: {
      line: {
        stroke: '#E5E7EB', // gray-200
        strokeWidth: 1
      }
    },
    ticks: {
      line: {
        stroke: '#E5E7EB',
        strokeWidth: 1
      }
    }
  },
  grid: {
    line: {
      stroke: '#F3F4F6', // gray-100
      strokeWidth: 1
    }
  }
};
```

### SSR Data Fetching
```typescript
// app/stock/[symbol]/page.tsx
export async function generateMetadata({ params }: StockDetailPageProps) {
  const stockData = await fetchStockData(params.symbol);
  return {
    title: `${stockData.symbol} - ${stockData.company_name} Stock Analysis`,
    description: `View ${stockData.company_name} (${stockData.symbol}) stock price, charts, dividends, and analysis.`
  };
}

export default async function StockDetailPage({ params }: StockDetailPageProps) {
  const [stockData, chartData] = await Promise.all([
    fetchStockData(params.symbol),
    fetchChartData(params.symbol, '1y')
  ]);
  
  return <StockDetailClient initialData={{ stockData, chartData }} />;
}
```

### Error Handling Strategy
- **Invalid Symbols**: Redirect to 404 with suggested tickers
- **API Failures**: Show fallback UI with retry options
- **Chart Errors**: Graceful degradation to table view
- **Network Issues**: Offline-friendly error messages

## 10. Deployment Considerations

### Bundle Size Impact
- **Nivo Charts**: ~200KB additional bundle size
- **Code Splitting**: Lazy load chart components
- **Tree Shaking**: Import only required Nivo modules

### SEO Optimization
- **Static Generation**: Pre-render popular stocks
- **Dynamic Routes**: ISR for less common symbols
- **Structured Data**: Add JSON-LD for stock information
- **Meta Tags**: Dynamic Open Graph tags with current prices

### Performance Monitoring
- **Core Web Vitals**: Monitor LCP, FID, CLS for chart pages
- **Chart Render Time**: Track chart initialization performance
- **API Response Times**: Monitor chart data fetch latency

## 11. Success Metrics

### User Engagement
- **Click-through Rate**: Ticker link clicks from main dashboard
- **Session Duration**: Time spent on detail pages
- **Chart Interactions**: Time range selector usage
- **Mobile Usage**: Detail page usage on mobile devices

### Technical Performance
- **Page Load Speed**: <2s for initial load
- **Chart Render Time**: <500ms for chart updates
- **Error Rate**: <1% for chart loading failures
- **Mobile Performance Score**: >90 Lighthouse score

### Business Impact
- **User Retention**: Increased return visits
- **Feature Adoption**: Dividend analysis usage
- **Platform Stickiness**: Multi-page session rates

## 12. Future Enhancements

### Phase 2 Features
- **Comparison Charts**: Multiple tickers on one chart
- **Technical Indicators**: Moving averages, RSI, MACD
- **Export Functionality**: Save charts as images/PDFs
- **Real-time Updates**: WebSocket price updates

### Phase 3 Features
- **Alerts**: Price and dividend alerts
- **Annotations**: User notes on charts
- **Social Features**: Share charts and insights
- **Advanced Analytics**: Correlation analysis integration

This PRD provides a comprehensive roadmap for implementing professional stock detail pages that build on our existing infrastructure while adding significant value through interactive charting capabilities.