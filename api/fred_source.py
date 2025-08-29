"""
FRED (Federal Reserve Economic Data) API integration for inflation data.
Fetches Consumer Price Index (CPI) data for Monte Carlo simulations.
"""

import os
import requests
import pandas as pd
import logging
from typing import Dict, Optional, Any
from datetime import datetime, date, timedelta
import time


class FredSource:
    """
    FRED API integration for economic data, specifically CPI inflation data.
    Free API with 120 requests per minute limit.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        self.logger = logging.getLogger(__name__)
        self.name = "FRED"
        self.api_key = api_key or os.getenv('FRED_API_KEY')
        self.base_url = "https://api.stlouisfed.org/fred"
        self.last_request_time = 0
        self.min_request_interval = 0.5  # 500ms between requests (120/min = 2/sec)
        
        # CPI series IDs from FRED
        self.cpi_series = {
            'CPIAUCSL': 'Consumer Price Index for All Urban Consumers: All Items',  # Monthly, SA
            'CPIAUCNS': 'Consumer Price Index for All Urban Consumers: All Items',  # Monthly, NSA  
            'CPALTT01USM657N': 'Consumer Price Index: All Items for United States'   # Monthly, Growth Rate
        }
        
        if not self.api_key:
            self.logger.warning("FRED API key not found. Set FRED_API_KEY environment variable.")
            self.available = False
        else:
            self.available = True
            self.logger.info(f"Initialized FRED source with API key")
    
    def _rate_limit(self):
        """Implement rate limiting to respect FRED API limits (120 requests/min)."""
        current_time = time.time()
        time_since_last = current_time - self.last_request_time
        
        if time_since_last < self.min_request_interval:
            sleep_time = self.min_request_interval - time_since_last
            self.logger.debug(f"Rate limiting: sleeping {sleep_time:.2f}s")
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()
    
    def _make_request(self, endpoint: str, params: Dict[str, Any]) -> Optional[Dict]:
        """Make a rate-limited request to FRED API."""
        if not self.available:
            raise ValueError("FRED API key not available")
        
        self._rate_limit()
        
        # Add API key and JSON format to all requests
        params.update({
            'api_key': self.api_key,
            'file_type': 'json'
        })
        
        url = f"{self.base_url}/{endpoint}"
        
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            if 'error_code' in data:
                raise Exception(f"FRED API error: {data.get('error_message', 'Unknown error')}")
            
            return data
            
        except requests.exceptions.RequestException as e:
            self.logger.error(f"FRED API request failed: {e}")
            raise
        except Exception as e:
            self.logger.error(f"FRED API error: {e}")
            raise
    
    def fetch_cpi_data(self, start_date: date, end_date: date, 
                       series_id: str = 'CPIAUCSL') -> pd.DataFrame:
        """
        Fetch Consumer Price Index data from FRED.
        
        Args:
            start_date: Start date for data
            end_date: End date for data
            series_id: FRED series ID (default: CPIAUCSL - monthly CPI)
            
        Returns:
            DataFrame with date index and cpi_rate column
        """
        try:
            params = {
                'series_id': series_id,
                'observation_start': start_date.strftime('%Y-%m-%d'),
                'observation_end': end_date.strftime('%Y-%m-%d'),
                'frequency': 'm',  # Monthly data
                'units': 'pc1',    # Percent change from year ago
                'sort_order': 'asc'
            }
            
            self.logger.info(f"Fetching CPI data from FRED: {series_id} ({start_date} to {end_date})")
            
            response = self._make_request('series/observations', params)
            
            if not response or 'observations' not in response:
                self.logger.warning(f"No CPI data returned from FRED for {series_id}")
                return pd.DataFrame()
            
            observations = response['observations']
            
            if not observations:
                self.logger.warning(f"Empty CPI data from FRED for {series_id}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            data = []
            for obs in observations:
                # Skip observations with missing values
                if obs['value'] == '.':
                    continue
                    
                try:
                    data.append({
                        'date': obs['date'],
                        'cpi_rate': float(obs['value'])
                    })
                except (ValueError, KeyError) as e:
                    self.logger.warning(f"Skipping invalid observation: {obs}")
                    continue
            
            if not data:
                self.logger.warning(f"No valid CPI observations from FRED for {series_id}")
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            df['date'] = pd.to_datetime(df['date'])
            df.set_index('date', inplace=True)
            
            # Sort by date
            df.sort_index(inplace=True)
            
            self.logger.info(f"Successfully fetched {len(df)} CPI records from FRED")
            return df
            
        except Exception as e:
            self.logger.error(f"Error fetching CPI data from FRED: {e}")
            return pd.DataFrame()
    
    def get_series_info(self, series_id: str = 'CPIAUCSL') -> Dict[str, Any]:
        """
        Get metadata about a FRED series.
        
        Args:
            series_id: FRED series ID
            
        Returns:
            Dictionary with series metadata
        """
        try:
            params = {'series_id': series_id}
            response = self._make_request('series', params)
            
            if response and 'seriess' in response and response['seriess']:
                series_info = response['seriess'][0]
                return {
                    'id': series_info.get('id'),
                    'title': series_info.get('title'),
                    'units': series_info.get('units'),
                    'frequency': series_info.get('frequency'),
                    'observation_start': series_info.get('observation_start'),
                    'observation_end': series_info.get('observation_end'),
                    'last_updated': series_info.get('last_updated'),
                    'notes': series_info.get('notes')
                }
            else:
                return {}
                
        except Exception as e:
            self.logger.error(f"Error getting FRED series info for {series_id}: {e}")
            return {}
    
    def get_available_cpi_series(self) -> Dict[str, str]:
        """Get list of available CPI series for inflation analysis."""
        return self.cpi_series.copy()
    
    def test_connection(self) -> Dict[str, Any]:
        """
        Test FRED API connection and return status.
        
        Returns:
            Dictionary with connection status and metadata
        """
        try:
            if not self.available:
                return {
                    'source': 'FRED',
                    'available': False,
                    'error': 'API key not configured'
                }
            
            # Test with a simple series info request
            series_info = self.get_series_info('CPIAUCSL')
            
            if series_info:
                return {
                    'source': 'FRED',
                    'available': True,
                    'test_series': 'CPIAUCSL',
                    'last_updated': series_info.get('last_updated'),
                    'observation_end': series_info.get('observation_end'),
                    'rate_limit': '120 requests/minute'
                }
            else:
                return {
                    'source': 'FRED',
                    'available': False,
                    'error': 'Failed to retrieve test series'
                }
                
        except Exception as e:
            return {
                'source': 'FRED',
                'available': False,
                'error': str(e)
            }
    
    def close(self):
        """Clean up resources (FRED API doesn't require explicit cleanup)."""
        self.logger.info("FRED source closed")


# Example usage and testing
if __name__ == "__main__":
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Test FRED source
    fred = FredSource()
    
    # Test connection
    print("\n=== FRED Connection Test ===")
    status = fred.test_connection()
    print(f"Status: {status}")
    
    if status.get('available'):
        # Test CPI data fetch
        print("\n=== CPI Data Test ===")
        end_date = date.today()
        start_date = end_date - timedelta(days=365 * 2)  # 2 years
        
        cpi_data = fred.fetch_cpi_data(start_date, end_date)
        print(f"Fetched {len(cpi_data)} CPI records")
        print(cpi_data.head())
        print(cpi_data.tail())
        
        # Test series info
        print("\n=== Series Information ===")
        series_info = fred.get_series_info('CPIAUCSL')
        print(f"Series: {series_info}")
        
        # Show available series
        print("\n=== Available CPI Series ===")
        available = fred.get_available_cpi_series()
        for series_id, description in available.items():
            print(f"{series_id}: {description}")
    
    # Clean up
    fred.close()