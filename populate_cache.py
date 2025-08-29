#!/usr/bin/env python3
"""
Cache population script for ETF Research Platform.
Efficiently populates the local database with comprehensive historical data.
"""

import requests
import time
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
import concurrent.futures
import asyncio

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

API_BASE = "http://localhost:8000"

class CachePopulator:
    """Efficiently populate cache with historical data."""
    
    def __init__(self):
        self.api_base = API_BASE
        self.session = requests.Session()
        self.populate_stats = {
            'total_tickers': 0,
            'successful_tickers': 0,
            'failed_tickers': 0,
            'total_data_points': 0,
            'total_api_calls': 0,
            'total_time': 0,
            'cache_hit_improvements': []
        }
    
    def get_popular_tickers(self) -> List[str]:
        """Get list of popular tickers to populate cache for."""
        # Focus on most popular ETFs and stocks for maximum cache benefit
        return [
            # Major ETFs
            'SPY', 'QQQ', 'VTI', 'IWM', 'EFA', 'VEA', 'VWO', 'AGG', 'LQD', 'HYG',
            'GLD', 'SLV', 'USO', 'XLF', 'XLK', 'XLE', 'XLV', 'XLI', 'XLU', 'XLP',
            
            # Major Tech Stocks
            'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'CRM', 'ORCL',
            
            # Major Traditional Stocks
            'BRK-B', 'V', 'JNJ', 'WMT', 'JPM', 'XOM', 'UNH', 'HD', 'PG', 'DIS',
            'BAC', 'MA', 'ABBV', 'KO', 'PFE', 'TMO', 'COST', 'NKE', 'MRK', 'LLY'
        ]
    
    def populate_ticker_historical_data(self, ticker: str, years_back: int = 2) -> Dict[str, Any]:
        """Populate historical data for a single ticker."""
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=years_back * 365)
        
        logger.info(f"Populating {ticker} from {start_date} to {end_date}")
        
        payload = {
            "tickers": [ticker],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
        
        start_time = time.time()
        try:
            response = self.session.post(
                f"{self.api_base}/data/fetch", 
                json=payload, 
                timeout=60
            )
            execution_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('status') == 'success' and ticker in data.get('data', {}):
                    ticker_data = data['data'][ticker]
                    data_points = len(ticker_data.get('data', []))
                    cache_stats = ticker_data.get('cache_stats', {})
                    
                    result = {
                        'ticker': ticker,
                        'success': True,
                        'data_points': data_points,
                        'execution_time': execution_time,
                        'cached_records': cache_stats.get('cached_records', 0),
                        'api_records': cache_stats.get('api_records', 0),
                        'cache_hit_rate': cache_stats.get('cache_hit_rate', 0),
                        'api_calls_made': cache_stats.get('api_calls_made', 1),
                        'source_used': cache_stats.get('source_used', 'Unknown')
                    }
                    
                    logger.info(
                        f"✅ {ticker}: {data_points} points, "
                        f"{cache_stats.get('cache_hit_rate', 0):.1%} cached, "
                        f"{execution_time:.1f}s"
                    )
                    
                    return result
                else:
                    logger.warning(f"❌ {ticker}: No data returned")
                    return {'ticker': ticker, 'success': False, 'error': 'No data returned'}
            else:
                logger.error(f"❌ {ticker}: HTTP {response.status_code}")
                return {'ticker': ticker, 'success': False, 'error': f'HTTP {response.status_code}'}
                
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"❌ {ticker}: Exception - {e}")
            return {'ticker': ticker, 'success': False, 'error': str(e), 'execution_time': execution_time}
    
    def populate_cache_batch(self, tickers: List[str], batch_size: int = 3, delay: float = 1.0) -> List[Dict[str, Any]]:
        """Populate cache for a batch of tickers with rate limiting."""
        results = []
        
        logger.info(f"Processing batch of {len(tickers)} tickers (batch_size={batch_size}, delay={delay}s)")
        
        # Process in batches to respect API rate limits
        for i in range(0, len(tickers), batch_size):
            batch = tickers[i:i + batch_size]
            
            logger.info(f"Processing batch {i//batch_size + 1}: {batch}")
            
            # Use ThreadPoolExecutor for controlled concurrency
            with concurrent.futures.ThreadPoolExecutor(max_workers=batch_size) as executor:
                batch_futures = [
                    executor.submit(self.populate_ticker_historical_data, ticker)
                    for ticker in batch
                ]
                
                batch_results = [
                    future.result() for future in concurrent.futures.as_completed(batch_futures)
                ]
            
            results.extend(batch_results)
            
            # Rate limiting delay between batches
            if i + batch_size < len(tickers):
                logger.info(f"Waiting {delay}s before next batch...")
                time.sleep(delay)
        
        return results
    
    def test_cache_improvement(self, ticker: str) -> Dict[str, Any]:
        """Test cache performance improvement for a ticker."""
        logger.info(f"Testing cache improvement for {ticker}")
        
        payload = {
            "tickers": [ticker],
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        # First request
        start_time = time.time()
        response1 = self.session.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
        first_time = time.time() - start_time
        
        time.sleep(0.5)  # Small delay
        
        # Second request (should hit cache)
        start_time = time.time()
        response2 = self.session.post(f"{self.api_base}/data/fetch", json=payload, timeout=30)
        second_time = time.time() - start_time
        
        if response1.status_code == 200 and response2.status_code == 200:
            speedup = first_time / second_time if second_time > 0 else 1
            
            # Get cache stats from second response
            data2 = response2.json()
            cache_stats = {}
            if ticker in data2.get('data', {}):
                cache_stats = data2['data'][ticker].get('cache_stats', {})
            
            return {
                'ticker': ticker,
                'first_time': first_time,
                'second_time': second_time,
                'speedup': speedup,
                'cache_hit_rate': cache_stats.get('cache_hit_rate', 0),
                'cached_records': cache_stats.get('cached_records', 0),
                'api_records': cache_stats.get('api_records', 0)
            }
        else:
            return {'ticker': ticker, 'error': 'Request failed'}
    
    def get_cache_dashboard_stats(self) -> Dict[str, Any]:
        """Get current cache dashboard statistics."""
        try:
            response = self.session.get(f"{self.api_base}/cache/dashboard", timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                return {'error': f'HTTP {response.status_code}'}
        except Exception as e:
            return {'error': str(e)}
    
    def run_comprehensive_population(self):
        """Run comprehensive cache population strategy."""
        logger.info("🚀 Starting Comprehensive Cache Population")
        logger.info("=" * 60)
        
        start_time = time.time()
        
        # Get initial cache stats
        initial_stats = self.get_cache_dashboard_stats()
        logger.info(f"Initial cache state: {initial_stats.get('summary', {})}")
        
        # Get tickers to populate
        tickers = self.get_popular_tickers()
        logger.info(f"Will populate {len(tickers)} popular tickers")
        
        # Phase 1: Populate major ETFs first (most requested)
        etf_tickers = tickers[:10]  # First 10 are ETFs
        logger.info(f"\n📊 Phase 1: Populating major ETFs ({len(etf_tickers)} tickers)")
        etf_results = self.populate_cache_batch(etf_tickers, batch_size=2, delay=2.0)
        
        # Phase 2: Populate major stocks
        stock_tickers = tickers[10:30]  # Next 20 are major stocks
        logger.info(f"\n📈 Phase 2: Populating major stocks ({len(stock_tickers)} tickers)")
        stock_results = self.populate_cache_batch(stock_tickers, batch_size=3, delay=1.5)
        
        # Phase 3: Populate remaining tickers
        remaining_tickers = tickers[30:]
        if remaining_tickers:
            logger.info(f"\n📋 Phase 3: Populating remaining tickers ({len(remaining_tickers)} tickers)")
            remaining_results = self.populate_cache_batch(remaining_tickers, batch_size=3, delay=1.0)
        else:
            remaining_results = []
        
        # Combine all results
        all_results = etf_results + stock_results + remaining_results
        
        # Calculate statistics
        successful = [r for r in all_results if r.get('success', False)]
        failed = [r for r in all_results if not r.get('success', False)]
        
        total_time = time.time() - start_time
        total_data_points = sum(r.get('data_points', 0) for r in successful)
        total_api_calls = sum(r.get('api_calls_made', 0) for r in successful)
        
        # Get final cache stats
        final_stats = self.get_cache_dashboard_stats()
        
        # Test cache improvements on a few tickers
        logger.info("\n🧪 Testing cache performance improvements...")
        test_tickers = ['SPY', 'AAPL', 'QQQ'][:3]  # Test top 3
        cache_improvements = []
        for ticker in test_tickers:
            if any(r.get('ticker') == ticker and r.get('success') for r in successful):
                improvement = self.test_cache_improvement(ticker)
                cache_improvements.append(improvement)
                if 'speedup' in improvement:
                    logger.info(f"  {ticker}: {improvement['speedup']:.1f}x speedup, {improvement['cache_hit_rate']:.1%} cache hit")
        
        # Generate comprehensive report
        logger.info("\n" + "=" * 60)
        logger.info("📊 CACHE POPULATION REPORT")
        logger.info("=" * 60)
        
        logger.info(f"Duration: {total_time:.1f} seconds ({total_time/60:.1f} minutes)")
        logger.info(f"Tickers processed: {len(all_results)}")
        logger.info(f"Successful: {len(successful)}")
        logger.info(f"Failed: {len(failed)}")
        logger.info(f"Success rate: {len(successful)/len(all_results)*100:.1f}%")
        logger.info(f"Total data points cached: {total_data_points:,}")
        logger.info(f"Total API calls made: {total_api_calls}")
        
        if failed:
            logger.info(f"\n❌ Failed tickers:")
            for fail in failed:
                logger.info(f"  - {fail['ticker']}: {fail.get('error', 'Unknown error')}")
        
        logger.info(f"\n✅ Cache population completed!")
        logger.info(f"Final cache summary: {final_stats.get('summary', {})}")
        
        # Save detailed report
        report = {
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': total_time,
            'tickers_processed': len(all_results),
            'successful_tickers': len(successful),
            'failed_tickers': len(failed),
            'success_rate': len(successful)/len(all_results)*100,
            'total_data_points': total_data_points,
            'total_api_calls': total_api_calls,
            'initial_stats': initial_stats,
            'final_stats': final_stats,
            'cache_improvements': cache_improvements,
            'detailed_results': all_results
        }
        
        with open('cache_population_report.json', 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        logger.info(f"💾 Detailed report saved: cache_population_report.json")
        
        return report


def main():
    """Main function to run cache population."""
    # Check if API is available
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ API not available at {API_BASE}")
            print("   Please make sure the API is running with database integration")
            return
    except Exception as e:
        print(f"❌ Cannot connect to API: {e}")
        return
    
    # Check if database is available
    try:
        response = requests.get(f"{API_BASE}/cache/dashboard", timeout=5)
        if response.status_code != 200:
            print(f"❌ Cache dashboard not available")
            print("   Please make sure the API is running with database integration")
            return
        else:
            data = response.json()
            print(f"✅ Database connected: {data.get('summary', {}).get('total_tickers', 0)} tickers available")
    except Exception as e:
        print(f"❌ Database check failed: {e}")
        return
    
    # Run cache population
    populator = CachePopulator()
    populator.run_comprehensive_population()


if __name__ == "__main__":
    main()