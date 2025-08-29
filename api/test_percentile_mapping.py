#!/usr/bin/env python3
"""
Test to verify percentile mapping issue
"""

import requests
import json
import time

def test_percentile_mapping():
    print("Testing percentile mapping...")
    
    # Simulate with parameters that should give clear differences
    simulation_request = {
        'tickers': ['SPY', 'BND'],
        'start_date': '2020-01-01',
        'end_date': '2024-01-01',
        'n_simulations': 1000,
        'time_horizon_years': 10,  # 10 years as shown in the UI
        'initial_portfolio_value': 100000,
        'portfolio_weights': [0.6, 0.4],  # 60/40 portfolio
        'enable_validation': False,
        'run_benchmarks': False,
        'random_seed': 123  # Different seed for variety
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
        for i in range(30):
            time.sleep(1)
            status_response = requests.get(
                f'http://localhost:8000/api/hybrid-simulation/status/{task_id}',
                timeout=10
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                
                if status_data['status'] == 'completed':
                    results = status_data.get('results', {})
                    percentile_analysis = results.get('percentile_analysis', {})
                    
                    print("\n=== BACKEND API PERCENTILE DATA ===")
                    print("\nAnnual Returns (what backend sends):")
                    print(f"P10: {percentile_analysis.get('p10', {}).get('annual_return', 0):.4f} ({percentile_analysis.get('p10', {}).get('annual_return', 0)*100:.1f}%)")
                    print(f"P25: {percentile_analysis.get('p25', {}).get('annual_return', 0):.4f} ({percentile_analysis.get('p25', {}).get('annual_return', 0)*100:.1f}%)")
                    print(f"P50: {percentile_analysis.get('p50', {}).get('annual_return', 0):.4f} ({percentile_analysis.get('p50', {}).get('annual_return', 0)*100:.1f}%)")
                    print(f"P75: {percentile_analysis.get('p75', {}).get('annual_return', 0):.4f} ({percentile_analysis.get('p75', {}).get('annual_return', 0)*100:.1f}%)")
                    print(f"P90: {percentile_analysis.get('p90', {}).get('annual_return', 0):.4f} ({percentile_analysis.get('p90', {}).get('annual_return', 0)*100:.1f}%)")
                    
                    print("\nVolatility (what backend sends):")
                    print(f"P10: {percentile_analysis.get('p10', {}).get('volatility', 0):.4f} ({percentile_analysis.get('p10', {}).get('volatility', 0)*100:.1f}%)")
                    print(f"P25: {percentile_analysis.get('p25', {}).get('volatility', 0):.4f} ({percentile_analysis.get('p25', {}).get('volatility', 0)*100:.1f}%)")
                    print(f"P50: {percentile_analysis.get('p50', {}).get('volatility', 0):.4f} ({percentile_analysis.get('p50', {}).get('volatility', 0)*100:.1f}%)")
                    print(f"P75: {percentile_analysis.get('p75', {}).get('volatility', 0):.4f} ({percentile_analysis.get('p75', {}).get('volatility', 0)*100:.1f}%)")
                    print(f"P90: {percentile_analysis.get('p90', {}).get('volatility', 0):.4f} ({percentile_analysis.get('p90', {}).get('volatility', 0)*100:.1f}%)")
                    
                    print("\nFinal Values:")
                    print(f"P10: ${percentile_analysis.get('p10', {}).get('final_value', 0):,.0f}")
                    print(f"P50: ${percentile_analysis.get('p50', {}).get('final_value', 0):,.0f}")
                    print(f"P90: ${percentile_analysis.get('p90', {}).get('final_value', 0):,.0f}")
                    
                    # Check what the frontend would show
                    print("\n=== WHAT FRONTEND WOULD DISPLAY ===")
                    print("With formatPercentage multiplying by 100:")
                    p10_return = percentile_analysis.get('p10', {}).get('annual_return', 0)
                    p50_return = percentile_analysis.get('p50', {}).get('annual_return', 0)
                    p90_return = percentile_analysis.get('p90', {}).get('annual_return', 0)
                    
                    print(f"P10: {p10_return:.4f} * 100 = {p10_return*100:.1f}%")
                    print(f"P50: {p50_return:.4f} * 100 = {p50_return*100:.1f}%")
                    print(f"P90: {p90_return:.4f} * 100 = {p90_return*100:.1f}%")
                    
                    break
                    
    else:
        print(f"Failed to start simulation: {response.status_code}")

if __name__ == "__main__":
    test_percentile_mapping()