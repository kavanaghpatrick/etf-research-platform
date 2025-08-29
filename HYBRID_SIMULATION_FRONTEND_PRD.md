# Hybrid Econometric Simulation Engine - Frontend Enhancement PRD

## 📋 Project Overview

**Goal**: Enhance the existing Monte Carlo Portfolio Simulator interface to integrate the new Hybrid Econometric Simulation Engine while maintaining backward compatibility and user familiarity.

**Approach**: Extend rather than replace the current interface, allowing users to choose between Traditional Monte Carlo and the new Hybrid Econometric method.

## 🎯 Core Requirements

### 1. Preserve Existing User Experience
- **✅ Keep all current functionality** for Traditional Monte Carlo simulation
- **✅ Maintain existing component structure** (PortfolioAllocation, SimulationParameters, SimulationResults)
- **✅ Preserve current layouts and visual design** patterns
- **✅ Ensure backward compatibility** with existing user workflows

### 2. Add Hybrid Engine Support
- **🆕 Simulation Method Selection**: Toggle between Traditional and Hybrid methods
- **🆕 Advanced Configuration**: Professional settings for econometric models
- **🆕 Enhanced Results**: Validation reports and model diagnostics
- **🆕 Background Processing**: Async task management with status polling

## 📐 Detailed Requirements

### A. Simulation Method Selection Component

**Location**: Between PortfolioAllocation and SimulationParameters in left sidebar

**Design**: Professional toggle with clear differentiation
```tsx
interface SimulationMethodProps {
  selectedMethod: 'traditional' | 'hybrid';
  onMethodChange: (method: 'traditional' | 'hybrid') => void;
}
```

**Visual Structure**:
```
┌─ Simulation Method ─────────────────────────┐
│ ○ Traditional Monte Carlo                   │
│   └─ "Bootstrap resampling methodology"     │
│                                             │
│ ● Hybrid Econometric (Recommended) ✨      │
│   └─ "Bias-free VAR+GARCH+Bootstrap"       │
│                                             │
│ ℹ️ Comparison: Why choose Hybrid?          │
└─────────────────────────────────────────────┘
```

**Features**:
- **Radio button selection** with clear labels
- **Method descriptions** explaining differences
- **"Recommended" badge** on Hybrid method
- **Expandable info section** comparing methods
- **Default to Hybrid** for new users

### B. Enhanced SimulationParameters Component

**Current Structure**: Keep all existing parameters (timePeriodYears, initialBalance, numSimulations, historicalStartDate)

**New Addition**: Advanced Settings Panel (collapsible)

```tsx
interface AdvancedSimulationConfig {
  // VAR Model Settings
  varMaxLags: number;           // 1-20, default 5
  varSelectionCriterion: 'aic' | 'bic'; // default 'aic'
  
  // GARCH Model Settings  
  garchDistribution: 'normal' | 't' | 'skewt'; // default 'normal'
  garchFallbackMethod: 'ewma' | 'constant';    // default 'ewma'
  
  // Bootstrap Settings
  bootstrapBlockLength: number | null;  // null = auto, default null
  preserveMean: boolean;                // default true
  
  // Processing Settings
  useParallel: boolean;        // default true
  maxWorkers: number | null;   // null = auto, default null
  randomSeed: number | null;   // for reproducibility, default null
  
  // Validation Settings
  enableValidation: boolean;   // default true
  runBenchmarks: boolean;      // default false
}
```

**Advanced Settings Panel Structure**:
```
┌─ Advanced Settings (Hybrid Only) ──────────┐
│ [▼] Show Advanced Configuration            │
│                                             │
│ ┌─ Model Configuration ─────────────────┐  │
│ │ VAR Max Lags: [5    ] (1-20)          │  │
│ │ GARCH Distribution: [Normal ▼]        │  │
│ │ Bootstrap Block: [Auto ▼]             │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ ┌─ Performance Settings ────────────────┐  │
│ │ ☑ Enable Parallel Processing         │  │
│ │ ☑ Statistical Validation             │  │
│ │ ☐ Performance Benchmarking           │  │
│ │ Random Seed: [      ] (optional)      │  │
│ └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**Implementation Details**:
- **Collapsible by default** to avoid overwhelming users
- **Only visible when Hybrid method selected**
- **Tooltips on all advanced options** explaining impact
- **Smart defaults** that work well for most users
- **Validation** ensuring parameter ranges are valid
- **Professional styling** matching existing components

### C. Enhanced API Service Layer

**File**: `frontend/src/services/hybridSimulationApi.ts`

**New Interfaces**:
```tsx
interface HybridSimulationRequest {
  // Core parameters (map from existing)
  tickers: string[];
  start_date: string;
  end_date: string;
  n_simulations: number;
  time_horizon_years: number;
  initial_portfolio_value: number;
  portfolio_weights?: number[];
  
  // Advanced parameters
  var_max_lags: number;
  garch_distribution: string;
  bootstrap_block_length?: number;
  preserve_mean: boolean;
  use_parallel: boolean;
  max_workers?: number;
  random_seed?: number;
  enable_validation: boolean;
  run_benchmarks: boolean;
}

interface HybridSimulationTaskResponse {
  task_id: string;
  status: 'started' | 'initializing' | 'fetching_data' | 'fitting_models' | 'running_simulation' | 'completed' | 'failed';
  message: string;
  estimated_completion_time?: string;
}

interface HybridSimulationResults {
  task_id: string;
  status: string;
  summary_statistics: {
    mean_final_value: number;
    median_final_value: number;
    mean_annual_return: number;
    mean_volatility: number;
    mean_sharpe_ratio: number;
  };
  percentile_analysis: {
    [key: string]: {
      final_value: number;
      annual_return: number;
      volatility: number;
      max_drawdown: number;
      sharpe_ratio: number;
    };
  };
  validation_report?: ValidationReport;
  benchmark_report?: BenchmarkReport;
  execution_time: number;
  tickers: string[];
  paths_sample: number[][]; // For visualization
}
```

**API Methods**:
```tsx
export const hybridSimulationApi = {
  async startSimulation(request: HybridSimulationRequest): Promise<HybridSimulationTaskResponse>;
  async getTaskStatus(taskId: string): Promise<HybridSimulationResults>;
  async cancelTask(taskId: string): Promise<void>;
  async validateResults(request: ValidationRequest): Promise<ValidationReport>;
  async runBenchmarks(config?: BenchmarkConfig): Promise<BenchmarkReport>;
}
```

### D. Enhanced SimulationResults Component

**Current Structure**: Keep existing tabs (Growth Chart, Distribution Chart, Metrics Table)

**New Features for Hybrid Results**:

1. **Enhanced Header** showing simulation method
```tsx
<div className="flex items-center justify-between">
  <div>
    <h2 className="text-2xl font-bold text-gray-900">
      Simulation Results 
      <span className="ml-2 px-2 py-1 text-sm bg-green-100 text-green-800 rounded">
        Hybrid Econometric ✨
      </span>
    </h2>
    <p className="text-sm text-gray-500 mt-1">
      {results.n_simulations.toLocaleString()} scenarios • {results.time_horizon} years • Bias-free methodology
    </p>
  </div>
</div>
```

2. **New Results Tabs** (in addition to existing):
```
Existing: [Growth] [Chart] [Table]
New:      [Growth] [Chart] [Table] [Validation] [Diagnostics]
```

3. **Validation Tab Structure**:
```
┌─ Statistical Validation Report ────────────┐
│                                             │
│ Overall Score: 8.7/10 ✅ PASSED           │
│                                             │
│ ┌─ Distribution Tests ─────────────────┐   │
│ │ ✅ Kolmogorov-Smirnov: p=0.234      │   │
│ │ ✅ Moment Matching: 98.5% accuracy   │   │
│ │ ✅ Normality Test: p=0.145          │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─ Bias Reduction Analysis ──────────┐   │
│ │ Mean Bias: -15.2% → -0.8% ✅       │   │
│ │ Volatility Bias: -8.3% → +0.2% ✅   │   │
│ │ Overall Improvement: 85.4%          │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ 📋 Recommendations:                        │
│ • Excellent validation performance          │
│ • Production ready with high confidence    │
└─────────────────────────────────────────────┘
```

4. **Diagnostics Tab Structure**:
```
┌─ Model Diagnostics ─────────────────────────┐
│                                             │
│ ┌─ VAR Model Performance ──────────────┐   │
│ │ Convergence Rate: 98.5% ✅           │   │
│ │ Selected Lags: 3 (AIC optimal)       │   │
│ │ R²: 0.145 (typical for returns)      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─ GARCH Volatility Model ─────────────┐   │
│ │ Convergence: Success ✅               │   │
│ │ Distribution: Normal                  │   │
│ │ Volatility Clustering: Detected      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─ Bootstrap Configuration ────────────┐   │
│ │ Optimal Block Length: 15 days        │   │
│ │ Autocorr Preservation: 87.3%         │   │
│ │ Coverage Ratio: 92.1%                │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ⚡ Performance: 142 paths/sec              │
│ 💾 Memory Usage: 234 MB                    │
│ ⏱️ Execution Time: 35.2 seconds            │
└─────────────────────────────────────────────┘
```

### E. Background Task Management

**Enhanced Loading States**:
```tsx
interface LoadingState {
  isRunning: boolean;
  phase: 'initializing' | 'fetching_data' | 'fitting_models' | 'running_simulation' | 'validating';
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number;
  taskId?: string;
}
```

**Loading UI Enhancement**:
```
┌─ Running Hybrid Econometric Simulation ────┐
│                                             │
│  [▓▓▓▓▓▓▓▓░░] 73%                          │
│                                             │
│  Phase: Fitting GARCH models...             │
│  Estimated time remaining: 12 seconds       │
│                                             │
│  ✅ Data fetched (2.1s)                    │
│  ✅ VAR models fitted (8.4s)               │
│  🔄 GARCH models fitting... (3/5 assets)   │
│  ⏳ Bootstrap simulation pending           │
│  ⏳ Validation pending                     │
│                                             │
│  [Cancel Simulation]                        │
└─────────────────────────────────────────────┘
```

**Features**:
- **Real-time progress tracking** with specific phases
- **Phase completion indicators** (✅ ✗ 🔄 ⏳)
- **Estimated time remaining** calculation
- **Cancel capability** for long-running tasks
- **Task persistence** (results survive page refresh)

### F. Comparison Mode (Future Enhancement)

**Split View Option**:
```
┌─ Simulation Method Comparison ──────────────┐
│                                             │
│ Traditional Monte Carlo │ Hybrid Econometric│
│ ─────────────────────── │ ──────────────────│
│ Mean Return: 7.2%       │ Mean Return: 8.1% │
│ Volatility: 18.3%       │ Volatility: 16.8% │
│ Sharpe: 0.61           │ Sharpe: 0.74      │
│ Max Drawdown: -34.2%    │ Max Drawdown: -28.1%│
│                         │                   │
│ [Chart comparing both methods]              │
│                                             │
│ 📊 Bias Analysis:                          │
│ • Hybrid shows 15.3% less negative bias    │
│ • More realistic volatility estimates      │
│ • Better tail risk representation          │
└─────────────────────────────────────────────┘
```

## 🏗️ Implementation Architecture

### Component Hierarchy
```
MonteCarloPage (enhanced)
├─ SimulationMethodSelector (NEW)
├─ PortfolioAllocation (unchanged)
├─ SimulationParameters (enhanced)
│  └─ AdvancedSettingsPanel (NEW)
└─ SimulationResults (enhanced)
   ├─ ExistingTabs (unchanged)
   ├─ ValidationTab (NEW)
   └─ DiagnosticsTab (NEW)
```

### State Management
```tsx
interface EnhancedPageState {
  // Existing state
  portfolio: PortfolioItem[];
  simulationConfig: SimulationConfig;
  
  // New state
  simulationMethod: 'traditional' | 'hybrid';
  advancedConfig: AdvancedSimulationConfig;
  
  // Enhanced state
  isRunning: boolean;
  currentTask: HybridSimulationTaskResponse | null;
  loadingState: LoadingState;
  
  // Results (union type)
  results: MonteCarloResponse | HybridSimulationResults | null;
}
```

### File Structure
```
frontend/src/
├─ services/
│  ├─ monteCarloApi.ts (existing)
│  └─ hybridSimulationApi.ts (NEW)
├─ components/
│  ├─ PortfolioAllocation.tsx (unchanged)
│  ├─ SimulationParameters.tsx (enhanced)
│  ├─ SimulationResults.tsx (enhanced)
│  ├─ SimulationMethodSelector.tsx (NEW)
│  ├─ AdvancedSettingsPanel.tsx (NEW)
│  ├─ ValidationReport.tsx (NEW)
│  ├─ ModelDiagnostics.tsx (NEW)
│  └─ EnhancedLoadingState.tsx (NEW)
└─ app/
   └─ monte-carlo/
      └─ page.tsx (enhanced)
```

## 📝 Detailed Component Specifications

### 1. SimulationMethodSelector Component

```tsx
interface SimulationMethodSelectorProps {
  selectedMethod: 'traditional' | 'hybrid';
  onMethodChange: (method: 'traditional' | 'hybrid') => void;
  className?: string;
}

export default function SimulationMethodSelector({
  selectedMethod,
  onMethodChange,
  className = ""
}: SimulationMethodSelectorProps) {
  const [showComparison, setShowComparison] = useState(false);

  return (
    <div className={`p-6 border-b border-gray-200 ${className}`}>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Simulation Method
      </h3>
      
      <div className="space-y-3">
        {/* Traditional Option */}
        <label className="relative flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            value="traditional"
            checked={selectedMethod === 'traditional'}
            onChange={() => onMethodChange('traditional')}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="ml-3 flex-1">
            <div className="text-sm font-medium text-gray-900">
              Traditional Monte Carlo
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Bootstrap resampling methodology
            </div>
          </div>
        </label>

        {/* Hybrid Option */}
        <label className="relative flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 border-green-200 bg-green-50">
          <input
            type="radio"
            value="hybrid"
            checked={selectedMethod === 'hybrid'}
            onChange={() => onMethodChange('hybrid')}
            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
          />
          <div className="ml-3 flex-1">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-900">
                Hybrid Econometric
              </span>
              <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                Recommended ✨
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Bias-free VAR+GARCH+Bootstrap methodology
            </div>
          </div>
        </label>
      </div>

      {/* Comparison Info */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="mt-3 text-xs text-blue-600 hover:text-blue-800 flex items-center"
      >
        <InformationCircleIcon className="h-4 w-4 mr-1" />
        {showComparison ? 'Hide' : 'Show'} method comparison
      </button>

      {showComparison && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-xs text-blue-800 space-y-2">
            <div><strong>Traditional:</strong> Resamples historical data blocks</div>
            <div><strong>Hybrid:</strong> Models mean (VAR) + volatility (GARCH) + preserves dependence (Bootstrap)</div>
            <div className="pt-2 border-t border-blue-200">
              <strong>Hybrid Benefits:</strong> Eliminates crisis concentration bias, more realistic projections
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 2. AdvancedSettingsPanel Component

```tsx
interface AdvancedSettingsConfig {
  varMaxLags: number;
  garchDistribution: 'normal' | 't' | 'skewt';
  bootstrapBlockLength: number | null;
  preserveMean: boolean;
  useParallel: boolean;
  randomSeed: number | null;
  enableValidation: boolean;
  runBenchmarks: boolean;
}

interface AdvancedSettingsPanelProps {
  config: AdvancedSettingsConfig;
  onConfigChange: (config: AdvancedSettingsConfig) => void;
  visible: boolean;
}

export default function AdvancedSettingsPanel({
  config,
  onConfigChange,
  visible
}: AdvancedSettingsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!visible) return null;

  const updateConfig = (field: keyof AdvancedSettingsConfig, value: any) => {
    onConfigChange({ ...config, [field]: value });
  };

  return (
    <div className="border-t border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
      >
        <span className="text-sm font-medium text-gray-700">
          Advanced Settings
        </span>
        <ChevronDownIcon 
          className={`h-4 w-4 text-gray-400 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`} 
        />
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Model Configuration */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Model Configuration</h4>
            
            {/* VAR Max Lags */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                VAR Max Lags: {config.varMaxLags}
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={config.varMaxLags}
                onChange={(e) => updateConfig('varMaxLags', parseInt(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
            </div>

            {/* GARCH Distribution */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                GARCH Distribution
              </label>
              <select
                value={config.garchDistribution}
                onChange={(e) => updateConfig('garchDistribution', e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="normal">Normal (recommended)</option>
                <option value="t">Student-t (fat tails)</option>
                <option value="skewt">Skewed-t (asymmetric)</option>
              </select>
            </div>

            {/* Bootstrap Block Length */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Bootstrap Block Length
              </label>
              <select
                value={config.bootstrapBlockLength || 'auto'}
                onChange={(e) => updateConfig('bootstrapBlockLength', e.target.value === 'auto' ? null : parseInt(e.target.value))}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="auto">Auto (recommended)</option>
                <option value="5">5 days</option>
                <option value="10">10 days</option>
                <option value="20">20 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </div>
          </div>

          {/* Processing Settings */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Processing Settings</h4>
            
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.useParallel}
                  onChange={(e) => updateConfig('useParallel', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-600">Enable parallel processing</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.enableValidation}
                  onChange={(e) => updateConfig('enableValidation', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-600">Statistical validation</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.runBenchmarks}
                  onChange={(e) => updateConfig('runBenchmarks', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-600">Performance benchmarking</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.preserveMean}
                  onChange={(e) => updateConfig('preserveMean', e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-xs text-gray-600">Preserve historical mean</span>
              </label>
            </div>

            {/* Random Seed */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Random Seed (optional)
              </label>
              <input
                type="number"
                value={config.randomSeed || ''}
                onChange={(e) => updateConfig('randomSeed', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Leave empty for random"
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 📊 Success Metrics

### User Experience Metrics
- **Adoption Rate**: >70% of users choose Hybrid method within 30 days
- **User Retention**: No decrease in engagement vs current interface
- **Task Completion**: 95%+ successful simulation completion rate
- **Error Rate**: <5% configuration errors with validation

### Technical Performance Metrics
- **Load Time**: Advanced settings render <100ms
- **Responsiveness**: No UI freezing during background simulations
- **Memory Usage**: <50MB additional frontend memory footprint
- **API Reliability**: 99%+ successful API calls

### Business Impact Metrics
- **User Satisfaction**: >4.5/5 rating for new interface
- **Feature Utilization**: >40% of users explore advanced settings
- **Validation Adoption**: >60% of users enable validation
- **Professional Usage**: Increased usage among institutional users

## 🔄 Migration Strategy

### Phase 1: Core Integration (Week 1-2)
1. **Add SimulationMethodSelector** component
2. **Extend SimulationParameters** with advanced panel
3. **Update API service** for hybrid endpoints
4. **Basic results display** for hybrid output

### Phase 2: Enhanced Experience (Week 3-4)
1. **Implement background task management**
2. **Add validation and diagnostics tabs**
3. **Enhanced loading states** with progress tracking
4. **Professional styling** and polish

### Phase 3: Advanced Features (Week 5-6)
1. **Export capabilities** for reports
2. **Comparison mode** between methods
3. **Performance optimizations**
4. **Help documentation** and tooltips

### Phase 4: Production Hardening (Week 7-8)
1. **Comprehensive testing** across browsers
2. **Error handling** and edge cases
3. **Performance monitoring**
4. **User feedback integration**

## 🎨 Design Specifications

### Color Scheme
- **Hybrid Method Accent**: Green (#10B981, #ECFDF5) - indicates advanced/recommended
- **Traditional Method**: Blue (#3B82F6, #EFF6FF) - maintains current branding
- **Validation Success**: Green indicators for passed tests
- **Validation Warning**: Yellow indicators for marginal results
- **Validation Error**: Red indicators for failed tests

### Typography
- **Maintain existing font hierarchy** (Inter)
- **Method labels**: font-medium, text-sm
- **Advanced settings**: font-medium, text-xs
- **Descriptions**: text-xs, text-gray-500
- **Badges**: text-xs, rounded-full

### Spacing & Layout
- **Consistent padding**: p-4, p-6 following existing patterns
- **Component separation**: border-t, border-gray-200
- **Grid alignment**: Maintain lg:col-span-4 and lg:col-span-8 layout
- **Responsive behavior**: Preserve mobile-first responsive design

### Interaction Patterns
- **Radio buttons**: Native HTML with custom styling matching existing
- **Toggles**: Collapsible panels with smooth transitions
- **Progress indicators**: Animated with phase descriptions
- **Tooltips**: Hover states with helpful explanations

## 🧪 Testing Strategy

### Unit Tests
- **Component rendering** for all new components
- **State management** for enhanced configurations
- **API integration** with mock responses
- **Form validation** for advanced settings

### Integration Tests
- **End-to-end simulation workflows** for both methods
- **Background task management** and cancellation
- **Results display** for various response types
- **Error handling** and recovery scenarios

### User Acceptance Tests
- **Method switching** preserves portfolio configuration
- **Advanced settings** apply correctly to simulations
- **Results comparison** between methods
- **Export functionality** works across result types

### Performance Tests
- **Memory usage** doesn't increase significantly
- **Rendering performance** remains smooth
- **API response handling** for large result sets
- **Background task polling** efficiency

## 📚 Documentation Requirements

### User Documentation
- **Method comparison guide** explaining differences
- **Advanced settings reference** with parameter explanations
- **Results interpretation** for validation and diagnostics
- **Best practices** for different use cases

### Developer Documentation
- **API integration guide** for hybrid endpoints
- **Component usage examples** and props documentation
- **State management patterns** and data flow
- **Extension points** for future enhancements

### Help System
- **Contextual tooltips** for all advanced options
- **Progressive disclosure** of complex features
- **Error messages** with actionable guidance
- **Success indicators** with clear explanations

## 🚀 Future Enhancements

### Near-term (3-6 months)
- **Comparison mode** showing Traditional vs Hybrid side-by-side
- **Historical simulation library** saving previous runs
- **Custom validation rules** for specific use cases
- **API rate limiting** and queue management

### Medium-term (6-12 months)
- **Advanced model selection** (DCC-GARCH, factor models)
- **Scenario analysis** with stress testing
- **Institutional features** (compliance reporting, audit trails)
- **Mobile optimization** for tablet usage

### Long-term (12+ months)
- **Machine learning integration** for enhanced forecasting
- **Real-time simulation updates** with live market data
- **Collaborative features** for team analysis
- **API marketplace** for third-party model integration

---

## ✅ Alignment Verification

This PRD has been carefully designed to **preserve and enhance** the existing Monte Carlo interface while adding professional-grade features for the Hybrid Econometric Simulation Engine:

### ✅ **Preserved Elements**:
- All existing component structure and layouts
- Current simulation parameters and validation
- Existing visual design and interaction patterns
- Portfolio allocation workflow and UI
- Results visualization and export capabilities

### ✅ **Enhanced Elements**:
- Professional method selection with clear differentiation
- Advanced settings that don't overwhelm casual users
- Background task management for better UX
- Enhanced results with validation and diagnostics
- Backward compatibility ensuring no breaking changes

### ✅ **Technical Alignment**:
- Follows existing TypeScript patterns and interfaces
- Maintains current API service architecture
- Preserves responsive design and accessibility
- Uses same styling system (Tailwind CSS)
- Follows existing component composition patterns

The enhancement maintains **100% backward compatibility** while providing a **clear upgrade path** for users wanting more sophisticated analysis capabilities.