# ETF Research Platform - Deployment Guide

## Quick Start Deployment

### Prerequisites
- Node.js 18+ installed
- Python 3.11+ installed
- Git installed
- GitHub account (for Vercel)
- Credit card (for some hosting services)

## Option 1: Vercel (Frontend) + Railway (Backend) - RECOMMENDED

### Step 1: Deploy Backend to Railway

1. **Create Railway Account**
   ```bash
   # Visit https://railway.app and sign up
   ```

2. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

3. **Deploy Backend**
   ```bash
   cd /Users/patrickkavanagh/etf-research-platform/api
   railway up
   ```

4. **Get your Backend URL**
   - Railway will provide a URL like: `https://your-app.railway.app`
   - Save this URL for the frontend deployment

### Step 2: Deploy Frontend to Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Update Frontend Environment**
   ```bash
   cd /Users/patrickkavanagh/etf-research-platform/frontend
   # Create production env file
   echo "NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app" > .env.production.local
   ```

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```
   - Follow the prompts
   - Select "etf-research-platform" as project name
   - Use default settings

## Option 2: Railway (Full Stack)

1. **Create railway.json in root**
   ```json
   {
     "build": {
       "builder": "NIXPACKS"
     },
     "deploy": {
       "numReplicas": 1,
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

2. **Deploy Both Services**
   ```bash
   cd /Users/patrickkavanagh/etf-research-platform
   railway up
   ```

## Option 3: Docker Deployment (VPS)

### For DigitalOcean, AWS, or any VPS:

1. **Build Images**
   ```bash
   # Backend
   cd /Users/patrickkavanagh/etf-research-platform/api
   docker build -t etf-backend .
   
   # Frontend
   cd /Users/patrickkavanagh/etf-research-platform/frontend
   docker build -t etf-frontend .
   ```

2. **Run with Docker Compose**
   ```bash
   cd /Users/patrickkavanagh/etf-research-platform
   docker-compose up -d
   ```

## Environment Variables

### Backend (.env)
```env
# Data source API keys (optional - will use free tiers if not provided)
ALPHA_VANTAGE_API_KEY=your_key_here
TIINGO_API_KEY=your_key_here
FINNHUB_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
```

### Frontend (.env.production.local)
```env
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
NEXT_PUBLIC_API_TIMEOUT=10000
NEXT_PUBLIC_API_CACHE_DURATION=300000
NEXT_PUBLIC_API_MAX_RETRIES=3
NEXT_PUBLIC_API_DEBOUNCE_DELAY=300

# Optional: Sentry
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

## Post-Deployment Checklist

1. **Test the Application**
   - Visit your frontend URL
   - Try searching for stocks (SPY, AAPL, etc.)
   - Check the stock detail pages
   - Test dividend analysis

2. **Monitor Performance**
   - Check browser console for errors
   - Monitor API response times
   - Verify caching is working

3. **Security Verification**
   - Ensure HTTPS is enabled
   - Check security headers in browser
   - Verify API rate limiting

## Troubleshooting

### Frontend can't connect to backend
- Check CORS settings in backend
- Verify API_BASE_URL is correct
- Ensure backend is running

### Slow API responses
- Backend may be cold starting
- Check if free tier limits are hit
- Consider upgrading hosting plan

### Build failures
- Clear cache and rebuild
- Check Node/Python versions
- Review error logs

## Recommended Production Setup

1. **Frontend**: Vercel (free tier works well)
2. **Backend**: Railway ($5/month starter)
3. **Database**: PostgreSQL on Railway (included)
4. **Monitoring**: Sentry (free tier)

## Support

For issues, check:
- Frontend logs: Vercel dashboard
- Backend logs: Railway dashboard
- API health: https://your-backend.com/health

## Quick Deploy Commands

```bash
# One-line frontend deploy (after backend is live)
cd frontend && echo "NEXT_PUBLIC_API_BASE_URL=https://your-backend.railway.app" > .env.production.local && vercel --prod

# One-line backend deploy
cd api && railway up
```