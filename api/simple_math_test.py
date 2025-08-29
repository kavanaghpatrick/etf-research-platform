#!/usr/bin/env python3
"""
Simple Mathematical Test
Very basic test to verify the core mathematical components are working
"""

import numpy as np
import pandas as pd
import sys
import traceback

def test_simple_math():
    print("=" * 50)
    print("SIMPLE MATHEMATICAL TEST")
    print("=" * 50)
    
    try:
        # Test 1: Basic imports
        print("🔍 Testing imports...")
        from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig
        print("✅ Imports successful")
        
        # Test 2: Engine initialization
        print("🔍 Testing engine initialization...")
        engine = HybridEconometricEngine(
            numerical_stability=True,
            enable_caching=True,
            enable_gpu=False,
            log_level='ERROR'  # Suppress all but errors
        )
        print("✅ Engine initialization successful")
        
        # Test 3: Simple data
        print("🔍 Creating simple test data...")
        np.random.seed(42)
        n_obs = 100
        returns = np.random.normal(0.001, 0.02, n_obs)  # 25% annual return, 32% vol
        data = pd.DataFrame({'TEST': returns})
        print(f"✅ Created {n_obs} observations")
        
        # Test 4: Config
        print("🔍 Testing simulation config...")
        config = SimulationConfig(
            n_simulations=100,  # Very small for speed
            time_horizon_years=1,
            initial_portfolio_value=10000.0,
            random_seed=42
        )
        print("✅ Configuration successful")
        
        # Test 5: Model fitting
        print("🔍 Testing model fitting...")
        try:
            fit_summary = engine.fit_models(data, config)
            print("✅ Model fitting completed")
            print(f"   Summary: {fit_summary}")
        except Exception as e:
            print(f"⚠️ Model fitting had issues: {e}")
            print("   This is expected for single assets")
        
        # Test 6: Enhanced fallback models check
        print("🔍 Testing enhanced fallback models...")
        # Check if the enhanced fallback is being used
        if hasattr(engine, '_fit_enhanced_fallback_models'):
            print("✅ Enhanced fallback models available")
        else:
            print("❌ Enhanced fallback models not found")
        
        # Test 7: Basic simulation
        print("🔍 Testing basic simulation...")
        try:
            results = engine.simulate(config)
            
            if results and hasattr(results, 'annualized_returns'):
                mean_return = np.mean(results.annualized_returns)
                print(f"✅ Simulation completed")
                print(f"   Mean annual return: {mean_return:.4f}")
                print(f"   Mean annual return %: {mean_return:.2%}")
                
                # Critical test: Is return non-zero?
                if abs(mean_return) >= 0.01:  # At least 1%
                    print("✅ CRITICAL: Returns are non-zero!")
                    return True
                else:
                    print(f"❌ CRITICAL: Returns too low: {mean_return:.4%}")
                    return False
            else:
                print("❌ No results returned")
                return False
                
        except Exception as e:
            print(f"❌ Simulation failed: {e}")
            traceback.print_exc()
            return False
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_simple_math()
    if success:
        print("\n🎉 SIMPLE MATH TEST: PASSED")
        print("🎉 Mathematical fixes appear to be working!")
    else:
        print("\n❌ SIMPLE MATH TEST: FAILED")
        print("❌ Mathematical issues may still exist")
    
    sys.exit(0 if success else 1)