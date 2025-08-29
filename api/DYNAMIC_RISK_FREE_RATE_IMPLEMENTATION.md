# Dynamic Risk-Free Rate Implementation

## Overview

This implementation replaces the hard-coded 2% risk-free rate in the Monte Carlo engine with a dynamic system that fetches current Treasury rates from the FRED API. The system provides fallback mechanisms, caching, and configuration options for production use.

## Key Components

### 1. TreasuryRateFetcher (`treasury_rate_fetcher.py`)

**Purpose**: Fetches current and historical Treasury rates from FRED API with caching and fallback mechanisms.

**Features**:
- Supports multiple Treasury durations (3-month, 1-year, 2-year, 5-year, 10-year, 30-year)
- Configurable cache duration (default: 4 hours)
- Automatic fallback to historical averages if API fails
- Rate limiting and error handling
- Historical data retrieval for analysis

**Configuration**:
```python
from treasury_rate_fetcher import TreasuryRateConfig

config = TreasuryRateConfig(
    duration='3_month',        # Treasury duration
    cache_hours=4,             # Cache duration in hours  
    fallback_rate=0.02         # Fallback rate (2%)
)
```

### 2. Enhanced Monte Carlo Engine (`monte_carlo_engine.py`)

**Changes Made**:
- Integrated `TreasuryRateFetcher` for dynamic risk-free rates
- Added Treasury rate metadata to simulation results
- Implemented rate caching with periodic updates
- Added methods to change Treasury duration dynamically
- Enhanced error handling and fallback mechanisms

**New Methods**:
- `get_current_risk_free_rate(force_refresh=False)`: Get current rate with caching
- `get_treasury_rate_info()`: Get comprehensive Treasury rate information
- `set_treasury_duration(duration)`: Change Treasury duration
- `close()`: Clean up resources

### 3. API Endpoints (`main.py`)

**New Endpoints**:

1. **GET `/api/treasury/rates`**: Get all current Treasury rates
2. **GET `/api/treasury/current`**: Get current risk-free rate used in simulations
3. **POST `/api/treasury/duration?duration=<duration>`**: Change Treasury duration

**Enhanced Endpoints**:
- Monte Carlo simulation results now include `treasury_metadata`

### 4. Frontend Integration (`monteCarloApi.ts`)

**New Functions**:
- `getTreasuryRates()`: Fetch all Treasury rates
- `getCurrentRiskFreeRate()`: Get current risk-free rate
- `setTreasuryDuration(duration)`: Change Treasury duration

**Enhanced Types**:
- Added `TreasuryMetadata` interface
- Updated `MonteCarloResponse` to include Treasury metadata

## Configuration Options

### Environment Variables

```bash
# FRED API key for Treasury rate fetching
FRED_API_KEY=your_fred_api_key_here

# Treasury duration (optional, default: 3_month)
TREASURY_DURATION=3_month  # Options: 3_month, 1_year, 2_year, 5_year, 10_year, 30_year

# Cache duration in hours (optional, default: 4)
TREASURY_CACHE_HOURS=4
```

### Treasury Duration Options

| Duration | FRED Series | Description |
|----------|-------------|-------------|
| `3_month` | DGS3MO | 3-Month Treasury Constant Maturity Rate |
| `1_year` | DGS1 | 1-Year Treasury Constant Maturity Rate |
| `2_year` | DGS2 | 2-Year Treasury Constant Maturity Rate |
| `5_year` | DGS5 | 5-Year Treasury Constant Maturity Rate |
| `10_year` | DGS10 | 10-Year Treasury Constant Maturity Rate |
| `30_year` | DGS30 | 30-Year Treasury Constant Maturity Rate |

## Fallback Mechanisms

### 1. API Failure
- If FRED API is unavailable, uses configured fallback rate
- Logs warning and continues with fallback value
- Maintains simulation functionality even without API access

### 2. Rate Caching
- Caches rates for configurable duration (default: 4 hours)
- Uses cached rate if fresh fetch fails
- Provides last-updated timestamp for transparency

### 3. Default Values
- 3-month Treasury: 2.0% fallback
- 10-year Treasury: 3.5% fallback (higher default for longer duration)
- Configurable per Treasury duration

## Usage Examples

### Basic Usage

```python
from treasury_rate_fetcher import TreasuryRateFetcher, TreasuryRateConfig
from monte_carlo_engine import MonteCarloEngine

# Configure Treasury rate fetching
treasury_config = TreasuryRateConfig(
    duration='10_year',
    cache_hours=6,
    fallback_rate=0.035
)

# Initialize Monte Carlo engine with dynamic rates
mc_engine = MonteCarloEngine(
    data_fetcher=data_fetcher,
    inflation_fetcher=inflation_fetcher,
    treasury_config=treasury_config
)

# Get current risk-free rate
current_rate = mc_engine.get_current_risk_free_rate()
print(f"Current 10-year Treasury: {current_rate:.2%}")

# Run simulation (automatically uses current Treasury rate)
results = mc_engine.run_simulation(config)

# Treasury metadata is included in results
treasury_info = results['treasury_metadata']
print(f"Used rate: {treasury_info['risk_free_rate_percentage']}")
```

### API Usage

```bash
# Get current Treasury rates
curl http://localhost:8000/api/treasury/rates

# Get current risk-free rate
curl http://localhost:8000/api/treasury/current

# Change Treasury duration
curl -X POST "http://localhost:8000/api/treasury/duration?duration=10_year"
```

### Frontend Usage

```typescript
import { monteCarloApi } from '@/services/monteCarloApi';

// Get current Treasury rates
const treasuryData = await monteCarloApi.getTreasuryRates();
console.log('Current rates:', treasuryData.current_rates);

// Change Treasury duration
await monteCarloApi.setTreasuryDuration('10_year');

// Run simulation (uses new Treasury rate)
const results = await monteCarloApi.runSimulation(request);
console.log('Treasury info:', results.treasury_metadata);
```

## Benefits

### 1. Market Accuracy
- Uses current Treasury rates instead of static 2%
- Reflects real market conditions in risk-adjusted metrics
- More accurate Sharpe and Sortino ratio calculations

### 2. Flexibility
- Supports different Treasury durations for different analysis needs
- Configurable caching and fallback mechanisms
- Can be changed dynamically without restart

### 3. Reliability
- Robust fallback mechanisms ensure system availability
- Caching reduces API dependency
- Comprehensive error handling and logging

### 4. Transparency
- Treasury metadata included in simulation results
- Shows which rate was used and when it was last updated
- API endpoints for monitoring current rates

## Testing

Run the test suite to verify functionality:

```bash
cd /path/to/etf-research-platform/api
python3 test_dynamic_risk_free_rate.py
```

The test suite verifies:
- Treasury rate fetching with and without FRED API
- Monte Carlo engine integration
- Fallback mechanisms
- End-to-end simulation functionality

## Production Deployment

### Required Environment Variables

```bash
# Essential for production
FRED_API_KEY=your_fred_api_key

# Optional configuration
TREASURY_DURATION=3_month
TREASURY_CACHE_HOURS=4
```

### Monitoring

Monitor the following for production health:
- FRED API availability (`/api/treasury/current` endpoint)
- Treasury rate freshness (check `last_updated` timestamp)
- Fallback usage (check logs for fallback warnings)

## Migration from Hard-Coded Rate

The system is backward compatible:
1. **No FRED API key**: Falls back to 2% (previous behavior)
2. **Existing simulations**: Continue to work with new dynamic rates
3. **Configuration**: All settings have sensible defaults

## Future Enhancements

1. **Multiple Rate Sources**: Add Bloomberg, Yahoo Finance as backup sources
2. **Rate Forecasting**: Use ML models to predict future rates
3. **Volatility Adjustments**: Factor in Treasury rate volatility
4. **Currency Support**: Support for international Treasury rates
5. **Real-time Updates**: WebSocket updates for rate changes

## Conclusion

This implementation provides a robust, flexible, and production-ready solution for dynamic risk-free rates in Monte Carlo simulations. It maintains system reliability while significantly improving the accuracy of financial calculations by using current market data.