"""
GARCH Volatility Model Implementation
Provides volatility forecasting for the hybrid econometric simulation engine
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Union
from dataclasses import dataclass
import logging
from arch import arch_model
from arch.univariate import ConstantMean, GARCH, Normal
import warnings
from scipy import stats

warnings.filterwarnings('ignore', category=UserWarning)

logger = logging.getLogger(__name__)


@dataclass
class GARCHResults:
    """Results from GARCH model fitting and validation"""
    model: object
    fitted_values: np.ndarray
    conditional_volatility: np.ndarray
    standardized_residuals: np.ndarray
    params: Dict[str, float]
    aic: float
    bic: float
    convergence_success: bool
    arch_test_pvalue: float
    ljung_box_pvalue: float


class GARCHVolatilityModel:
    """
    GARCH(1,1) Volatility Model with robust estimation
    
    Features:
    - GARCH(1,1) with automatic parameter estimation
    - Robust convergence handling with fallbacks
    - ARCH effect testing and validation
    - Multiple distribution support (Normal, t, skewed-t)
    """
    
    def __init__(self, 
                 p: int = 1,
                 q: int = 1,
                 distribution: str = 'normal',
                 max_iter: int = 1000,
                 fallback_method: str = 'ewma'):
        """
        Initialize GARCH model
        
        Args:
            p: Order of GARCH terms
            q: Order of ARCH terms  
            distribution: Error distribution ('normal', 't', 'skewt')
            max_iter: Maximum iterations for optimization
            fallback_method: Fallback when convergence fails ('ewma', 'constant')
        """
        self.p = p
        self.q = q
        # Handle both string and object distributions
        if isinstance(distribution, str):
            self.distribution = distribution.lower()
        else:
            # Convert distribution objects to string names
            if hasattr(distribution, '__name__'):
                self.distribution = distribution.__name__.lower()
            elif str(distribution.__class__.__name__).lower() == 'normal':
                self.distribution = 'normal'
            else:
                self.distribution = str(distribution).lower()
        self.max_iter = max_iter
        self.fallback_method = fallback_method
        
        self.is_fitted = False
        self.results = None
        self.fallback_used = False
        
        logger.info(f"Initialized GARCH({p},{q}) model with {distribution} distribution")
    
    def fit(self, returns: Union[pd.Series, np.ndarray]) -> GARCHResults:
        """
        Fit GARCH model to return series
        
        Args:
            returns: Asset returns (1D array or Series)
            
        Returns:
            GARCHResults object with fitted model and diagnostics
        """
        # Preprocess data
        returns_clean = self._preprocess_returns(returns)
        
        # Try fitting GARCH model
        try:
            garch_result = self._fit_garch_model(returns_clean)
            convergence_success = True
            self.fallback_used = False
            logger.info("GARCH model fitted successfully")
            
        except Exception as e:
            logger.warning(f"GARCH fitting failed: {e}, using fallback method")
            garch_result = self._fit_fallback_model(returns_clean)
            convergence_success = False
            self.fallback_used = True
        
        # Extract results and validate
        results = self._extract_results(garch_result, returns_clean, convergence_success)
        
        # Store results
        self.results = results
        self.is_fitted = True
        
        return results
    
    def forecast_volatility(self, horizon: int) -> np.ndarray:
        """
        Forecast conditional volatility
        
        Args:
            horizon: Number of periods to forecast
            
        Returns:
            Array of volatility forecasts
        """
        if not self.is_fitted:
            raise ValueError("Model must be fitted before forecasting")
        
        if self.fallback_used:
            return self._forecast_fallback_volatility(horizon)
        
        try:
            # Use GARCH model for forecasting
            forecast_result = self.results.model.forecast(horizon=horizon)
            variance_forecast = forecast_result.variance.values[-1, :]
            volatility_forecast = np.sqrt(variance_forecast)
            
            return volatility_forecast
            
        except Exception as e:
            logger.warning(f"GARCH forecasting failed: {e}, using fallback")
            return self._forecast_fallback_volatility(horizon)
    
    def get_standardized_residuals(self) -> np.ndarray:
        """Get standardized residuals for bootstrap sampling"""
        if not self.is_fitted:
            raise ValueError("Model must be fitted first")
        
        return self.results.standardized_residuals
    
    def _preprocess_returns(self, returns: Union[pd.Series, np.ndarray]) -> pd.Series:
        """Preprocess and clean return data"""
        if isinstance(returns, np.ndarray):
            returns_series = pd.Series(returns)
        else:
            returns_series = returns.copy()
        
        # Remove NaN and infinite values
        returns_series = returns_series.replace([np.inf, -np.inf], np.nan)
        returns_series = returns_series.dropna()
        
        # Check for sufficient data
        if len(returns_series) < 100:
            raise ValueError(f"Insufficient data: {len(returns_series)} observations, need at least 100")
        
        # Convert to percentage returns if needed (detect if returns are in decimal form)
        if returns_series.std() < 0.01:
            logger.info("Converting returns from decimal to percentage form")
            returns_series = returns_series * 100
        
        # Winsorize extreme outliers (>6 standard deviations)
        mean_ret = returns_series.mean()
        std_ret = returns_series.std()
        
        lower_bound = mean_ret - 6 * std_ret
        upper_bound = mean_ret + 6 * std_ret
        
        returns_series = returns_series.clip(lower_bound, upper_bound)
        
        return returns_series
    
    def _fit_garch_model(self, returns: pd.Series):
        """Fit GARCH model with specified parameters"""
        
        # Create GARCH model
        if self.distribution == 'normal':
            dist = Normal()
        elif self.distribution == 't':
            from arch.univariate import StudentsT
            dist = StudentsT()
        elif self.distribution == 'skewt':
            from arch.univariate import SkewStudent
            dist = SkewStudent()
        else:
            logger.warning(f"Unknown distribution {self.distribution}, using Normal")
            dist = Normal()
        
        # Build model
        model = arch_model(
            returns, 
            vol='GARCH', 
            p=self.p, 
            q=self.q,
            dist=dist,
            mean='Constant'
        )
        
        # Fit model with optimization options
        fitted_model = model.fit(
            update_freq=0,  # Suppress output
            disp='off',
            options={'maxiter': self.max_iter}
        )
        
        # Check convergence
        if not fitted_model.convergence_flag:
            raise ValueError("GARCH optimization did not converge")
        
        return fitted_model
    
    def _fit_fallback_model(self, returns: pd.Series):
        """Fit fallback volatility model when GARCH fails"""
        
        if self.fallback_method == 'ewma':
            return self._fit_ewma_model(returns)
        elif self.fallback_method == 'constant':
            return self._fit_constant_volatility(returns)
        else:
            raise ValueError(f"Unknown fallback method: {self.fallback_method}")
    
    def _fit_ewma_model(self, returns: pd.Series, lambda_param: float = 0.94):
        """Fit Exponentially Weighted Moving Average volatility model"""
        logger.info("Fitting EWMA fallback model")
        
        # Calculate EWMA volatility
        ewma_var = returns.ewm(alpha=1-lambda_param).var()
        ewma_vol = np.sqrt(ewma_var)
        
        # Create mock model object for consistency
        class EWMAModel:
            def __init__(self, returns, volatility):
                self.returns = returns
                self.conditional_volatility = volatility
                self.resid = returns / volatility  # Standardized residuals
                self.params = {'lambda': lambda_param}
                self.aic = np.nan
                self.bic = np.nan
                self.llf = np.nan
                self.convergence_flag = True
                
            def forecast(self, horizon):
                # Simple persistence forecast
                last_vol = self.conditional_volatility.iloc[-1]
                forecast_vol = np.full(horizon, last_vol)
                
                class ForecastResult:
                    def __init__(self, vol_forecast):
                        self.variance = pd.DataFrame(vol_forecast**2)
                
                return ForecastResult(forecast_vol)
        
        return EWMAModel(returns, ewma_vol)
    
    def _fit_constant_volatility(self, returns: pd.Series):
        """Fit constant volatility model (historical standard deviation)"""
        logger.info("Fitting constant volatility fallback model")
        
        # Calculate historical volatility
        hist_vol = returns.std()
        constant_vol = pd.Series(np.full(len(returns), hist_vol), index=returns.index)
        
        # Create mock model object
        class ConstantVolModel:
            def __init__(self, returns, volatility):
                self.returns = returns
                self.conditional_volatility = volatility
                self.resid = returns / volatility  # Standardized residuals
                self.params = {'constant_vol': volatility.iloc[0]}
                self.aic = np.nan
                self.bic = np.nan
                self.llf = np.nan
                self.convergence_flag = True
                
            def forecast(self, horizon):
                # Constant forecast
                forecast_vol = np.full(horizon, self.params['constant_vol'])
                
                class ForecastResult:
                    def __init__(self, vol_forecast):
                        self.variance = pd.DataFrame(vol_forecast**2)
                
                return ForecastResult(forecast_vol)
        
        return ConstantVolModel(returns, constant_vol)
    
    def _extract_results(self, fitted_model, returns: pd.Series, convergence_success: bool) -> GARCHResults:
        """Extract and organize GARCH model results"""
        
        # Get basic results
        try:
            fitted_values = fitted_model.fittedvalues if hasattr(fitted_model, 'fittedvalues') else returns.mean()
            conditional_volatility = fitted_model.conditional_volatility
            standardized_residuals = fitted_model.resid
            
            # Handle scalar fitted values
            if np.isscalar(fitted_values):
                fitted_values = pd.Series(np.full(len(returns), fitted_values), index=returns.index)
            
            params = fitted_model.params if hasattr(fitted_model, 'params') else {}
            aic = fitted_model.aic if hasattr(fitted_model, 'aic') else np.nan
            bic = fitted_model.bic if hasattr(fitted_model, 'bic') else np.nan
            
        except Exception as e:
            logger.warning(f"Error extracting GARCH results: {e}")
            fitted_values = pd.Series(np.full(len(returns), returns.mean()), index=returns.index)
            conditional_volatility = pd.Series(np.full(len(returns), returns.std()), index=returns.index)
            standardized_residuals = returns / returns.std()
            params = {}
            aic = bic = np.nan
        
        # Calculate diagnostic tests
        arch_test_pvalue = self._arch_test(standardized_residuals)
        ljung_box_pvalue = self._ljung_box_test(standardized_residuals)
        
        return GARCHResults(
            model=fitted_model,
            fitted_values=fitted_values.values if hasattr(fitted_values, 'values') else fitted_values,
            conditional_volatility=conditional_volatility.values if hasattr(conditional_volatility, 'values') else conditional_volatility,
            standardized_residuals=standardized_residuals.values if hasattr(standardized_residuals, 'values') else standardized_residuals,
            params=params,
            aic=aic,
            bic=bic,
            convergence_success=convergence_success,
            arch_test_pvalue=arch_test_pvalue,
            ljung_box_pvalue=ljung_box_pvalue
        )
    
    def _arch_test(self, residuals: Union[pd.Series, np.ndarray], lags: int = 5) -> float:
        """Simplified ARCH test for heteroscedasticity"""
        try:
            if isinstance(residuals, pd.Series):
                residuals = residuals.values
            
            # Square the residuals
            squared_residuals = residuals ** 2
            
            # Simple test: correlation between current squared residuals and lagged ones
            if len(squared_residuals) > lags + 10:
                corr_sum = 0
                for lag in range(1, lags + 1):
                    if len(squared_residuals) > lag:
                        corr = np.corrcoef(squared_residuals[lag:], squared_residuals[:-lag])[0, 1]
                        if not np.isnan(corr):
                            corr_sum += abs(corr)
                
                # Convert to approximate p-value (simplified)
                test_stat = corr_sum * np.sqrt(len(squared_residuals))
                p_value = 2 * (1 - stats.norm.cdf(abs(test_stat)))
                return min(p_value, 1.0)
            
        except Exception as e:
            logger.warning(f"ARCH test failed: {e}")
        
        return np.nan
    
    def _ljung_box_test(self, residuals: Union[pd.Series, np.ndarray], lags: int = 10) -> float:
        """Simplified Ljung-Box test for serial correlation"""
        try:
            if isinstance(residuals, pd.Series):
                residuals = residuals.values
            
            n = len(residuals)
            if n <= lags + 5:
                return np.nan
            
            # Calculate autocorrelations
            autocorrs = []
            for lag in range(1, lags + 1):
                if n > lag:
                    corr = np.corrcoef(residuals[lag:], residuals[:-lag])[0, 1]
                    if not np.isnan(corr):
                        autocorrs.append(corr)
            
            if len(autocorrs) > 0:
                # Simplified Ljung-Box statistic
                lb_stat = n * (n + 2) * sum([(ac**2) / (n - k - 1) for k, ac in enumerate(autocorrs)])
                p_value = 1 - stats.chi2.cdf(lb_stat, len(autocorrs))
                return p_value
            
        except Exception as e:
            logger.warning(f"Ljung-Box test failed: {e}")
        
        return np.nan
    
    def _forecast_fallback_volatility(self, horizon: int) -> np.ndarray:
        """Forecast volatility using fallback method"""
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        
        # Get last volatility value
        last_vol = self.results.conditional_volatility[-1]
        
        if self.fallback_method == 'ewma':
            # Simple persistence for EWMA
            forecast_vol = np.full(horizon, last_vol)
        elif self.fallback_method == 'constant':
            # Constant volatility
            forecast_vol = np.full(horizon, last_vol)
        else:
            # Default to constant
            forecast_vol = np.full(horizon, last_vol)
        
        return forecast_vol
    
    def summary(self) -> str:
        """Generate model summary"""
        if not self.is_fitted:
            return "Model not fitted"
        
        summary_lines = [
            f"=== GARCH({self.p},{self.q}) Model Summary ===",
            f"Distribution: {self.distribution}",
            f"Convergence: {'Success' if self.results.convergence_success else 'Failed (Fallback used)'}",
            f"Fallback method: {self.fallback_method if self.fallback_used else 'Not used'}",
            f"AIC: {self.results.aic:.4f}" if not np.isnan(self.results.aic) else "AIC: N/A",
            f"BIC: {self.results.bic:.4f}" if not np.isnan(self.results.bic) else "BIC: N/A",
            "",
            "Parameters:",
        ]
        
        for param, value in self.results.params.items():
            if isinstance(value, (int, float)):
                summary_lines.append(f"  {param}: {value:.6f}")
        
        summary_lines.extend([
            "",
            "Diagnostic Tests:",
            f"ARCH test p-value: {self.results.arch_test_pvalue:.4f}" if not np.isnan(self.results.arch_test_pvalue) else "ARCH test: N/A",
            f"Ljung-Box p-value: {self.results.ljung_box_pvalue:.4f}" if not np.isnan(self.results.ljung_box_pvalue) else "Ljung-Box test: N/A",
        ])
        
        return "\n".join(summary_lines)