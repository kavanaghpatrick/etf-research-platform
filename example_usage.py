#!/usr/bin/env python3
"""
Example usage of the ETF Research Platform
"""

from datetime import datetime, timedelta
import pandas as pd
import matplotlib.pyplot as plt
import os

# Import our modules
from src.data import ETFDataFetcher, ResilientDataFetcher
from src.portfolio import PortfolioBuilder, EqualWeightStrategy, MinimumVarianceStrategy, MaxSharpeStrategy
from src.backtesting import BacktestEngine
from src.analytics import PerformanceMetrics, RiskAnalyzer, CorrelationAnalyzer
from src.visualization import PortfolioPlotter
from src.utils import Config, load_config, setup_logging


def main():
    # Set up logging
    setup_logging()
    # Set up parameters
    start_date = "2020-01-01"
    end_date = "2023-12-31"
    initial_cash = 100000
    
    # Define ETFs to analyze - diversified portfolio
    etf_tickers = [
        "SPY",  # S&P 500
        "QQQ",  # Nasdaq 100
        "IWM",  # Russell 2000
        "EFA",  # International Developed Markets
        "EEM",  # Emerging Markets
        "AGG",  # US Bonds
        "GLD",  # Gold
        "VNQ",  # Real Estate
    ]
    
    print("ETF Research Platform - Example Usage")
    print("=" * 50)
    print(f"Analysis Period: {start_date} to {end_date}")
    print(f"Initial Capital: ${initial_cash:,}")
    print(f"ETFs: {', '.join(etf_tickers)}")
    print()
    
    # 1. Fetch ETF Data
    print("1. Fetching ETF data...")
    # Use resilient fetcher for better reliability
    if os.environ.get("USE_RESILIENT_FETCHER", "true").lower() == "true":
        print("   Using resilient multi-source fetcher")
        resilient_fetcher = ResilientDataFetcher()
        fetcher = ETFDataFetcher(
            cache=resilient_fetcher.cache,
            config=resilient_fetcher.config
        )
        # Show available sources
        print(f"   Available sources: {fetcher.get_available_sources()}")
    else:
        fetcher = ETFDataFetcher()
    
    etf_data = fetcher.fetch_multiple_etfs(etf_tickers, start_date, end_date)
    
    # Calculate returns
    returns_data = pd.DataFrame()
    for ticker, data in etf_data.items():
        if not data.empty:
            returns_data[ticker] = data["Close"].pct_change()
    returns_data = returns_data.dropna()
    
    print(f"   Data fetched for {len(etf_data)} ETFs")
    print(f"   Total trading days: {len(returns_data)}")
    print()
    
    # 2. Correlation Analysis
    print("2. Analyzing correlations...")
    corr_analyzer = CorrelationAnalyzer(returns_data)
    correlation_matrix = corr_analyzer.calculate_correlation_matrix()
    
    # Find diversification opportunities
    low_corr_pairs = corr_analyzer.find_low_correlation_pairs(max_correlation=0.3)
    print(f"   Found {len(low_corr_pairs)} low-correlation pairs:")
    for ticker1, ticker2, corr in low_corr_pairs[:5]:
        print(f"   - {ticker1} vs {ticker2}: {corr:.3f}")
    print()
    
    # 3. Portfolio Construction
    print("3. Constructing portfolios...")
    builder = PortfolioBuilder(initial_cash)
    
    # Create different portfolio strategies
    strategies = {
        "Equal Weight": EqualWeightStrategy(),
        "Minimum Variance": MinimumVarianceStrategy(),
        "Maximum Sharpe": MaxSharpeStrategy(),
    }
    
    # 4. Backtesting
    print("4. Running backtests...")
    engine = BacktestEngine(
        initial_cash=initial_cash,
        commission=5.0,  # $5 per trade
        rebalance_frequency="monthly"
    )
    
    # Run backtests for each strategy
    results = {}
    for name, strategy in strategies.items():
        print(f"   Backtesting {name} strategy...")
        result = engine.run_backtest(
            strategy=strategy,
            etf_tickers=etf_tickers,
            start_date=start_date,
            end_date=end_date,
            benchmark_ticker="SPY"
        )
        results[name] = result
    
    # 5. Performance Analysis
    print("\n5. Performance Summary:")
    print("-" * 80)
    print(f"{'Strategy':<20} {'Total Return':<15} {'Annual Return':<15} {'Volatility':<15} {'Sharpe Ratio':<15}")
    print("-" * 80)
    
    for name, result in results.items():
        metrics = result.calculate_metrics()
        print(f"{name:<20} {metrics['total_return']:>14.2f}% {metrics['annualized_return']:>14.2f}% "
              f"{metrics['volatility']:>14.2f}% {metrics['sharpe_ratio']:>14.2f}")
    
    print("-" * 80)
    
    # 6. Risk Analysis
    print("\n6. Risk Analysis (Maximum Sharpe Portfolio):")
    max_sharpe_result = results["Maximum Sharpe"]
    final_weights = max_sharpe_result.final_portfolio.get_weights()
    
    # Filter out cash and normalize
    asset_weights = {k: v for k, v in final_weights.items() if k != "CASH"}
    total_weight = sum(asset_weights.values())
    if total_weight > 0:
        asset_weights = {k: v/total_weight for k, v in asset_weights.items()}
    
    risk_analyzer = RiskAnalyzer(returns_data)
    risk_contributions = risk_analyzer.risk_contribution(asset_weights)
    
    # Use configuration for risk-free rate
    config = load_config()
    
    print(f"   Portfolio Volatility: {risk_analyzer.calculate_portfolio_risk(asset_weights)*100*252**0.5:.2f}%")
    print(f"   VaR (95%): {risk_analyzer.calculate_var_historical(asset_weights, config.analytics.confidence_level)*100:.2f}%")
    print(f"   CVaR (95%): {risk_analyzer.calculate_cvar(asset_weights, config.analytics.confidence_level)*100:.2f}%")
    print()
    
    # 7. Generate visualizations
    print("7. Generating visualizations...")
    
    # Create plotter instance
    plotter = PortfolioPlotter()
    
    # Generate comprehensive comparison plot
    plotter.plot_backtest_comparison(
        results,
        etf_data=etf_data,
        save_path="etf_analysis_results.png"
    )
    
    # Generate correlation analysis plot
    plotter.plot_correlation_analysis(
        corr_analyzer,
        save_path="correlation_analysis.png"
    )
    
    # Save all plots to output directory
    plotter.save_all_plots(results, corr_analyzer)
    
    print("   Saved visualizations to output/plots/")
    
    # 8. Generate detailed report
    print("\n8. Detailed Report for Maximum Sharpe Portfolio:")
    print(max_sharpe_result.generate_report())
    
    # Save results to CSV
    print("\n9. Saving results to CSV...")
    
    # Portfolio values
    portfolio_values_df = pd.DataFrame()
    for name, result in results.items():
        portfolio_values_df[name] = result.portfolio_values["total_value"]
    portfolio_values_df.to_csv("portfolio_values.csv")
    print("   Saved portfolio values to 'portfolio_values.csv'")
    
    # Performance metrics
    metrics_df = pd.DataFrame()
    for name, result in results.items():
        metrics_df[name] = pd.Series(result.calculate_metrics())
    metrics_df.T.to_csv("performance_metrics.csv")
    print("   Saved performance metrics to 'performance_metrics.csv'")
    
    print("\nAnalysis complete!")


if __name__ == "__main__":
    main()