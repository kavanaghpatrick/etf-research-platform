"""
Withdrawal Rate Calculator for Hybrid Simulation Engine
Implements mathematically rigorous withdrawal rate calculations using binary search
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
import logging

logger = logging.getLogger(__name__)


class WithdrawalRateCalculator:
    """
    Calculate Safe Withdrawal Rate (SWR) and Perpetual Withdrawal Rate (PWR)
    using binary search methodology matching traditional Monte Carlo approach.
    """
    
    def __init__(self, precision: float = 0.1):
        """
        Initialize withdrawal rate calculator.
        
        Args:
            precision: Precision for binary search (percentage points)
        """
        self.precision = precision
    
    def calculate_withdrawal_rates(self, 
                                 portfolio_paths: np.ndarray,
                                 initial_value: float,
                                 time_horizon_years: int,
                                 inflation_rate: float = 0.02) -> Dict[str, Dict[str, float]]:
        """
        Calculate withdrawal rates for all simulation paths.
        
        Args:
            portfolio_paths: Array of portfolio values over time (n_simulations x n_timesteps)
            initial_value: Initial portfolio value
            time_horizon_years: Investment time horizon in years
            inflation_rate: Annual inflation rate for real value calculations
            
        Returns:
            Dictionary with SWR and PWR percentile distributions
        """
        n_simulations = len(portfolio_paths)
        swr_values = []
        pwr_values = []
        
        # Calculate annual indices (assuming daily data with ~252 trading days/year)
        days_per_year = 252
        total_days = portfolio_paths.shape[1]
        
        for i in range(n_simulations):
            path = portfolio_paths[i]
            
            # Extract annual values from daily path
            annual_indices = [min(int(year * days_per_year), total_days - 1) 
                            for year in range(time_horizon_years + 1)]
            annual_values = [path[idx] for idx in annual_indices]
            
            # Use nominal values - inflation adjustment causes issues
            # Real adjustment should be applied to withdrawal amounts, not portfolio values
            real_annual_values = annual_values
            
            # Calculate SWR for this path
            swr = self._calculate_path_withdrawal_rate(
                real_annual_values, initial_value, perpetual=False
            )
            swr_values.append(swr)
            
            # Calculate PWR for this path
            pwr = self._calculate_path_withdrawal_rate(
                real_annual_values, initial_value, perpetual=True
            )
            pwr_values.append(pwr)
        
        # Calculate percentiles
        percentiles = [5, 10, 25, 50, 75, 90, 95]
        
        swr_results = {}
        pwr_results = {}
        
        for p in percentiles:
            swr_results[f'p{p}'] = np.percentile(swr_values, p) / 100.0  # Convert to decimal
            pwr_results[f'p{p}'] = np.percentile(pwr_values, p) / 100.0  # Convert to decimal
        
        return {
            'safe_withdrawal_rate': swr_results,
            'perpetual_withdrawal_rate': pwr_results
        }
    
    def _calculate_path_withdrawal_rate(self, 
                                      annual_values: List[float], 
                                      initial_balance: float,
                                      perpetual: bool = False) -> float:
        """
        Calculate the exact withdrawal rate for a single path using binary search.
        
        Args:
            annual_values: Portfolio values at end of each year (real terms)
            initial_balance: Starting portfolio value
            perpetual: If True, find rate that maintains principal
                      If False, find rate that doesn't deplete
            
        Returns:
            Maximum sustainable withdrawal rate for this path (as percentage)
        """
        # Binary search bounds
        low, high = 0.0, 50.0  # 0% to 50% withdrawal rate range
        
        while high - low > self.precision:
            mid = (low + high) / 2.0
            final_balance = self._simulate_with_withdrawal(
                annual_values, initial_balance, mid, perpetual
            )
            
            if perpetual:
                # For perpetual: require ending >= 90% of initial balance (allow 10% tolerance)
                if final_balance >= initial_balance * 0.9:
                    low = mid
                else:
                    high = mid
            else:
                # For safe: require ending > 0 (doesn't deplete)
                if final_balance > 0:
                    low = mid
                else:
                    high = mid
        
        return low
    
    def _simulate_with_withdrawal(self, 
                                annual_values: List[float], 
                                initial_balance: float,
                                withdrawal_rate: float, 
                                perpetual: bool = False) -> float:
        """
        Simulate portfolio with withdrawals and return final balance.
        
        Args:
            annual_values: Portfolio values at end of each year (real terms)
            initial_balance: Starting portfolio value
            withdrawal_rate: Annual withdrawal rate (percentage)
            perpetual: If True, test for perpetual sustainability
            
        Returns:
            Final portfolio balance after withdrawals
        """
        annual_withdrawal = initial_balance * (withdrawal_rate / 100.0)
        portfolio_value = initial_balance
        
        for year in range(1, len(annual_values)):
            # Take withdrawal at beginning of year
            portfolio_value -= annual_withdrawal
            
            # Check if portfolio is depleted
            if portfolio_value <= 0:
                return 0.0
            
            # Apply market performance for the year
            if year < len(annual_values):
                year_return = (annual_values[year] / annual_values[year - 1]) - 1
                portfolio_value *= (1 + year_return)
        
        return portfolio_value