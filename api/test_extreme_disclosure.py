#!/usr/bin/env python3
"""
Test disclosure with multiple tickers having different data availability.
"""

import requests
import json
import time

def test_extreme_disclosure():
    """Test disclosure with multiple tickers with varying data availability."""
    
    # Portfolio mixing old and new instruments
    portfolio_config = {
        "portfolio": [
            {"ticker": "SPY", "percentage": 50},  # Should have data back to 1993
            {"ticker": "BND", "percentage": 30},  # Only from 2007
            {"ticker": "VTI", "percentage": 20}   # Only from 2001
        ],
        "time_period_years": 30,
        "initial_balance": 1000000,
        "num_simulations": 100,
        "historical_start_date": "1990-01-01"  # Very early request
    }
    
    print("Testing Extreme Data Disclosure...")
    print(f"Portfolio: {portfolio_config['portfolio']}")
    print(f"Requested start date: {portfolio_config['historical_start_date']}")
    print("Expected disclosures:")
    print("  - SPY: Should have most data (maybe missing 1993-1990)")
    print("  - BND: Missing ~17 years (1990 to 2007)")  
    print("  - VTI: Missing ~11 years (1990 to 2001)")
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
        print()
        
        # Check for data disclosures
        disclosures = results.get('data_disclosures', [])
        
        if disclosures:
            print("📊 Data Disclosures:")
            total_missing_years = 0
            
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
                    total_missing_years += years_missing
                else:
                    print(f"  ✅ {ticker}: Full data available ({actual_start} to {disclosure['actual_end']}, {years_actual:.1f} years)")
                print()
            
            print(f"📈 Summary:")
            print(f"   Total years missing across all tickers: {total_missing_years:.1f}")
            print(f"   Average data availability: {35 - (total_missing_years/len(disclosures)):.1f} years per ticker")
            
            # Check if any major disclosures
            major_disclosures = [d for d in disclosures if d.get('years_missing', 0) > 10]
            if major_disclosures:
                print(f"   ⚠️  {len(major_disclosures)} tickers missing 10+ years of data")
                print(f"      This significantly impacts long-term projection reliability")
                
        else:
            print("❌ No data disclosures found")
        
    else:
        print(f"❌ Simulation failed: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_extreme_disclosure()