# Async Database Migration Plan for Vercel Deployment

## Executive Summary

This document provides a detailed assessment and migration plan for converting the ETF Research Platform from SQLite to a Vercel-compatible async database architecture. Based on analysis of the current implementations and Vercel constraints, we recommend **Vercel Postgres** as the primary database with a phased migration approach.

## Current State Assessment

### SQLite Implementation Analysis

#### Current Architecture
- **Database**: SQLite with file-based storage (`data/etf_platform.db`)
- **Connection Management**: Thread-based locking (`threading.Lock()`)
- **Cache Manager**: Two implementations:
  - `sqlite_cache_manager.py`: SQLite-specific for local development
  - `cache_manager.py`: PostgreSQL with psycopg2 connection pooling
- **Schema**: Well-structured with indexes for performance

#### Key Limitations for Vercel
1. **No Persistent Filesystem**: SQLite requires file storage, which Vercel doesn't provide
2. **Synchronous Operations**: Current implementation uses blocking I/O
3. **Thread-based Locking**: Incompatible with async/await patterns
4. **Connection Pooling**: psycopg2's ThreadedConnectionPool not async-compatible
5. **Local File Dependencies**: Database path hardcoded to local filesystem

### Database Operations Analysis

#### Current Operations Patterns
```python
# Synchronous patterns found:
- conn.execute() - Blocking database calls
- cursor.fetchall() - Synchronous result fetching
- conn.commit() - Blocking commits
- with self._lock: - Thread-based locking
```

#### Data Volume Estimates
- Tables: 4 main tables (tickers, stock_data, cache_ranges, api_usage)
- Indexes: 4 performance indexes
- Operations: Primarily read-heavy with bulk inserts
- Cache hit patterns: Missing range detection with date-based queries

## Recommended Solution: Vercel Postgres

### Why Vercel Postgres?
1. **Native Integration**: Zero-configuration with Vercel platform
2. **Automatic Connection Pooling**: Built-in pgbouncer integration
3. **Preview Environments**: Automatic database branching
4. **Edge Compatibility**: Works with Edge Functions
5. **Included Resources**: Part of Vercel Pro plan

### Alternative Considered: Temporary AsyncIO Wrapper
```python
# NOT RECOMMENDED - High overhead approach
async def async_sqlite_query(query, params):
    return await asyncio.to_thread(
        lambda: sync_sqlite_execute(query, params)
    )
```

**Decision**: Direct migration to Vercel Postgres is preferred over temporary wrappers due to:
- Better performance (native async vs thread overhead)
- Vercel compatibility requirements
- Cleaner architecture
- Avoiding double migration work

## Migration Strategy

### Phase 0: Prerequisites (Week 1-2)

#### Week 1: Environment Setup
1. **Create Vercel Postgres Instance**
   ```bash
   vercel postgres create etf-platform-db --region iad1
   vercel env pull .env.local
   ```

2. **Local Development Setup**
   ```bash
   # Docker PostgreSQL for local development
   docker run -d \
     --name etf-postgres-local \
     -e POSTGRES_PASSWORD=local \
     -e POSTGRES_DB=etf_platform \
     -p 5432:5432 \
     postgres:15-alpine
   ```

3. **Install Async Dependencies**
   ```bash
   pip install asyncpg aiosqlite sqlalchemy[asyncio] alembic
   ```

#### Week 2: Schema Migration & Data Export

1. **Create Async Schema**
   ```python
   # migrations/create_schema.py
   from sqlalchemy.ext.asyncio import create_async_engine
   
   async def create_tables():
       engine = create_async_engine(
           os.environ["POSTGRES_URL_POOLING"],
           pool_size=5,
           max_overflow=0,
           pool_pre_ping=True
       )
       
       async with engine.begin() as conn:
           await conn.execute("""
               CREATE TABLE IF NOT EXISTS stock_data (
                   id SERIAL PRIMARY KEY,
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
                   UNIQUE(ticker_symbol, date)
               );
               
               CREATE INDEX idx_stock_data_lookup 
               ON stock_data (ticker_symbol, date DESC);
               
               CREATE INDEX idx_stock_data_date 
               ON stock_data (date);
           """)
   ```

2. **Export SQLite Data**
   ```python
   # scripts/export_sqlite.py
   import sqlite3
   import json
   
   def export_data():
       conn = sqlite3.connect('data/etf_platform.db')
       cursor = conn.cursor()
       
       # Export in batches to handle large datasets
       BATCH_SIZE = 10000
       offset = 0
       
       while True:
           cursor.execute("""
               SELECT * FROM stock_data 
               ORDER BY ticker_symbol, date
               LIMIT ? OFFSET ?
           """, (BATCH_SIZE, offset))
           
           rows = cursor.fetchall()
           if not rows:
               break
               
           # Save to JSON files
           with open(f'data/export_batch_{offset}.json', 'w') as f:
               json.dump(rows, f)
           
           offset += BATCH_SIZE
   ```

### Connection Pooling Strategy

#### Vercel-Optimized Pool Configuration
```python
# api/db/async_pool.py
from contextlib import asynccontextmanager
import asyncpg
from functools import lru_cache

class VercelAsyncPool:
    def __init__(self):
        self.pool = None
        self.config = {
            'min_size': 1,  # Minimize idle connections
            'max_size': 5,  # Conservative for serverless
            'max_inactive_connection_lifetime': 300,
            'command_timeout': 8,  # 2s buffer for 10s timeout
            'server_settings': {
                'jit': 'off',  # Faster cold starts
                'shared_preload_libraries': ''
            }
        }
    
    async def ensure_pool(self):
        if self.pool is None:
            self.pool = await asyncpg.create_pool(
                os.environ["POSTGRES_URL_POOLING"],
                **self.config
            )
        return self.pool
    
    @asynccontextmanager
    async def acquire(self):
        pool = await self.ensure_pool()
        async with pool.acquire() as conn:
            yield conn
    
    async def close(self):
        if self.pool:
            await self.pool.close()

# Singleton instance
db_pool = VercelAsyncPool()
```

### Risk Assessment

#### Technical Risks
1. **Data Loss Risk**: LOW
   - Mitigation: Complete data export before migration
   - Dual-write period during transition
   - Backup strategies in place

2. **Performance Degradation**: LOW
   - Mitigation: Async operations will improve performance
   - Connection pooling reduces overhead
   - Edge caching for hot data

3. **Compatibility Issues**: MEDIUM
   - Mitigation: Thorough testing in preview environments
   - Gradual rollout with feature flags
   - Rollback procedures documented

#### Operational Risks
1. **Downtime**: LOW
   - Mitigation: Blue-green deployment strategy
   - Preview environment testing
   - Quick rollback capability

2. **Cost Overrun**: LOW
   - Mitigation: Monitoring and alerts
   - Aggressive caching to reduce queries
   - Regular cost reviews

### Migration Steps

#### Step 1: Parallel Implementation
```python
# api/async_cache_manager.py
import asyncpg
import asyncio
from typing import List, Optional
import pandas as pd

class AsyncStockDataCache:
    def __init__(self):
        self.pool = db_pool
    
    async def get_cached_data(
        self, 
        ticker: str, 
        start_date: date, 
        end_date: date
    ) -> pd.DataFrame:
        async with self.pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT date, open, high, low, close, volume, adj_close
                FROM stock_data
                WHERE ticker_symbol = $1
                  AND date >= $2
                  AND date <= $3
                ORDER BY date ASC
            """, ticker, start_date, end_date)
            
            if not rows:
                return pd.DataFrame()
            
            df = pd.DataFrame(rows)
            df['Date'] = pd.to_datetime(df['date'])
            df.set_index('Date', inplace=True)
            return df
```

#### Step 2: Feature Flag Implementation
```python
# api/cache_factory.py
import os

def get_cache_manager():
    if os.environ.get("USE_ASYNC_DB") == "true":
        from .async_cache_manager import AsyncStockDataCache
        return AsyncStockDataCache()
    else:
        from .sqlite_cache_manager import SQLiteStockDataCache
        return SQLiteStockDataCache()
```

#### Step 3: Data Migration Script
```python
# scripts/migrate_to_postgres.py
import asyncio
import asyncpg
import json
from pathlib import Path

async def migrate_batch(pool, batch_data):
    async with pool.acquire() as conn:
        # Use COPY for bulk insert
        await conn.copy_records_to_table(
            'stock_data',
            records=batch_data,
            columns=['ticker_symbol', 'date', 'open', 'high', 
                    'low', 'close', 'volume', 'adj_close', 'source']
        )

async def main():
    pool = await asyncpg.create_pool(os.environ["POSTGRES_URL"])
    
    # Process export files
    for batch_file in Path('data').glob('export_batch_*.json'):
        with open(batch_file) as f:
            batch_data = json.load(f)
        
        await migrate_batch(pool, batch_data)
        print(f"Migrated {batch_file}")
    
    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
```

### Timeline Summary

| Week | Phase | Tasks | Risk Level |
|------|-------|-------|------------|
| 1 | Environment Setup | Create Vercel Postgres, Local setup | Low |
| 2 | Schema & Export | Create tables, Export SQLite data | Low |
| 3 | Async Implementation | Build async cache manager | Medium |
| 4 | Data Migration | Import data, Verify integrity | Medium |
| 5 | Testing & Cutover | Preview testing, Production deploy | High |

### Decision: Migration First vs Temporary Solution

**Recommendation**: **Migrate to Vercel Postgres first**, then implement async patterns.

**Rationale**:
1. SQLite's file-based nature is fundamentally incompatible with Vercel
2. `asyncio.to_thread()` adds overhead without solving the core issue
3. Direct migration avoids double work and technical debt
4. Vercel Postgres provides immediate benefits (pooling, previews)
5. Cleaner architecture for long-term maintenance

### Success Criteria

1. **Zero Data Loss**: All records successfully migrated
2. **Performance Improvement**: <100ms query response time
3. **Seamless Deployment**: No user-facing downtime
4. **Cost Efficiency**: <$50/month total database costs
5. **Developer Experience**: Easy local development setup

### Monitoring & Validation

```python
# api/health/db_check.py
async def validate_migration():
    checks = {
        "connection": False,
        "row_count_match": False,
        "performance_baseline": False,
        "preview_env_working": False
    }
    
    # Check connection
    async with db_pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
        checks["connection"] = True
    
    # Verify row counts
    async with db_pool.acquire() as conn:
        pg_count = await conn.fetchval(
            "SELECT COUNT(*) FROM stock_data"
        )
        # Compare with SQLite export count
        checks["row_count_match"] = pg_count == expected_count
    
    # Performance check
    start = time.time()
    await get_cached_data("AAPL", "2023-01-01", "2023-12-31")
    elapsed = time.time() - start
    checks["performance_baseline"] = elapsed < 0.1
    
    return checks
```

## Conclusion

This migration plan provides a clear path from SQLite to Vercel Postgres with minimal risk and maximum benefit. The two-week Phase 0 timeline is achievable with proper planning and execution. The recommendation to migrate directly to Vercel Postgres rather than using temporary async wrappers will result in better performance, cleaner code, and faster time to production.

Key advantages of this approach:
- Native Vercel integration
- Built-in connection pooling
- Automatic preview environments
- Better async performance
- Future-proof architecture

The migration can begin immediately with environment setup while maintaining the existing SQLite implementation until the cutover is complete.