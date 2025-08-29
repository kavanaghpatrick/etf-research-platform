# PRD: Streaming Response Implementation (Vercel Optimized)

## 1. Executive Summary

This document outlines the implementation of streaming responses for the ETF Research Platform, optimized for Vercel's infrastructure and leveraging their native streaming capabilities.

### Streaming Response Objectives
- Eliminate timeout errors for large multi-ticker or extended date range requests
- Provide immediate visual feedback during data processing
- Enable progressive data rendering in the UI
- Reduce memory footprint by processing data incrementally
- Support graceful error recovery during stream processing
- **Leverage Vercel's Edge Functions and streaming infrastructure**

### User Experience Improvements
- First byte response in under 200ms using Edge Functions (vs current 10-30 second wait times)
- Real-time progress indicators showing processing status
- Partial data visualization while fetching continues
- Smoother interaction with no UI freezing
- Clear error messaging for partial failures
- **Global edge delivery for low-latency streaming**

### Technical Benefits
- Reduced server memory usage through incremental processing
- Better resource utilization with streaming generators
- Improved scalability for handling concurrent large requests
- Enhanced monitoring capabilities with progress events
- More resilient error handling with partial recovery
- **Bypass Vercel's 50MB response size limit through streaming**
- **Leverage Vercel's global CDN for stream caching**

## 2. Problem Statement

The current implementation faces several critical issues when handling large data requests:

### Large Responses Causing Timeouts
- Requests for 50+ tickers or 5+ years of data frequently timeout
- Current 10-second timeout in `useStockData.ts` is insufficient for large requests
- Users receive generic timeout errors with no partial data
- No visibility into processing progress
- **Vercel's 10-second function timeout on Hobby/Pro plans**

### Poor User Experience with Long Waits
- UI freezes during large data fetches
- No feedback on processing status
- Users often re-submit requests thinking the system is unresponsive
- Cannot interact with partial results while fetch continues
- **Edge Function cold starts add latency**

### Memory Inefficiency with Full Buffering
- Server buffers entire response in memory before sending
- Large responses (100MB+) can cause memory spikes
- Multiple concurrent large requests can exhaust server resources
- Client attempts to parse massive JSON payloads at once
- **Vercel's 1GB memory limit on Serverless Functions**

### No Progress Indication
- Users have no visibility into:
  - How many tickers have been processed
  - Estimated time remaining
  - Which data sources are being queried
  - Current processing stage

### Vercel-Specific Constraints
- **50MB response size limit for non-streaming responses**
- **10-second execution timeout (Hobby/Pro) or 300-second (Enterprise)**
- **1GB memory limit for Serverless Functions**
- **No WebSocket support on Edge Functions**

## 3. Goals & Success Metrics

### Primary Goals
- **Eliminate timeout errors** for requests up to 500 tickers using streaming
- **First byte response** under 200ms using Edge Functions
- **Support unlimited dataset sizes** without hitting Vercel's 50MB limit
- **Real-time progress updates** every 100ms during processing
- **Optimize for Vercel's infrastructure** with Edge-first architecture

### Success Metrics
- **Response Time**: First byte < 200ms via Edge Functions (currently 5-30 seconds)
- **Timeout Rate**: < 0.1% of requests (currently ~15% for large requests)
- **Memory Usage**: Peak memory < 512MB per request (currently unbounded)
- **User Engagement**: 80% reduction in duplicate request submissions
- **Progress Accuracy**: Progress estimates within 10% of actual time
- **Stream Reliability**: 99.9% successful stream completion rate
- **Edge Cache Hit Rate**: > 50% for common ticker combinations

### Performance Targets
- Stream 1,000 ticker-days per second
- Handle 100 concurrent streaming requests
- Process 10 years of data for 100 tickers without timeout
- Recover from 95% of transient errors mid-stream
- **Serve initial response from Edge location < 50ms from user**

## 4. Technical Requirements

### Vercel Streaming Architecture

#### Edge Function Initial Response
```typescript
// Edge Function for immediate response and routing
export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1', 'lhr1'], // Multi-region deployment
}

export default async function handler(request: Request) {
  // Immediate response with streaming headers
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  
  // Start streaming immediately
  const response = new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Vercel-Edge': 'true',
    },
  })
  
  // Delegate to Serverless Function for heavy processing
  streamFromServerless(request, writer)
  
  return response
}
```

#### Vercel AI SDK Integration
```typescript
import { StreamingTextResponse, LangChainStream } from '@vercel/ai'
import { OpenAIStream } from '@vercel/ai'

// For AI-enhanced data processing
export async function POST(req: Request) {
  const { stream, handlers } = LangChainStream({
    onStart: async () => {
      console.log('Stream started')
    },
    onToken: async (token) => {
      console.log('Token received:', token)
    },
    onCompletion: async (completion) => {
      console.log('Stream completed')
    },
  })
  
  // Process data with AI enhancement
  const response = await processWithAI(req.body, {
    stream: true,
    onStream: handlers,
  })
  
  return new StreamingTextResponse(stream)
}
```

### Server-Sent Events Implementation
```typescript
// Vercel-optimized SSE implementation
export async function GET(request: Request) {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send immediate response
      controller.enqueue(
        encoder.encode(`event: init\ndata: ${JSON.stringify({ status: 'connected' })}\n\n`)
      )
      
      // Stream data progressively
      for await (const chunk of generateData()) {
        controller.enqueue(
          encoder.encode(`event: data\ndata: ${JSON.stringify(chunk)}\n\n`)
        )
      }
      
      controller.close()
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

### Next.js App Router Streaming
```typescript
// app/api/stream/route.ts
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  
  // Process in background
  processDataStream(body, writer)
  
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

async function processDataStream(params: any, writer: WritableStreamDefaultWriter) {
  const encoder = new TextEncoder()
  
  try {
    for await (const chunk of fetchTickerData(params)) {
      await writer.write(encoder.encode(JSON.stringify(chunk) + '\n'))
    }
  } finally {
    await writer.close()
  }
}
```

### Frontend Streaming Consumption with React Suspense
```tsx
// Using React 18 Suspense with streaming
import { Suspense } from 'react'
import { use } from 'react'

function TickerDataStream({ tickerPromise }: { tickerPromise: Promise<any> }) {
  const data = use(tickerPromise)
  return <TickerChart data={data} />
}

export function StreamingDashboard() {
  return (
    <div>
      <Suspense fallback={<ProgressIndicator />}>
        <TickerDataStream tickerPromise={streamTickerData()} />
      </Suspense>
    </div>
  )
}

// Progressive enhancement with streaming
async function* streamTickerData() {
  const response = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tickers: ['AAPL', 'GOOGL'] }),
  })
  
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader()
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    const lines = value.split('\n').filter(Boolean)
    for (const line of lines) {
      yield JSON.parse(line)
    }
  }
}
```

### Vercel KV for Stream State Management
```typescript
import { kv } from '@vercel/kv'

// Track streaming progress in Vercel KV
export async function trackStreamProgress(
  streamId: string,
  progress: StreamProgress
) {
  await kv.set(`stream:${streamId}`, progress, {
    ex: 3600, // 1 hour expiry
  })
  
  // Publish progress event
  await kv.publish(`stream:progress:${streamId}`, progress)
}

// Resume interrupted streams
export async function resumeStream(streamId: string) {
  const progress = await kv.get<StreamProgress>(`stream:${streamId}`)
  if (!progress) return null
  
  return {
    resumeFrom: progress.lastProcessedTicker,
    processedCount: progress.tickersCompleted,
  }
}
```

### Edge Function Streaming Limits
- **Maximum response size**: Unlimited with streaming (vs 50MB without)
- **Maximum execution time**: 30 seconds for Edge Functions
- **Memory limit**: 128MB for Edge Functions
- **Concurrent executions**: Based on plan limits

### CDN Caching for Streamed Content
```typescript
// Cache partial results at edge
export async function GET(request: Request) {
  const url = new URL(request.url)
  const cacheKey = `ticker-stream:${url.searchParams.get('tickers')}`
  
  // Check edge cache first
  const cached = await caches.default.match(cacheKey)
  if (cached) {
    return new Response(cached.body, {
      headers: {
        ...cached.headers,
        'X-Cache': 'HIT',
      },
    })
  }
  
  // Stream and cache simultaneously
  const { readable, writable } = new TransformStream()
  const cacheStream = new TransformStream()
  
  readable.pipeTo(cacheStream.writable)
  
  // Cache the stream
  const cacheResponse = new Response(cacheStream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'public, max-age=300', // 5 min cache
    },
  })
  
  caches.default.put(cacheKey, cacheResponse.clone())
  
  return new Response(readable, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'X-Cache': 'MISS',
    },
  })
}
```

## 5. Implementation Plan

### Phase 1: Vercel Infrastructure Setup (Week 1-2)
1. **Configure Edge Functions**
   - Set up multi-region Edge Function deployment
   - Implement request routing logic
   - Configure streaming response headers
   
2. **Integrate Vercel AI SDK**
   - Set up streaming endpoints using AI SDK
   - Implement token-based progress tracking
   - Configure error handling
   
3. **Set up Vercel KV**
   - Configure KV store for stream state
   - Implement progress tracking
   - Set up pub/sub for real-time updates

### Phase 2: Streaming Implementation (Week 3-4)
1. **Next.js App Router Integration**
   - Convert API routes to app router format
   - Implement streaming route handlers
   - Add React Suspense boundaries
   
2. **Edge-optimized Data Fetching**
   - Implement cursor-based pagination
   - Add streaming JSON serializers
   - Optimize for Edge Function constraints
   
3. **Progressive Enhancement**
   - Implement fallback for non-streaming clients
   - Add service worker for offline support
   - Create adaptive streaming based on connection

### Phase 3: Frontend Streaming (Week 5)
1. **React 18 Streaming Features**
   - Implement Suspense boundaries
   - Add streaming data hooks
   - Create progressive rendering components
   
2. **Real-time Progress UI**
   - Build progress indicators
   - Add ETA calculations
   - Implement smooth animations
   
3. **Error Boundaries**
   - Add streaming error handling
   - Implement retry mechanisms
   - Create fallback UI components

### Phase 4: Performance Optimization (Week 6)
1. **Edge Caching Strategy**
   - Implement smart caching logic
   - Add cache invalidation
   - Optimize cache keys
   
2. **Cost Optimization**
   - Monitor Edge Function invocations
   - Implement request batching
   - Add rate limiting
   
3. **Monitoring & Analytics**
   - Set up Vercel Analytics integration
   - Add custom streaming metrics
   - Create performance dashboards

## 6. Cost Implications

### Vercel Pricing Considerations

#### Edge Function Invocations
- **Free tier**: 500,000 invocations/month
- **Pro tier**: 1,000,000 included, then $2 per million
- **Streaming multiplier**: Each chunk counts as an invocation

#### Bandwidth Costs
- **Free tier**: 100GB/month
- **Pro tier**: 1TB included, then $40 per TB
- **Streaming impact**: Higher bandwidth usage due to headers

#### Edge Config Reads (Vercel KV)
- **Free tier**: 50,000 reads/month
- **Pro tier**: 1,000,000 included, then $1 per million
- **Progress tracking**: ~10 reads per stream

### Cost Optimization Strategies
```typescript
// Batch small requests to reduce invocations
export async function POST(request: Request) {
  const { tickers } = await request.json()
  
  // For small requests, use traditional response
  if (tickers.length < 10) {
    const data = await fetchAllData(tickers)
    return Response.json(data)
  }
  
  // For large requests, use streaming
  return streamingResponse(tickers)
}

// Implement request coalescing
const pendingRequests = new Map<string, Promise<any>>()

export async function getTickerData(ticker: string) {
  const key = `ticker:${ticker}`
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)
  }
  
  const promise = fetchTickerData(ticker)
  pendingRequests.set(key, promise)
  
  try {
    return await promise
  } finally {
    pendingRequests.delete(key)
  }
}
```

## 7. API Design Updates

### Vercel-Optimized Endpoints

#### POST /api/stream
```typescript
// app/api/stream/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'

const StreamRequestSchema = z.object({
  tickers: z.array(z.string()).max(500),
  startDate: z.string(),
  endDate: z.string().optional(),
  format: z.enum(['jsonl', 'sse', 'csv']).default('jsonl'),
  chunkSize: z.number().min(10).max(1000).default(100),
  includeProgress: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  const body = StreamRequestSchema.parse(await request.json())
  
  // Use Edge Runtime for initial response
  if (body.tickers.length < 10) {
    return handleSmallRequest(body)
  }
  
  return handleStreamingRequest(body)
}

export const runtime = 'edge' // Use Edge Runtime
export const preferredRegion = ['iad1', 'sfo1'] // Multi-region
```

#### GET /api/stream/[streamId]/progress
```typescript
// Track streaming progress via Vercel KV
export async function GET(
  request: NextRequest,
  { params }: { params: { streamId: string } }
) {
  const progress = await kv.get<StreamProgress>(`stream:${params.streamId}`)
  
  if (!progress) {
    return new Response('Stream not found', { status: 404 })
  }
  
  return Response.json(progress)
}
```

### Streaming Response Formats

#### Server-Sent Events (Recommended for Vercel)
```typescript
// Optimal for real-time updates on Vercel
export async function* generateSSEStream(tickers: string[]) {
  yield `event: init\ndata: ${JSON.stringify({ total: tickers.length })}\n\n`
  
  for (const [index, ticker] of tickers.entries()) {
    yield `event: progress\ndata: ${JSON.stringify({
      ticker,
      progress: ((index + 1) / tickers.length) * 100,
    })}\n\n`
    
    const data = await fetchTickerData(ticker)
    yield `event: data\ndata: ${JSON.stringify({ ticker, data })}\n\n`
  }
  
  yield `event: complete\ndata: ${JSON.stringify({ status: 'success' })}\n\n`
}
```

## 8. Code Examples

### Vercel Edge Function Streaming
```typescript
// app/api/stream/edge/route.ts
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { tickers, startDate, endDate } = await request.json()
  
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  
  // Create a TransformStream for processing
  const transformStream = new TransformStream({
    async transform(chunk, controller) {
      const processed = await processChunk(chunk)
      controller.enqueue(encoder.encode(JSON.stringify(processed) + '\n'))
    },
  })
  
  // Start streaming immediately
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial response
      controller.enqueue(
        encoder.encode(JSON.stringify({ type: 'init', timestamp: Date.now() }) + '\n')
      )
      
      // Process each ticker
      for (const ticker of tickers) {
        try {
          const progress = {
            type: 'progress',
            ticker,
            percentage: ((tickers.indexOf(ticker) + 1) / tickers.length) * 100,
          }
          controller.enqueue(encoder.encode(JSON.stringify(progress) + '\n'))
          
          // Fetch data (this could be from external API, database, etc.)
          const data = await fetchFromDataSource(ticker, startDate, endDate)
          
          controller.enqueue(
            encoder.encode(JSON.stringify({ type: 'data', ticker, data }) + '\n')
          )
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({ type: 'error', ticker, error: error.message }) + '\n'
            )
          )
        }
      }
      
      controller.enqueue(
        encoder.encode(JSON.stringify({ type: 'complete', timestamp: Date.now() }) + '\n')
      )
      controller.close()
    },
  })
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
```

### Frontend Vercel AI SDK Integration
```tsx
// components/StreamingChart.tsx
import { useCompletion } from '@vercel/ai/react'
import { useEffect, useState } from 'react'

export function StreamingChart({ tickers }: { tickers: string[] }) {
  const [chartData, setChartData] = useState<Map<string, any>>(new Map())
  
  const { complete, completion, isLoading } = useCompletion({
    api: '/api/stream',
    body: { tickers },
    onResponse: (response) => {
      // Handle streaming response
      const reader = response.body?.getReader()
      if (!reader) return
      
      const processStream = async () => {
        const decoder = new TextDecoder()
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          
          for (const line of lines) {
            if (!line) continue
            try {
              const event = JSON.parse(line)
              if (event.type === 'data') {
                setChartData((prev) => new Map(prev).set(event.ticker, event.data))
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
      
      processStream()
    },
  })
  
  return (
    <div>
      {isLoading && <StreamingProgress />}
      <ChartGrid data={chartData} />
    </div>
  )
}
```

### Vercel KV Progress Tracking
```typescript
// lib/streaming/progress.ts
import { kv } from '@vercel/kv'
import { nanoid } from 'nanoid'

export class StreamProgressTracker {
  private streamId: string
  private updateInterval: number = 1000 // Update every second
  private lastUpdate: number = 0
  
  constructor() {
    this.streamId = nanoid()
  }
  
  async updateProgress(progress: Partial<StreamProgress>) {
    const now = Date.now()
    if (now - this.lastUpdate < this.updateInterval) {
      return // Throttle updates
    }
    
    this.lastUpdate = now
    
    const current = await kv.get<StreamProgress>(`stream:${this.streamId}`) || {}
    const updated = { ...current, ...progress, lastUpdate: now }
    
    await kv.setex(`stream:${this.streamId}`, 3600, updated)
    await kv.publish(`stream:progress:${this.streamId}`, updated)
  }
  
  async complete(summary: StreamSummary) {
    await this.updateProgress({
      status: 'complete',
      summary,
      completedAt: Date.now(),
    })
  }
  
  getStreamId() {
    return this.streamId
  }
}

// Usage in API route
export async function POST(request: Request) {
  const tracker = new StreamProgressTracker()
  const { tickers } = await request.json()
  
  // Return stream ID immediately
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          JSON.stringify({ type: 'init', streamId: tracker.getStreamId() }) + '\n'
        )
      )
      
      for (const [index, ticker] of tickers.entries()) {
        await tracker.updateProgress({
          currentTicker: ticker,
          tickersCompleted: index,
          totalTickers: tickers.length,
          percentage: ((index + 1) / tickers.length) * 100,
        })
        
        // Process ticker...
      }
      
      await tracker.complete({ totalProcessed: tickers.length })
      controller.close()
    },
  })
  
  return new Response(stream)
}
```

### Cost-Optimized Batching
```typescript
// lib/streaming/batcher.ts
export class RequestBatcher {
  private pendingRequests = new Map<string, Set<string>>()
  private batchTimeout: number = 50 // 50ms batching window
  private maxBatchSize: number = 20
  
  async batchRequest(ticker: string, requester: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.pendingRequests.has(ticker)) {
        this.pendingRequests.set(ticker, new Set())
        
        setTimeout(() => {
          this.processBatch(ticker)
        }, this.batchTimeout)
      }
      
      this.pendingRequests.get(ticker)!.add(requester)
      
      // Store resolver for later
      this.resolvers.set(`${ticker}:${requester}`, { resolve, reject })
      
      // Process immediately if batch is full
      if (this.pendingRequests.get(ticker)!.size >= this.maxBatchSize) {
        this.processBatch(ticker)
      }
    })
  }
  
  private async processBatch(ticker: string) {
    const requesters = this.pendingRequests.get(ticker)
    if (!requesters) return
    
    this.pendingRequests.delete(ticker)
    
    try {
      // Make single request for all requesters
      const data = await fetchTickerData(ticker)
      
      // Resolve all promises
      for (const requester of requesters) {
        const resolver = this.resolvers.get(`${ticker}:${requester}`)
        resolver?.resolve(data)
      }
    } catch (error) {
      // Reject all promises
      for (const requester of requesters) {
        const resolver = this.resolvers.get(`${ticker}:${requester}`)
        resolver?.reject(error)
      }
    }
  }
}
```

## 9. Testing Strategy

### Vercel-Specific Testing
```typescript
// __tests__/streaming.edge.test.ts
import { testEdgeFunction } from '@vercel/edge-runtime'

describe('Edge Function Streaming', () => {
  it('should stream data within Edge Function limits', async () => {
    const response = await testEdgeFunction(handler, {
      method: 'POST',
      body: JSON.stringify({ tickers: ['AAPL', 'GOOGL'] }),
    })
    
    expect(response.headers.get('content-type')).toBe('application/x-ndjson')
    
    const reader = response.body!.getReader()
    const chunks = []
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(new TextDecoder().decode(value))
    }
    
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0]).toContain('"type":"init"')
  })
  
  it('should handle Edge Function timeout gracefully', async () => {
    // Test with delay that would exceed Edge timeout
    const response = await testEdgeFunction(handler, {
      method: 'POST',
      body: JSON.stringify({ 
        tickers: Array(100).fill('AAPL'),
        simulateDelay: 35000, // 35 seconds
      }),
    })
    
    // Should return partial results before timeout
    const text = await response.text()
    expect(text).toContain('"type":"partial"')
  })
})
```

### Load Testing for Vercel
```typescript
// scripts/load-test-vercel.ts
import { check } from 'k6'
import http from 'k6/http'
import { Rate } from 'k6/metrics'

const errorRate = new Rate('errors')

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up
    { duration: '1m', target: 50 },   // Stay at 50 concurrent
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    errors: ['rate<0.1'], // Error rate under 10%
    http_req_duration: ['p(95)<5000'], // 95% under 5s
  },
}

export default function () {
  const params = {
    headers: { 'Content-Type': 'application/json' },
    timeout: '60s',
  }
  
  const payload = JSON.stringify({
    tickers: ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META'],
    startDate: '2023-01-01',
    endDate: '2024-01-01',
  })
  
  const res = http.post('https://your-app.vercel.app/api/stream', payload, params)
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has streaming headers': (r) => r.headers['Content-Type'].includes('ndjson'),
    'response time OK': (r) => r.timings.duration < 5000,
  })
  
  errorRate.add(res.status !== 200)
}
```

## 10. Monitoring & Analytics

### Vercel Analytics Integration
```typescript
// lib/analytics/streaming.ts
import { track } from '@vercel/analytics'
import { metric } from '@vercel/analytics'

export function trackStreamingMetrics(event: StreamEvent) {
  switch (event.type) {
    case 'start':
      track('streaming_started', {
        tickers_count: event.tickerCount,
        date_range: event.dateRange,
      })
      break
      
    case 'progress':
      metric('streaming_progress', event.percentage)
      break
      
    case 'complete':
      track('streaming_completed', {
        duration_ms: event.duration,
        records_processed: event.recordCount,
        errors: event.errorCount,
      })
      metric('streaming_duration', event.duration)
      break
      
    case 'error':
      track('streaming_error', {
        error_type: event.errorType,
        ticker: event.ticker,
      })
      break
  }
}

// Usage in streaming endpoint
export async function POST(request: Request) {
  const startTime = Date.now()
  trackStreamingMetrics({ type: 'start', tickerCount: tickers.length })
  
  // ... streaming logic ...
  
  trackStreamingMetrics({
    type: 'complete',
    duration: Date.now() - startTime,
    recordCount: processedRecords,
  })
}
```

### Custom Streaming Dashboard
```tsx
// app/admin/streaming/page.tsx
import { Suspense } from 'react'
import { getStreamingMetrics } from '@/lib/analytics'

export default async function StreamingDashboard() {
  const metrics = await getStreamingMetrics()
  
  return (
    <div className="streaming-dashboard">
      <h1>Streaming Performance</h1>
      
      <div className="metrics-grid">
        <MetricCard
          title="Active Streams"
          value={metrics.activeStreams}
          trend={metrics.streamsTrend}
        />
        <MetricCard
          title="Avg Response Time"
          value={`${metrics.avgResponseTime}ms`}
          target="< 200ms"
        />
        <MetricCard
          title="Success Rate"
          value={`${metrics.successRate}%`}
          target="> 99%"
        />
        <MetricCard
          title="Edge Cache Hit Rate"
          value={`${metrics.cacheHitRate}%`}
          target="> 50%"
        />
      </div>
      
      <Suspense fallback={<Loading />}>
        <StreamingTimeline />
      </Suspense>
    </div>
  )
}
```

## 11. Migration Guide

### Converting Existing Endpoints
```typescript
// Before: Traditional endpoint
export async function POST(request: Request) {
  const { tickers } = await request.json()
  const data = await Promise.all(
    tickers.map(ticker => fetchTickerData(ticker))
  )
  return Response.json(data)
}

// After: Streaming endpoint
export async function POST(request: Request) {
  const { tickers } = await request.json()
  
  // Small requests: traditional response
  if (tickers.length <= 10) {
    const data = await Promise.all(
      tickers.map(ticker => fetchTickerData(ticker))
    )
    return Response.json(data)
  }
  
  // Large requests: streaming
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      for (const ticker of tickers) {
        const data = await fetchTickerData(ticker)
        controller.enqueue(
          encoder.encode(JSON.stringify({ ticker, data }) + '\n')
        )
      }
      controller.close()
    },
  })
  
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}
```

## Summary

This Vercel-optimized streaming implementation leverages:

1. **Edge Functions** for ultra-low latency initial responses
2. **Vercel AI SDK** for standardized streaming patterns
3. **Next.js App Router** with React Suspense for progressive rendering
4. **Vercel KV** for distributed progress tracking
5. **Global CDN** for caching partial results
6. **Cost optimization** through intelligent batching and caching

The implementation provides:
- **< 200ms first byte** response times globally
- **Unlimited response sizes** bypassing the 50MB limit
- **99.9% reliability** with automatic error recovery
- **50% cost reduction** through efficient resource usage
- **Real-time progress** updates with minimal latency

This architecture maximizes Vercel's platform capabilities while providing an exceptional user experience for large-scale data streaming.