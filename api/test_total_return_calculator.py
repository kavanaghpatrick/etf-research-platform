"""
Test suite for Total Return Calculator
Demonstrates all features and validates calculations
"""

import logging
import json
from datetime import date, timedelta
from total_return_calculator import TotalReturnCalculator, TotalReturnMetrics
import pandas as pd


def setup_logging():
    """Configure logging for tests"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


def test_simple_total_return(calculator, logger):
    """Test simple total return calculation"""
    logger.info("\n" + "="*50)
    logger.info("TEST 1: Simple Total Return Calculation")
    logger.info("="*50)
    
    # Test with a dividend-paying stock
    ticker = 'JNJ'  # Johnson & Johnson - consistent dividend payer
    start_date = '2022-01-01'
    end_date = '2023-12-31'
    
    logger.info(f"Calculating total return for {ticker} from {start_date} to {end_date}")
    
    try:
        metrics = calculator.calculate_simple_total_return(ticker, start_date, end_date)
        
        logger.info("\nResults:")
        logger.info(f"Initial Price: ${metrics.initial_price:.2f}")
        logger.info(f"Final Price: ${metrics.final_price:.2f}")
        logger.info(f"Price Return: {metrics.price_return:.2%}")
        logger.info(f"Dividend Return: {metrics.dividend_return:.2%}")
        logger.info(f"Total Return: {metrics.total_return:.2%}")
        logger.info(f"Annualized Return: {metrics.annualized_return:.2%}")
        logger.info(f"Total Dividends: ${metrics.total_dividends:.2f}")
        logger.info(f"Dividend Count: {metrics.dividend_count}")
        logger.info(f"Average Dividend Yield: {metrics.dividend_yield:.2%}")
        
        # Export as JSON
        json_output = calculator.export_results(metrics, format='json')
        logger.info(f"\nJSON Output:\n{json_output}")
        
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        return False


def test_dividend_reinvestment(calculator, logger):
    """Test dividend reinvestment calculations"""
    logger.info("\n" + "="*50)
    logger.info("TEST 2: Dividend Reinvestment Calculation")
    logger.info("="*50)
    
    ticker = 'KO'  # Coca-Cola - steady dividend payer
    start_date = '2021-01-01'
    end_date = '2023-12-31'
    initial_investment = 10000
    
    logger.info(f"Calculating dividend reinvested return for {ticker}")
    logger.info(f"Initial Investment: ${initial_investment:,.2f}")
    logger.info(f"Period: {start_date} to {end_date}")
    
    try:
        metrics = calculator.calculate_dividend_reinvested_return(
            ticker, start_date, end_date, initial_investment
        )
        
        logger.info("\nResults:")
        logger.info(f"Simple Total Return: {metrics.total_return:.2%}")
        logger.info(f"Reinvested Return: {metrics.reinvested_return:.2%}")
        logger.info(f"Final Value (with reinvestment): ${metrics.reinvested_value:,.2f}")
        logger.info(f"CAGR: {metrics.cagr:.2%}")
        logger.info(f"Total Dividends Received: ${metrics.total_dividends * (initial_investment / metrics.initial_price):.2f}")
        
        # Calculate the difference
        simple_value = initial_investment * (1 + metrics.total_return)
        reinvest_benefit = metrics.reinvested_value - simple_value
        logger.info(f"\nReinvestment Benefit: ${reinvest_benefit:,.2f}")
        logger.info(f"Additional Return from Reinvestment: {(metrics.reinvested_return - metrics.total_return):.2%}")
        
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        return False


def test_year_over_year_returns(calculator, logger):
    """Test year-over-year return calculations"""
    logger.info("\n" + "="*50)
    logger.info("TEST 3: Year-over-Year Returns")
    logger.info("="*50)
    
    ticker = 'AAPL'
    years = 3
    
    logger.info(f"Calculating {years}-year returns for {ticker}")
    
    try:
        yoy_returns = calculator.calculate_year_over_year_returns(ticker, years)
        
        if not yoy_returns.empty:
            logger.info("\nYear-over-Year Returns:")
            for _, row in yoy_returns.iterrows():
                logger.info(f"\nYear {row['year']}:")
                logger.info(f"  Price Return: {row['price_return']:.2%}")
                logger.info(f"  Dividend Return: {row['dividend_return']:.2%}")
                logger.info(f"  Total Return: {row['total_return']:.2%}")
                logger.info(f"  Dividends: ${row['total_dividends']:.2f} ({row['dividend_count']} payments)")
            
            # Calculate average returns
            avg_price_return = yoy_returns['price_return'].mean()
            avg_dividend_return = yoy_returns['dividend_return'].mean()
            avg_total_return = yoy_returns['total_return'].mean()
            
            logger.info(f"\nAverage Annual Returns ({years} years):")
            logger.info(f"  Price Return: {avg_price_return:.2%}")
            logger.info(f"  Dividend Return: {avg_dividend_return:.2%}")
            logger.info(f"  Total Return: {avg_total_return:.2%}")
            
            # Export as DataFrame
            logger.info("\nDataFrame Output:")
            logger.info(yoy_returns.to_string())
            
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        return False


def test_dividend_metrics(calculator, logger):
    """Test comprehensive dividend metrics"""
    logger.info("\n" + "="*50)
    logger.info("TEST 4: Dividend Metrics Analysis")
    logger.info("="*50)
    
    # Test multiple dividend-paying stocks
    tickers = ['T', 'VZ', 'PFE']  # AT&T, Verizon, Pfizer
    years = 5
    
    for ticker in tickers:
        logger.info(f"\nAnalyzing dividend metrics for {ticker} ({years} years)")
        
        try:
            metrics = calculator.calculate_dividend_metrics(ticker, years)
            
            if metrics.get('dividend_paying'):
                div_metrics = metrics['metrics']
                logger.info(f"  Total Dividends: ${div_metrics['total_dividends']:.2f}")
                logger.info(f"  TTM Dividends: ${div_metrics['ttm_dividends']:.2f}")
                logger.info(f"  Current Yield: {div_metrics.get('current_yield', 0):.2%}")
                logger.info(f"  Payment Frequency: {div_metrics['payment_frequency']}")
                logger.info(f"  Dividend Growth Rate: {div_metrics['dividend_growth_rate']:.2%}")
                logger.info(f"  Average Dividend: ${div_metrics['average_dividend']:.2f}")
                
                # Show yearly summary
                yearly = div_metrics['yearly_summary']
                if yearly:
                    logger.info("  Yearly Dividends:")
                    for year, data in yearly.items():
                        if isinstance(data, dict):
                            logger.info(f"    {year}: ${data.get('sum', 0):.2f} ({data.get('count', 0)} payments)")
            else:
                logger.info("  Stock does not pay dividends")
                
        except Exception as e:
            logger.error(f"  Failed to analyze {ticker}: {e}")
    
    return True


def test_dividend_calendar(calculator, logger):
    """Test dividend calendar functionality"""
    logger.info("\n" + "="*50)
    logger.info("TEST 5: Dividend Calendar")
    logger.info("="*50)
    
    # High-yield dividend stocks
    tickers = ['JNJ', 'PG', 'MMM', 'ABBV', 'PEP']
    days_ahead = 90
    
    logger.info(f"Creating dividend calendar for next {days_ahead} days")
    logger.info(f"Stocks: {', '.join(tickers)}")
    
    try:
        calendar = calculator.get_dividend_calendar(tickers, days_ahead)
        
        if not calendar.empty:
            logger.info(f"\nFound {len(calendar)} estimated dividend dates:")
            
            for _, row in calendar.iterrows():
                logger.info(f"\n{row['ticker']}:")
                logger.info(f"  Estimated Ex-Date: {row['estimated_ex_date'].strftime('%Y-%m-%d')}")
                logger.info(f"  Last Dividend: ${row['last_dividend_amount']:.2f}")
                logger.info(f"  Frequency: {row['payment_frequency']}")
                logger.info(f"  Last Ex-Date: {row['last_ex_date'].strftime('%Y-%m-%d')}")
            
            # Export as JSON
            json_calendar = calculator.export_results(calendar, format='json')
            logger.info(f"\nJSON Calendar:\n{json_calendar}")
            
        else:
            logger.info("No upcoming dividends found")
            
        return True
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        return False


def test_multiple_scenarios(calculator, logger):
    """Test various edge cases and scenarios"""
    logger.info("\n" + "="*50)
    logger.info("TEST 6: Multiple Scenarios")
    logger.info("="*50)
    
    # Scenario 1: Non-dividend paying stock
    logger.info("\nScenario 1: Non-dividend paying stock (TSLA)")
    try:
        metrics = calculator.calculate_simple_total_return('TSLA', '2022-01-01', '2023-01-01')
        logger.info(f"  Price Return: {metrics.price_return:.2%}")
        logger.info(f"  Dividend Return: {metrics.dividend_return:.2%} (should be 0)")
        logger.info(f"  Total Return: {metrics.total_return:.2%}")
    except Exception as e:
        logger.error(f"  Failed: {e}")
    
    # Scenario 2: Very short time period
    logger.info("\nScenario 2: Short time period (1 month)")
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=30)
        metrics = calculator.calculate_simple_total_return('MSFT', start_date, end_date)
        logger.info(f"  Period: {start_date} to {end_date}")
        logger.info(f"  Total Return: {metrics.total_return:.2%}")
        logger.info(f"  Annualized Return: {metrics.annualized_return:.2%}")
    except Exception as e:
        logger.error(f"  Failed: {e}")
    
    # Scenario 3: High dividend yield stock
    logger.info("\nScenario 3: High dividend yield stock (ABBV)")
    try:
        metrics = calculator.calculate_simple_total_return('ABBV', '2023-01-01', '2024-01-01')
        logger.info(f"  Price Return: {metrics.price_return:.2%}")
        logger.info(f"  Dividend Return: {metrics.dividend_return:.2%}")
        logger.info(f"  Dividend Yield: {metrics.dividend_yield:.2%}")
    except Exception as e:
        logger.error(f"  Failed: {e}")
    
    return True


def test_cache_functionality(calculator, logger):
    """Test caching functionality"""
    logger.info("\n" + "="*50)
    logger.info("TEST 7: Cache Functionality")
    logger.info("="*50)
    
    # Get cache statistics
    cache_stats = calculator.get_cache_stats()
    
    logger.info("Cache Statistics:")
    for key, value in cache_stats.items():
        logger.info(f"  {key}: {value}")
    
    # Test cache hit by requesting same data twice
    ticker = 'IBM'
    start_date = '2023-01-01'
    end_date = '2023-12-31'
    
    logger.info(f"\nTesting cache hit for {ticker}")
    
    # First request (cache miss)
    logger.info("First request (should fetch from source)...")
    metrics1 = calculator.calculate_simple_total_return(ticker, start_date, end_date)
    
    # Second request (cache hit)
    logger.info("Second request (should use cache)...")
    metrics2 = calculator.calculate_simple_total_return(ticker, start_date, end_date)
    
    # Verify results are identical
    logger.info(f"Results match: {metrics1.total_return == metrics2.total_return}")
    
    # Get updated cache stats
    new_cache_stats = calculator.get_cache_stats()
    logger.info("\nUpdated Cache Statistics:")
    for key, value in new_cache_stats.items():
        logger.info(f"  {key}: {value}")
    
    return True


def run_all_tests():
    """Run all tests"""
    logger = setup_logging()
    
    logger.info("Starting Total Return Calculator Test Suite")
    logger.info("="*60)
    
    # Initialize calculator
    calculator = TotalReturnCalculator()
    
    # Run tests
    tests = [
        ("Simple Total Return", test_simple_total_return),
        ("Dividend Reinvestment", test_dividend_reinvestment),
        ("Year-over-Year Returns", test_year_over_year_returns),
        ("Dividend Metrics", test_dividend_metrics),
        ("Dividend Calendar", test_dividend_calendar),
        ("Multiple Scenarios", test_multiple_scenarios),
        ("Cache Functionality", test_cache_functionality)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            success = test_func(calculator, logger)
            results.append((test_name, success))
        except Exception as e:
            logger.error(f"Test {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Summary
    logger.info("\n" + "="*60)
    logger.info("TEST SUMMARY")
    logger.info("="*60)
    
    passed = sum(1 for _, success in results if success)
    total = len(results)
    
    for test_name, success in results:
        status = "PASSED" if success else "FAILED"
        logger.info(f"{test_name}: {status}")
    
    logger.info(f"\nTotal: {passed}/{total} tests passed")
    
    # Clean up
    calculator.close()
    
    return passed == total


if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)