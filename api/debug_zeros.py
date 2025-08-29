#!/usr/bin/env python3
"""
Debug script to check for zero prices in cached data
"""
import sqlite3
import numpy as np
import pandas as pd
from pathlib import Path

def check_for_zeros():
    """Check for zero prices in the SQLite cache database"""
    db_path = Path("data/etf_platform.db")
    if not db_path.exists():
        print("❌ Database not found")
        return
    
    conn = sqlite3.connect(db_path)
    
    try:
        # Get all tickers with data
        cursor = conn.execute("SELECT DISTINCT ticker_symbol FROM stock_data ORDER BY ticker_symbol")
        tickers = [row[0] for row in cursor.fetchall()]
        
        print(f"🔍 Checking {len(tickers)} tickers for zero prices...")
        print("=" * 60)
        
        total_zeros = 0
        problem_tickers = []
        
        for ticker in tickers:
            # Get all price data for this ticker
            query = """
            SELECT date, adj_close 
            FROM stock_data 
            WHERE ticker_symbol = ? 
            ORDER BY date
            """
            df = pd.read_sql_query(query, conn, params=[ticker])
            
            if len(df) == 0:
                continue
                
            prices = df['adj_close'].values
            
            # Check for zeros
            zero_count = np.sum(prices == 0)
            negative_count = np.sum(prices < 0)
            
            if zero_count > 0 or negative_count > 0:
                print(f"\n🚨 {ticker}:")
                print(f"   Zero prices: {zero_count}")
                print(f"   Negative prices: {negative_count}")
                print(f"   Total records: {len(prices)}")
                print(f"   Date range: {df['date'].iloc[0]} to {df['date'].iloc[-1]}")
                
                # Show specific zero dates
                if zero_count > 0:
                    zero_dates = df[df['adj_close'] == 0]['date'].tolist()
                    print(f"   Zero dates: {zero_dates[:10]}{'...' if len(zero_dates) > 10 else ''}")
                
                total_zeros += zero_count
                problem_tickers.append(ticker)
                
                # Calculate returns with zeros
                if len(prices) > 1:
                    returns = np.diff(prices) / prices[:-1]
                    extreme_negative = np.sum(returns < -0.5)  # >50% loss
                    infinite_negative = np.sum(returns <= -1.0)  # 100% loss or worse
                    print(f"   Returns < -50%: {extreme_negative}")
                    print(f"   Returns <= -100%: {infinite_negative}")
                    
                    if infinite_negative > 0:
                        print("   ⚠️  -100% returns detected (likely from zeros)!")
        
        print("\n" + "=" * 60)
        print(f"📊 Summary:")
        print(f"   Total tickers checked: {len(tickers)}")
        print(f"   Tickers with zero/negative prices: {len(problem_tickers)}")
        print(f"   Total zero prices found: {total_zeros}")
        
        if problem_tickers:
            print(f"\n🔧 Problem tickers: {', '.join(problem_tickers)}")
            print("\n💡 Zero prices cause -100% returns, destroying Monte Carlo simulations!")
        else:
            print("\n✅ No zero prices found in database")
            
    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_for_zeros()