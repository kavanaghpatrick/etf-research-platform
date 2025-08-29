# Dividend Data Source Analysis Report

Generated: 2025-07-13

## Executive Summary

This report provides a comprehensive analysis of dividend data capabilities across 5 major financial data sources:
1. **YFinance** - Free, no API key required
2. **AlphaVantage** - Free tier with strict limits
3. **Tiingo** - Requires API key, good documentation
4. **Finnhub** - Clean API design, moderate limits
5. **Polygon** - Professional-grade, comprehensive data

## Detailed Analysis by Source

### 1. YFinance

**Overview**: Most comprehensive free option for dividend data

**Test Results**:
- Successfully retrieved dividend data for AAPL, MSFT, JNJ
- AAPL: 87 dividends from 1987-2025
- MSFT: 86 dividends from 2003-2025
- JNJ: 254 dividends from 1962-2025

**Available Endpoints**:
1. `.dividends` - Returns pandas Series with historical dividend payments
2. `.actions` - Returns DataFrame with dividends and stock splits
3. `.history(actions=True)` - Price data with dividend column
4. `.info` - Current dividend metrics (yield, rate, payout ratio)

**Data Fields**:
- Date (index)
- Dividend amount
- Current dividend yield
- Forward dividend rate
- Ex-dividend date
- Payout ratio
- 5-year average yield

**Code Examples**:

```python
import yfinance as yf

# Method 1: Direct dividend history
ticker = yf.Ticker('AAPL')
dividends = ticker.dividends  # Returns pandas Series indexed by date

# Method 2: Dividends with stock splits
actions = ticker.actions
dividend_payments = actions[actions['Dividends'] > 0]

# Method 3: Price history with dividends
history = ticker.history(start='2023-01-01', end='2024-12-31', actions=True)
dividend_days = history[history['Dividends'] > 0]

# Method 4: Current dividend metrics
info = ticker.info
current_yield = info.get('dividendYield')  # Current yield (0.0051 = 0.51%)
forward_rate = info.get('dividendRate')    # Forward annual dividend ($1.04)
ex_date = info.get('exDividendDate')       # Unix timestamp
payout_ratio = info.get('payoutRatio')     # 0.1558 = 15.58%
```

**Advantages**:
- No API key required
- Comprehensive historical data (decades)
- Multiple access methods
- Integration with price data
- Current dividend metrics available
- Returns data in pandas format

**Limitations**:
- No dividend announcements/forecasts
- No payment dates (only ex-dates)
- Unofficial API (may break)
- Rate limiting not transparent
- May be blocked by Yahoo Finance

### 2. AlphaVantage

**Overview**: Good alternative with free tier but very strict limits

**Test Results**:
- Successfully tested with demo key (IBM data)
- Found dividend data embedded in daily adjusted prices

**Available Endpoints**:
- `TIME_SERIES_DAILY_ADJUSTED` - Daily OHLCV with dividend amounts

**Data Fields**:
- `7. dividend amount` - Dividend paid on ex-date
- `5. adjusted close` - Close price adjusted for dividends
- Standard OHLCV fields

**Code Example**:

```python
import requests
import pandas as pd

# Fetch adjusted daily data with dividends
url = "https://www.alphavantage.co/query"
params = {
    'function': 'TIME_SERIES_DAILY_ADJUSTED',
    'symbol': 'AAPL',
    'outputsize': 'full',
    'apikey': YOUR_API_KEY
}

response = requests.get(url, params=params)
data = response.json()

# Extract dividend data
dividends = []
for date, values in data['Time Series (Daily)'].items():
    div_amount = float(values.get('7. dividend amount', 0))
    if div_amount > 0:
        dividends.append({
            'date': pd.to_datetime(date),
            'amount': div_amount,
            'adj_close': float(values['5. adjusted close'])
        })

df_dividends = pd.DataFrame(dividends)
```

**Advantages**:
- Free tier available
- Good historical coverage
- Adjusted prices included
- Reliable data quality

**Limitations**:
- Very strict rate limits (5 calls/min, 100/day)
- Must parse daily data to extract dividends
- No dedicated dividend endpoint
- No forward-looking data
- Only ex-dividend date available

### 3. Tiingo

**Overview**: Modern API with dedicated dividend endpoint

**Available Endpoints**:
- `/tiingo/fundamentals/{ticker}/dividends` - Dedicated dividend data
- `/tiingo/daily/{ticker}/prices` - Daily prices with `divCash` field

**Data Fields**:
- Ex-dividend date
- Payment date
- Record date
- Dividend amount
- Dividend type
- Currency

**Code Example**:

```python
import requests

# Get dividend history
headers = {'Authorization': f'Token {TIINGO_KEY}'}
url = f'https://api.tiingo.com/tiingo/fundamentals/AAPL/dividends'
response = requests.get(url, headers=headers)
dividends = response.json()

# Get daily prices with dividends
url = f'https://api.tiingo.com/tiingo/daily/AAPL/prices'
params = {
    'startDate': '2023-01-01',
    'endDate': '2024-12-31'
}
response = requests.get(url, params=params, headers=headers)
prices = response.json()

# Filter for dividend days
dividend_days = [d for d in prices if d.get('divCash', 0) > 0]
```

**Advantages**:
- Dedicated dividend endpoint
- Clean, modern API
- Good documentation
- Includes payment dates
- 1000 requests/month free

**Limitations**:
- Requires API key
- Limited historical data on free tier
- No dividend yield calculations

### 4. Finnhub

**Overview**: Simple, clean API for basic dividend data

**Available Endpoints**:
- `stock_dividends` - Historical dividend data

**Data Fields**:
- Symbol
- Date (ex-dividend)
- Amount
- Currency
- Adjusted amount

**Code Example**:

```python
import finnhub

# Initialize client
client = finnhub.Client(api_key=FINNHUB_KEY)

# Get dividend history
dividends = client.stock_dividends(
    'AAPL',
    _from='2023-01-01',
    to='2024-12-31'
)

# Process results
for div in dividends:
    print(f"Ex-Date: {div['date']}")
    print(f"Amount: ${div['amount']}")
    print(f"Currency: {div['currency']}")
```

**Advantages**:
- Clean, simple API
- 60 calls/minute on free tier
- Well-documented
- Consistent data format

**Limitations**:
- Basic dividend info only
- Limited to 2 years history
- No dividend metrics
- No payment dates on free tier

### 5. Polygon

**Overview**: Professional-grade data with comprehensive dividend information

**Available Endpoints**:
- `/v3/reference/dividends` - Comprehensive dividend data

**Data Fields**:
- Ex-dividend date
- Payment date
- Record date
- Declaration date
- Cash amount
- Frequency
- Dividend type

**Code Example**:

```python
from polygon import RESTClient

# Initialize client
client = RESTClient(api_key=POLYGON_KEY)

# Get dividend history
dividends = list(client.list_dividends(
    ticker='AAPL',
    ex_dividend_date_gte='2023-01-01',
    ex_dividend_date_lte='2024-12-31',
    limit=100
))

# Process dividends
for div in dividends:
    print(f"Ex-Date: {div.ex_dividend_date}")
    print(f"Pay Date: {div.pay_date}")
    print(f"Amount: ${div.cash_amount}")
    print(f"Frequency: {div.frequency}")
```

**Advantages**:
- Professional data quality
- Comprehensive dividend details
- All important dates included
- Good for production use
- RESTful API design

**Limitations**:
- 5 API calls/minute on free tier
- Requires separate dividend calls
- No calculated metrics
- Limited free tier access

## Comparison Matrix

| Feature | YFinance | AlphaVantage | Tiingo | Finnhub | Polygon |
|---------|----------|--------------|--------|---------|---------|
| **Free Tier** | Yes (No key) | Yes (100/day) | Yes (1000/mo) | Yes (60/min) | Yes (5/min) |
| **API Key Required** | No | Yes | Yes | Yes | Yes |
| **Dividend Endpoint** | Multiple | In daily data | Dedicated | Dedicated | Dedicated |
| **Historical Coverage** | Excellent | Good | Good | 2 years | Good |
| **Data Format** | DataFrame | JSON | JSON | JSON | Objects |
| **Ex-Dividend Date** | Yes | Yes | Yes | Yes | Yes |
| **Payment Date** | No | No | Yes | Limited | Yes |
| **Record Date** | No | No | Yes | No | Yes |
| **Declaration Date** | No | No | No | No | Yes |
| **Dividend Yield** | Yes | No | No | No | No |
| **Dividend Rate** | Yes | No | No | No | No |
| **Payout Ratio** | Yes | No | No | No | No |
| **Rate Limits** | Hidden | Very Strict | Moderate | Moderate | Strict |
| **Best For** | Free/Hobby | Verification | Production | Simple Apps | Enterprise |

## Implementation Recommendations

### 1. For Development/Hobby Projects
**Primary**: YFinance
- No API key needed
- Comprehensive data
- Easy to use

**Fallback**: AlphaVantage
- Free tier available
- Good for verification

### 2. For Production Applications
**Primary**: Polygon or Tiingo
- Better reliability
- Professional support
- More metadata

**Fallback**: YFinance
- As backup source
- For historical data

### 3. Hybrid Approach (Recommended)

```python
class DividendDataService:
    def __init__(self):
        self.yfinance = YFinanceSource()
        self.alphavantage = AlphaVantageSource(api_key)
        self.cache = DividendCache()
    
    def get_dividends(self, symbol, start_date, end_date):
        # Check cache first (dividends change infrequently)
        cached = self.cache.get(symbol, start_date, end_date)
        if cached:
            return cached
        
        # Try YFinance first (no rate limits)
        try:
            data = self.yfinance.get_dividends(symbol, start_date, end_date)
            if not data.empty:
                self.cache.store(symbol, data)
                return data
        except:
            pass
        
        # Fallback to AlphaVantage
        try:
            data = self.alphavantage.get_dividends(symbol, start_date, end_date)
            self.cache.store(symbol, data)
            return data
        except:
            pass
        
        return pd.DataFrame()
```

### 4. Caching Strategy

Since dividend data changes infrequently:
- Cache historical dividends: 7-30 days
- Cache current metrics: 1 day
- Cache dividend calendar: 1 day
- Store in SQLite for persistence

```python
# Example cache durations
CACHE_DURATIONS = {
    'historical_dividends': 7 * 24 * 3600,  # 1 week
    'current_metrics': 24 * 3600,           # 1 day
    'dividend_calendar': 24 * 3600,         # 1 day
    'company_info': 30 * 24 * 3600          # 30 days
}
```

## Conclusion

### Best Overall: **YFinance**
- Free, no API key required
- Most comprehensive dividend data
- Multiple access methods
- Best for most use cases

### Best Free Alternative: **AlphaVantage**
- Reliable data quality
- Good historical coverage
- Very limited rate limits

### Best Premium Option: **Polygon**
- Professional data quality
- All dividend dates included
- Best for production use

### Implementation Priority:
1. Start with YFinance for immediate access
2. Add AlphaVantage for verification
3. Consider Polygon/Tiingo for production
4. Implement aggressive caching
5. Store dividend calendar for efficiency

## Code Repository Structure

```
api/
├── dividend_service.py        # Main dividend data service
├── sources/
│   ├── yfinance_dividend.py  # YFinance dividend implementation
│   ├── alphavantage_dividend.py
│   ├── tiingo_dividend.py
│   ├── finnhub_dividend.py
│   └── polygon_dividend.py
├── models/
│   └── dividend.py           # Dividend data models
└── cache/
    └── dividend_cache.py     # Caching implementation
```