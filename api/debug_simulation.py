#!/usr/bin/env python3
"""
Debug the simulation step by step to understand why returns are inflated
"""

import numpy as np
import pandas as pd
from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig

def debug_simulation_details():
    """Debug the simulation mathematics step by step"""
    
    # Generate simple test data
    np.random.seed(42)
    n_obs = 252  # 1 year of daily data
    
    # Create very simple returns: exactly 7% annual
    target_annual_return = 0.07
    target_daily_return = target_annual_return / 252
    target_annual_vol = 0.15
    target_daily_vol = target_annual_vol / np.sqrt(252)
    
    print(f"=== Target Parameters ===")
    print(f"Annual return: {target_annual_return:.2%}")
    print(f"Daily return: {target_daily_return:.6f}")
    print(f"Annual volatility: {target_annual_vol:.2%}")
    print(f"Daily volatility: {target_daily_vol:.6f}")
    
    # Generate simple data
    daily_returns = np.random.normal(target_daily_return, target_daily_vol, n_obs)
    test_data = pd.DataFrame({'SPY': daily_returns})
    
    print(f"\n=== Actual Test Data ===")
    print(f"Mean daily return: {test_data['SPY'].mean():.6f}")
    print(f"Annualized return: {test_data['SPY'].mean() * 252:.2%}")
    print(f"Daily volatility: {test_data['SPY'].std():.6f}")
    print(f"Annualized volatility: {test_data['SPY'].std() * np.sqrt(252):.2%}")
    
    # Initialize engine
    engine = HybridEconometricEngine(
        numerical_stability=True,
        enable_caching=True,
        enable_gpu=False,  # Disable GPU for debugging
        log_level='DEBUG'
    )
    
    # Simple config
    config = SimulationConfig(
        n_simulations=100,   # Smaller for debugging
        time_horizon_years=10,  # Match validation test
        initial_portfolio_value=100000.0,
        portfolio_weights=[1.0],
        random_seed=42
    )
    
    print(f"\n=== Fitting Models ===")
    fit_summary = engine.fit_models(test_data, config)
    
    # Examine fitted models
    for asset, models in engine.fitted_models.items():
        print(f"\nAsset: {asset}")
        print(f"Historical mean: {models.get('historical_mean', 'N/A'):.6f}")
        print(f"Historical std: {models.get('historical_std', 'N/A'):.6f}")
        print(f"Fallback used: {models.get('fallback_used', False)}")
        
        if hasattr(models.get('var'), 'mean_return'):
            print(f"Fallback mean_return: {models['var'].mean_return:.6f}")
            print(f"Fallback volatility: {models['var'].volatility:.6f}")
    
    print(f"\n=== Running Simulation ===")
    results = engine.simulate(config)
    
    print(f"\n=== Simulation Results ===")
    print(f"Mean final value: ${np.mean(results.final_values):,.2f}")
    print(f"Expected final value for 7%: ${100000 * 1.07:,.2f}")
    print(f"Mean annual return: {np.mean(results.annualized_returns):.2%}")
    print(f"Volatility: {np.std(results.annualized_returns):.2%}")
    
    # Mathematical verification
    print(f"\n=== Mathematical Verification ===")
    
    # Check the CAGR calculation manually
    sample_final = results.final_values[0]
    manual_cagr = (sample_final / config.initial_portfolio_value) ** (1/config.time_horizon_years) - 1
    simulation_cagr = results.annualized_returns[0]
    
    print(f"Sample final value: ${sample_final:,.2f}")
    print(f"Manual CAGR: {manual_cagr:.4f}")
    print(f"Simulation CAGR: {simulation_cagr:.4f}")
    print(f"CAGR calculation correct: {abs(manual_cagr - simulation_cagr) < 0.0001}")
    
    # Check if the issue is in the simulation or calculation
    expected_final_for_input_mean = config.initial_portfolio_value * (1 + test_data['SPY'].mean())**252
    print(f"Expected final value based on input mean: ${expected_final_for_input_mean:,.2f}")
    
    return engine, results

if __name__ == "__main__":
    engine, results = debug_simulation_details()