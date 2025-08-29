#!/usr/bin/env python3
"""
Debug script to identify why dividend data isn't being inserted into the database.
"""

import pandas as pd
import tempfile
import os
from datetime import date
from sqlite_cache_manager import SQLiteStockDataCache

def debug_dividend_insertion():
    """Debug dividend data insertion step by step."""
    print("=== Debugging Dividend Data Insertion ===\n")
    
    # Create temporary database
    temp_file = tempfile.NamedTemporaryFile(delete=False)
    temp_file.close()
    
    try:
        cache = SQLiteStockDataCache(database_url=f"sqlite:///{temp_file.name}")
        print(f"Created database: {temp_file.name}")
        
        # Create test dividend data
        dividend_data = pd.DataFrame([
            {
                'ex_date': '2024-02-14',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD'
            },
            {
                'ex_date': '2024-05-15',
                'dividend_amount': 0.75,
                'dividend_type': 'regular',
                'currency': 'USD'
            }
        ])
        
        print(f"Created test data with {len(dividend_data)} records:")
        print(dividend_data.to_string())
        print()
        
        ticker = 'MSFT'
        start_date = date(2024, 1, 1)
        end_date = date(2024, 12, 31)
        source = 'Debug'
        
        # Step-by-step debugging of cache_dividend_data
        print("=== Step-by-step debugging ===")
        
        with cache.get_connection() as conn:
            print("1. Database connection established")
            
            # Check if tables exist
            cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('dividends', 'dividend_cache_ranges', 'tickers')")
            tables = [row['name'] for row in cursor.fetchall()]
            print(f"2. Available tables: {tables}")
            
            # Insert ticker
            print(f"3. Inserting ticker: {ticker}")
            conn.execute("INSERT OR IGNORE INTO tickers (symbol) VALUES (?)", (ticker,))
            
            # Check ticker was inserted
            cursor = conn.execute("SELECT symbol FROM tickers WHERE symbol = ?", (ticker,))
            ticker_exists = cursor.fetchone()
            print(f"4. Ticker exists: {ticker_exists is not None}")
            
            # Process dividend data insertion manually
            if not dividend_data.empty:
                print("5. Processing dividend data...")
                insert_data = []
                
                for i, row in dividend_data.iterrows():
                    print(f"   Processing row {i}: {dict(row)}")
                    
                    # Handle date format
                    ex_date = row.get('ex_date')
                    if hasattr(ex_date, 'date'):
                        ex_date_str = ex_date.date().isoformat()
                    else:
                        ex_date_str = str(ex_date)
                    
                    payment_date = row.get('payment_date')
                    if payment_date and hasattr(payment_date, 'date'):
                        payment_date_str = payment_date.date().isoformat()
                    else:
                        payment_date_str = str(payment_date) if payment_date else None
                    
                    record = (
                        ticker,
                        ex_date_str,
                        float(row.get('dividend_amount', 0)),
                        payment_date_str,
                        None,  # record_date
                        str(row.get('dividend_type', 'regular')),
                        str(row.get('currency', 'USD')),
                        1,     # frequency (quarterly assumed)
                        source,
                        '2024-07-14 12:00:00'  # Fixed timestamp for testing
                    )
                    
                    insert_data.append(record)
                    print(f"   Prepared record: {record}")
                
                print(f"6. Executing bulk insert with {len(insert_data)} records...")
                
                # Execute the INSERT
                try:
                    conn.executemany("""
                        INSERT OR REPLACE INTO dividends 
                        (ticker_symbol, ex_date, dividend_amount, payment_date, record_date, 
                         dividend_type, currency, frequency, source, last_updated)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, insert_data)
                    
                    print("7. Bulk insert executed successfully")
                    
                    # Check if data was actually inserted
                    cursor = conn.execute("SELECT COUNT(*) as count FROM dividends WHERE ticker_symbol = ?", (ticker,))
                    count = cursor.fetchone()['count']
                    print(f"8. Records in dividends table: {count}")
                    
                    # Show the actual records
                    cursor = conn.execute("SELECT * FROM dividends WHERE ticker_symbol = ?", (ticker,))
                    records = cursor.fetchall()
                    print("9. Inserted records:")
                    for record in records:
                        print(f"   {dict(record)}")
                    
                except Exception as e:
                    print(f"7. ERROR during bulk insert: {e}")
                    
            # Insert cache range
            print("10. Inserting cache range...")
            try:
                conn.execute("""
                    INSERT OR REPLACE INTO dividend_cache_ranges 
                    (ticker_symbol, start_date, end_date, source, last_updated)
                    VALUES (?, ?, ?, ?, ?)
                """, (ticker, start_date.isoformat(), end_date.isoformat(), 
                      source, '2024-07-14 12:00:00'))
                
                print("11. Cache range inserted successfully")
                
                # Check cache ranges
                cursor = conn.execute("SELECT COUNT(*) as count FROM dividend_cache_ranges WHERE ticker_symbol = ?", (ticker,))
                range_count = cursor.fetchone()['count']
                print(f"12. Cache ranges for ticker: {range_count}")
                
            except Exception as e:
                print(f"11. ERROR inserting cache range: {e}")
            
            # Commit transaction
            print("13. Committing transaction...")
            conn.commit()
            print("14. Transaction committed")
        
        # Test using the actual cache method
        print("\n=== Testing actual cache_dividend_data method ===")
        success = cache.cache_dividend_data(ticker, dividend_data, start_date, end_date, 'CacheMethod')
        print(f"Cache method returned: {success}")
        
        # Final verification
        with cache.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) as count FROM dividends")
            total_dividends = cursor.fetchone()['count']
            print(f"Total dividends in database: {total_dividends}")
            
            cursor = conn.execute("SELECT COUNT(*) as count FROM dividend_cache_ranges")
            total_ranges = cursor.fetchone()['count']
            print(f"Total cache ranges in database: {total_ranges}")
        
        cache.close()
        
    finally:
        # Cleanup
        if os.path.exists(temp_file.name):
            os.unlink(temp_file.name)
            print(f"\nCleaned up temporary file: {temp_file.name}")

if __name__ == "__main__":
    debug_dividend_insertion()