# YFinance Dividend Functionality

## Overview

The YFinanceSource class has been extended with comprehensive dividend and corporate action fetching capabilities. These new methods integrate seamlessly with the existing caching system and follow the same error handling and rate limiting patterns.

## New Methods

### 1. `fetch_dividends(ticker, start_date, end_date)`

Fetches dividend data for a specific ticker within a date range.

**Parameters:**
- `ticker` (str): Stock symbol
- `start_date` (str or datetime): Start date for dividend data
- `end_date` (str or datetime): End date for dividend data

**Returns:**
- DataFrame with columns matching the dividends table schema:
  - `symbol`: Stock ticker
  - `ex_date`: Ex-dividend date
  - `dividend_amount`: Dividend amount per share
  - `dividend_type`: Type of dividend (default: 'regular')
  - `currency`: Currency (default: 'USD')
  - `adjustment_factor`: Split adjustment factor
  - `source`: Data source ('YFinance')

**Example:**
```python
from yfinance_source import YFinanceSource
from datetime import datetime, timedelta

yf = YFinanceSource()
end_date = datetime.now()
start_date = end_date - timedelta(days=365)

dividends = yf.fetch_dividends('AAPL', start_date, end_date)
print(f"Found {len(dividends)} dividends totaling ${dividends['dividend_amount'].sum():.2f}")
```

### 2. `get_dividend_calendar(ticker)`

Retrieves the complete dividend history for a ticker with inferred payment frequency.

**Parameters:**
- `ticker` (str): Stock symbol

**Returns:**
- DataFrame with dividend calendar including:
  - All columns from `fetch_dividends()`
  - `payment_frequency`: Inferred frequency ('monthly', 'quarterly', 'semi_annual', 'annual', 'irregular')

**Example:**
```python
calendar = yf.get_dividend_calendar('SPY')
print(f"SPY pays dividends {calendar['payment_frequency'].iloc[0]}")
print(f"Total historical dividends: {len(calendar)}")
```

### 3. `fetch_splits(ticker, start_date, end_date)`

Fetches stock split data within a date range.

**Parameters:**
- `ticker` (str): Stock symbol
- `start_date` (str or datetime): Start date
- `end_date` (str or datetime): End date

**Returns:**
- DataFrame with columns matching the corporate_actions table schema:
  - `symbol`: Stock ticker
  - `ex_date`: Split ex-date
  - `action_type`: 'split' or 'reverse_split'
  - `ratio_from`: Original share count
  - `ratio_to`: New share count
  - `description`: Human-readable description
  - `source`: Data source ('YFinance')

**Example:**
```python
splits = yf.fetch_splits('AAPL', '2020-01-01', '2024-01-01')
for _, split in splits.iterrows():
    print(f"{split['ex_date'].date()}: {split['description']}")
```

### 4. `get_all_corporate_actions(ticker)`

Retrieves all corporate actions (currently splits) for a ticker.

**Parameters:**
- `ticker` (str): Stock symbol

**Returns:**
- DataFrame with all corporate actions

**Example:**
```python
actions = yf.get_all_corporate_actions('GOOGL')
print(f"Found {len(actions)} corporate actions")
```

## Integration with Cached Data System

The dividend methods follow the same patterns as price data fetching:

1. **Rate Limiting**: All methods respect the configured rate limits
2. **Retry Logic**: Automatic retry with exponential backoff for transient failures
3. **Error Handling**: Consistent error handling with proper logging
4. **Data Validation**: Returns empty DataFrames for missing data (never None)

## Usage Examples

### Calculate Trailing 12-Month Yield

```python
from datetime import datetime, timedelta

# Get price and dividend data
ticker = 'VIG'
end_date = datetime.now()
start_date = end_date - timedelta(days=365)

price_data = yf.fetch_data(ticker, end_date, end_date)
dividends = yf.fetch_dividends(ticker, start_date, end_date)

if not price_data.empty and not dividends.empty:
    current_price = price_data.iloc[0]['Close']
    ttm_dividends = dividends['dividend_amount'].sum()
    yield_pct = (ttm_dividends / current_price) * 100
    print(f"{ticker} TTM Yield: {yield_pct:.2f}%")
```

### Analyze Dividend Growth

```python
# Get full dividend history
calendar = yf.get_dividend_calendar('JNJ')

# Group by year
calendar['year'] = pd.to_datetime(calendar['ex_date']).dt.year
annual_divs = calendar.groupby('year')['dividend_amount'].sum()

# Calculate year-over-year growth
for year in annual_divs.index[1:]:
    growth = ((annual_divs[year] - annual_divs[year-1]) / annual_divs[year-1]) * 100
    print(f"{year}: ${annual_divs[year]:.2f} ({growth:+.1f}% YoY)")
```

### Handle Split-Adjusted Dividends

```python
# Get dividends and splits
ticker = 'AAPL'
dividends = yf.fetch_dividends(ticker, '2010-01-01', '2024-01-01')
splits = yf.fetch_splits(ticker, '2010-01-01', '2024-01-01')

print(f"Raw dividends: {len(dividends)}")
print(f"Stock splits: {len(splits)}")

# YFinance provides split-adjusted dividend data by default
# The adjustment_factor field tracks cumulative adjustments
```

## Error Handling

All methods handle common error cases gracefully:

```python
# Invalid ticker - returns empty DataFrame
bad_dividends = yf.fetch_dividends('INVALID', '2023-01-01', '2024-01-01')
assert bad_dividends.empty

# No dividends in range - returns empty DataFrame  
no_divs = yf.fetch_dividends('TSLA', '2023-01-01', '2024-01-01')
assert no_divs.empty

# Network errors - automatic retry with backoff
# Rate limits - automatic throttling
```

## Performance Considerations

1. **Batch Operations**: When fetching data for multiple tickers, use appropriate delays:
   ```python
   for ticker in tickers:
       dividends = yf.fetch_dividends(ticker, start_date, end_date)
       # Process dividends
       time.sleep(0.5)  # Be respectful of the API
   ```

2. **Caching**: Consider caching dividend data locally as it changes infrequently:
   ```python
   # Dividends typically announced quarterly
   # Cache for 1-7 days is reasonable
   ```

3. **Date Ranges**: YFinance may have limits on historical data:
   - Most tickers: Full history available
   - Some international tickers: Limited history
   - Delisted tickers: May not be available

## Limitations

1. **Dividend Types**: YFinance doesn't distinguish between regular and special dividends
2. **Payment Dates**: Only ex-dividend dates are available (not payment or record dates)
3. **Tax Information**: No tax characterization (qualified vs non-qualified)
4. **Currency**: Assumes USD for all dividends
5. **Forecasts**: No forward-looking dividend estimates

## Best Practices

1. Always check for empty DataFrames before processing
2. Use appropriate date ranges to minimize API calls
3. Implement local caching for dividend data
4. Combine with price data for total return calculations
5. Monitor logs for rate limiting or data quality issues