# Product Requirements Document: ETF Platform Data Source Fixes

## Overview
This PRD outlines the comprehensive fixes needed for the ETF Research Platform's data fetching system to eliminate excessive error logging, optimize gap detection, and ensure robust data retrieval across all 5 data sources.

## Current Issues
1. **Gap Detection Inefficiency**: System attempts to fetch data for individual holidays/weekends, causing thousands of failed API calls
2. **Finnhub Date Bug**: `'datetime.date' object has no attribute 'timestamp'` error preventing Finnhub from working
3. **Excessive Error Logging**: Noisy logs from expected failures (holidays, rate limits) making debugging difficult
4. **Polygon Free Tier Limitations**: Cannot access historical data beyond 2 years
5. **Missing Market Calendar Awareness**: No understanding of trading vs non-trading days

## Technical Requirements

### 1. Market Calendar Integration
- **Library**: pandas_market_calendars
- **Implementation**:
  - Add market calendar to determine valid trading days
  - Pre-filter date ranges to exclude weekends/holidays before API calls
  - Cache calendar data for performance

### 2. Finnhub Date Fix
- **Root Cause**: Using datetime.date instead of datetime.datetime for timestamp conversion
- **Solution**: Ensure all date objects are datetime with time component before calling .timestamp()

### 3. Error Handling Optimization
- **Approach**: Differentiate between expected and unexpected errors
- **Expected Errors**: 
  - 404s for holidays/weekends
  - 429 rate limits
  - Polygon free tier restrictions
- **Implementation**: Suppress logging for expected errors, only log warnings for unexpected failures

### 4. Gap Detection Optimization
- **Current**: Detects every missing day and tries to fetch individually
- **New**: 
  - Use market calendar to identify valid gaps only
  - Batch adjacent gaps into ranges
  - Skip known non-trading days entirely

### 5. Comprehensive Testing
- **Unit tests** for each data source
- **Integration tests** with real API calls
- **Performance tests** for large date ranges
- **Error scenario tests**

## Parallelizable Tasks

### Agent 1: Market Calendar Integration
- Install pandas_market_calendars
- Create MarketCalendarService class
- Integrate with cached_data_fetcher.py
- Add calendar caching mechanism
- Write unit tests

### Agent 2: Fix Finnhub Date Handling
- Fix timestamp conversion in SimpleFinnhubSource
- Add timezone awareness
- Test with various date formats
- Add error handling for edge cases
- Write unit tests

### Agent 3: Error Handling & Logging
- Create error classification system
- Implement smart error suppression
- Add structured logging with levels
- Create error monitoring dashboard endpoint
- Write integration tests

### Agent 4: Gap Detection Optimization
- Refactor gap detection algorithm
- Implement batch gap processing
- Add market calendar awareness
- Optimize for performance
- Write performance tests

### Agent 5: Documentation & Testing
- Update API documentation
- Create comprehensive test suite
- Add performance benchmarks
- Update CLAUDE.md with learnings
- Create troubleshooting guide

## Success Criteria
1. **Zero errors** for holiday/weekend gap detection
2. **All 5 data sources** functioning properly
3. **90% reduction** in error log volume
4. **Sub-3 second** response time for 2-year data requests
5. **100% test coverage** for critical paths

## Implementation Timeline
- Research & Planning: ✅ Complete
- Development: 4 hours (with parallel agents)
- Testing: 2 hours
- Documentation: 1 hour
- Total: ~7 hours sequential, ~2 hours with parallel execution

## Risk Mitigation
1. **API Rate Limits**: Implement exponential backoff and respect retry-after headers
2. **Breaking Changes**: Pin library versions and test thoroughly
3. **Performance**: Add caching at multiple levels
4. **Data Accuracy**: Validate against known good data sources

## Rollback Plan
1. All changes in feature branch
2. Comprehensive tests before merge
3. Previous version tagged for quick rollback
4. Database migrations reversible

## Post-Implementation
1. Monitor error rates for 24 hours
2. Performance benchmarks
3. User acceptance testing
4. Documentation review
5. Knowledge transfer session