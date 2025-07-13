# ETF Research Platform

A comprehensive Python platform for ETF portfolio construction, optimization, and backtesting.

## Features

- **Multi-Source Data Management**: Fetch historical ETF data from multiple sources with automatic fallback
  - Yahoo Finance (primary, no API key required)
  - Alpha Vantage, Finnhub, Tiingo (with API keys)
  - Intelligent caching to minimize API calls
  - Rate limiting and retry logic for reliability
- **Portfolio Construction**: Build portfolios using various strategies (equal weight, market cap weighted, optimized)
- **Optimization**: Modern portfolio theory optimization including minimum variance, maximum Sharpe ratio, and risk parity
- **Backtesting**: Full backtesting engine with transaction costs and rebalancing
- **Analytics**: Comprehensive performance metrics, risk analysis, and correlation studies
- **Visualization**: Generate charts for performance analysis and portfolio insights

## Installation

1. Clone the repository:
```bash
cd etf-research-platform
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Install the package in development mode:
```bash
pip install -e .
```

## Configuration

The platform uses a flexible configuration system. You can:

1. Use the default configuration (no action needed)
2. Create a custom `config/config.yaml` file
3. Set environment variables:
   - `ETF_RISK_FREE_RATE`: Override risk-free rate
   - `ETF_INITIAL_CASH`: Override default initial cash
   - `ETF_COMMISSION`: Override default commission
   - `ETF_CACHE_DIR`: Override cache directory
   - `ETF_LOG_LEVEL`: Set logging level

### Data Source Configuration

The platform supports multiple data sources with automatic fallback:

1. **Yahoo Finance** (yfinance) - Primary source, no API key required
2. **Alpha Vantage** - Set `ALPHA_VANTAGE_API_KEY` environment variable
3. **Finnhub** - Set `FINNHUB_API_KEY` environment variable  
4. **Tiingo** - Set `TIINGO_API_KEY` environment variable

Example:
```bash
export ALPHA_VANTAGE_API_KEY="your_api_key_here"
export FINNHUB_API_KEY="your_api_key_here"
python example_usage.py
```

## Testing

Run the comprehensive test suite:

```bash
# Run all tests with coverage
python run_tests.py

# Or use pytest directly
pytest -v --cov=src --cov-report=html

# Run specific test categories
pytest -m unit  # Unit tests only
pytest -m "not slow"  # Skip slow tests
```

## Quick Start

Run the example script to see the platform in action:

```bash
python example_usage.py
```

This will:
- Fetch data for a diversified set of ETFs
- Run backtests for multiple portfolio strategies
- Generate performance metrics and visualizations
- Save results to CSV files

## Project Structure

```
etf-research-platform/
│
├── src/
│   ├── data/           # Data fetching and caching
│   ├── models/         # Core data models (ETF, Portfolio, Transaction)
│   ├── portfolio/      # Portfolio construction and optimization
│   ├── backtesting/    # Backtesting engine and results
│   ├── analytics/      # Performance metrics and risk analysis
│   ├── visualization/  # Plotting and visualization tools
│   └── utils/          # Configuration, logging, and utilities
│
├── tests/              # Comprehensive test suite
├── config/             # Configuration files
├── example_usage.py    # Example demonstrating platform capabilities
├── run_tests.py        # Test runner script
├── requirements.txt    # Python dependencies
└── setup.py           # Package setup configuration
```

## Usage Examples

### 1. Fetch ETF Data

```python
from data import ETFDataFetcher

fetcher = ETFDataFetcher()
data = fetcher.fetch_etf_data("SPY", "2020-01-01", "2023-12-31")
```

### 2. Create an Optimized Portfolio

```python
from portfolio import PortfolioBuilder

builder = PortfolioBuilder(initial_cash=100000)
portfolio = builder.create_optimized_portfolio(
    name="My Portfolio",
    etf_tickers=["SPY", "AGG", "GLD", "VNQ"],
    optimization_method="max_sharpe",
    start_date="2020-01-01"
)
```

### 3. Run a Backtest

```python
from backtesting import BacktestEngine
from portfolio import MinimumVarianceStrategy

engine = BacktestEngine(initial_cash=100000)
results = engine.run_backtest(
    strategy=MinimumVarianceStrategy(),
    etf_tickers=["SPY", "AGG", "GLD"],
    start_date="2020-01-01",
    end_date="2023-12-31",
    benchmark_ticker="SPY"
)

print(results.generate_report())
```

### 4. Analyze Correlations

```python
from analytics import CorrelationAnalyzer

analyzer = CorrelationAnalyzer(returns_data)
low_corr_pairs = analyzer.find_low_correlation_pairs(max_correlation=0.3)
fig = analyzer.plot_correlation_matrix()
```

## Portfolio Strategies

The platform includes several pre-built strategies:

- **Equal Weight**: Allocates equally across all assets
- **Market Cap Weighted**: Weights by market capitalization
- **Minimum Variance**: Minimizes portfolio volatility
- **Maximum Sharpe**: Maximizes risk-adjusted returns
- **Risk Parity**: Equal risk contribution from each asset
- **Momentum**: Overweights recent top performers
- **Volatility Weighted**: Inverse volatility weighting

## Performance Metrics

The platform calculates comprehensive metrics including:

- Total and annualized returns
- Volatility and Sharpe ratio
- Maximum drawdown and Calmar ratio
- Value at Risk (VaR) and Conditional VaR
- Beta, alpha, and information ratio
- Sortino ratio and Treynor ratio

## Customization

You can easily extend the platform by:

1. Adding new portfolio strategies by inheriting from `PortfolioStrategy`
2. Implementing custom rebalancing logic
3. Adding new data sources
4. Creating custom risk metrics

## Key Improvements

### Recent Enhancements

1. **Comprehensive Testing Suite**
   - Unit tests for all major components
   - Integration tests for workflows
   - Mock support for external APIs
   - Coverage reporting

2. **Configuration Management**
   - YAML-based configuration
   - Environment variable overrides
   - Sensible defaults

3. **Dependency Injection**
   - More testable and flexible architecture
   - Easy to swap implementations
   - Better separation of concerns

4. **Enhanced Robustness**
   - Retry logic for API calls
   - Better error handling
   - Comprehensive logging
   - Data caching

5. **Improved Visualization**
   - Dedicated visualization module
   - Multiple plot types
   - Configurable styling

6. **Multi-Source Data Fetching**
   - Automatic fallback between multiple data providers
   - Built-in rate limiting for each source
   - Batch fetching optimization
   - Resilient to API failures

## Requirements

- Python 3.8+
- See `requirements.txt` for full list of dependencies

## License

This project is provided as-is for educational and research purposes.