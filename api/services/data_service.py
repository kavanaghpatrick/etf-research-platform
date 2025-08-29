"""
Data service wrapper for ETF Research Platform API.
Integrates the robust ResilientDataFetcher with FastAPI.
"""

import sys
import os
from pathlib import Path
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd

# Add the src directory to Python path for imports
current_dir = Path(__file__).parent
project_root = current_dir.parent.parent
sys.path.append(str(project_root))

from src.data import ResilientDataFetcher, DataAggregator
from src.utils import Config, load_config

logger = logging.getLogger(__name__)

class DataService:
    """
    Service wrapper for resilient data fetching.
    Provides a clean interface between FastAPI and our robust data fetching system.
    """
    
    def __init__(self):
        """Initialize the data service with configuration."""
        self.config = load_config()
        self._fetcher = None
        self._aggregator = None
        
    @property
    def fetcher(self) -> ResilientDataFetcher:
        """Lazy-loaded resilient data fetcher for serverless efficiency."""
        if self._fetcher is None:
            logger.info("Initializing ResilientDataFetcher...")
            self._fetcher = ResilientDataFetcher(
                config=self.config,
                quality_check=True,
                repair_data=True
            )
            logger.info("ResilientDataFetcher initialized successfully")
        return self._fetcher
    
    @property 
    def aggregator(self) -> DataAggregator:
        """Lazy-loaded data aggregator for serverless efficiency."""
        if self._aggregator is None:
            logger.info("Initializing DataAggregator...")
            self._aggregator = DataAggregator(config=self.config)
            logger.info("DataAggregator initialized successfully")
        return self._aggregator
    
    async def fetch_ticker_data(
        self,
        tickers: List[str],
        start_date: str,
        end_date: Optional[str] = None,
        force_refresh: bool = False,
        max_workers: int = 5
    ) -> Dict[str, Any]:
        """
        Fetch data for multiple tickers using the resilient fetcher.
        
        Args:
            tickers: List of ticker symbols
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD), defaults to today
            force_refresh: Force refresh bypassing cache
            max_workers: Number of concurrent workers
            
        Returns:
            Dictionary with ticker data and metadata
        """
        try:
            logger.info(f"Fetching data for {len(tickers)} tickers: {tickers}")
            start_time = datetime.now()
            
            # Use the resilient fetcher
            results = self.fetcher.fetch_multiple_resilient(
                tickers=tickers,
                start_date=start_date,
                end_date=end_date or datetime.now(),
                max_workers=max_workers,
                use_batch=True  # Use batch fetching when possible
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Convert pandas DataFrames to JSON-serializable format
            json_results = {}
            successful_tickers = []
            failed_tickers = []
            
            for ticker, df in results.items():
                if not df.empty:
                    # Convert DataFrame to records format for JSON serialization
                    json_results[ticker] = {
                        'data': df.reset_index().to_dict('records'),
                        'columns': list(df.columns),
                        'index_name': df.index.name or 'Date',
                        'shape': df.shape,
                        'date_range': {
                            'start': df.index.min().isoformat() if not df.empty else None,
                            'end': df.index.max().isoformat() if not df.empty else None
                        }
                    }
                    successful_tickers.append(ticker)
                else:
                    failed_tickers.append(ticker)
            
            # Get source health information
            source_health = self.get_source_health()
            
            # Calculate cache hit rate (if available from fetcher)
            cache_hit_rate = getattr(self.fetcher, 'cache_hit_rate', None)
            
            return {
                'data': json_results,
                'metadata': {
                    'execution_time': execution_time,
                    'total_tickers': len(tickers),
                    'successful_tickers': len(successful_tickers),
                    'failed_tickers': len(failed_tickers),
                    'success_rate': len(successful_tickers) / len(tickers) if tickers else 0,
                    'failed_ticker_list': failed_tickers,
                    'date_range': {
                        'start': start_date,
                        'end': end_date or datetime.now().strftime('%Y-%m-%d')
                    }
                },
                'data_sources_used': self._get_sources_used(),
                'cache_hit_rate': cache_hit_rate,
                'source_health': source_health
            }
            
        except Exception as e:
            logger.error(f"Error fetching ticker data: {str(e)}")
            raise
    
    def get_source_health(self) -> List[Dict[str, Any]]:
        """Get health status of all data sources."""
        try:
            health_data = self.fetcher.get_source_health()
            
            health_list = []
            for source_name, health_info in health_data.items():
                health_list.append({
                    'name': source_name,
                    'healthy': health_info['healthy'],
                    'success_rate': health_info['success_rate'],
                    'total_requests': health_info['total_requests'],
                    'average_response_time': health_info['average_response_time'],
                    'last_error': None  # Could be enhanced to track last errors
                })
            
            return health_list
            
        except Exception as e:
            logger.error(f"Error getting source health: {str(e)}")
            return []
    
    def _get_sources_used(self) -> List[str]:
        """Get list of data sources currently configured."""
        try:
            if self._fetcher is None:
                return []
            
            return [source.name for source in self._fetcher.sources]
            
        except Exception as e:
            logger.error(f"Error getting sources used: {str(e)}")
            return []
    
    async def aggregate_ticker_data(
        self,
        ticker: str,
        start_date: str,
        end_date: Optional[str] = None,
        aggregation_method: str = "best_quality"
    ) -> Dict[str, Any]:
        """
        Aggregate data from multiple sources for a single ticker.
        
        Args:
            ticker: Ticker symbol
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD), defaults to today
            aggregation_method: Method for aggregating data
            
        Returns:
            Aggregated data and metadata
        """
        try:
            logger.info(f"Aggregating data for {ticker} using method: {aggregation_method}")
            
            result = self.aggregator.aggregate_from_all_sources(
                ticker=ticker,
                start_date=start_date,
                end_date=end_date or datetime.now(),
                aggregation_method=aggregation_method
            )
            
            if result.empty:
                return {
                    'data': {},
                    'metadata': {
                        'ticker': ticker,
                        'aggregation_method': aggregation_method,
                        'success': False,
                        'message': 'No data available from any source'
                    }
                }
            
            return {
                'data': {
                    'ticker': ticker,
                    'data': result.reset_index().to_dict('records'),
                    'columns': list(result.columns),
                    'shape': result.shape,
                    'date_range': {
                        'start': result.index.min().isoformat(),
                        'end': result.index.max().isoformat()
                    }
                },
                'metadata': {
                    'ticker': ticker,
                    'aggregation_method': aggregation_method,
                    'success': True,
                    'data_quality_score': getattr(result, 'quality_score', None)
                }
            }
            
        except Exception as e:
            logger.error(f"Error aggregating data for {ticker}: {str(e)}")
            raise

# Global service instance for reuse across requests
_data_service = None

def get_data_service() -> DataService:
    """Get or create the global data service instance."""
    global _data_service
    if _data_service is None:
        _data_service = DataService()
    return _data_service