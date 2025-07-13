import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Union
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import os

from ..models import ETF
from ..utils import Config, load_config, retry_with_backoff
from .cache import DataCache
from .sources import (
    YFinanceSource, AlphaVantageSource, FinnhubSource, TiingoSource
)


class ETFDataFetcher:
    """Fetches ETF data from various sources with intelligent fallback."""
    
    def __init__(self, cache: Optional[DataCache] = None, config: Optional[Config] = None):
        self.config = config or load_config()
        self.cache = cache or DataCache(self.config.data.cache_dir)
        self.logger = logging.getLogger(__name__)
        
        # Initialize data sources in priority order
        self.sources = self._initialize_sources()
        
    def _initialize_sources(self) -> List:
        """Initialize available data sources in priority order."""
        sources = []
        
        # Always add YFinance as primary source
        sources.append(YFinanceSource(self.config))
        
        # Add other sources if API keys are available
        if os.environ.get("ALPHA_VANTAGE_API_KEY"):
            sources.append(AlphaVantageSource(self.config))
            self.logger.info("Alpha Vantage source enabled")
        
        if os.environ.get("FINNHUB_API_KEY"):
            sources.append(FinnhubSource(self.config))
            self.logger.info("Finnhub source enabled")
        
        if os.environ.get("TIINGO_API_KEY"):
            sources.append(TiingoSource(self.config))
            self.logger.info("Tiingo source enabled")
        
        # Sort by priority
        sources.sort(key=lambda x: x.priority)
        
        self.logger.info(f"Initialized {len(sources)} data sources: {[s.name for s in sources]}")
        return sources
    
    def fetch_etf_data(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        interval: str = "1d",
        force_refresh: bool = False
    ) -> pd.DataFrame:
        """Fetch historical price data with multi-source fallback."""
        if end_date is None:
            end_date = datetime.now()
        
        # Check cache first (unless force refresh)
        if not force_refresh:
            cache_key = f"etf_data_{ticker}_{start_date}_{end_date}_{interval}"
            cached_data = self.cache.get(cache_key)
            if cached_data is not None:
                self.logger.debug(f"Cache hit for {ticker}")
                return cached_data
        
        # Try each source in priority order
        errors = []
        
        for source in self.sources:
            if not source.is_available():
                self.logger.debug(f"{source.name} not available for {ticker}")
                continue
            
            try:
                self.logger.info(f"Fetching {ticker} from {source.name}")
                data = source.fetch_data(ticker, start_date, end_date)
                
                if not data.empty:
                    # Cache successful result
                    if not force_refresh:
                        self.cache.set(cache_key, data, ttl_hours=self.config.data.cache_ttl_hours)
                    
                    self.logger.info(f"Successfully fetched {ticker} from {source.name}")
                    return data
                    
            except Exception as e:
                error_msg = f"{source.name} failed for {ticker}: {str(e)}"
                self.logger.warning(error_msg)
                errors.append(error_msg)
        
        # All sources failed
        self.logger.error(f"All sources failed for {ticker}. Errors: {errors}")
        return pd.DataFrame()
    
    def fetch_multiple_etfs(
        self,
        tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None,
        interval: str = "1d",
        max_workers: int = 5,
        use_batch: bool = True
    ) -> Dict[str, pd.DataFrame]:
        """Fetch data for multiple ETFs with intelligent batching."""
        if end_date is None:
            end_date = datetime.now()
        
        results = {}
        remaining_tickers = list(tickers)
        
        # Try batch-capable sources first
        if use_batch:
            for source in self.sources:
                if not source.supports_batch or not source.is_available():
                    continue
                
                try:
                    self.logger.info(f"Attempting batch fetch from {source.name} for {len(remaining_tickers)} tickers")
                    batch_results = source.fetch_batch(remaining_tickers, start_date, end_date)
                    
                    # Process successful fetches
                    for ticker, data in batch_results.items():
                        if not data.empty:
                            results[ticker] = data
                            remaining_tickers.remove(ticker)
                            
                            # Cache the data
                            cache_key = f"etf_data_{ticker}_{start_date}_{end_date}_{interval}"
                            self.cache.set(cache_key, data, ttl_hours=self.config.data.cache_ttl_hours)
                    
                    self.logger.info(f"Batch fetch got {len(results)}/{len(tickers)} tickers")
                    
                    if not remaining_tickers:
                        return results
                        
                except Exception as e:
                    self.logger.warning(f"Batch fetch failed on {source.name}: {str(e)}")
        
        # Fall back to individual fetching for remaining tickers
        if remaining_tickers:
            self.logger.info(f"Fetching {len(remaining_tickers)} tickers individually")
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_ticker = {
                    executor.submit(
                        self.fetch_etf_data,
                        ticker,
                        start_date,
                        end_date,
                        interval
                    ): ticker
                    for ticker in remaining_tickers
                }
                
                for future in as_completed(future_to_ticker):
                    ticker = future_to_ticker[future]
                    try:
                        data = future.result()
                        results[ticker] = data
                    except Exception as e:
                        self.logger.error(f"Error processing {ticker}: {str(e)}")
                        results[ticker] = pd.DataFrame()
        
        # Log summary
        successful = sum(1 for df in results.values() if not df.empty)
        self.logger.info(f"Total fetched: {successful}/{len(tickers)} tickers")
        
        return results
    
    def get_available_sources(self) -> List[str]:
        """Get list of currently available data sources."""
        return [s.name for s in self.sources if s.is_available()]
    
    def get_etf_info(self, ticker: str) -> Dict:
        """Get ETF metadata and information."""
        # For now, only YFinance provides info data
        try:
            import yfinance as yf
            etf = yf.Ticker(ticker)
            info = etf.info
            
            return {
                "ticker": ticker.upper(),
                "name": info.get("longName", ticker),
                "expense_ratio": info.get("annualReportExpenseRatio", 0.0),
                "total_assets": info.get("totalAssets", 0),
                "category": info.get("category", "Unknown"),
                "fund_family": info.get("fundFamily", "Unknown"),
                "inception_date": info.get("fundInceptionDate"),
                "trailing_pe": info.get("trailingPE"),
                "yield": info.get("yield"),
                "beta": info.get("beta3Year"),
                "holdings_count": len(etf.info.get("holdings", [])) if "holdings" in etf.info else None
            }
        except Exception as e:
            self.logger.error(f"Error fetching info for {ticker}: {str(e)}")
            return {"ticker": ticker.upper(), "error": str(e)}
    
    def create_etf_object(
        self,
        ticker: str,
        start_date: Union[str, datetime],
        end_date: Union[str, datetime] = None
    ) -> Optional[ETF]:
        """Create a complete ETF object with price data and metadata."""
        info = self.get_etf_info(ticker)
        
        if "error" in info:
            return None
        
        price_data = self.fetch_etf_data(ticker, start_date, end_date)
        
        etf = ETF(
            ticker=ticker,
            name=info.get("name", ticker),
            expense_ratio=info.get("expense_ratio", 0.0),
            inception_date=datetime.now(),  # Default if not available
            category=info.get("category", "Unknown"),
            total_assets=info.get("total_assets"),
            issuer=info.get("fund_family"),
            holdings_count=info.get("holdings_count"),
            price_data=price_data
        )
        
        return etf
    
    def get_sector_etfs(self) -> Dict[str, List[str]]:
        """Get common sector ETFs organized by sector."""
        return {
            "Technology": ["XLK", "VGT", "IYW", "FTEC", "IGM"],
            "Healthcare": ["XLV", "VHT", "IYH", "FHLC", "IBB"],
            "Financial": ["XLF", "VFH", "IYF", "FNCL", "KBE"],
            "Energy": ["XLE", "VDE", "IYE", "FENY", "XOP"],
            "Consumer Discretionary": ["XLY", "VCR", "IYC", "FDIS", "XRT"],
            "Consumer Staples": ["XLP", "VDC", "IYK", "FSTA", "IEV"],
            "Industrials": ["XLI", "VIS", "IYJ", "FIDU", "ITA"],
            "Materials": ["XLB", "VAW", "IYM", "FMAT", "GDX"],
            "Real Estate": ["XLRE", "VNQ", "IYR", "FREL", "REM"],
            "Utilities": ["XLU", "VPU", "IDU", "FUTY", "XLU"],
            "Communication": ["XLC", "VOX", "IYZ", "FCOM", "XLC"]
        }
    
    def get_popular_etfs(self) -> List[str]:
        """Get a list of popular ETFs for analysis."""
        return [
            # Broad Market
            "SPY", "IVV", "VOO", "QQQ", "DIA", "IWM", "VTI",
            # International
            "EFA", "IEFA", "VEA", "IEMG", "VWO", "EEM",
            # Bonds
            "AGG", "BND", "LQD", "HYG", "TLT", "IEF", "SHY",
            # Commodities
            "GLD", "IAU", "SLV", "USO", "UNG", "DBA",
            # Sectors (see get_sector_etfs for more)
            "XLK", "XLV", "XLF", "XLE", "XLY", "XLP", "XLI", "XLB", "XLRE", "XLU", "XLC"
        ]