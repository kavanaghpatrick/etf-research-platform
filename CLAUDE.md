# CLAUDE.md - ETF Research Platform Development Guide

## 🧘 SIMPLICITY FIRST - THE PRIME DIRECTIVE

### When facing ANY problem, ALWAYS ask in this order:
1. **"What can I DELETE to fix this?"** - Remove the cause, not add a bandaid
2. **"What existing code already does this?"** - Reuse before creating
3. **"Can I fix this by changing 1 line?"** - Smallest change that works
4. **"Is the problem a missing simple thing?"** - Often it's a typo or wrong parameter

### The Most Impactful Rule:
**"Every bug is an opportunity to DELETE code, not add it."**

When encountering an issue, the instinct should be:
- First, look for what unnecessary code is CAUSING the problem
- Second, find what ALREADY EXISTS that solves it
- Last resort, add the MINIMUM new code possible

### Real Examples from This Project:
```
❌ BAD: Cache complexity → Add more tables, migration system, optimization hints
✅ GOOD: Cache complexity → Single table, basic CRUD operations (75% code reduction)

❌ BAD: Duplicate main.py files → Complex merge strategy with feature flags
✅ GOOD: Duplicate main.py → Keep one, add timeout protection (simple consolidation)

❌ BAD: Bundle too large → Add complex optimization pipeline
✅ GOOD: Bundle too large → Lazy load heavy libraries, remove unused dependencies
```

### Red Flags That We're Over-Engineering:
- Adding "just in case" error handling
- Creating new state variables to track things
- Writing coordination logic between components
- Adding queues, flags, or timers to "fix" race conditions
- The fix is longer than 10 lines
- Multiple abstraction layers for single implementations
- Configuration systems for hardcoded values

### The Simplicity Test:
Before implementing ANY fix, MUST answer:
1. **What existing code am I NOT using that could solve this?**
2. **What can I DELETE instead of adding?**
3. **Can I explain this fix in one sentence?**
4. **Will this fix create new edge cases?** (If yes, find simpler approach)

## Project Overview

The ETF Research Platform is a comprehensive financial analysis application that provides professional-grade tools for researching ETFs and stocks. It features real-time data fetching, advanced portfolio analytics, dividend tracking, and interactive visualizations.

### Tech Stack
- **Backend**: FastAPI (Python) with async/await for high performance
- **Frontend**: Next.js 15.3.5 with React 19, TypeScript, and Tailwind CSS
- **Data Sources**: Multi-source architecture with automatic fallback (YFinance, AlphaVantage, Tiingo, Finnhub, Polygon)
- **Caching**: Dual-mode caching with SQLite (local) and PostgreSQL (production)
- **Deployment**: Vercel-optimized with Docker support

## Architecture & Data Flow

### 1. Multi-Tier Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Gateway    │────▶│  Data Sources   │
│  (Next.js)      │     │   (FastAPI)      │     │  (Multi-Source) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         │                       ▼                         │
         │              ┌──────────────────┐              │
         └─────────────▶│   Cache Layer    │◀─────────────┘
                        │ (SQLite/Postgres)│
                        └──────────────────┘
```

### 2. Data Flow

1. **User Request**: User enters ticker symbols on the frontend
2. **API Call**: Frontend sends POST request to `/api/fetch-data` with tickers and date range
3. **Cache Check**: Backend checks cache for existing data
4. **Gap Detection**: Identifies missing date ranges using intelligent gap detection
5. **Market Calendar**: Filters gaps to only fetch data for trading days
6. **Multi-Source Fetch**: Attempts data fetch from sources in priority order:
   - AlphaVantage (if API key available)
   - Tiingo (if API key available)
   - YFinance (always available, no key required)
   - Finnhub (if API key available)
   - Polygon (if API key available)
7. **Cache Update**: Stores fetched data in cache
8. **Response**: Returns combined cached + fresh data to frontend
9. **Visualization**: Frontend renders interactive charts and analytics

## Caching Strategy

### Intelligent Cache Optimization

The platform uses a sophisticated caching system to minimize API calls:

1. **Date Range Caching**: Stores data by ticker and date range
2. **Gap Detection**: Identifies missing date ranges precisely
3. **Market Calendar Integration**: Only fetches data for actual trading days
4. **Gap Consolidation**: Merges nearby gaps to reduce API calls
5. **Dual Cache Support**:
   - **SQLite**: For local development (no setup required)
   - **PostgreSQL**: For production (better performance)

### Cache Manager Features

```python
# Cache operations in cached_data_fetcher.py
- get_cached_data(ticker, start_date, end_date)
- get_missing_ranges(ticker, start_date, end_date)
- cache_data(ticker, data)
- get_cache_coverage(ticker)
```

## API Endpoints

### Core Endpoints (api/main.py)

1. **`POST /api/fetch-data`**: Fetch historical data for multiple tickers
   - Supports batch operations
   - Intelligent caching
   - Multi-source fallback

2. **`POST /api/calculate-returns`**: Calculate total returns including dividends
   - Dividend reinvestment calculations
   - Accurate total return metrics

3. **`GET /api/dividends/{ticker}`**: Get dividend history
   - Historical dividend payments
   - Yield calculations

4. **`GET /api/data-source-status`**: Check health of all data sources
   - Real-time availability
   - API quota status

## Frontend Components

### Page Structure

1. **Home Page** (`frontend/src/app/page.tsx`):
   - Ticker search with validation
   - Popular ticker shortcuts
   - Multi-ticker portfolio analysis

2. **Stock Detail Page** (`frontend/src/app/stock/[symbol]/page.tsx`):
   - Real-time price data
   - Interactive charts
   - Dividend history
   - Performance metrics

### Key Components

1. **TickerInput** (`components/TickerInput.tsx`):
   - Multi-ticker entry
   - Real-time validation
   - Batch analysis support

2. **StockChart** (`components/StockChart.tsx`):
   - Interactive line charts using @nivo
   - Zoom/pan functionality
   - Mobile-responsive

3. **ResultsDashboard** (`components/ResultsDashboard.tsx`):
   - Tabbed interface
   - Performance metrics
   - Data source health

## 🚀 DEVELOPMENT WORKFLOW (CRITICAL - FOLLOW EXACTLY)

### Complete Development Process:
```
1. Research → Understand the problem deeply using parallel Task agents
2. Plan → Create detailed implementation plan with clear phases
3. Branch → Create feature branch for changes
4. Implement → Make changes following simplicity principles
5. Test → Verify all functionality works
6. Document → Update relevant documentation
7. Commit → Clear commit messages explaining "why" not just "what"
8. Review → Get code review if needed
9. Merge → Create PR when ready
```

### 🎯 Simplicity Filter for External Feedback:
When receiving suggestions from code reviews or AI tools:

**✅ ACCEPT feedback that:**
- Fixes bugs, security vulnerabilities, or crashes
- Prevents common failure cases with minimal code
- Adds essential missing functionality
- Improves UX with simple changes

**❌ REJECT feedback that:**
- Adds "nice to have" features not in scope
- Suggests enterprise patterns for our use case
- Introduces abstraction "for future flexibility"
- Adds complex error handling for rare edge cases
- Suggests performance optimization before problems exist
- Recommends additional complexity without clear benefit

### Working with Claude & AI Agents

**Important**: When launching multiple parallel tasks, always use multiple tool invocations in a single message:
```
⏺ You're right! I should be launching all 5 tasks in a single message with multiple tool invocations. Let me do that now:
```
This allows agents to work in parallel, significantly reducing completion time for complex multi-part tasks.

### GitHub Issue Management

#### Creating Issues:
```bash
gh issue create --title "Title" --body "Description" --label "enhancement"
```

#### Issue Lifecycle:
1. **Created → In Progress**: When starting work
2. **In Progress → Review**: When implementation complete
3. **Review → Closed**: When ALL criteria met and tested

#### NEVER close issues when:
- Code is written but not tested
- Tests are failing
- Implementation is partial
- There are known bugs
- Code isn't committed

### The 5-Line Implementation Test:
Can the core functionality be expressed simply?
```python
# Good: Core ETF data fetch in 5 lines
data = await fetch_from_cache(ticker, start, end)
if gaps := find_missing_ranges(data, start, end):
    fresh_data = await fetch_from_source(ticker, gaps)
    await cache_data(ticker, fresh_data)
return combine_data(data, fresh_data)
```

If it takes more than this to explain the core logic, it's probably over-engineered.

### Local Setup

```bash
# Backend setup
cd etf-research-platform/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install

# Environment variables (create .env.local)
ALPHA_VANTAGE_API_KEY=your_key
TIINGO_API_KEY=your_key
FINNHUB_API_KEY=your_key
POLYGON_API_KEY=your_key
```

### Running Locally

**⚠️ CRITICAL: Always use the dev-server-manager.sh script to avoid port conflicts and zombie processes!**

```bash
# Use the development server manager (RECOMMENDED)
./dev-server-manager.sh status    # Check current server status
./dev-server-manager.sh start     # Start both servers
./dev-server-manager.sh test      # Test all endpoints
./dev-server-manager.sh restart   # Kill and restart all servers

# Manual method (NOT recommended - use only if script fails)
# Terminal 1: Backend
cd api && source venv/bin/activate && python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend  
cd frontend && npm run dev
```

### Development Server Management Best Practices

**🔥 CRITICAL ISSUE**: Servers often fail to start/stop properly, causing port conflicts and zombie processes.

**ALWAYS follow this workflow:**

1. **Before starting work**: `./dev-server-manager.sh status`
2. **Start servers**: `./dev-server-manager.sh start`
3. **Test endpoints**: `./dev-server-manager.sh test`
4. **If issues arise**: `./dev-server-manager.sh restart`
5. **End of session**: `./dev-server-manager.sh kill`

**Server Status Tracking:**
- Backend: Port 8000 (http://localhost:8000/health)
- Frontend: Port 3000 (http://localhost:3000)
- Monte Carlo: http://localhost:3000/monte-carlo

**Common Port Issues:**
- Port 3000: Often used by other Next.js apps
- Port 8000: May have zombie uvicorn processes
- **Solution**: Always use `./dev-server-manager.sh kill` then `start`

**Debugging Server Issues:**
```bash
# Check what's using ports
lsof -i :3000 && lsof -i :3001 && lsof -i :8000

# Check all relevant processes
ps aux | grep -E "(node|uvicorn|python.*main)" | grep -v grep

# Nuclear option - kill all Node.js and Python processes
pkill -f "next dev" && pkill -f "uvicorn.*main"
```

### Testing

```bash
# Backend tests
cd etf-research-platform
python run_tests.py

# Frontend tests
cd frontend
npm test
npm run test:e2e  # Playwright tests
```

## Common Development Tasks

### Adding a New Data Source

1. Create source class in `api/simple_data_sources.py`
2. Implement `fetch_data()` method
3. Add to sources list in `api/main.py`
4. Update documentation

### Adding a New Chart Type

1. Create component in `frontend/src/components/`
2. Import chart library (@nivo recommended)
3. Add to ResultsDashboard tabs
4. Implement responsive design

### Optimizing Performance

1. **Backend**:
   - Use batch fetching for multiple tickers
   - Leverage async/await for concurrent operations
   - Monitor cache hit rates

2. **Frontend**:
   - Lazy load heavy components
   - Use React.memo for chart components
   - Implement virtual scrolling for large datasets

## Production Deployment

### Vercel Deployment

```bash
# Frontend deployment
vercel --prod

# Backend deployment (as serverless function)
# Configure in vercel.json
```

### Environment Variables (Production)

Set in Vercel dashboard:
- `ALPHA_VANTAGE_API_KEY`
- `TIINGO_API_KEY`
- `FINNHUB_API_KEY`
- `POLYGON_API_KEY`
- `DATABASE_URL` (PostgreSQL connection string)

## Troubleshooting

### Common Issues

1. **"No data sources available"**
   - Check API keys in environment variables
   - Verify YFinance is installed: `pip install yfinance`

2. **Cache errors**
   - For local dev: Ensure write permissions for SQLite
   - For production: Check PostgreSQL connection

3. **Slow data fetching**
   - Check cache hit rates in logs
   - Consider pre-populating cache for popular tickers
   - Monitor API rate limits

### Debug Mode

Enable detailed logging:
```python
# In api/main.py
configure_logging(log_level='DEBUG', suppress_expected_errors=False)
```

## Security Considerations

1. **API Keys**: Never commit to repository
2. **Input Validation**: All ticker symbols validated
3. **Rate Limiting**: Implemented per data source
4. **CORS**: Configured for production domains
5. **Error Handling**: Sanitized error messages

## Future Enhancements

1. **Real-time Updates**: WebSocket integration
2. **Advanced Analytics**: Factor models, risk parity
3. **Mobile App**: React Native version
4. **AI Integration**: ML-based predictions
5. **Social Features**: Watchlists, sharing

## Code Quality Standards

1. **Python**: Follow PEP 8, use type hints
2. **TypeScript**: Strict mode enabled
3. **Testing**: Maintain >80% coverage
4. **Documentation**: Update inline comments
5. **Performance**: Profile before optimizing

## Useful Commands

```bash
# Clear cache (development)
rm -rf api/data/cache/*

# Monitor API usage
python monitor_data_sources.py

# Generate performance report
cd frontend && npm run perf:report

# Bundle analysis
npm run build:analyze
```

## 🎯 Project Priorities & Scope Boundaries

### Core Priorities (In Order):
1. **Data Accuracy**: Correct financial data is non-negotiable
2. **Performance**: Fast response times for user interactions
3. **Reliability**: Graceful fallbacks when data sources fail
4. **Simplicity**: Maintainable code over clever solutions

### Scope Boundaries (DO NOT CROSS):
- **NO** elaborate sync resumption (just retry if it fails)
- **NO** vendor abstraction layers until we have 2+ vendors
- **NO** complex monitoring beyond basic logging
- **NO** premature optimization for scale we don't have
- **NO** enterprise features that <80% of users need

### The Priority Question for Every Decision:
**"Does this help users analyze ETFs better?"**
- If NO → Don't build it
- If YES → Build the simplest version that works
- If MAYBE → Wait until users ask for it

## Architecture Decisions

See `DECISIONS.md` for detailed architectural decisions including:
- Why FastAPI over Django
- Multi-source data strategy
- Caching architecture
- Frontend framework choice
- Deployment platform selection

## Summary of Simplicity Principles

1. **Delete before adding** - Most bugs are caused by too much code
2. **Reuse before creating** - Check what already exists
3. **One-line fixes preferred** - Smallest change that works
4. **Explain in one sentence** - If you can't, it's too complex
5. **Filter all feedback** - Accept only what prevents failures or adds essential value