# Product Requirements Document: Dividend Tracking Feature

## Overview
Add comprehensive dividend tracking to the ETF Research Platform to enable total return calculations and accurate performance analysis.

## Business Requirements
- Track dividend payments for all ETFs and stocks
- Calculate total returns (price appreciation + dividends)
- Store historical dividend data efficiently
- Handle dividend reinvestment scenarios
- Support different dividend types (regular, special, return of capital)

## Technical Requirements

### 1. Data Source Analysis
- Identify which APIs provide dividend data
- Document data formats and limitations
- Determine best sources for dividend information

### 2. Database Schema Design
- Design tables for dividend storage
- Handle corporate actions (splits, mergers)
- Ensure data normalization
- Maintain referential integrity

### 3. Data Fetching Implementation
- Add dividend fetching to existing sources
- Implement caching strategy
- Handle missing dividend data gracefully

### 4. Total Return Calculations
- Implement price + dividend return calculations
- Support multiple calculation methods (simple, compound)
- Handle dividend reinvestment scenarios

### 5. API Endpoints
- Add dividend-specific endpoints
- Enhance existing endpoints with dividend data
- Return total return metrics

## Parallelizable Tasks for Agents

### Agent 1: API Source Analysis
**Task**: Analyze all 5 data sources for dividend capabilities
- Test YFinance dividend endpoints
- Check AlphaVantage dividend data
- Investigate Tiingo dividend support
- Explore Finnhub corporate actions
- Review Polygon dividend endpoints
- Create comparison matrix
- **Output**: `DIVIDEND_API_ANALYSIS.md`

### Agent 2: Database Schema Design
**Task**: Design comprehensive dividend storage schema
- Create dividend tables schema
- Design for corporate actions
- Plan data normalization strategy
- Handle ex-dividend dates
- Support payment dates
- Account for tax implications
- **Output**: `dividend_schema.sql` and implementation in SQLite

### Agent 3: YFinance Dividend Implementation
**Task**: Implement dividend fetching for YFinance
- Add dividend methods to yfinance_source.py
- Handle dividend adjustments
- Implement caching logic
- Test with multiple ETFs
- **Output**: Updated `yfinance_source.py` with dividend support

### Agent 4: Total Return Calculator
**Task**: Create total return calculation engine
- Implement return calculation methods
- Handle dividend reinvestment
- Support different time periods
- Create performance metrics
- **Output**: `total_return_calculator.py`

### Agent 5: API Enhancement
**Task**: Add dividend endpoints to FastAPI
- Create /dividends/{ticker} endpoint
- Enhance /data/fetch with dividend option
- Add total return to existing responses
- Create dividend summary endpoint
- **Output**: Updated `main.py` with dividend endpoints

## Success Criteria
1. Dividend data available for all supported tickers
2. Total return calculations accurate to 0.01%
3. Historical dividends cached efficiently
4. API response times under 2 seconds
5. Support for 10+ years of dividend history

## Data Model

### Dividends Table
```sql
CREATE TABLE dividends (
    id INTEGER PRIMARY KEY,
    ticker_symbol VARCHAR(10),
    ex_date DATE,
    payment_date DATE,
    record_date DATE,
    amount DECIMAL(10, 4),
    currency VARCHAR(3),
    dividend_type VARCHAR(20),
    frequency VARCHAR(20),
    source VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### Total Returns View
```sql
CREATE VIEW total_returns AS
SELECT 
    p.ticker_symbol,
    p.date,
    p.close as price,
    COALESCE(d.amount, 0) as dividend,
    p.close + COALESCE(SUM(d.amount) OVER (PARTITION BY p.ticker_symbol ORDER BY p.date), 0) as total_value
FROM stock_data p
LEFT JOIN dividends d ON p.ticker_symbol = d.ticker_symbol AND p.date = d.ex_date;
```

## Risk Mitigation
- Handle missing dividend data gracefully
- Account for data source inconsistencies
- Validate dividend amounts
- Handle corporate actions properly
- Test with ETFs having different dividend frequencies

## Timeline
- Parallel execution: 2-3 hours
- Integration and testing: 1 hour
- Total: 3-4 hours with parallel agents