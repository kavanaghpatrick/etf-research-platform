#!/usr/bin/env python3
"""
Test the conversion from hybrid results to traditional format
"""

import requests
import json

def test_conversion():
    print("=" * 60)
    print("TESTING HYBRID TO TRADITIONAL CONVERSION")
    print("=" * 60)
    
    # Get actual hybrid results
    simulation_request = {
        'tickers': ['SPY'],
        'start_date': '2020-01-01',
        'end_date': '2024-01-01',
        'n_simulations': 1000,
        'time_horizon_years': 2,
        'initial_portfolio_value': 10000,
        'portfolio_weights': [1.0],
        'enable_validation': False,
        'run_benchmarks': False,
        'random_seed': 42
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
        import time
        for i in range(30):
            time.sleep(1)
            status_response = requests.get(
                f'http://localhost:8000/api/hybrid-simulation/status/{task_id}',
                timeout=10
            )
            
            if status_response.status_code == 200:
                status_data = status_response.json()
                
                if status_data['status'] == 'completed':
                    print("✅ Got hybrid results from API")
                    
                    # Test the conversion manually
                    results = status_data.get('results', {})
                    
                    print("\n=== HYBRID RESULTS STRUCTURE ===")
                    print(f"Has percentile_analysis: {bool(results.get('percentile_analysis'))}")
                    print(f"Has paths_sample: {bool(results.get('paths_sample'))}")
                    print(f"Has summary_statistics: {bool(results.get('summary_statistics'))}")
                    
                    # Check percentile analysis
                    percentile_analysis = results.get('percentile_analysis', {})
                    if percentile_analysis:
                        print(f"Percentile keys: {list(percentile_analysis.keys())}")
                        
                        # Check p50 data
                        p50_data = percentile_analysis.get('p50', {})
                        print(f"P50 annual_return: {p50_data.get('annual_return', 'missing')}")
                        print(f"P50 final_value: {p50_data.get('final_value', 'missing')}")
                        
                        # Check p10/p90 spread
                        p10_return = percentile_analysis.get('p10', {}).get('annual_return', 0)
                        p90_return = percentile_analysis.get('p90', {}).get('annual_return', 0)
                        print(f"P10 return: {p10_return:.2%}, P90 return: {p90_return:.2%}")
                        print(f"Return spread: {p90_return - p10_return:.2%}")
                    
                    # Now test the conversion logic
                    print("\n=== TESTING CONVERSION LOGIC ===")
                    
                    # Manual conversion test
                    percentile_keys = ['p5', 'p10', 'p25', 'p50', 'p75', 'p90', 'p95']
                    
                    def create_percentile_metrics(field):
                        metrics = {}
                        for key in percentile_keys:
                            percentile = key[1:]  # Remove 'p' prefix
                            if (percentile_analysis and 
                                percentile_analysis.get(key) and 
                                percentile_analysis[key].get(field) is not None):
                                value = percentile_analysis[key][field]
                                metrics[f'percentile_{percentile}th'] = value
                                print(f"  {key}.{field} = {value} -> percentile_{percentile}th")
                            else:
                                metrics[f'percentile_{percentile}th'] = 0
                                print(f"  {key}.{field} = MISSING -> percentile_{percentile}th = 0")
                        return metrics
                    
                    # Test annual_return conversion
                    print("\nTesting annual_return conversion:")
                    annual_return_metrics = create_percentile_metrics('annual_return')
                    
                    print(f"\nFinal annual_return metrics: {annual_return_metrics}")
                    
                    # Check if all values are 0 or very small
                    non_zero_values = [v for v in annual_return_metrics.values() if abs(v) > 0.001]
                    if len(non_zero_values) == 0:
                        print("❌ PROBLEM: All annual return values are near zero!")
                    else:
                        print(f"✅ {len(non_zero_values)} non-zero annual return values found")
                    
                    break
                    
                elif status_data['status'] == 'failed':
                    print(f"❌ Simulation failed: {status_data.get('error', 'Unknown')}")
                    break
        else:
            print("❌ Simulation timed out")
    else:
        print(f"❌ Failed to start simulation: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_conversion()