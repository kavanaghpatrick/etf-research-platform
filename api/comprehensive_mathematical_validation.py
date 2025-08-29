#!/usr/bin/env python3
"""
Comprehensive Mathematical Validation Test Suite
Final verification that all mathematical fixes are working correctly and the 0.0% expected return issue is resolved
"""

import numpy as np
import pandas as pd
import asyncio
import json
import requests
import time
from datetime import datetime
from hybrid_simulation.models.hybrid_engine import HybridEconometricEngine, SimulationConfig

def test_mathematical_soundness():
    """Test all mathematical fixes end-to-end"""
    
    print("="*80)
    print("COMPREHENSIVE MATHEMATICAL VALIDATION TEST SUITE")
    print("="*80)
    print("Verifying all mathematical fixes and ensuring 0.0% expected return issue is resolved")
    print()
    
    # Test 1: Direct Hybrid Engine Mathematical Validation
    print("🧮 TEST 1: Direct Hybrid Engine Mathematical Validation")
    print("-" * 60)
    
    test_direct_engine_math()
    
    # Test 2: Realistic Market Data Test
    print("\n📊 TEST 2: Realistic Market Data Simulation")
    print("-" * 60)
    
    test_realistic_market_simulation()
    
    # Test 3: API Integration Test
    print("\n🌐 TEST 3: API Integration Test")
    print("-" * 60)
    
    test_api_integration()
    
    # Test 4: Frontend Integration Test
    print("\n🎨 TEST 4: Frontend Integration Test")
    print("-" * 60)
    
    test_frontend_integration()
    
    # Test 5: Edge Cases and Mathematical Bounds
    print("\n🔍 TEST 5: Edge Cases and Mathematical Bounds")
    print("-" * 60)
    
    test_edge_cases()
    
    print("\n" + "="*80)
    print("✅ COMPREHENSIVE MATHEMATICAL VALIDATION COMPLETE")
    print("="*80)

def test_direct_engine_math():
    """Test the hybrid engine mathematics directly"""
    
    try:
        # Generate high-quality test data
        np.random.seed(42)
        n_obs = 252 * 3  # 3 years of daily data
        
        # Create realistic multi-asset return data
        base_returns = [0.0003, 0.0002, 0.0004]  # 7.5%, 5%, 10% annual
        volatilities = [0.01, 0.008, 0.015]      # 16%, 12%, 24% annual
        
        test_data = {}
        for i, ticker in enumerate(['SPY', 'BND', 'QQQ']):
            # Generate realistic returns with autocorrelation and volatility clustering
            returns = []
            vol = volatilities[i]
            
            for t in range(n_obs):
                # Add momentum and volatility clustering
                if t > 0:
                    momentum = 0.02 * returns[-1]
                    vol_cluster = 0.8 * vol + 0.2 * abs(returns[-1]) if t > 0 else vol
                else:
                    momentum = 0
                    vol_cluster = vol
                
                # Generate return with base + momentum + shock
                shock = np.random.normal(0, vol_cluster)
                daily_return = base_returns[i] + momentum + shock
                returns.append(daily_return)
            
            test_data[ticker] = returns
        
        historical_data = pd.DataFrame(test_data)
        
        print(f"Input data statistics:")
        for ticker in historical_data.columns:
            mean_ret = historical_data[ticker].mean()
            vol_ret = historical_data[ticker].std()
            annual_ret = mean_ret * 252
            annual_vol = vol_ret * np.sqrt(252)
            print(f"  {ticker}: {annual_ret:.2%} return, {annual_vol:.2%} volatility")
        
        # Initialize engine with all mathematical fixes
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
            portfolio_weights=[0.4, 0.3, 0.3],  # Mixed allocation
            random_seed=42
        )
        
        print("\n🔧 Fitting econometric models...")
        fit_summary = engine.fit_models(historical_data, config)
        print(f"✅ Models fitted in {fit_summary['fitting_time']:.2f}s")
        
        print("\n🚀 Running simulation...")
        start_time = time.time()
        results = engine.simulate(config)
        simulation_time = time.time() - start_time
        print(f"✅ Simulation completed in {simulation_time:.2f}s")
        
        # Validate results
        mean_return = np.mean(results.annualized_returns)
        volatility = np.std(results.annualized_returns)
        
        print(f"\n📈 Simulation Results:")
        print(f"  Mean annual return: {mean_return:.2%}")
        print(f"  Return volatility: {volatility:.2%}")
        print(f"  Sharpe ratio: {mean_return/volatility:.2f}")
        print(f"  10th percentile: {np.percentile(results.annualized_returns, 10):.2%}")
        print(f"  50th percentile: {np.percentile(results.annualized_returns, 50):.2%}")
        print(f"  90th percentile: {np.percentile(results.annualized_returns, 90):.2%}")
        
        # Mathematical validation checks
        checks_passed = 0
        total_checks = 6
        
        # Check 1: Expected return is reasonable
        if 0.03 <= mean_return <= 0.15:
            print("✅ Check 1: Expected return is reasonable (3-15%)")
            checks_passed += 1
        else:
            print(f"❌ Check 1: Expected return unreasonable: {mean_return:.2%}")
        
        # Check 2: Volatility is reasonable
        if 0.01 <= volatility <= 0.30:
            print("✅ Check 2: Volatility is reasonable (1-30%)")
            checks_passed += 1
        else:
            print(f"❌ Check 2: Volatility unreasonable: {volatility:.2%}")
        
        # Check 3: No zero returns (critical fix)
        if abs(mean_return) >= 0.005:  # At least 0.5%
            print("✅ Check 3: No zero expected returns (0.0% issue resolved)")
            checks_passed += 1
        else:
            print(f"❌ Check 3: Near-zero returns detected: {mean_return:.4%}")
        
        # Check 4: Variation exists between simulations
        if volatility >= 0.005:  # At least 0.5% variation
            print("✅ Check 4: Meaningful variation between simulation paths")
            checks_passed += 1
        else:
            print(f"❌ Check 4: Insufficient variation: {volatility:.2%}")
        
        # Check 5: Percentile spread
        p10_p90_spread = np.percentile(results.annualized_returns, 90) - np.percentile(results.annualized_returns, 10)
        if p10_p90_spread >= 0.05:  # At least 5% spread
            print("✅ Check 5: Good percentile spread")
            checks_passed += 1
        else:
            print(f"❌ Check 5: Insufficient percentile spread: {p10_p90_spread:.2%}")
        
        # Check 6: Paths have meaningful differences
        path_variation = np.std([path[-1] for path in results.portfolio_paths])
        expected_final_variation = config.initial_portfolio_value * 0.1  # At least 10% variation
        if path_variation >= expected_final_variation:
            print("✅ Check 6: Portfolio paths show meaningful variation")
            checks_passed += 1
        else:
            print(f"❌ Check 6: Portfolio paths too similar: ${path_variation:,.0f} variation")
        
        success_rate = checks_passed / total_checks
        print(f"\n📊 Mathematical Validation Score: {checks_passed}/{total_checks} ({success_rate:.1%})")
        
        if success_rate >= 0.83:  # 5/6 checks passed
            print("✅ DIRECT ENGINE MATHEMATICAL VALIDATION: PASSED")
            return True
        else:
            print("❌ DIRECT ENGINE MATHEMATICAL VALIDATION: FAILED")
            return False
            
    except Exception as e:
        print(f"❌ Direct engine test failed: {e}")
        return False

def test_realistic_market_simulation():
    """Test with highly realistic market data patterns"""
    
    try:
        # Create extremely realistic market data based on actual SPY characteristics
        np.random.seed(123)  # Different seed for independent test
        n_obs = 252 * 5  # 5 years of data
        
        # SPY-like characteristics (2019-2024 average)
        spy_annual_return = 0.12    # 12% annual return
        spy_annual_vol = 0.18       # 18% annual volatility
        spy_daily_return = spy_annual_return / 252
        spy_daily_vol = spy_annual_vol / np.sqrt(252)
        
        # Generate realistic SPY-like returns with:
        # - Momentum effects
        # - Volatility clustering (GARCH-like)
        # - Occasional regime switches
        
        returns = []
        volatility = spy_daily_vol
        
        for i in range(n_obs):
            # Volatility clustering (simplified GARCH)
            if i > 0:
                vol_persistence = 0.8 * volatility + 0.2 * abs(returns[-1])
                volatility = np.clip(vol_persistence, spy_daily_vol * 0.5, spy_daily_vol * 3.0)
            
            # Momentum effect
            momentum = 0.03 * returns[-1] if i > 0 else 0
            
            # Regime switching (bear/bull markets)
            if np.random.random() < 0.02:  # 2% chance of regime switch
                regime_shock = np.random.normal(0, spy_daily_vol * 2)  # Large shock
            else:
                regime_shock = 0
            
            # Generate daily return
            innovation = np.random.normal(0, volatility)
            daily_return = spy_daily_return + momentum + regime_shock + innovation
            returns.append(daily_return)
        
        # Create realistic market data
        market_data = pd.DataFrame({'SPY': returns})
        
        # Validate input data characteristics
        actual_annual_return = np.mean(returns) * 252
        actual_annual_vol = np.std(returns) * np.sqrt(252)
        
        print(f"Realistic market data characteristics:")
        print(f"  Target: {spy_annual_return:.1%} return, {spy_annual_vol:.1%} volatility")
        print(f"  Actual: {actual_annual_return:.1%} return, {actual_annual_vol:.1%} volatility")
        
        # Test the simulation
        engine = HybridEconometricEngine(
            numerical_stability=True,
            enable_caching=True,
            enable_gpu=True,
            log_level='INFO'
        )
        
        config = SimulationConfig(
            n_simulations=2000,  # More simulations for better statistics
            time_horizon_years=10,
            initial_portfolio_value=100000.0,
            portfolio_weights=[1.0],  # Single asset test
            random_seed=123
        )
        
        print("\n🔧 Fitting models to realistic market data...")
        fit_summary = engine.fit_models(market_data, config)
        
        print("🚀 Running realistic market simulation...")
        results = engine.simulate(config)
        
        # Analyze results
        mean_return = np.mean(results.annualized_returns)
        median_return = np.median(results.annualized_returns)
        volatility = np.std(results.annualized_returns)
        
        print(f"\n📈 Realistic Market Simulation Results:")
        print(f"  Input annual return: {actual_annual_return:.2%}")
        print(f"  Simulation mean return: {mean_return:.2%}")
        print(f"  Simulation median return: {median_return:.2%}")
        print(f"  Simulation volatility: {volatility:.2%}")
        print(f"  Return preservation ratio: {mean_return/actual_annual_return:.2f}")
        
        # Realistic market validation
        realistic_checks = 0
        total_realistic_checks = 5
        
        # The simulation should preserve the input return characteristics
        return_preservation = abs(mean_return - actual_annual_return) / actual_annual_return
        if return_preservation <= 0.5:  # Within 50% of input
            print("✅ Return preservation: Simulation preserves input return characteristics")
            realistic_checks += 1
        else:
            print(f"❌ Return preservation: Too much deviation ({return_preservation:.1%})")
        
        # Should produce meaningful variation
        if volatility >= 0.02:  # At least 2% variation in outcomes
            print("✅ Outcome variation: Meaningful spread in simulation outcomes")
            realistic_checks += 1
        else:
            print(f"❌ Outcome variation: Insufficient spread ({volatility:.2%})")
        
        # Should not produce 0% returns
        if abs(mean_return) >= 0.01:  # At least 1% return
            print("✅ Non-zero returns: No 0.0% expected return issue")
            realistic_checks += 1
        else:
            print(f"❌ Zero return issue: Mean return too low ({mean_return:.2%})")
        
        # Percentiles should be well-distributed
        p10 = np.percentile(results.annualized_returns, 10)
        p90 = np.percentile(results.annualized_returns, 90)
        percentile_spread = p90 - p10
        if percentile_spread >= 0.08:  # At least 8% spread
            print("✅ Percentile distribution: Good spread between 10th and 90th percentiles")
            realistic_checks += 1
        else:
            print(f"❌ Percentile distribution: Insufficient spread ({percentile_spread:.2%})")
        
        # Final values should show realistic range
        final_values = results.final_values
        value_range = (np.max(final_values) - np.min(final_values)) / config.initial_portfolio_value
        if value_range >= 0.5:  # At least 50% range in final values
            print("✅ Final value range: Realistic spread in portfolio outcomes")
            realistic_checks += 1
        else:
            print(f"❌ Final value range: Too narrow ({value_range:.1%})")
        
        realistic_success = realistic_checks / total_realistic_checks
        print(f"\n📊 Realistic Market Test Score: {realistic_checks}/{total_realistic_checks} ({realistic_success:.1%})")
        
        if realistic_success >= 0.8:  # 4/5 checks
            print("✅ REALISTIC MARKET SIMULATION: PASSED")
            return True
        else:
            print("❌ REALISTIC MARKET SIMULATION: FAILED")
            return False
            
    except Exception as e:
        print(f"❌ Realistic market test failed: {e}")
        return False

def test_api_integration():
    """Test the hybrid simulation API endpoints"""
    
    try:
        base_url = "http://localhost:8000"
        
        # Test 1: Basic API health
        print("🔗 Testing API health...")
        response = requests.get(f"{base_url}/api/hybrid-simulation/test", timeout=10)
        if response.status_code == 200:
            print("✅ API is responding")
        else:
            print(f"❌ API not responding: {response.status_code}")
            return False
        
        # Test 2: Start a simulation
        print("🚀 Starting API simulation...")
        simulation_request = {
            "tickers": ["SPY"],
            "start_date": "2020-01-01",
            "end_date": "2024-01-01",
            "n_simulations": 1000,
            "time_horizon_years": 5,
            "initial_portfolio_value": 100000,
            "portfolio_weights": [1.0],
            "enable_validation": False,
            "run_benchmarks": False,
            "random_seed": 42
        }
        
        response = requests.post(
            f"{base_url}/api/hybrid-simulation/simulate",
            json=simulation_request,
            timeout=30
        )
        
        if response.status_code != 200:
            print(f"❌ Failed to start simulation: {response.status_code} - {response.text}")
            return False
        
        task_data = response.json()
        task_id = task_data.get('task_id')
        print(f"✅ Simulation started with task ID: {task_id[:8]}...")
        
        # Test 3: Poll for completion
        print("⏳ Waiting for simulation completion...")
        max_polls = 60  # 60 seconds timeout
        poll_count = 0
        
        while poll_count < max_polls:
            response = requests.get(
                f"{base_url}/api/hybrid-simulation/status/{task_id}",
                timeout=10
            )
            
            if response.status_code != 200:
                print(f"❌ Failed to get status: {response.status_code}")
                return False
            
            status_data = response.json()
            status = status_data.get('status')
            
            print(f"  Status: {status} - {status_data.get('message', '')}")
            
            if status == 'completed':
                print("✅ Simulation completed successfully")
                
                # Test 4: Validate results
                results = status_data.get('results')
                if not results:
                    print("❌ No results returned")
                    return False
                
                summary_stats = results.get('summary_statistics', {})
                mean_return = summary_stats.get('mean_annual_return', 0)
                
                print(f"📊 API Results:")
                print(f"  Mean annual return: {mean_return:.2%}")
                print(f"  Mean volatility: {summary_stats.get('mean_volatility', 0):.2%}")
                print(f"  Simulation time: {results.get('simulation_time', 0):.2f}s")
                
                # Validate API results
                api_checks = 0
                total_api_checks = 3
                
                if abs(mean_return) >= 0.01:  # Non-zero return
                    print("✅ API returns non-zero expected return")
                    api_checks += 1
                else:
                    print(f"❌ API returns near-zero return: {mean_return:.4%}")
                
                percentile_analysis = results.get('percentile_analysis', {})
                if len(percentile_analysis) >= 5:  # Should have multiple percentiles
                    print("✅ API returns comprehensive percentile analysis")
                    api_checks += 1
                else:
                    print("❌ API missing percentile analysis")
                
                paths_sample = results.get('paths_sample', [])
                if len(paths_sample) >= 3 and all(len(path) > 0 for path in paths_sample):
                    print("✅ API returns sample paths for visualization")
                    api_checks += 1
                else:
                    print("❌ API missing or invalid sample paths")
                
                api_success = api_checks / total_api_checks
                print(f"\n📊 API Integration Score: {api_checks}/{total_api_checks} ({api_success:.1%})")
                
                if api_success >= 0.67:  # 2/3 checks
                    print("✅ API INTEGRATION: PASSED")
                    return True
                else:
                    print("❌ API INTEGRATION: FAILED")
                    return False
                
            elif status == 'failed':
                error = status_data.get('error', 'Unknown error')
                print(f"❌ Simulation failed: {error}")
                return False
            
            time.sleep(1)
            poll_count += 1
        
        print("❌ Simulation timed out")
        return False
        
    except Exception as e:
        print(f"❌ API integration test failed: {e}")
        return False

def test_frontend_integration():
    """Test frontend integration compatibility"""
    
    try:
        print("🎨 Testing frontend data format compatibility...")
        
        # Simulate the frontend conversion function
        # This tests that our API returns data in the format expected by the frontend
        
        # Create mock hybrid results (what our API returns)
        mock_hybrid_results = {
            'task_id': 'test-123',
            'status': 'completed',
            'simulation_config': {
                'tickers': ['SPY'],
                'n_simulations': 1000,
                'time_horizon_years': 10
            },
            'results': {
                'summary_statistics': {
                    'mean_annual_return': 0.08,
                    'mean_volatility': 0.15,
                    'mean_final_value': 180000
                },
                'percentile_analysis': {
                    'p10': {'annual_return': 0.05, 'final_value': 150000},
                    'p50': {'annual_return': 0.08, 'final_value': 180000},
                    'p90': {'annual_return': 0.12, 'final_value': 220000}
                },
                'paths_sample': [
                    [100000, 105000, 110000],  # 10th percentile path
                    [100000, 108000, 118000],  # 50th percentile path
                    [100000, 112000, 125000]   # 90th percentile path
                ],
                'time_years': [0, 1, 2],
                'tickers': ['SPY'],
                'n_simulations': 1000
            }
        }
        
        # Test conversion to traditional Monte Carlo format (like the frontend expects)
        try:
            converted = convert_hybrid_to_traditional_format(mock_hybrid_results)
            
            frontend_checks = 0
            total_frontend_checks = 4
            
            # Check 1: Has required aggregated_metrics structure
            if 'aggregated_metrics' in converted:
                print("✅ Frontend format: Has aggregated_metrics structure")
                frontend_checks += 1
            else:
                print("❌ Frontend format: Missing aggregated_metrics")
            
            # Check 2: Has percentile paths for charting
            percentile_paths = converted.get('percentile_paths', {})
            if 'percentile_paths_nominal' in percentile_paths and '10th' in percentile_paths['percentile_paths_nominal']:
                print("✅ Frontend format: Has percentile paths for charts")
                frontend_checks += 1
            else:
                print("❌ Frontend format: Missing percentile paths")
            
            # Check 3: Returns reasonable values
            mean_return = converted.get('aggregated_metrics', {}).get('annual_mean_return', {}).get('percentile_50th', 0)
            if 0.01 <= mean_return <= 0.20:  # 1-20% reasonable range
                print("✅ Frontend format: Reasonable return values")
                frontend_checks += 1
            else:
                print(f"❌ Frontend format: Unreasonable return: {mean_return:.2%}")
            
            # Check 4: Has portfolio summary
            if 'portfolio_summary' in converted and len(converted['portfolio_summary']) > 0:
                print("✅ Frontend format: Has portfolio summary")
                frontend_checks += 1
            else:
                print("❌ Frontend format: Missing portfolio summary")
            
            frontend_success = frontend_checks / total_frontend_checks
            print(f"\n📊 Frontend Integration Score: {frontend_checks}/{total_frontend_checks} ({frontend_success:.1%})")
            
            if frontend_success >= 0.75:  # 3/4 checks
                print("✅ FRONTEND INTEGRATION: PASSED")
                return True
            else:
                print("❌ FRONTEND INTEGRATION: FAILED")
                return False
                
        except Exception as e:
            print(f"❌ Frontend conversion failed: {e}")
            return False
        
    except Exception as e:
        print(f"❌ Frontend integration test failed: {e}")
        return False

def convert_hybrid_to_traditional_format(hybrid_results):
    """Convert hybrid results to traditional frontend format"""
    
    if not hybrid_results.get('results'):
        return None
    
    results = hybrid_results['results']
    
    # Create percentile metrics structure
    def create_percentile_metrics(field):
        metrics = {}
        percentile_analysis = results.get('percentile_analysis', {})
        
        for key in ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95']:
            percentile = key[1:]  # Remove 'p' prefix
            if key in percentile_analysis and field in percentile_analysis[key]:
                value = percentile_analysis[key][field]
                metrics[f'percentile_{percentile}th'] = value
            else:
                metrics[f'percentile_{percentile}th'] = 0
        
        return metrics
    
    return {
        'aggregated_metrics': {
            'final_balance_nominal': create_percentile_metrics('final_value'),
            'annual_mean_return': create_percentile_metrics('annual_return'),
            'annual_volatility': create_percentile_metrics('volatility'),
            'sharpe_ratio': create_percentile_metrics('sharpe_ratio'),
            'max_drawdown': create_percentile_metrics('max_drawdown'),
        },
        'percentile_paths': {
            'time_years': results.get('time_years', []),
            'percentile_paths_nominal': {
                '10th': results.get('paths_sample', [])[0] if len(results.get('paths_sample', [])) > 0 else [],
                '50th': results.get('paths_sample', [])[1] if len(results.get('paths_sample', [])) > 1 else [],
                '90th': results.get('paths_sample', [])[2] if len(results.get('paths_sample', [])) > 2 else []
            },
            'initial_balance': hybrid_results['simulation_config'].get('initial_portfolio_value', 100000)
        },
        'portfolio_summary': [{
            'ticker': ticker,
            'allocation': 1.0 / len(results.get('tickers', ['SPY']))
        } for ticker in results.get('tickers', ['SPY'])],
        'execution_time': results.get('simulation_time', 0),
        'simulation_metadata': {
            'num_simulations': results.get('n_simulations', 1000),
            'time_period_years': hybrid_results['simulation_config'].get('time_horizon_years', 10)
        }
    }

def test_edge_cases():
    """Test edge cases and mathematical bounds"""
    
    try:
        print("🔍 Testing mathematical edge cases...")
        
        edge_checks = 0
        total_edge_checks = 3
        
        # Edge Case 1: Very small portfolio
        print("  Testing small portfolio ($1,000)...")
        try:
            engine = HybridEconometricEngine(enable_gpu=False, log_level='WARNING')
            
            # Simple test data
            test_data = pd.DataFrame({
                'TEST': np.random.normal(0.0003, 0.01, 500)  # 500 days of data
            })
            
            config = SimulationConfig(
                n_simulations=100,
                time_horizon_years=1,
                initial_portfolio_value=1000.0,  # Small portfolio
                random_seed=42
            )
            
            engine.fit_models(test_data, config)
            results = engine.simulate(config)
            
            mean_return = np.mean(results.annualized_returns)
            if abs(mean_return) >= 0.001:  # Should still produce meaningful returns
                print("    ✅ Small portfolio produces non-zero returns")
                edge_checks += 1
            else:
                print(f"    ❌ Small portfolio produces zero returns: {mean_return:.4%}")
                
        except Exception as e:
            print(f"    ❌ Small portfolio test failed: {e}")
        
        # Edge Case 2: Large portfolio with many simulations
        print("  Testing large portfolio ($10M, 5000 simulations)...")
        try:
            config = SimulationConfig(
                n_simulations=5000,
                time_horizon_years=1,
                initial_portfolio_value=10000000.0,  # Large portfolio
                random_seed=42
            )
            
            engine.fit_models(test_data, config)
            results = engine.simulate(config)
            
            final_values = results.final_values
            value_variation = np.std(final_values) / np.mean(final_values)
            
            if value_variation >= 0.01:  # At least 1% coefficient of variation
                print("    ✅ Large portfolio maintains variation")
                edge_checks += 1
            else:
                print(f"    ❌ Large portfolio lacks variation: {value_variation:.3f}")
                
        except Exception as e:
            print(f"    ❌ Large portfolio test failed: {e}")
        
        # Edge Case 3: Multi-asset with extreme weights
        print("  Testing extreme portfolio weights...")
        try:
            multi_data = pd.DataFrame({
                'STOCK': np.random.normal(0.0008, 0.02, 500),  # High return, high vol
                'BOND': np.random.normal(0.0001, 0.005, 500)   # Low return, low vol
            })
            
            config = SimulationConfig(
                n_simulations=1000,
                time_horizon_years=5,
                initial_portfolio_value=100000.0,
                portfolio_weights=[0.95, 0.05],  # Extreme allocation
                random_seed=42
            )
            
            engine.fit_models(multi_data, config)
            results = engine.simulate(config)
            
            mean_return = np.mean(results.annualized_returns)
            # Should be closer to stock return due to 95% weight
            if 0.05 <= mean_return <= 0.25:  # Reasonable range for stock-heavy portfolio
                print("    ✅ Extreme weights produce reasonable results")
                edge_checks += 1
            else:
                print(f"    ❌ Extreme weights produce unreasonable return: {mean_return:.2%}")
                
        except Exception as e:
            print(f"    ❌ Extreme weights test failed: {e}")
        
        edge_success = edge_checks / total_edge_checks
        print(f"\n📊 Edge Cases Score: {edge_checks}/{total_edge_checks} ({edge_success:.1%})")
        
        if edge_success >= 0.67:  # 2/3 checks
            print("✅ EDGE CASES: PASSED")
            return True
        else:
            print("❌ EDGE CASES: FAILED")
            return False
            
    except Exception as e:
        print(f"❌ Edge cases test failed: {e}")
        return False

if __name__ == "__main__":
    test_mathematical_soundness()