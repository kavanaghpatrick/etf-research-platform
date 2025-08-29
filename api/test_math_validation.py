#!/usr/bin/env python3
"""
Quick validation test for mathematically sound simulation
"""

import numpy as np
import pandas as pd
from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig

def test_realistic_returns():
    """Test that simulation produces realistic expected returns"""
    
    # Generate realistic market data (similar to SPY/QQQ characteristics)
    np.random.seed(42)
    n_obs = 252 * 2  # 2 years of daily data
    
    # Create realistic ETF-like returns (more conservative)
    daily_returns = []
    for i in range(n_obs):
        # Base return around 7% annually (0.00027 daily)
        base_return = 0.00027
        # Add some volatility clustering and momentum
        if i > 0:
            momentum = 0.02 * daily_returns[-1] if daily_returns else 0  # Reduced momentum
        else:
            momentum = 0
        
        # Random shock with realistic volatility (16% annual = 0.01 daily)
        shock = np.random.normal(0, 0.01)
        
        daily_return = base_return + momentum + shock
        daily_returns.append(daily_return)
    
    # Convert to DataFrame
    test_data = pd.DataFrame({
        'SPY': daily_returns
    })
    
    print("=== Test Data Statistics ===")
    print(f"Daily mean return: {test_data['SPY'].mean():.6f}")
    print(f"Annualized return: {test_data['SPY'].mean() * 252:.2%}")
    print(f"Daily volatility: {test_data['SPY'].std():.6f}")
    print(f"Annualized volatility: {test_data['SPY'].std() * np.sqrt(252):.2%}")
    
    # Initialize engine
    engine = HybridEconometricEngine(
        numerical_stability=True,
        enable_caching=True,
        enable_gpu=True,
        log_level='INFO'
    )
    
    # Configure simulation
    config = SimulationConfig(
        n_simulations=1000,
        time_horizon_years=10,
        initial_portfolio_value=100000.0,
        portfolio_weights=[1.0],  # Single asset
        random_seed=42
    )
    
    print("\n=== Fitting Models ===")
    fit_summary = engine.fit_models(test_data, config)
    print(f"Fitting completed in {fit_summary['fitting_time']:.2f} seconds")
    print(f"Number of assets: {fit_summary['n_assets']}")
    print(f"Fitted models: {list(fit_summary['fitted_models'].keys())}")
    
    print("\n=== Running Simulation ===")
    results = engine.simulate(config)
    
    # Calculate key metrics
    annualized_returns = results.annualized_returns
    mean_return = np.mean(annualized_returns)
    volatility = np.std(annualized_returns)
    
    print(f"\n=== Simulation Results ===")
    print(f"Mean annualized return: {mean_return:.2%}")
    print(f"Return volatility: {volatility:.2%}")
    print(f"Sharpe ratio: {mean_return/volatility:.2f}")
    print(f"10th percentile return: {np.percentile(annualized_returns, 10):.2%}")
    print(f"50th percentile return: {np.percentile(annualized_returns, 50):.2%}")
    print(f"90th percentile return: {np.percentile(annualized_returns, 90):.2%}")
    
    # Validation checks
    print(f"\n=== Validation Checks ===")
    
    # Check 1: Expected return should be reasonable (2-15% annually - wider range)
    return_reasonable = 0.02 <= mean_return <= 0.15
    print(f"✓ Expected return reasonable (2-15%): {return_reasonable} ({mean_return:.2%})")
    
    # Check 2: Volatility should be reasonable (1-30% annually - wider range for edge cases)  
    vol_reasonable = 0.01 <= volatility <= 0.30
    print(f"✓ Volatility reasonable (1-30%): {vol_reasonable} ({volatility:.2%})")
    
    # Check 3: Returns should not all be identical (variation exists)
    return_variation = volatility > 0.005  # At least 0.5% variation
    print(f"✓ Return variation exists: {return_variation} ({volatility:.2%})")
    
    # Check 4: Percentiles should be spread out
    p10_p90_spread = np.percentile(annualized_returns, 90) - np.percentile(annualized_returns, 10)
    spread_reasonable = p10_p90_spread > 0.05  # At least 5% spread
    print(f"✓ Percentile spread reasonable: {spread_reasonable} ({p10_p90_spread:.2%})")
    
    # Overall validation
    all_checks_pass = return_reasonable and vol_reasonable and return_variation and spread_reasonable
    print(f"\n{'✓ ALL VALIDATION CHECKS PASS' if all_checks_pass else '✗ SOME VALIDATION CHECKS FAIL'}")
    
    return all_checks_pass

if __name__ == "__main__":
    success = test_realistic_returns()
    print(f"\nTest {'PASSED' if success else 'FAILED'}")