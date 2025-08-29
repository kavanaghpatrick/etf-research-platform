"""
Enhanced Sampling Methods for Monte Carlo Simulations
Provides more robust sampling for limited data scenarios
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional
from scipy import stats
import logging

# Try to import sklearn, but make it optional
try:
    from sklearn.mixture import GaussianMixture
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    logging.warning("scikit-learn not available, regime detection will use simplified method")

logger = logging.getLogger(__name__)


class EnhancedSampler:
    """Enhanced sampling methods for Monte Carlo simulations with limited data."""
    
    def __init__(self):
        self.min_data_years = 5  # Minimum years needed for parametric fitting
        self.regime_threshold = 0.02  # 2% monthly return threshold for regime detection
        
    def detect_market_regimes(self, returns: np.ndarray, n_regimes: int = 3) -> Tuple[np.ndarray, Dict]:
        """
        Detect market regimes using Gaussian Mixture Model or simple quantile-based method.
        
        Args:
            returns: Daily returns array
            n_regimes: Number of regimes to detect (default: 3 for bull/bear/neutral)
            
        Returns:
            Tuple of (regime_labels, regime_params)
        """
        try:
            # Convert daily returns to monthly for more stable regime detection
            monthly_returns = self._to_monthly_returns(returns)
            
            if len(monthly_returns) < 24:  # Need at least 2 years of monthly data
                logger.warning("Insufficient data for regime detection, using single regime")
                return np.zeros(len(returns)), {"single_regime": True}
            
            if HAS_SKLEARN:
                # Use Gaussian Mixture Model for sophisticated regime detection
                gmm = GaussianMixture(n_components=n_regimes, covariance_type='full', 
                                     random_state=42, n_init=10)
                
                # Reshape for sklearn
                monthly_returns_reshaped = monthly_returns.reshape(-1, 1)
                gmm.fit(monthly_returns_reshaped)
                
                # Get regime labels for monthly data
                monthly_regimes = gmm.predict(monthly_returns_reshaped)
                
                # Extract parameters
                means = gmm.means_.flatten()
                variances = gmm.covariances_.flatten()
                weights = gmm.weights_
            else:
                # Fallback: Use quantile-based regime detection
                if n_regimes == 3:
                    # Use 33rd and 67th percentiles
                    thresholds = np.percentile(monthly_returns, [33, 67])
                    monthly_regimes = np.zeros(len(monthly_returns))
                    monthly_regimes[monthly_returns < thresholds[0]] = 0  # Bear
                    monthly_regimes[(monthly_returns >= thresholds[0]) & (monthly_returns < thresholds[1])] = 1  # Neutral
                    monthly_regimes[monthly_returns >= thresholds[1]] = 2  # Bull
                else:
                    # Equal quantiles for other numbers of regimes
                    quantiles = np.linspace(0, 100, n_regimes + 1)
                    thresholds = np.percentile(monthly_returns, quantiles[1:-1])
                    monthly_regimes = np.digitize(monthly_returns, thresholds)
                
                # Calculate means and variances for each regime
                means = []
                variances = []
                weights = []
                for i in range(n_regimes):
                    regime_returns = monthly_returns[monthly_regimes == i]
                    if len(regime_returns) > 0:
                        means.append(np.mean(regime_returns))
                        variances.append(np.var(regime_returns))
                        weights.append(len(regime_returns) / len(monthly_returns))
                    else:
                        means.append(0)
                        variances.append(1)
                        weights.append(0)
                
                means = np.array(means)
                variances = np.array(variances)
                weights = np.array(weights)
            
            # Expand monthly regimes back to daily
            daily_regimes = np.repeat(monthly_regimes, 21)  # ~21 trading days per month
            daily_regimes = daily_regimes[:len(returns)]  # Trim to exact length
            
            # Sort regimes by mean return (0=bear, 1=neutral, 2=bull)
            sorted_indices = np.argsort(means)
            regime_mapping = {old: new for new, old in enumerate(sorted_indices)}
            daily_regimes = np.array([regime_mapping[r] for r in daily_regimes])
            
            regime_params = {
                'n_regimes': n_regimes,
                'means': means[sorted_indices],
                'variances': variances[sorted_indices],
                'weights': weights[sorted_indices],
                'bear_mean': means[sorted_indices[0]],
                'neutral_mean': means[sorted_indices[1]] if n_regimes > 2 else 0,
                'bull_mean': means[sorted_indices[-1]]
            }
            
            logger.info(f"Detected {n_regimes} market regimes:")
            logger.info(f"  Bear: μ={regime_params['bear_mean']*100:.1f}% monthly")
            if n_regimes > 2:
                logger.info(f"  Neutral: μ={regime_params['neutral_mean']*100:.1f}% monthly")
            logger.info(f"  Bull: μ={regime_params['bull_mean']*100:.1f}% monthly")
            
            return daily_regimes, regime_params
            
        except Exception as e:
            logger.error(f"Error in regime detection: {e}")
            return np.zeros(len(returns)), {"error": str(e)}
    
    def fit_student_t_distribution(self, returns: np.ndarray) -> Dict[str, float]:
        """
        Fit Student-t distribution to capture fat tails better than normal distribution.
        
        Args:
            returns: Daily returns array
            
        Returns:
            Dictionary with distribution parameters
        """
        try:
            # Fit Student-t distribution
            params = stats.t.fit(returns)
            df, loc, scale = params
            
            # Calculate goodness of fit
            ks_stat, p_value = stats.kstest(returns, lambda x: stats.t.cdf(x, df, loc, scale))
            
            return {
                'distribution': 'student_t',
                'df': df,  # degrees of freedom (lower = fatter tails)
                'loc': loc,  # mean
                'scale': scale,  # standard deviation
                'daily_vol': scale,
                'annual_vol': scale * np.sqrt(252),
                'ks_stat': ks_stat,
                'p_value': p_value,
                'fat_tails': df < 10  # Significant fat tails if df < 10
            }
        except Exception as e:
            logger.error(f"Error fitting Student-t distribution: {e}")
            # Fallback to normal distribution
            return {
                'distribution': 'normal',
                'loc': np.mean(returns),
                'scale': np.std(returns),
                'daily_vol': np.std(returns),
                'annual_vol': np.std(returns) * np.sqrt(252)
            }
    
    def generate_regime_aware_scenarios(self, 
                                      historical_returns: np.ndarray,
                                      n_scenarios: int,
                                      scenario_length: int,
                                      block_size: int = 21) -> np.ndarray:
        """
        Generate scenarios using regime-aware block bootstrap.
        
        Args:
            historical_returns: Historical daily returns
            n_scenarios: Number of scenarios to generate
            scenario_length: Length of each scenario in days
            block_size: Size of blocks for bootstrap (default: 21 days = 1 month)
            
        Returns:
            Array of simulated return paths
        """
        # Detect regimes
        regimes, regime_params = self.detect_market_regimes(historical_returns)
        
        if regime_params.get("single_regime", False):
            # Fallback to standard block bootstrap
            return self._standard_block_bootstrap(historical_returns, n_scenarios, 
                                                scenario_length, block_size)
        
        # Separate returns by regime
        regime_returns = {}
        regime_indices = {}
        
        # Ensure regimes array matches historical_returns length
        if len(regimes) != len(historical_returns):
            logger.warning(f"Regime array length mismatch: {len(regimes)} vs {len(historical_returns)}")
            # Trim or extend to match
            if len(regimes) > len(historical_returns):
                regimes = regimes[:len(historical_returns)]
            else:
                # Extend by repeating last regime
                last_regime = regimes[-1]
                regimes = np.concatenate([regimes, np.full(len(historical_returns) - len(regimes), last_regime)])
        
        for regime in range(regime_params['n_regimes']):
            mask = regimes == regime
            regime_returns[regime] = historical_returns[mask]
            regime_indices[regime] = np.where(mask)[0]
        
        # Generate scenarios
        scenarios = np.zeros((n_scenarios, scenario_length))
        
        for i in range(n_scenarios):
            scenario = []
            current_pos = 0
            
            while current_pos < scenario_length:
                # Randomly select regime based on historical frequencies
                regime_probs = regime_params['weights']
                selected_regime = np.random.choice(regime_params['n_regimes'], p=regime_probs)
                
                # Sample block from selected regime
                regime_data = regime_returns[selected_regime]
                if len(regime_data) > block_size:
                    start_idx = np.random.randint(0, len(regime_data) - block_size)
                    block = regime_data[start_idx:start_idx + block_size]
                else:
                    # If regime has limited data, use what's available
                    block = np.random.choice(regime_data, size=block_size, replace=True)
                
                scenario.extend(block)
                current_pos += block_size
            
            scenarios[i] = np.array(scenario[:scenario_length])
        
        return scenarios
    
    def generate_parametric_scenarios(self,
                                    historical_returns: np.ndarray,
                                    n_scenarios: int,
                                    scenario_length: int) -> np.ndarray:
        """
        Generate scenarios using fitted Student-t distribution.
        
        Args:
            historical_returns: Historical daily returns
            n_scenarios: Number of scenarios to generate
            scenario_length: Length of each scenario in days
            
        Returns:
            Array of simulated return paths
        """
        # Fit distribution
        dist_params = self.fit_student_t_distribution(historical_returns)
        
        scenarios = np.zeros((n_scenarios, scenario_length))
        
        if dist_params['distribution'] == 'student_t':
            # Generate from Student-t distribution
            for i in range(n_scenarios):
                scenarios[i] = stats.t.rvs(
                    df=dist_params['df'],
                    loc=dist_params['loc'], 
                    scale=dist_params['scale'],
                    size=scenario_length
                )
        else:
            # Fallback to normal distribution
            for i in range(n_scenarios):
                scenarios[i] = np.random.normal(
                    loc=dist_params['loc'],
                    scale=dist_params['scale'],
                    size=scenario_length
                )
        
        return scenarios
    
    def generate_hybrid_scenarios(self,
                                historical_returns: np.ndarray,
                                n_scenarios: int,
                                scenario_length: int,
                                historical_weight: float = 0.7) -> np.ndarray:
        """
        Generate scenarios using hybrid approach (historical + parametric).
        
        Args:
            historical_returns: Historical daily returns
            n_scenarios: Number of scenarios to generate
            scenario_length: Length of each scenario in days
            historical_weight: Weight given to historical sampling (vs parametric)
            
        Returns:
            Array of simulated return paths
        """
        n_historical = int(n_scenarios * historical_weight)
        n_parametric = n_scenarios - n_historical
        
        # Generate historical scenarios (regime-aware)
        historical_scenarios = self.generate_regime_aware_scenarios(
            historical_returns, n_historical, scenario_length
        )
        
        # Generate parametric scenarios
        parametric_scenarios = self.generate_parametric_scenarios(
            historical_returns, n_parametric, scenario_length
        )
        
        # Combine scenarios
        all_scenarios = np.vstack([historical_scenarios, parametric_scenarios])
        
        # Shuffle to mix historical and parametric
        np.random.shuffle(all_scenarios)
        
        return all_scenarios
    
    def _to_monthly_returns(self, daily_returns: np.ndarray) -> np.ndarray:
        """Convert daily returns to monthly returns."""
        # Approximate: compound returns over 21 trading days
        monthly_returns = []
        for i in range(0, len(daily_returns) - 21, 21):
            month_compound = np.prod(1 + daily_returns[i:i+21]) - 1
            monthly_returns.append(month_compound)
        return np.array(monthly_returns)
    
    def _standard_block_bootstrap(self, returns: np.ndarray, 
                                n_scenarios: int, scenario_length: int,
                                block_size: int) -> np.ndarray:
        """Standard block bootstrap fallback."""
        scenarios = np.zeros((n_scenarios, scenario_length))
        max_start = len(returns) - block_size
        
        for i in range(n_scenarios):
            scenario = []
            while len(scenario) < scenario_length:
                start_idx = np.random.randint(0, max_start)
                block = returns[start_idx:start_idx + block_size]
                scenario.extend(block)
            scenarios[i] = np.array(scenario[:scenario_length])
        
        return scenarios


def recommend_sampling_method(years_of_data: float, 
                            portfolio_size: int,
                            volatility: float) -> Dict[str, any]:
    """
    Recommend best sampling method based on data characteristics.
    
    Args:
        years_of_data: Years of historical data available
        portfolio_size: Number of assets in portfolio
        volatility: Annual volatility of portfolio
        
    Returns:
        Dictionary with recommended method and parameters
    """
    if years_of_data < 5:
        # Very limited data - use parametric with strong priors
        return {
            'method': 'parametric_student_t',
            'reason': 'Insufficient data for historical sampling',
            'params': {
                'use_sector_priors': True,
                'min_df': 4  # Enforce fat tails
            }
        }
    elif years_of_data < 10:
        # Limited data - use hybrid approach
        return {
            'method': 'hybrid',
            'reason': 'Limited data benefits from parametric augmentation',
            'params': {
                'historical_weight': 0.6,
                'block_size': 63  # 3 months
            }
        }
    elif years_of_data < 20:
        # Moderate data - use regime-aware bootstrap
        return {
            'method': 'regime_aware_bootstrap',
            'reason': 'Sufficient data for regime detection',
            'params': {
                'n_regimes': 3,
                'block_size': 126  # 6 months
            }
        }
    else:
        # Abundant data - standard block bootstrap is fine
        return {
            'method': 'block_bootstrap',
            'reason': 'Sufficient data for standard methods',
            'params': {
                'block_size': 252  # 1 year
            }
        }