"""
Performance Benchmarking Suite for Hybrid Econometric Simulation Engine
Comprehensive performance testing and optimization analysis
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import logging
import time
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path

from ..models.hybrid_engine import HybridEconometricEngine, SimulationConfig
from ..validation.distribution_validation import DistributionValidation

logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetrics:
    """Performance metrics for a single benchmark run"""
    test_name: str
    execution_time: float
    memory_usage_mb: float
    cpu_utilization: float
    paths_per_second: float
    convergence_rate: float
    accuracy_score: float
    throughput_score: float


@dataclass
class BenchmarkConfig:
    """Configuration for benchmark tests"""
    n_simulations: List[int] = None
    time_horizons: List[int] = None
    asset_counts: List[int] = None
    parallel_workers: List[int] = None
    
    def __post_init__(self):
        if self.n_simulations is None:
            self.n_simulations = [1000, 5000, 10000]
        if self.time_horizons is None:
            self.time_horizons = [1, 5, 10, 30]
        if self.asset_counts is None:
            self.asset_counts = [1, 3, 5, 10]
        if self.parallel_workers is None:
            self.parallel_workers = [1, 2, 4, 8]


@dataclass
class BenchmarkReport:
    """Comprehensive benchmark report"""
    benchmark_results: List[PerformanceMetrics]
    scaling_analysis: Dict[str, Any]
    optimization_recommendations: List[str]
    performance_regression: Dict[str, float]
    mvp_compliance: Dict[str, bool]
    execution_summary: Dict[str, Any]


class PerformanceBenchmarks:
    """
    Comprehensive performance benchmarking suite
    
    Features:
    - Scalability testing across multiple dimensions
    - Memory and CPU profiling
    - Throughput analysis
    - Accuracy vs speed trade-offs
    - MVP compliance validation
    - Performance regression detection
    """
    
    def __init__(self,
                 reference_data_path: Optional[str] = None,
                 enable_profiling: bool = True):
        """
        Initialize performance benchmarking suite
        
        Args:
            reference_data_path: Path to historical reference data
            enable_profiling: Whether to enable detailed profiling
        """
        self.reference_data_path = reference_data_path
        self.enable_profiling = enable_profiling
        self.benchmark_history = []
        
        # MVP Requirements (from PRD)
        self.mvp_requirements = {
            'max_execution_time_10k': 300,  # 5 minutes for 10K simulations
            'min_paths_per_second': 50,     # 50 paths/second minimum
            'max_memory_usage_gb': 8,       # 8GB maximum memory
            'min_convergence_rate': 0.95,   # 95% convergence rate
            'min_accuracy_score': 0.8       # 80% accuracy vs historical
        }
        
        logger.info("Initialized Performance Benchmarking Suite")
    
    def run_comprehensive_benchmarks(self,
                                     test_data: Dict[str, np.ndarray],
                                     config: BenchmarkConfig = None) -> BenchmarkReport:
        """
        Run comprehensive performance benchmarks
        
        Args:
            test_data: Dictionary of test datasets
            config: Benchmark configuration
            
        Returns:
            BenchmarkReport with detailed analysis
        """
        if config is None:
            config = BenchmarkConfig()
        
        logger.info("Starting comprehensive performance benchmarks")
        start_time = time.time()
        
        benchmark_results = []
        
        # 1. Scalability Tests
        logger.info("Running scalability tests...")
        scalability_results = self._run_scalability_tests(test_data, config)
        benchmark_results.extend(scalability_results)
        
        # 2. Parallel Processing Tests
        logger.info("Running parallel processing tests...")
        parallel_results = self._run_parallel_tests(test_data, config)
        benchmark_results.extend(parallel_results)
        
        # 3. Memory Stress Tests
        logger.info("Running memory stress tests...")
        memory_results = self._run_memory_tests(test_data, config)
        benchmark_results.extend(memory_results)
        
        # 4. Accuracy vs Speed Tests
        logger.info("Running accuracy vs speed tests...")
        accuracy_results = self._run_accuracy_speed_tests(test_data, config)
        benchmark_results.extend(accuracy_results)
        
        # 5. Analysis and Reporting
        scaling_analysis = self._analyze_scaling_performance(benchmark_results)
        optimization_recommendations = self._generate_optimization_recommendations(benchmark_results)
        mvp_compliance = self._check_mvp_compliance(benchmark_results)
        performance_regression = self._detect_performance_regression(benchmark_results)
        
        total_time = time.time() - start_time
        execution_summary = {
            'total_benchmark_time': total_time,
            'total_tests_run': len(benchmark_results),
            'tests_passed': sum(1 for r in benchmark_results if r.throughput_score >= 0.7),
            'average_throughput': np.mean([r.paths_per_second for r in benchmark_results]),
            'peak_memory_usage': max([r.memory_usage_mb for r in benchmark_results]),
            'overall_performance_score': self._calculate_overall_performance_score(benchmark_results)
        }
        
        logger.info(f"Benchmarks completed in {total_time:.2f} seconds")
        
        return BenchmarkReport(
            benchmark_results=benchmark_results,
            scaling_analysis=scaling_analysis,
            optimization_recommendations=optimization_recommendations,
            performance_regression=performance_regression,
            mvp_compliance=mvp_compliance,
            execution_summary=execution_summary
        )
    
    def _run_scalability_tests(self,
                               test_data: Dict[str, np.ndarray],
                               config: BenchmarkConfig) -> List[PerformanceMetrics]:
        """Test scalability across different dimensions"""
        
        results = []
        base_dataset = list(test_data.values())[0]  # Use first dataset as base
        
        # Test scaling by number of simulations
        for n_sims in config.n_simulations:
            metrics = self._benchmark_single_run(
                data=base_dataset,
                n_simulations=n_sims,
                time_horizon=5,  # 5 years
                test_name=f"Scale_Simulations_{n_sims}"
            )
            results.append(metrics)
        
        # Test scaling by time horizon
        for horizon in config.time_horizons:
            metrics = self._benchmark_single_run(
                data=base_dataset,
                n_simulations=1000,
                time_horizon=horizon,
                test_name=f"Scale_TimeHorizon_{horizon}Y"
            )
            results.append(metrics)
        
        # Test scaling by asset count
        for asset_count in config.asset_counts:
            if asset_count <= base_dataset.shape[1]:
                subset_data = base_dataset[:, :asset_count]
                metrics = self._benchmark_single_run(
                    data=subset_data,
                    n_simulations=1000,
                    time_horizon=5,
                    test_name=f"Scale_Assets_{asset_count}"
                )
                results.append(metrics)
        
        return results
    
    def _run_parallel_tests(self,
                            test_data: Dict[str, np.ndarray],
                            config: BenchmarkConfig) -> List[PerformanceMetrics]:
        """Test parallel processing performance"""
        
        results = []
        base_dataset = list(test_data.values())[0]
        
        for n_workers in config.parallel_workers:
            if n_workers <= psutil.cpu_count():
                metrics = self._benchmark_single_run(
                    data=base_dataset,
                    n_simulations=5000,
                    time_horizon=5,
                    max_workers=n_workers,
                    test_name=f"Parallel_Workers_{n_workers}"
                )
                results.append(metrics)
        
        return results
    
    def _run_memory_tests(self,
                          test_data: Dict[str, np.ndarray],
                          config: BenchmarkConfig) -> List[PerformanceMetrics]:
        """Test memory usage under stress"""
        
        results = []
        base_dataset = list(test_data.values())[0]
        
        # Memory stress test with large simulations
        large_sim_configs = [
            (20000, 5, "Memory_Large_20K"),
            (50000, 3, "Memory_VLarge_50K"),
        ]
        
        for n_sims, horizon, test_name in large_sim_configs:
            try:
                metrics = self._benchmark_single_run(
                    data=base_dataset,
                    n_simulations=n_sims,
                    time_horizon=horizon,
                    test_name=test_name
                )
                results.append(metrics)
            except MemoryError:
                logger.warning(f"Memory limit exceeded for {test_name}")
                # Create failed test result
                results.append(PerformanceMetrics(
                    test_name=test_name,
                    execution_time=np.inf,
                    memory_usage_mb=np.inf,
                    cpu_utilization=0,
                    paths_per_second=0,
                    convergence_rate=0,
                    accuracy_score=0,
                    throughput_score=0
                ))
        
        return results
    
    def _run_accuracy_speed_tests(self,
                                  test_data: Dict[str, np.ndarray],
                                  config: BenchmarkConfig) -> List[PerformanceMetrics]:
        """Test accuracy vs speed trade-offs"""
        
        results = []
        base_dataset = list(test_data.values())[0]
        
        # Different configurations trading accuracy for speed
        accuracy_configs = [
            (1000, "AccuracySpeed_Fast"),
            (5000, "AccuracySpeed_Balanced"), 
            (10000, "AccuracySpeed_Accurate"),
        ]
        
        for n_sims, test_name in accuracy_configs:
            metrics = self._benchmark_single_run(
                data=base_dataset,
                n_simulations=n_sims,
                time_horizon=5,
                test_name=test_name
            )
            results.append(metrics)
        
        return results
    
    def _benchmark_single_run(self,
                              data: np.ndarray,
                              n_simulations: int,
                              time_horizon: int,
                              max_workers: Optional[int] = None,
                              test_name: str = "Benchmark") -> PerformanceMetrics:
        """Benchmark a single simulation run"""
        
        # Initialize components
        engine = HybridEconometricEngine(numerical_stability=True)
        
        config = SimulationConfig(
            n_simulations=n_simulations,
            time_horizon_years=time_horizon,
            use_parallel=max_workers is not None,
            max_workers=max_workers
        )
        
        # Monitor resources
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Fit models
        start_time = time.time()
        cpu_start = process.cpu_percent()
        
        try:
            # Convert data to appropriate format
            if data.ndim == 1:
                data_df = pd.DataFrame({'asset_1': data})
            else:
                data_df = pd.DataFrame(data, columns=[f'asset_{i+1}' for i in range(data.shape[1])])
            
            # Fit models
            fit_start = time.time()
            fit_summary = engine.fit_models(data_df, config)
            fit_time = time.time() - fit_start
            
            # Run simulation
            sim_start = time.time()
            results = engine.simulate(config)
            sim_time = time.time() - sim_start
            
            total_time = time.time() - start_time
            
            # Calculate resource usage
            peak_memory = process.memory_info().rss / 1024 / 1024  # MB
            memory_usage = peak_memory - initial_memory
            cpu_utilization = process.cpu_percent()
            
            # Calculate performance metrics
            paths_per_second = n_simulations / total_time
            convergence_rate = fit_summary.get('convergence_summary', {}).get('var_convergence_rate', 1.0)
            
            # Calculate accuracy score (if reference data available)
            accuracy_score = self._calculate_accuracy_score(results, data)
            
            # Calculate throughput score (normalized performance)
            throughput_score = min(1.0, paths_per_second / self.mvp_requirements['min_paths_per_second'])
            
            return PerformanceMetrics(
                test_name=test_name,
                execution_time=total_time,
                memory_usage_mb=memory_usage,
                cpu_utilization=cpu_utilization,
                paths_per_second=paths_per_second,
                convergence_rate=convergence_rate,
                accuracy_score=accuracy_score,
                throughput_score=throughput_score
            )
            
        except Exception as e:
            logger.error(f"Benchmark failed for {test_name}: {e}")
            return PerformanceMetrics(
                test_name=test_name,
                execution_time=np.inf,
                memory_usage_mb=np.inf,
                cpu_utilization=0,
                paths_per_second=0,
                convergence_rate=0,
                accuracy_score=0,
                throughput_score=0
            )
    
    def _calculate_accuracy_score(self, simulation_results, historical_data: np.ndarray) -> float:
        """Calculate accuracy score compared to historical data"""
        
        try:
            # Use validation framework for accuracy assessment
            validator = DistributionValidation()
            
            # Get final values from simulation
            final_values = simulation_results.final_values
            
            # Compare distributions
            validation_report = validator.validate_simulation_results(
                final_values, historical_data
            )
            
            return validation_report.overall_score
            
        except Exception as e:
            logger.warning(f"Accuracy calculation failed: {e}")
            return 0.5  # Default neutral score
    
    def _analyze_scaling_performance(self, results: List[PerformanceMetrics]) -> Dict[str, Any]:
        """Analyze scaling characteristics"""
        
        scaling_analysis = {}
        
        # Group results by test type
        simulation_scaling = [r for r in results if 'Scale_Simulations' in r.test_name]
        horizon_scaling = [r for r in results if 'Scale_TimeHorizon' in r.test_name]
        asset_scaling = [r for r in results if 'Scale_Assets' in r.test_name]
        parallel_scaling = [r for r in results if 'Parallel_Workers' in r.test_name]
        
        # Analyze simulation count scaling
        if simulation_scaling:
            sim_counts = [int(r.test_name.split('_')[-1]) for r in simulation_scaling]
            execution_times = [r.execution_time for r in simulation_scaling]
            
            # Linear regression for scaling coefficient
            if len(sim_counts) > 1:
                scaling_coeff = np.polyfit(sim_counts, execution_times, 1)[0]
                scaling_analysis['simulation_scaling_coefficient'] = scaling_coeff
                scaling_analysis['simulation_scaling_efficiency'] = 1.0 / scaling_coeff if scaling_coeff > 0 else 0
        
        # Analyze parallel efficiency
        if parallel_scaling:
            worker_counts = [int(r.test_name.split('_')[-1]) for r in parallel_scaling]
            throughputs = [r.paths_per_second for r in parallel_scaling]
            
            if len(worker_counts) > 1:
                # Calculate parallel efficiency (vs ideal linear scaling)
                baseline_throughput = throughputs[0]  # Single worker performance
                parallel_efficiencies = []
                
                for i, (workers, throughput) in enumerate(zip(worker_counts, throughputs)):
                    if workers > 1:
                        ideal_throughput = baseline_throughput * workers
                        efficiency = throughput / ideal_throughput
                        parallel_efficiencies.append(efficiency)
                
                scaling_analysis['parallel_efficiency'] = np.mean(parallel_efficiencies) if parallel_efficiencies else 0
        
        # Memory scaling analysis
        memory_usages = [r.memory_usage_mb for r in results if not np.isinf(r.memory_usage_mb)]
        if memory_usages:
            scaling_analysis['peak_memory_usage'] = max(memory_usages)
            scaling_analysis['average_memory_usage'] = np.mean(memory_usages)
            scaling_analysis['memory_efficiency'] = 'Good' if max(memory_usages) < 1000 else 'High'
        
        return scaling_analysis
    
    def _generate_optimization_recommendations(self, results: List[PerformanceMetrics]) -> List[str]:
        """Generate optimization recommendations based on benchmark results"""
        
        recommendations = []
        
        # Analyze overall performance
        avg_throughput = np.mean([r.paths_per_second for r in results if not np.isinf(r.execution_time)])
        avg_memory = np.mean([r.memory_usage_mb for r in results if not np.isinf(r.memory_usage_mb)])
        avg_accuracy = np.mean([r.accuracy_score for r in results])
        
        # Throughput recommendations
        if avg_throughput < self.mvp_requirements['min_paths_per_second']:
            recommendations.append("🚀 THROUGHPUT: Enable parallel processing for better performance")
            recommendations.append("🚀 THROUGHPUT: Consider reducing model complexity for faster execution")
        
        # Memory recommendations
        if avg_memory > 1000:  # 1GB
            recommendations.append("💾 MEMORY: Implement batch processing for large simulations")
            recommendations.append("💾 MEMORY: Consider using memory-mapped arrays for large datasets")
        
        # Accuracy recommendations
        if avg_accuracy < 0.8:
            recommendations.append("🎯 ACCURACY: Increase number of simulations for better convergence")
            recommendations.append("🎯 ACCURACY: Review model parameter selection and validation")
        
        # Parallel processing analysis
        parallel_results = [r for r in results if 'Parallel_Workers' in r.test_name]
        if parallel_results:
            single_worker = next((r for r in parallel_results if 'Workers_1' in r.test_name), None)
            multi_worker = [r for r in parallel_results if 'Workers_' in r.test_name and not 'Workers_1' in r.test_name]
            
            if single_worker and multi_worker:
                best_parallel = max(multi_worker, key=lambda x: x.paths_per_second)
                speedup = best_parallel.paths_per_second / single_worker.paths_per_second
                
                if speedup < 2.0:
                    recommendations.append("⚡ PARALLEL: Review parallel processing bottlenecks")
                else:
                    recommendations.append(f"✅ PARALLEL: Good speedup achieved ({speedup:.1f}x)")
        
        # Convergence recommendations
        low_convergence = [r for r in results if r.convergence_rate < 0.9]
        if low_convergence:
            recommendations.append("🔄 CONVERGENCE: Review model initialization and optimization settings")
        
        return recommendations
    
    def _check_mvp_compliance(self, results: List[PerformanceMetrics]) -> Dict[str, bool]:
        """Check compliance with MVP requirements"""
        
        compliance = {}
        
        # Find 10K simulation test
        sim_10k = next((r for r in results if 'Scale_Simulations_10000' in r.test_name), None)
        if sim_10k:
            compliance['execution_time_10k'] = sim_10k.execution_time <= self.mvp_requirements['max_execution_time_10k']
        else:
            compliance['execution_time_10k'] = None
        
        # Check minimum throughput
        valid_results = [r for r in results if not np.isinf(r.execution_time)]
        if valid_results:
            max_throughput = max(r.paths_per_second for r in valid_results)
            compliance['min_throughput'] = max_throughput >= self.mvp_requirements['min_paths_per_second']
        else:
            compliance['min_throughput'] = False
        
        # Check memory usage
        valid_memory = [r.memory_usage_mb for r in results if not np.isinf(r.memory_usage_mb)]
        if valid_memory:
            max_memory_gb = max(valid_memory) / 1024
            compliance['max_memory'] = max_memory_gb <= self.mvp_requirements['max_memory_usage_gb']
        else:
            compliance['max_memory'] = None
        
        # Check convergence rate
        valid_convergence = [r.convergence_rate for r in results if r.convergence_rate > 0]
        if valid_convergence:
            min_convergence = min(valid_convergence)
            compliance['min_convergence'] = min_convergence >= self.mvp_requirements['min_convergence_rate']
        else:
            compliance['min_convergence'] = None
        
        # Check accuracy
        valid_accuracy = [r.accuracy_score for r in results if r.accuracy_score > 0]
        if valid_accuracy:
            min_accuracy = min(valid_accuracy)
            compliance['min_accuracy'] = min_accuracy >= self.mvp_requirements['min_accuracy_score']
        else:
            compliance['min_accuracy'] = None
        
        return compliance
    
    def _detect_performance_regression(self, results: List[PerformanceMetrics]) -> Dict[str, float]:
        """Detect performance regression vs historical benchmarks"""
        
        regression_analysis = {}
        
        # Load historical benchmark data if available
        if self.reference_data_path and Path(self.reference_data_path).exists():
            try:
                with open(self.reference_data_path, 'r') as f:
                    historical_data = json.load(f)
                
                # Compare key metrics
                current_avg_throughput = np.mean([r.paths_per_second for r in results if not np.isinf(r.execution_time)])
                historical_avg_throughput = historical_data.get('average_throughput', current_avg_throughput)
                
                if historical_avg_throughput > 0:
                    throughput_change = (current_avg_throughput - historical_avg_throughput) / historical_avg_throughput
                    regression_analysis['throughput_change_percent'] = throughput_change * 100
                
                # Memory usage comparison
                current_avg_memory = np.mean([r.memory_usage_mb for r in results if not np.isinf(r.memory_usage_mb)])
                historical_avg_memory = historical_data.get('average_memory', current_avg_memory)
                
                if historical_avg_memory > 0:
                    memory_change = (current_avg_memory - historical_avg_memory) / historical_avg_memory
                    regression_analysis['memory_change_percent'] = memory_change * 100
                
            except Exception as e:
                logger.warning(f"Could not load historical benchmark data: {e}")
        
        return regression_analysis
    
    def _calculate_overall_performance_score(self, results: List[PerformanceMetrics]) -> float:
        """Calculate overall performance score (0-1)"""
        
        valid_results = [r for r in results if not np.isinf(r.execution_time)]
        if not valid_results:
            return 0.0
        
        # Weighted average of key performance indicators
        throughput_scores = [r.throughput_score for r in valid_results]
        accuracy_scores = [r.accuracy_score for r in valid_results]
        convergence_rates = [r.convergence_rate for r in valid_results]
        
        # Memory efficiency score (inverse relationship)
        memory_scores = []
        for r in valid_results:
            if not np.isinf(r.memory_usage_mb):
                # Score decreases as memory usage increases
                memory_score = max(0, 1 - (r.memory_usage_mb / 2000))  # 2GB reference
                memory_scores.append(memory_score)
        
        # Calculate weighted score
        weights = [0.3, 0.3, 0.2, 0.2]  # throughput, accuracy, convergence, memory
        scores = [
            np.mean(throughput_scores) if throughput_scores else 0,
            np.mean(accuracy_scores) if accuracy_scores else 0,
            np.mean(convergence_rates) if convergence_rates else 0,
            np.mean(memory_scores) if memory_scores else 0.5
        ]
        
        overall_score = sum(w * s for w, s in zip(weights, scores))
        return overall_score
    
    def save_benchmark_results(self, report: BenchmarkReport, output_path: str):
        """Save benchmark results to file"""
        
        # Convert to serializable format
        serializable_report = {
            'execution_summary': report.execution_summary,
            'scaling_analysis': report.scaling_analysis,
            'mvp_compliance': report.mvp_compliance,
            'performance_regression': report.performance_regression,
            'optimization_recommendations': report.optimization_recommendations,
            'benchmark_results': [
                {
                    'test_name': r.test_name,
                    'execution_time': r.execution_time if not np.isinf(r.execution_time) else None,
                    'memory_usage_mb': r.memory_usage_mb if not np.isinf(r.memory_usage_mb) else None,
                    'cpu_utilization': r.cpu_utilization,
                    'paths_per_second': r.paths_per_second,
                    'convergence_rate': r.convergence_rate,
                    'accuracy_score': r.accuracy_score,
                    'throughput_score': r.throughput_score
                }
                for r in report.benchmark_results
            ]
        }
        
        with open(output_path, 'w') as f:
            json.dump(serializable_report, f, indent=2)
        
        logger.info(f"Benchmark results saved to {output_path}")
    
    def generate_benchmark_report(self, report: BenchmarkReport) -> str:
        """Generate human-readable benchmark report"""
        
        lines = [
            "=" * 70,
            "HYBRID ECONOMETRIC SIMULATION - PERFORMANCE BENCHMARK REPORT",
            "=" * 70,
            "",
            "EXECUTIVE SUMMARY:",
            f"• Overall Performance Score: {report.execution_summary['overall_performance_score']:.3f} / 1.000",
            f"• Total Tests Run: {report.execution_summary['total_tests_run']}",
            f"• Tests Passed: {report.execution_summary['tests_passed']}",
            f"• Average Throughput: {report.execution_summary['average_throughput']:.1f} paths/second",
            f"• Peak Memory Usage: {report.execution_summary['peak_memory_usage']:.1f} MB",
            ""
        ]
        
        # MVP Compliance
        lines.extend([
            "MVP COMPLIANCE:",
            "─" * 30
        ])
        
        for requirement, status in report.mvp_compliance.items():
            if status is not None:
                status_symbol = "✅" if status else "❌"
                lines.append(f"{requirement}: {status_symbol}")
            else:
                lines.append(f"{requirement}: ⚪ Not Tested")
        lines.append("")
        
        # Scaling Analysis
        if report.scaling_analysis:
            lines.extend([
                "SCALING ANALYSIS:",
                "─" * 30
            ])
            
            for key, value in report.scaling_analysis.items():
                if isinstance(value, float):
                    lines.append(f"{key}: {value:.4f}")
                else:
                    lines.append(f"{key}: {value}")
            lines.append("")
        
        # Performance Regression
        if report.performance_regression:
            lines.extend([
                "PERFORMANCE REGRESSION:",
                "─" * 30
            ])
            
            for metric, change in report.performance_regression.items():
                change_symbol = "📈" if change > 0 else "📉" if change < 0 else "➡️"
                lines.append(f"{metric}: {change:+.1f}% {change_symbol}")
            lines.append("")
        
        # Top Performance Results
        lines.extend([
            "TOP PERFORMANCE RESULTS:",
            "─" * 30
        ])
        
        # Sort by throughput score
        top_results = sorted(report.benchmark_results, key=lambda x: x.throughput_score, reverse=True)[:5]
        
        for result in top_results:
            if not np.isinf(result.execution_time):
                lines.append(
                    f"{result.test_name}: {result.paths_per_second:.1f} paths/sec "
                    f"({result.execution_time:.1f}s, {result.memory_usage_mb:.0f}MB)"
                )
        lines.append("")
        
        # Optimization Recommendations
        if report.optimization_recommendations:
            lines.extend([
                "OPTIMIZATION RECOMMENDATIONS:",
                "─" * 30
            ])
            lines.extend(report.optimization_recommendations)
            lines.append("")
        
        lines.extend([
            "=" * 70,
            f"Generated by Hybrid Econometric Simulation Engine Performance Suite",
            "=" * 70
        ])
        
        return "\n".join(lines)