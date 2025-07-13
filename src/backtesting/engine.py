import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable, Union
import logging
from copy import deepcopy

from ..models import Portfolio, Transaction, TransactionType
from ..data import ETFDataFetcher
from ..portfolio.strategies import PortfolioStrategy
from .results import BacktestResults
from ..utils import Config, load_config


class BacktestEngine:
    """Engine for backtesting portfolio strategies."""
    
    def __init__(
        self,
        data_fetcher: Optional[ETFDataFetcher] = None,
        config: Optional[Config] = None,
        initial_cash: Optional[float] = None,
        commission: Optional[float] = None,
        rebalance_frequency: Optional[str] = None,
        slippage: Optional[float] = None
    ):
        self.config = config or load_config()
        self.data_fetcher = data_fetcher or ETFDataFetcher(config=self.config)
        
        # Use provided values or fall back to config
        self.initial_cash = initial_cash or self.config.portfolio.default_initial_cash
        self.commission = commission if commission is not None else self.config.backtesting.default_commission
        self.rebalance_frequency = rebalance_frequency or self.config.backtesting.default_rebalance_frequency
        self.slippage = slippage if slippage is not None else self.config.backtesting.default_slippage
        
        self.logger = logging.getLogger(__name__)
        
    def run_backtest(
        self,
        strategy: Union[PortfolioStrategy, Dict[str, float]],
        etf_tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime],
        benchmark_ticker: Optional[str] = "SPY",
        **strategy_params
    ) -> BacktestResults:
        """Run a backtest for a given strategy."""
        # Fetch historical data
        self.logger.info(f"Fetching data for {len(etf_tickers)} ETFs...")
        price_data = self._fetch_price_data(etf_tickers, start_date, end_date)
        
        if not price_data:
            raise ValueError("No price data available for any of the specified ETFs")
        
        # Validate we have data for all tickers
        missing_tickers = set(etf_tickers) - set(price_data.keys())
        if missing_tickers:
            self.logger.warning(f"Missing data for tickers: {missing_tickers}")
        
        if benchmark_ticker:
            benchmark_data = self._fetch_price_data([benchmark_ticker], start_date, end_date)
            benchmark_prices = benchmark_data.get(benchmark_ticker)
            if benchmark_prices is None:
                self.logger.warning(f"No benchmark data available for {benchmark_ticker}")
        else:
            benchmark_prices = None
        
        # Initialize portfolio
        portfolio = Portfolio(name="Backtest Portfolio", cash=self.initial_cash)
        
        # Get rebalance dates
        rebalance_dates = self._get_rebalance_dates(price_data, self.rebalance_frequency)
        
        # Track portfolio values and transactions
        portfolio_values = []
        all_transactions = []
        
        # Process each trading day
        all_dates = sorted(price_data[next(iter(price_data))].index)
        
        for date in all_dates:
            # Update portfolio prices
            current_prices = {
                ticker: prices.loc[date] 
                for ticker, prices in price_data.items() 
                if date in prices.index
            }
            portfolio.update_prices(current_prices)
            
            # Rebalance if needed
            if date in rebalance_dates:
                self.logger.info(f"Rebalancing on {date}")
                
                # Calculate new weights
                if isinstance(strategy, PortfolioStrategy):
                    # Get returns data up to current date
                    returns_data = pd.DataFrame()
                    for ticker, prices in price_data.items():
                        if date in prices.index:
                            historical_prices = prices[:date]
                            if len(historical_prices) > 1:
                                returns_data[ticker] = historical_prices.pct_change()
                            else:
                                self.logger.warning(f"Insufficient data for {ticker} on {date}")
                    
                    returns_data = returns_data.dropna()
                    
                    if len(returns_data) > 1:  # Need at least 2 days of returns
                        try:
                            weights = strategy.calculate_weights(returns_data, **strategy_params)
                        except Exception as e:
                            self.logger.error(f"Strategy calculation failed on {date}: {str(e)}")
                            # Fall back to equal weight
                            weights = {ticker: 1/len(etf_tickers) for ticker in etf_tickers}
                    else:
                        # Equal weight for first rebalance
                        self.logger.info(f"Using equal weights on {date} due to insufficient data")
                        weights = {ticker: 1/len(etf_tickers) for ticker in etf_tickers}
                else:
                    # Static weights provided
                    weights = strategy
                
                # Execute rebalance
                trades = portfolio.rebalance(weights, current_prices)
                
                # Record transactions
                for trade in trades:
                    transaction = Transaction(
                        timestamp=date,
                        transaction_type=TransactionType.BUY if trade["action"] == "BUY" else TransactionType.SELL,
                        ticker=trade["ticker"],
                        shares=trade["shares"],
                        price=trade["price"] * (1 + self.slippage if trade["action"] == "BUY" else 1 - self.slippage),
                        commission=self.commission
                    )
                    all_transactions.append(transaction)
            
            # Record portfolio value
            portfolio_values.append({
                "date": date,
                "total_value": portfolio.total_value,
                "cash": portfolio.cash,
                "positions_value": portfolio.total_market_value
            })
        
        # Create results
        portfolio_df = pd.DataFrame(portfolio_values).set_index("date")
        
        results = BacktestResults(
            portfolio_values=portfolio_df,
            transactions=all_transactions,
            final_portfolio=deepcopy(portfolio),
            benchmark_prices=benchmark_prices,
            initial_value=self.initial_cash
        )
        
        return results
    
    def _fetch_price_data(
        self,
        tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime]
    ) -> Dict[str, pd.Series]:
        """Fetch and align price data for all tickers."""
        raw_data = self.data_fetcher.fetch_multiple_etfs(tickers, start_date, end_date)
        
        price_data = {}
        for ticker, df in raw_data.items():
            if not df.empty and "Close" in df.columns:
                price_data[ticker] = df["Close"]
        
        # Align all series to same dates
        if price_data:
            all_dates = pd.Index([])
            for series in price_data.values():
                all_dates = all_dates.union(series.index)
            
            aligned_data = {}
            for ticker, series in price_data.items():
                aligned_data[ticker] = series.reindex(all_dates).fillna(method="ffill")
            
            return aligned_data
        
        return {}
    
    def _get_rebalance_dates(
        self,
        price_data: Dict[str, pd.Series],
        frequency: str
    ) -> List[datetime]:
        """Get rebalancing dates based on frequency."""
        if not price_data:
            return []
        
        # Get all available dates
        all_dates = sorted(price_data[next(iter(price_data))].index)
        
        if frequency == "daily":
            return all_dates
        elif frequency == "weekly":
            # Rebalance on Mondays
            return [d for d in all_dates if d.weekday() == 0]
        elif frequency == "monthly":
            # Rebalance on first trading day of month
            rebalance_dates = []
            current_month = None
            for date in all_dates:
                if current_month != date.month:
                    rebalance_dates.append(date)
                    current_month = date.month
            return rebalance_dates
        elif frequency == "quarterly":
            # Rebalance on first trading day of quarter
            rebalance_dates = []
            current_quarter = None
            for date in all_dates:
                quarter = (date.month - 1) // 3
                if current_quarter != quarter:
                    rebalance_dates.append(date)
                    current_quarter = quarter
            return rebalance_dates
        elif frequency == "yearly":
            # Rebalance on first trading day of year
            rebalance_dates = []
            current_year = None
            for date in all_dates:
                if current_year != date.year:
                    rebalance_dates.append(date)
                    current_year = date.year
            return rebalance_dates
        else:
            raise ValueError(f"Unknown rebalance frequency: {frequency}")
    
    def run_multiple_backtests(
        self,
        strategies: Dict[str, Union[PortfolioStrategy, Dict[str, float]]],
        etf_tickers: List[str],
        start_date: Union[str, datetime],
        end_date: Union[str, datetime],
        benchmark_ticker: Optional[str] = "SPY",
        **common_params
    ) -> Dict[str, BacktestResults]:
        """Run multiple backtests and return results for comparison."""
        results = {}
        
        for name, strategy in strategies.items():
            self.logger.info(f"Running backtest for strategy: {name}")
            
            try:
                result = self.run_backtest(
                    strategy,
                    etf_tickers,
                    start_date,
                    end_date,
                    benchmark_ticker,
                    **common_params
                )
                results[name] = result
            except Exception as e:
                self.logger.error(f"Error in backtest for {name}: {str(e)}")
                continue
        
        return results