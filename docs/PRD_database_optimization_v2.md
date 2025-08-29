# PRD: Database Optimization for Vercel Deployment

## 1. Executive Summary

### Database Optimization Objectives for Vercel
- Migrate from SQLite to Vercel-compatible PostgreSQL solution
- Leverage Vercel's built-in connection pooling and edge infrastructure
- Optimize for serverless function constraints (10s timeout, 250MB max size)
- Support Vercel's preview environments with database branching
- Minimize cold starts using Edge Functions and Data Cache

### Expected Performance Gains
- **Query Response Time**: From 200-500ms to sub-50ms using Edge Functions
- **Connection Overhead**: Eliminated via Vercel's automatic pooling
- **Concurrent Requests**: Unlimited with Vercel's infrastructure
- **Preview Deployments**: Instant database branching for testing
- **Global Performance**: <100ms worldwide via Edge Network

### Vercel-Specific Infrastructure
- **Primary Options**: Vercel Postgres, Neon, Supabase, or PlanetScale
- **Edge Functions**: For read-heavy operations
- **Data Cache**: Built-in caching layer
- **KV Storage**: For hot data and session management
- **Preview Environments**: Automatic database branching

## 2. Problem Statement

### Current Architecture Limitations in Vercel Context

#### SQLite Incompatibility
- Not supported in Vercel's serverless environment
- No persistent filesystem for database files
- Cannot share state between function invocations
- Incompatible with Edge Runtime

#### Vercel Function Constraints
- 10-second execution timeout (Pro plan: 60s)
- 250MB uncompressed deployment size
- No persistent connections between invocations
- Stateless execution model

#### Missing Vercel Optimizations
- No utilization of Edge Functions
- Not leveraging Vercel KV for caching
- Missing Data Cache integration
- No preview environment databases

## 3. Goals & Success Metrics

### Performance Goals (Vercel-Specific)
- **Edge Function Latency**: < 30ms globally
- **Serverless Function Latency**: < 100ms
- **Database Connection Time**: 0ms (pooled)
- **Preview Deploy Time**: < 60 seconds with data
- **Cache Hit Rate**: > 90% via Vercel Data Cache

### Cost Optimization Goals
- **Vercel Postgres Costs**: < $0.06/hour for compute
- **Data Transfer**: Minimize with edge caching
- **Function Invocations**: Reduce via aggressive caching
- **Storage Costs**: < $0.12/GB/month

### Developer Experience Goals
- **Local Development**: Identical to production
- **Preview Environments**: Automatic database copies
- **Zero Configuration**: Use Vercel's integrations
- **Monitoring**: Built-in Vercel Analytics

## 4. Database Options Analysis

### Option 1: Vercel Postgres (Recommended)
**Pros:**
- Native Vercel integration
- Automatic connection pooling
- Built-in branching for previews
- Zero configuration
- Included in Pro plan

**Cons:**
- Limited to 60 seconds compute time
- Regional deployment only
- Pricing scales with usage

**Setup:**
```bash
vercel env pull .env.local
vercel postgres create etf-platform-db
```

### Option 2: Neon (Serverless PostgreSQL)
**Pros:**
- True serverless scaling
- Branching for development
- Pay-per-use pricing
- Sub-second cold starts

**Cons:**
- External service to manage
- Additional authentication setup
- Not native to Vercel

### Option 3: Supabase
**Pros:**
- Built-in connection pooling
- Real-time subscriptions
- Generous free tier
- Row-level security

**Cons:**
- Heavier client library
- More complex than needed
- External dashboard

### Option 4: PlanetScale (MySQL)
**Pros:**
- Unlimited connections
- Branching workflow
- No connection pooling needed
- Vitess scaling

**Cons:**
- MySQL instead of PostgreSQL
- Schema changes require migrations
- Different query patterns

## 5. Technical Requirements for Vercel

### Database Selection: Vercel Postgres
```javascript
// vercel.json
{
  "functions": {
    "api/data/*.ts": {
      "maxDuration": 10
    },
    "api/sync/*.ts": {
      "maxDuration": 60  // Pro plan only
    }
  }
}
```

### Connection Management
```typescript
// lib/db.ts
import { sql } from '@vercel/postgres';
import { unstable_cache } from 'next/cache';

// Vercel handles connection pooling automatically
export async function getStockData(
  ticker: string,
  startDate: string,
  endDate: string
) {
  // Automatic caching with revalidation
  return unstable_cache(
    async () => {
      const { rows } = await sql`
        SELECT date, open, high, low, close, volume, adj_close
        FROM stock_data
        WHERE ticker_symbol = ${ticker}
          AND date >= ${startDate}
          AND date <= ${endDate}
        ORDER BY date ASC
      `;
      return rows;
    },
    [`stock-data-${ticker}-${startDate}-${endDate}`],
    {
      revalidate: 3600, // 1 hour
      tags: [`ticker-${ticker}`]
    }
  )();
}
```

### Edge Function Implementation
```typescript
// app/api/prices/[ticker]/route.ts
import { NextRequest } from 'next/server';

export const runtime = 'edge'; // Enable Edge Runtime
export const dynamic = 'force-static';
export const revalidate = 300; // 5 minutes

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  // Edge-compatible database query
  const data = await getLatestPrice(params.ticker);
  
  return Response.json(data, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
```

### Migration Strategy for Vercel

#### Phase 1: Local Development Setup
```bash
# Install Vercel Postgres
npm install @vercel/postgres

# Pull environment variables
vercel env pull .env.local

# Create local PostgreSQL for development
docker run -d \
  --name etf-postgres-local \
  -e POSTGRES_PASSWORD=local \
  -e POSTGRES_DB=etf_platform \
  -p 5432:5432 \
  postgres:15
```

#### Phase 2: Schema Migration
```typescript
// scripts/migrate.ts
import { sql } from '@vercel/postgres';

export async function createTables() {
  // Create tables with Vercel Postgres
  await sql`
    CREATE TABLE IF NOT EXISTS stock_data (
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
    )
  `;
  
  // Create indexes
  await sql`
    CREATE INDEX IF NOT EXISTS idx_stock_data_lookup 
    ON stock_data (ticker_symbol, date DESC)
  `;
}
```

#### Phase 3: Data Migration
```typescript
// scripts/migrate-data.ts
import { sql } from '@vercel/postgres';
import { readFileSync } from 'fs';

export async function migrateFromSQLite() {
  // Export SQLite data
  const sqliteData = JSON.parse(
    readFileSync('./data/export.json', 'utf-8')
  );
  
  // Batch insert with Vercel Postgres
  const BATCH_SIZE = 1000;
  for (let i = 0; i < sqliteData.length; i += BATCH_SIZE) {
    const batch = sqliteData.slice(i, i + BATCH_SIZE);
    
    // Build multi-row insert
    const values = batch.map((row: any) => 
      `('${row.ticker}', '${row.date}', ${row.open}, ${row.high}, 
        ${row.low}, ${row.close}, ${row.volume}, ${row.adj_close}, 
        '${row.source}')`
    ).join(',');
    
    await sql.query(`
      INSERT INTO stock_data 
      (ticker_symbol, date, open, high, low, close, volume, adj_close, source)
      VALUES ${values}
      ON CONFLICT (ticker_symbol, date) DO NOTHING
    `);
  }
}
```

## 6. Vercel-Specific Optimizations

### Data API Routes Pattern
```typescript
// app/api/data/[ticker]/route.ts
import { sql } from '@vercel/postgres';
import { z } from 'zod';

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fields: z.string().optional(),
});

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      fields: searchParams.get('fields'),
    });
    
    // Use Vercel's Data Cache
    const cacheKey = `stock-${params.ticker}-${query.startDate}-${query.endDate}`;
    
    const data = await fetch(`https://data-cache.vercel.app/${cacheKey}`, {
      next: { revalidate: 3600 } // 1 hour
    }).catch(async () => {
      // Cache miss - fetch from database
      const { rows } = await sql`
        SELECT ${query.fields || '*'}
        FROM stock_data
        WHERE ticker_symbol = ${params.ticker}
          AND date BETWEEN ${query.startDate} AND ${query.endDate}
        ORDER BY date ASC
      `;
      
      // Store in cache for next time
      await fetch('https://data-cache.vercel.app/', {
        method: 'POST',
        body: JSON.stringify({ key: cacheKey, data: rows }),
      });
      
      return rows;
    });
    
    return Response.json({ data });
  } catch (error) {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

### Vercel KV for Hot Data
```typescript
// lib/kv-cache.ts
import { kv } from '@vercel/kv';

export async function getCachedLatestPrice(ticker: string) {
  // Try KV first (ultra-fast)
  const cached = await kv.get(`price:${ticker}:latest`);
  if (cached) return cached;
  
  // Fetch from database
  const { rows } = await sql`
    SELECT date, close, volume
    FROM stock_data
    WHERE ticker_symbol = ${ticker}
    ORDER BY date DESC
    LIMIT 1
  `;
  
  if (rows.length > 0) {
    // Cache in KV for 5 minutes
    await kv.set(`price:${ticker}:latest`, rows[0], { ex: 300 });
    return rows[0];
  }
  
  return null;
}
```

### Preview Environment Branching
```typescript
// lib/db-branch.ts
import { createClient } from '@vercel/postgres';

export function getBranchClient() {
  const isPreview = process.env.VERCEL_ENV === 'preview';
  const branch = process.env.VERCEL_GIT_COMMIT_REF;
  
  if (isPreview && branch) {
    // Vercel automatically provides branched database
    return createClient();
  }
  
  // Production database
  return createClient();
}
```

## 7. Performance Monitoring

### Vercel Analytics Integration
```typescript
// app/api/data/[ticker]/route.ts
import { Analytics } from '@vercel/analytics/react';
import { track } from '@vercel/analytics';

export async function GET(request: Request) {
  const start = Date.now();
  
  try {
    const data = await fetchData();
    
    // Track performance
    track('api_performance', {
      endpoint: 'stock_data',
      duration: Date.now() - start,
      status: 'success',
    });
    
    return Response.json(data);
  } catch (error) {
    track('api_error', {
      endpoint: 'stock_data',
      duration: Date.now() - start,
      error: error.message,
    });
    
    throw error;
  }
}
```

### Custom Metrics Dashboard
```typescript
// app/api/metrics/route.ts
export async function GET() {
  const metrics = await sql`
    SELECT 
      COUNT(*) as total_queries,
      AVG(duration_ms) as avg_duration,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_duration
    FROM api_metrics
    WHERE timestamp > NOW() - INTERVAL '1 hour'
  `;
  
  return Response.json(metrics.rows[0]);
}
```

## 8. Cost Analysis

### Vercel Postgres Pricing
- **Compute**: $0.06/hour (scales to zero)
- **Storage**: $0.12/GB/month
- **Data Transfer**: Included with Vercel plan

### Estimated Monthly Costs
```
Database Compute (8 hours/day): $14.40
Storage (100GB): $12.00
Vercel Pro Plan: $20.00
Total: ~$46.40/month
```

### Cost Optimization Strategies
1. **Aggressive Caching**: Reduce database queries by 90%
2. **Edge Functions**: Minimize compute time
3. **Data Pruning**: Archive old data to reduce storage
4. **Query Optimization**: Use prepared statements

## 9. Implementation Timeline

### Week 1: Setup & Migration
- Day 1-2: Create Vercel Postgres instance
- Day 3-4: Migrate schema and indexes
- Day 5: Set up preview environments

### Week 2: Data Migration
- Day 1-2: Export SQLite data
- Day 3-4: Import to Vercel Postgres
- Day 5: Validate data integrity

### Week 3: API Updates
- Day 1-2: Update connection logic
- Day 3-4: Implement caching layer
- Day 5: Deploy to preview

### Week 4: Optimization
- Day 1-2: Add Edge Functions
- Day 3-4: Implement KV caching
- Day 5: Performance testing

### Week 5: Production Rollout
- Day 1: Deploy to production (10% traffic)
- Day 2-3: Monitor and scale to 100%
- Day 4-5: Decommission SQLite

## 10. Monitoring & Alerts

### Vercel Dashboard Metrics
- Function execution duration
- Database query performance
- Cache hit rates
- Error rates

### Custom Alerts
```typescript
// vercel.json
{
  "monitoring": {
    "alerts": [
      {
        "name": "High Query Latency",
        "metric": "function.duration",
        "threshold": 1000,
        "window": "5m"
      },
      {
        "name": "Database Errors",
        "metric": "function.error_rate",
        "threshold": 0.05,
        "window": "5m"
      }
    ]
  }
}
```

## 11. Security Considerations

### Environment Variables
```bash
# .env.local (git-ignored)
POSTGRES_URL="postgres://user:pass@host/db"
POSTGRES_PRISMA_URL="postgres://user:pass@host/db?pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://user:pass@host/db"
```

### Database Access
- Use Vercel's built-in authentication
- Implement row-level security
- Audit all database queries
- Encrypt sensitive data

## 12. Conclusion

This migration to Vercel Postgres will provide:
- **10x performance improvement** via edge caching
- **Unlimited scalability** with Vercel's infrastructure
- **Zero-config deployment** with native integration
- **Instant preview environments** for testing
- **Global distribution** via Edge Network

The total implementation time is 5 weeks with minimal risk due to Vercel's preview environment capabilities and gradual rollout strategy.