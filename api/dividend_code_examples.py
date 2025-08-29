#!/usr/bin/env python3
"""
Comprehensive code examples for accessing dividend data from all 5 sources.
Each example is self-contained and demonstrates the specific API's capabilities.
"""

import os
from datetime import datetime, timedelta
import pandas as pd
import json


# ==============================================================================
# 1. YFINANCE DIVIDEND EXAMPLES
# ==============================================================================

def yfinance_dividend_examples():
    """Complete examples for YFinance dividend data access"""
    
    import yfinance as yf
    
    # Example 1: Basic dividend history
    def get_dividend_history(symbol='AAPL'):
        """Get complete dividend history for a stock"""
        ticker = yf.Ticker(symbol)
        dividends = ticker.dividends
        
        print(f"\n{symbol} Dividend History:")
        print(f"Total dividends: {len(dividends)}")
        print(f"Date range: {dividends.index.min()} to {dividends.index.max()}")
        print(f"\nLast 5 dividends:")
        print(dividends.tail())
        
        return dividends
    
    # Example 2: Dividend analysis with metrics
    def analyze_dividends(symbol='JNJ'):
        """Analyze dividend patterns and metrics"""
        ticker = yf.Ticker(symbol)
        dividends = ticker.dividends
        info = ticker.info
        
        # Calculate dividend growth
        recent_divs = dividends.tail(8)  # Last 2 years
        if len(recent_divs) > 1:
            growth_rate = (recent_divs.iloc[-1] / recent_divs.iloc[0]) ** (1/(len(recent_divs)-1)) - 1
        else:
            growth_rate = 0
        
        analysis = {
            'symbol': symbol,
            'current_yield': info.get('dividendYield', 0),
            'forward_rate': info.get('dividendRate', 0),
            'payout_ratio': info.get('payoutRatio', 0),
            '5yr_avg_yield': info.get('fiveYearAvgDividendYield', 0),
            'ex_dividend_date': datetime.fromtimestamp(info.get('exDividendDate', 0)),
            'dividend_count': len(dividends),
            'years_of_dividends': (dividends.index.max() - dividends.index.min()).days / 365.25,
            'recent_growth_rate': growth_rate
        }
        
        print(f"\nDividend Analysis for {symbol}:")
        for key, value in analysis.items():
            print(f"{key}: {value}")
        
        return analysis
    
    # Example 3: Total return calculation with dividends
    def calculate_total_return(symbol='SPY', start_date='2020-01-01', end_date='2024-01-01'):
        """Calculate total return including dividends"""
        ticker = yf.Ticker(symbol)
        
        # Get price history with dividends
        history = ticker.history(start=start_date, end=end_date, actions=True)
        
        # Calculate price return
        start_price = history['Close'].iloc[0]
        end_price = history['Close'].iloc[-1]
        price_return = (end_price - start_price) / start_price
        
        # Calculate dividend return
        dividends = history['Dividends'].sum()
        dividend_return = dividends / start_price
        
        # Total return
        total_return = price_return + dividend_return
        
        results = {
            'symbol': symbol,
            'period': f"{start_date} to {end_date}",
            'start_price': round(start_price, 2),
            'end_price': round(end_price, 2),
            'price_return': f"{price_return:.1%}",
            'dividends_received': round(dividends, 2),
            'dividend_return': f"{dividend_return:.1%}",
            'total_return': f"{total_return:.1%}"
        }
        
        print(f"\nTotal Return Analysis for {symbol}:")
        for key, value in results.items():
            print(f"{key}: {value}")
        
        return results
    
    # Example 4: Dividend calendar
    def get_dividend_calendar(symbols=['AAPL', 'MSFT', 'JNJ', 'JPM']):
        """Create a dividend calendar for multiple stocks"""
        calendar = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                if 'exDividendDate' in info and info['exDividendDate']:
                    calendar.append({
                        'symbol': symbol,
                        'ex_date': datetime.fromtimestamp(info['exDividendDate']),
                        'dividend_rate': info.get('dividendRate', 0),
                        'yield': info.get('dividendYield', 0)
                    })
            except:
                pass
        
        # Sort by ex-date
        calendar.sort(key=lambda x: x['ex_date'])
        
        print("\nUpcoming Dividend Calendar:")
        for item in calendar:
            print(f"{item['symbol']}: Ex-date {item['ex_date'].date()}, "
                  f"Rate ${item['dividend_rate']}, Yield {item['yield']:.1%}")
        
        return calendar
    
    # Example 5: Dividend aristocrats screening
    def screen_dividend_aristocrats(symbols=['JNJ', 'KO', 'PG', 'MMM', 'CL']):
        """Screen for dividend aristocrats (25+ years of increases)"""
        aristocrats = []
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                dividends = ticker.dividends
                
                # Group by year
                yearly_divs = dividends.groupby(dividends.index.year).sum()
                
                # Check for consecutive increases
                increases = 0
                for i in range(1, len(yearly_divs)):
                    if yearly_divs.iloc[i] > yearly_divs.iloc[i-1]:
                        increases += 1
                    else:
                        increases = 0
                
                if increases >= 25:
                    info = ticker.info
                    aristocrats.append({
                        'symbol': symbol,
                        'consecutive_increases': increases,
                        'current_yield': info.get('dividendYield', 0),
                        'payout_ratio': info.get('payoutRatio', 0)
                    })
            except:
                pass
        
        print("\nDividend Aristocrats:")
        for stock in aristocrats:
            print(f"{stock['symbol']}: {stock['consecutive_increases']} years, "
                  f"Yield {stock['current_yield']:.1%}")
        
        return aristocrats
    
    # Run all examples
    print("="*60)
    print("YFINANCE DIVIDEND EXAMPLES")
    print("="*60)
    
    get_dividend_history('AAPL')
    analyze_dividends('JNJ')
    calculate_total_return('SPY')
    get_dividend_calendar()
    screen_dividend_aristocrats()


# ==============================================================================
# 2. ALPHAVANTAGE DIVIDEND EXAMPLES
# ==============================================================================

def alphavantage_dividend_examples():
    """Complete examples for AlphaVantage dividend data access"""
    
    import requests
    
    API_KEY = os.getenv('ALPHA_VANTAGE_API_KEY', 'demo')
    BASE_URL = 'https://www.alphavantage.co/query'
    
    # Example 1: Extract dividends from daily adjusted data
    def get_dividends_from_daily(symbol='IBM'):
        """Extract dividend data from TIME_SERIES_DAILY_ADJUSTED"""
        
        params = {
            'function': 'TIME_SERIES_DAILY_ADJUSTED',
            'symbol': symbol,
            'outputsize': 'full',
            'apikey': API_KEY
        }
        
        response = requests.get(BASE_URL, params=params)
        data = response.json()
        
        if 'Time Series (Daily)' not in data:
            print(f"Error: {data.get('Note', 'Unknown error')}")
            return []
        
        # Extract dividends
        dividends = []
        for date, values in data['Time Series (Daily)'].items():
            div_amount = float(values.get('7. dividend amount', 0))
            if div_amount > 0:
                dividends.append({
                    'date': date,
                    'amount': div_amount,
                    'close': float(values['4. close']),
                    'adjusted_close': float(values['5. adjusted close'])
                })
        
        print(f"\n{symbol} Dividends from AlphaVantage:")
        print(f"Found {len(dividends)} dividend payments")
        if dividends:
            print("\nRecent dividends:")
            for div in dividends[:5]:
                print(f"  {div['date']}: ${div['amount']}")
        
        return dividends
    
    # Example 2: Calculate dividend-adjusted returns
    def calculate_adjusted_returns(symbol='IBM', days=252):
        """Calculate returns using adjusted prices"""
        
        params = {
            'function': 'TIME_SERIES_DAILY_ADJUSTED',
            'symbol': symbol,
            'apikey': API_KEY
        }
        
        response = requests.get(BASE_URL, params=params)
        data = response.json()
        
        if 'Time Series (Daily)' not in data:
            return None
        
        # Convert to list and sort
        time_series = data['Time Series (Daily)']
        sorted_dates = sorted(time_series.keys(), reverse=True)[:days]
        
        if len(sorted_dates) < 2:
            return None
        
        # Get start and end adjusted prices
        start_data = time_series[sorted_dates[-1]]
        end_data = time_series[sorted_dates[0]]
        
        start_adj = float(start_data['5. adjusted close'])
        end_adj = float(end_data['5. adjusted close'])
        
        # Calculate return
        total_return = (end_adj - start_adj) / start_adj
        
        print(f"\n{symbol} Adjusted Returns ({days} days):")
        print(f"Start: ${start_adj:.2f} ({sorted_dates[-1]})")
        print(f"End: ${end_adj:.2f} ({sorted_dates[0]})")
        print(f"Total Return: {total_return:.1%}")
        
        return total_return
    
    # Example 3: Dividend frequency detection
    def detect_dividend_frequency(symbol='IBM'):
        """Detect dividend payment frequency"""
        
        dividends = get_dividends_from_daily(symbol)
        
        if len(dividends) < 4:
            return "Insufficient data"
        
        # Calculate days between dividends
        dates = [datetime.strptime(d['date'], '%Y-%m-%d') for d in dividends[:8]]
        intervals = [(dates[i] - dates[i+1]).days for i in range(len(dates)-1)]
        avg_interval = sum(intervals) / len(intervals)
        
        # Determine frequency
        if 80 <= avg_interval <= 100:
            frequency = "Quarterly"
        elif 170 <= avg_interval <= 190:
            frequency = "Semi-Annual"
        elif 350 <= avg_interval <= 380:
            frequency = "Annual"
        elif 25 <= avg_interval <= 35:
            frequency = "Monthly"
        else:
            frequency = f"Unknown ({avg_interval:.0f} days)"
        
        print(f"\n{symbol} Dividend Frequency: {frequency}")
        print(f"Average interval: {avg_interval:.0f} days")
        
        return frequency
    
    # Run examples
    print("\n" + "="*60)
    print("ALPHAVANTAGE DIVIDEND EXAMPLES")
    print("="*60)
    
    get_dividends_from_daily()
    calculate_adjusted_returns()
    detect_dividend_frequency()


# ==============================================================================
# 3. TIINGO DIVIDEND EXAMPLES
# ==============================================================================

def tiingo_dividend_examples():
    """Complete examples for Tiingo dividend data access"""
    
    import requests
    
    API_KEY = os.getenv('TIINGO_API_KEY', '')
    
    if not API_KEY:
        print("\nTiingo examples require API key")
        return
    
    # Example 1: Get dividend history
    def get_dividend_history(symbol='AAPL'):
        """Get complete dividend history from Tiingo"""
        
        url = f'https://api.tiingo.com/tiingo/fundamentals/{symbol}/dividends'
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Token {API_KEY}'
        }
        
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            dividends = response.json()
            print(f"\n{symbol} Dividends from Tiingo:")
            print(f"Total records: {len(dividends)}")
            
            if dividends:
                print("\nRecent dividends:")
                for div in dividends[:5]:
                    print(f"  Ex-Date: {div.get('exDate')}")
                    print(f"  Amount: ${div.get('divCash')}")
                    print(f"  Payment Date: {div.get('payDate')}")
                    print()
            
            return dividends
        else:
            print(f"Error: {response.status_code}")
            return []
    
    # Example 2: Get daily prices with dividends
    def get_prices_with_dividends(symbol='AAPL', days=30):
        """Get daily prices including dividend information"""
        
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        url = f'https://api.tiingo.com/tiingo/daily/{symbol}/prices'
        params = {
            'startDate': start_date.strftime('%Y-%m-%d'),
            'endDate': end_date.strftime('%Y-%m-%d')
        }
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Token {API_KEY}'
        }
        
        response = requests.get(url, params=params, headers=headers)
        
        if response.status_code == 200:
            prices = response.json()
            
            # Find dividend days
            dividend_days = [p for p in prices if p.get('divCash', 0) > 0]
            
            print(f"\n{symbol} Prices with Dividends ({days} days):")
            print(f"Total days: {len(prices)}")
            print(f"Dividend days: {len(dividend_days)}")
            
            if dividend_days:
                print("\nDividend payments:")
                for day in dividend_days:
                    print(f"  {day['date']}: ${day['divCash']}")
            
            return prices
        else:
            print(f"Error: {response.status_code}")
            return []
    
    # Run examples
    print("\n" + "="*60)
    print("TIINGO DIVIDEND EXAMPLES")
    print("="*60)
    
    get_dividend_history('AAPL')
    get_prices_with_dividends('AAPL')


# ==============================================================================
# 4. FINNHUB DIVIDEND EXAMPLES
# ==============================================================================

def finnhub_dividend_examples():
    """Complete examples for Finnhub dividend data access"""
    
    API_KEY = os.getenv('FINNHUB_API_KEY', '')
    
    if not API_KEY:
        print("\nFinnhub examples require API key")
        return
    
    try:
        import finnhub
        
        # Initialize client
        client = finnhub.Client(api_key=API_KEY)
        
        # Example 1: Get dividend history
        def get_dividend_history(symbol='AAPL'):
            """Get 2 years of dividend history"""
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=730)  # 2 years
            
            dividends = client.stock_dividends(
                symbol,
                _from=start_date.strftime('%Y-%m-%d'),
                to=end_date.strftime('%Y-%m-%d')
            )
            
            print(f"\n{symbol} Dividends from Finnhub:")
            print(f"Total dividends: {len(dividends)}")
            
            if dividends:
                print("\nRecent dividends:")
                for div in dividends[:5]:
                    print(f"  Date: {div['date']}")
                    print(f"  Amount: ${div['amount']}")
                    print(f"  Currency: {div['currency']}")
                    print()
            
            return dividends
        
        # Example 2: Calculate annual dividend
        def calculate_annual_dividend(symbol='JNJ'):
            """Calculate trailing 12-month dividend"""
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            
            dividends = client.stock_dividends(
                symbol,
                _from=start_date.strftime('%Y-%m-%d'),
                to=end_date.strftime('%Y-%m-%d')
            )
            
            annual_dividend = sum(d['amount'] for d in dividends)
            
            print(f"\n{symbol} Annual Dividend:")
            print(f"12-month total: ${annual_dividend:.2f}")
            print(f"Quarterly rate: ${annual_dividend/4:.2f}")
            print(f"Payments: {len(dividends)}")
            
            return annual_dividend
        
        # Run examples
        print("\n" + "="*60)
        print("FINNHUB DIVIDEND EXAMPLES")
        print("="*60)
        
        get_dividend_history('AAPL')
        calculate_annual_dividend('JNJ')
        
    except ImportError:
        print("\nFinnhub library not installed")


# ==============================================================================
# 5. POLYGON DIVIDEND EXAMPLES
# ==============================================================================

def polygon_dividend_examples():
    """Complete examples for Polygon dividend data access"""
    
    API_KEY = os.getenv('POLYGON_API_KEY', '')
    
    if not API_KEY:
        print("\nPolygon examples require API key")
        return
    
    try:
        from polygon import RESTClient
        
        # Initialize client
        client = RESTClient(api_key=API_KEY)
        
        # Example 1: Get comprehensive dividend data
        def get_dividend_details(symbol='AAPL'):
            """Get detailed dividend information"""
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=365)
            
            dividends = list(client.list_dividends(
                ticker=symbol,
                ex_dividend_date_gte=start_date.strftime('%Y-%m-%d'),
                ex_dividend_date_lte=end_date.strftime('%Y-%m-%d'),
                limit=20
            ))
            
            print(f"\n{symbol} Dividends from Polygon:")
            print(f"Total dividends: {len(dividends)}")
            
            if dividends:
                print("\nDetailed dividend info:")
                for div in dividends[:3]:
                    print(f"  Ex-Date: {div.ex_dividend_date}")
                    print(f"  Pay Date: {div.pay_date}")
                    print(f"  Record Date: {div.record_date}")
                    print(f"  Amount: ${div.cash_amount}")
                    print(f"  Frequency: {div.frequency}")
                    print()
            
            return dividends
        
        # Example 2: Get dividend-adjusted prices
        def get_adjusted_prices(symbol='SPY', days=30):
            """Get prices adjusted for dividends"""
            
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)
            
            aggs = client.get_aggs(
                ticker=symbol,
                multiplier=1,
                timespan='day',
                from_=start_date.strftime('%Y-%m-%d'),
                to=end_date.strftime('%Y-%m-%d'),
                adjusted=True,  # Key parameter for dividend adjustment
                sort='asc',
                limit=5000
            )
            
            prices = list(aggs)
            
            print(f"\n{symbol} Adjusted Prices from Polygon:")
            print(f"Total days: {len(prices)}")
            print(f"Prices are dividend-adjusted")
            
            if prices:
                print(f"\nFirst price: ${prices[0].close:.2f}")
                print(f"Last price: ${prices[-1].close:.2f}")
                
                return_pct = ((prices[-1].close - prices[0].close) / prices[0].close) * 100
                print(f"Return: {return_pct:.1f}%")
            
            return prices
        
        # Run examples
        print("\n" + "="*60)
        print("POLYGON DIVIDEND EXAMPLES")
        print("="*60)
        
        get_dividend_details('AAPL')
        get_adjusted_prices('SPY')
        
    except ImportError:
        print("\nPolygon library not installed")


# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

if __name__ == "__main__":
    print("COMPREHENSIVE DIVIDEND DATA SOURCE EXAMPLES")
    print("=" * 80)
    print("\nThis script demonstrates dividend data access for all 5 sources.")
    print("Some examples require API keys set as environment variables:")
    print("  - ALPHA_VANTAGE_API_KEY")
    print("  - TIINGO_API_KEY")
    print("  - FINNHUB_API_KEY")
    print("  - POLYGON_API_KEY")
    
    # Run examples for each source
    yfinance_dividend_examples()
    alphavantage_dividend_examples()
    tiingo_dividend_examples()
    finnhub_dividend_examples()
    polygon_dividend_examples()
    
    print("\n" + "="*80)
    print("EXAMPLES COMPLETE")
    print("="*80)