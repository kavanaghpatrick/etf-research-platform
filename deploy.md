# ETF Research Platform - Deployment Guide

## Vercel Deployment

### Prerequisites
1. Install Vercel CLI: `npm i -g vercel`
2. Set up API keys as environment variables in Vercel dashboard

### Environment Variables
Set these in your Vercel project dashboard:

```
ALPHA_VANTAGE_API_KEY=VUVQWE4APFVTVRBD
FINNHUB_API_KEY=d1pqg81r01qku4u42vqgd1pqg81r01qku4u42vr0  
TIINGO_API_KEY=d678fd56fd40967c1c7011997c61e685961a79d3
```

### Deploy Steps
1. `cd frontend`
2. `npm install`
3. `npm run build`
4. `vercel --prod`

### Project Structure
```
/Users/patrickkavanagh/etf-research-platform/
├── api/main.py                    # FastAPI backend (Vercel serverless)
├── frontend/                      # Next.js frontend
├── src/                          # Python data processing core
├── vercel.json                   # Vercel configuration
└── requirements.txt              # Python dependencies
```

### Key Features
- **Hybrid Architecture**: Next.js frontend + FastAPI backend
- **Multi-source Data**: AlphaVantage + Tiingo with intelligent fallback
- **Real-time Processing**: Resilient data fetching with rate limiting
- **Comprehensive UI**: Tabbed dashboard with data visualization

### API Endpoints
- `GET /` - Health check
- `POST /api/data/fetch` - Fetch ticker data
- `GET /api/data/health` - Data source health status

### Frontend Features
- Ticker input with popular suggestions
- Date range selection
- Real-time loading indicators
- Tabbed results dashboard (Overview, Data, Sources, Performance)
- Source health monitoring