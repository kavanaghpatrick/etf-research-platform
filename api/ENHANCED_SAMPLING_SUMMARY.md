# Enhanced Sampling Methods for Monte Carlo Simulations

## Overview
To address the issue of extreme negative returns (-65.8%) when dealing with limited historical data, we've implemented several advanced sampling methods that are more robust than traditional block bootstrap.

## Implemented Methods

### 1. **Regime-Aware Bootstrap**
- Detects market regimes (bull, bear, neutral) using either Gaussian Mixture Models or quantile-based methods
- Samples from different regimes based on historical frequencies
- Prevents over-sampling from crisis periods when data is limited
- Particularly effective for 10-20 years of data

### 2. **Parametric Student-t Distribution**
- Fits Student-t distribution to capture fat tails better than normal distribution
- Generates synthetic returns that match historical volatility and tail risk
- Ideal for very limited data (<5 years)
- Extrapolates beyond observed historical range

### 3. **Hybrid Approach**
- Combines historical bootstrap (60-70%) with parametric generation (30-40%)
- Preserves empirical features while extending scenario space
- Recommended for 5-10 years of data
- Balances realism with statistical robustness

### 4. **Adaptive Block Sizing**
- Automatically adjusts block size based on available data
- Smaller blocks (3 months) for limited data vs larger blocks (1 year) for abundant data
- Increases diversity of scenarios with limited data

## Key Features

### Automatic Method Selection
The system automatically recommends the best method based on:
- Years of historical data available
- Portfolio size and composition
- Historical volatility

### Daily Loss Capping
- Caps extreme daily losses at -20% (circuit breaker level)
- Prevents unrealistic compound losses from limited data scenarios
- Logs warnings when extreme losses are capped

### Portfolio-Level Validation
- Warns when 50%+ of portfolio has limited data (<15 years)
- Provides clear data disclosures in results
- Recommends using ETFs with longer history

## Usage

The enhanced sampling is enabled by default in SimulationConfig:
```python
config = SimulationConfig(
    portfolio=allocations,
    time_period_years=30,
    initial_balance=10000,
    num_simulations=5000,
    historical_start_date=start_date,
    use_enhanced_sampling=True,  # Enabled by default
    sampling_method='auto'  # Automatically selects best method
)
```

## Benefits

1. **More Realistic Projections**: Prevents extreme negative scenarios from limited data
2. **Better Risk Assessment**: Captures tail risks without over-emphasizing recent crises
3. **Flexible Framework**: Adapts to data availability automatically
4. **Transparent**: Logs which method is used and why

## Technical Implementation

- **enhanced_sampling.py**: Core implementation of sampling methods
- **monte_carlo_engine.py**: Integration with main simulation engine
- Graceful fallback if scikit-learn is not available
- Preserves correlation structure in multi-asset portfolios

## Recommendations

For most reliable results:
1. Use ETFs with 20+ years of historical data when possible
2. Enable enhanced sampling for any portfolio with <20 years average history
3. Review data disclosures in simulation results
4. Consider the trade-offs between historical accuracy and statistical robustness