#!/usr/bin/env python3
"""
Database setup script for ETF Research Platform.
Creates PostgreSQL database with TimescaleDB extension and optimized schema.
"""

import os
import sys
import logging
import psycopg2
import psycopg2.extensions
from pathlib import Path


def setup_logging():
    """Configure logging for database setup."""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


def get_database_config():
    """Get database configuration from environment or defaults."""
    return {
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': os.getenv('DB_PORT', '5432'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', ''),
        'database': os.getenv('DB_NAME', 'etf_platform'),
        'admin_database': os.getenv('DB_ADMIN_DB', 'postgres')
    }


def create_database_if_not_exists(config, logger):
    """Create the database if it doesn't exist."""
    try:
        # Connect to admin database to create our database
        admin_conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['admin_database']
        )
        admin_conn.autocommit = True
        
        cursor = admin_conn.cursor()
        
        # Check if database exists
        cursor.execute(
            "SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s",
            (config['database'],)
        )
        
        if cursor.fetchone():
            logger.info(f"Database '{config['database']}' already exists")
        else:
            # Create database
            cursor.execute(f"CREATE DATABASE {config['database']}")
            logger.info(f"Created database '{config['database']}'")
        
        cursor.close()
        admin_conn.close()
        
    except Exception as e:
        logger.error(f"Error creating database: {e}")
        raise


def setup_timescaledb(config, logger):
    """Set up TimescaleDB extension and create schema."""
    try:
        # Connect to our database
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database']
        )
        conn.autocommit = True
        
        cursor = conn.cursor()
        
        # Create TimescaleDB extension (requires superuser or database owner)
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
            logger.info("TimescaleDB extension created/verified")
        except psycopg2.Error as e:
            if "permission denied" in str(e).lower():
                logger.warning("Cannot create TimescaleDB extension (permission denied). Continuing without it.")
                logger.warning("You may need superuser privileges or use a managed TimescaleDB service.")
            else:
                raise
        
        # Load and execute schema
        schema_file = Path(__file__).parent / 'schema.sql'
        
        if schema_file.exists():
            with open(schema_file, 'r') as f:
                schema_sql = f.read()
            
            # Split and execute statements
            statements = [stmt.strip() for stmt in schema_sql.split(';') if stmt.strip()]
            
            for statement in statements:
                try:
                    cursor.execute(statement)
                except psycopg2.Error as e:
                    if "does not exist" in str(e) and "timescaledb" in str(e):
                        logger.warning(f"Skipping TimescaleDB-specific statement: {e}")
                        continue
                    else:
                        logger.error(f"Error executing statement: {e}")
                        logger.error(f"Statement: {statement[:100]}...")
                        raise
            
            logger.info("Database schema created successfully")
        else:
            logger.error(f"Schema file not found: {schema_file}")
            raise FileNotFoundError(f"Schema file not found: {schema_file}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error setting up database schema: {e}")
        raise


def create_indexes(config, logger):
    """Create additional performance indexes."""
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database']
        )
        
        cursor = conn.cursor()
        
        # Additional performance indexes
        performance_indexes = [
            "CREATE INDEX IF NOT EXISTS idx_stock_data_symbol_recent ON stock_data (ticker_symbol) WHERE date >= CURRENT_DATE - INTERVAL '1 year'",
            "CREATE INDEX IF NOT EXISTS idx_stock_data_volume ON stock_data (volume) WHERE volume > 0",
            "CREATE INDEX IF NOT EXISTS idx_tickers_active ON tickers (symbol) WHERE is_active = true",
            "CREATE INDEX IF NOT EXISTS idx_cache_ranges_complete ON cache_ranges (ticker_symbol, is_complete)",
        ]
        
        for index_sql in performance_indexes:
            try:
                cursor.execute(index_sql)
                logger.info(f"Created index: {index_sql.split()[5]}")
            except Exception as e:
                logger.warning(f"Failed to create index: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info("Performance indexes created")
        
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")


def verify_setup(config, logger):
    """Verify the database setup is working."""
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            user=config['user'],
            password=config['password'],
            database=config['database']
        )
        
        cursor = conn.cursor()
        
        # Test basic operations
        cursor.execute("SELECT COUNT(*) FROM tickers")
        ticker_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM stock_data")
        data_count = cursor.fetchone()[0]
        
        # Check if TimescaleDB is working
        try:
            cursor.execute("SELECT hypertable_name FROM timescaledb_information.hypertables WHERE hypertable_name = 'stock_data'")
            hypertable = cursor.fetchone()
            timescale_status = "✅ Active" if hypertable else "❌ Not configured"
        except:
            timescale_status = "❌ Not available"
        
        cursor.close()
        conn.close()
        
        logger.info("=" * 50)
        logger.info("DATABASE SETUP VERIFICATION")
        logger.info("=" * 50)
        logger.info(f"Database: {config['database']}")
        logger.info(f"Host: {config['host']}:{config['port']}")
        logger.info(f"TimescaleDB: {timescale_status}")
        logger.info(f"Tickers table: {ticker_count} records")
        logger.info(f"Stock data table: {data_count} records")
        logger.info("=" * 50)
        logger.info("✅ Database setup completed successfully!")
        logger.info("=" * 50)
        
        return True
        
    except Exception as e:
        logger.error(f"Database verification failed: {e}")
        return False


def main():
    """Main setup function."""
    logger = setup_logging()
    
    logger.info("Starting ETF Research Platform database setup")
    
    try:
        config = get_database_config()
        
        logger.info(f"Setting up database '{config['database']}' on {config['host']}:{config['port']}")
        
        # Step 1: Create database
        create_database_if_not_exists(config, logger)
        
        # Step 2: Setup TimescaleDB and schema
        setup_timescaledb(config, logger)
        
        # Step 3: Create performance indexes
        create_indexes(config, logger)
        
        # Step 4: Verify setup
        if verify_setup(config, logger):
            logger.info("Database setup completed successfully!")
            
            # Print connection string for reference
            if config['password']:
                conn_str = f"postgresql://{config['user']}:***@{config['host']}:{config['port']}/{config['database']}"
            else:
                conn_str = f"postgresql://{config['user']}@{config['host']}:{config['port']}/{config['database']}"
            
            logger.info(f"Connection string: {conn_str}")
            
        else:
            logger.error("Database setup verification failed!")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Database setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()