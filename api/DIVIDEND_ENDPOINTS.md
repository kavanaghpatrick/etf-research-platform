# Dividend and Total Return API Endpoints

This document describes the new dividend and total return endpoints added to the ETF Research Platform API.

## Overview

The API now includes comprehensive dividend support with the following features:
- Historical dividend data retrieval
- Total return calculations (with and without dividend reinvestment)
- Dividend yield and metrics analysis
- Dividend calendar predictions
- Multi-ticker dividend comparisons

## Endpoints

### 1. Get Dividend History
```
GET /dividends/{ticker}?years=5
```

Retrieves historical dividend data for a specific ticker.

**Parameters:**
- `ticker` (path): Stock ticker symbol
- `years` (query, optional): Number of years of history (default: 5)

**Response:**
```json
{
  "status": "success",
  "message": "Retrieved 12 dividend records for AAPL",
  "timestamp": "2024-01-15T10:30:00",
  "execution_time": 0.5,
  "data": {
    "ticker": "AAPL",
    "dividends": [
      {
        "ex_date": "2024-01-05",
        "dividend_amount": 0.24,
        "payment_date": "2024-01-12",
        "dividend_type": "regular"
      }
    ],
    "total_dividends": 2.88,
    "dividend_count": 12
  }
}
```

### 2. Get Total Returns
```
GET /returns/{ticker}?start_date=2023-01-01&end_date=2024-01-01&include_reinvestment=false
```

Calculates total returns including dividends for a ticker.

**Parameters:**
- `ticker` (path): Stock ticker symbol
- `start_date` (query): Start date (YYYY-MM-DD)
- `end_date` (query): End date (YYYY-MM-DD)
- `include_reinvestment` (query, optional): Include dividend reinvestment calculation

**Response:**
```json
{
  "status": "success",
  "message": "Total return calculated for AAPL",
  "timestamp": "2024-01-15T10:30:00",
  "execution_time": 1.2,
  "data": {
    "ticker": "AAPL",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "initial_price": 125.07,
    "final_price": 192.53,
    "price_return": 0.5396,
    "dividend_return": 0.0075,
    "total_return": 0.5471,
    "annualized_return": 0.5471,
    "cagr": 0.5471,
    "total_dividends": 0.94,
    "dividend_count": 4,
    "dividend_yield": 0.0075,
    "years": 1.0
  },
  "calculation_type": "simple_total_return"
}
```

### 3. Calculate Custom Returns
```
POST /returns/calculate
```

Calculates custom return scenarios with optional dividend reinvestment.

**Request Body:**
```json
{
  "ticker": "AAPL",
  "start_date": "2023-01-01",
  "end_date": "2024-01-01",
  "include_reinvestment": true,
  "initial_investment": 10000
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Custom return calculation completed for AAPL",
  "timestamp": "2024-01-15T10:30:00",
  "execution_time": 1.5,
  "data": {
    "ticker": "AAPL",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "initial_price": 125.07,
    "final_price": 192.53,
    "price_return": 0.5396,
    "dividend_return": 0.0075,
    "total_return": 0.5471,
    "annualized_return": 0.5471,
    "cagr": 0.5512,
    "total_dividends": 0.94,
    "dividend_count": 4,
    "dividend_yield": 0.0075,
    "years": 1.0,
    "reinvested_value": 15512.45,
    "reinvested_return": 0.5512,
    "comparison": {
      "simple_return": 0.5471,
      "reinvested_return": 0.5512,
      "benefit_of_reinvestment": 0.0041
    }
  },
  "calculation_type": "dividend_reinvested"
}
```

### 4. Get Dividend Calendar (Single Ticker)
```
GET /dividends/calendar/{ticker}?days_ahead=30
```

Gets estimated upcoming dividend dates for a ticker.

**Parameters:**
- `ticker` (path): Stock ticker symbol
- `days_ahead` (query, optional): Days to look ahead (default: 30)

**Response:**
```json
{
  "status": "success",
  "message": "Dividend calendar retrieved for AAPL",
  "timestamp": "2024-01-15T10:30:00",
  "execution_time": 0.8,
  "data": [
    {
      "ticker": "AAPL",
      "estimated_ex_date": "2024-02-05",
      "last_dividend_amount": 0.24,
      "payment_frequency": "Quarterly",
      "last_ex_date": "2023-11-05",
      "confidence": "Estimated"
    }
  ],
  "metadata": {
    "ticker": "AAPL",
    "days_ahead": 30,
    "period_start": "2024-01-15",
    "period_end": "2024-02-14",
    "events_found": 1
  }
}
```

### 5. Get Dividend Calendar (Multiple Tickers)
```
POST /dividends/calendar
```

Gets estimated upcoming dividend dates for multiple tickers.

**Request Body:**
```json
{
  "tickers": ["AAPL", "MSFT", "JNJ", "KO"],
  "days_ahead": 90
}
```

### 6. Get Current Yield and Metrics
```
GET /dividends/yield/{ticker}?years=5
```

Gets current dividend yield and comprehensive metrics.

**Parameters:**
- `ticker` (path): Stock ticker symbol
- `years` (query, optional): Years to analyze (default: 5)

**Response:**
```json
{
  "status": "success",
  "message": "Dividend metrics calculated for AAPL",
  "timestamp": "2024-01-15T10:30:00",
  "execution_time": 1.0,
  "data": {
    "ticker": "AAPL",
    "dividend_paying": true,
    "metrics": {
      "total_dividends": 4.52,
      "dividend_count": 20,
      "ttm_dividends": 0.96,
      "current_yield": 0.0050,
      "average_dividend": 0.226,
      "dividend_growth_rate": 0.05,
      "payment_frequency": "Quarterly",
      "first_dividend_date": "2019-01-15",
      "last_dividend_date": "2024-01-05",
      "yearly_summary": {
        "2023": {"sum": 0.94, "count": 4},
        "2022": {"sum": 0.90, "count": 4},
        "2021": {"sum": 0.86, "count": 4}
      }
    }
  }
}
```

### 7. Enhanced Data Fetch Endpoint
```
POST /data/fetch
```

The existing data fetch endpoint now supports dividend data retrieval.

**Request Body:**
```json
{
  "tickers": ["AAPL", "MSFT"],
  "start_date": "2023-01-01",
  "end_date": "2024-01-01",
  "include_dividends": true
}
```

**Response:** Standard response with additional `dividend_data` field containing dividend information for each ticker.

## Error Handling

All endpoints follow the standard error handling pattern:

- **400 Bad Request**: Invalid parameters or request data
- **404 Not Found**: Ticker not found or no data available
- **500 Internal Server Error**: Server-side processing error
- **503 Service Unavailable**: Total return calculator not initialized

## Authentication

All endpoints inherit the existing authentication and CORS configuration from the main API.

## Rate Limiting

The dividend endpoints use the same rate limiting as other data endpoints. Dividend data is cached to minimize external API calls.

## Integration Notes

1. The total return calculator integrates with the existing cache system
2. Dividend data is stored in separate tables for efficient retrieval
3. All date parameters should be in ISO format (YYYY-MM-DD)
4. Monetary values are returned as floats
5. Percentage returns are returned as decimals (0.10 = 10%)

## Example Usage

### Python
```python
import requests

# Get dividend history
response = requests.get("http://localhost:8000/dividends/AAPL?years=3")
dividend_data = response.json()

# Calculate total return with reinvestment
payload = {
    "ticker": "AAPL",
    "start_date": "2022-01-01",
    "end_date": "2024-01-01",
    "include_reinvestment": True,
    "initial_investment": 10000
}
response = requests.post("http://localhost:8000/returns/calculate", json=payload)
return_data = response.json()
```

### JavaScript
```javascript
// Get dividend yield metrics
fetch('/dividends/yield/AAPL?years=5')
  .then(response => response.json())
  .then(data => console.log(data));

// Get multi-ticker dividend calendar
fetch('/dividends/calendar', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    tickers: ['AAPL', 'MSFT', 'JNJ'],
    days_ahead: 60
  })
})
  .then(response => response.json())
  .then(data => console.log(data));
```