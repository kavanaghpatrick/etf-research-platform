#!/usr/bin/env python3
"""
Quick Mathematical Validation Test
Focused test to verify core mathematical fixes are working
"""

import numpy as np
import pandas as pd
import time
from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig

def run_quick_validation():
    """Run a quick validation of the mathematical fixes"""
    
    print("=" * 60)
    print("QUICK MATHEMATICAL VALIDATION TEST")
    print("=" * 60)
    print("Testing core mathematical fixes for 0.0% expected return issue")
    print()
    
    try:
        # Generate realistic multi-asset test data
        np.random.seed(42)
        n_obs = 500  # Reduced for speed
        
        # Create realistic returns for multiple assets
        base_returns = [0.0008, 0.0003, 0.0006]  # 20%, 7.5%, 15% annual
        volatilities = [0.015, 0.010, 0.020]      # 24%, 16%, 32% annual
        
        test_data = {}
        for i, ticker in enumerate(['STOCK', 'BOND', 'GROWTH']):
            returns = []
            vol = volatilities[i]
            
            for t in range(n_obs):
                # Add some autocorrelation and volatility clustering
                if t > 0:
                    momentum = 0.02 * returns[-1]
                    vol_adj = vol * (1 + 0.1 * abs(returns[-1]) / vol)
                else:
                    momentum = 0
                    vol_adj = vol
                
                daily_return = base_returns[i] + momentum + np.random.normal(0, vol_adj)
                returns.append(daily_return)
            
            test_data[ticker] = returns
        
        historical_data = pd.DataFrame(test_data)
        
        print("Input data characteristics:")
        for ticker in historical_data.columns:
            mean_ret = historical_data[ticker].mean()
            vol_ret = historical_data[ticker].std()
            annual_ret = mean_ret * 252
            annual_vol = vol_ret * np.sqrt(252)
            print(f"  {ticker}: {annual_ret:.2%} return, {annual_vol:.2%} volatility")
        print()
        
        # Initialize engine
        print("🔧 Initializing hybrid engine...")
        engine = HybridEconometricEngine(
            numerical_stability=True,
            enable_caching=True,
            enable_gpu=False,  # Disable GPU for speed
            log_level='WARNING'  # Reduce logging
        )
        
        # Configure simulation
        config = SimulationConfig(
            n_simulations=1000,  # Reduced for speed
            time_horizon_years=5,  # Reduced for speed
            initial_portfolio_value=100000.0,
            portfolio_weights=[0.5, 0.3, 0.2],  # Balanced allocation
            random_seed=42
        )
        
        print("🔧 Fitting models...")
        start_time = time.time()
        fit_summary = engine.fit_models(historical_data, config)
        fitting_time = time.time() - start_time
        print(f"✅ Models fitted in {fitting_time:.2f}s")
        
        print("🚀 Running simulation...")
        start_time = time.time()
        results = engine.simulate(config)
        simulation_time = time.time() - start_time
        print(f"✅ Simulation completed in {simulation_time:.2f}s")
        
        # Analyze results
        mean_return = np.mean(results.annualized_returns)
        median_return = np.median(results.annualized_returns)
        volatility = np.std(results.annualized_returns)
        
        print()
        print("📈 SIMULATION RESULTS:")
        print(f"  Mean annual return: {mean_return:.2%}")
        print(f"  Median annual return: {median_return:.2%}")
        print(f"  Return volatility: {volatility:.2%}")
        print(f"  10th percentile: {np.percentile(results.annualized_returns, 10):.2%}")
        print(f"  50th percentile: {np.percentile(results.annualized_returns, 50):.2%}")
        print(f"  90th percentile: {np.percentile(results.annualized_returns, 90):.2%}")
        print()
        
        # Critical validation checks
        print("🔍 MATHEMATICAL VALIDATION CHECKS:")
        
        checks_passed = 0
        total_checks = 5
        
        # Check 1: Non-zero expected return (critical fix)
        if abs(mean_return) >= 0.02:  # At least 2%
            print("✅ Check 1: Expected return is non-zero and reasonable")
            checks_passed += 1
        else:
            print(f"❌ Check 1: Expected return too low: {mean_return:.4%}")
        
        # Check 2: Meaningful variation
        if volatility >= 0.02:  # At least 2% variation
            print("✅ Check 2: Meaningful variation in outcomes")
            checks_passed += 1
        else:
            print(f"❌ Check 2: Insufficient variation: {volatility:.4%}")
        
        # Check 3: Reasonable range
        if 0.03 <= mean_return <= 0.25:  # 3-25% reasonable for mixed portfolio
            print("✅ Check 3: Returns within reasonable range")
            checks_passed += 1
        else:
            print(f"❌ Check 3: Returns outside reasonable range: {mean_return:.2%}")
        
        # Check 4: Percentile spread
        p10_p90_spread = np.percentile(results.annualized_returns, 90) - np.percentile(results.annualized_returns, 10)
        if p10_p90_spread >= 0.08:  # At least 8% spread
            print("✅ Check 4: Good percentile spread")
            checks_passed += 1
        else:
            print(f"❌ Check 4: Insufficient percentile spread: {p10_p90_spread:.2%}")
        
        # Check 5: Portfolio path variation
        if hasattr(results, 'portfolio_paths') and results.portfolio_paths is not None:
            path_variation = np.std([path[-1] for path in results.portfolio_paths])
            expected_variation = config.initial_portfolio_value * 0.1  # At least 10%
            if path_variation >= expected_variation:
                print("✅ Check 5: Portfolio paths show meaningful variation")
                checks_passed += 1
            else:
                print(f"❌ Check 5: Portfolio paths too similar: ${path_variation:,.0f}")
        else:
            print("❌ Check 5: No portfolio paths available")
        
        print()
        success_rate = checks_passed / total_checks
        print(f"📊 VALIDATION SCORE: {checks_passed}/{total_checks} ({success_rate:.1%})")
        
        if success_rate >= 0.8:  # 4/5 checks passed
            print("✅ MATHEMATICAL FIXES: VALIDATION PASSED")
            print("✅ 0.0% expected return issue appears to be RESOLVED")
            return True
        else:
            print("❌ MATHEMATICAL FIXES: VALIDATION FAILED")
            print("❌ 0.0% expected return issue may still exist")
            return False
        
    except Exception as e:
        print(f"❌ Quick validation failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_quick_validation()
    exit(0 if success else 1)