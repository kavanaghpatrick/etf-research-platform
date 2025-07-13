import os
import yaml
from pathlib import Path
from typing import Dict, Any, Optional


class Config:
    """Configuration management for the ETF Research Platform."""
    
    def __init__(self, config_dict: Dict[str, Any]):
        self._config = config_dict
        self._flatten_config()
    
    def _flatten_config(self):
        """Make nested config accessible via dot notation."""
        for key, value in self._config.items():
            if isinstance(value, dict):
                setattr(self, key, Config(value))
            else:
                setattr(self, key, value)
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get config value with dot notation support."""
        keys = key.split('.')
        value = self._config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert config back to dictionary."""
        return self._config
    
    def update(self, updates: Dict[str, Any]):
        """Update configuration values."""
        def deep_update(base_dict: dict, update_dict: dict):
            for key, value in update_dict.items():
                if isinstance(value, dict) and key in base_dict and isinstance(base_dict[key], dict):
                    deep_update(base_dict[key], value)
                else:
                    base_dict[key] = value
        
        deep_update(self._config, updates)
        self._flatten_config()


def load_config(config_path: Optional[str] = None, overrides: Optional[Dict[str, Any]] = None) -> Config:
    """
    Load configuration from file and environment variables.
    
    Args:
        config_path: Path to config file. If None, uses default.
        overrides: Dictionary of config overrides.
    
    Returns:
        Config object
    """
    # Determine config file path
    if config_path is None:
        # Look for config in order of precedence
        config_locations = [
            os.environ.get("ETF_CONFIG_PATH"),
            "config/config.yaml",
            "config/default_config.yaml",
            Path(__file__).parent.parent.parent / "config" / "default_config.yaml"
        ]
        
        for location in config_locations:
            if location and Path(location).exists():
                config_path = location
                break
    
    if config_path is None or not Path(config_path).exists():
        # Use defaults if no config file found
        config_dict = _get_default_config()
    else:
        with open(config_path, 'r') as f:
            config_dict = yaml.safe_load(f)
    
    # Apply environment variable overrides
    config_dict = _apply_env_overrides(config_dict)
    
    # Apply explicit overrides
    if overrides:
        def deep_update(base_dict: dict, update_dict: dict):
            for key, value in update_dict.items():
                if isinstance(value, dict) and key in base_dict and isinstance(base_dict[key], dict):
                    deep_update(base_dict[key], value)
                else:
                    base_dict[key] = value
        
        deep_update(config_dict, overrides)
    
    return Config(config_dict)


def _get_default_config() -> Dict[str, Any]:
    """Get default configuration."""
    return {
        "data": {
            "cache_dir": "data/cache",
            "cache_ttl_hours": 24,
            "max_workers": 5,
            "rate_limit_delay": 0.1,
            "retry_attempts": 3,
            "retry_delay": 1.0
        },
        "portfolio": {
            "default_initial_cash": 100000,
            "min_position_size": 0.01,
            "max_position_size": 0.40
        },
        "backtesting": {
            "default_commission": 5.0,
            "default_slippage": 0.001,
            "default_rebalance_frequency": "monthly",
            "min_trade_value": 100
        },
        "analytics": {
            "risk_free_rate": 0.02,
            "periods_per_year": 252,
            "confidence_level": 0.95,
            "monte_carlo_simulations": 10000
        },
        "optimization": {
            "solver_method": "SLSQP",
            "max_iterations": 1000,
            "tolerance": 1e-8
        },
        "visualization": {
            "figure_size": [12, 8],
            "style": "seaborn",
            "dpi": 100,
            "save_format": "png"
        },
        "logging": {
            "level": "INFO",
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "file": "logs/etf_platform.log"
        }
    }


def _apply_env_overrides(config_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Apply environment variable overrides to config."""
    env_mappings = {
        "ETF_RISK_FREE_RATE": ("analytics", "risk_free_rate", float),
        "ETF_INITIAL_CASH": ("portfolio", "default_initial_cash", float),
        "ETF_COMMISSION": ("backtesting", "default_commission", float),
        "ETF_CACHE_DIR": ("data", "cache_dir", str),
        "ETF_LOG_LEVEL": ("logging", "level", str),
    }
    
    for env_var, (section, key, type_func) in env_mappings.items():
        if env_var in os.environ:
            try:
                value = type_func(os.environ[env_var])
                if section not in config_dict:
                    config_dict[section] = {}
                config_dict[section][key] = value
            except ValueError:
                pass  # Ignore invalid environment variables
    
    return config_dict