#!/usr/bin/env python3
"""
Comprehensive test script to analyze dividend data capabilities across all 5 data sources.
Tests YFinance, AlphaVantage, Tiingo, Finnhub, and Polygon for dividend data availability.
"""

import os
import sys
import json
import pandas as pd
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Any
import time

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Test configuration
TEST_SYMBOLS = ['AAPL', 'MSFT', 'JNJ', 'SPY', 'VIG']  # Mix of stocks and ETFs
START_DATE = datetime(2023, 1, 1)
END_DATE = datetime(2024, 12, 31)

# API Keys (load from environment or use test keys)
ALPHA_VANTAGE_KEY = os.getenv('ALPHA_VANTAGE_API_KEY', 'demo')
TIINGO_KEY = os.getenv('TIINGO_API_KEY', '')
FINNHUB_KEY = os.getenv('FINNHUB_API_KEY', '')
POLYGON_KEY = os.getenv('POLYGON_API_KEY', '')


def test_yfinance_dividends():
    """Test YFinance dividend capabilities"""
    results = {
        'source': 'YFinance',
        'endpoints_tested': [],
        'data_formats': {},
        'fields_available': [],
        'historical_availability': {},
        'limitations': [],
        'code_examples': {},
        'test_results': {}
    }
    
    try:
        import yfinance as yf
        
        for symbol in TEST_SYMBOLS:
            logger.info(f"Testing YFinance dividends for {symbol}")
            ticker = yf.Ticker(symbol)
            
            # Test 1: .dividends property
            try:
                dividends = ticker.dividends
                results['endpoints_tested'].append('.dividends property')
                
                if not dividends.empty:
                    results['data_formats'][symbol] = {
                        'dividends': {
                            'type': 'pandas.Series',
                            'index': 'Date',
                            'value': 'Dividend Amount',
                            'sample': dividends.tail(5).to_dict()
                        }
                    }
                    results['fields_available'] = ['Date', 'Dividend Amount']
                    results['historical_availability'][symbol] = {
                        'start': str(dividends.index.min()),
                        'end': str(dividends.index.max()),
                        'count': len(dividends)
                    }
                    results['test_results'][symbol] = 'Success'
                else:
                    results['test_results'][symbol] = 'No dividend data'
                    
            except Exception as e:
                results['test_results'][symbol] = f"Error: {str(e)}"
            
            # Test 2: .actions property (includes dividends and splits)
            try:
                actions = ticker.actions
                results['endpoints_tested'].append('.actions property')
                
                if not actions.empty and 'Dividends' in actions.columns:
                    dividend_actions = actions[actions['Dividends'] > 0]['Dividends']
                    results['data_formats'][symbol]['actions'] = {
                        'type': 'pandas.DataFrame',
                        'columns': list(actions.columns),
                        'dividend_count': len(dividend_actions),
                        'sample': actions.tail(5).to_dict()
                    }
                    
            except Exception as e:
                logger.warning(f"Actions test failed for {symbol}: {e}")
            
            # Test 3: .history() with actions=True
            try:
                history = ticker.history(start=START_DATE, end=END_DATE, actions=True)
                if 'Dividends' in history.columns:
                    dividend_days = history[history['Dividends'] > 0]
                    results['endpoints_tested'].append('.history(actions=True)')
                    results['data_formats'][symbol]['history_dividends'] = {
                        'type': 'pandas.DataFrame with dividends column',
                        'dividend_days': len(dividend_days),
                        'sample': dividend_days[['Close', 'Dividends']].tail(5).to_dict()
                    }
                    
            except Exception as e:
                logger.warning(f"History test failed for {symbol}: {e}")
                
            time.sleep(0.5)  # Rate limiting
            
        # Code examples
        results['code_examples'] = {
            'basic_dividends': """
import yfinance as yf

# Get dividend data
ticker = yf.Ticker('AAPL')
dividends = ticker.dividends

# Filter by date range
dividends_filtered = dividends['2023-01-01':'2024-12-31']

# Get dividend yield
info = ticker.info
dividend_yield = info.get('dividendYield', 0)
""",
            'with_actions': """
# Get dividends with stock splits
actions = ticker.actions
dividend_events = actions[actions['Dividends'] > 0]

# Get forward dividend info
forward_div = ticker.info.get('dividendRate')
ex_div_date = ticker.info.get('exDividendDate')
""",
            'historical_with_dividends': """
# Get price history with dividends
history = ticker.history(start='2023-01-01', end='2024-12-31', actions=True)

# Calculate dividend-adjusted returns
history['Dividend_Adjusted_Close'] = history['Close'] + history['Dividends'].cumsum()
"""
        }
        
        # Limitations
        results['limitations'] = [
            "No real-time dividend announcements",
            "Ex-dividend dates not directly available in dividend series",
            "Dividend frequency must be inferred",
            "No dividend forecast data",
            "Free tier has rate limits"
        ]
        
    except ImportError:
        results['test_results']['error'] = "YFinance not installed"
        
    return results


def test_alphavantage_dividends():
    """Test AlphaVantage dividend capabilities"""
    results = {
        'source': 'AlphaVantage',
        'endpoints_tested': [],
        'data_formats': {},
        'fields_available': [],
        'historical_availability': {},
        'limitations': [],
        'code_examples': {},
        'test_results': {}
    }
    
    if not ALPHA_VANTAGE_KEY:
        results['test_results']['error'] = "No API key provided"
        return results
        
    import requests
    
    for symbol in TEST_SYMBOLS[:1]:  # Test only one due to rate limits
        logger.info(f"Testing AlphaVantage dividends for {symbol}")
        
        # Test 1: TIME_SERIES_DAILY_ADJUSTED
        try:
            url = "https://www.alphavantage.co/query"
            params = {
                'function': 'TIME_SERIES_DAILY_ADJUSTED',
                'symbol': symbol,
                'outputsize': 'full',
                'apikey': ALPHA_VANTAGE_KEY
            }
            
            response = requests.get(url, params=params, timeout=30)
            data = response.json()
            
            results['endpoints_tested'].append('TIME_SERIES_DAILY_ADJUSTED')
            
            if 'Time Series (Daily)' in data:
                time_series = data['Time Series (Daily)']
                
                # Check for dividend data
                dividend_dates = []
                for date, values in time_series.items():
                    if '7. dividend amount' in values and float(values['7. dividend amount']) > 0:
                        dividend_dates.append({
                            'date': date,
                            'dividend': float(values['7. dividend amount']),
                            'adj_close': float(values['5. adjusted close'])
                        })
                
                if dividend_dates:
                    results['data_formats'][symbol] = {
                        'daily_adjusted': {
                            'type': 'JSON',
                            'dividend_field': '7. dividend amount',
                            'dividend_count': len(dividend_dates),
                            'sample': dividend_dates[:5]
                        }
                    }
                    results['fields_available'] = [
                        'date', 'dividend amount', 'adjusted close',
                        'open', 'high', 'low', 'close', 'volume'
                    ]
                    results['test_results'][symbol] = f"Success - {len(dividend_dates)} dividends found"
                else:
                    results['test_results'][symbol] = "No dividend data found"
                    
            elif 'Note' in data:
                results['test_results'][symbol] = "Rate limit reached"
                results['limitations'].append("5 API calls/minute, 100 calls/day on free tier")
            else:
                results['test_results'][symbol] = f"Unexpected response: {list(data.keys())}"
                
            time.sleep(12)  # Respect rate limit
            
        except Exception as e:
            results['test_results'][symbol] = f"Error: {str(e)}"
            
    # Code examples
    results['code_examples'] = {
        'daily_adjusted': """
import requests
import pandas as pd

# Fetch daily adjusted data with dividends
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
            'dividend': div_amount
        })

df_dividends = pd.DataFrame(dividends)
"""
    }
    
    # Limitations
    results['limitations'].extend([
        "Very strict rate limits (5/min, 100/day free)",
        "Only ex-dividend date available, not payment date",
        "No dividend announcement data",
        "Requires parsing daily data to extract dividends",
        "No dedicated dividend endpoint"
    ])
    
    return results


def test_tiingo_dividends():
    """Test Tiingo dividend capabilities"""
    results = {
        'source': 'Tiingo',
        'endpoints_tested': [],
        'data_formats': {},
        'fields_available': [],
        'historical_availability': {},
        'limitations': [],
        'code_examples': {},
        'test_results': {}
    }
    
    if not TIINGO_KEY:
        results['test_results']['error'] = "No API key provided"
        return results
        
    import requests
    
    for symbol in TEST_SYMBOLS[:2]:  # Test limited symbols
        logger.info(f"Testing Tiingo dividends for {symbol}")
        
        # Test 1: Fundamentals endpoint (includes dividends)
        try:
            url = f"https://api.tiingo.com/tiingo/fundamentals/{symbol}/dividends"
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'Token {TIINGO_KEY}'
            }
            
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                results['endpoints_tested'].append('fundamentals/dividends')
                
                if data:
                    results['data_formats'][symbol] = {
                        'dividends': {
                            'type': 'JSON array',
                            'record_count': len(data),
                            'sample': data[:5] if len(data) > 5 else data
                        }
                    }
                    
                    # Extract available fields
                    if data:
                        results['fields_available'] = list(data[0].keys())
                        
                    results['test_results'][symbol] = f"Success - {len(data)} dividend records"
                else:
                    results['test_results'][symbol] = "No dividend data"
                    
            else:
                results['test_results'][symbol] = f"HTTP {response.status_code}"
                
            time.sleep(1)  # Rate limiting
            
        except Exception as e:
            results['test_results'][symbol] = f"Error: {str(e)}"
            
        # Test 2: Daily prices with dividends
        try:
            url = f"https://api.tiingo.com/tiingo/daily/{symbol}/prices"
            params = {
                'startDate': START_DATE.strftime('%Y-%m-%d'),
                'endDate': END_DATE.strftime('%Y-%m-%d'),
                'format': 'json'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if dividend data is included
                if data and 'divCash' in data[0]:
                    dividend_days = [d for d in data if d.get('divCash', 0) > 0]
                    results['endpoints_tested'].append('daily/prices (with divCash)')
                    results['data_formats'][symbol]['daily_prices'] = {
                        'has_dividend_field': True,
                        'dividend_field': 'divCash',
                        'dividend_days': len(dividend_days),
                        'sample': dividend_days[:3] if dividend_days else []
                    }
                    
        except Exception as e:
            logger.warning(f"Daily prices test failed: {e}")
            
    # Code examples
    results['code_examples'] = {
        'dividend_endpoint': """
import requests
import pandas as pd

# Get dividend history
url = f"https://api.tiingo.com/tiingo/fundamentals/{symbol}/dividends"
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Token {TIINGO_KEY}'
}

response = requests.get(url, headers=headers)
dividends = response.json()

# Convert to DataFrame
df_dividends = pd.DataFrame(dividends)
""",
        'daily_with_dividends': """
# Get daily prices with dividend info
url = f"https://api.tiingo.com/tiingo/daily/{symbol}/prices"
params = {
    'startDate': '2023-01-01',
    'endDate': '2024-12-31'
}

response = requests.get(url, params=params, headers=headers)
data = response.json()

# Extract dividend payments
dividend_payments = [d for d in data if d.get('divCash', 0) > 0]
"""
    }
    
    # Limitations
    results['limitations'] = [
        "Requires paid subscription for some dividend data",
        "Limited historical dividend data on free tier",
        "1000 requests/month on free tier",
        "No real-time dividend announcements"
    ]
    
    return results


def test_finnhub_dividends():
    """Test Finnhub dividend capabilities"""
    results = {
        'source': 'Finnhub',
        'endpoints_tested': [],
        'data_formats': {},
        'fields_available': [],
        'historical_availability': {},
        'limitations': [],
        'code_examples': {},
        'test_results': {}
    }
    
    if not FINNHUB_KEY:
        results['test_results']['error'] = "No API key provided"
        return results
        
    try:
        import finnhub
        client = finnhub.Client(api_key=FINNHUB_KEY)
        
        for symbol in TEST_SYMBOLS[:2]:  # Limited due to rate limits
            logger.info(f"Testing Finnhub dividends for {symbol}")
            
            # Test 1: Dividends endpoint
            try:
                # Get dividends for the past 2 years
                dividends = client.stock_dividends(
                    symbol, 
                    _from=START_DATE.strftime('%Y-%m-%d'),
                    to=END_DATE.strftime('%Y-%m-%d')
                )
                
                results['endpoints_tested'].append('stock_dividends')
                
                if dividends:
                    results['data_formats'][symbol] = {
                        'dividends': {
                            'type': 'list of dicts',
                            'record_count': len(dividends),
                            'sample': dividends[:5]
                        }
                    }
                    
                    # Extract fields
                    if dividends:
                        results['fields_available'] = list(dividends[0].keys())
                        
                    results['test_results'][symbol] = f"Success - {len(dividends)} dividends"
                else:
                    results['test_results'][symbol] = "No dividend data"
                    
            except Exception as e:
                results['test_results'][symbol] = f"Error: {str(e)}"
                
            time.sleep(3)  # Rate limiting
            
    except ImportError:
        results['test_results']['error'] = "Finnhub library not installed"
        
    # Code examples  
    results['code_examples'] = {
        'basic_dividends': """
import finnhub

client = finnhub.Client(api_key=FINNHUB_KEY)

# Get dividend history
dividends = client.stock_dividends(
    'AAPL',
    _from='2023-01-01',
    to='2024-12-31'
)

# Process dividend data
for div in dividends:
    print(f"Date: {div['date']}, Amount: {div['amount']}")
"""
    }
    
    # Limitations
    results['limitations'] = [
        "60 API calls/minute on free tier",
        "Limited to 2 years of historical data",
        "No dividend forecast data on free tier",
        "Basic dividend info only (amount, date, currency)"
    ]
    
    return results


def test_polygon_dividends():
    """Test Polygon dividend capabilities"""
    results = {
        'source': 'Polygon',
        'endpoints_tested': [],
        'data_formats': {},
        'fields_available': [],
        'historical_availability': {},
        'limitations': [],
        'code_examples': {},
        'test_results': {}
    }
    
    if not POLYGON_KEY:
        results['test_results']['error'] = "No API key provided"
        return results
        
    try:
        from polygon import RESTClient
        client = RESTClient(api_key=POLYGON_KEY)
        
        for symbol in TEST_SYMBOLS[:2]:  # Limited due to rate limits
            logger.info(f"Testing Polygon dividends for {symbol}")
            
            # Test 1: Dividends endpoint
            try:
                # Get dividend data
                dividends = list(client.list_dividends(
                    ticker=symbol,
                    ex_dividend_date_gte=START_DATE.strftime('%Y-%m-%d'),
                    ex_dividend_date_lte=END_DATE.strftime('%Y-%m-%d'),
                    limit=100
                ))
                
                results['endpoints_tested'].append('reference/dividends')
                
                if dividends:
                    results['data_formats'][symbol] = {
                        'dividends': {
                            'type': 'list of dividend objects',
                            'record_count': len(dividends),
                            'sample': [{
                                'ex_date': str(d.ex_dividend_date) if hasattr(d, 'ex_dividend_date') else None,
                                'payment_date': str(d.pay_date) if hasattr(d, 'pay_date') else None,
                                'amount': d.cash_amount if hasattr(d, 'cash_amount') else None
                            } for d in dividends[:5]]
                        }
                    }
                    
                    # Extract available fields
                    if dividends:
                        div_dict = dividends[0].__dict__ if hasattr(dividends[0], '__dict__') else {}
                        results['fields_available'] = list(div_dict.keys())
                        
                    results['test_results'][symbol] = f"Success - {len(dividends)} dividends"
                else:
                    results['test_results'][symbol] = "No dividend data"
                    
            except Exception as e:
                results['test_results'][symbol] = f"Error: {str(e)}"
                
            time.sleep(1)  # Rate limiting
            
    except ImportError:
        results['test_results']['error'] = "Polygon library not installed"
        
    # Code examples
    results['code_examples'] = {
        'list_dividends': """
from polygon import RESTClient

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
    print(f"Payment Date: {div.pay_date}")
    print(f"Amount: ${div.cash_amount}")
""",
        'with_adjustments': """
# Get price data with dividend adjustments
aggs = client.get_aggs(
    ticker='AAPL',
    multiplier=1,
    timespan='day',
    from_='2023-01-01',
    to='2024-12-31',
    adjusted=True  # Prices adjusted for dividends
)
"""
    }
    
    # Limitations
    results['limitations'] = [
        "5 API calls/minute on free tier",
        "Limited historical data on free tier",
        "Requires separate call for dividend data",
        "No dividend yield calculations provided"
    ]
    
    return results


def create_comparison_matrix(all_results: List[Dict]) -> pd.DataFrame:
    """Create a comparison matrix of all sources"""
    comparison_data = []
    
    for result in all_results:
        source = result['source']
        
        # Skip if error
        if 'error' in result.get('test_results', {}):
            continue
            
        comparison_data.append({
            'Source': source,
            'Dividend Endpoints': ', '.join(result.get('endpoints_tested', [])),
            'Fields Available': len(result.get('fields_available', [])),
            'Field Names': ', '.join(result.get('fields_available', [])[:5]) + '...',
            'Data Format': list(result.get('data_formats', {}).values())[0].get('type', 'N/A') if result.get('data_formats') else 'N/A',
            'Historical Data': 'Yes' if result.get('historical_availability') else 'Limited',
            'Rate Limits': next((l for l in result.get('limitations', []) if 'rate' in l.lower() or 'limit' in l.lower()), 'N/A'),
            'Key Limitations': len(result.get('limitations', [])),
            'Success Rate': sum(1 for r in result.get('test_results', {}).values() if 'Success' in str(r)) / len(TEST_SYMBOLS) * 100
        })
        
    return pd.DataFrame(comparison_data)


def main():
    """Run all tests and generate comprehensive report"""
    logger.info("Starting dividend capability analysis for all data sources...")
    
    all_results = []
    
    # Test each source
    logger.info("\n=== Testing YFinance ===")
    yfinance_results = test_yfinance_dividends()
    all_results.append(yfinance_results)
    
    logger.info("\n=== Testing AlphaVantage ===")
    alphavantage_results = test_alphavantage_dividends()
    all_results.append(alphavantage_results)
    
    logger.info("\n=== Testing Tiingo ===")
    tiingo_results = test_tiingo_dividends()
    all_results.append(tiingo_results)
    
    logger.info("\n=== Testing Finnhub ===")
    finnhub_results = test_finnhub_dividends()
    all_results.append(finnhub_results)
    
    logger.info("\n=== Testing Polygon ===")
    polygon_results = test_polygon_dividends()
    all_results.append(polygon_results)
    
    # Create comparison matrix
    comparison_df = create_comparison_matrix(all_results)
    
    # Generate markdown report
    report = f"""# Dividend Data Source Analysis Report

Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Executive Summary

This report analyzes dividend data capabilities across 5 major financial data sources:
- YFinance
- AlphaVantage  
- Tiingo
- Finnhub
- Polygon

## Comparison Matrix

{comparison_df.to_markdown(index=False)}

## Detailed Analysis by Source

"""
    
    for result in all_results:
        source = result['source']
        report += f"\n### {source}\n\n"
        
        report += f"**Endpoints Tested:**\n"
        for endpoint in result.get('endpoints_tested', []):
            report += f"- {endpoint}\n"
            
        report += f"\n**Available Fields:**\n"
        fields = result.get('fields_available', [])
        if fields:
            report += f"- {', '.join(fields)}\n"
        else:
            report += "- No fields documented\n"
            
        report += f"\n**Data Formats:**\n"
        for symbol, formats in result.get('data_formats', {}).items():
            report += f"\n*{symbol}:*\n"
            for format_name, format_info in formats.items():
                report += f"- {format_name}: {format_info.get('type', 'Unknown')}\n"
                if 'record_count' in format_info:
                    report += f"  - Records: {format_info['record_count']}\n"
                    
        report += f"\n**Limitations:**\n"
        for limitation in result.get('limitations', []):
            report += f"- {limitation}\n"
            
        report += f"\n**Code Example:**\n"
        for example_name, code in result.get('code_examples', {}).items():
            report += f"\n*{example_name}:*\n```python{code}\n```\n"
            
    report += """
## Recommendations

1. **For comprehensive dividend data**: Use YFinance as primary source
   - Most complete historical data
   - Multiple access methods (.dividends, .actions, .history)
   - No API key required

2. **For professional/paid use**: Consider Polygon or Tiingo
   - Better rate limits
   - More reliable data
   - Additional dividend metadata

3. **For free tier usage**: YFinance + AlphaVantage combination
   - YFinance for historical data
   - AlphaVantage for verification (with rate limiting)

4. **Implementation Strategy**:
   - Use YFinance as primary source
   - Implement fallback to AlphaVantage for verification
   - Cache dividend data aggressively (changes infrequently)
   - Store dividend calendar for efficient updates
"""
    
    # Save results
    with open('dividend_analysis_report.md', 'w') as f:
        f.write(report)
        
    with open('dividend_analysis_results.json', 'w') as f:
        json.dump(all_results, f, indent=2, default=str)
        
    logger.info("\nAnalysis complete! Results saved to:")
    logger.info("- dividend_analysis_report.md")
    logger.info("- dividend_analysis_results.json")
    
    # Print summary
    print("\n=== SUMMARY ===")
    print(comparison_df.to_string())


if __name__ == "__main__":
    main()