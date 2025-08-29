"""
Vector Autoregression (VAR) Model Implementation
Provides mean forecasting for the hybrid econometric simulation engine
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass
import logging
from statsmodels.tsa.vector_ar.var_model import VAR
from statsmodels.tsa.stattools import adfuller
from scipy import stats
import warnings

warnings.filterwarnings('ignore', category=UserWarning)

logger = logging.getLogger(__name__)


@dataclass
class VARResults:
    """Results from VAR model fitting and validation"""
    model: VAR
    fitted_values: np.ndarray
    residuals: np.ndarray
    aic: float
    bic: float
    hqic: float
    optimal_lags: int
    convergence_success: bool
    stationarity_tests: Dict[str, float]
    validation_metrics: Dict[str, float]


class SimpleVARModel:
    """
    Simple Vector Autoregression model with automatic lag selection
    
    Features:
    - Automatic lag selection via AIC/BIC criteria
    - Stationarity testing and handling
    - Robust parameter estimation with fallbacks
    - Comprehensive model validation
    """
    
    def __init__(self, 
                 max_lags: int = 5,
                 selection_criterion: str = 'aic',
                 min_observations: int = 100,
                 stationarity_threshold: float = 0.05):
        """
        Initialize VAR model
        
        Args:
            max_lags: Maximum number of lags to consider
            selection_criterion: Criterion for lag selection ('aic', 'bic', 'hqic')
            min_observations: Minimum observations required for fitting
            stationarity_threshold: P-value threshold for stationarity tests
        """
        self.max_lags = max_lags
        self.selection_criterion = selection_criterion.lower()
        self.min_observations = min_observations
        self.stationarity_threshold = stationarity_threshold
        
        self.is_fitted = False
        self.results = None
        self.optimal_lags = None
        self.n_assets = None
        
        logger.info(f"Initialized VAR model with max_lags={max_lags}, criterion={selection_criterion}")
    
    def fit(self, returns: Union[pd.DataFrame, np.ndarray]) -> VARResults:
        """
        Fit VAR model to return data with automatic lag selection
        
        Args:
            returns: Asset returns (n_observations x n_assets)
            
        Returns:
            VARResults object with fitted model and diagnostics
        """
        # Input validation and preprocessing
        returns_df = self._preprocess_data(returns)
        
        # Check stationarity and transform if needed
        stationary_returns, stationarity_tests = self._ensure_stationarity(returns_df)
        
        # Select optimal lag length
        optimal_lags = self._select_optimal_lags(stationary_returns)
        
        # Fit VAR model
        fitted_model, convergence_success = self._fit_var_model(stationary_returns, optimal_lags)
        
        # Extract results and validate
        results = self._extract_results(fitted_model, stationarity_tests, convergence_success)
        
        # Store results
        self.results = results
        self.optimal_lags = optimal_lags
        self.n_assets = returns_df.shape[1]
        self.is_fitted = True
        
        logger.info(f"VAR model fitted successfully with {optimal_lags} lags")
        return results
    
    def forecast(self, steps: int, confidence_level: float = 0.95) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate forecasts from fitted VAR model
        
        Args:
            steps: Number of steps to forecast
            confidence_level: Confidence level for prediction intervals
            
        Returns:
            Tuple of (point_forecasts, confidence_intervals)
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before forecasting")
        
        # Generate forecasts
        forecast_result = self.results.model.forecast(
            self.results.model.endog_lagged[-self.optimal_lags:], 
            steps=steps
        )
        
        # Calculate prediction intervals (simplified approach)
        residual_std = np.std(self.results.residuals, axis=0)
        alpha = 1 - confidence_level
        z_score = stats.norm.ppf(1 - alpha/2)
        
        prediction_intervals = np.zeros((steps, self.n_assets, 2))
        for i in range(steps):
            prediction_intervals[i, :, 0] = forecast_result[i] - z_score * residual_std * np.sqrt(i + 1)
            prediction_intervals[i, :, 1] = forecast_result[i] + z_score * residual_std * np.sqrt(i + 1)
        
        return forecast_result, prediction_intervals
    
    def _preprocess_data(self, returns: Union[pd.DataFrame, np.ndarray]) -> pd.DataFrame:
        """Preprocess and validate input data"""
        if isinstance(returns, np.ndarray):
            returns_df = pd.DataFrame(returns)
        else:
            returns_df = returns.copy()
        
        # Remove any infinite or extremely large values
        returns_df = returns_df.replace([np.inf, -np.inf], np.nan)
        returns_df = returns_df.dropna()
        
        # Check minimum observations
        if len(returns_df) < self.min_observations:
            raise ValueError(f"Insufficient data: {len(returns_df)} obs, need {self.min_observations}")
        
        # Winsorize extreme outliers (>5 standard deviations)
        for col in returns_df.columns:
            mean_ret = returns_df[col].mean()
            std_ret = returns_df[col].std()
            
            lower_bound = mean_ret - 5 * std_ret
            upper_bound = mean_ret + 5 * std_ret
            
            returns_df[col] = returns_df[col].clip(lower_bound, upper_bound)
        
        return returns_df
    
    def _ensure_stationarity(self, returns_df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, float]]:
        """Test for stationarity and transform if necessary"""
        stationarity_tests = {}
        stationary_returns = returns_df.copy()
        
        for col in returns_df.columns:
            # Augmented Dickey-Fuller test
            try:
                adf_stat, adf_pvalue, _, _, adf_critical, _ = adfuller(
                    returns_df[col].dropna(), 
                    regression='c', 
                    autolag='AIC'
                )
                
                stationarity_tests[f'{col}_adf_pvalue'] = adf_pvalue
                
                # If not stationary at 5% level, apply first differencing
                if adf_pvalue > self.stationarity_threshold:
                    logger.warning(f"Series {col} not stationary (p={adf_pvalue:.4f}), applying differencing")
                    stationary_returns[col] = returns_df[col].diff().dropna()
                    
                    # Test again after differencing
                    adf_stat2, adf_pvalue2, _, _, _, _ = adfuller(
                        stationary_returns[col].dropna(),
                        regression='c',
                        autolag='AIC'
                    )
                    stationarity_tests[f'{col}_adf_pvalue_diff'] = adf_pvalue2
                    
                    if adf_pvalue2 > self.stationarity_threshold:
                        logger.warning(f"Series {col} still not stationary after differencing")
                
            except Exception as e:
                logger.warning(f"Stationarity test failed for {col}: {e}")
                stationarity_tests[f'{col}_adf_pvalue'] = np.nan
        
        # Remove any remaining NaN values
        stationary_returns = stationary_returns.dropna()
        
        return stationary_returns, stationarity_tests
    
    def _select_optimal_lags(self, returns_df: pd.DataFrame) -> int:
        """Select optimal lag length using information criteria"""
        try:
            # Fit VAR with different lag lengths and compare criteria
            var_model = VAR(returns_df)
            lag_order_results = var_model.select_order(maxlags=self.max_lags)
            
            # Get optimal lags based on selected criterion
            if self.selection_criterion == 'aic':
                optimal_lags = lag_order_results.aic
            elif self.selection_criterion == 'bic':
                optimal_lags = lag_order_results.bic
            elif self.selection_criterion == 'hqic':
                optimal_lags = lag_order_results.hqic
            else:
                raise ValueError(f"Unknown selection criterion: {self.selection_criterion}")
            
            # Ensure we have at least 1 lag
            optimal_lags = max(1, optimal_lags)
            
            logger.info(f"Selected {optimal_lags} lags using {self.selection_criterion}")
            return optimal_lags
            
        except Exception as e:
            logger.warning(f"Lag selection failed: {e}, using default lag=1")
            return 1
    
    def _fit_var_model(self, returns_df: pd.DataFrame, lags: int) -> Tuple[VAR, bool]:
        """Fit VAR model with specified number of lags"""
        try:
            var_model = VAR(returns_df)
            fitted_model = var_model.fit(lags)
            
            # Check convergence
            convergence_success = hasattr(fitted_model, 'llf') and not np.isnan(fitted_model.llf)
            
            return fitted_model, convergence_success
            
        except Exception as e:
            logger.error(f"VAR fitting failed: {e}")
            # Create a simple fallback model (random walk)
            return self._create_fallback_model(returns_df), False
    
    def _create_fallback_model(self, returns_df: pd.DataFrame):
        """Create a simple fallback model when VAR fitting fails"""
        logger.warning("Creating fallback random walk model")
        
        # Simple random walk model: return = 0 + residual
        class FallbackModel:
            def __init__(self, data):
                self.endog = data.values
                self.endog_lagged = data.values
                self.resid = data.values - data.mean().values
                self.llf = np.nan
                self.aic = np.inf
                self.bic = np.inf
                self.hqic = np.inf
                self.fittedvalues = data.values * 0  # Add missing attribute
                self.results = self  # Add missing attribute for compatibility
                
            def forecast(self, lagged_values, steps):
                # Return zeros (random walk assumption)
                return np.zeros((steps, self.endog.shape[1]))
        
        return FallbackModel(returns_df)
    
    def _extract_results(self, fitted_model, stationarity_tests: Dict, convergence_success: bool) -> VARResults:
        """Extract and organize model results"""
        
        # Get basic metrics
        try:
            aic = fitted_model.aic if hasattr(fitted_model, 'aic') else np.inf
            bic = fitted_model.bic if hasattr(fitted_model, 'bic') else np.inf
            hqic = fitted_model.hqic if hasattr(fitted_model, 'hqic') else np.inf
            residuals = fitted_model.resid if hasattr(fitted_model, 'resid') else np.array([])
            fitted_values = fitted_model.fittedvalues if hasattr(fitted_model, 'fittedvalues') else np.array([])
        except:
            aic = bic = hqic = np.inf
            residuals = fitted_values = np.array([])
        
        # Calculate validation metrics
        validation_metrics = self._calculate_validation_metrics(fitted_model, residuals)
        
        return VARResults(
            model=fitted_model,
            fitted_values=fitted_values,
            residuals=residuals,
            aic=aic,
            bic=bic,
            hqic=hqic,
            optimal_lags=self.optimal_lags,
            convergence_success=convergence_success,
            stationarity_tests=stationarity_tests,
            validation_metrics=validation_metrics
        )
    
    def _calculate_validation_metrics(self, model, residuals: np.ndarray) -> Dict[str, float]:
        """Calculate model validation metrics"""
        metrics = {}
        
        try:
            if len(residuals) > 0:
                # R-squared (pseudo)
                if hasattr(model, 'rsquared'):
                    metrics['r_squared'] = np.mean(list(model.rsquared.values()))
                else:
                    metrics['r_squared'] = 0.0
                
                # Residual diagnostics
                metrics['residual_mean'] = np.mean(residuals)
                metrics['residual_std'] = np.std(residuals)
                
                # Ljung-Box test for serial correlation (simplified)
                for i in range(residuals.shape[1]):
                    col_resid = residuals[:, i]
                    if len(col_resid) > 10:
                        # Simple autocorrelation test
                        lag1_corr = np.corrcoef(col_resid[:-1], col_resid[1:])[0, 1]
                        metrics[f'lag1_autocorr_asset_{i}'] = lag1_corr
            
        except Exception as e:
            logger.warning(f"Error calculating validation metrics: {e}")
            metrics['error'] = str(e)
        
        return metrics
    
    def get_residuals(self) -> np.ndarray:
        """Get standardized residuals for bootstrap sampling"""
        if not self.is_fitted:
            raise ValueError("Model must be fitted first")
        
        residuals = self.results.residuals
        
        # Standardize residuals
        residual_means = np.mean(residuals, axis=0)
        residual_stds = np.std(residuals, axis=0)
        
        # Avoid division by zero
        residual_stds = np.where(residual_stds == 0, 1.0, residual_stds)
        
        standardized_residuals = (residuals - residual_means) / residual_stds
        
        return standardized_residuals
    
    def summary(self) -> str:
        """Generate model summary"""
        if not self.is_fitted:
            return "Model not fitted"
        
        summary_lines = [
            "=== VAR Model Summary ===",
            f"Optimal lags: {self.optimal_lags}",
            f"Number of assets: {self.n_assets}",
            f"Convergence: {'Success' if self.results.convergence_success else 'Failed'}",
            f"AIC: {self.results.aic:.4f}",
            f"BIC: {self.results.bic:.4f}",
            f"HQIC: {self.results.hqic:.4f}",
            "",
            "Stationarity Tests (p-values):",
        ]
        
        for test, pvalue in self.results.stationarity_tests.items():
            if not np.isnan(pvalue):
                status = "Stationary" if pvalue < self.stationarity_threshold else "Non-stationary"
                summary_lines.append(f"  {test}: {pvalue:.4f} ({status})")
        
        summary_lines.extend([
            "",
            "Validation Metrics:",
        ])
        
        for metric, value in self.results.validation_metrics.items():
            if isinstance(value, (int, float)) and not np.isnan(value):
                summary_lines.append(f"  {metric}: {value:.4f}")
        
        return "\n".join(summary_lines)