# PRD: Database Optimization for Serverless

## 1. Executive Summary

### Database Optimization Objectives
- Migrate from SQLite to PostgreSQL for production serverless deployment
- Eliminate connection overhead and cold start latency through connection pooling
- Optimize time-series query performance for financial data
- Support high concurrency (1000+ simultaneous requests)
- Implement efficient batch operations for bulk data ingestion

### Expected Performance Gains
- **Query Response Time**: From 200-500ms to sub-100ms for typical queries
- **Connection Overhead**: 90% reduction through persistent connection pooling
- **Concurrent Requests**: From ~10 to 1000+ simultaneous connections
- **Batch Insert Performance**: 10x improvement through optimized bulk operations
- **Cold Start Impact**: Reduced from 2-3s to <500ms

### Infrastructure Changes Required
- PostgreSQL 15+ with TimescaleDB extension
- AWS RDS Proxy or PgBouncer for connection pooling
- Dedicated read replicas for analytics queries
- Automated backup and point-in-time recovery
- CloudWatch metrics and performance monitoring

## 2. Problem Statement

### Current Architecture Limitations

#### SQLite Concurrency Issues
- Single-writer limitation causes request queuing
- File-based locking leads to timeout errors under load
- No support for concurrent write operations
- Thread-based locking (`threading.Lock`) creates bottlenecks

#### Connection Management Problems
- No connection pooling in serverless environment
- Each Lambda invocation creates new database connection
- Connection overhead of 100-300ms per request
- Database connections exhausted during traffic spikes
- SQLite reopens file handle for each operation

#### Inefficient Operations
- Individual INSERT statements for bulk data
- No batch optimization for time-series data
- Lack of proper indexing for date-range queries
- Full table scans for ticker + date combinations
- No query result caching

#### Cold Start Overhead
- Database schema validation on every Lambda start
- Connection initialization adds 1-2 seconds
- No connection reuse between invocations
- Schema creation checks run repeatedly

## 3. Goals & Success Metrics

### Performance Goals
- **P50 Query Latency**: < 50ms
- **P99 Query Latency**: < 100ms
- **Connection Overhead**: < 10ms with pooling
- **Concurrent Connections**: Support 1000+ simultaneous
- **Batch Insert Rate**: > 10,000 records/second
- **Cache Hit Rate**: > 80% for recent data

### Reliability Goals
- **Zero Database Timeouts**: Eliminate connection exhaustion
- **99.99% Uptime**: High availability configuration
- **Data Consistency**: ACID compliance maintained
- **Automatic Failover**: < 30 seconds RTO
- **Point-in-Time Recovery**: 5-minute RPO

### Scalability Goals
- **Horizontal Read Scaling**: Via read replicas
- **Storage Growth**: Support 100TB+ of time-series data
- **Query Performance**: Maintain sub-100ms at scale
- **Connection Pool Size**: Auto-scaling based on load

### Cost Optimization Goals
- **Connection Efficiency**: 95% connection reuse
- **Query Cost**: < $0.001 per request
- **Storage Cost**: < $100/TB/month with compression
- **Compute Optimization**: Right-sized instances

## 4. Technical Requirements

### Database Migration Requirements
- **PostgreSQL 15+**: Latest stable version
- **TimescaleDB Extension**: For time-series optimization
- **Connection Pooling**: RDS Proxy or PgBouncer
- **High Availability**: Multi-AZ deployment
- **Automated Backups**: Daily with 30-day retention

### Query Optimization Requirements
- **Composite Indexes**: (ticker_symbol, date)
- **Partial Indexes**: For active tickers
- **Materialized Views**: For aggregate calculations
- **Query Plan Caching**: Prepared statements
- **Result Caching**: Redis for hot data

### Batch Operation Requirements
- **Bulk COPY**: PostgreSQL native bulk loading
- **Transaction Batching**: 1000-record chunks
- **Parallel Processing**: Multi-threaded ingestion
- **Conflict Resolution**: UPSERT operations
- **Progress Tracking**: Batch job monitoring

### Connection Management Requirements
- **Connection Pool Size**: 25-100 connections
- **Pool Timeout**: 30 seconds
- **Idle Timeout**: 300 seconds
- **Health Checks**: Every 30 seconds
- **Circuit Breaker**: Automatic failover

### Data Retention Requirements
- **Hot Data**: Last 2 years in primary tables
- **Warm Data**: 2-5 years in compressed format
- **Cold Data**: 5+ years in S3 archive
- **Automated Archival**: Monthly process
- **Compliance**: 7-year retention policy

## 5. Implementation Plan

### Phase 1: PostgreSQL Migration (Week 1-2)
1. **Database Setup**
   - Provision RDS PostgreSQL instance
   - Install TimescaleDB extension
   - Configure security groups and VPC
   - Set up parameter groups

2. **Schema Migration**
   - Convert SQLite schema to PostgreSQL
   - Add TimescaleDB hypertables
   - Create optimized indexes
   - Set up partitioning

3. **Data Migration**
   - Export SQLite data to CSV
   - Bulk load into PostgreSQL
   - Validate data integrity
   - Performance benchmarking

### Phase 2: Connection Proxy Setup (Week 3)
1. **RDS Proxy Configuration**
   - Create RDS Proxy instance
   - Configure connection pooling
   - Set up IAM authentication
   - Lambda VPC configuration

2. **Connection Testing**
   - Load testing with concurrent connections
   - Monitor pool utilization
   - Tune pool parameters
   - Implement retry logic

### Phase 3: Query Optimization (Week 4-5)
1. **Index Strategy**
   - Analyze query patterns
   - Create composite indexes
   - Implement partial indexes
   - Monitor index usage

2. **Query Refactoring**
   - Convert to prepared statements
   - Implement query batching
   - Add query hints
   - Result set pagination

### Phase 4: Batch Operation Refactoring (Week 6)
1. **Bulk Operations**
   - Implement COPY operations
   - Add transaction batching
   - Parallel processing
   - Error handling

2. **Performance Testing**
   - Benchmark bulk inserts
   - Stress test with large datasets
   - Monitor resource usage
   - Optimize batch sizes

## 6. Database Schema Design

### Optimized Table Structures

```sql
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Optimized tickers table with metadata
CREATE TABLE tickers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255),
    exchange VARCHAR(50),
    sector VARCHAR(100),
    industry VARCHAR(100),
    market_cap BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    total_records INTEGER DEFAULT 0,
    first_cached_date DATE,
    last_cached_date DATE,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main time-series table as TimescaleDB hypertable
CREATE TABLE stock_data (
    ticker_symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12,4) NOT NULL,
    high DECIMAL(12,4) NOT NULL,
    low DECIMAL(12,4) NOT NULL,
    close DECIMAL(12,4) NOT NULL,
    volume BIGINT NOT NULL,
    adj_close DECIMAL(12,4) NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticker_symbol, date)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('stock_data', 'date', 
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);

-- Enable compression for older data
ALTER TABLE stock_data SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'ticker_symbol',
    timescaledb.compress_orderby = 'date DESC'
);

-- Dividend data table
CREATE TABLE dividend_data (
    ticker_symbol VARCHAR(10) NOT NULL,
    ex_date DATE NOT NULL,
    payment_date DATE,
    record_date DATE,
    declaration_date DATE,
    amount DECIMAL(10,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    frequency VARCHAR(20),
    type VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticker_symbol, ex_date)
);

-- Cache metadata table
CREATE TABLE cache_metadata (
    id SERIAL PRIMARY KEY,
    ticker_symbol VARCHAR(10) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    source VARCHAR(50) NOT NULL,
    record_count INTEGER NOT NULL,
    fetch_duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    INDEX idx_cache_lookup (ticker_symbol, start_date, end_date)
);

-- API usage tracking
CREATE TABLE api_usage (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255),
    ticker_symbol VARCHAR(10),
    request_timestamp TIMESTAMPTZ DEFAULT NOW(),
    response_status INTEGER,
    response_time_ms INTEGER,
    records_returned INTEGER DEFAULT 0,
    error_message TEXT,
    INDEX idx_api_usage_timestamp (request_timestamp)
);
```

### Indexing Strategy

```sql
-- Primary lookup index (most common query pattern)
CREATE INDEX idx_stock_data_lookup ON stock_data (ticker_symbol, date DESC);

-- Date range queries
CREATE INDEX idx_stock_data_date ON stock_data (date DESC);

-- Source-specific queries
CREATE INDEX idx_stock_data_source ON stock_data (source, ticker_symbol);

-- Partial index for active tickers (last 30 days)
CREATE INDEX idx_stock_data_active ON stock_data (ticker_symbol, date DESC)
WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- Covering index for common queries
CREATE INDEX idx_stock_data_covering ON stock_data 
(ticker_symbol, date DESC) 
INCLUDE (open, high, low, close, volume, adj_close);

-- Dividend lookup indexes
CREATE INDEX idx_dividend_ticker_date ON dividend_data (ticker_symbol, ex_date DESC);
CREATE INDEX idx_dividend_payment ON dividend_data (payment_date) 
WHERE payment_date IS NOT NULL;

-- Cache metadata indexes
CREATE INDEX idx_cache_ticker ON cache_metadata (ticker_symbol);
CREATE INDEX idx_cache_created ON cache_metadata (created_at DESC);
```

### Partitioning Strategy

```sql
-- Automatic partitioning by TimescaleDB (monthly chunks)
-- Additional manual partitioning for archive data

-- Create archive schema
CREATE SCHEMA IF NOT EXISTS archive;

-- Archive table for data older than 2 years
CREATE TABLE archive.stock_data_archive (
    LIKE stock_data INCLUDING ALL
) PARTITION BY RANGE (date);

-- Create yearly partitions
CREATE TABLE archive.stock_data_2020 PARTITION OF archive.stock_data_archive
    FOR VALUES FROM ('2020-01-01') TO ('2021-01-01');

CREATE TABLE archive.stock_data_2021 PARTITION OF archive.stock_data_archive
    FOR VALUES FROM ('2021-01-01') TO ('2022-01-01');

-- Automated archival function
CREATE OR REPLACE FUNCTION archive_old_data() RETURNS void AS $$
BEGIN
    -- Move data older than 2 years to archive
    INSERT INTO archive.stock_data_archive
    SELECT * FROM stock_data 
    WHERE date < CURRENT_DATE - INTERVAL '2 years';
    
    -- Delete archived data from main table
    DELETE FROM stock_data 
    WHERE date < CURRENT_DATE - INTERVAL '2 years';
    
    -- Compress archived chunks
    PERFORM compress_chunk(c.chunk_name) 
    FROM timescaledb_information.chunks c
    WHERE c.hypertable_name = 'stock_data_archive'
    AND c.range_end < CURRENT_DATE - INTERVAL '2 years';
END;
$$ LANGUAGE plpgsql;
```

### Data Retention Policies

```sql
-- Compression policy for data older than 3 months
SELECT add_compression_policy('stock_data', 
    compress_after => INTERVAL '3 months',
    if_not_exists => TRUE
);

-- Retention policy for API usage logs
SELECT add_retention_policy('api_usage', 
    drop_after => INTERVAL '90 days',
    if_not_exists => TRUE
);

-- Continuous aggregates for common queries
CREATE MATERIALIZED VIEW daily_price_stats
WITH (timescaledb.continuous) AS
SELECT 
    ticker_symbol,
    time_bucket('1 day', date) AS day,
    AVG(close) as avg_close,
    MAX(high) as day_high,
    MIN(low) as day_low,
    SUM(volume) as total_volume
FROM stock_data
GROUP BY ticker_symbol, day
WITH NO DATA;

-- Refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('daily_price_stats',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);
```

## 7. Code Examples

### Connection Pool Configuration

```python
import os
import asyncpg
from contextlib import asynccontextmanager
from typing import Optional
import boto3
from aws_xray_sdk.core import xray_recorder

class OptimizedDatabasePool:
    """
    Serverless-optimized database connection pool with RDS Proxy support.
    """
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        self.rds_proxy_endpoint = os.getenv('RDS_PROXY_ENDPOINT')
        self.database_url = self._get_database_url()
        
    def _get_database_url(self) -> str:
        """Construct database URL with RDS Proxy endpoint."""
        if self.rds_proxy_endpoint:
            # Use RDS Proxy for connection pooling
            return (
                f"postgresql://{os.getenv('DB_USER')}:"
                f"{os.getenv('DB_PASSWORD')}@"
                f"{self.rds_proxy_endpoint}:5432/"
                f"{os.getenv('DB_NAME')}?"
                f"sslmode=require&"
                f"application_name=etf-platform&"
                f"statement_timeout=30000"
            )
        else:
            # Direct connection (development)
            return os.getenv('DATABASE_URL')
    
    async def initialize(self):
        """Initialize connection pool with optimized settings."""
        if not self.pool:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=5,           # Minimum connections
                max_size=20,          # Maximum connections
                max_queries=1000,     # Queries per connection before reset
                max_inactive_connection_lifetime=300,  # 5 minutes
                command_timeout=30,   # 30 second timeout
                init=self._init_connection
            )
    
    async def _init_connection(self, conn):
        """Initialize each connection with optimal settings."""
        # Set connection parameters
        await conn.execute("SET jit = 'off'")  # Disable JIT for serverless
        await conn.execute("SET statement_timeout = '30s'")
        await conn.execute("SET lock_timeout = '10s'")
        await conn.execute("SET idle_in_transaction_session_timeout = '60s'")
        
        # Prepare common statements
        await conn.prepare("""
            SELECT date, open, high, low, close, volume, adj_close, source
            FROM stock_data 
            WHERE ticker_symbol = $1 AND date >= $2 AND date <= $3
            ORDER BY date ASC
        """)
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire connection from pool with monitoring."""
        if not self.pool:
            await self.initialize()
        
        with xray_recorder.in_subsegment('db_connection'):
            async with self.pool.acquire() as conn:
                yield conn
    
    async def close(self):
        """Close connection pool."""
        if self.pool:
            await self.pool.close()

# Global pool instance for Lambda reuse
db_pool = OptimizedDatabasePool()
```

### Batch Insert Operations

```python
import asyncpg
import pandas as pd
from typing import List, Tuple
import logging

class BatchDataIngestion:
    """
    Optimized batch data ingestion with conflict resolution.
    """
    
    def __init__(self, db_pool: OptimizedDatabasePool):
        self.db_pool = db_pool
        self.logger = logging.getLogger(__name__)
        self.batch_size = 1000
    
    async def bulk_insert_stock_data(
        self, 
        ticker: str, 
        data: pd.DataFrame, 
        source: str
    ) -> int:
        """
        Bulk insert stock data using COPY command for maximum performance.
        """
        if data.empty:
            return 0
        
        async with self.db_pool.acquire() as conn:
            # Create temporary table for staging
            temp_table = f"temp_stock_data_{ticker}_{source}".lower()
            
            try:
                # Create temporary staging table
                await conn.execute(f"""
                    CREATE TEMP TABLE {temp_table} (
                        ticker_symbol VARCHAR(10),
                        date DATE,
                        open DECIMAL(12,4),
                        high DECIMAL(12,4),
                        low DECIMAL(12,4),
                        close DECIMAL(12,4),
                        volume BIGINT,
                        adj_close DECIMAL(12,4),
                        source VARCHAR(50)
                    )
                """)
                
                # Prepare data for COPY
                records = []
                for idx, row in data.iterrows():
                    records.append((
                        ticker,
                        idx.date(),
                        float(row['Open']),
                        float(row['High']),
                        float(row['Low']),
                        float(row['Close']),
                        int(row['Volume']),
                        float(row['Adj Close']),
                        source
                    ))
                
                # Use COPY for bulk insert into temp table
                await conn.copy_records_to_table(
                    temp_table, 
                    records=records,
                    columns=['ticker_symbol', 'date', 'open', 'high', 
                            'low', 'close', 'volume', 'adj_close', 'source']
                )
                
                # Merge from temp table with conflict resolution
                result = await conn.execute(f"""
                    INSERT INTO stock_data 
                    SELECT * FROM {temp_table}
                    ON CONFLICT (ticker_symbol, date) DO UPDATE SET
                        open = EXCLUDED.open,
                        high = EXCLUDED.high,
                        low = EXCLUDED.low,
                        close = EXCLUDED.close,
                        volume = EXCLUDED.volume,
                        adj_close = EXCLUDED.adj_close,
                        source = EXCLUDED.source,
                        created_at = NOW()
                    RETURNING 1
                """)
                
                rows_affected = len(result)
                
                # Update ticker metadata
                await self._update_ticker_metadata(conn, ticker)
                
                # Record cache metadata
                await self._record_cache_metadata(
                    conn, ticker, data, source, rows_affected
                )
                
                self.logger.info(
                    f"Bulk inserted {rows_affected} records for {ticker}"
                )
                return rows_affected
                
            except Exception as e:
                self.logger.error(f"Bulk insert failed for {ticker}: {e}")
                raise
            finally:
                # Temp table is automatically dropped
                pass
    
    async def _update_ticker_metadata(self, conn: asyncpg.Connection, ticker: str):
        """Update ticker statistics after bulk insert."""
        await conn.execute("""
            INSERT INTO tickers (symbol)
            VALUES ($1)
            ON CONFLICT (symbol) DO UPDATE SET
                total_records = (
                    SELECT COUNT(*) FROM stock_data 
                    WHERE ticker_symbol = $1
                ),
                first_cached_date = (
                    SELECT MIN(date) FROM stock_data 
                    WHERE ticker_symbol = $1
                ),
                last_cached_date = (
                    SELECT MAX(date) FROM stock_data 
                    WHERE ticker_symbol = $1
                ),
                last_updated = NOW()
        """, ticker)
    
    async def _record_cache_metadata(
        self, 
        conn: asyncpg.Connection,
        ticker: str,
        data: pd.DataFrame,
        source: str,
        record_count: int
    ):
        """Record cache metadata for monitoring."""
        start_date = data.index.min().date()
        end_date = data.index.max().date()
        
        await conn.execute("""
            INSERT INTO cache_metadata 
            (ticker_symbol, start_date, end_date, source, record_count)
            VALUES ($1, $2, $3, $4, $5)
        """, ticker, start_date, end_date, source, record_count)
```

### Optimized Query Patterns

```python
from typing import List, Dict, Any, Optional
from datetime import date, datetime
import asyncpg

class OptimizedQueries:
    """
    Optimized query patterns for time-series data retrieval.
    """
    
    def __init__(self, db_pool: OptimizedDatabasePool):
        self.db_pool = db_pool
        self._prepared_statements = {}
    
    async def get_price_data(
        self, 
        ticker: str, 
        start_date: date, 
        end_date: date,
        columns: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve price data with optimized query and column selection.
        """
        async with self.db_pool.acquire() as conn:
            # Use prepared statement for better performance
            if 'price_data' not in self._prepared_statements:
                self._prepared_statements['price_data'] = await conn.prepare("""
                    SELECT date, open, high, low, close, volume, adj_close, source
                    FROM stock_data 
                    WHERE ticker_symbol = $1 
                    AND date >= $2 
                    AND date <= $3
                    ORDER BY date ASC
                """)
            
            stmt = self._prepared_statements['price_data']
            rows = await stmt.fetch(ticker, start_date, end_date)
            
            # Convert to dictionaries
            return [dict(row) for row in rows]
    
    async def get_latest_prices(
        self, 
        tickers: List[str], 
        limit: int = 1
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Get latest prices for multiple tickers in a single query.
        """
        async with self.db_pool.acquire() as conn:
            # Use window function for efficient multi-ticker query
            rows = await conn.fetch("""
                WITH latest_prices AS (
                    SELECT 
                        ticker_symbol,
                        date,
                        close,
                        volume,
                        ROW_NUMBER() OVER (
                            PARTITION BY ticker_symbol 
                            ORDER BY date DESC
                        ) as rn
                    FROM stock_data
                    WHERE ticker_symbol = ANY($1::text[])
                )
                SELECT ticker_symbol, date, close, volume
                FROM latest_prices
                WHERE rn <= $2
                ORDER BY ticker_symbol, date DESC
            """, tickers, limit)
            
            # Group by ticker
            result = {}
            for row in rows:
                ticker = row['ticker_symbol']
                if ticker not in result:
                    result[ticker] = []
                result[ticker].append(dict(row))
            
            return result
    
    async def get_missing_date_ranges(
        self, 
        ticker: str, 
        start_date: date, 
        end_date: date
    ) -> List[Tuple[date, date]]:
        """
        Efficiently identify missing date ranges using gaps detection.
        """
        async with self.db_pool.acquire() as conn:
            # Use window functions to detect gaps
            rows = await conn.fetch("""
                WITH date_gaps AS (
                    SELECT 
                        date,
                        LAG(date) OVER (ORDER BY date) as prev_date
                    FROM stock_data
                    WHERE ticker_symbol = $1
                    AND date >= $2
                    AND date <= $3
                ),
                gaps AS (
                    SELECT 
                        prev_date + INTERVAL '1 day' as gap_start,
                        date - INTERVAL '1 day' as gap_end
                    FROM date_gaps
                    WHERE date - prev_date > 1
                    AND prev_date IS NOT NULL
                )
                SELECT gap_start::date, gap_end::date
                FROM gaps
                WHERE gap_end >= gap_start
                ORDER BY gap_start
            """, ticker, start_date, end_date)
            
            return [(row['gap_start'], row['gap_end']) for row in rows]
    
    async def get_aggregate_stats(
        self, 
        ticker: str, 
        period: str = '1 month'
    ) -> List[Dict[str, Any]]:
        """
        Get aggregate statistics using continuous aggregates.
        """
        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    time_bucket($2::interval, date) as period,
                    ticker_symbol,
                    COUNT(*) as data_points,
                    AVG(close) as avg_close,
                    MAX(high) as period_high,
                    MIN(low) as period_low,
                    SUM(volume) as total_volume,
                    STDDEV(close) as volatility
                FROM stock_data
                WHERE ticker_symbol = $1
                AND date >= CURRENT_DATE - INTERVAL '1 year'
                GROUP BY period, ticker_symbol
                ORDER BY period DESC
            """, ticker, period)
            
            return [dict(row) for row in rows]
```

### Transaction Management

```python
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator

class TransactionManager:
    """
    Advanced transaction management with savepoints and retry logic.
    """
    
    def __init__(self, db_pool: OptimizedDatabasePool):
        self.db_pool = db_pool
        self.max_retries = 3
        self.retry_delays = [0.1, 0.5, 1.0]
    
    @asynccontextmanager
    async def transaction(
        self, 
        isolation_level: str = 'read_committed'
    ) -> AsyncGenerator[asyncpg.Connection, None]:
        """
        Create a transaction with specified isolation level.
        """
        async with self.db_pool.acquire() as conn:
            async with conn.transaction(isolation=isolation_level):
                yield conn
    
    @asynccontextmanager
    async def savepoint(
        self, 
        conn: asyncpg.Connection, 
        name: str
    ) -> AsyncGenerator[None, None]:
        """
        Create a savepoint for partial rollback capability.
        """
        await conn.execute(f'SAVEPOINT {name}')
        try:
            yield
        except Exception:
            await conn.execute(f'ROLLBACK TO SAVEPOINT {name}')
            raise
        else:
            await conn.execute(f'RELEASE SAVEPOINT {name}')
    
    async def execute_with_retry(
        self, 
        func, 
        *args, 
        **kwargs
    ):
        """
        Execute a function with automatic retry on transient errors.
        """
        last_error = None
        
        for attempt in range(self.max_retries):
            try:
                return await func(*args, **kwargs)
            except asyncpg.DeadlockDetectedError as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delays[attempt])
                    continue
                raise
            except asyncpg.SerializationError as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(self.retry_delays[attempt])
                    continue
                raise
            except asyncpg.ConnectionDoesNotExistError as e:
                # Reconnect and retry
                await self.db_pool.initialize()
                if attempt < self.max_retries - 1:
                    continue
                raise
        
        raise last_error
```

## 8. Infrastructure Requirements

### Database Specifications

#### Primary Database
- **Engine**: PostgreSQL 15.4 with TimescaleDB 2.11
- **Instance Class**: db.r6g.2xlarge (8 vCPU, 64 GB RAM)
- **Storage**: 1TB GP3 SSD (16,000 IOPS, 1,000 MB/s)
- **Multi-AZ**: Enabled for high availability
- **Backup**: Automated daily, 30-day retention
- **Encryption**: AES-256 at rest, TLS 1.2 in transit

#### Read Replicas
- **Count**: 2 replicas in different AZs
- **Instance Class**: db.r6g.xlarge (4 vCPU, 32 GB RAM)
- **Purpose**: Analytics queries and reporting
- **Lag Monitoring**: < 1 second acceptable

### Connection Proxy Setup

#### RDS Proxy Configuration
```yaml
ProxyName: etf-platform-proxy
EngineFamily: POSTGRESQL
Auth:
  - AuthScheme: SECRETS
    SecretArn: arn:aws:secretsmanager:region:account:secret:rds-credentials
    IAMAuth: REQUIRED
Target:
  DBClusterIdentifier: etf-platform-cluster
MaxConnectionsPercent: 100
MaxIdleConnectionsPercent: 50
ConnectionBorrowTimeout: 120
SessionPinningFilters:
  - EXCLUDE_VARIABLE_SETS
VpcSubnetIds:
  - subnet-xxxxxx
  - subnet-yyyyyy
SecurityGroups:
  - sg-xxxxxx
```

#### Connection Pool Settings
- **Min Connections**: 25
- **Max Connections**: 100
- **Connection Timeout**: 30 seconds
- **Idle Timeout**: 300 seconds
- **Max Queries per Connection**: 1000

### Backup and Recovery Strategy

#### Automated Backups
- **Schedule**: Daily at 3 AM UTC
- **Retention**: 30 days
- **Type**: Automated snapshots
- **Window**: 30 minutes

#### Point-in-Time Recovery
- **RPO**: 5 minutes
- **RTO**: 30 minutes
- **Method**: Continuous archiving to S3
- **Testing**: Monthly recovery drills

#### Disaster Recovery
- **Cross-Region Replica**: us-west-2
- **Sync Method**: Asynchronous
- **Failover Time**: < 5 minutes
- **Data Loss**: < 1 minute

### Monitoring Requirements

#### CloudWatch Metrics
```yaml
Alarms:
  - MetricName: DatabaseConnections
    Threshold: 80
    ComparisonOperator: GreaterThanThreshold
    
  - MetricName: CPUUtilization
    Threshold: 75
    ComparisonOperator: GreaterThanThreshold
    
  - MetricName: ReadLatency
    Threshold: 100  # milliseconds
    ComparisonOperator: GreaterThanThreshold
    
  - MetricName: WriteLatency
    Threshold: 200  # milliseconds
    ComparisonOperator: GreaterThanThreshold
    
  - MetricName: FreeStorageSpace
    Threshold: 104857600  # 100GB in bytes
    ComparisonOperator: LessThanThreshold
```

#### Custom Metrics
- **Query Performance**: P50, P95, P99 latencies
- **Connection Pool**: Utilization and wait times
- **Cache Hit Rate**: Per table and query type
- **API Response Times**: By endpoint
- **Data Freshness**: Lag from source APIs

#### Logging Configuration
- **Slow Query Log**: Queries > 1 second
- **Connection Log**: Failed connections
- **Error Log**: All database errors
- **Audit Log**: Schema changes and admin actions
- **Log Retention**: 90 days in CloudWatch Logs

## 9. Migration Strategy

### Data Migration Approach

#### Phase 1: Parallel Running (Week 1)
1. **Setup PostgreSQL** alongside SQLite
2. **Replicate schema** with optimizations
3. **Dual writes** to both databases
4. **Validation** of data consistency

#### Phase 2: Gradual Migration (Week 2-3)
1. **Read traffic split**: 10% → 50% → 100%
2. **Monitor performance** metrics
3. **Rollback capability** maintained
4. **Data sync verification**

#### Phase 3: Cutover (Week 4)
1. **Full traffic** to PostgreSQL
2. **SQLite** in read-only mode
3. **Final data validation**
4. **Decommission** SQLite

### Zero-Downtime Deployment

#### Blue-Green Deployment
```python
class DatabaseRouter:
    """
    Route database traffic during migration.
    """
    
    def __init__(self):
        self.postgres_weight = float(os.getenv('POSTGRES_WEIGHT', '0.1'))
        self.sqlite_cache = SQLiteStockDataCache()
        self.postgres_cache = StockDataCache()
    
    async def get_cache_instance(self):
        """Return cache instance based on traffic split."""
        if random.random() < self.postgres_weight:
            return self.postgres_cache
        return self.sqlite_cache
    
    async def dual_write(self, ticker: str, data: pd.DataFrame, source: str):
        """Write to both databases during migration."""
        results = await asyncio.gather(
            self.sqlite_cache.cache_data(ticker, data, source),
            self.postgres_cache.cache_data(ticker, data, source),
            return_exceptions=True
        )
        
        # Log any discrepancies
        if results[0] != results[1]:
            logging.warning(f"Write discrepancy for {ticker}: SQLite={results[0]}, PostgreSQL={results[1]}")
```

### Rollback Procedures

#### Automated Rollback Triggers
- **Error Rate** > 5% triggers rollback
- **Latency** > 200ms P99 triggers rollback
- **Connection Failures** > 10/minute
- **Data Inconsistency** detected

#### Rollback Steps
1. **Update traffic weights** to 0% PostgreSQL
2. **Pause write operations** temporarily
3. **Verify SQLite** is receiving all traffic
4. **Investigate issues** in PostgreSQL
5. **Resume operations** with SQLite only

### Data Validation

#### Validation Queries
```sql
-- Record count validation
SELECT 
    'sqlite' as source,
    ticker_symbol,
    COUNT(*) as record_count,
    MIN(date) as min_date,
    MAX(date) as max_date
FROM sqlite_stock_data
GROUP BY ticker_symbol

UNION ALL

SELECT 
    'postgres' as source,
    ticker_symbol,
    COUNT(*) as record_count,
    MIN(date) as min_date,
    MAX(date) as max_date
FROM stock_data
GROUP BY ticker_symbol;

-- Data integrity check
WITH data_comparison AS (
    SELECT 
        s.ticker_symbol,
        s.date,
        s.close as sqlite_close,
        p.close as postgres_close,
        ABS(s.close - p.close) as price_diff
    FROM sqlite_stock_data s
    FULL OUTER JOIN stock_data p 
        ON s.ticker_symbol = p.ticker_symbol 
        AND s.date = p.date
)
SELECT 
    ticker_symbol,
    COUNT(*) as mismatches,
    AVG(price_diff) as avg_diff,
    MAX(price_diff) as max_diff
FROM data_comparison
WHERE price_diff > 0.0001
GROUP BY ticker_symbol;
```

## 10. Performance Benchmarks

### Current Performance (SQLite)
- **Single Query**: 200-500ms
- **Concurrent Queries**: 10 max
- **Bulk Insert**: 100 records/second
- **Connection Time**: 100-300ms
- **Cold Start**: 2-3 seconds

### Expected Performance (PostgreSQL + RDS Proxy)
- **Single Query**: 20-50ms (90% improvement)
- **Concurrent Queries**: 1000+ (100x improvement)
- **Bulk Insert**: 10,000+ records/second (100x improvement)
- **Connection Time**: 5-10ms (95% improvement)
- **Cold Start**: 200-500ms (80% improvement)

### Benchmark Test Suite

```python
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

class PerformanceBenchmark:
    """
    Comprehensive performance testing suite.
    """
    
    async def benchmark_query_performance(self):
        """Test single query performance."""
        ticker = "AAPL"
        start_date = date(2023, 1, 1)
        end_date = date(2023, 12, 31)
        
        # Warm up
        await self.db.get_price_data(ticker, start_date, end_date)
        
        # Benchmark
        times = []
        for _ in range(100):
            start = time.time()
            await self.db.get_price_data(ticker, start_date, end_date)
            times.append(time.time() - start)
        
        return {
            'p50': np.percentile(times, 50) * 1000,
            'p95': np.percentile(times, 95) * 1000,
            'p99': np.percentile(times, 99) * 1000,
        }
    
    async def benchmark_concurrent_load(self):
        """Test concurrent query handling."""
        async def query_task(ticker):
            return await self.db.get_latest_prices([ticker])
        
        # Create 1000 concurrent requests
        tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA"] * 200
        tasks = [query_task(ticker) for ticker in tickers]
        
        start = time.time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        duration = time.time() - start
        
        errors = sum(1 for r in results if isinstance(r, Exception))
        
        return {
            'total_requests': len(tasks),
            'duration': duration,
            'rps': len(tasks) / duration,
            'errors': errors,
            'error_rate': errors / len(tasks)
        }
    
    async def benchmark_bulk_insert(self):
        """Test bulk insert performance."""
        # Generate test data
        dates = pd.date_range('2020-01-01', '2023-12-31', freq='B')
        data = pd.DataFrame({
            'Date': dates,
            'Open': np.random.uniform(100, 200, len(dates)),
            'High': np.random.uniform(100, 200, len(dates)),
            'Low': np.random.uniform(100, 200, len(dates)),
            'Close': np.random.uniform(100, 200, len(dates)),
            'Volume': np.random.randint(1000000, 10000000, len(dates)),
            'Adj Close': np.random.uniform(100, 200, len(dates))
        })
        data.set_index('Date', inplace=True)
        
        start = time.time()
        records_inserted = await self.db.bulk_insert_stock_data(
            'TEST', data, 'benchmark'
        )
        duration = time.time() - start
        
        return {
            'records': records_inserted,
            'duration': duration,
            'records_per_second': records_inserted / duration
        }
```

### Load Testing Results

#### Query Performance
| Metric | SQLite | PostgreSQL | Improvement |
|--------|--------|------------|-------------|
| P50 Latency | 250ms | 25ms | 10x |
| P95 Latency | 450ms | 45ms | 10x |
| P99 Latency | 800ms | 80ms | 10x |
| Max Concurrent | 10 | 1000+ | 100x |

#### Bulk Operations
| Operation | SQLite | PostgreSQL | Improvement |
|-----------|--------|------------|-------------|
| Insert Rate | 100/s | 10,000/s | 100x |
| Batch Size | 100 | 10,000 | 100x |
| Transaction Time | 2s | 0.2s | 10x |

#### Connection Management
| Metric | SQLite | PostgreSQL + Proxy | Improvement |
|--------|--------|--------------------|-------------|
| Connection Time | 200ms | 5ms | 40x |
| Pool Efficiency | N/A | 95% | N/A |
| Connection Reuse | 0% | 95% | ∞ |

This PRD provides a comprehensive roadmap for migrating from SQLite to PostgreSQL with connection pooling, addressing all the performance bottlenecks in your serverless environment. The implementation will enable your platform to handle enterprise-scale loads while maintaining sub-100ms response times.