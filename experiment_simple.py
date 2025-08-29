#!/usr/bin/env python3
"""
Simple experiment: Test with recent data and known good tickers.
"""

import asyncio
import sys
from pathlib import Path
from datetime import datetime, timedelta

# Add the API directory to Python path
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

async def simple_experiment():
    """Test with recent data and known good tickers."""
    print("🧪 SIMPLE EXPERIMENT: Recent data for major tickers")
    
    # Use very recent date range and major tickers
    test_tickers = ["SPY", "AAPL", "MSFT"]
    start_date = "2024-01-01"  # This year's data
    end_date = "2024-12-31"
    
    print(f"Testing: {test_tickers}")
    print(f"Date range: {start_date} to {end_date}")
    
    try:
        from api.services.data_service import get_data_service
        
        data_service = get_data_service()
        
        start_time = datetime.now()
        result = await data_service.fetch_ticker_data(
            tickers=test_tickers,
            start_date=start_date,
            end_date=end_date,
            force_refresh=True,  # Force fresh data
            max_workers=3
        )
        
        execution_time = (datetime.now() - start_time).total_seconds()
        
        print(f"\n⏱️  Execution time: {execution_time:.2f} seconds")
        print(f"📊 Results:")
        
        metadata = result['metadata']
        print(f"   Success rate: {metadata['success_rate']:.1%}")
        print(f"   Successful: {metadata['successful_tickers']}")
        print(f"   Failed: {metadata['failed_tickers']}")
        
        for ticker, ticker_data in result['data'].items():
            data_points = len(ticker_data['data'])
            print(f"   ✅ {ticker}: {data_points} data points")
            
            # Show first few data points
            if data_points > 0:
                sample = ticker_data['data'][:3]
                print(f"      Sample data: {sample}")
        
        if metadata['failed_ticker_list']:
            print(f"   ❌ Failed: {metadata['failed_ticker_list']}")
        
        return result
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    result = asyncio.run(simple_experiment())
    if result:
        print("✅ Simple experiment completed!")
    else:
        print("❌ Simple experiment failed!")