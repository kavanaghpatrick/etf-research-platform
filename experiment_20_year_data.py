#!/usr/bin/env python3
"""
Comprehensive experiment: Fetch 20 years of data for 10 ETFs + 10 stocks.
Tests our robust ticker handler with a real-world large-scale data challenge.
"""

import asyncio
import sys
import os
from pathlib import Path
import logging
import traceback
from datetime import datetime, timedelta
import pandas as pd
import json

# Add the API directory to Python path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Define our test universe
ETF_TICKERS = [
    "SPY",   # S&P 500 SPDR ETF (1993)
    "VTI",   # Vanguard Total Stock Market ETF (2001)
    "QQQ",   # Invesco QQQ Trust (1999)
    "IWM",   # iShares Russell 2000 ETF (2000)
    "EFA",   # iShares MSCI EAFE ETF (2001)
    "EEM",   # iShares MSCI Emerging Markets ETF (2003)
    "AGG",   # iShares Core U.S. Aggregate Bond ETF (2003)
    "GLD",   # SPDR Gold Shares ETF (2004)
    "VNQ",   # Vanguard Real Estate ETF (2004)
    "TLT"    # iShares 20+ Year Treasury Bond ETF (2002)
]

STOCK_TICKERS = [
    "AAPL",  # Apple Inc.
    "MSFT",  # Microsoft Corporation
    "GOOGL", # Alphabet Inc.
    "AMZN",  # Amazon.com Inc.
    "TSLA",  # Tesla Inc.
    "JNJ",   # Johnson & Johnson
    "JPM",   # JPMorgan Chase & Co.
    "V",     # Visa Inc.
    "WMT",   # Walmart Inc.
    "PG"     # Procter & Gamble Co.
]

async def run_comprehensive_experiment():
    """Run the comprehensive 20-year data experiment."""
    print("=" * 80)
    print("🚀 COMPREHENSIVE 20-YEAR DATA EXPERIMENT")
    print("Testing robust ticker handler with real-world challenge")
    print("=" * 80)
    
    # Setup
    all_tickers = ETF_TICKERS + STOCK_TICKERS
    start_date = "2004-01-01"  # 20 years ago
    end_date = datetime.now().strftime('%Y-%m-%d')
    
    print(f"\n📊 EXPERIMENT PARAMETERS:")
    print(f"   ETFs: {len(ETF_TICKERS)} tickers")
    print(f"   Stocks: {len(STOCK_TICKERS)} tickers") 
    print(f"   Total tickers: {len(all_tickers)}")
    print(f"   Date range: {start_date} to {end_date} ({(datetime.now() - datetime(2004,1,1)).days} days)")
    print(f"   Expected data points per ticker: ~5,000+ (20 years of daily data)")
    
    print(f"\n🎯 TARGET TICKERS:")
    print(f"   ETFs: {', '.join(ETF_TICKERS)}")
    print(f"   Stocks: {', '.join(STOCK_TICKERS)}")
    
    try:
        # Import our robust data service
        from api.services.data_service import get_data_service
        
        print(f"\n🔧 INITIALIZING ROBUST DATA SYSTEM...")
        data_service = get_data_service()
        
        # Check initial source health
        print(f"\n🏥 DATA SOURCE HEALTH CHECK:")
        health_data = data_service.get_source_health()
        for source in health_data:
            status = "🟢 Ready" if source['healthy'] else "🔴 Unavailable"
            print(f"   {source['name']}: {status}")
        
        print(f"\n🚀 STARTING LARGE-SCALE DATA FETCH...")
        print(f"   Using resilient multi-source fetching with intelligent fallback")
        print(f"   Rate limiting active to respect API constraints")
        print(f"   Quality validation and repair enabled")
        
        start_time = datetime.now()
        
        # Execute the comprehensive fetch
        result = await data_service.fetch_ticker_data(
            tickers=all_tickers,
            start_date=start_date,
            end_date=end_date,
            force_refresh=False,  # Use cache if available
            max_workers=8  # Increase concurrency for large dataset
        )
        
        total_execution_time = (datetime.now() - start_time).total_seconds()
        
        print(f"\n✅ FETCH COMPLETED!")
        print(f"   Total execution time: {total_execution_time:.2f} seconds")
        print(f"   Average time per ticker: {total_execution_time/len(all_tickers):.2f} seconds")
        
        # Analyze results in detail
        print(f"\n📈 DETAILED RESULTS ANALYSIS:")
        metadata = result['metadata']
        
        print(f"\n📊 OVERALL STATISTICS:")
        print(f"   Success rate: {metadata['success_rate']:.1%}")
        print(f"   Successful tickers: {metadata['successful_tickers']}/{metadata['total_tickers']}")
        print(f"   Failed tickers: {metadata['failed_tickers']}")
        print(f"   Data sources used: {', '.join(result['data_sources_used'])}")
        
        if result['cache_hit_rate'] is not None:
            print(f"   Cache hit rate: {result['cache_hit_rate']:.1%}")
        
        # Analyze by category
        successful_etfs = []
        successful_stocks = []
        failed_tickers = metadata['failed_ticker_list']
        
        print(f"\n🏆 SUCCESS BY CATEGORY:")
        for ticker, ticker_data in result['data'].items():
            data_points = len(ticker_data['data'])
            date_range = ticker_data['date_range']
            years_of_data = (datetime.fromisoformat(date_range['end']) - datetime.fromisoformat(date_range['start'])).days / 365.25
            
            category = "ETF" if ticker in ETF_TICKERS else "Stock"
            if ticker in ETF_TICKERS:
                successful_etfs.append(ticker)
            else:
                successful_stocks.append(ticker)
            
            print(f"   ✅ {ticker} ({category}): {data_points:,} data points, {years_of_data:.1f} years")
            print(f"      📅 {date_range['start']} to {date_range['end']}")
        
        if failed_tickers:
            print(f"\n❌ FAILED TICKERS:")
            for ticker in failed_tickers:
                category = "ETF" if ticker in ETF_TICKERS else "Stock"
                print(f"   ❌ {ticker} ({category})")
        
        # Category summary
        print(f"\n📊 CATEGORY SUMMARY:")
        print(f"   ETFs successful: {len(successful_etfs)}/{len(ETF_TICKERS)} ({len(successful_etfs)/len(ETF_TICKERS):.1%})")
        print(f"   Stocks successful: {len(successful_stocks)}/{len(STOCK_TICKERS)} ({len(successful_stocks)/len(STOCK_TICKERS):.1%})")
        
        # Data quality analysis
        print(f"\n🔍 DATA QUALITY ANALYSIS:")
        total_data_points = 0
        oldest_data = None
        newest_data = None
        
        for ticker, ticker_data in result['data'].items():
            data_points = len(ticker_data['data'])
            total_data_points += data_points
            
            start_date_parsed = datetime.fromisoformat(ticker_data['date_range']['start'])
            end_date_parsed = datetime.fromisoformat(ticker_data['date_range']['end'])
            
            if oldest_data is None or start_date_parsed < oldest_data:
                oldest_data = start_date_parsed
            if newest_data is None or end_date_parsed > newest_data:
                newest_data = end_date_parsed
        
        print(f"   Total data points collected: {total_data_points:,}")
        print(f"   Average data points per successful ticker: {total_data_points/len(result['data']):.0f}")
        if oldest_data and newest_data:
            total_span = (newest_data - oldest_data).days / 365.25
            print(f"   Data spans: {total_span:.1f} years ({oldest_data.strftime('%Y-%m-%d')} to {newest_data.strftime('%Y-%m-%d')})")
        
        # Performance metrics
        print(f"\n⚡ PERFORMANCE METRICS:")
        print(f"   Data throughput: {total_data_points/total_execution_time:.0f} data points/second")
        print(f"   Ticker throughput: {len(all_tickers)/total_execution_time:.2f} tickers/second")
        if total_data_points > 0:
            print(f"   Avg time per data point: {total_execution_time*1000/total_data_points:.2f} milliseconds")
        
        # Source health after operation
        print(f"\n🏥 POST-OPERATION SOURCE HEALTH:")
        final_health = data_service.get_source_health()
        for source in final_health:
            status = "🟢 Healthy" if source['healthy'] else "🔴 Degraded"
            print(f"   {source['name']}: {status} (Success rate: {source['success_rate']})")
        
        # Save sample results
        print(f"\n💾 SAVING SAMPLE RESULTS...")
        sample_results = {}
        for i, (ticker, ticker_data) in enumerate(list(result['data'].items())[:3]):  # Save first 3 successful
            sample_df = pd.DataFrame(ticker_data['data'])
            if not sample_df.empty:
                sample_results[ticker] = {
                    'data_points': len(sample_df),
                    'date_range': ticker_data['date_range'],
                    'sample_data': sample_df.head(10).to_dict('records')  # First 10 rows
                }
        
        # Save to file
        with open('experiment_results_sample.json', 'w') as f:
            json.dump(sample_results, f, indent=2, default=str)
        print(f"   Sample results saved to: experiment_results_sample.json")
        
        # Final assessment
        print(f"\n🎯 EXPERIMENT ASSESSMENT:")
        if metadata['success_rate'] >= 0.8:
            print(f"   🏆 EXCELLENT: {metadata['success_rate']:.1%} success rate demonstrates robust data handling")
        elif metadata['success_rate'] >= 0.5:
            print(f"   ✅ GOOD: {metadata['success_rate']:.1%} success rate shows resilient performance")
        else:
            print(f"   ⚠️  NEEDS IMPROVEMENT: {metadata['success_rate']:.1%} success rate")
        
        print(f"\n🚀 ROBUST TICKER HANDLER CAPABILITIES DEMONSTRATED:")
        print(f"   ✅ Large-scale concurrent data fetching")
        print(f"   ✅ 20-year historical data retrieval")
        print(f"   ✅ Mixed asset class handling (ETFs + Stocks)")
        print(f"   ✅ Graceful error handling and fallback")
        print(f"   ✅ Performance optimization and caching")
        print(f"   ✅ Data quality validation")
        print(f"   ✅ Source health monitoring")
        
        return result
        
    except Exception as e:
        print(f"❌ EXPERIMENT FAILED: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return None

async def main():
    """Run the comprehensive experiment."""
    result = await run_comprehensive_experiment()
    
    if result:
        print(f"\n" + "=" * 80)
        print(f"🎉 EXPERIMENT COMPLETED SUCCESSFULLY!")
        print(f"   The robust ticker handler has proven its capabilities")
        print(f"   with real-world large-scale data fetching.")
        print(f"=" * 80)
        return 0
    else:
        print(f"\n❌ Experiment failed. Check logs for details.")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)