#!/usr/bin/env python3
"""
Quick test to verify cache optimization is working for Monte Carlo simulations.
"""

import requests
import json
import time

def test_monte_carlo_cache_optimization():
    """Test that Monte Carlo simulations use cached data efficiently."""
    
    # Simple portfolio configuration
    portfolio_config = {
        "portfolio": [
            {"ticker": "SPY", "percentage": 80},
            {"ticker": "BND", "percentage": 20}
        ],
        "time_period_years": 30,
        "initial_balance": 1000000,
        "num_simulations": 100,  # Small number for quick test
        "historical_start_date": "2000-01-01"
    }
    
    print("Testing Monte Carlo cache optimization...")
    print(f"Portfolio: {portfolio_config['portfolio']}")
    print(f"Start date: {portfolio_config['historical_start_date']}")
    print()
    
    # Start the simulation
    start_time = time.time()
    response = requests.post(
        'http://localhost:8000/api/monte-carlo/simulate',
        json=portfolio_config,
        timeout=60
    )
    
    if response.status_code == 200:
        end_time = time.time()
        duration = end_time - start_time
        
        results = response.json()
        print(f"✅ Simulation completed successfully in {duration:.2f}s")
        print(f"Total simulations: {results.get('simulation_metadata', {}).get('num_simulations', 'Unknown')}")
        print(f"Historical range: {results.get('historical_data_range', 'Unknown')}")
        
        # Check if execution time is reasonable (should be much faster than 20+ seconds)
        if duration < 10:
            print(f"🎉 CACHE OPTIMIZATION WORKING: {duration:.2f}s < 10s threshold")
        else:
            print(f"⚠️  Still slow: {duration:.2f}s - may need further optimization")
        
    else:
        print(f"❌ Simulation failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_monte_carlo_cache_optimization()