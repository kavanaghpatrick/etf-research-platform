#!/usr/bin/env python3
"""
Local database setup for ETF Research Platform.
Creates a local SQLite database for development if PostgreSQL is not available.
"""

import os
import sqlite3
import logging
from pathlib import Path
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class LocalDatabaseSetup:
    """Setup local database for development."""
    
    def __init__(self):
        self.db_path = Path(__file__).parent / "data" / "etf_platform.db"
        self.db_path.parent.mkdir(exist_ok=True)
        
    def create_sqlite_schema(self):
        """Create SQLite database with simplified schema for development."""
        logger.info(f"Creating SQLite database at: {self.db_path}")
        
        # SQLite version of our schema (simplified, no TimescaleDB extensions)
        schema_sql = """
        -- Ticker metadata table
        CREATE TABLE IF NOT EXISTS tickers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT UNIQUE NOT NULL,
            name TEXT,
            sector TEXT,
            exchange TEXT,
            first_cached_date DATE,
            last_cached_date DATE,
            total_records INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Main time series table
        CREATE TABLE IF NOT EXISTS stock_data (
            ticker_symbol TEXT NOT NULL,
            date DATE NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume INTEGER NOT NULL,
            adj_close REAL NOT NULL,
            source TEXT NOT NULL,
            fetch_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (ticker_symbol, date)
        );

        -- Cache coverage tracking table
        CREATE TABLE IF NOT EXISTS cache_ranges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticker_symbol TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            source TEXT NOT NULL,
            record_count INTEGER NOT NULL,
            is_complete BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (ticker_symbol) REFERENCES tickers(symbol) ON DELETE CASCADE
        );

        -- API usage tracking
        CREATE TABLE IF NOT EXISTS api_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            endpoint TEXT,
            ticker_symbol TEXT,
            request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            response_time_ms INTEGER,
            success BOOLEAN NOT NULL,
            error_message TEXT,
            records_fetched INTEGER DEFAULT 0
        );

        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_stock_data_ticker_date ON stock_data (ticker_symbol, date DESC);
        CREATE INDEX IF NOT EXISTS idx_stock_data_date ON stock_data (date DESC);
        CREATE INDEX IF NOT EXISTS idx_cache_ranges_ticker ON cache_ranges (ticker_symbol);
        CREATE INDEX IF NOT EXISTS idx_cache_ranges_dates ON cache_ranges (start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage (request_timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_api_usage_source ON api_usage (source, request_timestamp DESC);
        
        -- Insert initial ticker symbols
        INSERT OR IGNORE INTO tickers (symbol, name, sector) VALUES 
        ('AAPL', 'Apple Inc.', 'Technology'),
        ('SPY', 'SPDR S&P 500 ETF Trust', 'ETF'),
        ('QQQ', 'Invesco QQQ Trust', 'ETF'),
        ('VTI', 'Vanguard Total Stock Market ETF', 'ETF'),
        ('MSFT', 'Microsoft Corporation', 'Technology'),
        ('GOOGL', 'Alphabet Inc.', 'Technology'),
        ('TSLA', 'Tesla Inc.', 'Automotive'),
        ('NVDA', 'NVIDIA Corporation', 'Technology'),
        ('META', 'Meta Platforms Inc.', 'Technology'),
        ('AMZN', 'Amazon.com Inc.', 'Technology'),
        ('BRK-B', 'Berkshire Hathaway Inc.', 'Financial'),
        ('V', 'Visa Inc.', 'Financial'),
        ('JNJ', 'Johnson & Johnson', 'Healthcare'),
        ('WMT', 'Walmart Inc.', 'Consumer'),
        ('JPM', 'JPMorgan Chase & Co.', 'Financial'),
        ('XOM', 'Exxon Mobil Corporation', 'Energy'),
        ('UNH', 'UnitedHealth Group Inc.', 'Healthcare'),
        ('HD', 'The Home Depot Inc.', 'Consumer'),
        ('PG', 'Procter & Gamble Co.', 'Consumer'),
        ('DIS', 'The Walt Disney Company', 'Entertainment');
        """
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Execute schema creation
                for statement in schema_sql.split(';'):
                    statement = statement.strip()
                    if statement:
                        cursor.execute(statement)
                
                conn.commit()
                logger.info("SQLite database schema created successfully")
                
                # Verify setup
                cursor.execute("SELECT COUNT(*) FROM tickers")
                ticker_count = cursor.fetchone()[0]
                
                cursor.execute("SELECT COUNT(*) FROM stock_data")
                data_count = cursor.fetchone()[0]
                
                logger.info(f"Database setup complete:")
                logger.info(f"  - Tickers: {ticker_count}")
                logger.info(f"  - Stock data records: {data_count}")
                logger.info(f"  - Database file: {self.db_path}")
                
                return True
                
        except Exception as e:
            logger.error(f"Error creating SQLite database: {e}")
            return False
    
    def create_database_url(self):
        """Create database URL for the application."""
        db_url = f"sqlite:///{self.db_path.absolute()}"
        logger.info(f"Database URL: {db_url}")
        
        # Create .env file for easy loading
        env_file = Path(__file__).parent / ".env"
        with open(env_file, 'w') as f:
            f.write(f"DATABASE_URL={db_url}\n")
            f.write(f"DB_PATH={self.db_path.absolute()}\n")
            f.write(f"# Local development database\n")
            f.write(f"# Created: {datetime.now().isoformat()}\n")
        
        logger.info(f"Environment file created: {env_file}")
        return db_url
    
    def test_database_connection(self):
        """Test that we can connect to and query the database."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Test basic queries
                cursor.execute("SELECT symbol, name FROM tickers LIMIT 5")
                tickers = cursor.fetchall()
                
                logger.info("Database connection test successful:")
                for symbol, name in tickers:
                    logger.info(f"  - {symbol}: {name}")
                
                return True
                
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False


def setup_postgresql_if_available():
    """Try to setup PostgreSQL if available."""
    try:
        import subprocess
        
        # Check if PostgreSQL is available
        result = subprocess.run(['which', 'psql'], capture_output=True, text=True)
        if result.returncode == 0:
            logger.info("PostgreSQL found, attempting setup...")
            
            # Try to connect to default database
            result = subprocess.run(['psql', '-c', 'SELECT version();'], capture_output=True, text=True)
            if result.returncode == 0:
                logger.info("PostgreSQL is running and accessible")
                
                # Run our database setup
                setup_script = Path(__file__).parent / "database" / "setup.py"
                if setup_script.exists():
                    logger.info("Running PostgreSQL setup script...")
                    result = subprocess.run(['python3', str(setup_script)], capture_output=True, text=True)
                    if result.returncode == 0:
                        logger.info("PostgreSQL setup completed successfully")
                        return "postgresql"
                    else:
                        logger.warning(f"PostgreSQL setup failed: {result.stderr}")
                        
        logger.info("PostgreSQL not available, using SQLite fallback")
        return None
        
    except Exception as e:
        logger.warning(f"PostgreSQL detection failed: {e}")
        return None


def main():
    """Main setup function."""
    logger.info("🗄️ Setting up local database for ETF Research Platform")
    logger.info("=" * 60)
    
    # Try PostgreSQL first
    pg_result = setup_postgresql_if_available()
    
    if pg_result == "postgresql":
        logger.info("✅ PostgreSQL setup completed")
        logger.info("   Using PostgreSQL for optimal performance")
        return
    
    # Fallback to SQLite
    logger.info("📁 Setting up SQLite database for local development")
    
    setup = LocalDatabaseSetup()
    
    # Create database schema
    if setup.create_sqlite_schema():
        # Create database URL
        db_url = setup.create_database_url()
        
        # Test connection
        if setup.test_database_connection():
            logger.info("=" * 60)
            logger.info("✅ Local database setup completed successfully!")
            logger.info("=" * 60)
            logger.info(f"Database path: {setup.db_path}")
            logger.info(f"Database URL: {db_url}")
            logger.info("")
            logger.info("🚀 Next steps:")
            logger.info("1. Set environment variable:")
            logger.info(f"   export DATABASE_URL='{db_url}'")
            logger.info("2. Restart your API server")
            logger.info("3. Start populating cache with real data!")
        else:
            logger.error("❌ Database connection test failed")
    else:
        logger.error("❌ Database setup failed")


if __name__ == "__main__":
    main()