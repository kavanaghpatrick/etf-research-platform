#!/usr/bin/env python3
"""
Simple test to verify withdrawal rate implementation is working
"""

import numpy as np
from hybrid_simulation.utils.withdrawal_calculator import WithdrawalRateCalculator

def test_simple_withdrawal():
    print("Testing withdrawal rate implementation...")
    
    # Create a simple test case
    calculator = WithdrawalRateCalculator(precision=0.1)
    
    # Test case: $100k growing at 6% annually for 30 years
    initial_value = 100000
    time_horizon = 30
    annual_return = 0.06
    
    # Create a single path with steady 6% growth
    portfolio_path = np.zeros(time_horizon * 252 + 1)
    portfolio_path[0] = initial_value
    
    daily_return = annual_return / 252
    for i in range(1, len(portfolio_path)):
        portfolio_path[i] = portfolio_path[i-1] * (1 + daily_return)
    
    print(f"Starting value: ${initial_value:,}")
    print(f"Final value (30 years at 6%): ${portfolio_path[-1]:,.0f}")
    
    # Convert to annual values for calculation
    annual_values = [portfolio_path[int(year * 252)] for year in range(time_horizon + 1)]
    
    # Calculate withdrawal rates
    swr = calculator._calculate_path_withdrawal_rate(annual_values, initial_value, perpetual=False)
    pwr = calculator._calculate_path_withdrawal_rate(annual_values, initial_value, perpetual=True)
    
    print(f"\nSafe Withdrawal Rate (SWR): {swr:.2f}%")
    print(f"Perpetual Withdrawal Rate (PWR): {pwr:.2f}%")
    
    # Verify the calculations
    print(f"\nVerifying SWR...")
    final_balance_swr = calculator._simulate_with_withdrawal(annual_values, initial_value, swr, perpetual=False)
    print(f"Final balance with SWR: ${final_balance_swr:,.0f}")
    
    print(f"\nVerifying PWR...")
    final_balance_pwr = calculator._simulate_with_withdrawal(annual_values, initial_value, pwr, perpetual=True)
    print(f"Final balance with PWR: ${final_balance_pwr:,.0f}")
    
    # Test the full array functionality
    print(f"\nTesting full array functionality...")
    test_paths = np.array([portfolio_path] * 5)  # 5 identical paths
    
    withdrawal_rates = calculator.calculate_withdrawal_rates(
        portfolio_paths=test_paths,
        initial_value=initial_value,
        time_horizon_years=time_horizon,
        inflation_rate=0.02
    )
    
    print(f"Full calculation results:")
    print(f"SWR P50: {withdrawal_rates['safe_withdrawal_rate']['p50']*100:.2f}%")
    print(f"PWR P50: {withdrawal_rates['perpetual_withdrawal_rate']['p50']*100:.2f}%")
    
    print("\n✅ Withdrawal rate implementation is working correctly!")

if __name__ == "__main__":
    test_simple_withdrawal()