# Expert Review: Streaming Response Implementation

## Executive Summary

The PRD presents a well-thought-out approach to implementing streaming responses for the ETF Research Platform. However, there are several architectural decisions that need refinement, particularly around the choice of streaming protocol, frontend state management, and error recovery mechanisms. This review provides detailed recommendations to optimize the implementation for production-grade performance and reliability.

## 1. Streaming Protocols: JSONL vs SSE vs WebSockets

### Current PRD Recommendation: JSONL
The PRD primarily suggests JSON Lines (JSONL) format, which is a reasonable choice but not optimal for all use cases.

### Expert Recommendation: Hybrid Approach with SSE as Primary

**Why Server-Sent Events (SSE) Should Be Primary:**
```typescript
// SSE provides better browser support and automatic reconnection
const eventSource = new EventSource('/data/stream', {
  withCredentials: true
});

eventSource.addEventListener('progress', (e) => {
  const progress = JSON.parse(e.data);
  updateProgressUI(progress);
});

eventSource.addEventListener('data', (e) => {
  const dataChunk = JSON.parse(e.data);
  processDataIncremental(dataChunk);
});

eventSource.addEventListener('error', (e) => {
  if (eventSource.readyState === EventSource.CLOSED) {
    // Connection closed, attempt reconnect
    reconnectWithBackoff();
  }
});
```

**Advantages of SSE:**
- Built-in reconnection mechanism
- Better browser support than WebSockets
- Works through proxies and firewalls
- Simpler server implementation
- Native event types for different message categories

**When to Use Each Protocol:**
1. **SSE**: Default for progress updates and moderate data volumes
2. **WebSockets**: Real-time bidirectional communication (future features)
3. **JSONL over Fetch**: Large file downloads, binary data transfers
4. **MessagePack**: Only for extreme performance requirements

### Recommended Implementation:

```python
# FastAPI SSE endpoint
@app.get("/data/stream/sse")
async def stream_sse(
    tickers: List[str] = Query(...),
    start_date: str = Query(...),
    end_date: str = Query(None)
):
    async def event_generator():
        try:
            async for event in generate_ticker_data_stream(tickers, start_date, end_date):
                # Format as SSE
                if event["type"] == "progress":
                    yield f"event: progress\ndata: {json.dumps(event)}\n\n"
                elif event["type"] == "data":
                    yield f"event: data\ndata: {json.dumps(event)}\n\n"
                elif event["type"] == "error":
                    yield f"event: error\ndata: {json.dumps(event)}\n\n"
                
                # Send heartbeat every 30 seconds to keep connection alive
                if time.time() % 30 == 0:
                    yield f"event: heartbeat\ndata: {json.dumps({'timestamp': time.time()})}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e), 'fatal': True})}\n\n"
        finally:
            yield f"event: complete\ndata: {json.dumps({'timestamp': time.time()})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable Nginx buffering
        }
    )
```

## 2. Frontend Architecture: Optimal Approach

### Current Limitation: Fetch API
The PRD's fetch-based approach has limitations for production use.

### Recommended: EventSource with Fallback Strategy

```typescript
// Advanced streaming client with automatic protocol selection
class AdaptiveStreamingClient {
  private strategy: StreamingStrategy;
  private fallbackChain = ['sse', 'fetch-stream', 'polling'];
  
  constructor(private endpoint: string) {
    this.selectOptimalStrategy();
  }
  
  private selectOptimalStrategy(): void {
    if (typeof EventSource !== 'undefined' && !this.isCrossOrigin()) {
      this.strategy = new SSEStrategy();
    } else if (this.supportsStreamingFetch()) {
      this.strategy = new FetchStreamStrategy();
    } else {
      this.strategy = new PollingStrategy();
    }
  }
  
  async *stream(request: StreamRequest): AsyncGenerator<StreamEvent> {
    try {
      yield* this.strategy.stream(this.endpoint, request);
    } catch (error) {
      // Fallback to next strategy
      console.warn(`Strategy ${this.strategy.name} failed, trying fallback`);
      yield* this.fallback(request);
    }
  }
  
  private supportsStreamingFetch(): boolean {
    return 'ReadableStream' in window && 
           'TextDecoderStream' in window;
  }
}

// SSE Strategy Implementation
class SSEStrategy implements StreamingStrategy {
  name = 'sse';
  
  async *stream(endpoint: string, request: StreamRequest): AsyncGenerator<StreamEvent> {
    const params = new URLSearchParams({
      tickers: request.tickers.join(','),
      start_date: request.startDate,
      end_date: request.endDate || ''
    });
    
    const eventSource = new EventSource(`${endpoint}/sse?${params}`);
    const eventQueue = new AsyncQueue<StreamEvent>();
    
    // Set up event listeners
    const handlers = {
      progress: (e: MessageEvent) => {
        eventQueue.push(JSON.parse(e.data));
      },
      data: (e: MessageEvent) => {
        eventQueue.push(JSON.parse(e.data));
      },
      error: (e: MessageEvent) => {
        eventQueue.push(JSON.parse(e.data));
      },
      complete: (e: MessageEvent) => {
        eventQueue.push(JSON.parse(e.data));
        eventQueue.complete();
      }
    };
    
    Object.entries(handlers).forEach(([event, handler]) => {
      eventSource.addEventListener(event, handler);
    });
    
    eventSource.onerror = (error) => {
      eventQueue.error(new Error('SSE connection failed'));
      eventSource.close();
    };
    
    try {
      for await (const event of eventQueue) {
        yield event;
      }
    } finally {
      eventSource.close();
    }
  }
}
```

## 3. Progress Indication: Best UX Patterns

### Enhanced Progress Component with Semantic Updates

```typescript
interface EnhancedProgress {
  // Quantitative metrics
  percentage: number;
  tickersCompleted: number;
  totalTickers: number;
  recordsProcessed: number;
  bytesTransferred: number;
  
  // Qualitative indicators
  currentPhase: 'connecting' | 'fetching' | 'processing' | 'finalizing';
  currentTicker: string;
  currentSource: 'cache' | 'database' | 'external-api';
  
  // Performance metrics
  throughput: number; // records/second
  estimatedTimeRemaining: number;
  connectionQuality: 'excellent' | 'good' | 'poor';
  
  // Detailed breakdown
  phaseProgress: {
    [ticker: string]: {
      status: 'pending' | 'processing' | 'complete' | 'error';
      recordCount: number;
      errorCount: number;
      retryCount: number;
    };
  };
}

// Advanced Progress Display Component
const StreamingProgressDisplay: React.FC = () => {
  const [progress, setProgress] = useState<EnhancedProgress>(initialProgress);
  const [isPaused, setIsPaused] = useState(false);
  
  return (
    <div className="streaming-progress-advanced">
      {/* Primary Progress Indicator */}
      <div className="primary-progress">
        <h3>{getPhaseMessage(progress.currentPhase)}</h3>
        <ProgressBar 
          value={progress.percentage} 
          animated={!isPaused}
          variant={getProgressVariant(progress.connectionQuality)}
        />
        <div className="progress-stats">
          <span>{progress.tickersCompleted} of {progress.totalTickers} tickers</span>
          <span>{formatBytes(progress.bytesTransferred)}</span>
          <span>{formatDuration(progress.estimatedTimeRemaining)} remaining</span>
        </div>
      </div>
      
      {/* Performance Metrics */}
      <div className="performance-metrics">
        <MetricCard
          icon="📊"
          label="Throughput"
          value={`${progress.throughput.toFixed(0)} rec/s`}
          trend={calculateThroughputTrend(progress.throughput)}
        />
        <MetricCard
          icon="🔗"
          label="Connection"
          value={progress.connectionQuality}
          variant={progress.connectionQuality}
        />
        <MetricCard
          icon="💾"
          label="Source"
          value={progress.currentSource}
          hint={getSourceHint(progress.currentSource)}
        />
      </div>
      
      {/* Ticker Grid with Visual Status */}
      <TickerProgressGrid 
        tickers={progress.phaseProgress}
        onTickerClick={(ticker) => showTickerDetails(ticker)}
      />
      
      {/* User Controls */}
      <div className="stream-controls">
        <Button
          variant="secondary"
          onClick={() => setIsPaused(!isPaused)}
          icon={isPaused ? '▶️' : '⏸️'}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </Button>
        <Button
          variant="danger"
          onClick={cancelStream}
          icon="🛑"
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          onClick={downloadPartialResults}
          disabled={progress.recordsProcessed === 0}
          icon="💾"
        >
          Save Progress
        </Button>
      </div>
    </div>
  );
};
```

## 4. Error Recovery: Production-Grade Patterns

### Intelligent Error Recovery System

```typescript
class SmartErrorRecovery {
  private errorPatterns = new Map<string, ErrorRecoveryStrategy>();
  private circuitBreaker = new CircuitBreaker({
    threshold: 5,
    timeout: 30000,
    resetTimeout: 60000
  });
  
  constructor() {
    this.registerErrorPatterns();
  }
  
  private registerErrorPatterns() {
    // Network errors - immediate retry with backoff
    this.errorPatterns.set('NETWORK_ERROR', {
      shouldRetry: true,
      maxRetries: 3,
      backoffStrategy: 'exponential',
      fallbackAction: 'use-cached-data'
    });
    
    // Rate limiting - pause and resume
    this.errorPatterns.set('RATE_LIMIT', {
      shouldRetry: true,
      maxRetries: 1,
      waitTime: (error) => error.retryAfter * 1000,
      fallbackAction: 'reduce-batch-size'
    });
    
    // Invalid ticker - skip and continue
    this.errorPatterns.set('INVALID_TICKER', {
      shouldRetry: false,
      skipItem: true,
      notifyUser: true
    });
    
    // Server overload - circuit breaker pattern
    this.errorPatterns.set('SERVER_OVERLOAD', {
      shouldRetry: true,
      useCircuitBreaker: true,
      fallbackAction: 'queue-for-later'
    });
  }
  
  async handleStreamError(
    error: StreamError,
    context: StreamContext
  ): Promise<RecoveryAction> {
    const strategy = this.errorPatterns.get(error.code) || this.defaultStrategy;
    
    if (strategy.useCircuitBreaker) {
      return this.circuitBreaker.execute(async () => {
        return this.applyStrategy(strategy, error, context);
      });
    }
    
    return this.applyStrategy(strategy, error, context);
  }
  
  private async applyStrategy(
    strategy: ErrorRecoveryStrategy,
    error: StreamError,
    context: StreamContext
  ): Promise<RecoveryAction> {
    if (!strategy.shouldRetry) {
      return {
        action: 'skip',
        skipItem: error.ticker,
        notify: strategy.notifyUser
      };
    }
    
    const retryCount = context.retryCount.get(error.ticker || 'global') || 0;
    
    if (retryCount >= strategy.maxRetries) {
      return this.executeFallback(strategy.fallbackAction, context);
    }
    
    const waitTime = this.calculateWaitTime(strategy, error, retryCount);
    
    return {
      action: 'retry',
      waitTime,
      modifyRequest: (request) => {
        if (strategy.fallbackAction === 'reduce-batch-size') {
          request.chunk_size = Math.max(10, request.chunk_size / 2);
        }
        return request;
      }
    };
  }
}

// Integration with streaming client
class ResilientStreamingClient {
  private errorRecovery = new SmartErrorRecovery();
  private healthMonitor = new StreamHealthMonitor();
  
  async *streamWithRecovery(
    request: StreamRequest
  ): AsyncGenerator<StreamEvent> {
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 10;
    
    while (true) {
      try {
        const streamHealth = this.healthMonitor.startMonitoring();
        
        for await (const event of this.streamData(request)) {
          consecutiveErrors = 0; // Reset on success
          
          // Monitor stream health
          streamHealth.recordEvent(event);
          
          if (event.type === 'error') {
            const recovery = await this.errorRecovery.handleStreamError(
              event as StreamError,
              { request, retryCount: new Map() }
            );
            
            if (recovery.action === 'retry') {
              await sleep(recovery.waitTime);
              request = recovery.modifyRequest(request);
              continue; // Restart stream
            } else if (recovery.action === 'skip') {
              yield { type: 'warning', message: `Skipped ${recovery.skipItem}` };
              continue;
            }
          }
          
          yield event;
          
          if (event.type === 'complete') {
            return; // Successfully completed
          }
        }
      } catch (error) {
        consecutiveErrors++;
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error('Maximum consecutive errors reached');
        }
        
        // Apply recovery strategy
        const recovery = await this.errorRecovery.handleStreamError(
          { code: 'STREAM_FAILURE', message: error.message },
          { request, retryCount: new Map() }
        );
        
        if (recovery.action === 'retry') {
          await sleep(recovery.waitTime);
          continue;
        }
        
        throw error;
      }
    }
  }
}
```

## 5. Browser Compatibility Considerations

### Progressive Enhancement Strategy

```typescript
class BrowserCompatibilityLayer {
  private capabilities: BrowserCapabilities;
  
  constructor() {
    this.capabilities = this.detectCapabilities();
  }
  
  private detectCapabilities(): BrowserCapabilities {
    return {
      supportsEventSource: typeof EventSource !== 'undefined',
      supportsReadableStream: 'ReadableStream' in window,
      supportsTextDecoderStream: 'TextDecoderStream' in window,
      supportsAbortController: typeof AbortController !== 'undefined',
      supportsRequestStreams: this.checkRequestStreams(),
      supportsBrotliDecompression: this.checkBrotliSupport()
    };
  }
  
  getStreamingStrategy(): StreamingStrategy {
    // Modern browsers with full support
    if (this.capabilities.supportsEventSource && 
        this.capabilities.supportsAbortController) {
      return new ModernStreamingStrategy();
    }
    
    // Safari and older Chrome
    if (this.capabilities.supportsReadableStream) {
      return new ReadableStreamStrategy();
    }
    
    // IE11 and very old browsers
    return new PollingFallbackStrategy();
  }
  
  // Polyfill for older browsers
  async loadPolyfills(): Promise<void> {
    const polyfills = [];
    
    if (!this.capabilities.supportsEventSource) {
      polyfills.push(import('event-source-polyfill'));
    }
    
    if (!this.capabilities.supportsAbortController) {
      polyfills.push(import('abortcontroller-polyfill'));
    }
    
    if (!window.TextDecoder) {
      polyfills.push(import('text-encoding'));
    }
    
    await Promise.all(polyfills);
  }
}

// Usage in main app
const compatLayer = new BrowserCompatibilityLayer();
await compatLayer.loadPolyfills();
const streamingClient = new StreamingClient(compatLayer.getStreamingStrategy());
```

## 6. Chart Rendering: Optimal Incremental Updates

### High-Performance Chart Updates

```typescript
class OptimizedChartRenderer {
  private charts = new Map<string, ChartInstance>();
  private updateQueue = new PriorityQueue<ChartUpdate>();
  private rafId: number | null = null;
  private worker: Worker;
  
  constructor() {
    // Offload data processing to Web Worker
    this.worker = new Worker('/workers/chart-processor.js');
    this.worker.onmessage = this.handleProcessedData.bind(this);
  }
  
  addData(ticker: string, dataPoints: DataPoint[]) {
    // Send to worker for processing
    this.worker.postMessage({
      type: 'process',
      ticker,
      dataPoints
    });
  }
  
  private handleProcessedData(event: MessageEvent) {
    const { ticker, processedData, statistics } = event.data;
    
    // Queue update with priority based on visibility
    const priority = this.calculatePriority(ticker);
    this.updateQueue.enqueue({
      ticker,
      data: processedData,
      statistics,
      priority
    });
    
    this.scheduleUpdate();
  }
  
  private scheduleUpdate() {
    if (this.rafId) return;
    
    this.rafId = requestAnimationFrame(() => {
      this.performBatchUpdate();
      this.rafId = null;
    });
  }
  
  private performBatchUpdate() {
    const startTime = performance.now();
    const maxUpdateTime = 16; // Target 60fps
    
    while (!this.updateQueue.isEmpty() && 
           performance.now() - startTime < maxUpdateTime) {
      const update = this.updateQueue.dequeue();
      this.updateChart(update);
    }
    
    // Schedule next batch if queue not empty
    if (!this.updateQueue.isEmpty()) {
      this.scheduleUpdate();
    }
  }
  
  private updateChart(update: ChartUpdate) {
    let chart = this.charts.get(update.ticker);
    
    if (!chart) {
      chart = this.createChart(update.ticker);
    }
    
    // Use chart.js update API efficiently
    const dataset = chart.data.datasets[0];
    
    // Append new data points
    dataset.data.push(...update.data);
    
    // Implement sliding window for performance
    const maxPoints = 1000;
    if (dataset.data.length > maxPoints) {
      dataset.data = dataset.data.slice(-maxPoints);
    }
    
    // Update chart with minimal reflow
    chart.update('none'); // No animation
    
    // Update statistics overlay
    this.updateStatistics(update.ticker, update.statistics);
  }
  
  private createChart(ticker: string): ChartInstance {
    const container = document.getElementById(`chart-${ticker}`);
    if (!container) {
      throw new Error(`Chart container not found for ${ticker}`);
    }
    
    const chart = new Chart(container, {
      type: 'line',
      data: {
        datasets: [{
          label: ticker,
          data: [],
          parsing: false, // Pre-parsed data
          normalized: true, // Pre-normalized
          borderWidth: 1,
          pointRadius: 0, // Better performance
          tension: 0.1
        }]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          decimation: {
            enabled: true,
            algorithm: 'lttb', // Largest Triangle Three Buckets
            samples: 500
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              minUnit: 'day'
            }
          },
          y: {
            type: 'linear'
          }
        }
      }
    });
    
    this.charts.set(ticker, chart);
    return chart;
  }
}

// Web Worker for data processing
// chart-processor.js
self.addEventListener('message', (event) => {
  const { type, ticker, dataPoints } = event.data;
  
  if (type === 'process') {
    const processed = dataPoints.map(point => ({
      x: new Date(point.date).getTime(),
      y: point.close
    }));
    
    // Calculate statistics
    const statistics = {
      min: Math.min(...processed.map(p => p.y)),
      max: Math.max(...processed.map(p => p.y)),
      avg: processed.reduce((a, p) => a + p.y, 0) / processed.length,
      volatility: calculateVolatility(processed)
    };
    
    self.postMessage({
      ticker,
      processedData: processed,
      statistics
    });
  }
});
```

## 7. Backpressure Handling

### Adaptive Backpressure Management

```typescript
class BackpressureManager {
  private bufferHighWaterMark = 1000;
  private bufferLowWaterMark = 100;
  private isPaused = false;
  private metrics = {
    bufferSize: 0,
    processingRate: 0,
    incomingRate: 0
  };
  
  constructor(
    private source: ReadableStream,
    private processor: DataProcessor
  ) {
    this.startMonitoring();
  }
  
  async process() {
    const reader = this.source.getReader();
    const buffer: StreamEvent[] = [];
    
    try {
      while (true) {
        // Check buffer size and pause if needed
        if (buffer.length > this.bufferHighWaterMark && !this.isPaused) {
          this.pauseSource();
        } else if (buffer.length < this.bufferLowWaterMark && this.isPaused) {
          this.resumeSource();
        }
        
        // Read with backpressure awareness
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer.push(value);
        this.metrics.bufferSize = buffer.length;
        
        // Process in batches for efficiency
        if (buffer.length >= 100 || done) {
          const batch = buffer.splice(0, 100);
          await this.processBatch(batch);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  private async processBatch(batch: StreamEvent[]) {
    const startTime = performance.now();
    
    // Adaptive processing based on system load
    const processingDelay = this.calculateProcessingDelay();
    if (processingDelay > 0) {
      await sleep(processingDelay);
    }
    
    await this.processor.processBatch(batch);
    
    const processingTime = performance.now() - startTime;
    this.updateMetrics(batch.length, processingTime);
  }
  
  private calculateProcessingDelay(): number {
    const cpuUsage = this.estimateCPUUsage();
    const memoryPressure = this.checkMemoryPressure();
    
    if (cpuUsage > 0.8 || memoryPressure > 0.8) {
      return 50; // Add delay to reduce load
    }
    
    return 0;
  }
  
  private pauseSource() {
    this.isPaused = true;
    // Send backpressure signal to server
    this.sendBackpressureSignal('pause');
  }
  
  private resumeSource() {
    this.isPaused = false;
    this.sendBackpressureSignal('resume');
  }
  
  private sendBackpressureSignal(action: 'pause' | 'resume') {
    // WebSocket or HTTP/2 push to notify server
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'backpressure',
        action,
        metrics: this.metrics
      }));
    }
  }
}
```

## 8. Format Flexibility: When MessagePack Makes Sense

### Adaptive Format Selection

```typescript
class AdaptiveFormatSelector {
  private formatBenchmarks = new Map<string, FormatPerformance>();
  
  async selectOptimalFormat(
    dataSize: number,
    complexity: 'simple' | 'complex',
    networkSpeed: number
  ): Promise<StreamFormat> {
    // For small, simple data - use JSON
    if (dataSize < 1_000_000 && complexity === 'simple') {
      return 'json';
    }
    
    // For progress updates - use SSE
    if (dataSize < 10_000) {
      return 'sse';
    }
    
    // For large, complex data on fast networks - use MessagePack
    if (dataSize > 10_000_000 && networkSpeed > 50_000_000) {
      return 'msgpack';
    }
    
    // For CSV-like data - use CSV streaming
    if (complexity === 'simple' && dataSize > 1_000_000) {
      return 'csv';
    }
    
    // Default to JSONL for good balance
    return 'jsonl';
  }
  
  // Benchmark format performance
  async benchmarkFormat(format: StreamFormat, testData: any[]): Promise<void> {
    const encoder = this.getEncoder(format);
    const decoder = this.getDecoder(format);
    
    const startEncode = performance.now();
    const encoded = encoder.encode(testData);
    const encodeTime = performance.now() - startEncode;
    
    const startDecode = performance.now();
    const decoded = decoder.decode(encoded);
    const decodeTime = performance.now() - startDecode;
    
    this.formatBenchmarks.set(format, {
      encodeTime,
      decodeTime,
      encodedSize: encoded.byteLength,
      compressionRatio: encoded.byteLength / JSON.stringify(testData).length
    });
  }
}

// MessagePack streaming implementation
class MessagePackStreamer {
  private encoder = new MessagePackEncoder();
  
  async *streamData(data: AsyncIterable<any>): AsyncGenerator<Uint8Array> {
    for await (const chunk of data) {
      yield this.encoder.encode(chunk);
    }
  }
  
  async *decodeStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<any> {
    const reader = stream.getReader();
    const decoder = new MessagePackDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // MessagePack can have multiple messages in one chunk
        const messages = decoder.decodeMultiple(value);
        for (const message of messages) {
          yield message;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

## 9. Testing Strategy Enhancements

### Comprehensive Streaming Test Suite

```typescript
describe('Streaming Performance Under Load', () => {
  let mockServer: MockStreamingServer;
  let client: ResilientStreamingClient;
  let performanceMonitor: PerformanceMonitor;
  
  beforeEach(() => {
    mockServer = new MockStreamingServer();
    client = new ResilientStreamingClient();
    performanceMonitor = new PerformanceMonitor();
  });
  
  describe('Backpressure Handling', () => {
    it('should adapt to slow consumers', async () => {
      const slowProcessor = new SlowDataProcessor(100); // 100ms per record
      const stream = client.stream(['AAPL'], '2020-01-01', '2024-01-01');
      
      const metrics = await performanceMonitor.measure(async () => {
        for await (const event of stream) {
          await slowProcessor.process(event);
        }
      });
      
      expect(metrics.memoryPeakMB).toBeLessThan(100);
      expect(metrics.backpressureEvents).toBeGreaterThan(0);
      expect(metrics.droppedEvents).toBe(0);
    });
  });
  
  describe('Network Resilience', () => {
    it('should handle intermittent network failures', async () => {
      const flakyNetwork = new FlakyNetworkSimulator({
        failureRate: 0.1,
        failureDuration: 1000
      });
      
      mockServer.use(flakyNetwork.middleware);
      
      const results = [];
      const errors = [];
      
      const stream = client.streamWithRecovery(['AAPL'], '2020-01-01', '2021-01-01');
      
      for await (const event of stream) {
        if (event.type === 'data') results.push(event);
        if (event.type === 'error') errors.push(event);
      }
      
      expect(results.length).toBeGreaterThan(200); // Should recover and get data
      expect(errors.length).toBeLessThan(10); // Some errors expected
    });
  });
  
  describe('Memory Efficiency', () => {
    it('should maintain constant memory with infinite stream', async () => {
      const infiniteStream = mockServer.createInfiniteStream();
      const memorySnapshots: number[] = [];
      
      let recordCount = 0;
      const maxRecords = 1_000_000;
      
      for await (const event of infiniteStream) {
        recordCount++;
        
        if (recordCount % 10_000 === 0) {
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
        
        if (recordCount >= maxRecords) break;
      }
      
      // Memory should stabilize after initial allocation
      const lastHalf = memorySnapshots.slice(memorySnapshots.length / 2);
      const variance = calculateVariance(lastHalf);
      const coefficientOfVariation = Math.sqrt(variance) / mean(lastHalf);
      
      expect(coefficientOfVariation).toBeLessThan(0.1); // Less than 10% variation
    });
  });
});
```

## 10. Production Deployment Recommendations

### Infrastructure Considerations

```yaml
# Kubernetes deployment with streaming optimization
apiVersion: apps/v1
kind: Deployment
metadata:
  name: etf-api-streaming
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: etf-api:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: STREAMING_BUFFER_SIZE
          value: "1048576" # 1MB
        - name: STREAMING_TIMEOUT
          value: "300000" # 5 minutes
        - name: MAX_CONCURRENT_STREAMS
          value: "100"
        readinessProbe:
          httpGet:
            path: /health/streaming
            port: 8000
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          periodSeconds: 30
```

### Nginx Configuration for SSE

```nginx
location /data/stream/sse {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Cache-Control "no-cache";
    
    # SSE specific settings
    proxy_set_header X-Accel-Buffering "no";
    proxy_buffering off;
    proxy_cache off;
    
    # Timeouts for long-running streams
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    proxy_send_timeout 300s;
    
    # Enable keepalive
    proxy_set_header Connection "keep-alive";
    proxy_set_header Keep-Alive "timeout=300";
}
```

### Monitoring and Alerting

```typescript
class StreamingMetricsCollector {
  private metrics = {
    activeStreams: new Gauge('active_streams', 'Number of active streams'),
    streamDuration: new Histogram('stream_duration_seconds', 'Stream duration'),
    streamErrors: new Counter('stream_errors_total', 'Total stream errors'),
    bytesTransferred: new Counter('stream_bytes_total', 'Total bytes streamed'),
    backpressureEvents: new Counter('backpressure_events_total', 'Backpressure events')
  };
  
  recordStreamStart(streamId: string, metadata: StreamMetadata) {
    this.metrics.activeStreams.inc();
    this.activeStreams.set(streamId, {
      startTime: Date.now(),
      metadata
    });
  }
  
  recordStreamEnd(streamId: string, status: 'complete' | 'error') {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;
    
    const duration = (Date.now() - stream.startTime) / 1000;
    this.metrics.streamDuration.observe(duration);
    this.metrics.activeStreams.dec();
    
    if (status === 'error') {
      this.metrics.streamErrors.inc();
    }
    
    this.activeStreams.delete(streamId);
  }
}
```

## Summary of Key Recommendations

1. **Use SSE as Primary Protocol**: Better browser support, automatic reconnection, simpler implementation
2. **Implement Progressive Enhancement**: Detect browser capabilities and fall back gracefully
3. **Advanced Progress UI**: Show meaningful metrics beyond simple percentage
4. **Smart Error Recovery**: Pattern-based recovery with circuit breakers
5. **Optimize Chart Rendering**: Use Web Workers and efficient update strategies
6. **Handle Backpressure**: Implement adaptive flow control
7. **Choose Formats Wisely**: JSON for small data, MessagePack only for large binary data
8. **Comprehensive Testing**: Test under realistic conditions including network failures
9. **Production-Ready Infrastructure**: Configure proxies and monitoring properly
10. **Monitor Everything**: Track stream health and performance metrics

This approach will deliver a robust, scalable streaming solution that provides excellent user experience while maintaining system stability under load.