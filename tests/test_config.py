import pytest
import os
import tempfile
from pathlib import Path

from src.utils import Config, load_config


class TestConfig:
    def test_config_creation(self):
        config_dict = {
            "data": {"cache_dir": "test_cache"},
            "analytics": {"risk_free_rate": 0.03}
        }
        
        config = Config(config_dict)
        
        assert config.data.cache_dir == "test_cache"
        assert config.analytics.risk_free_rate == 0.03
    
    def test_config_get(self):
        config_dict = {
            "data": {"cache_dir": "test_cache"},
            "analytics": {"risk_free_rate": 0.03}
        }
        
        config = Config(config_dict)
        
        assert config.get("data.cache_dir") == "test_cache"
        assert config.get("analytics.risk_free_rate") == 0.03
        assert config.get("nonexistent.key", "default") == "default"
    
    def test_config_update(self):
        config_dict = {
            "data": {"cache_dir": "test_cache"},
            "analytics": {"risk_free_rate": 0.03}
        }
        
        config = Config(config_dict)
        config.update({"analytics": {"risk_free_rate": 0.04}})
        
        assert config.analytics.risk_free_rate == 0.04
        assert config.data.cache_dir == "test_cache"  # Unchanged
    
    def test_load_default_config(self):
        config = load_config()
        
        # Check some default values
        assert hasattr(config, "data")
        assert hasattr(config, "portfolio")
        assert hasattr(config, "backtesting")
        assert hasattr(config, "analytics")
        
        assert config.analytics.risk_free_rate == 0.02
        assert config.portfolio.default_initial_cash == 100000
    
    def test_load_config_from_file(self, tmp_path):
        # Create temporary config file
        config_content = """
data:
  cache_dir: "custom_cache"
  cache_ttl_hours: 48

analytics:
  risk_free_rate: 0.025
  periods_per_year: 365
"""
        config_file = tmp_path / "test_config.yaml"
        config_file.write_text(config_content)
        
        config = load_config(str(config_file))
        
        assert config.data.cache_dir == "custom_cache"
        assert config.data.cache_ttl_hours == 48
        assert config.analytics.risk_free_rate == 0.025
        assert config.analytics.periods_per_year == 365
    
    def test_env_overrides(self, monkeypatch):
        # Set environment variables
        monkeypatch.setenv("ETF_RISK_FREE_RATE", "0.035")
        monkeypatch.setenv("ETF_INITIAL_CASH", "50000")
        
        config = load_config()
        
        assert config.analytics.risk_free_rate == 0.035
        assert config.portfolio.default_initial_cash == 50000
    
    def test_explicit_overrides(self):
        overrides = {
            "analytics": {"risk_free_rate": 0.04},
            "portfolio": {"default_initial_cash": 200000}
        }
        
        config = load_config(overrides=overrides)
        
        assert config.analytics.risk_free_rate == 0.04
        assert config.portfolio.default_initial_cash == 200000