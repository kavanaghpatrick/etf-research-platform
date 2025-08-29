#!/usr/bin/env python3
"""
Simplified dividend analysis focusing on YFinance and AlphaVantage
"""

import os
import json
import pandas as pd
from datetime import datetime, timedelta
import logging
import time

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test configuration
TEST_SYMBOLS = ['AAPL', 'MSFT', 'JNJ']
START_DATE = datetime(2023, 1, 1)
END_DATE = datetime(2024, 12, 31)


def test_yfinance_detailed():
    """Comprehensive test of YFinance dividend capabilities"""
    logger.info("=== Testing YFinance Dividend Capabilities ===")
    
    try:
        import yfinance as yf
        
        results = {
            'source': 'YFinance',
            'test_results': {},
            'capabilities': {}
        }
        
        for symbol in TEST_SYMBOLS:
            logger.info(f"\nTesting {symbol}...")
            ticker = yf.Ticker(symbol)
            
            # Test 1: Basic dividends
            logger.info("1. Testing .dividends property")
            dividends = ticker.dividends
            if not dividends.empty:
                recent_divs = dividends.tail(10)
                logger.info(f"   - Found {len(dividends)} total dividends")
                logger.info(f"   - Date range: {dividends.index.min()} to {dividends.index.max()}")
                logger.info(f"   - Recent dividends:\n{recent_divs}")
                
                results['test_results'][f'{symbol}_dividends'] = {
                    'count': len(dividends),
                    'recent': recent_divs.to_dict(),
                    'format': 'pandas.Series with Date index'
                }
            
            # Test 2: Actions (dividends + splits)
            logger.info("2. Testing .actions property")
            actions = ticker.actions
            if not actions.empty:
                div_actions = actions[actions['Dividends'] > 0]
                logger.info(f"   - Found {len(div_actions)} dividend actions")
                logger.info(f"   - Columns: {list(actions.columns)}")
                
                results['test_results'][f'{symbol}_actions'] = {
                    'dividend_count': len(div_actions),
                    'columns': list(actions.columns),
                    'sample': div_actions.tail(5).to_dict()
                }
            
            # Test 3: History with dividends
            logger.info("3. Testing .history(actions=True)")
            history = ticker.history(start=START_DATE, end=END_DATE, actions=True)
            div_cols = [col for col in history.columns if 'Dividend' in col]
            if div_cols:
                div_days = history[history['Dividends'] > 0]
                logger.info(f"   - Dividend column found: {div_cols}")
                logger.info(f"   - Days with dividends: {len(div_days)}")
                if not div_days.empty:
                    logger.info(f"   - Sample:\n{div_days[['Close', 'Dividends']].tail()}")
                    
            # Test 4: Info for dividend metrics
            logger.info("4. Testing .info for dividend metrics")
            info = ticker.info
            div_info = {
                'dividendRate': info.get('dividendRate'),
                'dividendYield': info.get('dividendYield'),
                'exDividendDate': info.get('exDividendDate'),
                'payoutRatio': info.get('payoutRatio'),
                'fiveYearAvgDividendYield': info.get('fiveYearAvgDividendYield'),
                'trailingAnnualDividendRate': info.get('trailingAnnualDividendRate'),
                'trailingAnnualDividendYield': info.get('trailingAnnualDividendYield')
            }
            logger.info(f"   - Dividend info: {div_info}")
            
            results['test_results'][f'{symbol}_info'] = div_info
            
            time.sleep(0.5)
            
        # Summary of capabilities
        results['capabilities'] = {
            'endpoints': [
                '.dividends - Historical dividend payments',
                '.actions - Dividends and stock splits',
                '.history(actions=True) - Price data with dividend column',
                '.info - Current dividend metrics and yields'
            ],
            'data_format': 'pandas DataFrame/Series',
            'fields': [
                'Date (index)',
                'Dividend amount',
                'Dividend yield',
                'Ex-dividend date',
                'Payout ratio'
            ],
            'advantages': [
                'No API key required',
                'Comprehensive historical data',
                'Multiple access methods',
                'Integration with price data',
                'Dividend-adjusted prices available'
            ],
            'limitations': [
                'No dividend announcements/forecasts',
                'Limited rate limiting protection',
                'No payment dates (only ex-dates)',
                'May be blocked by Yahoo Finance'
            ]
        }
        
        return results
        
    except Exception as e:
        logger.error(f"YFinance test failed: {e}")
        return {'error': str(e)}


def test_alphavantage_detailed():
    """Test AlphaVantage dividend capabilities"""
    logger.info("\n=== Testing AlphaVantage Dividend Capabilities ===")
    
    api_key = os.getenv('ALPHA_VANTAGE_API_KEY', 'demo')
    
    try:
        import requests
        
        results = {
            'source': 'AlphaVantage',
            'test_results': {},
            'capabilities': {}
        }
        
        # Test with demo key
        symbol = 'IBM' if api_key == 'demo' else TEST_SYMBOLS[0]
        
        logger.info(f"Testing TIME_SERIES_DAILY_ADJUSTED for {symbol}")
        
        url = "https://www.alphavantage.co/query"
        params = {
            'function': 'TIME_SERIES_DAILY_ADJUSTED',
            'symbol': symbol,
            'outputsize': 'full',
            'apikey': api_key
        }
        
        response = requests.get(url, params=params, timeout=30)
        data = response.json()
        
        if 'Time Series (Daily)' in data:
            time_series = data['Time Series (Daily)']
            
            # Find dividend entries
            dividend_dates = []
            sample_data = list(time_series.items())[:100]  # Check recent 100 days
            
            for date, values in sample_data:
                div_amount = float(values.get('7. dividend amount', 0))
                if div_amount > 0:
                    dividend_dates.append({
                        'date': date,
                        'dividend': div_amount,
                        'close': float(values['4. close']),
                        'adj_close': float(values['5. adjusted close'])
                    })
            
            logger.info(f"Found {len(dividend_dates)} dividends in recent data")
            if dividend_dates:
                logger.info(f"Sample dividend entries:")
                for div in dividend_dates[:3]:
                    logger.info(f"  {div}")
                    
            results['test_results'] = {
                'symbol': symbol,
                'dividend_count': len(dividend_dates),
                'sample_dividends': dividend_dates[:5],
                'data_fields': list(values.keys()) if time_series else []
            }
            
        elif 'Note' in data:
            logger.warning(f"API limit reached: {data['Note']}")
            results['test_results'] = {'error': 'Rate limit', 'message': data['Note']}
        else:
            logger.error(f"Unexpected response: {list(data.keys())}")
            results['test_results'] = {'error': 'Unexpected response', 'keys': list(data.keys())}
            
        # Capabilities summary
        results['capabilities'] = {
            'endpoints': [
                'TIME_SERIES_DAILY_ADJUSTED - Daily prices with dividend amounts'
            ],
            'data_format': 'JSON',
            'fields': [
                '7. dividend amount',
                '5. adjusted close (dividend-adjusted)',
                'Standard OHLCV data'
            ],
            'advantages': [
                'Free tier available',
                'Dividend amount included in daily data',
                'Adjusted prices provided',
                'Good historical coverage'
            ],
            'limitations': [
                'Very strict rate limits (5/min, 100/day)',
                'Must parse daily data to extract dividends',
                'No dedicated dividend endpoint',
                'No forward-looking dividend data',
                'Only ex-dividend date available'
            ]
        }
        
        return results
        
    except Exception as e:
        logger.error(f"AlphaVantage test failed: {e}")
        return {'error': str(e)}


def create_analysis_report():
    """Create comprehensive analysis report"""
    
    # Run tests
    yfinance_results = test_yfinance_detailed()
    alphavantage_results = test_alphavantage_detailed()
    
    # Create report
    report = f"""# Dividend Data Source Analysis Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

This analysis examines dividend data capabilities for financial data APIs, focusing on:
- YFinance (no API key required)
- AlphaVantage (free tier available)
- Tiingo (requires API key)
- Finnhub (requires API key)
- Polygon (requires API key)

## Detailed Analysis

### 1. YFinance

**Overview**: Most comprehensive free option for dividend data

**Capabilities:**
```json
{json.dumps(yfinance_results.get('capabilities', {}), indent=2)}
```

**Key Features:**
- Multiple ways to access dividend data (.dividends, .actions, .history)
- Historical dividends going back many years
- Integration with price data for total return calculations
- Current dividend metrics (yield, rate, payout ratio)

**Code Examples:**

```python
import yfinance as yf

# Method 1: Direct dividend history
ticker = yf.Ticker('AAPL')
dividends = ticker.dividends  # Returns pandas Series

# Method 2: Dividends with stock splits
actions = ticker.actions
dividend_payments = actions[actions['Dividends'] > 0]

# Method 3: Price history with dividends
history = ticker.history(start='2023-01-01', end='2024-12-31', actions=True)
dividend_days = history[history['Dividends'] > 0]

# Method 4: Current dividend metrics
info = ticker.info
current_yield = info.get('dividendYield')  # Current yield
forward_rate = info.get('dividendRate')    # Forward annual dividend
```

### 2. AlphaVantage

**Overview**: Good alternative with free tier but strict limits

**Capabilities:**
```json
{json.dumps(alphavantage_results.get('capabilities', {}), indent=2)}
```

**Code Example:**

```python
import requests
import pandas as pd

# Fetch adjusted daily data
params = {
    'function': 'TIME_SERIES_DAILY_ADJUSTED',
    'symbol': 'AAPL',
    'outputsize': 'full',
    'apikey': YOUR_KEY
}

response = requests.get('https://www.alphavantage.co/query', params=params)
data = response.json()

# Extract dividends
dividends = []
for date, values in data['Time Series (Daily)'].items():
    div = float(values.get('7. dividend amount', 0))
    if div > 0:
        dividends.append({'date': pd.to_datetime(date), 'amount': div})
```

### 3. Tiingo (Requires API Key)

**Endpoints:**
- `/tiingo/fundamentals/{ticker}/dividends` - Dedicated dividend endpoint
- `/tiingo/daily/{ticker}/prices` - Daily prices with divCash field

**Advantages:**
- Dedicated dividend endpoint
- Good documentation
- Reasonable rate limits (1000/month free)

**Code Example:**
```python
import requests

headers = {'Authorization': f'Token {TIINGO_KEY}'}
url = f'https://api.tiingo.com/tiingo/fundamentals/AAPL/dividends'
dividends = requests.get(url, headers=headers).json()
```

### 4. Finnhub (Requires API Key)

**Endpoints:**
- `stock_dividends` - Historical dividend data

**Advantages:**
- Clean API design
- 60 calls/minute on free tier

**Code Example:**
```python
import finnhub

client = finnhub.Client(api_key=FINNHUB_KEY)
dividends = client.stock_dividends('AAPL', _from='2023-01-01', to='2024-12-31')
```

### 5. Polygon (Requires API Key)

**Endpoints:**
- `/v3/reference/dividends` - Comprehensive dividend data

**Advantages:**
- Professional-grade data
- Includes payment dates and record dates
- Good for production use

**Code Example:**
```python
from polygon import RESTClient

client = RESTClient(POLYGON_KEY)
dividends = list(client.list_dividends(
    ticker='AAPL',
    ex_dividend_date_gte='2023-01-01',
    ex_dividend_date_lte='2024-12-31'
))
```

## Comparison Matrix

| Feature | YFinance | AlphaVantage | Tiingo | Finnhub | Polygon |
|---------|----------|--------------|--------|---------|---------|
| Free Tier | Yes (No key) | Yes (100/day) | Yes (1000/mo) | Yes (60/min) | Yes (5/min) |
| Dividend Endpoint | Multiple | In daily data | Dedicated | Dedicated | Dedicated |
| Historical Data | Excellent | Good | Good | Limited | Good |
| Ex-Dividend Date | Yes | Yes | Yes | Yes | Yes |
| Payment Date | No | No | Yes | Limited | Yes |
| Dividend Yield | Yes | No | No | No | No |
| Rate Limits | Unofficial | Strict | Moderate | Moderate | Strict |
| Data Format | DataFrame | JSON | JSON | JSON | Objects |

## Implementation Recommendations

### For Production Use:
1. **Primary Source**: YFinance
   - No API key required
   - Most comprehensive data
   - Multiple access patterns

2. **Fallback Source**: AlphaVantage
   - Good for verification
   - Different data provider

3. **Premium Option**: Polygon or Tiingo
   - Better reliability
   - More metadata

### Caching Strategy:
```python
# Dividend data changes infrequently - cache aggressively
cache_duration = {
    'historical_dividends': 7 * 24 * 3600,  # 1 week
    'current_metrics': 24 * 3600,           # 1 day
    'dividend_calendar': 24 * 3600          # 1 day
}
```

### Error Handling:
```python
def get_dividends_with_fallback(symbol, start_date, end_date):
    # Try YFinance first
    try:
        ticker = yf.Ticker(symbol)
        return ticker.dividends[start_date:end_date]
    except:
        pass
    
    # Fallback to AlphaVantage
    try:
        return fetch_alphavantage_dividends(symbol, start_date, end_date)
    except:
        pass
    
    # Return empty if all fail
    return pd.Series(dtype=float)
```

## Conclusion

**Best Overall**: YFinance
- Free, comprehensive, multiple access methods
- Best for most use cases

**Best Premium**: Polygon
- Professional data quality
- Comprehensive dividend metadata

**Best Free Alternative**: AlphaVantage
- Good data but strict limits
- Useful for verification

"""
    
    # Save report
    with open('dividend_source_analysis.md', 'w') as f:
        f.write(report)
        
    # Save raw results
    results = {
        'yfinance': yfinance_results,
        'alphavantage': alphavantage_results,
        'generated': datetime.now().isoformat()
    }
    
    with open('dividend_test_results.json', 'w') as f:
        json.dump(results, f, indent=2, default=str)
        
    logger.info("\n=== Analysis Complete ===")
    logger.info("Files created:")
    logger.info("- dividend_source_analysis.md")
    logger.info("- dividend_test_results.json")
    
    return report


if __name__ == "__main__":
    report = create_analysis_report()
    print("\n" + "="*50)
    print("ANALYSIS COMPLETE")
    print("="*50)