"""
Distribution Validation Framework for Hybrid Econometric Simulation Engine
Validates statistical properties and bias reduction compared to original bootstrap
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import logging
from scipy import stats
from scipy.stats import kstest, jarque_bera, normaltest
import warnings

warnings.filterwarnings('ignore', category=RuntimeWarning)

logger = logging.getLogger(__name__)


@dataclass
class ValidationResults:
    """Results from distribution validation tests"""
    test_name: str
    test_statistic: float
    p_value: float
    critical_value: Optional[float]
    passed: bool
    details: Dict[str, Any]


@dataclass
class BiasAnalysis:
    """Analysis of bias reduction in hybrid engine vs original bootstrap"""
    metric: str
    original_bootstrap_value: float
    hybrid_engine_value: float
    historical_target: float
    bias_reduction_percent: float
    improvement_score: float


@dataclass
class ValidationReport:
    """Comprehensive validation report"""
    validation_tests: List[ValidationResults]
    bias_analysis: List[BiasAnalysis]
    moment_matching: Dict[str, ValidationResults]
    distributional_tests: Dict[str, ValidationResults]
    overall_score: float
    passed_validation: bool
    recommendations: List[str]


class DistributionValidation:
    """
    Comprehensive validation framework for hybrid econometric simulation
    
    Features:
    - Kolmogorov-Smirnov tests for distribution matching
    - Moment matching validation (mean, variance, skewness, kurtosis)
    - Bias reduction analysis vs original bootstrap method
    - Statistical significance testing
    - Performance benchmarking
    """
    
    def __init__(self,
                 significance_level: float = 0.05,
                 bias_reduction_threshold: float = 0.1,
                 moment_tolerance: float = 0.05):
        """
        Initialize validation framework
        
        Args:
            significance_level: Alpha level for statistical tests
            bias_reduction_threshold: Minimum bias reduction to pass validation
            moment_tolerance: Tolerance for moment matching (as fraction)
        """
        self.significance_level = significance_level
        self.bias_reduction_threshold = bias_reduction_threshold
        self.moment_tolerance = moment_tolerance
        
        logger.info("Initialized Distribution Validation Framework")
    
    def validate_simulation_results(self,
                                    hybrid_results: np.ndarray,
                                    historical_data: np.ndarray,
                                    bootstrap_results: Optional[np.ndarray] = None) -> ValidationReport:
        """
        Comprehensive validation of simulation results
        
        Args:
            hybrid_results: Results from hybrid econometric engine
            historical_data: Original historical data for comparison
            bootstrap_results: Original bootstrap results for bias analysis
            
        Returns:
            ValidationReport with detailed analysis
        """
        logger.info("Starting comprehensive validation of simulation results")
        
        validation_tests = []
        bias_analysis = []
        moment_matching = {}
        distributional_tests = {}
        
        # 1. Distribution matching tests
        ks_test = self._kolmogorov_smirnov_test(hybrid_results, historical_data)
        distributional_tests['kolmogorov_smirnov'] = ks_test
        validation_tests.append(ks_test)
        
        # 2. Moment matching validation
        moment_tests = self._validate_moment_matching(hybrid_results, historical_data)
        moment_matching.update(moment_tests)
        validation_tests.extend(moment_tests.values())
        
        # 3. Normality tests
        normality_test = self._test_residual_normality(hybrid_results)
        distributional_tests['normality'] = normality_test
        validation_tests.append(normality_test)
        
        # 4. Bias reduction analysis (if bootstrap results provided)
        if bootstrap_results is not None:
            bias_analysis = self._analyze_bias_reduction(
                hybrid_results, bootstrap_results, historical_data
            )
        
        # 5. Overall assessment
        overall_score = self._calculate_overall_score(validation_tests, bias_analysis)
        passed_validation = overall_score >= 0.7  # 70% threshold
        
        # 6. Generate recommendations
        recommendations = self._generate_recommendations(
            validation_tests, bias_analysis, overall_score
        )
        
        return ValidationReport(
            validation_tests=validation_tests,
            bias_analysis=bias_analysis,
            moment_matching=moment_matching,
            distributional_tests=distributional_tests,
            overall_score=overall_score,
            passed_validation=passed_validation,
            recommendations=recommendations
        )
    
    def _kolmogorov_smirnov_test(self,
                                 simulation_data: np.ndarray,
                                 historical_data: np.ndarray) -> ValidationResults:
        """Kolmogorov-Smirnov test for distribution matching"""
        
        try:
            # Flatten arrays if multidimensional
            if simulation_data.ndim > 1:
                sim_flat = simulation_data.flatten()
            else:
                sim_flat = simulation_data
                
            if historical_data.ndim > 1:
                hist_flat = historical_data.flatten()
            else:
                hist_flat = historical_data
            
            # Remove any infinite or NaN values
            sim_clean = sim_flat[np.isfinite(sim_flat)]
            hist_clean = hist_flat[np.isfinite(hist_flat)]
            
            # Perform two-sample KS test
            ks_statistic, p_value = stats.ks_2samp(sim_clean, hist_clean)
            
            # Critical value for KS test
            n1, n2 = len(sim_clean), len(hist_clean)
            critical_value = stats.kstwo.ppf(1 - self.significance_level, n1 + n2)
            
            passed = p_value > self.significance_level
            
            details = {
                'test_type': 'two_sample_ks',
                'sample_sizes': (n1, n2),
                'null_hypothesis': 'Distributions are identical',
                'interpretation': 'PASS: Distributions match' if passed else 'FAIL: Distributions differ significantly'
            }
            
            return ValidationResults(
                test_name="Kolmogorov-Smirnov Distribution Test",
                test_statistic=ks_statistic,
                p_value=p_value,
                critical_value=critical_value,
                passed=passed,
                details=details
            )
            
        except Exception as e:
            logger.error(f"KS test failed: {e}")
            return ValidationResults(
                test_name="Kolmogorov-Smirnov Distribution Test",
                test_statistic=np.nan,
                p_value=np.nan,
                critical_value=np.nan,
                passed=False,
                details={'error': str(e)}
            )
    
    def _validate_moment_matching(self,
                                  simulation_data: np.ndarray,
                                  historical_data: np.ndarray) -> Dict[str, ValidationResults]:
        """Validate moment matching between simulation and historical data"""
        
        moment_tests = {}
        
        try:
            # Calculate moments for both datasets
            sim_moments = self._calculate_moments(simulation_data)
            hist_moments = self._calculate_moments(historical_data)
            
            moment_names = ['mean', 'variance', 'skewness', 'kurtosis']
            
            for i, moment_name in enumerate(moment_names):
                sim_val = sim_moments[i]
                hist_val = hist_moments[i]
                
                # Calculate relative difference
                if abs(hist_val) > 1e-10:
                    relative_diff = abs((sim_val - hist_val) / hist_val)
                else:
                    relative_diff = abs(sim_val)
                
                passed = relative_diff <= self.moment_tolerance
                
                details = {
                    'simulation_value': sim_val,
                    'historical_value': hist_val,
                    'relative_difference': relative_diff,
                    'tolerance': self.moment_tolerance,
                    'interpretation': f'PASS: Moment matches within tolerance' if passed else f'FAIL: Moment differs by {relative_diff:.3f}'
                }
                
                moment_tests[f'{moment_name}_matching'] = ValidationResults(
                    test_name=f"{moment_name.capitalize()} Matching Test",
                    test_statistic=relative_diff,
                    p_value=1.0 - relative_diff if relative_diff <= 1 else 0.0,  # Pseudo p-value
                    critical_value=self.moment_tolerance,
                    passed=passed,
                    details=details
                )
        
        except Exception as e:
            logger.error(f"Moment matching validation failed: {e}")
            for moment_name in ['mean', 'variance', 'skewness', 'kurtosis']:
                moment_tests[f'{moment_name}_matching'] = ValidationResults(
                    test_name=f"{moment_name.capitalize()} Matching Test",
                    test_statistic=np.nan,
                    p_value=np.nan,
                    critical_value=np.nan,
                    passed=False,
                    details={'error': str(e)}
                )
        
        return moment_tests
    
    def _test_residual_normality(self, simulation_data: np.ndarray) -> ValidationResults:
        """Test normality of residuals/simulation data"""
        
        try:
            # Flatten data if multidimensional
            if simulation_data.ndim > 1:
                data_flat = simulation_data.flatten()
            else:
                data_flat = simulation_data
            
            # Remove infinite/NaN values
            data_clean = data_flat[np.isfinite(data_flat)]
            
            if len(data_clean) < 20:
                return ValidationResults(
                    test_name="Normality Test",
                    test_statistic=np.nan,
                    p_value=np.nan,
                    critical_value=np.nan,
                    passed=False,
                    details={'error': 'Insufficient data for normality test'}
                )
            
            # Jarque-Bera test for normality
            jb_statistic, p_value = jarque_bera(data_clean)
            
            passed = p_value > self.significance_level
            
            details = {
                'test_type': 'jarque_bera',
                'sample_size': len(data_clean),
                'null_hypothesis': 'Data follows normal distribution',
                'interpretation': 'PASS: Data appears normal' if passed else 'FAIL: Data significantly non-normal'
            }
            
            return ValidationResults(
                test_name="Jarque-Bera Normality Test",
                test_statistic=jb_statistic,
                p_value=p_value,
                critical_value=stats.chi2.ppf(1 - self.significance_level, 2),
                passed=passed,
                details=details
            )
            
        except Exception as e:
            logger.error(f"Normality test failed: {e}")
            return ValidationResults(
                test_name="Jarque-Bera Normality Test",
                test_statistic=np.nan,
                p_value=np.nan,
                critical_value=np.nan,
                passed=False,
                details={'error': str(e)}
            )
    
    def _analyze_bias_reduction(self,
                                hybrid_results: np.ndarray,
                                bootstrap_results: np.ndarray,
                                historical_data: np.ndarray) -> List[BiasAnalysis]:
        """Analyze bias reduction compared to original bootstrap method"""
        
        bias_analyses = []
        
        try:
            # Calculate key metrics for all three datasets
            metrics = ['mean', 'variance', 'skewness', 'kurtosis', 'sharpe_ratio']
            
            hist_metrics = self._calculate_performance_metrics(historical_data)
            bootstrap_metrics = self._calculate_performance_metrics(bootstrap_results)
            hybrid_metrics = self._calculate_performance_metrics(hybrid_results)
            
            for metric in metrics:
                if metric in hist_metrics and metric in bootstrap_metrics and metric in hybrid_metrics:
                    hist_val = hist_metrics[metric]
                    bootstrap_val = bootstrap_metrics[metric]
                    hybrid_val = hybrid_metrics[metric]
                    
                    # Calculate bias (distance from historical target)
                    bootstrap_bias = abs(bootstrap_val - hist_val)
                    hybrid_bias = abs(hybrid_val - hist_val)
                    
                    # Calculate bias reduction percentage
                    if bootstrap_bias > 0:
                        bias_reduction = ((bootstrap_bias - hybrid_bias) / bootstrap_bias) * 100
                    else:
                        bias_reduction = 0.0
                    
                    # Improvement score (0-1 scale)
                    improvement_score = max(0, min(1, bias_reduction / 100))
                    
                    bias_analyses.append(BiasAnalysis(
                        metric=metric,
                        original_bootstrap_value=bootstrap_val,
                        hybrid_engine_value=hybrid_val,
                        historical_target=hist_val,
                        bias_reduction_percent=bias_reduction,
                        improvement_score=improvement_score
                    ))
        
        except Exception as e:
            logger.error(f"Bias analysis failed: {e}")
        
        return bias_analyses
    
    def _calculate_moments(self, data: np.ndarray) -> Tuple[float, float, float, float]:
        """Calculate first four moments of data"""
        
        # Flatten if multidimensional
        if data.ndim > 1:
            data_flat = data.flatten()
        else:
            data_flat = data
        
        # Remove infinite/NaN values
        data_clean = data_flat[np.isfinite(data_flat)]
        
        if len(data_clean) == 0:
            return 0.0, 0.0, 0.0, 0.0
        
        mean = np.mean(data_clean)
        variance = np.var(data_clean, ddof=1)
        skewness = stats.skew(data_clean)
        kurtosis = stats.kurtosis(data_clean)
        
        return mean, variance, skewness, kurtosis
    
    def _calculate_performance_metrics(self, data: np.ndarray) -> Dict[str, float]:
        """Calculate performance metrics for bias analysis"""
        
        metrics = {}
        
        try:
            # Flatten if multidimensional
            if data.ndim > 1:
                data_flat = data.flatten()
            else:
                data_flat = data
            
            # Remove infinite/NaN values
            data_clean = data_flat[np.isfinite(data_flat)]
            
            if len(data_clean) == 0:
                return {}
            
            # Basic moments
            metrics['mean'] = np.mean(data_clean)
            metrics['variance'] = np.var(data_clean, ddof=1)
            metrics['skewness'] = stats.skew(data_clean)
            metrics['kurtosis'] = stats.kurtosis(data_clean)
            
            # Risk-adjusted metrics
            if metrics['variance'] > 0:
                metrics['sharpe_ratio'] = metrics['mean'] / np.sqrt(metrics['variance'])
                metrics['volatility'] = np.sqrt(metrics['variance'])
            else:
                metrics['sharpe_ratio'] = 0.0
                metrics['volatility'] = 0.0
            
            # Downside metrics
            negative_returns = data_clean[data_clean < 0]
            if len(negative_returns) > 0:
                metrics['downside_deviation'] = np.sqrt(np.mean(negative_returns**2))
            else:
                metrics['downside_deviation'] = 0.0
        
        except Exception as e:
            logger.warning(f"Error calculating performance metrics: {e}")
        
        return metrics
    
    def _calculate_overall_score(self,
                                 validation_tests: List[ValidationResults],
                                 bias_analysis: List[BiasAnalysis]) -> float:
        """Calculate overall validation score (0-1 scale)"""
        
        if not validation_tests:
            return 0.0
        
        # Score from validation tests (0-1)
        test_scores = []
        for test in validation_tests:
            if test.passed:
                test_scores.append(1.0)
            else:
                # Partial credit based on p-value or relative difference
                if not np.isnan(test.p_value):
                    # P-value based score
                    score = min(1.0, test.p_value / self.significance_level)
                elif not np.isnan(test.test_statistic) and test.critical_value is not None:
                    # Test statistic based score
                    if test.test_statistic <= test.critical_value:
                        score = 1.0
                    else:
                        score = max(0.0, 1.0 - (test.test_statistic - test.critical_value) / test.critical_value)
                else:
                    score = 0.0
                test_scores.append(score)
        
        test_score = np.mean(test_scores)
        
        # Score from bias analysis (0-1)
        if bias_analysis:
            bias_scores = [analysis.improvement_score for analysis in bias_analysis]
            bias_score = np.mean(bias_scores)
        else:
            bias_score = 0.5  # Neutral score if no bias analysis
        
        # Weighted combination (70% validation tests, 30% bias reduction)
        overall_score = 0.7 * test_score + 0.3 * bias_score
        
        return overall_score
    
    def _generate_recommendations(self,
                                  validation_tests: List[ValidationResults],
                                  bias_analysis: List[BiasAnalysis],
                                  overall_score: float) -> List[str]:
        """Generate actionable recommendations based on validation results"""
        
        recommendations = []
        
        # Overall assessment
        if overall_score >= 0.9:
            recommendations.append("✅ Excellent validation performance - simulation is production ready")
        elif overall_score >= 0.7:
            recommendations.append("✅ Good validation performance - minor improvements possible")
        elif overall_score >= 0.5:
            recommendations.append("⚠️ Moderate validation performance - review failed tests")
        else:
            recommendations.append("❌ Poor validation performance - significant improvements needed")
        
        # Specific test failures
        failed_tests = [test for test in validation_tests if not test.passed]
        if failed_tests:
            recommendations.append(f"🔍 {len(failed_tests)} validation tests failed - review details below:")
            
            for test in failed_tests[:3]:  # Show top 3 failures
                if 'moment' in test.test_name.lower():
                    recommendations.append(f"  • {test.test_name}: Consider adjusting model parameters")
                elif 'normality' in test.test_name.lower():
                    recommendations.append(f"  • {test.test_name}: Consider alternative distributions (t, skewed-t)")
                elif 'kolmogorov' in test.test_name.lower():
                    recommendations.append(f"  • {test.test_name}: Review bootstrap block length selection")
        
        # Bias analysis recommendations
        if bias_analysis:
            poor_bias_reduction = [ba for ba in bias_analysis if ba.bias_reduction_percent < 10]
            if poor_bias_reduction:
                recommendations.append("📊 Low bias reduction detected:")
                for ba in poor_bias_reduction[:2]:
                    recommendations.append(f"  • {ba.metric}: Consider adjusting VAR/GARCH parameters")
        
        # Technical recommendations
        if overall_score < 0.7:
            recommendations.extend([
                "🔧 Technical improvements to consider:",
                "  • Increase block length in bootstrap sampling",
                "  • Review VAR lag selection criteria",
                "  • Consider GARCH model variations (GJR, EGARCH)",
                "  • Validate input data quality and stationarity"
            ])
        
        return recommendations
    
    def generate_validation_report(self, report: ValidationReport) -> str:
        """Generate human-readable validation report"""
        
        lines = [
            "=" * 60,
            "HYBRID ECONOMETRIC SIMULATION - VALIDATION REPORT",
            "=" * 60,
            "",
            f"Overall Score: {report.overall_score:.3f} / 1.000",
            f"Validation Status: {'✅ PASSED' if report.passed_validation else '❌ FAILED'}",
            "",
            "SUMMARY:",
            f"• Total Tests: {len(report.validation_tests)}",
            f"• Tests Passed: {sum(1 for test in report.validation_tests if test.passed)}",
            f"• Tests Failed: {sum(1 for test in report.validation_tests if not test.passed)}",
            ""
        ]
        
        # Distributional Tests
        if report.distributional_tests:
            lines.extend([
                "DISTRIBUTIONAL TESTS:",
                "─" * 30
            ])
            
            for test_name, result in report.distributional_tests.items():
                status = "✅ PASS" if result.passed else "❌ FAIL"
                lines.append(f"{test_name}: {status} (p={result.p_value:.4f})")
            lines.append("")
        
        # Moment Matching
        if report.moment_matching:
            lines.extend([
                "MOMENT MATCHING:",
                "─" * 30
            ])
            
            for test_name, result in report.moment_matching.items():
                status = "✅ PASS" if result.passed else "❌ FAIL"
                rel_diff = result.details.get('relative_difference', 0)
                lines.append(f"{test_name}: {status} (diff={rel_diff:.4f})")
            lines.append("")
        
        # Bias Analysis
        if report.bias_analysis:
            lines.extend([
                "BIAS REDUCTION ANALYSIS:",
                "─" * 30
            ])
            
            for analysis in report.bias_analysis:
                lines.append(
                    f"{analysis.metric}: {analysis.bias_reduction_percent:+.1f}% "
                    f"(score={analysis.improvement_score:.3f})"
                )
            lines.append("")
        
        # Recommendations
        if report.recommendations:
            lines.extend([
                "RECOMMENDATIONS:",
                "─" * 30
            ])
            lines.extend(report.recommendations)
        
        lines.extend([
            "",
            "=" * 60,
            f"Generated by Hybrid Econometric Simulation Engine",
            "=" * 60
        ])
        
        return "\n".join(lines)