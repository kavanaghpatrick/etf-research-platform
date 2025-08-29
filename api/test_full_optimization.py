#!/usr/bin/env python3
"""
Test the full cache optimization with realistic simulation count.
"""

import requests
import json
import time

def test_full_monte_carlo_optimization():
    """Test Monte Carlo with realistic simulation count."""
    
    # Realistic portfolio configuration
    portfolio_config = {
        "portfolio": [
            {"ticker": "SPY", "percentage": 80},
            {"ticker": "BND", "percentage": 20}
        ],
        "time_period_years": 30,
        "initial_balance": 1000000,
        "num_simulations": 1000,  # More realistic simulation count
        "historical_start_date": "2000-01-01"
    }
    
    print("Testing Full Monte Carlo Cache Optimization...")
    print(f"Portfolio: {portfolio_config['portfolio']}")
    print(f"Simulations: {portfolio_config['num_simulations']}")
    print(f"Start date: {portfolio_config['historical_start_date']}")
    print()
    
    # Start the simulation
    start_time = time.time()
    response = requests.post(
        'http://localhost:8000/api/monte-carlo/simulate',
        json=portfolio_config,
        timeout=120
    )
    
    if response.status_code == 200:
        end_time = time.time()
        duration = end_time - start_time
        
        results = response.json()
        print(f"✅ Simulation completed successfully in {duration:.2f}s")
        print(f"Total simulations: {results.get('simulation_metadata', {}).get('num_simulations', 'Unknown')}")
        print(f"Historical range: {results.get('historical_data_range', 'Unknown')}")
        
        # Performance assessment
        if duration < 10:
            print(f"🚀 EXCELLENT: {duration:.2f}s - Cache optimization working perfectly")
        elif duration < 20:
            print(f"✅ GOOD: {duration:.2f}s - Acceptable performance")
        else:
            print(f"⚠️  SLOW: {duration:.2f}s - May need further optimization")
        
        # Show key metrics
        metrics = results.get('aggregated_metrics', {})
        if metrics:
            print(f"\n📊 Key Results:")
            print(f"   Median Annual Return: {metrics.get('twrr_nominal', {}).get('percentile_50th', 0)*100:.1f}%")
            print(f"   Median Max Drawdown: {metrics.get('max_drawdown', {}).get('percentile_50th', 0)*100:.1f}%")
            swr = metrics.get('safe_withdrawal_rate', {}).get('percentile_50th')
            if swr:
                print(f"   Safe Withdrawal Rate: {swr:.1f}%")
        
    else:
        print(f"❌ Simulation failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_full_monte_carlo_optimization()