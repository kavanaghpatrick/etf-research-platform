# Total Return Calculator Documentation

## Overview

The Total Return Calculator is a comprehensive Python module that calculates investment returns including dividends. It integrates with the existing ETF Research Platform database and caching system.

## Features

### 1. Simple Total Return Calculation
- Price appreciation + dividend income
- Annualized returns
- Dividend yield calculations

### 2. Dividend Reinvestment Calculations
- Models reinvesting dividends at market prices
- Tracks share accumulation over time
- Compares simple vs. reinvested returns

### 3. Year-over-Year Analysis
- Annual return breakdown
- Separates price vs. dividend returns
- Multi-year performance tracking

### 4. Dividend Metrics
- Payment frequency detection
- Dividend growth rates
- TTM (trailing twelve months) analysis
- Historical dividend summaries

### 5. Dividend Calendar
- Estimates future dividend dates
- Based on historical payment patterns
- Multi-ticker support

### 6. Database Integration
- Automatic caching of dividend data
- Integrates with existing stock_data table
- Creates dividend-specific tables and views

## Installation

The calculator requires the existing dependencies plus creates new database tables:

```python
from total_return_calculator import TotalReturnCalculator

# Initialize (creates tables if needed)
calculator = TotalReturnCalculator()
```

## Database Schema

### New Tables Created

1. **dividends**
   - Stores historical dividend information
   - Unique constraint on (ticker, ex_date, dividend_type)

2. **dividend_cache_ranges**
   - Tracks which date ranges have been cached
   - Optimizes API usage

3. **corporate_actions**
   - Stores stock splits and other corporate actions
   - Used for dividend adjustments

### New Views Created

1. **stock_data_with_dividends**
   - Joins price data with dividend information
   - Convenient for total return calculations

2. **dividend_summary**
   - Aggregated dividend statistics per ticker
   - Includes payment frequency estimation

## Usage Examples

### Basic Total Return Calculation

```python
from total_return_calculator import TotalReturnCalculator
from datetime import date

calculator = TotalReturnCalculator()

# Calculate simple total return
metrics = calculator.calculate_simple_total_return(
    ticker='AAPL',
    start_date='2023-01-01',
    end_date='2024-01-01'
)

print(f"Total Return: {metrics.total_return:.2%}")
print(f"Price Return: {metrics.price_return:.2%}")
print(f"Dividend Return: {metrics.dividend_return:.2%}")
print(f"Annualized Return: {metrics.annualized_return:.2%}")
```

### Dividend Reinvestment Analysis

```python
# Calculate returns with dividend reinvestment
reinvest_metrics = calculator.calculate_dividend_reinvested_return(
    ticker='JNJ',
    start_date='2021-01-01',
    end_date='2024-01-01',
    initial_investment=10000
)

print(f"Simple Return: {reinvest_metrics.total_return:.2%}")
print(f"Reinvested Return: {reinvest_metrics.reinvested_return:.2%}")
print(f"Final Value: ${reinvest_metrics.reinvested_value:,.2f}")
```

### Year-over-Year Performance

```python
# Get 5-year performance breakdown
yoy_returns = calculator.calculate_year_over_year_returns('MSFT', years=5)

for _, year_data in yoy_returns.iterrows():
    print(f"\nYear {year_data['year']}:")
    print(f"  Total Return: {year_data['total_return']:.2%}")
    print(f"  Dividends: ${year_data['total_dividends']:.2f}")
```

### Dividend Analysis

```python
# Analyze dividend metrics
div_metrics = calculator.calculate_dividend_metrics('KO', years=5)

if div_metrics['dividend_paying']:
    metrics = div_metrics['metrics']
    print(f"Current Yield: {metrics['current_yield']:.2%}")
    print(f"Payment Frequency: {metrics['payment_frequency']}")
    print(f"Dividend Growth Rate: {metrics['dividend_growth_rate']:.2%}")
```

### Dividend Calendar

```python
# Get upcoming dividends for multiple stocks
calendar = calculator.get_dividend_calendar(
    tickers=['JNJ', 'PG', 'KO', 'PEP'],
    days_ahead=90
)

for _, event in calendar.iterrows():
    print(f"{event['ticker']}: {event['estimated_ex_date']} "
          f"(est. ${event['last_dividend_amount']:.2f})")
```

## API Integration

The module includes FastAPI integration examples:

```python
# In your main.py
from total_return_api_integration import setup_total_return_routes

app = FastAPI()
setup_total_return_routes(app)
```

### Available Endpoints

1. **POST /api/v1/returns/calculate**
   - Calculate total returns with optional reinvestment

2. **GET /api/v1/returns/year-over-year/{ticker}**
   - Get yearly performance breakdown

3. **POST /api/v1/returns/dividend-metrics**
   - Analyze dividend payment patterns

4. **POST /api/v1/returns/dividend-calendar**
   - Get estimated upcoming dividends

5. **GET /api/v1/returns/compare**
   - Compare returns across multiple stocks

## Data Export Formats

The calculator supports multiple output formats:

```python
# Export as JSON
json_output = calculator.export_results(metrics, format='json')

# Export as DataFrame
df_output = calculator.export_results(metrics, format='dataframe')

# Export as dictionary
dict_output = calculator.export_results(metrics, format='dict')
```

## Performance Considerations

### Caching Strategy
- Dividend data is cached aggressively (changes infrequently)
- Price data uses existing cache manager
- Automatic detection of cached vs. missing data

### Database Optimization
- Indexes on ticker_symbol and date columns
- Batch insertions for efficiency
- Views for common join operations

### API Rate Limiting
- Inherits rate limiting from YFinanceSource
- Minimizes API calls through intelligent caching

## Error Handling

The calculator includes comprehensive error handling:

```python
try:
    metrics = calculator.calculate_simple_total_return('INVALID', '2023-01-01', '2024-01-01')
except ValueError as e:
    print(f"Invalid input: {e}")
except Exception as e:
    print(f"Calculation error: {e}")
```

## Limitations

1. **Dividend Data**
   - Ex-dividend dates only (no payment dates from YFinance)
   - No dividend forecasts
   - Limited to regular cash dividends

2. **Tax Considerations**
   - Calculations are pre-tax
   - No support for tax-adjusted returns

3. **Currency**
   - Assumes USD for all calculations
   - No currency conversion support

## Best Practices

1. **Date Ranges**
   - Use market days for accurate calculations
   - Allow for weekends/holidays in date ranges

2. **Caching**
   - Pre-cache frequently used tickers
   - Run batch updates during off-hours

3. **Error Recovery**
   - Always check for empty DataFrames
   - Handle missing dividend data gracefully

## Testing

Run the comprehensive test suite:

```bash
python test_total_return_calculator.py
```

Tests cover:
- Simple and reinvested returns
- Year-over-year calculations
- Dividend metrics
- Edge cases (non-dividend stocks, short periods)
- Cache functionality

## Future Enhancements

1. **Additional Data Sources**
   - Support for Polygon, Tiingo dividend APIs
   - Real-time dividend announcements

2. **Advanced Calculations**
   - After-tax returns
   - Risk-adjusted returns
   - Sector/peer comparisons

3. **International Support**
   - Multi-currency calculations
   - Foreign dividend withholding

## Troubleshooting

### Common Issues

1. **No dividend data found**
   - Check if stock pays dividends
   - Verify date range includes ex-dividend dates

2. **Calculation differences**
   - Adjusted close prices account for splits
   - Dividend amounts are per-share

3. **Performance issues**
   - Check cache hit rates
   - Consider batch processing for multiple tickers

### Debug Mode

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Support

For issues or questions:
1. Check test files for examples
2. Review error messages and logs
3. Verify database connectivity
4. Ensure YFinance access is working