#!/usr/bin/env python3
"""
Debug script to investigate negative expected returns issue.
"""

import json
import sys
import numpy as np
from datetime import datetime, timedelta

def analyze_simulation_results():
    """Analyze the latest simulation results to debug negative returns."""
    print("🔍 Debugging Negative Expected Returns Issue")
    print("=" * 60)
    
    # Check if we can find recent simulation results
    try:
        # Simulate the problematic portfolio
        portfolio = [
            {"ticker": "SPLV", "percentage": 10},
            {"ticker": "PHDG", "percentage": 10},
            {"ticker": "QUAL", "percentage": 10},
            {"ticker": "VUG", "percentage": 20},
            {"ticker": "VGT", "percentage": 10},
            {"ticker": "VEA", "percentage": 15},
            {"ticker": "SCHE", "percentage": 15},
            {"ticker": "GLD", "percentage": 10}
        ]
        
        print("📊 Portfolio Composition:")
        for item in portfolio:
            print(f"   {item['ticker']}: {item['percentage']}%")
        print()
        
        # Print data availability summary from logs
        data_issues = {
            "SPLV": {"start": "2011-05-06", "missing": 11.3, "available": 14.1},
            "PHDG": {"start": "2012-12-07", "missing": 12.9, "available": 12.6},
            "QUAL": {"start": "2013-07-19", "missing": 13.5, "available": 12.0},
            "VUG": {"start": "2004-02-02", "missing": 4.1, "available": 21.4},
            "VGT": {"start": "2004-02-02", "missing": 4.1, "available": 21.4},
            "VEA": {"start": "2007-07-27", "missing": 7.6, "available": 17.9},
            "SCHE": {"start": "2010-01-15", "missing": 10.0, "available": 15.4},
            "GLD": {"start": "2004-11-19", "missing": 4.9, "available": 20.6}
        }
        
        print("📈 Data Availability Analysis:")
        total_missing = 0
        severely_limited = 0
        
        for ticker, info in data_issues.items():
            print(f"   {ticker}: {info['available']:.1f} years (missing {info['missing']:.1f} years)")
            total_missing += info['missing']
            if info['missing'] > 10:
                severely_limited += 1
        
        print(f"\n🚨 Critical Issues:")
        print(f"   • {severely_limited}/8 tickers missing 10+ years of data")
        print(f"   • Average missing: {total_missing/8:.1f} years per ticker")
        print(f"   • Several tickers started during/after 2008 financial crisis")
        print(f"   • QUAL started July 2013 (only {data_issues['QUAL']['available']:.1f} years)")
        
        print(f"\n🔬 Bootstrap Resampling Impact:")
        print(f"   • Block size: 252 days (1 year)")
        print(f"   • With only 12 years of data, limited diversity")
        print(f"   • Crisis periods (2008, 2020) may be over-sampled")
        print(f"   • Recent tickers lack pre-2008 bull market data")
        
        print(f"\n💡 Likely Root Cause:")
        print(f"   • Portfolio heavily weighted toward post-2008 ETFs")
        print(f"   • Bootstrap resampling amplifying crisis scenarios")
        print(f"   • Missing the 1980s-2000s bull market period")
        print(f"   • Combination creating unrealistic negative projections")
        
        print(f"\n🔧 Recommended Solutions:")
        print(f"   1. Add minimum data period validation (reject < 15 years)")
        print(f"   2. Implement data period balancing in bootstrap")
        print(f"   3. Add portfolio composition warnings")
        print(f"   4. Use adaptive block sizes for limited data")
        print(f"   5. Consider synthetic pre-inception data modeling")

    except Exception as e:
        print(f"❌ Error during analysis: {e}")

if __name__ == "__main__":
    analyze_simulation_results()