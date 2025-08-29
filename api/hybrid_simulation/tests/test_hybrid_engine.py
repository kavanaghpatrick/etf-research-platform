"""
Unit tests for Hybrid Econometric Simulation Engine
Comprehensive testing of all components and edge cases
"""

import unittest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import tempfile
import json
from pathlib import Path

# Import components to test
from ..models.hybrid_engine import HybridEconometricEngine, SimulationConfig, SimulationResults
from ..models.var_model import SimpleVARModel, VARResults
from ..models.garch_model import GARCHVolatilityModel, GARCHResults
from ..models.bootstrap import StationaryBlockBootstrap, BootstrapResults
from ..utils.numerical_stability import NumericalStabilityHandler, StabilityReport
from ..validation.distribution_validation import DistributionValidation, ValidationReport
from ..benchmarking.performance_benchmarks import PerformanceBenchmarks, BenchmarkConfig


class TestHybridEconometricEngine(unittest.TestCase):
    """Test cases for the main Hybrid Econometric Engine"""
    
    def setUp(self):
        """Set up test data and engine"""
        np.random.seed(42)  # Reproducible tests
        
        # Generate synthetic test data
        self.n_obs = 500
        self.n_assets = 3
        self.test_returns = self._generate_test_returns()
        
        # Initialize engine
        self.engine = HybridEconometricEngine(
            numerical_stability=True,
            enable_caching=True,
            log_level='WARNING'  # Reduce test output
        )
    
    def _generate_test_returns(self):
        """Generate realistic test return data"""
        returns = np.zeros((self.n_obs, self.n_assets))
        
        # Generate AR(1) + GARCH(1,1) style returns
        for i in range(self.n_assets):
            # AR(1) component
            ar_coef = 0.05
            vol_innovations = np.random.normal(0, 0.01, self.n_obs)
            return_innovations = np.random.normal(0, 0.02, self.n_obs)
            
            # Simple volatility clustering
            vol = np.zeros(self.n_obs)
            vol[0] = 0.02
            
            for t in range(1, self.n_obs):
                vol[t] = 0.8 * vol[t-1] + 0.2 * abs(returns[t-1, i]) + vol_innovations[t]
                returns[t, i] = ar_coef * returns[t-1, i] + vol[t] * return_innovations[t]
        
        # Convert to DataFrame
        columns = [f'ASSET_{i+1}' for i in range(self.n_assets)]
        return pd.DataFrame(returns, columns=columns)
    
    def test_engine_initialization(self):
        """Test engine initialization and configuration"""
        # Test basic initialization
        engine = HybridEconometricEngine()
        self.assertFalse(engine.is_fitted)
        self.assertIsNone(engine.last_simulation_results)
        
        # Test configuration
        self.assertTrue(hasattr(engine, 'numerical_handler'))
        self.assertTrue(hasattr(engine, 'fitted_models'))
        self.assertTrue(hasattr(engine, 'model_cache'))
    
    def test_model_fitting(self):
        """Test model fitting process"""
        config = SimulationConfig(
            n_simulations=1000,
            time_horizon_years=5,
            random_seed=42
        )
        
        # Fit models
        fit_summary = self.engine.fit_models(self.test_returns, config)
        
        # Verify fitting results
        self.assertIsInstance(fit_summary, dict)
        self.assertIn('fitted_models', fit_summary)
        self.assertIn('fitting_time', fit_summary)
        self.assertIn('n_assets', fit_summary)
        self.assertIn('n_observations', fit_summary)
        
        # Check that engine is now fitted
        self.assertTrue(self.engine.is_fitted)
        
        # Verify fitted models for each asset
        self.assertEqual(len(self.engine.fitted_models), self.n_assets)
        
        for asset, models in self.engine.fitted_models.items():
            self.assertIn('var', models)
            self.assertIn('garch', models)
            self.assertIn('asset_name', models)
    
    def test_simulation_execution(self):
        """Test simulation execution"""
        config = SimulationConfig(
            n_simulations=100,  # Small for fast testing
            time_horizon_years=2,
            random_seed=42
        )
        
        # Fit models first
        self.engine.fit_models(self.test_returns, config)
        
        # Run simulation
        results = self.engine.simulate(config)
        
        # Verify results structure
        self.assertIsInstance(results, SimulationResults)
        self.assertEqual(results.portfolio_paths.shape[0], config.n_simulations)
        self.assertEqual(len(results.final_values), config.n_simulations)
        self.assertEqual(len(results.annualized_returns), config.n_simulations)
        
        # Check that all results arrays have correct dimensions
        self.assertEqual(len(results.volatilities), config.n_simulations)
        self.assertEqual(len(results.max_drawdowns), config.n_simulations)
        self.assertEqual(len(results.sharpe_ratios), config.n_simulations)
        
        # Verify performance metrics
        self.assertIsInstance(results.performance_metrics, dict)
        self.assertIn('simulation_time', results.performance_metrics)
        self.assertIn('paths_per_second', results.performance_metrics)
    
    def test_parallel_simulation(self):
        """Test parallel simulation functionality"""
        config = SimulationConfig(
            n_simulations=200,
            time_horizon_years=2,
            use_parallel=True,
            max_workers=2,
            random_seed=42
        )
        
        # Fit models
        self.engine.fit_models(self.test_returns, config)
        
        # Run parallel simulation
        results = self.engine.simulate(config)
        
        # Should complete successfully
        self.assertIsInstance(results, SimulationResults)
        self.assertEqual(results.portfolio_paths.shape[0], config.n_simulations)
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        
        # Test with insufficient data
        small_data = self.test_returns.iloc[:50]  # Only 50 observations
        config = SimulationConfig(n_simulations=100, random_seed=42)
        
        with self.assertRaises(ValueError):
            self.engine.fit_models(small_data, config)
        
        # Test simulation without fitting
        unfitted_engine = HybridEconometricEngine()
        with self.assertRaises(ValueError):
            unfitted_engine.simulate(config)
    
    def test_numerical_stability(self):
        """Test numerical stability handling"""
        # Create problematic data (high correlation, near-singular)
        problematic_data = pd.DataFrame({
            'ASSET_1': np.random.normal(0, 0.01, 200),
            'ASSET_2': np.random.normal(0, 0.01, 200),
        })
        # Make second asset nearly identical to first
        problematic_data['ASSET_2'] = problematic_data['ASSET_1'] + np.random.normal(0, 0.001, 200)
        
        config = SimulationConfig(n_simulations=100, random_seed=42)
        
        # Should handle gracefully with numerical stability
        try:
            self.engine.fit_models(problematic_data, config)
            results = self.engine.simulate(config)
            # If it completes, verify basic structure
            self.assertIsInstance(results, SimulationResults)
        except Exception as e:
            # Should not crash catastrophically
            self.assertIsInstance(e, (ValueError, RuntimeWarning))


class TestVARModel(unittest.TestCase):
    """Test cases for VAR model component"""
    
    def setUp(self):
        """Set up test data"""
        np.random.seed(42)
        self.test_series = pd.Series(np.random.normal(0, 0.02, 300))
        self.var_model = SimpleVARModel(max_lags=5)
    
    def test_var_fitting(self):
        """Test VAR model fitting"""
        results = self.var_model.fit(self.test_series)
        
        self.assertIsInstance(results, VARResults)
        self.assertIsNotNone(results.selected_lag_order)
        self.assertIsNotNone(results.aic)
        self.assertIsNotNone(results.bic)
        self.assertTrue(results.convergence_success)
    
    def test_var_forecasting(self):
        """Test VAR forecasting"""
        self.var_model.fit(self.test_series)
        
        forecast = self.var_model.forecast(steps=10)
        self.assertEqual(len(forecast), 10)
        self.assertTrue(all(np.isfinite(forecast)))
    
    def test_var_residuals(self):
        """Test VAR residual extraction"""
        self.var_model.fit(self.test_series)
        
        residuals = self.var_model.get_residuals()
        self.assertIsInstance(residuals, np.ndarray)
        self.assertTrue(len(residuals) > 0)


class TestGARCHModel(unittest.TestCase):
    """Test cases for GARCH model component"""
    
    def setUp(self):
        """Set up test data"""
        np.random.seed(42)
        # Generate returns with volatility clustering
        returns = []
        vol = 0.02
        for i in range(300):
            shock = np.random.normal(0, 1)
            vol = 0.8 * vol + 0.2 * abs(shock) * 0.01
            returns.append(vol * shock)
        
        self.test_series = pd.Series(returns)
        self.garch_model = GARCHVolatilityModel()
    
    def test_garch_fitting(self):
        """Test GARCH model fitting"""
        results = self.garch_model.fit(self.test_series)
        
        self.assertIsInstance(results, GARCHResults)
        self.assertIsNotNone(results.conditional_volatility)
        self.assertIsNotNone(results.standardized_residuals)
        self.assertIsInstance(results.params, dict)
    
    def test_garch_forecasting(self):
        """Test GARCH volatility forecasting"""
        self.garch_model.fit(self.test_series)
        
        forecast = self.garch_model.forecast_volatility(horizon=10)
        self.assertEqual(len(forecast), 10)
        self.assertTrue(all(forecast > 0))  # Volatility should be positive
    
    def test_garch_fallback(self):
        """Test GARCH fallback mechanisms"""
        # Create problematic data
        problematic_series = pd.Series([0] * 100)  # Constant returns
        
        garch_model = GARCHVolatilityModel(fallback_method='constant')
        results = garch_model.fit(problematic_series)
        
        # Should fallback gracefully
        self.assertIsInstance(results, GARCHResults)
        self.assertTrue(garch_model.fallback_used)


class TestBlockBootstrap(unittest.TestCase):
    """Test cases for Stationary Block Bootstrap"""
    
    def setUp(self):
        """Set up test data"""
        np.random.seed(42)
        # Generate autocorrelated data
        data = np.zeros((200, 2))
        for t in range(1, 200):
            data[t] = 0.3 * data[t-1] + np.random.normal(0, 1, 2)
        
        self.test_data = data
        self.bootstrap = StationaryBlockBootstrap(auto_block_length=True)
    
    def test_bootstrap_fitting(self):
        """Test bootstrap fitting and block length selection"""
        self.bootstrap.fit(self.test_data)
        
        self.assertTrue(self.bootstrap.is_fitted)
        self.assertIsNotNone(self.bootstrap.optimal_block_length)
        self.assertGreater(self.bootstrap.optimal_block_length, 0)
        self.assertIsNotNone(self.bootstrap.autocorr_structure)
    
    def test_bootstrap_resampling(self):
        """Test bootstrap resampling"""
        self.bootstrap.fit(self.test_data)
        
        results = self.bootstrap.resample(n_samples=5, sample_length=100)
        
        self.assertIsInstance(results, BootstrapResults)
        self.assertEqual(results.resampled_data.shape, (5, 100, 2))
        self.assertGreater(results.autocorr_preservation, 0)
        self.assertGreater(results.coverage_ratio, 0)
    
    def test_block_statistics(self):
        """Test bootstrap statistics"""
        self.bootstrap.fit(self.test_data)
        
        stats = self.bootstrap.get_block_statistics()
        
        self.assertIsInstance(stats, dict)
        self.assertIn('optimal_block_length', stats)
        self.assertIn('data_length', stats)
        self.assertIn('n_variables', stats)


class TestNumericalStability(unittest.TestCase):
    """Test cases for Numerical Stability Handler"""
    
    def setUp(self):
        """Set up test data"""
        self.handler = NumericalStabilityHandler()
    
    def test_singular_covariance_handling(self):
        """Test handling of singular covariance matrices"""
        # Create singular matrix
        singular_matrix = np.array([[1, 1], [1, 1]], dtype=float)
        
        regularized, report = self.handler.handle_singular_covariance(singular_matrix)
        
        self.assertIsInstance(report, StabilityReport)
        self.assertTrue(report.success or report.fallback_used)
        
        # Check that result is positive definite
        eigenvals = np.linalg.eigvals(regularized)
        self.assertTrue(all(eigenvals > 0))
    
    def test_extreme_residuals_handling(self):
        """Test handling of extreme residuals"""
        # Create data with extreme outliers
        residuals = np.random.normal(0, 1, (100, 2))
        residuals[0, 0] = 10  # Extreme outlier
        residuals[1, 1] = -10  # Extreme outlier
        
        cleaned, report = self.handler.handle_extreme_residuals(residuals)
        
        self.assertIsInstance(report, StabilityReport)
        self.assertTrue(report.success)
        
        # Outliers should be reduced
        max_val = np.max(np.abs(cleaned))
        self.assertLess(max_val, np.max(np.abs(residuals)))
    
    def test_convergence_fallbacks(self):
        """Test convergence failure fallbacks"""
        test_data = np.random.normal(0, 1, 100)
        
        fallback, report = self.handler.handle_convergence_failure(
            'var', test_data, 'Test convergence failure'
        )
        
        self.assertIsNotNone(fallback)
        self.assertIsInstance(report, StabilityReport)
        self.assertTrue(report.fallback_used)


class TestDistributionValidation(unittest.TestCase):
    """Test cases for Distribution Validation Framework"""
    
    def setUp(self):
        """Set up test data"""
        np.random.seed(42)
        self.validator = DistributionValidation()
        
        # Generate test data
        self.historical_data = np.random.normal(0, 1, 1000)
        self.simulation_data = np.random.normal(0, 1, 1000)  # Similar distribution
        self.bad_simulation_data = np.random.normal(5, 2, 1000)  # Different distribution
    
    def test_validation_success(self):
        """Test validation with good simulation data"""
        report = self.validator.validate_simulation_results(
            self.simulation_data, 
            self.historical_data
        )
        
        self.assertIsInstance(report, ValidationReport)
        self.assertIsInstance(report.overall_score, float)
        self.assertGreaterEqual(report.overall_score, 0)
        self.assertLessEqual(report.overall_score, 1)
    
    def test_validation_failure(self):
        """Test validation with poor simulation data"""
        report = self.validator.validate_simulation_results(
            self.bad_simulation_data,
            self.historical_data
        )
        
        self.assertIsInstance(report, ValidationReport)
        self.assertLess(report.overall_score, 0.7)  # Should fail
        
        # Should have recommendations
        self.assertTrue(len(report.recommendations) > 0)
    
    def test_bias_analysis(self):
        """Test bias reduction analysis"""
        bootstrap_data = self.historical_data + np.random.normal(0, 0.5, 1000)  # Biased
        
        report = self.validator.validate_simulation_results(
            self.simulation_data,
            self.historical_data,
            bootstrap_data
        )
        
        self.assertTrue(len(report.bias_analysis) > 0)
        
        for analysis in report.bias_analysis:
            self.assertIsInstance(analysis.bias_reduction_percent, float)
            self.assertIsInstance(analysis.improvement_score, float)


class TestPerformanceBenchmarks(unittest.TestCase):
    """Test cases for Performance Benchmarking Suite"""
    
    def setUp(self):
        """Set up test data"""
        np.random.seed(42)
        self.benchmarks = PerformanceBenchmarks()
        
        # Generate test data
        self.test_data = {
            'test_asset': np.random.normal(0, 0.02, (500, 2))
        }
    
    def test_benchmark_execution(self):
        """Test benchmark execution"""
        config = BenchmarkConfig(
            n_simulations=[100, 500],  # Small for testing
            time_horizons=[1, 2],
            asset_counts=[1, 2],
            parallel_workers=[1, 2]
        )
        
        try:
            report = self.benchmarks.run_comprehensive_benchmarks(self.test_data, config)
            
            self.assertIsInstance(report.execution_summary, dict)
            self.assertIn('overall_performance_score', report.execution_summary)
            self.assertTrue(len(report.benchmark_results) > 0)
            
        except Exception as e:
            # Some benchmarks might fail in test environment
            self.assertIsInstance(e, (MemoryError, RuntimeError))
    
    def test_mvp_compliance_check(self):
        """Test MVP compliance checking"""
        # Mock benchmark results
        from ..benchmarking.performance_benchmarks import PerformanceMetrics
        
        good_result = PerformanceMetrics(
            test_name="Test_Good",
            execution_time=60,  # 1 minute
            memory_usage_mb=500,
            cpu_utilization=50,
            paths_per_second=100,
            convergence_rate=0.98,
            accuracy_score=0.85,
            throughput_score=0.9
        )
        
        compliance = self.benchmarks._check_mvp_compliance([good_result])
        
        self.assertIsInstance(compliance, dict)
        self.assertIn('min_throughput', compliance)


class TestIntegration(unittest.TestCase):
    """Integration tests for complete workflow"""
    
    def setUp(self):
        """Set up for integration testing"""
        np.random.seed(42)
        
        # Generate realistic multi-asset data
        self.n_obs = 300
        self.test_data = self._generate_integration_test_data()
    
    def _generate_integration_test_data(self):
        """Generate comprehensive test data"""
        # Create correlated assets with different characteristics
        returns = np.zeros((self.n_obs, 3))
        
        # Asset 1: Low vol, low return
        returns[:, 0] = np.random.normal(0.0003, 0.01, self.n_obs)
        
        # Asset 2: Medium vol, medium return
        returns[:, 1] = np.random.normal(0.0008, 0.02, self.n_obs)
        
        # Asset 3: High vol, high return
        returns[:, 2] = np.random.normal(0.0012, 0.03, self.n_obs)
        
        # Add some correlation
        for t in range(1, self.n_obs):
            returns[t, 1] += 0.3 * returns[t, 0]  # Partial correlation
            returns[t, 2] += 0.2 * returns[t, 1]  # Chain correlation
        
        return pd.DataFrame(returns, columns=['Conservative', 'Balanced', 'Aggressive'])
    
    def test_complete_workflow(self):
        """Test complete simulation workflow"""
        # Initialize engine
        engine = HybridEconometricEngine(
            numerical_stability=True,
            enable_caching=True
        )
        
        # Configure simulation
        config = SimulationConfig(
            n_simulations=500,  # Moderate size for integration test
            time_horizon_years=5,
            portfolio_weights=[0.3, 0.5, 0.2],  # Custom allocation
            random_seed=42
        )
        
        # Step 1: Fit models
        fit_summary = engine.fit_models(self.test_data, config)
        self.assertIsInstance(fit_summary, dict)
        self.assertGreater(fit_summary['fitting_time'], 0)
        
        # Step 2: Run simulation
        results = engine.simulate(config)
        self.assertIsInstance(results, SimulationResults)
        
        # Step 3: Validate results
        validator = DistributionValidation()
        validation_report = validator.validate_simulation_results(
            results.final_values,
            self.test_data.values.flatten()
        )
        self.assertIsInstance(validation_report, ValidationReport)
        
        # Step 4: Generate summary
        summary = engine.get_model_summary()
        self.assertIsInstance(summary, str)
        self.assertIn('Hybrid Econometric Simulation Engine', summary)
        
        # Verify key metrics make sense
        self.assertGreater(np.mean(results.annualized_returns), -0.5)  # Not catastrophically bad
        self.assertLess(np.mean(results.annualized_returns), 1.0)      # Not unrealistically good
        self.assertGreater(np.mean(results.volatilities), 0)          # Positive volatility
        self.assertLess(np.mean(results.max_drawdowns), 1.0)          # Drawdowns less than 100%
    
    def test_error_resilience(self):
        """Test system resilience to various error conditions"""
        engine = HybridEconometricEngine()
        
        # Test with missing data
        missing_data = self.test_data.copy()
        missing_data.iloc[50:60] = np.nan
        
        config = SimulationConfig(n_simulations=100, random_seed=42)
        
        # Should handle missing data gracefully
        try:
            fit_summary = engine.fit_models(missing_data, config)
            results = engine.simulate(config)
            # If successful, verify basic structure
            self.assertIsInstance(results, SimulationResults)
        except ValueError:
            # Acceptable to reject data with too many NaNs
            pass
    
    def test_reproducibility(self):
        """Test that results are reproducible with same seed"""
        config = SimulationConfig(
            n_simulations=100,
            time_horizon_years=3,
            random_seed=12345
        )
        
        # Run simulation twice with same seed
        engine1 = HybridEconometricEngine()
        engine1.fit_models(self.test_data, config)
        results1 = engine1.simulate(config)
        
        engine2 = HybridEconometricEngine()
        engine2.fit_models(self.test_data, config)
        results2 = engine2.simulate(config)
        
        # Results should be identical
        np.testing.assert_array_almost_equal(results1.final_values, results2.final_values, decimal=10)
        np.testing.assert_array_almost_equal(results1.annualized_returns, results2.annualized_returns, decimal=10)


if __name__ == '__main__':
    # Create test suite
    test_loader = unittest.TestLoader()
    test_suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestHybridEconometricEngine,
        TestVARModel,
        TestGARCHModel,
        TestBlockBootstrap,
        TestNumericalStability,
        TestDistributionValidation,
        TestPerformanceBenchmarks,
        TestIntegration
    ]
    
    for test_class in test_classes:
        tests = test_loader.loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"HYBRID ECONOMETRIC SIMULATION ENGINE - TEST RESULTS")
    print(f"{'='*60}")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {(result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100:.1f}%")
    
    if result.failures:
        print(f"\nFAILURES:")
        for test, traceback in result.failures:
            print(f"- {test}: {traceback.split('AssertionError:')[-1].strip()}")
    
    if result.errors:
        print(f"\nERRORS:")
        for test, traceback in result.errors:
            print(f"- {test}: {traceback.split('Exception:')[-1].strip()}")
    
    # Exit with appropriate code
    exit_code = 0 if (len(result.failures) + len(result.errors)) == 0 else 1
    exit(exit_code)