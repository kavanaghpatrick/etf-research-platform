# PRD: Monte Carlo Results Toggle Performance Optimization

## **Problem Statement**

**Current Issue**: Switching between nominal and real values in Monte Carlo simulation results takes 2-5+ seconds, creating a poor user experience and making the interface feel unresponsive.

**User Impact**: 
- Users avoid exploring different value types due to slow response
- Perception of application as sluggish/broken
- Reduced engagement with simulation results
- Professional credibility concerns for financial analysis tool

**Business Impact**:
- Decreased user satisfaction and retention
- Negative perception of application quality
- Competitive disadvantage vs. responsive financial tools

## **Success Metrics**

### **Primary KPIs**
- **Toggle Response Time**: < 100ms (currently 2-5s)
- **Perceived Performance**: Instant visual feedback
- **User Engagement**: 50% increase in toggle usage frequency

### **Technical KPIs**
- **Component Re-renders**: Reduce by 80%
- **Data Transformation Time**: < 10ms
- **Chart Update Time**: < 50ms
- **Memory Usage**: No memory leaks on repeated toggles

## **Root Cause Analysis**

### **Performance Bottlenecks Identified**

1. **Chart Re-rendering** (Primary Issue - ~80% of delay)
   - Nivo charts completely re-mount on data changes
   - 5,000+ data points × 5 percentiles = 25,000+ values processed
   - No data transition animations, just rebuild

2. **Data Transformation** (~15% of delay)
   - Percentile data converted on every render
   - No memoization of expensive calculations
   - Array operations repeated unnecessarily

3. **Component Re-renders** (~5% of delay)
   - Parent components re-render entire tree
   - Missing React.memo optimizations
   - Prop drilling causes cascade re-renders

### **Technical Details**

**Files Involved**:
- `components/SimulationResults.tsx` - Toggle state management
- `components/GrowthChart.tsx` - Main chart component
- `components/charts/OutcomeDistributionChart.tsx` - Distribution visualization
- `services/monteCarloApi.ts` - Data structure definitions

**Current Data Flow**:
```
Toggle Click → State Change → Full Component Re-render → 
Data Transformation → Chart Destroy → Chart Recreate → 
New Data Binding → Layout Recalculation → Paint
```

## **Solution Strategy**

### **Phase 1: Quick Wins (Target: 70% improvement)**

#### **1.1 Data Pre-computation & Memoization**
- **Implementation**: Cache both nominal and real chart data using `useMemo`
- **Impact**: Eliminate data transformation on toggles
- **Effort**: 2-4 hours

```typescript
const nominalChartData = useMemo(() => 
  transformPercentileData(results.percentile_paths_nominal), 
  [results.percentile_paths_nominal]
);

const realChartData = useMemo(() => 
  transformPercentileData(results.percentile_paths_real), 
  [results.percentile_paths_real]
);
```

#### **1.2 React Performance Optimizations**
- **React.memo**: Wrap expensive chart components
- **useCallback**: Stabilize event handlers
- **Component splitting**: Isolate toggle state from heavy components
- **Impact**: Reduce unnecessary re-renders
- **Effort**: 3-5 hours

#### **1.3 Chart Update Optimization**
- **Strategy**: Update chart data properties instead of full re-mount
- **Implementation**: Use chart instance methods for data updates
- **Fallback**: Investigate react-nivo alternatives if needed
- **Impact**: 60-80% reduction in chart update time
- **Effort**: 4-8 hours

### **Phase 2: Advanced Optimizations (Target: 90% improvement)**

#### **2.1 Virtual Scrolling/Data Windowing**
- **For**: Large datasets (>1000 data points)
- **Implementation**: Only render visible chart portions
- **Libraries**: `react-window` or custom solution
- **Impact**: Consistent performance regardless of dataset size
- **Effort**: 8-12 hours

#### **2.2 Web Workers for Data Processing**
- **Use Case**: Heavy statistical calculations
- **Implementation**: Offload percentile calculations to worker threads
- **Impact**: Non-blocking UI during computation
- **Effort**: 6-10 hours

#### **2.3 Chart Library Evaluation**
- **Options**: Recharts, Chart.js, D3 direct, Canvas-based solutions
- **Criteria**: Performance, data update efficiency, bundle size
- **Decision Matrix**: Speed vs. features vs. maintenance
- **Effort**: 12-20 hours (including migration)

### **Phase 3: Infrastructure Improvements**

#### **3.1 State Management Optimization**
- **Context Splitting**: Separate toggle state from simulation data
- **Zustand/Redux**: If state complexity increases
- **Impact**: Cleaner re-render patterns
- **Effort**: 4-8 hours

#### **3.2 Bundle Optimization**
- **Code Splitting**: Lazy load chart components
- **Tree Shaking**: Remove unused chart features
- **Impact**: Faster initial load, better memory usage
- **Effort**: 2-4 hours

## **Technical Implementation Plan**

### **Step-by-Step Execution**

#### **Week 1: Quick Wins**
1. **Day 1-2**: Data memoization implementation
2. **Day 3-4**: React.memo and useCallback optimization
3. **Day 5**: Chart update optimization (Nivo-specific)

#### **Week 2: Validation & Advanced**
1. **Day 1-2**: Performance testing and measurement
2. **Day 3-5**: Virtual scrolling implementation if needed

#### **Week 3: Polish & Monitoring**
1. **Day 1-2**: Chart library evaluation (if Nivo insufficient)
2. **Day 3-4**: Performance monitoring implementation
3. **Day 5**: Documentation and code review

### **Performance Measurement Plan**

#### **Metrics Collection**
```typescript
// Performance timing wrapper
const measureTogglePerformance = () => {
  const start = performance.now();
  // Toggle operation
  const end = performance.now();
  analytics.track('toggle_performance', { duration: end - start });
};
```

#### **Testing Protocol**
1. **Baseline Measurement**: Current performance across devices
2. **A/B Testing**: Optimized vs. current implementation
3. **Load Testing**: Performance with various dataset sizes
4. **Device Testing**: Mobile, tablet, desktop performance

## **Risk Assessment**

### **High Risk**
- **Chart Library Limitations**: Nivo may not support efficient updates
  - *Mitigation*: Have backup library evaluation ready
- **Data Structure Changes**: Backend API modifications needed
  - *Mitigation*: Maintain backward compatibility

### **Medium Risk**  
- **Regression Testing**: Performance optimization might break functionality
  - *Mitigation*: Comprehensive test suite
- **Browser Compatibility**: Advanced optimizations may not work everywhere
  - *Mitigation*: Progressive enhancement approach

### **Low Risk**
- **Bundle Size Increase**: Additional optimization libraries
  - *Mitigation*: Code splitting and lazy loading

## **Success Criteria**

### **Must Have**
- [ ] Toggle response time < 100ms on desktop
- [ ] Toggle response time < 200ms on mobile
- [ ] No visual glitches during transition
- [ ] Existing functionality preserved

### **Should Have**  
- [ ] Smooth animation between nominal/real values
- [ ] Performance monitoring dashboard
- [ ] Automated performance regression testing
- [ ] Memory usage optimization

### **Nice to Have**
- [ ] Keyboard shortcuts for toggle
- [ ] Advanced chart interactions (zoom, pan)
- [ ] Export functionality optimization
- [ ] Real-time performance metrics

## **Dependencies**

### **Technical**
- React 19 performance features evaluation
- Chart library compatibility assessment  
- Bundle analyzer setup
- Performance monitoring infrastructure

### **Design**
- Loading state designs for transitions
- Animation specifications
- Error state handling for performance failures

### **QA**
- Performance testing methodology
- Device testing matrix
- Regression testing suite expansion

## **Post-Launch Monitoring**

### **Performance Dashboard**
- Real-time toggle performance metrics
- User device/browser breakdown
- Performance regression alerts
- Usage pattern analysis

### **User Feedback Collection**
- In-app performance satisfaction survey
- Support ticket categorization
- User behavior analytics
- A/B test result analysis

## **Future Considerations**

### **Scalability**
- Support for larger simulation datasets (10K+ scenarios)
- Multiple portfolio comparison views
- Real-time data updates
- Collaborative features

### **Technology Evolution**
- React Server Components evaluation
- WebAssembly for heavy calculations
- GPU acceleration for visualizations
- Progressive Web App optimizations

---

**Prepared by**: Claude Code Agent  
**Date**: 2025-07-14  
**Priority**: P0 (Critical User Experience Issue)  
**Estimated Total Effort**: 40-60 engineering hours  
**Target Completion**: 3 weeks  