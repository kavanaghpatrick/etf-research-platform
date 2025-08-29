# Monte Carlo Portfolio Simulator - Product Requirements Document

**Version:** 1.0  
**Date:** July 14, 2025  
**Product:** ETF Research Platform Enhancement  
**Reviewed by:** Grok-4 Financial Engineering AI

---

## A) Executive Summary

The Monte Carlo Portfolio Simulator is a key enhancement to our ETF research platform, enabling users to stress-test custom ETF portfolios under uncertain future conditions. By inputting portfolio allocations (tickers and percentages) and a simulation time period, users receive a percentile-based performance summary table that highlights key risk and return metrics across thousands of simulated scenarios.

### Key Value Propositions:
- **Quantifies Uncertainty:** Provides 10th, 25th, 50th, 75th, and 90th percentile outcomes for metrics like returns, volatility, and drawdowns
- **Inflation-Adjusted Insights:** Integrates historical U.S. CPI data for real returns, Safe Withdrawal Rate (SWR), and Perpetual Withdrawal Rate (PWR)
- **Integration and Efficiency:** Leverages existing backend components (CachedDataFetcher and TotalReturnCalculator)
- **User Benefits:** Reduces over-reliance on deterministic backtesting by incorporating stochastic modeling

### Business Impact:
- Increases user engagement and retention by 20-30% (based on industry benchmarks)
- Positions platform as leader in quantitative ETF analysis
- Supports premium tier monetization

---

## B) Technical Architecture

### High-Level Components:
- **Frontend (Next.js):** Portfolio allocation input interface, time period selection, results visualization
- **Backend (FastAPI):** Monte Carlo simulation engine with async processing (5,000+ iterations)
- **Integration Layer:** Extends existing CachedDataFetcher and TotalReturnCalculator
- **Data Layer:** Extends SQLite cache with inflation data storage

### Simulation Engine:
- **Methodology:** Bootstrap resampling with 1-year block size to preserve autocorrelation
- **Performance:** Vectorized operations using NumPy/Pandas
- **Inflation Integration:** Historical CPI data from FRED API
- **Response Time:** Target <5 seconds for 5,000 simulations

### Data Flow:
1. User submits portfolio allocation → API request to backend
2. Backend fetches/caches historical data via CachedDataFetcher
3. Run Monte Carlo: Generate simulated returns → Compute metrics → Aggregate percentiles
4. Return JSON response for frontend rendering

---

## C) API Design

### Primary Endpoint: `POST /api/portfolio/simulate`

**Request Body:**
```json
{
  "portfolio": [
    {"ticker": "SPY", "percentage": 60},
    {"ticker": "BND", "percentage": 40}
  ],
  "time_period_years": 30,
  "initial_balance": 1000000,
  "num_simulations": 5000,
  "historical_start_date": "2000-01-01"
}
```

**Response Body:**
```json
{
  "summary_table": {
    "metrics": [
      {
        "name": "Time Weighted Rate of Return (nominal)",
        "percentiles": {
          "10th": 7.81,
          "25th": 9.55,
          "50th": 11.46,
          "75th": 13.31,
          "90th": 14.95
        }
      },
      {
        "name": "Time Weighted Rate of Return (real)",
        "percentiles": {
          "10th": 4.71,
          "25th": 6.51,
          "50th": 8.46,
          "75th": 10.31,
          "90th": 11.93
        }
      },
      {
        "name": "Portfolio End Balance (nominal)",
        "percentiles": {
          "10th": 18422192,
          "25th": 29835681,
          "50th": 50128606,
          "75th": 81930568,
          "90th": 126274951
        }
      },
      {
        "name": "Portfolio End Balance (real)",
        "percentiles": {
          "10th": 7742116,
          "25th": 12848869,
          "50th": 22061462,
          "75th": 36585985,
          "90th": 56517849
        }
      },
      {
        "name": "Annual Mean Return (nominal)",
        "percentiles": {
          "10th": 8.95,
          "25th": 10.62,
          "50th": 12.43,
          "75th": 14.16,
          "90th": 15.68
        }
      },
      {
        "name": "Annualized Volatility",
        "percentiles": {
          "10th": 11.52,
          "25th": 12.06,
          "50th": 12.65,
          "75th": 13.24,
          "90th": 13.77
        }
      },
      {
        "name": "Sharpe Ratio",
        "percentiles": {
          "10th": 0.52,
          "25th": 0.65,
          "50th": 0.80,
          "75th": 0.95,
          "90th": 1.09
        }
      },
      {
        "name": "Sortino Ratio",
        "percentiles": {
          "10th": 0.77,
          "25th": 1.00,
          "50th": 1.27,
          "75th": 1.56,
          "90th": 1.83
        }
      },
      {
        "name": "Maximum Drawdown",
        "percentiles": {
          "10th": -54.80,
          "25th": -46.37,
          "50th": -38.11,
          "75th": -31.22,
          "90th": -27.37
        }
      },
      {
        "name": "Maximum Drawdown Excluding Cashflows",
        "percentiles": {
          "10th": -41.52,
          "25th": -37.92,
          "50th": -29.76,
          "75th": -24.37,
          "90th": -23.51
        }
      },
      {
        "name": "Safe Withdrawal Rate",
        "percentiles": {
          "10th": 5.53,
          "25th": 7.15,
          "50th": 9.17,
          "75th": 11.31,
          "90th": 13.40
        }
      },
      {
        "name": "Perpetual Withdrawal Rate",
        "percentiles": {
          "10th": 4.52,
          "25th": 6.12,
          "50th": 7.80,
          "75th": 9.34,
          "90th": 10.64
        }
      }
    ]
  },
  "simulation_metadata": {
    "num_simulations": 5000,
    "time_period_years": 30,
    "historical_data_range": "2000-01-01 to 2025-07-14"
  }
}
```

### Supporting Endpoints:
- `GET /api/tickers/available` - Returns supported ETF tickers
- `GET /api/inflation/data` - Returns historical CPI data range

---

## D) Data Requirements

### Historical Returns Data:
- **Source:** Daily adjusted close prices via existing CachedDataFetcher
- **Storage:** Extend SQLite with `asset_returns` table
- **Range:** 20+ years of historical data per ticker
- **Quality:** Validate completeness, exclude tickers with <5 years data

### Inflation Data:
- **Source:** Monthly U.S. CPI-U data from FRED API
- **Storage:** New SQLite table `inflation_data`
- **Integration:** Resample to annual rates for simulations
- **Schema:**
  ```sql
  CREATE TABLE inflation_data (
    date DATE PRIMARY KEY,
    cpi_rate DECIMAL(8,4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```

### Data Volume:
- Per ticker: ~5,000-10,000 daily data points (20-40 years)
- Total cache size: <1GB for 1,000 tickers
- Inflation data: ~600 monthly data points

---

## E) Risk Metrics Calculations

All metrics computed per simulation path, then aggregated into percentiles (10th, 25th, 50th, 75th, 90th).

### Core Metrics:

**Time Weighted Rate of Return (TWRR):**
- Nominal: Annualized geometric mean of portfolio returns
- Real: Nominal TWRR adjusted for inflation

**Portfolio End Balance:**
- Nominal: Final value after compounding
- Real: Inflation-adjusted final value

**Risk Metrics:**
- **Annualized Volatility:** Standard deviation of returns
- **Sharpe Ratio:** (Return - Risk-free rate) / Volatility
- **Sortino Ratio:** Uses downside volatility only
- **Maximum Drawdown:** Largest peak-to-trough decline

**Withdrawal Rates:**
- **Safe Withdrawal Rate:** Highest sustainable rate for 95% success
- **Perpetual Withdrawal Rate:** Infinite horizon sustainability

### Statistical Methodology:
- **Bootstrap Resampling:** Block size = 252 trading days
- **Simulations:** 5,000 iterations for convergence
- **Performance:** Vectorized NumPy operations

---

## F) Implementation Timeline

**Total Duration:** 8-10 weeks (2-3 developers)

### Phase 1: Foundation (Weeks 1-2)
- [ ] Extend SQLite schema for inflation data
- [ ] Integrate FRED API for CPI data
- [ ] Design API schemas and validation

### Phase 2: Simulation Engine (Weeks 3-4)
- [ ] Implement bootstrap resampling methodology
- [ ] Build Monte Carlo simulation core
- [ ] Integrate with existing TotalReturnCalculator

### Phase 3: Risk Metrics (Weeks 5-6)
- [ ] Implement all risk metric calculations
- [ ] Build percentile aggregation system
- [ ] Performance optimization (<5s target)

### Phase 4: Frontend & API (Week 7)
- [ ] Build Next.js portfolio input interface
- [ ] Create results visualization components
- [ ] Implement API integration

### Phase 5: Testing & Deployment (Week 8)
- [ ] Comprehensive testing suite
- [ ] Performance benchmarking
- [ ] Production deployment

---

## G) Testing Strategy

### Statistical Validation:
- [ ] Compare simulated distributions to historical data
- [ ] Verify bootstrap preserves correlations
- [ ] Validate inflation integration accuracy

### Performance Testing:
- [ ] Benchmark simulation speed (<5s for 5,000 iterations)
- [ ] Concurrent user load testing (100 users)
- [ ] Memory usage optimization

### Edge Case Testing:
- [ ] Invalid portfolio allocations
- [ ] Short historical data periods
- [ ] Extreme time periods (1-50 years)

### Integration Testing:
- [ ] End-to-end API workflow
- [ ] Cache integration validation
- [ ] Frontend-backend integration

---

## H) Success Metrics

### Technical KPIs:
- Simulation response time: <5 seconds
- Statistical accuracy: ±5% vs. backtested results
- System uptime: 99.9%

### Business KPIs:
- User engagement increase: 20-30%
- Feature adoption rate: 15% of active users
- Premium conversion uplift: 10%

### User Experience:
- Intuitive portfolio allocation interface
- Clear results visualization
- Responsive design for mobile/desktop

---

## I) Future Enhancements (Post-MVP)

### Version 1.1:
- Custom risk-free rate input
- Additional asset classes (REITs, commodities)
- Scenario analysis (recession, inflation spikes)

### Version 1.2:
- Goal-based planning (retirement target)
- Tax-aware simulations
- Dynamic rebalancing strategies

### Version 2.0:
- Machine learning enhanced return predictions
- Factor-based risk models
- Real-time market regime detection

---

**Approval Required:** Product, Engineering, QA Teams  
**Next Steps:** Technical spike on bootstrap methodology and FRED API integration