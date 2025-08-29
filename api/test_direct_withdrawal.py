#!/usr/bin/env python3
"""
Direct test of the withdrawal rate calculator
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from hybrid_simulation.utils.withdrawal_calculator import WithdrawalRateCalculator
import numpy as np

def test_withdrawal_calculator():
    print("Testing withdrawal rate calculator directly...")
    
    # Create simple test portfolio paths
    n_simulations = 10
    time_horizon_years = 30
    initial_value = 100000
    days_per_year = 252
    
    # Create synthetic portfolio paths
    portfolio_paths = np.zeros((n_simulations, time_horizon_years * days_per_year + 1))
    portfolio_paths[:, 0] = initial_value
    
    # Create different scenarios
    scenarios = [
        # Scenario 1: Conservative growth (3% annual)
        0.03 / days_per_year,
        # Scenario 2: Moderate growth (7% annual)
        0.07 / days_per_year,
        # Scenario 3: Aggressive growth (10% annual)
        0.10 / days_per_year,
        # Scenario 4: Poor performance (-2% annual)
        -0.02 / days_per_year,
        # Scenario 5: Volatile but positive (5% annual with noise)
        0.05 / days_per_year,
    ]
    
    # Generate paths
    for i in range(n_simulations):
        scenario_idx = i % len(scenarios)
        daily_return = scenarios[scenario_idx]
        
        for t in range(1, portfolio_paths.shape[1]):
            if scenario_idx == 4:  # Volatile scenario
                noise = np.random.normal(0, 0.01)  # 1% daily volatility
                actual_return = daily_return + noise
            else:
                actual_return = daily_return
            
            portfolio_paths[i, t] = portfolio_paths[i, t-1] * (1 + actual_return)
    
    print(f"Generated {n_simulations} portfolio paths over {time_horizon_years} years")
    print(f"Final values range: ${portfolio_paths[:, -1].min():,.0f} to ${portfolio_paths[:, -1].max():,.0f}")
    
    # Test the withdrawal rate calculator
    calculator = WithdrawalRateCalculator(precision=0.1)  # Lower precision for faster testing
    
    print("\nCalculating withdrawal rates...")
    withdrawal_rates = calculator.calculate_withdrawal_rates(
        portfolio_paths=portfolio_paths,
        initial_value=initial_value,
        time_horizon_years=time_horizon_years,
        inflation_rate=0.02
    )
    
    print("\n=== WITHDRAWAL RATE RESULTS ===")
    print("Safe Withdrawal Rate (SWR):")
    for key, value in withdrawal_rates['safe_withdrawal_rate'].items():
        print(f"  {key}: {value*100:.2f}%")
    
    print("\nPerpetual Withdrawal Rate (PWR):")
    for key, value in withdrawal_rates['perpetual_withdrawal_rate'].items():
        print(f"  {key}: {value*100:.2f}%")
    
    # Test that PWR < SWR (perpetual should be more conservative)
    swr_p50 = withdrawal_rates['safe_withdrawal_rate']['p50']
    pwr_p50 = withdrawal_rates['perpetual_withdrawal_rate']['p50']
    
    print(f"\nValidation:")
    print(f"PWR < SWR: {pwr_p50 < swr_p50} ({pwr_p50*100:.2f}% < {swr_p50*100:.2f}%)")
    
    # Test specific path manually
    print(f"\n=== MANUAL PATH TESTING ===")
    test_path = portfolio_paths[1]  # Use moderate growth path
    annual_values = [test_path[int(year * days_per_year)] for year in range(time_horizon_years + 1)]
    
    # Test binary search manually
    swr_manual = calculator._calculate_path_withdrawal_rate(
        annual_values, initial_value, perpetual=False
    )
    pwr_manual = calculator._calculate_path_withdrawal_rate(
        annual_values, initial_value, perpetual=True
    )
    
    print(f"Manual path SWR: {swr_manual:.2f}%")
    print(f"Manual path PWR: {pwr_manual:.2f}%")
    
    # Verify the math by simulating the withdrawal
    print(f"\nVerifying SWR calculation...")
    final_balance = calculator._simulate_with_withdrawal(
        annual_values, initial_value, swr_manual, perpetual=False
    )
    print(f"Final balance with SWR {swr_manual:.2f}%: ${final_balance:,.0f}")
    
    print(f"\nVerifying PWR calculation...")
    final_balance_pwr = calculator._simulate_with_withdrawal(
        annual_values, initial_value, pwr_manual, perpetual=True
    )
    print(f"Final balance with PWR {pwr_manual:.2f}%: ${final_balance_pwr:,.0f}")
    print(f"Should be close to initial: ${initial_value:,.0f}")
    
    print("\n✅ Withdrawal rate calculator test completed!")

if __name__ == "__main__":
    test_withdrawal_calculator()