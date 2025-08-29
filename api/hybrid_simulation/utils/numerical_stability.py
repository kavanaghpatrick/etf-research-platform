"""
Numerical Stability Handler for Hybrid Econometric Simulation Engine
Handles edge cases and ensures numerical stability in mathematical operations
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union, Any
from dataclasses import dataclass
import logging
from scipy import linalg
from scipy.stats import multivariate_normal
import warnings

warnings.filterwarnings('ignore', category=RuntimeWarning)

logger = logging.getLogger(__name__)


@dataclass
class StabilityReport:
    """Report on numerical stability operations performed"""
    operation: str
    input_condition: float
    output_condition: float
    modifications_made: List[str]
    success: bool
    fallback_used: bool


class NumericalStabilityHandler:
    """
    Handles numerical edge cases in econometric models
    
    Features:
    - Covariance matrix regularization and conditioning
    - Eigenvalue stabilization
    - Overflow/underflow protection
    - Convergence failure handling
    - Matrix decomposition safety
    """
    
    def __init__(self, 
                 min_eigenvalue: float = 1e-8,
                 max_condition_number: float = 1e12,
                 regularization_strength: float = 1e-6,
                 clip_threshold: float = 5.0):
        """
        Initialize numerical stability handler
        
        Args:
            min_eigenvalue: Minimum eigenvalue for regularization
            max_condition_number: Maximum condition number before regularization
            regularization_strength: Strength of regularization applied
            clip_threshold: Threshold for clipping extreme values (in std devs)
        """
        self.min_eigenvalue = min_eigenvalue
        self.max_condition_number = max_condition_number
        self.regularization_strength = regularization_strength
        self.clip_threshold = clip_threshold
        
        self.operations_log = []
        
        logger.info("Initialized Numerical Stability Handler")
    
    def handle_singular_covariance(self, 
                                   cov_matrix: np.ndarray,
                                   method: str = 'eigenvalue') -> Tuple[np.ndarray, StabilityReport]:
        """
        Fix non-positive definite covariance matrices
        
        Args:
            cov_matrix: Input covariance matrix
            method: Regularization method ('eigenvalue', 'ridge', 'shrinkage')
            
        Returns:
            Tuple of (regularized_matrix, stability_report)
        """
        original_matrix = cov_matrix.copy()
        modifications = []
        fallback_used = False
        
        try:
            # Check if matrix is already positive definite
            eigenvals = np.linalg.eigvals(cov_matrix)
            min_eigenval = np.min(eigenvals)
            condition_number = np.max(eigenvals) / max(np.min(eigenvals), 1e-15)
            
            logger.debug(f"Original matrix: min_eigenval={min_eigenval:.2e}, condition={condition_number:.2e}")
            
            if min_eigenval > self.min_eigenvalue and condition_number < self.max_condition_number:
                # Matrix is already well-conditioned
                report = StabilityReport(
                    operation="covariance_regularization",
                    input_condition=condition_number,
                    output_condition=condition_number,
                    modifications_made=[],
                    success=True,
                    fallback_used=False
                )
                return cov_matrix, report
            
            # Apply regularization based on method
            if method == 'eigenvalue':
                regularized_matrix = self._eigenvalue_regularization(cov_matrix)
                modifications.append("eigenvalue_regularization")
            elif method == 'ridge':
                regularized_matrix = self._ridge_regularization(cov_matrix)
                modifications.append("ridge_regularization")
            elif method == 'shrinkage':
                regularized_matrix = self._shrinkage_regularization(cov_matrix)
                modifications.append("shrinkage_regularization")
            else:
                raise ValueError(f"Unknown regularization method: {method}")
            
            # Verify result
            new_eigenvals = np.linalg.eigvals(regularized_matrix)
            new_min_eigenval = np.min(new_eigenvals)
            new_condition = np.max(new_eigenvals) / max(np.min(new_eigenvals), 1e-15)
            
            if new_min_eigenval <= 0:
                logger.warning("Regularization failed, using fallback diagonal matrix")
                regularized_matrix = self._create_diagonal_fallback(cov_matrix)
                modifications.append("diagonal_fallback")
                fallback_used = True
                
                new_eigenvals = np.linalg.eigvals(regularized_matrix)
                new_condition = np.max(new_eigenvals) / max(np.min(new_eigenvals), 1e-15)
            
            success = True
            
        except Exception as e:
            logger.error(f"Covariance regularization failed: {e}")
            regularized_matrix = self._create_diagonal_fallback(cov_matrix)
            modifications.append(f"error_fallback: {str(e)}")
            fallback_used = True
            success = False
            
            new_eigenvals = np.linalg.eigvals(regularized_matrix)
            new_condition = np.max(new_eigenvals) / max(np.min(new_eigenvals), 1e-15)
        
        report = StabilityReport(
            operation="covariance_regularization",
            input_condition=condition_number if 'condition_number' in locals() else np.inf,
            output_condition=new_condition,
            modifications_made=modifications,
            success=success,
            fallback_used=fallback_used
        )
        
        self.operations_log.append(report)
        return regularized_matrix, report
    
    def _eigenvalue_regularization(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Regularize matrix by adjusting eigenvalues"""
        
        # Eigenvalue decomposition
        eigenvals, eigenvecs = np.linalg.eigh(cov_matrix)
        
        # Regularize eigenvalues
        regularized_eigenvals = np.maximum(eigenvals, self.min_eigenvalue)
        
        # Reconstruct matrix
        regularized_matrix = eigenvecs @ np.diag(regularized_eigenvals) @ eigenvecs.T
        
        # Ensure symmetry
        regularized_matrix = (regularized_matrix + regularized_matrix.T) / 2
        
        return regularized_matrix
    
    def _ridge_regularization(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Apply ridge regularization (add small value to diagonal)"""
        
        regularized_matrix = cov_matrix + self.regularization_strength * np.eye(cov_matrix.shape[0])
        
        return regularized_matrix
    
    def _shrinkage_regularization(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Apply shrinkage towards identity matrix"""
        
        # Calculate optimal shrinkage intensity (simplified Ledoit-Wolf)
        n = cov_matrix.shape[0]
        trace_cov = np.trace(cov_matrix)
        
        # Target matrix (scaled identity)
        target_matrix = (trace_cov / n) * np.eye(n)
        
        # Shrinkage intensity (simplified)
        shrinkage_intensity = self.regularization_strength
        
        # Apply shrinkage
        regularized_matrix = (1 - shrinkage_intensity) * cov_matrix + shrinkage_intensity * target_matrix
        
        return regularized_matrix
    
    def _create_diagonal_fallback(self, cov_matrix: np.ndarray) -> np.ndarray:
        """Create diagonal fallback matrix when all else fails"""
        
        # Use diagonal elements, with minimum variance
        diagonal_elements = np.diag(cov_matrix)
        diagonal_elements = np.maximum(diagonal_elements, self.min_eigenvalue)
        
        return np.diag(diagonal_elements)
    
    def handle_extreme_residuals(self, 
                                 residuals: np.ndarray,
                                 method: str = 'clip') -> Tuple[np.ndarray, StabilityReport]:
        """
        Handle extreme residuals that could destabilize simulation
        
        Args:
            residuals: Input residuals
            method: Handling method ('clip', 'winsorize', 'remove')
            
        Returns:
            Tuple of (cleaned_residuals, stability_report)
        """
        original_residuals = residuals.copy()
        modifications = []
        
        try:
            # Calculate statistics
            residual_std = np.std(residuals, axis=0)
            residual_mean = np.mean(residuals, axis=0)
            
            # Identify extreme values
            z_scores = np.abs((residuals - residual_mean) / residual_std)
            extreme_mask = z_scores > self.clip_threshold
            n_extreme = np.sum(extreme_mask)
            
            logger.debug(f"Found {n_extreme} extreme residuals (>{self.clip_threshold} std devs)")
            
            if n_extreme == 0:
                # No extreme values
                report = StabilityReport(
                    operation="residual_cleaning",
                    input_condition=np.max(z_scores),
                    output_condition=np.max(z_scores),
                    modifications_made=[],
                    success=True,
                    fallback_used=False
                )
                return residuals, report
            
            # Apply cleaning method
            if method == 'clip':
                cleaned_residuals = self._clip_residuals(residuals, residual_mean, residual_std)
                modifications.append(f"clipped_{n_extreme}_values")
            elif method == 'winsorize':
                cleaned_residuals = self._winsorize_residuals(residuals)
                modifications.append(f"winsorized_{n_extreme}_values")
            elif method == 'remove':
                cleaned_residuals = self._remove_extreme_residuals(residuals, extreme_mask)
                modifications.append(f"removed_{n_extreme}_values")
            else:
                raise ValueError(f"Unknown cleaning method: {method}")
            
            # Calculate final statistics
            final_z_scores = np.abs((cleaned_residuals - np.mean(cleaned_residuals, axis=0)) / np.std(cleaned_residuals, axis=0))
            
            report = StabilityReport(
                operation="residual_cleaning",
                input_condition=np.max(z_scores),
                output_condition=np.max(final_z_scores),
                modifications_made=modifications,
                success=True,
                fallback_used=False
            )
            
        except Exception as e:
            logger.error(f"Residual cleaning failed: {e}")
            cleaned_residuals = residuals
            report = StabilityReport(
                operation="residual_cleaning",
                input_condition=np.inf,
                output_condition=np.inf,
                modifications_made=[f"error: {str(e)}"],
                success=False,
                fallback_used=True
            )
        
        self.operations_log.append(report)
        return cleaned_residuals, report
    
    def _clip_residuals(self, residuals: np.ndarray, mean: np.ndarray, std: np.ndarray) -> np.ndarray:
        """Clip residuals to specified threshold"""
        
        lower_bound = mean - self.clip_threshold * std
        upper_bound = mean + self.clip_threshold * std
        
        clipped_residuals = np.clip(residuals, lower_bound, upper_bound)
        
        return clipped_residuals
    
    def _winsorize_residuals(self, residuals: np.ndarray, percentile: float = 0.05) -> np.ndarray:
        """Winsorize residuals at specified percentiles"""
        
        winsorized_residuals = residuals.copy()
        
        for col in range(residuals.shape[1]):
            col_data = residuals[:, col]
            lower_bound = np.percentile(col_data, percentile * 100)
            upper_bound = np.percentile(col_data, (1 - percentile) * 100)
            
            winsorized_residuals[:, col] = np.clip(col_data, lower_bound, upper_bound)
        
        return winsorized_residuals
    
    def _remove_extreme_residuals(self, residuals: np.ndarray, extreme_mask: np.ndarray) -> np.ndarray:
        """Remove extreme residuals (keep only non-extreme observations)"""
        
        # Remove rows with any extreme values
        extreme_rows = np.any(extreme_mask, axis=1)
        clean_residuals = residuals[~extreme_rows]
        
        if len(clean_residuals) < len(residuals) * 0.5:
            logger.warning("Removing extreme residuals would eliminate >50% of data, using clipping instead")
            return self._clip_residuals(residuals, np.mean(residuals, axis=0), np.std(residuals, axis=0))
        
        return clean_residuals
    
    def handle_convergence_failure(self, 
                                   model_type: str,
                                   data: np.ndarray,
                                   error_message: str) -> Tuple[Any, StabilityReport]:
        """
        Handle model convergence failures with appropriate fallbacks
        
        Args:
            model_type: Type of model that failed ('var', 'garch', 'copula')
            data: Input data
            error_message: Error message from failed model
            
        Returns:
            Tuple of (fallback_model, stability_report)
        """
        modifications = []
        
        try:
            if model_type.lower() == 'var':
                fallback_model = self._create_var_fallback(data)
                modifications.append("var_random_walk_fallback")
            elif model_type.lower() == 'garch':
                fallback_model = self._create_garch_fallback(data)
                modifications.append("garch_constant_vol_fallback")
            elif model_type.lower() == 'copula':
                fallback_model = self._create_copula_fallback(data)
                modifications.append("copula_normal_fallback")
            else:
                fallback_model = self._create_generic_fallback(data)
                modifications.append("generic_fallback")
            
            report = StabilityReport(
                operation=f"{model_type}_convergence_fallback",
                input_condition=np.inf,  # Indicates failure
                output_condition=0.0,    # Indicates success
                modifications_made=modifications,
                success=True,
                fallback_used=True
            )
            
        except Exception as e:
            logger.error(f"Fallback creation failed: {e}")
            fallback_model = None
            report = StabilityReport(
                operation=f"{model_type}_convergence_fallback",
                input_condition=np.inf,
                output_condition=np.inf,
                modifications_made=[f"fallback_failed: {str(e)}"],
                success=False,
                fallback_used=True
            )
        
        self.operations_log.append(report)
        return fallback_model, report
    
    def _create_var_fallback(self, data: np.ndarray):
        """Create simple VAR fallback (random walk model)"""
        
        class VARFallback:
            def __init__(self, data):
                self.data = data
                self.mean_returns = np.mean(data, axis=0)
                self.residuals = data - self.mean_returns
                
                # Create results object that matches VARResults interface
                self.results = self._create_fallback_results(data)
                
            def _create_fallback_results(self, data):
                """Create fallback results object"""
                class FallbackResults:
                    def __init__(self, data):
                        self.model = None  # No actual model
                        self.fitted_values = np.mean(data, axis=0, keepdims=True)
                        self.residuals = data - np.mean(data, axis=0)
                        self.aic = np.nan  # Not applicable for fallback
                        self.bic = np.nan
                        self.hqic = np.nan
                        self.optimal_lags = 0  # Random walk has no lags
                        self.convergence_success = False  # Fallback was used
                        self.stationarity_tests = {}
                        self.validation_metrics = {}
                        
                return FallbackResults(data)
                
            def forecast(self, steps):
                # Random walk forecast: next value = current value
                return np.tile(self.mean_returns, (steps, 1))
        
        return VARFallback(data)
    
    def _create_garch_fallback(self, data: np.ndarray):
        """Create simple GARCH fallback (constant volatility)"""
        
        class GARCHFallback:
            def __init__(self, data):
                self.data = data.flatten() if data.ndim > 1 else data
                self.historical_vol = np.std(self.data)
                self.residuals = self.data / self.historical_vol
                
                # Create results object that matches GARCH results interface
                self.results = self._create_fallback_results(self.data)
                
            def _create_fallback_results(self, data):
                """Create fallback results object for GARCH"""
                class GARCHFallbackResults:
                    def __init__(self, data):
                        self.model = None  # No actual model
                        self.params = {}  # No parameters
                        self.conditional_volatility = np.full(len(data), np.std(data))
                        self.standardized_residuals = data / np.std(data)
                        self.aic = np.nan
                        self.bic = np.nan
                        self.convergence_success = False  # Fallback was used
                        self.arch_test_pvalue = np.nan
                        
                return GARCHFallbackResults(data)
                
            def forecast(self, steps):
                return np.full(steps, self.historical_vol)
        
        return GARCHFallback(data)
    
    def _create_copula_fallback(self, data: np.ndarray):
        """Create simple copula fallback (normal copula)"""
        
        class CopulaFallback:
            def __init__(self, data):
                self.data = data
                self.correlation_matrix = np.corrcoef(data.T)
                
                # Ensure positive definite
                self.correlation_matrix, _ = self.regularize_correlation()
                
            def regularize_correlation(self):
                eigenvals, eigenvecs = np.linalg.eigh(self.correlation_matrix)
                eigenvals = np.maximum(eigenvals, 1e-8)
                regularized = eigenvecs @ np.diag(eigenvals) @ eigenvecs.T
                return regularized, None
            
            def sample(self, n_samples):
                return multivariate_normal.rvs(
                    mean=np.zeros(self.data.shape[1]),
                    cov=self.correlation_matrix,
                    size=n_samples
                )
        
        return CopulaFallback(data)
    
    def _create_generic_fallback(self, data: np.ndarray):
        """Create generic fallback for unknown model types"""
        
        class GenericFallback:
            def __init__(self, data):
                self.data = data
                self.mean = np.mean(data, axis=0)
                self.std = np.std(data, axis=0)
                
            def predict(self, *args, **kwargs):
                return self.mean
                
            def sample(self, n_samples):
                return np.random.normal(self.mean, self.std, (n_samples, len(self.mean)))
        
        return GenericFallback(data)
    
    def safe_matrix_decomposition(self, 
                                  matrix: np.ndarray,
                                  method: str = 'cholesky') -> Tuple[np.ndarray, StabilityReport]:
        """
        Safely decompose matrix with fallbacks
        
        Args:
            matrix: Input matrix to decompose
            method: Decomposition method ('cholesky', 'svd', 'eigenvalue')
            
        Returns:
            Tuple of (decomposition_result, stability_report)
        """
        modifications = []
        fallback_used = False
        
        try:
            # First ensure matrix is well-conditioned
            conditioned_matrix, cov_report = self.handle_singular_covariance(matrix)
            modifications.extend(cov_report.modifications_made)
            
            # Apply decomposition
            if method == 'cholesky':
                result = np.linalg.cholesky(conditioned_matrix)
                modifications.append("cholesky_decomposition")
            elif method == 'svd':
                U, s, Vt = np.linalg.svd(conditioned_matrix)
                result = (U, s, Vt)
                modifications.append("svd_decomposition")
            elif method == 'eigenvalue':
                eigenvals, eigenvecs = np.linalg.eigh(conditioned_matrix)
                result = (eigenvals, eigenvecs)
                modifications.append("eigenvalue_decomposition")
            else:
                raise ValueError(f"Unknown decomposition method: {method}")
            
            success = True
            condition_number = np.linalg.cond(conditioned_matrix)
            
        except Exception as e:
            logger.warning(f"Matrix decomposition failed: {e}, using fallback")
            
            # Fallback to diagonal approximation
            if method == 'cholesky':
                diag_elements = np.sqrt(np.maximum(np.diag(matrix), self.min_eigenvalue))
                result = np.diag(diag_elements)
            else:
                result = np.eye(matrix.shape[0])
            
            modifications.append(f"decomposition_failed_fallback: {str(e)}")
            fallback_used = True
            success = False
            condition_number = np.inf
        
        report = StabilityReport(
            operation=f"{method}_decomposition",
            input_condition=np.linalg.cond(matrix),
            output_condition=condition_number,
            modifications_made=modifications,
            success=success,
            fallback_used=fallback_used
        )
        
        self.operations_log.append(report)
        return result, report
    
    def get_stability_summary(self) -> Dict[str, Any]:
        """Get summary of all stability operations performed"""
        
        if not self.operations_log:
            return {"message": "No stability operations performed"}
        
        summary = {
            "total_operations": len(self.operations_log),
            "successful_operations": sum(1 for op in self.operations_log if op.success),
            "fallback_operations": sum(1 for op in self.operations_log if op.fallback_used),
            "operation_types": {},
            "modifications_summary": {}
        }
        
        # Count operation types
        for op in self.operations_log:
            op_type = op.operation
            if op_type not in summary["operation_types"]:
                summary["operation_types"][op_type] = 0
            summary["operation_types"][op_type] += 1
        
        # Count modification types
        for op in self.operations_log:
            for mod in op.modifications_made:
                if mod not in summary["modifications_summary"]:
                    summary["modifications_summary"][mod] = 0
                summary["modifications_summary"][mod] += 1
        
        return summary
    
    def clear_log(self):
        """Clear the operations log"""
        self.operations_log = []
        logger.info("Stability operations log cleared")