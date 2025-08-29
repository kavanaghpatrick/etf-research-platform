#!/usr/bin/env python3
"""
Test data disclosure functionality for Monte Carlo simulations.
"""

import requests
import json
import time

def test_data_disclosure():
    """Test that data disclosures show when using tickers with limited history."""
    
    # Portfolio with BND (starts 2007) but requesting data from 2000
    portfolio_config = {
        "portfolio": [
            {"ticker": "SPY", "percentage": 80},  # Should have full data back to 2000
            {"ticker": "BND", "percentage": 20}   # Only has data from 2007
        ],
        "time_period_years": 30,
        "initial_balance": 1000000,
        "num_simulations": 100,
        "historical_start_date": "2000-01-01"  # Requesting 2000, but BND starts 2007
    }
    
    print("Testing Data Disclosure Functionality...")
    print(f"Portfolio: {portfolio_config['portfolio']}")
    print(f"Requested start date: {portfolio_config['historical_start_date']}")
    print(f"Expected disclosure: BND only available from 2007 (missing ~7 years)")
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
        print(f"✅ Simulation completed in {duration:.2f}s")
        print(f"Historical range: {results.get('historical_data_range', 'Unknown')}")
        print(f"Response keys: {list(results.keys())}")
        print()
        
        # Check for data disclosures
        disclosures = results.get('data_disclosures', [])
        
        if disclosures:
            print("📊 Data Disclosures:")
            for disclosure in disclosures:
                ticker = disclosure['ticker']
                requested_start = disclosure['requested_start']
                actual_start = disclosure['actual_start']
                years_missing = disclosure['years_missing']
                years_actual = disclosure['years_actual']
                
                if disclosure.get('disclosure'):
                    print(f"  ⚠️  {ticker}: {disclosure['disclosure']}")
                    print(f"      Requested: {requested_start}, Actual: {actual_start}")
                    print(f"      Missing {years_missing:.1f} years, using {years_actual:.1f} years")
                else:
                    print(f"  ✅ {ticker}: Full data available ({actual_start} to {disclosure['actual_end']}, {years_actual:.1f} years)")
                print()
                
            # Test specific expectation for BND
            bnd_disclosure = next((d for d in disclosures if d['ticker'] == 'BND'), None)
            if bnd_disclosure and bnd_disclosure.get('disclosure'):
                print("🎉 SUCCESS: BND disclosure working correctly!")
                print(f"   BND missing ~{bnd_disclosure['years_missing']:.1f} years as expected")
            else:
                print("⚠️  BND disclosure not found or not triggered")
                
        else:
            print("❌ No data disclosures found in response")
            print("This suggests the disclosure system isn't working")
        
    else:
        print(f"❌ Simulation failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_data_disclosure()