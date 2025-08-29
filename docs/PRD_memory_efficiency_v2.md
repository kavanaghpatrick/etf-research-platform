# PRD: Memory-Efficient Data Processing for Vercel Deployment (v2)

## 1. Executive Summary

This PRD outlines a comprehensive strategy to optimize memory usage in the ETF Research Platform API for Vercel's serverless environment with its strict 512MB memory limit. The current implementation creates memory spikes that exceed this limit, causing function crashes and poor user experience. This updated version specifically addresses Vercel's unique constraints and leverages its platform features for optimal performance.

**Key Objectives:**
- Ensure all operations stay under 400MB (leaving 112MB buffer for cold start overhead)
- Implement streaming and chunking patterns optimized for Vercel's architecture
- Leverage Vercel Blob Storage for temporary large data handling
- Use Edge Functions for memory-light operations
- Implement real-time memory monitoring with Vercel-specific metrics

**Expected Impact:**
- 100% elimination of OOM errors on Vercel
- Support for 15+ years of data across 20+ tickers
- 70% reduction in memory usage through aggressive optimization
- Improved cold start performance with memory-aware initialization
- Cost reduction through efficient resource utilization

## 2. Problem Statement

### Vercel-Specific Memory Constraints

1. **Hard 512MB Limit**
   - No ability to increase memory allocation
   - Includes all runtime overhead (~50-100MB for Node.js + dependencies)
   - Effective working memory: ~400-450MB maximum
   - No memory sharing between function invocations

2. **Cold Start Overhead**
   - Initial memory spike during module loading
   - Python runtime + pandas/numpy initialization: ~80-100MB
   - No persistent memory between invocations
   - Each request starts with fresh memory allocation

3. **Isolation Constraints**
   - No shared memory between concurrent executions
   - Cannot use traditional memory pooling strategies
   - Each function invocation is completely isolated
   - Background processing not available in standard functions

4. **Platform Limitations**
   - No access to system-level memory management
   - Limited garbage collection control
   - No memory-mapped files
   - Restricted process control

### Current Implementation Issues

1. **Memory-Intensive Operations**
   - Full DataFrame loading exceeds available memory
   - Multiple DataFrame copies during transformations
   - Large JSON serialization buffers
   - Accumulation of temporary objects

2. **Lack of Vercel Optimization**
   - Not utilizing Vercel Blob for large data
   - Missing Edge Function opportunities
   - No streaming response implementation
   - Inefficient cold start initialization

## 3. Goals & Success Metrics

### Primary Goals

1. **Vercel Memory Compliance**
   - Peak memory usage < 400MB (including overhead)
   - Zero OOM errors in production
   - Predictable memory patterns across all endpoints
   - Efficient cold start initialization

2. **Platform Optimization**
   - Leverage Vercel Blob for data > 10MB
   - Use Edge Functions for lightweight operations
   - Implement streaming for large responses
   - Optimize for Vercel's caching layer

3. **Performance Targets**
   - Cold start time < 3 seconds
   - TTFB < 500ms for cached data
   - Support 20+ concurrent requests
   - Process 15+ years of multi-ticker data

### Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Peak Memory Usage | 480-512MB+ | <400MB | Vercel Function Logs |
| Cold Start Memory | 150MB | <100MB | Custom profiling |
| OOM Error Rate | 15-20% | 0% | Vercel Analytics |
| Cold Start Time | 5-7s | <3s | Vercel Metrics |
| Max Data Volume | 5 years | 15+ years | Load testing |
| Concurrent Requests | 2-3 | 20+ | Vercel Dashboard |

## 4. Technical Requirements

### Vercel-Specific Optimizations

1. **Memory Budget Allocation**
   ```
   Total Available: 512MB
   - Node.js Runtime: 50MB
   - Python Runtime: 30MB
   - Core Libraries: 50MB
   - Working Memory: 382MB
     - Data Processing: 250MB
     - Response Buffer: 50MB
     - Temporary Objects: 82MB
   ```

2. **Vercel Blob Integration**
   - Store intermediate results > 10MB
   - Temporary data caching (24hr TTL)
   - Chunked upload/download support
   - Streaming capabilities

3. **Edge Function Strategy**
   - Route lightweight operations to Edge
   - Memory limit: 128MB (more predictable)
   - Ideal for data validation, routing
   - Lower cold start overhead

4. **Streaming Architecture**
   - Implement Vercel streaming responses
   - Chunk size optimization (1-5MB)
   - Progressive data sending
   - Client-side stream handling

### Memory Management Patterns

1. **Aggressive Garbage Collection**
   ```python
   import gc
   import functools
   
   def memory_managed(max_mb=350):
       """Decorator for memory-intensive operations"""
       def decorator(func):
           @functools.wraps(func)
           def wrapper(*args, **kwargs):
               # Force GC before operation
               gc.collect()
               
               try:
                   result = func(*args, **kwargs)
                   return result
               finally:
                   # Aggressive cleanup
                   gc.collect(2)  # Full collection
                   
           return wrapper
       return decorator
   ```

2. **Vercel Blob Usage Pattern**
   ```python
   from vercel import blob
   
   async def process_large_dataset(ticker_list, date_range):
       """Process large datasets using Vercel Blob storage"""
       # Check estimated memory usage
       estimated_mb = estimate_memory_usage(ticker_list, date_range)
       
       if estimated_mb > 200:  # Use blob for large operations
           # Process in chunks, store in blob
           blob_urls = []
           for chunk in generate_chunks(ticker_list):
               result = process_chunk(chunk, date_range)
               blob_url = await blob.put(f"chunk_{chunk.id}.pkl", result)
               blob_urls.append(blob_url)
               del result  # Immediate cleanup
               
           # Stream results from blob
           return stream_from_blobs(blob_urls)
       else:
           # Process in memory for small datasets
           return process_in_memory(ticker_list, date_range)
   ```

3. **Edge Function Router**
   ```typescript
   // Edge function for request routing and light processing
   export const config = {
     runtime: 'edge',
   };
   
   export default async function handler(request: Request) {
     const { searchParams } = new URL(request.url);
     const dataSize = estimateDataSize(searchParams);
     
     if (dataSize > LARGE_DATA_THRESHOLD) {
       // Route to serverless function with streaming
       return routeToServerless(request, { streaming: true });
     } else if (dataSize > MEDIUM_DATA_THRESHOLD) {
       // Use blob storage strategy
       return routeToServerless(request, { useBlob: true });
     } else {
       // Process in Edge function
       return processInEdge(request);
     }
   }
   ```

## 5. Implementation Plan

### Phase 1: Vercel Memory Profiling & Baseline (Week 1)

**Objective:** Establish accurate memory baselines in Vercel environment

**Tasks:**
1. Implement Vercel-specific memory profiling
   ```python
   import psutil
   import os
   
   class VercelMemoryProfiler:
       def __init__(self):
           self.process = psutil.Process(os.getpid())
           self.baseline = self.get_memory_mb()
       
       def get_memory_mb(self):
           """Get current memory usage in MB"""
           return self.process.memory_info().rss / 1024 / 1024
       
       def log_memory(self, operation):
           """Log memory usage to Vercel logs"""
           current = self.get_memory_mb()
           delta = current - self.baseline
           print(f"MEMORY_PROFILE: {operation} - Current: {current:.1f}MB, Delta: {delta:.1f}MB")
   ```

2. Audit cold start memory usage
3. Map memory usage by operation type
4. Identify memory hotspots
5. Create Vercel dashboard for monitoring

**Deliverables:**
- Memory profiling infrastructure
- Baseline memory report
- Vercel monitoring dashboard
- Memory optimization roadmap

### Phase 2: Data Type & Chunking Optimization (Week 2)

**Objective:** Reduce memory footprint by 70% through dtype optimization and chunking

**Tasks:**
1. Implement aggressive dtype optimization
   ```python
   VERCEL_DTYPE_MAPPING = {
       # Ultra-efficient dtypes for Vercel
       'Open': 'float32',
       'High': 'float32', 
       'Low': 'float32',
       'Close': 'float32',
       'Volume': 'uint32',  # Unsigned for extra range
       'ticker': 'category',
       'date': 'datetime64[D]',  # Day precision only
   }
   ```

2. Create memory-aware chunking system
3. Implement progressive data loading
4. Build chunk size auto-tuning
5. Add memory pressure detection

**Deliverables:**
- Optimized data loading module
- Chunking infrastructure
- Memory usage comparison
- Performance benchmarks

### Phase 3: Vercel Blob Integration (Week 3)

**Objective:** Offload large data operations to Vercel Blob storage

**Tasks:**
1. Design blob storage strategy
   ```python
   class VercelBlobCache:
       async def should_use_blob(self, data_size_mb):
           """Determine if blob storage should be used"""
           available_memory = 400 - get_current_memory_mb()
           return data_size_mb > available_memory * 0.5
       
       async def process_with_blob(self, operation_id, data_generator):
           """Process large data using blob storage"""
           blob_parts = []
           
           async for chunk in data_generator:
               # Process chunk
               result = process_chunk(chunk)
               
               # Store in blob
               blob_url = await blob.put(
                   f"{operation_id}/part_{len(blob_parts)}.pkl",
                   result,
                   options={'ttl': 3600}  # 1 hour TTL
               )
               blob_parts.append(blob_url)
               
               # Clean up
               del chunk, result
               gc.collect()
           
           return blob_parts
   ```

2. Implement blob-based data pipeline
3. Create streaming blob readers
4. Add blob cleanup strategies
5. Build fallback mechanisms

**Deliverables:**
- Blob storage integration
- Streaming blob handlers
- Memory overflow protection
- Cost analysis report

### Phase 4: Edge Function Implementation (Week 4)

**Objective:** Route appropriate operations to memory-efficient Edge Functions

**Tasks:**
1. Identify Edge-suitable operations
2. Implement Edge function router
3. Create Edge-optimized endpoints
4. Build request distribution logic
5. Add Edge-specific monitoring

**Edge Function Examples:**
```typescript
// Lightweight data validation
export async function validateRequest(request: Request) {
  const data = await request.json();
  
  // Validate in Edge (low memory)
  const errors = validateDataStructure(data);
  if (errors.length > 0) {
    return new Response(JSON.stringify({ errors }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Pass to serverless for processing
  return fetch(`${SERVERLESS_URL}/process`, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

**Deliverables:**
- Edge function suite
- Request router
- Performance comparison
- Migration guide

### Phase 5: Streaming Response System (Week 5)

**Objective:** Implement comprehensive streaming to prevent memory accumulation

**Tasks:**
1. Build Vercel streaming infrastructure
   ```python
   from vercel import Response
   import json
   
   def create_streaming_response(data_generator):
       """Create Vercel streaming response"""
       async def stream():
           yield b'{"data":['
           first = True
           
           async for chunk in data_generator:
               if not first:
                   yield b','
               yield json.dumps(chunk).encode()
               first = False
               
               # Allow event loop to run
               await asyncio.sleep(0)
           
           yield b']}'
       
       return Response(
           stream(),
           headers={
               'Content-Type': 'application/json',
               'Transfer-Encoding': 'chunked',
               'Cache-Control': 'no-cache'
           }
       )
   ```

2. Implement backpressure handling
3. Create client streaming handlers
4. Add progress indicators
5. Build error recovery

**Deliverables:**
- Streaming response system
- Client integration guide
- Performance metrics
- Error handling documentation

## 6. Technical Design

### Vercel Memory Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Vercel Function (512MB)               │
├─────────────────────────────────────────────────────────┤
│  System & Runtime (112MB)                               │
│  ├─ Node.js Runtime (50MB)                              │
│  ├─ Python Runtime (30MB)                               │
│  └─ System Overhead (32MB)                              │
├─────────────────────────────────────────────────────────┤
│  Application Memory (400MB)                             │
│  ├─ Core Libraries (50MB)                               │
│  │  ├─ pandas/numpy (35MB)                              │
│  │  └─ Other deps (15MB)                                │
│  ├─ Working Memory (350MB)                              │
│  │  ├─ Data Buffers (200MB)                            │
│  │  ├─ Processing (100MB)                              │
│  │  └─ Response Buffer (50MB)                          │
└─────────────────────────────────────────────────────────┘
```

### Memory-Efficient Processing Pipeline

```python
class VercelOptimizedProcessor:
    def __init__(self):
        self.memory_limit = 350  # MB
        self.blob_threshold = 50  # MB
        self.chunk_size = 1000  # rows
        
    async def process_request(self, tickers, date_range):
        """Main processing pipeline optimized for Vercel"""
        # Step 1: Estimate memory requirements
        estimated_mb = self.estimate_memory(tickers, date_range)
        
        # Step 2: Choose processing strategy
        if estimated_mb < 100:
            return await self.process_in_memory(tickers, date_range)
        elif estimated_mb < 300:
            return await self.process_chunked(tickers, date_range)
        else:
            return await self.process_with_blob(tickers, date_range)
    
    async def process_in_memory(self, tickers, date_range):
        """Small datasets - process entirely in memory"""
        with MemoryGuard(max_mb=200):
            data = await fetch_data(tickers, date_range)
            optimized = optimize_dtypes(data)
            result = calculate_metrics(optimized)
            return create_response(result)
    
    async def process_chunked(self, tickers, date_range):
        """Medium datasets - process in chunks"""
        async def chunk_generator():
            for ticker in tickers:
                for date_chunk in split_date_range(date_range, days=365):
                    with MemoryGuard(max_mb=100):
                        data = await fetch_data([ticker], date_chunk)
                        yield process_chunk(data)
                        del data  # Explicit cleanup
                        gc.collect()
        
        return create_streaming_response(chunk_generator())
    
    async def process_with_blob(self, tickers, date_range):
        """Large datasets - use Vercel Blob storage"""
        operation_id = generate_operation_id()
        blob_urls = []
        
        # Process in small chunks, store in blob
        for ticker_chunk in chunk_list(tickers, size=5):
            with MemoryGuard(max_mb=150):
                data = await fetch_data(ticker_chunk, date_range)
                result = process_data(data)
                
                # Store in blob
                blob_url = await blob.put(
                    f"{operation_id}/{ticker_chunk[0]}.pkl",
                    serialize_efficient(result),
                    options={'ttl': 3600}
                )
                blob_urls.append(blob_url)
                
                # Aggressive cleanup
                del data, result
                gc.collect(2)
        
        # Stream results from blob
        return create_blob_stream_response(blob_urls)
```

### Memory Guard Implementation

```python
import contextlib
import psutil
import os

@contextlib.contextmanager
def MemoryGuard(max_mb=300):
    """Context manager to enforce memory limits"""
    process = psutil.Process(os.getpid())
    initial_memory = process.memory_info().rss / 1024 / 1024
    
    def check_memory():
        current = process.memory_info().rss / 1024 / 1024
        if current > initial_memory + max_mb:
            raise MemoryError(f"Memory limit exceeded: {current:.1f}MB > {initial_memory + max_mb:.1f}MB")
    
    # Install periodic check
    import signal
    
    def memory_check_handler(signum, frame):
        check_memory()
    
    old_handler = signal.signal(signal.SIGALRM, memory_check_handler)
    signal.setitimer(signal.ITIMER_REAL, 0.1, 0.1)  # Check every 100ms
    
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)  # Stop timer
        signal.signal(signal.SIGALRM, old_handler)
        
        # Final cleanup
        gc.collect()
        
        # Log memory usage
        final_memory = process.memory_info().rss / 1024 / 1024
        print(f"Memory delta: {final_memory - initial_memory:.1f}MB")
```

### Edge Function Router

```typescript
// Edge function for intelligent request routing
import { Redis } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

interface RouteDecision {
  target: 'edge' | 'serverless' | 'serverless-stream';
  useBlob: boolean;
  estimatedMemoryMB: number;
}

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  
  // Parse request parameters
  const tickers = searchParams.get('tickers')?.split(',') || [];
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  
  // Make routing decision
  const decision = await makeRoutingDecision(tickers, startDate, endDate);
  
  // Log decision for monitoring
  console.log(`ROUTING_DECISION: ${JSON.stringify(decision)}`);
  
  switch (decision.target) {
    case 'edge':
      // Process lightweight request in Edge
      return handleEdgeRequest(request);
      
    case 'serverless':
      // Forward to serverless function
      return forwardToServerless(request, { useBlob: decision.useBlob });
      
    case 'serverless-stream':
      // Forward with streaming enabled
      return forwardToServerlessStream(request);
      
    default:
      return new Response('Invalid routing decision', { status: 500 });
  }
}

async function makeRoutingDecision(
  tickers: string[], 
  startDate: string | null, 
  endDate: string | null
): Promise<RouteDecision> {
  // Calculate data size estimate
  const days = calculateDays(startDate, endDate);
  const estimatedRows = tickers.length * days;
  const estimatedMemoryMB = estimatedRows * 0.001; // 1KB per row estimate
  
  if (estimatedMemoryMB < 10) {
    return {
      target: 'edge',
      useBlob: false,
      estimatedMemoryMB
    };
  } else if (estimatedMemoryMB < 200) {
    return {
      target: 'serverless',
      useBlob: false,
      estimatedMemoryMB
    };
  } else if (estimatedMemoryMB < 500) {
    return {
      target: 'serverless',
      useBlob: true,
      estimatedMemoryMB
    };
  } else {
    return {
      target: 'serverless-stream',
      useBlob: true,
      estimatedMemoryMB
    };
  }
}
```

## 7. Code Patterns for Vercel

### Memory-Efficient DataFrame Operations

```python
def create_memory_efficient_dataframe(data: List[Dict]) -> pd.DataFrame:
    """Create DataFrame with minimal memory footprint for Vercel"""
    if not data:
        return pd.DataFrame()
    
    # Pre-calculate sizes
    n_rows = len(data)
    
    # Use most memory-efficient dtypes
    dtype_map = {
        'float': np.float32,
        'int': np.uint32,
        'str': 'category'
    }
    
    # Create structured array for efficiency
    dtypes = []
    for key, value in data[0].items():
        if isinstance(value, float):
            dtypes.append((key, np.float32))
        elif isinstance(value, int):
            dtypes.append((key, np.uint32))
        else:
            dtypes.append((key, object))
    
    # Allocate array
    arr = np.empty(n_rows, dtype=dtypes)
    
    # Fill efficiently
    for i, row in enumerate(data):
        arr[i] = tuple(row.values())
    
    # Convert to DataFrame
    df = pd.DataFrame(arr)
    
    # Optimize string columns
    for col in df.select_dtypes(include=[object]).columns:
        df[col] = df[col].astype('category')
    
    return df
```

### Vercel Blob Streaming Pattern

```python
import aiohttp
from vercel import blob
import pickle
import zlib

class BlobStreamer:
    """Stream large datasets through Vercel Blob"""
    
    def __init__(self, operation_id: str):
        self.operation_id = operation_id
        self.part_count = 0
        
    async def write_chunk(self, data: pd.DataFrame) -> str:
        """Write DataFrame chunk to blob"""
        # Compress data
        serialized = pickle.dumps(data)
        compressed = zlib.compress(serialized, level=9)
        
        # Store in blob
        blob_name = f"{self.operation_id}/part_{self.part_count:04d}.pkl.gz"
        blob_url = await blob.put(blob_name, compressed, {
            'contentType': 'application/octet-stream',
            'ttl': 3600  # 1 hour
        })
        
        self.part_count += 1
        return blob_url
    
    async def read_stream(self, blob_urls: List[str]):
        """Stream data from blob URLs"""
        async with aiohttp.ClientSession() as session:
            for url in blob_urls:
                async with session.get(url) as response:
                    compressed = await response.read()
                    serialized = zlib.decompress(compressed)
                    data = pickle.loads(serialized)
                    yield data
                    
                    # Immediate cleanup
                    del compressed, serialized, data
                    gc.collect()
```

### Progressive Response Pattern

```python
async def progressive_json_response(request, data_generator):
    """Send JSON response progressively to avoid memory buildup"""
    
    async def generate():
        # Send headers
        yield b'HTTP/1.1 200 OK\r\n'
        yield b'Content-Type: application/json\r\n'
        yield b'Transfer-Encoding: chunked\r\n'
        yield b'Cache-Control: no-cache\r\n'
        yield b'\r\n'
        
        # Start JSON
        yield b'{"status":"ok","data":['
        
        first = True
        count = 0
        
        async for item in data_generator:
            if not first:
                yield b','
            
            # Serialize item
            json_bytes = json.dumps(item).encode()
            
            # Send chunk size and data
            chunk_size = hex(len(json_bytes))[2:].encode()
            yield chunk_size + b'\r\n' + json_bytes + b'\r\n'
            
            first = False
            count += 1
            
            # Yield control periodically
            if count % 10 == 0:
                await asyncio.sleep(0)
        
        # End JSON
        end_json = b'],"count":' + str(count).encode() + b'}'
        yield hex(len(end_json))[2:].encode() + b'\r\n' + end_json + b'\r\n'
        
        # End chunked encoding
        yield b'0\r\n\r\n'
    
    return Response(generate(), streaming=True)
```

## 8. Monitoring & Alerting

### Vercel-Specific Monitoring

```python
class VercelMonitor:
    """Monitor memory usage in Vercel environment"""
    
    def __init__(self):
        self.metrics = []
        self.start_memory = self.get_memory_usage()
        
    def get_memory_usage(self):
        """Get current memory usage in MB"""
        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    
    def log_metric(self, operation: str, data: dict = None):
        """Log metric to Vercel logs (picked up by monitoring)"""
        memory_mb = self.get_memory_usage()
        metric = {
            'type': 'memory_metric',
            'operation': operation,
            'memory_mb': memory_mb,
            'memory_delta_mb': memory_mb - self.start_memory,
            'timestamp': datetime.utcnow().isoformat(),
            'data': data or {}
        }
        
        # Log in format Vercel can parse
        print(f"METRIC:{json.dumps(metric)}")
        
        # Check thresholds
        if memory_mb > 400:
            print(f"ALERT:HIGH_MEMORY:{operation}:{memory_mb}MB")
        
        self.metrics.append(metric)
    
    def get_report(self):
        """Generate memory usage report"""
        return {
            'peak_memory_mb': max(m['memory_mb'] for m in self.metrics),
            'operations': [
                {
                    'name': m['operation'],
                    'memory_mb': m['memory_mb'],
                    'delta_mb': m['memory_delta_mb']
                }
                for m in self.metrics
            ],
            'timeline': [
                {
                    'time': m['timestamp'],
                    'memory_mb': m['memory_mb']
                }
                for m in self.metrics
            ]
        }
```

### Vercel Analytics Integration

```javascript
// Custom analytics for memory tracking
import { Analytics } from '@vercel/analytics';

export function trackMemoryUsage(operation, memoryMB, metadata = {}) {
  // Send to Vercel Analytics
  Analytics.track('memory_usage', {
    operation,
    memory_mb: memoryMB,
    ...metadata
  });
  
  // Alert on high memory
  if (memoryMB > 400) {
    Analytics.track('memory_alert', {
      operation,
      memory_mb: memoryMB,
      severity: 'high'
    });
  }
}

// Function wrapper for automatic tracking
export function withMemoryTracking(fn, operationName) {
  return async (...args) => {
    const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    try {
      const result = await fn(...args);
      
      const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      trackMemoryUsage(operationName, endMemory, {
        delta_mb: endMemory - startMemory
      });
      
      return result;
    } catch (error) {
      // Track memory on error too
      const errorMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      trackMemoryUsage(`${operationName}_error`, errorMemory, {
        error: error.message
      });
      
      throw error;
    }
  };
}
```

## 9. Testing Strategy

### Vercel Environment Testing

```python
import pytest
from unittest.mock import patch

class TestVercelMemoryConstraints:
    """Test suite for Vercel memory constraints"""
    
    @pytest.fixture
    def memory_limited_environment(self):
        """Simulate Vercel's memory constraints"""
        with patch('resource.getrlimit') as mock_limit:
            # Simulate 512MB limit
            mock_limit.return_value = (512 * 1024 * 1024, 512 * 1024 * 1024)
            yield
    
    def test_cold_start_memory(self, memory_limited_environment):
        """Test memory usage during cold start"""
        monitor = VercelMonitor()
        
        # Import heavy libraries
        import pandas as pd
        import numpy as np
        
        monitor.log_metric('cold_start_complete')
        
        # Verify cold start memory is under limit
        assert monitor.get_memory_usage() < 100
    
    def test_large_dataset_processing(self, memory_limited_environment):
        """Test processing large dataset within memory limits"""
        processor = VercelOptimizedProcessor()
        
        # Test with 10 years of data for 20 tickers
        tickers = [f"TICK{i}" for i in range(20)]
        date_range = ('2014-01-01', '2024-01-01')
        
        # Process with memory monitoring
        with MemoryGuard(max_mb=350):
            result = processor.process_request(tickers, date_range)
        
        assert result is not None
    
    def test_memory_overflow_handling(self, memory_limited_environment):
        """Test graceful handling of memory overflow"""
        processor = VercelOptimizedProcessor()
        
        # Attempt to process excessive data
        tickers = [f"TICK{i}" for i in range(100)]
        date_range = ('2000-01-01', '2024-01-01')
        
        # Should automatically use blob storage
        result = processor.process_request(tickers, date_range)
        
        assert 'blob_urls' in result
        assert len(result['blob_urls']) > 0
```

### Load Testing for Vercel

```python
import asyncio
import aiohttp

async def vercel_load_test(base_url: str, concurrent_requests: int = 20):
    """Load test Vercel deployment"""
    
    async def make_request(session, request_id):
        """Make a single request"""
        params = {
            'tickers': 'AAPL,GOOGL,MSFT',
            'start_date': '2023-01-01',
            'end_date': '2024-01-01'
        }
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            async with session.get(f"{base_url}/api/data", params=params) as response:
                await response.json()
                
                end_time = asyncio.get_event_loop().time()
                
                return {
                    'request_id': request_id,
                    'status': response.status,
                    'duration': end_time - start_time,
                    'memory_mb': response.headers.get('X-Memory-Usage', 'unknown')
                }
        except Exception as e:
            return {
                'request_id': request_id,
                'error': str(e)
            }
    
    async with aiohttp.ClientSession() as session:
        # Run concurrent requests
        tasks = [
            make_request(session, i) 
            for i in range(concurrent_requests)
        ]
        
        results = await asyncio.gather(*tasks)
        
        # Analyze results
        successful = [r for r in results if 'status' in r and r['status'] == 200]
        failed = [r for r in results if 'error' in r or ('status' in r and r['status'] != 200)]
        
        print(f"Load Test Results:")
        print(f"  Successful: {len(successful)}/{concurrent_requests}")
        print(f"  Failed: {len(failed)}/{concurrent_requests}")
        print(f"  Avg Duration: {sum(r['duration'] for r in successful) / len(successful):.2f}s")
        
        if failed:
            print(f"  Failures: {failed}")
```

## 10. Cost Analysis

### Vercel Resource Usage

| Metric | Current | Optimized | Savings |
|--------|---------|-----------|---------|
| Avg Memory/Request | 450MB | 150MB | 67% |
| Function Duration | 5s | 2s | 60% |
| Monthly Requests | 100,000 | 100,000 | - |
| Edge Function % | 0% | 30% | - |
| Blob Storage GB | 0 | 50 | - |

### Cost Breakdown

**Current Monthly Costs:**
- Serverless Functions: $180 (high memory usage)
- Failed Requests: ~$20 (retries)
- Total: $200

**Optimized Monthly Costs:**
- Serverless Functions: $60 (reduced memory/duration)
- Edge Functions: $10
- Blob Storage: $5
- Total: $75 (62.5% reduction)

## Appendices

### A. Vercel Configuration

```json
{
  "functions": {
    "api/data/[endpoint].py": {
      "memory": 512,
      "maxDuration": 10
    },
    "api/edge/[endpoint].ts": {
      "runtime": "edge",
      "memory": 128
    }
  },
  "env": {
    "MEMORY_LIMIT_MB": "400",
    "USE_BLOB_THRESHOLD_MB": "50",
    "CHUNK_SIZE_ROWS": "1000",
    "ENABLE_MEMORY_MONITORING": "true"
  }
}
```

### B. Memory Optimization Checklist

- [ ] Profile cold start memory usage
- [ ] Implement dtype optimization
- [ ] Add chunking for large datasets  
- [ ] Integrate Vercel Blob for overflow
- [ ] Create Edge function router
- [ ] Implement streaming responses
- [ ] Add memory monitoring
- [ ] Set up alerting
- [ ] Load test with 20+ concurrent requests
- [ ] Document memory budgets

### C. References

- [Vercel Function Limits](https://vercel.com/docs/functions/serverless-functions/limits)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob)
- [Python Memory Management in Serverless](https://realpython.com/python-memory-management/)
- [Streaming Responses in Vercel](https://vercel.com/docs/functions/streaming)

### D. Monitoring Queries

```sql
-- High memory usage functions
SELECT 
  function_name,
  AVG(memory_mb) as avg_memory,
  MAX(memory_mb) as peak_memory,
  COUNT(*) as invocations
FROM function_metrics
WHERE timestamp > NOW() - INTERVAL '1 day'
GROUP BY function_name
HAVING MAX(memory_mb) > 350
ORDER BY peak_memory DESC;

-- Memory trend analysis
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(memory_mb) as avg_memory,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY memory_mb) as p95_memory
FROM function_metrics
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```