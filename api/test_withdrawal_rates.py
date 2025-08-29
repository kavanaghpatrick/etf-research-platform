#!/usr/bin/env python3
"""
Test withdrawal rate calculations
"""

import requests
import json
import time

def test_withdrawal_rates():
    print("Testing withdrawal rate calculations...")
    
    # Simulate with parameters that should give clear differences
    simulation_request = {
        'tickers': ['SPY', 'BND'],
        'start_date': '2020-01-01',
        'end_date': '2024-01-01',
        'n_simulations': 100,
        'time_horizon_years': 30,  # 30 years for retirement
        'initial_portfolio_value': 100000,
        'portfolio_weights': [0.6, 0.4],  # 60/40 portfolio
        'var_max_lags': 3,
        'garch_distribution': 'normal',
        'preserve_mean': True,
        'use_parallel': True,
        'use_gpu': False,
        'gpu_memory_fraction': 0.8,
        'enable_validation': False,
        'run_benchmarks': False,
        'random_seed': 42  # Fixed seed for reproducibility
    }
    
    response = requests.post(
        'http://localhost:8000/api/hybrid-simulation/simulate',
        json=simulation_request,
        timeout=30
    )
    
    if response.status_code == 200:
        task_data = response.json()
        task_id = task_data['task_id']
        
        # Wait for completion
        print(f"Task started: {task_id}")
        for i in range(60):  # Wait up to 60 seconds
            time.sleep(1)
            status_response = requests.get(
                f'http://localhost:8000/api/hybrid-simulation/status/{task_id}',
                timeout=30
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                print(f"Status: {status_data['status']}")
                
                if status_data['status'] == 'completed':
                    results = status_data.get('results', {})
                    percentile_analysis = results.get('percentile_analysis', {})
                    
                    print("\n=== WITHDRAWAL RATE CALCULATION RESULTS ===")
                    print("Safe Withdrawal Rate (SWR) - Portfolio depletion at end of period:")
                    print(f"P10: {percentile_analysis.get('p10', {}).get('safe_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P25: {percentile_analysis.get('p25', {}).get('safe_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P50: {percentile_analysis.get('p50', {}).get('safe_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P75: {percentile_analysis.get('p75', {}).get('safe_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P90: {percentile_analysis.get('p90', {}).get('safe_withdrawal_rate', 0)*100:.2f}%")
                    
                    print("\nPerpetual Withdrawal Rate (PWR) - Maintains principal:")
                    print(f"P10: {percentile_analysis.get('p10', {}).get('perpetual_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P25: {percentile_analysis.get('p25', {}).get('perpetual_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P50: {percentile_analysis.get('p50', {}).get('perpetual_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P75: {percentile_analysis.get('p75', {}).get('perpetual_withdrawal_rate', 0)*100:.2f}%")
                    print(f"P90: {percentile_analysis.get('p90', {}).get('perpetual_withdrawal_rate', 0)*100:.2f}%")
                    
                    print("\nComparison with Annual Returns:")
                    print(f"P10 Return: {percentile_analysis.get('p10', {}).get('annual_return', 0)*100:.2f}%")
                    print(f"P50 Return: {percentile_analysis.get('p50', {}).get('annual_return', 0)*100:.2f}%")
                    print(f"P90 Return: {percentile_analysis.get('p90', {}).get('annual_return', 0)*100:.2f}%")
                    
                    print("\nExpected Relationship:")
                    print("- PWR should be lower than SWR (perpetual vs depletion)")
                    print("- PWR should be close to, but less than, annual returns")
                    print("- SWR should be higher than PWR (allows capital depletion)")
                    
                    # Validation
                    p50_swr = percentile_analysis.get('p50', {}).get('safe_withdrawal_rate', 0)
                    p50_pwr = percentile_analysis.get('p50', {}).get('perpetual_withdrawal_rate', 0)
                    p50_return = percentile_analysis.get('p50', {}).get('annual_return', 0)
                    
                    print(f"\nValidation:")
                    print(f"PWR < SWR: {p50_pwr < p50_swr} ({p50_pwr:.4f} < {p50_swr:.4f})")
                    print(f"PWR < Return: {p50_pwr < p50_return} ({p50_pwr:.4f} < {p50_return:.4f})")
                    print(f"SWR > PWR: {p50_swr > p50_pwr} ({p50_swr:.4f} > {p50_pwr:.4f})")
                    
                    break
                elif status_data['status'] == 'failed':
                    print(f"Simulation failed: {status_data.get('error', 'Unknown error')}")
                    break
    else:
        print(f"Failed to start simulation: {response.status_code}")
        if response.content:
            print(f"Error: {response.content.decode()}")

if __name__ == "__main__":
    test_withdrawal_rates()