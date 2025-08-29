#!/usr/bin/env python3
"""
Test simple TWRR calculation to diagnose the issue
"""
import numpy as np

def test_twrr():
    """Test simple TWRR calculation"""
    print("🧮 Testing TWRR Calculation")
    print("=" * 40)
    
    # Simple test case: 10% annual growth
    annual_return = 0.10
    years = 30
    
    # Simulate daily returns for consistent 10% annual growth
    trading_days = years * 252
    daily_return = (1 + annual_return) ** (1/252) - 1
    daily_returns = np.full(trading_days, daily_return)
    
    print(f"Daily return for 10% annual: {daily_return:.6f}")
    
    # Calculate cumulative returns
    cumulative_returns = np.cumprod(1 + daily_returns)
    final_cumulative = cumulative_returns[-1]
    
    print(f"Final cumulative factor: {final_cumulative:.3f}")
    print(f"Expected cumulative factor: {(1.10)**30:.3f}")
    
    # Calculate TWRR
    if final_cumulative > 0:
        twrr_nominal = (final_cumulative ** (1 / years)) - 1
        print(f"TWRR result: {twrr_nominal:.4f} ({twrr_nominal*100:.2f}%)")
        print(f"Expected: 0.1000 (10.00%)")
    else:
        print("ERROR: Negative cumulative returns!")
    
    print("\n" + "=" * 40)
    
    # Test with some losses
    print("Testing with realistic market returns...")
    
    # Simulate more realistic returns: mix of good and bad days
    np.random.seed(42)  # For reproducibility
    realistic_returns = np.random.normal(0.0003, 0.01, trading_days)  # ~8% annual, 16% vol
    
    # Add some extreme days but cap them
    realistic_returns = np.clip(realistic_returns, -0.10, 0.10)  # Cap at ±10%
    
    cumulative_realistic = np.cumprod(1 + realistic_returns)
    final_realistic = cumulative_realistic[-1]
    
    print(f"Realistic final cumulative: {final_realistic:.3f}")
    
    if final_realistic > 0:
        twrr_realistic = (final_realistic ** (1 / years)) - 1
        print(f"Realistic TWRR: {twrr_realistic:.4f} ({twrr_realistic*100:.2f}%)")
    else:
        print("ERROR: Realistic simulation went negative!")
    
    # Test with inflation adjustment
    inflation_rates = np.full(years, 3.0)  # 3% annual inflation
    cumulative_inflation = np.prod(1 + inflation_rates / 100)
    
    print(f"Cumulative inflation factor (30 years at 3%): {cumulative_inflation:.3f}")
    
    # Real return calculation
    if final_realistic > 0:
        geometric_inflation = (cumulative_inflation ** (1.0 / years)) - 1
        twrr_real = ((1 + twrr_realistic) / (1 + geometric_inflation)) - 1
        print(f"Real TWRR: {twrr_real:.4f} ({twrr_real*100:.2f}%)")
        
        if twrr_real < -0.5:
            print("🚨 PROBLEM: Real TWRR is extremely negative!")
        else:
            print("✅ Real TWRR looks reasonable")

if __name__ == "__main__":
    test_twrr()