# PRD: Hybrid Simulation Frontend/Backend Integration Fixes

## Executive Summary

This PRD addresses critical integration issues between the hybrid econometric simulation backend and frontend visualization components. The primary issue is a data format mismatch where the backend sends arbitrary simulation paths while the frontend expects percentile-based paths, causing incorrect visualizations and poor user experience.

## Problem Statement

### Current Issues
1. **Path Data Mismatch**: Backend sends first 10 arbitrary simulation paths, but frontend expects 10th, 50th, and 90th percentile paths
2. **No Progress Tracking**: Users see 0% progress until simulation completes (can take 30+ seconds)
3. **Data Structure Incompatibilities**: Missing fields and type mismatches cause frontend errors
4. **Hardcoded Time Assumptions**: Frontend assumes 252 trading days/year regardless of actual simulation frequency
5. **Chart Rendering Failures**: Invalid data structures prevent charts from rendering

### Impact
- Users see incorrect simulation results in charts
- Poor UX with no progress feedback during long simulations
- Potential crashes when data structures don't match expectations
- Confusion when comparing hybrid vs traditional Monte Carlo results

## Proposed Solution

### 1. Fix Path Data Format (Priority: P0)

**Backend Changes (`api/hybrid_simulation_api.py`)**
```python
# Line 565 - Replace arbitrary paths with actual percentiles
def process_simulation_results(results: SimulationResults, tickers: List[str]) -> Dict[str, Any]:
    # ... existing code ...
    
    # Validate portfolio_paths exists and has data
    if results.portfolio_paths is None or len(results.portfolio_paths) == 0:
        logger.warning("No portfolio paths available for percentile calculation")
        return {
            # ... existing fields ...
            'paths_sample': [],
            'time_years': [],
            'error': 'No simulation paths available'
        }
    
    # Calculate percentile paths across all simulations
    try:
        percentile_10 = np.percentile(results.portfolio_paths, 10, axis=0).tolist()
        percentile_50 = np.percentile(results.portfolio_paths, 50, axis=0).tolist()
        percentile_90 = np.percentile(results.portfolio_paths, 90, axis=0).tolist()
    except Exception as e:
        logger.error(f"Failed to calculate percentiles: {e}")
        # Fallback to first 3 paths if percentile calculation fails
        percentile_10 = results.portfolio_paths[0].tolist() if len(results.portfolio_paths) > 0 else []
        percentile_50 = results.portfolio_paths[1].tolist() if len(results.portfolio_paths) > 1 else []
        percentile_90 = results.portfolio_paths[2].tolist() if len(results.portfolio_paths) > 2 else []
    
    # Calculate time axis based on simulation parameters
    num_steps = len(percentile_10) if percentile_10 else 0
    days_per_year = results.simulation_config.get('days_per_year', 252)  # Use config or default
    time_years = [i / days_per_year for i in range(num_steps)]
    
    return {
        # ... existing fields ...
        'paths_sample': [percentile_10, percentile_50, percentile_90],
        'time_years': time_years,
        'days_per_year': days_per_year
    }
```

### 2. Add Progress Tracking (Priority: P0)

**Backend Changes**
- Add progress field to task status updates
- Update task progress at key simulation phases

```python
# In execute_hybrid_simulation function
async def execute_hybrid_simulation(task_id: str, request: HybridSimulationRequest, data_fetcher_instance):
    # Update with progress percentage
    simulation_tasks[task_id].update({
        'status': 'fetching_data',
        'message': 'Fetching historical data...',
        'progress': 10
    })
    
    # ... fetch data ...
    
    simulation_tasks[task_id].update({
        'status': 'fitting_models',
        'message': 'Fitting econometric models...',
        'progress': 30
    })
    
    # ... fit models ...
    
    # During simulation, update progress incrementally
    batch_size = max(100, request.n_simulations // 20)  # Update every 5%
    for i in range(0, request.n_simulations, batch_size):
        # ... run batch ...
        progress = 30 + int(60 * (i / request.n_simulations))
        simulation_tasks[task_id]['progress'] = progress
    
    # Final validation phase
    simulation_tasks[task_id].update({
        'status': 'validating',
        'message': 'Validating results...',
        'progress': 90
    })
```

**Frontend Changes (`frontend/src/services/hybridSimulationApi.ts`)**
```typescript
export interface HybridSimulationResults {
    // ... existing fields ...
    progress?: number;  // Add progress field
}

// In status polling component
const checkStatus = async () => {
    const status = await hybridSimulationApi.getTaskStatus(taskId);
    setProgress(status.progress || 0);
    // ... rest of logic ...
};
```

### 3. Fix Data Structure Compatibility (Priority: P1)

**Frontend Changes**
```typescript
// Line 373-386 - Add validation and use backend time_years
export function convertHybridResultsToTraditional(hybridResults: HybridSimulationResults): any {
    if (!hybridResults.results || !hybridResults.results.paths_sample) {
        return null;
    }
    
    const results = hybridResults.results;
    
    // Validate paths_sample structure
    if (!Array.isArray(results.paths_sample) || results.paths_sample.length < 3) {
        console.error('Invalid paths_sample: expected array with at least 3 percentile paths');
        return null;
    }
    
    // Validate each path has data
    const validPaths = results.paths_sample.every(path => 
        Array.isArray(path) && path.length > 0
    );
    
    if (!validPaths) {
        console.error('Invalid path data: some paths are empty or invalid');
        return null;
    }
    
    // Use backend-provided time_years or calculate fallback
    const days_per_year = results.days_per_year || 252;
    const time_years = results.time_years || 
        Array.from({length: results.paths_sample[0].length}, (_, i) => i / days_per_year);
    
    // Apply simple inflation adjustment (2% annual) if not provided
    const inflationRate = 0.02;
    const calculateRealPath = (nominalPath: number[]): number[] => {
        return nominalPath.map((value, index) => {
            const years = time_years[index] || 0;
            return value / Math.pow(1 + inflationRate, years);
        });
    };
    
    return {
        // ... existing conversion ...
        percentile_paths: {
            time_years,
            percentile_paths_nominal: {
                '10th': results.paths_sample[0] || [],
                '50th': results.paths_sample[1] || [],
                '90th': results.paths_sample[2] || []
            },
            percentile_paths_real: {
                '10th': calculateRealPath(results.paths_sample[0] || []),
                '50th': calculateRealPath(results.paths_sample[1] || []),
                '90th': calculateRealPath(results.paths_sample[2] || [])
            },
            initial_balance: hybridResults.simulation_config.initial_portfolio_value
        }
    };
}
```

### 4. Add Loading State Component (Priority: P1)

Create enhanced loading component with progress tracking:

```typescript
// New component: EnhancedHybridLoadingState.tsx
interface Props {
    taskId: string;
    onComplete: (results: HybridSimulationResults) => void;
    onError: (error: string) => void;
}

export function EnhancedHybridLoadingState({ taskId, onComplete, onError }: Props) {
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('initializing');
    const [message, setMessage] = useState('Preparing simulation...');
    
    useEffect(() => {
        let retryCount = 0;
        const maxRetries = 3;
        
        const checkStatus = async () => {
            try {
                const result = await hybridSimulationApi.getTaskStatus(taskId);
                setProgress(result.progress || 0);
                setStatus(result.status);
                setMessage(result.message || 'Processing...');
                
                // Reset retry count on successful request
                retryCount = 0;
                
                if (result.status === 'completed') {
                    clearInterval(pollInterval);
                    onComplete(result);
                } else if (result.status === 'failed') {
                    clearInterval(pollInterval);
                    onError(result.error || 'Simulation failed');
                }
            } catch (error) {
                retryCount++;
                if (retryCount >= maxRetries) {
                    clearInterval(pollInterval);
                    onError('Lost connection to simulation. Please check your network.');
                } else {
                    console.warn(`Status check failed, retry ${retryCount}/${maxRetries}`);
                }
            }
        };
        
        const pollInterval = setInterval(checkStatus, 2000);  // Poll every 2 seconds
        checkStatus(); // Initial check immediately
        
        return () => clearInterval(pollInterval);
    }, [taskId]);
    
    return (
        <div className="space-y-4">
            <div className="text-center">
                <h3 className="text-lg font-medium">{message}</h3>
                <p className="text-sm text-gray-500 mt-1">Status: {status}</p>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                />
            </div>
            
            <p className="text-center text-sm text-gray-600">{progress}% complete</p>
        </div>
    );
}
```

### 5. Chart Validation (Priority: P2)

Add data validation before chart rendering:

```typescript
// In chart components
const validateChartData = (data: any): { valid: boolean; error?: string } => {
    if (!data?.percentile_paths) {
        return { valid: false, error: 'No percentile paths data available' };
    }
    
    const { time_years, percentile_paths_nominal, percentile_paths_real } = data.percentile_paths;
    
    // Check all required data exists
    if (!time_years?.length) {
        return { valid: false, error: 'No time series data available' };
    }
    
    if (!percentile_paths_nominal || !percentile_paths_real) {
        return { valid: false, error: 'Missing nominal or real percentile data' };
    }
    
    // Check data consistency
    const expectedLength = time_years.length;
    const percentileKeys = ['10th', '50th', '90th'];
    
    for (const key of percentileKeys) {
        if (!percentile_paths_nominal[key] || percentile_paths_nominal[key].length !== expectedLength) {
            return { valid: false, error: `Invalid data length for ${key} percentile` };
        }
        
        // Check for NaN or Infinity values
        if (percentile_paths_nominal[key].some((v: number) => !isFinite(v))) {
            return { valid: false, error: `Invalid numeric values in ${key} percentile` };
        }
    }
    
    return { valid: true };
};

// Use in chart component with better error messaging
const validation = validateChartData(simulationData);
if (!validation.valid) {
    return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">Unable to render chart: {validation.error}</p>
            <p className="text-sm text-red-600 mt-1">Please try running the simulation again.</p>
        </div>
    );
}
```

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
1. Fix backend percentile path calculation
2. Add progress field to API responses
3. Update frontend data conversion logic
4. Add basic progress display

### Phase 2: Enhanced UX (Week 2)
1. Implement enhanced loading state component
2. Add comprehensive data validation
3. Improve error handling and user feedback
4. Add chart data validation

### Phase 3: Testing & Polish (Week 3)
1. Unit tests for percentile calculations
2. Integration tests for progress tracking
3. E2E tests for full simulation flow
4. Performance optimization

## Success Metrics

1. **Correct Visualizations**: Charts display actual 10th/50th/90th percentile paths
2. **Progress Visibility**: Users see progress updates during simulation
3. **Zero Frontend Errors**: No console errors from data mismatches
4. **Improved UX**: 90% of users understand simulation progress
5. **Performance**: No regression in simulation execution time

## Additional Logical Fixes

### 6. Configuration Management (Priority: P1)

**Backend Changes**
```python
# In SimulationConfig or request processing
def process_simulation_request(request: HybridSimulationRequest):
    # Make days_per_year configurable based on simulation type
    simulation_frequency = request.simulation_frequency or 'daily'
    
    days_per_year_map = {
        'daily': 252,      # Trading days
        'calendar': 365,   # Calendar days
        'weekly': 52,      # Weekly
        'monthly': 12      # Monthly
    }
    
    days_per_year = days_per_year_map.get(simulation_frequency, 252)
    
    # Pass to simulation config
    config.days_per_year = days_per_year
```

### 7. Edge Case Handling (Priority: P1)

**Backend Percentile Calculation**
```python
# Handle edge cases for small simulations
def calculate_percentiles_safe(portfolio_paths, percentiles=[10, 50, 90]):
    n_paths = len(portfolio_paths)
    
    # For very small simulations, adjust percentiles
    if n_paths < 10:
        logger.warning(f"Only {n_paths} paths available, adjusting percentiles")
        if n_paths >= 3:
            # Use min, median, max for small samples
            return [
                np.min(portfolio_paths, axis=0),
                np.median(portfolio_paths, axis=0),
                np.max(portfolio_paths, axis=0)
            ]
        else:
            # Return available paths padded with median
            paths = list(portfolio_paths)
            while len(paths) < 3:
                paths.append(np.median(portfolio_paths, axis=0))
            return paths[:3]
    
    # Normal percentile calculation for larger samples
    return [np.percentile(portfolio_paths, p, axis=0) for p in percentiles]
```

### 8. Response Format Consistency (Priority: P2)

Ensure hybrid simulation response matches traditional Monte Carlo format where possible:

```typescript
// Add to backend response
export interface HybridSimulationResults {
    // ... existing fields ...
    
    // Add fields to match traditional format
    simulation_metadata: {
        num_simulations: number;
        time_period_years: number;
        block_size_days: number | 'Auto';
        historical_trading_days: number;
        simulation_frequency: string;
    };
    
    // Ensure consistent error format
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}
```

## Technical Considerations

1. **Backward Compatibility**: Ensure changes work with existing saved results
2. **Performance**: Percentile calculations should not significantly impact simulation time
3. **Error Handling**: Graceful degradation if new fields are missing
4. **Testing**: Comprehensive test coverage for data transformations
5. **Validation**: Add input validation for edge cases (e.g., n_simulations < 10)
6. **Logging**: Add detailed logging for debugging percentile calculations

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|---------|------------|
| Performance regression from percentile calculations | High | Pre-calculate during simulation, not post-process |
| Breaking existing integrations | Medium | Feature flag for new response format |
| Complex progress tracking implementation | Medium | Start with simple percentage updates |

## Future Enhancements

1. **WebSocket Progress**: Real-time progress updates via WebSocket
2. **Configurable Percentiles**: Allow users to choose which percentiles to display
3. **Streaming Results**: Stream partial results as simulation progresses
4. **Advanced Visualizations**: Add confidence bands, distribution plots

## Acceptance Criteria

- [ ] Backend returns exactly 3 percentile paths (10th, 50th, 90th) with proper validation
- [ ] Backend handles edge cases (small simulations, empty data) gracefully
- [ ] Frontend charts correctly display percentile paths with proper labels
- [ ] Progress bar updates during simulation (not stuck at 0%) with network retry logic
- [ ] No console errors when rendering hybrid simulation results
- [ ] Time axis correctly reflects simulation frequency (configurable days_per_year)
- [ ] Data validation prevents rendering invalid charts with clear error messages
- [ ] Inflation adjustment applied to real percentile paths
- [ ] All existing tests pass
- [ ] New tests added for:
  - [ ] Percentile calculations with various sample sizes
  - [ ] Edge case handling (empty data, small samples)
  - [ ] Progress tracking updates
  - [ ] Data validation logic
- [ ] Documentation updated with new response format and configuration options