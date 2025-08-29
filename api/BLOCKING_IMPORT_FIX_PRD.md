# PRD: Fix Blocking Import Issue in Hybrid Simulation API

## Problem Statement

The hybrid simulation API endpoint `/api/hybrid-simulation/simulate` times out on the frontend due to a blocking import issue. When users click "Run Hybrid Simulation", the frontend receives a "timeout of 30000ms exceeded" error followed by network errors.

### Root Cause Analysis
- **Location**: `hybrid_simulation_api.py:128` - `from main import data_fetcher`
- **Issue**: This import statement triggers synchronous initialization of all services in `main.py` during the HTTP request
- **Impact**: Heavy computation blocks the FastAPI event loop, causing frontend timeouts
- **Current Behavior**: Services initialize at module import time (synchronous, blocking)
- **Expected Behavior**: Services should initialize at application startup (asynchronous, non-blocking)

## Technical Analysis

### Current Architecture Issues
1. **Module-level initialization**: All services (data_fetcher, monte_carlo_engine, etc.) initialize when main.py is imported
2. **Synchronous blocking**: Heavy operations like database connections, API key validation, cache setup run synchronously
3. **Import-time execution**: `from main import data_fetcher` triggers full service initialization during request processing
4. **Event loop blocking**: FastAPI's async event loop gets blocked by synchronous initialization code

### Performance Impact
- **Frontend timeout**: 30-120 seconds (depending on timeout settings)
- **Backend blocking**: API becomes unresponsive during initialization
- **User experience**: Simulation appears to hang/fail
- **Scalability**: Each request potentially triggers re-initialization

## Proposed Solution

### 1. FastAPI Lifespan Events Migration
**Objective**: Move service initialization from module-level to application startup

**Implementation**:
- Create `initialize_services()` async function containing all current initialization logic
- Create `shutdown_services()` async function for cleanup
- Implement FastAPI lifespan context manager using `@asynccontextmanager`
- Update FastAPI app creation to use lifespan handler

### 2. Global State Management
**Objective**: Provide thread-safe access to initialized services

**Implementation**:
- Keep global variables for services (data_fetcher, monte_carlo_engine, etc.)
- Initialize to None at module level
- Populate during startup lifespan event
- Access via app.state or maintain global references

### 3. Hybrid Simulation API Refactor
**Objective**: Remove blocking import and access pre-initialized services

**Implementation**:
- Remove `from main import data_fetcher` from request handler
- Access data_fetcher from app.state or global variable
- Ensure proper error handling if service not initialized
- Maintain backward compatibility with existing endpoints

## Technical Specifications

### Files to Modify
1. **main.py**:
   - Move initialization code to `initialize_services()` async function
   - Add lifespan context manager
   - Update FastAPI app creation

2. **hybrid_simulation_api.py**:
   - Remove blocking import from `run_hybrid_simulation()`
   - Update service access pattern
   - Add proper error handling

### Code Changes Required

#### main.py Changes
```python
# Before (blocking)
data_fetcher = CachedDataFetcher(...)  # At module level

# After (non-blocking)
data_fetcher = None  # At module level

async def initialize_services():
    global data_fetcher
    data_fetcher = CachedDataFetcher(...)  # At startup

@asynccontextmanager
async def lifespan(app: FastAPI):
    await initialize_services()
    yield
    await shutdown_services()

app = FastAPI(lifespan=lifespan)
```

#### hybrid_simulation_api.py Changes
```python
# Before (blocking)
from main import data_fetcher  # Triggers full initialization

# After (non-blocking)
# Access pre-initialized service
if data_fetcher is None:
    raise HTTPException(503, "Service not initialized")
```

## Implementation Plan

### Phase 1: FastAPI Lifespan Migration (Priority: High)
1. Create async service initialization functions
2. Implement lifespan context manager
3. Update FastAPI app creation
4. Test application startup/shutdown

### Phase 2: API Endpoint Updates (Priority: High)
1. Remove blocking imports from hybrid_simulation_api.py
2. Update service access patterns
3. Add proper error handling
4. Test hybrid simulation endpoint

### Phase 3: Testing & Validation (Priority: High)
1. Test frontend hybrid simulation functionality
2. Verify timeout resolution
3. Test application startup performance
4. Validate all existing endpoints still work

## Success Criteria

### Functional Requirements
- [ ] Frontend hybrid simulation completes without timeout
- [ ] Backend services initialize at startup, not per-request
- [ ] All existing API endpoints continue to work
- [ ] Application startup time remains acceptable (<10 seconds)

### Performance Requirements
- [ ] Frontend timeout eliminated (requests complete within 30 seconds)
- [ ] Backend response time improved (no blocking initialization)
- [ ] Memory usage stable (no memory leaks from repeated initialization)

### User Experience Requirements
- [ ] "Run Hybrid Simulation" button works reliably
- [ ] Status polling shows proper progress updates
- [ ] Error messages are clear and actionable

## Risk Assessment

### Technical Risks
- **Service initialization failures**: If startup fails, entire application won't work
- **Race conditions**: Multiple requests accessing services during initialization
- **Global state management**: Thread safety concerns with global variables

### Mitigation Strategies
- **Robust error handling**: Graceful degradation if services fail to initialize
- **Initialization checks**: Verify services are ready before processing requests
- **Testing**: Comprehensive testing of startup/shutdown cycles

## Testing Strategy

### Unit Tests
- Test service initialization functions
- Test lifespan event handlers
- Test error handling for uninitialized services

### Integration Tests
- Test full application startup/shutdown cycle
- Test hybrid simulation endpoint functionality
- Test concurrent request handling

### User Acceptance Tests
- Test frontend hybrid simulation workflow
- Test timeout resolution
- Test error scenarios

## Monitoring & Observability

### Metrics to Track
- Application startup time
- Service initialization success/failure rates
- Hybrid simulation request completion rates
- Frontend timeout frequency

### Logging Enhancements
- Log service initialization progress
- Log startup/shutdown events
- Log any initialization failures with detailed error messages

## Deployment Considerations

### Local Development
- Ensure development server restart works properly
- Test hot-reload functionality
- Verify debug mode compatibility

### Production Deployment
- Test deployment on Vercel/serverless platforms
- Verify cold start performance
- Test service availability health checks

## Conclusion

This fix addresses the root cause of the frontend timeout issue by moving service initialization from request-time to application startup. The FastAPI lifespan events provide a clean, async way to manage service lifecycle while maintaining backward compatibility with existing endpoints.

The solution is minimal, focused, and follows FastAPI best practices while resolving the blocking import issue that causes frontend timeouts.