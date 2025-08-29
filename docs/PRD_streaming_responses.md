# PRD: Streaming Response Implementation

## 1. Executive Summary

This document outlines the implementation of streaming responses for the ETF Research Platform to handle large datasets efficiently and provide real-time progress feedback to users.

### Streaming Response Objectives
- Eliminate timeout errors for large multi-ticker or extended date range requests
- Provide immediate visual feedback during data processing
- Enable progressive data rendering in the UI
- Reduce memory footprint by processing data incrementally
- Support graceful error recovery during stream processing

### User Experience Improvements
- First byte response in under 500ms (vs current 10-30 second wait times)
- Real-time progress indicators showing processing status
- Partial data visualization while fetching continues
- Smoother interaction with no UI freezing
- Clear error messaging for partial failures

### Technical Benefits
- Reduced server memory usage through incremental processing
- Better resource utilization with streaming generators
- Improved scalability for handling concurrent large requests
- Enhanced monitoring capabilities with progress events
- More resilient error handling with partial recovery

## 2. Problem Statement

The current implementation faces several critical issues when handling large data requests:

### Large Responses Causing Timeouts
- Requests for 50+ tickers or 5+ years of data frequently timeout
- Current 10-second timeout in `useStockData.ts` is insufficient for large requests
- Users receive generic timeout errors with no partial data
- No visibility into processing progress

### Poor User Experience with Long Waits
- UI freezes during large data fetches
- No feedback on processing status
- Users often re-submit requests thinking the system is unresponsive
- Cannot interact with partial results while fetch continues

### Memory Inefficiency with Full Buffering
- Server buffers entire response in memory before sending
- Large responses (100MB+) can cause memory spikes
- Multiple concurrent large requests can exhaust server resources
- Client attempts to parse massive JSON payloads at once

### No Progress Indication
- Users have no visibility into:
  - How many tickers have been processed
  - Estimated time remaining
  - Which data sources are being queried
  - Current processing stage

## 3. Goals & Success Metrics

### Primary Goals
- **Eliminate timeout errors** for requests up to 500 tickers
- **First byte response** under 500ms for all requests
- **Support unlimited dataset sizes** without memory constraints
- **Real-time progress updates** every 100ms during processing

### Success Metrics
- **Response Time**: First byte < 500ms (currently 5-30 seconds)
- **Timeout Rate**: < 0.1% of requests (currently ~15% for large requests)
- **Memory Usage**: Peak memory < 512MB per request (currently unbounded)
- **User Engagement**: 80% reduction in duplicate request submissions
- **Progress Accuracy**: Progress estimates within 10% of actual time
- **Stream Reliability**: 99.9% successful stream completion rate

### Performance Targets
- Stream 1,000 ticker-days per second
- Handle 100 concurrent streaming requests
- Process 10 years of data for 100 tickers without timeout
- Recover from 95% of transient errors mid-stream

## 4. Technical Requirements

### FastAPI StreamingResponse Implementation
- Generator-based response streaming using `StreamingResponse`
- Chunked transfer encoding for HTTP/1.1 compatibility
- Server-Sent Events (SSE) for progress updates
- Backpressure handling to prevent overwhelming slow clients
- Memory-efficient iterators for database queries

### Frontend Streaming Consumption
- Fetch API with streaming support (`response.body.getReader()`)
- Progressive JSON parsing with streaming libraries
- WebWorker-based processing to prevent UI blocking
- Automatic reconnection for interrupted streams
- Buffer management to handle variable chunk sizes

### Progress Indication UI
- Real-time progress bar with percentage complete
- Current ticker being processed
- Data points processed counter
- Estimated time remaining
- Data source status indicators

### Error Handling Mid-Stream
- Graceful degradation for partial failures
- Error event streaming alongside data
- Automatic retry for transient failures
- Clear indication of skipped tickers
- Summary of errors at stream completion

### Format Flexibility
- Support for multiple streaming formats:
  - JSON Lines (JSONL) for easy parsing
  - CSV streaming for large exports
  - Binary formats (MessagePack) for efficiency
  - Server-Sent Events for progress
- Content negotiation via Accept headers

## 5. Implementation Plan

### Phase 1: Backend Streaming Infrastructure (Week 1-2)
1. **Create streaming data generators**
   - Implement async generators for ticker data fetching
   - Add chunking logic for large result sets
   - Create streaming JSON/CSV serializers
   
2. **Add streaming endpoints**
   - `/data/stream` endpoint with StreamingResponse
   - Progress event emission via SSE
   - Chunked transfer encoding setup
   
3. **Database query optimization**
   - Cursor-based pagination for large queries
   - Streaming result sets from database
   - Connection pooling for concurrent streams

### Phase 2: Frontend Streaming Client (Week 3-4)
1. **Implement streaming fetch utilities**
   - ReadableStream consumer
   - Progressive JSON parser
   - Error boundary for stream failures
   
2. **Create progress state management**
   - Redux/Zustand store for progress state
   - Progress event parser
   - UI update throttling
   
3. **Build streaming data processor**
   - WebWorker for off-thread processing
   - Incremental chart data updates
   - Memory-efficient data structures

### Phase 3: Progress UI Components (Week 5)
1. **Design progress indicators**
   - Progress bar component
   - Status message display
   - Ticker processing list
   
2. **Implement real-time updates**
   - Smooth progress animations
   - ETA calculation
   - Error indicator badges
   
3. **Add user controls**
   - Pause/resume streaming
   - Cancel with partial results
   - Priority reordering

### Phase 4: Error Recovery Mechanisms (Week 6)
1. **Implement retry logic**
   - Exponential backoff for failures
   - Partial result preservation
   - Smart reconnection
   
2. **Add error reporting**
   - Detailed error events
   - Failed ticker tracking
   - Recovery suggestions
   
3. **Create fallback mechanisms**
   - Graceful degradation to batch mode
   - Offline data caching
   - Alternative data source switching

## 6. API Design

### Streaming Endpoint Specifications

#### POST /data/stream
```python
class StreamingDataRequest(BaseModel):
    tickers: List[str]
    start_date: str
    end_date: Optional[str] = None
    format: Literal["jsonl", "csv", "sse", "msgpack"] = "jsonl"
    chunk_size: int = 100  # Records per chunk
    include_progress: bool = True
    include_dividends: bool = False
```

#### Response Headers
```
Content-Type: application/x-ndjson  # or text/event-stream for SSE
Transfer-Encoding: chunked
Cache-Control: no-cache
X-Stream-Format: jsonl
X-Total-Tickers: 150
X-Estimated-Duration: 45
```

### Response Format Options

#### JSON Lines (JSONL)
```json
{"type": "progress", "ticker": "AAPL", "percentage": 5, "message": "Processing AAPL"}
{"type": "data", "ticker": "AAPL", "date": "2024-01-01", "open": 150.0, "close": 152.0}
{"type": "data", "ticker": "AAPL", "date": "2024-01-02", "open": 152.0, "close": 153.0}
{"type": "error", "ticker": "INVALID", "error": "Ticker not found", "code": "NOT_FOUND"}
{"type": "complete", "total_records": 5000, "errors": 2, "duration": 45.2}
```

#### Server-Sent Events (SSE)
```
event: progress
data: {"ticker": "AAPL", "percentage": 5, "estimated_remaining": 42}

event: data
data: {"ticker": "AAPL", "records": [{"date": "2024-01-01", "close": 152.0}]}

event: error
data: {"ticker": "INVALID", "error": "Ticker not found"}

event: complete
data: {"summary": {"total": 5000, "success": 4998, "failed": 2}}
```

### Progress Event Structure
```typescript
interface ProgressEvent {
  type: 'progress'
  timestamp: number
  current_ticker: string
  tickers_completed: number
  total_tickers: number
  records_processed: number
  estimated_total_records: number
  percentage: number
  rate: number  // records per second
  estimated_remaining_seconds: number
  current_source: string
  memory_usage_mb: number
}
```

### Error Handling Protocol
```typescript
interface StreamError {
  type: 'error'
  timestamp: number
  ticker?: string
  error_code: string
  message: string
  recoverable: boolean
  retry_after?: number
  partial_data?: any
}
```

## 7. Frontend Integration

### Streaming API Client
```typescript
class StreamingDataClient {
  async *fetchStream(request: StreamingDataRequest): AsyncGenerator<StreamEvent> {
    const response = await fetch('/data/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.trim()) {
          yield JSON.parse(line)
        }
      }
    }
  }
}
```

### Progress State Management
```typescript
interface StreamingState {
  status: 'idle' | 'streaming' | 'paused' | 'complete' | 'error'
  progress: {
    percentage: number
    currentTicker: string
    tickersCompleted: number
    totalTickers: number
    recordsProcessed: number
    estimatedRemaining: number
    rate: number
  }
  data: Map<string, TickerData>
  errors: StreamError[]
  startTime: number
  endTime?: number
}

const useStreamingData = () => {
  const [state, dispatch] = useReducer(streamingReducer, initialState)
  
  const startStream = async (request: StreamingDataRequest) => {
    dispatch({ type: 'START_STREAM' })
    
    try {
      const client = new StreamingDataClient()
      for await (const event of client.fetchStream(request)) {
        dispatch({ type: 'STREAM_EVENT', payload: event })
      }
      dispatch({ type: 'COMPLETE_STREAM' })
    } catch (error) {
      dispatch({ type: 'STREAM_ERROR', payload: error })
    }
  }
  
  return { state, startStream }
}
```

### UI/UX Considerations
- **Progressive Rendering**: Update charts as data arrives
- **Smooth Animations**: Use CSS transitions for progress updates
- **Responsive Design**: Adapt progress UI for mobile screens
- **Accessibility**: ARIA live regions for progress announcements
- **User Control**: Allow pause/resume/cancel operations

### Chart Rendering Optimization
```typescript
class IncrementalChartRenderer {
  private chart: Chart
  private dataBuffer: DataPoint[] = []
  private updateTimer?: number
  
  constructor(chartElement: HTMLElement) {
    this.chart = new Chart(chartElement, { 
      animation: false,
      responsive: true 
    })
  }
  
  addData(ticker: string, records: DataPoint[]) {
    this.dataBuffer.push(...records)
    this.scheduleUpdate()
  }
  
  private scheduleUpdate() {
    if (this.updateTimer) return
    
    this.updateTimer = requestAnimationFrame(() => {
      this.chart.data.datasets.push(...this.processBuffer())
      this.chart.update('none')  // No animation for performance
      this.dataBuffer = []
      this.updateTimer = undefined
    })
  }
}
```

## 8. Code Examples

### Backend: StreamingResponse Generator
```python
async def generate_ticker_data_stream(
    tickers: List[str],
    start_date: str,
    end_date: str,
    chunk_size: int = 100
) -> AsyncGenerator[str, None]:
    """Generate streaming JSON lines for ticker data."""
    total_tickers = len(tickers)
    
    for idx, ticker in enumerate(tickers):
        # Emit progress event
        progress = {
            "type": "progress",
            "ticker": ticker,
            "percentage": (idx / total_tickers) * 100,
            "tickers_completed": idx,
            "total_tickers": total_tickers,
            "timestamp": datetime.now().isoformat()
        }
        yield json.dumps(progress) + "\n"
        
        try:
            # Fetch data in chunks to avoid memory issues
            async for chunk in fetch_ticker_data_chunked(ticker, start_date, end_date, chunk_size):
                for record in chunk:
                    data_event = {
                        "type": "data",
                        "ticker": ticker,
                        **record
                    }
                    yield json.dumps(data_event) + "\n"
                
                # Allow other requests to process
                await asyncio.sleep(0)
                
        except Exception as e:
            error_event = {
                "type": "error",
                "ticker": ticker,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
            yield json.dumps(error_event) + "\n"
    
    # Emit completion event
    completion = {
        "type": "complete",
        "total_tickers": total_tickers,
        "timestamp": datetime.now().isoformat()
    }
    yield json.dumps(completion) + "\n"

@app.post("/data/stream")
async def stream_ticker_data(request: StreamingDataRequest):
    """Stream ticker data with progress updates."""
    generator = generate_ticker_data_stream(
        request.tickers,
        request.start_date,
        request.end_date or datetime.now().strftime('%Y-%m-%d'),
        request.chunk_size
    )
    
    return StreamingResponse(
        generator,
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
            "X-Total-Tickers": str(len(request.tickers))
        }
    )
```

### Frontend: Streaming Fetch with Streams
```typescript
export async function* streamTickerData(
  tickers: string[],
  startDate: string,
  endDate: string,
  onProgress?: (progress: ProgressEvent) => void
): AsyncGenerator<DataEvent, void, unknown> {
  const response = await fetch(API_ENDPOINTS.STREAM_DATA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tickers,
      start_date: startDate,
      end_date: endDate,
      format: 'jsonl',
      include_progress: true
    })
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const event = JSON.parse(line)
          
          if (event.type === 'progress' && onProgress) {
            onProgress(event as ProgressEvent)
          }
          
          yield event
        } catch (e) {
          console.error('Failed to parse stream event:', e)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// Usage example
const processStream = async () => {
  const dataMap = new Map<string, TickerData[]>()
  
  try {
    for await (const event of streamTickerData(
      ['AAPL', 'GOOGL', 'MSFT'],
      '2020-01-01',
      '2024-01-01',
      (progress) => updateProgressUI(progress)
    )) {
      switch (event.type) {
        case 'data':
          const ticker = event.ticker
          if (!dataMap.has(ticker)) {
            dataMap.set(ticker, [])
          }
          dataMap.get(ticker)!.push(event)
          updateChartIncremental(ticker, event)
          break
          
        case 'error':
          handleStreamError(event)
          break
          
        case 'complete':
          finalizeStream(event, dataMap)
          break
      }
    }
  } catch (error) {
    console.error('Stream failed:', error)
  }
}
```

### Progress Event Handling
```typescript
const ProgressDisplay: React.FC = () => {
  const [progress, setProgress] = useState<ProgressState>({
    percentage: 0,
    currentTicker: '',
    message: '',
    estimatedRemaining: 0
  })

  useEffect(() => {
    const handleProgress = (event: ProgressEvent) => {
      setProgress({
        percentage: event.percentage,
        currentTicker: event.current_ticker,
        message: `Processing ${event.current_ticker} (${event.tickers_completed}/${event.total_tickers})`,
        estimatedRemaining: event.estimated_remaining_seconds
      })
    }

    // Subscribe to progress events
    streamEventEmitter.on('progress', handleProgress)
    
    return () => {
      streamEventEmitter.off('progress', handleProgress)
    }
  }, [])

  return (
    <div className="streaming-progress">
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${progress.percentage}%` }}
        />
      </div>
      <div className="progress-details">
        <span>{progress.message}</span>
        <span>{formatDuration(progress.estimatedRemaining)} remaining</span>
      </div>
    </div>
  )
}
```

### Error Recovery Patterns
```typescript
class StreamingErrorRecovery {
  private retryCount = new Map<string, number>()
  private maxRetries = 3
  private backoffBase = 1000

  async handleStreamError(
    error: StreamError,
    resumeFrom?: string
  ): Promise<boolean> {
    if (!error.recoverable) {
      return false
    }

    const retries = this.retryCount.get(error.ticker || 'global') || 0
    if (retries >= this.maxRetries) {
      return false
    }

    const backoff = this.backoffBase * Math.pow(2, retries)
    await new Promise(resolve => setTimeout(resolve, backoff))

    this.retryCount.set(error.ticker || 'global', retries + 1)
    return true
  }

  async resumeStream(
    originalRequest: StreamingDataRequest,
    fromTicker?: string
  ): Promise<AsyncGenerator<DataEvent>> {
    const resumedRequest = {
      ...originalRequest,
      tickers: fromTicker 
        ? originalRequest.tickers.slice(
            originalRequest.tickers.indexOf(fromTicker)
          )
        : originalRequest.tickers
    }

    return streamTickerData(
      resumedRequest.tickers,
      resumedRequest.start_date,
      resumedRequest.end_date
    )
  }
}
```

## 9. Testing Strategy

### Streaming Performance Tests
```typescript
describe('Streaming Performance', () => {
  it('should handle 1000 tickers without memory leak', async () => {
    const initialMemory = process.memoryUsage().heapUsed
    const tickers = generateTickers(1000)
    
    const stream = streamTickerData(tickers, '2020-01-01', '2024-01-01')
    let recordCount = 0
    
    for await (const event of stream) {
      if (event.type === 'data') recordCount++
      
      // Check memory usage periodically
      if (recordCount % 10000 === 0) {
        const currentMemory = process.memoryUsage().heapUsed
        expect(currentMemory - initialMemory).toBeLessThan(100 * 1024 * 1024) // 100MB max
      }
    }
    
    expect(recordCount).toBeGreaterThan(1000000)
  })

  it('should maintain consistent throughput', async () => {
    const measurements: number[] = []
    let lastTime = Date.now()
    let lastCount = 0
    
    for await (const event of streamTickerData(['AAPL'], '2020-01-01', '2024-01-01')) {
      if (event.type === 'progress') {
        const now = Date.now()
        const rate = (event.records_processed - lastCount) / ((now - lastTime) / 1000)
        measurements.push(rate)
        lastTime = now
        lastCount = event.records_processed
      }
    }
    
    const avgRate = measurements.reduce((a, b) => a + b) / measurements.length
    const variance = measurements.reduce((a, b) => a + Math.pow(b - avgRate, 2), 0) / measurements.length
    
    expect(Math.sqrt(variance) / avgRate).toBeLessThan(0.2) // 20% variance
  })
})
```

### Network Interruption Handling
```typescript
describe('Network Resilience', () => {
  it('should recover from connection drops', async () => {
    const mockFetch = jest.fn()
    let callCount = 0
    
    mockFetch.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // Simulate connection drop after partial data
        return createPartialStreamResponse(['AAPL'], 100)
      }
      // Resume with remaining data
      return createStreamResponse(['AAPL'], 100, 200)
    })
    
    const client = new ResilientStreamClient(mockFetch)
    const results = await client.fetchWithRecovery(['AAPL'], '2020-01-01', '2021-01-01')
    
    expect(results.size).toBe(1)
    expect(results.get('AAPL')).toHaveLength(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
```

### Large Dataset Scenarios
```typescript
describe('Large Dataset Handling', () => {
  const scenarios = [
    { tickers: 10, years: 10, expectedRecords: 25000 },
    { tickers: 100, years: 5, expectedRecords: 125000 },
    { tickers: 500, years: 1, expectedRecords: 125000 }
  ]
  
  scenarios.forEach(({ tickers, years, expectedRecords }) => {
    it(`should handle ${tickers} tickers over ${years} years`, async () => {
      const startDate = new Date()
      startDate.setFullYear(startDate.getFullYear() - years)
      
      const stream = streamTickerData(
        generateTickers(tickers),
        startDate.toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      )
      
      let recordCount = 0
      let errorCount = 0
      const startTime = Date.now()
      
      for await (const event of stream) {
        if (event.type === 'data') recordCount++
        if (event.type === 'error') errorCount++
      }
      
      const duration = Date.now() - startTime
      
      expect(recordCount).toBeGreaterThan(expectedRecords * 0.9)
      expect(errorCount).toBeLessThan(tickers * 0.05) // Less than 5% error rate
      expect(duration).toBeLessThan(60000) // Complete within 1 minute
    })
  })
})
```

### Browser Compatibility
```typescript
describe('Browser Compatibility', () => {
  const browsers = ['chrome', 'firefox', 'safari', 'edge']
  
  browsers.forEach(browser => {
    it(`should work in ${browser}`, async () => {
      const page = await playwright[browser].launch()
      await page.goto('http://localhost:3000/test-streaming')
      
      await page.click('[data-testid="start-stream"]')
      
      // Wait for streaming to start
      await page.waitForSelector('[data-testid="progress-bar"]')
      
      // Verify progress updates
      const initialProgress = await page.getAttribute('[data-testid="progress-bar"]', 'aria-valuenow')
      await page.waitForTimeout(5000)
      const updatedProgress = await page.getAttribute('[data-testid="progress-bar"]', 'aria-valuenow')
      
      expect(Number(updatedProgress)).toBeGreaterThan(Number(initialProgress))
      
      // Verify data is being rendered
      await page.waitForSelector('[data-testid="chart-container"] canvas')
      
      await page.close()
    })
  })
})
```

## 10. User Experience

### Loading States
```typescript
interface LoadingState {
  status: 'initializing' | 'connecting' | 'streaming' | 'finalizing'
  message: string
  icon: string
}

const loadingStates: Record<string, LoadingState> = {
  initializing: {
    status: 'initializing',
    message: 'Preparing to fetch data...',
    icon: '🔄'
  },
  connecting: {
    status: 'connecting',
    message: 'Connecting to data sources...',
    icon: '🔗'
  },
  streaming: {
    status: 'streaming',
    message: 'Streaming ticker data...',
    icon: '📊'
  },
  finalizing: {
    status: 'finalizing',
    message: 'Processing final results...',
    icon: '✨'
  }
}
```

### Progress Indicators
```tsx
const StreamingProgress: React.FC<{progress: ProgressState}> = ({ progress }) => {
  return (
    <div className="streaming-progress-container">
      {/* Main progress bar */}
      <div className="main-progress">
        <div className="progress-header">
          <h3>Fetching Market Data</h3>
          <span className="progress-percentage">{progress.percentage.toFixed(1)}%</span>
        </div>
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      </div>
      
      {/* Detailed metrics */}
      <div className="progress-metrics">
        <div className="metric">
          <span className="metric-label">Current Ticker</span>
          <span className="metric-value">{progress.currentTicker}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Tickers Processed</span>
          <span className="metric-value">{progress.tickersCompleted} / {progress.totalTickers}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Data Points</span>
          <span className="metric-value">{progress.recordsProcessed.toLocaleString()}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Processing Rate</span>
          <span className="metric-value">{progress.rate.toFixed(0)} records/sec</span>
        </div>
        <div className="metric">
          <span className="metric-label">Time Remaining</span>
          <span className="metric-value">{formatDuration(progress.estimatedRemaining)}</span>
        </div>
      </div>
      
      {/* Visual ticker progress */}
      <div className="ticker-progress-list">
        {progress.tickerStatuses.map(ticker => (
          <div key={ticker.symbol} className={`ticker-status ${ticker.status}`}>
            <span className="ticker-symbol">{ticker.symbol}</span>
            <span className="ticker-status-icon">
              {ticker.status === 'complete' ? '✓' : 
               ticker.status === 'processing' ? '⏳' : 
               ticker.status === 'error' ? '❌' : '⏸'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Partial Data Rendering
```typescript
class PartialDataRenderer {
  private charts: Map<string, Chart> = new Map()
  private pendingUpdates: Map<string, DataPoint[]> = new Map()
  private updateInterval: number = 100 // ms
  private updateTimer?: number

  constructor(private container: HTMLElement) {
    this.startUpdateLoop()
  }

  addData(ticker: string, dataPoints: DataPoint[]) {
    if (!this.pendingUpdates.has(ticker)) {
      this.pendingUpdates.set(ticker, [])
      this.createChart(ticker)
    }
    
    this.pendingUpdates.get(ticker)!.push(...dataPoints)
  }

  private createChart(ticker: string) {
    const chartContainer = document.createElement('div')
    chartContainer.className = 'ticker-chart'
    chartContainer.dataset.ticker = ticker
    this.container.appendChild(chartContainer)

    const chart = new Chart(chartContainer, {
      type: 'line',
      data: { datasets: [] },
      options: {
        animation: false,
        responsive: true,
        scales: {
          x: { type: 'time' },
          y: { type: 'linear' }
        }
      }
    })

    this.charts.set(ticker, chart)
  }

  private startUpdateLoop() {
    this.updateTimer = window.setInterval(() => {
      this.processPendingUpdates()
    }, this.updateInterval)
  }

  private processPendingUpdates() {
    for (const [ticker, updates] of this.pendingUpdates) {
      if (updates.length === 0) continue

      const chart = this.charts.get(ticker)
      if (!chart) continue

      // Batch update chart data
      const dataset = chart.data.datasets[0] || {
        label: ticker,
        data: [],
        borderColor: this.getTickerColor(ticker),
        fill: false
      }

      dataset.data.push(...updates.map(d => ({
        x: new Date(d.date),
        y: d.close
      })))

      if (!chart.data.datasets[0]) {
        chart.data.datasets.push(dataset)
      }

      chart.update('none')
      this.pendingUpdates.set(ticker, [])
    }
  }

  destroy() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer)
    }
    this.charts.forEach(chart => chart.destroy())
  }
}
```

### Error Messaging
```typescript
interface StreamErrorDisplay {
  severity: 'warning' | 'error' | 'info'
  title: string
  message: string
  actions?: Array<{
    label: string
    action: () => void
  }>
}

const ErrorDisplay: React.FC<{errors: StreamError[]}> = ({ errors }) => {
  const errorSummary = errors.reduce((acc, error) => {
    const key = error.error_code || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="stream-errors">
      <div className="error-summary">
        <h4>Data Fetch Issues ({errors.length})</h4>
        {Object.entries(errorSummary).map(([code, count]) => (
          <div key={code} className="error-type">
            <span className="error-code">{code}</span>
            <span className="error-count">{count} ticker{count > 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>
      
      <details className="error-details">
        <summary>View Details</summary>
        <div className="error-list">
          {errors.map((error, idx) => (
            <div key={idx} className="error-item">
              <span className="error-ticker">{error.ticker}</span>
              <span className="error-message">{error.message}</span>
              {error.recoverable && (
                <button 
                  className="retry-button"
                  onClick={() => retryTicker(error.ticker!)}
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
```

## Summary

This streaming implementation will transform the user experience for large data requests by:

1. **Eliminating timeouts** through incremental data delivery
2. **Providing real-time feedback** with detailed progress indicators
3. **Enabling partial results** so users can start analyzing data immediately
4. **Improving reliability** with robust error handling and recovery
5. **Scaling efficiently** to handle massive datasets without memory constraints

The phased implementation approach ensures each component is thoroughly tested before integration, minimizing risk while delivering incremental value to users.