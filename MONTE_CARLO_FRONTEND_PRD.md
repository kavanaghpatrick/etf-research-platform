# Monte Carlo Portfolio Simulator - Frontend PRD

**Version:** 1.0  
**Date:** July 14, 2025  
**Product:** ETF Research Platform - Frontend Enhancement  
**Dependencies:** Monte Carlo Backend API (completed)

---

## A) Executive Summary

The Monte Carlo Portfolio Simulator frontend provides an intuitive interface for portfolio risk analysis and scenario planning. Users can construct custom portfolios, configure simulation parameters, and visualize comprehensive risk metrics through interactive charts and tables.

### Key User Benefits:
- **Visual Portfolio Construction**: Drag-and-drop or input-based portfolio allocation with real-time validation
- **Interactive Risk Analysis**: Dynamic charts showing percentile distributions of returns, drawdowns, and withdrawal rates
- **Professional Reporting**: Export-ready results with comprehensive metrics tables
- **Mobile-Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices

### Business Impact:
- Differentiates platform as professional-grade portfolio analysis tool
- Increases user engagement with interactive risk modeling
- Supports premium tier monetization through advanced analytics

---

## B) Navigation & Information Architecture

### Primary Navigation Bar
```
[ETF Research Platform Logo] | [Stocks] | [Monte Carlo] | [Settings] | [Help]
```

**Navigation Requirements:**
- Fixed top navigation bar with consistent styling
- Active state indicator for current page
- Responsive collapse on mobile (hamburger menu)
- Breadcrumb navigation for deep pages

### Page Structure
```
/stocks (existing)
/monte-carlo (new)
  ├── /monte-carlo/simulator
  ├── /monte-carlo/results/:simulationId
  └── /monte-carlo/history
```

---

## C) Monte Carlo Page Layout

### Header Section
- **Page Title**: "Monte Carlo Portfolio Simulator"
- **Subtitle**: "Analyze portfolio risk with thousands of market scenarios"
- **Action Button**: "New Simulation" (primary CTA)

### Main Content Areas

#### 1. Portfolio Configuration Panel (Left Sidebar - 30% width)
```
┌─────────────────────────────┐
│ Portfolio Allocation        │
├─────────────────────────────┤
│ [+ Add Ticker]              │
│                             │
│ SPY    [60%] [×]           │
│ BND    [40%] [×]           │
│                             │
│ Total: 100% ✓              │
├─────────────────────────────┤
│ Simulation Parameters       │
│                             │
│ Time Period: [30] years     │
│ Initial Balance: [$1M]      │
│ Simulations: [5000]         │
│ Historical Start: [2000]    │
├─────────────────────────────┤
│ [Run Simulation] 🚀        │
└─────────────────────────────┘
```

#### 2. Results Visualization (Main Area - 70% width)
```
┌─────────────────────────────────────────────────────┐
│ Simulation Results                                  │
├─────────────────────────────────────────────────────┤
│ 📊 Portfolio End Balance Distribution              │
│ [Interactive Chart: Percentile Fan Chart]          │
├─────────────────────────────────────────────────────┤
│ 📈 Key Metrics Summary                            │
│ [Metrics Cards Grid: Returns, Risk, Withdrawal]    │
├─────────────────────────────────────────────────────┤
│ 📋 Detailed Metrics Table                         │
│ [Expandable Table with All 12 Metrics]            │
└─────────────────────────────────────────────────────┘
```

---

## D) Component Specifications

### 1. Portfolio Allocation Component
**Features:**
- Autocomplete ticker search with validation
- Real-time percentage calculation and validation
- Visual percentage bars showing allocation
- Drag handles for reordering
- Remove buttons for each allocation
- Error states for invalid tickers or percentages

**Validation Rules:**
- Total allocation must equal 100%
- Individual allocations: 1% to 99%
- Maximum 10 tickers per portfolio
- Only supported tickers from `/api/tickers/available`

### 2. Simulation Parameters Component
**Time Period Slider:**
- Range: 5-50 years
- Default: 30 years
- Visual timeline with key milestones

**Initial Balance Input:**
- Currency formatted input ($1,000,000)
- Preset buttons: $100K, $500K, $1M, $5M
- Custom input validation

**Number of Simulations:**
- Slider: 1,000-10,000 simulations
- Default: 5,000
- Performance indicator (estimated runtime)

**Historical Start Date:**
- Dropdown: 1990, 1995, 2000, 2005, 2010, 2015
- Default: 2000
- Data availability indicator

### 3. Results Visualization Components

#### A. Portfolio End Balance Fan Chart
- **Chart Type**: Area chart with percentile bands
- **Y-Axis**: Portfolio value (logarithmic scale)
- **X-Axis**: Years (0 to simulation period)
- **Bands**: 10th-90th, 25th-75th, 50th percentile
- **Interactions**: Hover for exact values, zoom/pan
- **Colors**: Green (gains), red (losses), blue (median)

#### B. Metrics Summary Cards
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Expected Return │ │ Risk Level      │ │ Safe Withdrawal │
│ 8.5% (median)   │ │ 12.3% (vol)     │ │ 4.2% (rate)     │
│ 6.1%-11.2%      │ │ 11.1%-13.8%     │ │ 3.1%-5.8%       │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

#### C. Detailed Metrics Table
- **Columns**: Metric Name, 10th, 25th, 50th, 75th, 90th percentiles
- **Sorting**: By metric type (returns, risk, withdrawal)
- **Export**: CSV, PDF options
- **Tooltips**: Explanation for each metric

### 4. Loading & Error States

**Loading States:**
- Skeleton screens during simulation
- Progress bar with estimated completion time
- Cancel simulation option

**Error States:**
- Validation errors (inline, real-time)
- API errors (toast notifications)
- Network errors (retry mechanisms)

---

## E) User Experience Flow

### Primary User Journey
1. **Land on Monte Carlo page** → See overview and sample simulation
2. **Configure portfolio** → Add tickers with intuitive allocation
3. **Set parameters** → Use smart defaults with customization options
4. **Run simulation** → See progress and get results in <10 seconds
5. **Analyze results** → Interactive charts and comprehensive metrics
6. **Export/Share** → Download reports or save simulation

### Secondary Flows
- **Load saved simulation** → Quick access to previous analyses
- **Compare portfolios** → Side-by-side simulation comparison
- **Educational tooltips** → Learn about Monte Carlo methodology

---

## F) Technical Requirements

### Frontend Stack
- **Framework**: Next.js 15.3.5 with React 19
- **Styling**: Tailwind CSS with custom components
- **Charts**: @nivo/core for interactive visualizations
- **State Management**: React hooks + Context API
- **Validation**: Zod schema validation
- **API Integration**: Axios with proper error handling

### Performance Requirements
- **Initial Load**: <2 seconds
- **Simulation API Call**: <10 seconds for 5,000 simulations
- **Chart Rendering**: <1 second for data visualization
- **Mobile Performance**: Lighthouse score >90

### Responsive Design
- **Desktop**: Full layout with sidebar (1024px+)
- **Tablet**: Stacked layout with collapsible sidebar (768-1023px)
- **Mobile**: Single column with bottom sheet UI (320-767px)

---

## G) API Integration

### Required Endpoints
1. `GET /api/tickers/available` - Portfolio ticker options
2. `POST /api/portfolio/simulate` - Run Monte Carlo simulation
3. `GET /api/inflation/data` - Display inflation assumptions

### API Response Handling
- **Success**: Parse and visualize metrics
- **Validation Errors**: Show inline field errors
- **Server Errors**: Display user-friendly error messages
- **Timeouts**: Show retry options with exponential backoff

---

## H) Accessibility & UX

### Accessibility (WCAG 2.1 AA)
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: Proper ARIA labels and descriptions
- **Color Contrast**: 4.5:1 minimum ratio
- **Focus Management**: Clear focus indicators

### User Experience Principles
- **Progressive Disclosure**: Show basic options first, advanced on demand
- **Smart Defaults**: Sensible default values for quick start
- **Immediate Feedback**: Real-time validation and loading states
- **Educational**: Tooltips and help text for complex concepts

---

## I) Testing Strategy

### Unit Testing
- Component rendering and interactions
- Form validation logic
- API response parsing
- Chart data transformation

### Integration Testing
- Complete simulation workflow
- API error handling
- Responsive design across devices
- Cross-browser compatibility

### User Testing
- Portfolio construction usability
- Results interpretation clarity
- Mobile experience validation
- Performance with large simulations

---

## J) Success Metrics

### Technical KPIs
- Page load time: <2 seconds
- Simulation completion rate: >95%
- Mobile bounce rate: <20%
- Browser compatibility: 99%+ modern browsers

### User Experience KPIs
- Simulation completion rate: >80%
- Time to first simulation: <3 minutes
- User satisfaction score: >4.5/5
- Feature adoption rate: >60% of active users

### Business KPIs
- User engagement increase: 25%+ time on platform
- Premium conversion uplift: 15%
- User retention improvement: 20%

---

## K) Implementation Timeline

### Phase 1: Core UI (Week 1)
- [ ] Navigation bar with routing
- [ ] Portfolio allocation component
- [ ] Simulation parameters form
- [ ] Basic responsive layout

### Phase 2: Data Integration (Week 2)
- [ ] API integration with error handling
- [ ] Form validation and submission
- [ ] Loading states and progress indicators
- [ ] Error boundary implementation

### Phase 3: Visualization (Week 3)
- [ ] Results summary cards
- [ ] Interactive charts with Nivo
- [ ] Detailed metrics table
- [ ] Export functionality

### Phase 4: Polish & Testing (Week 4)
- [ ] Mobile optimization
- [ ] Accessibility improvements
- [ ] Performance optimization
- [ ] Cross-browser testing

---

**Approval Required:** UX Design, Frontend Engineering, QA Teams  
**Next Steps:** Grok-4 review for validation and implementation feedback