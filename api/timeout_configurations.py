"""
Comprehensive timeout configuration management for the ETF Research Platform
Based on Grok-4 analysis for production-ready timeout handling
"""

import os
from typing import Dict, Optional
from dataclasses import dataclass
from enum import Enum

class OperationType(Enum):
    """Operation types with different timeout requirements"""
    QUICK_API = "quick_api"          # Health checks, simple queries
    DATA_FETCH = "data_fetch"        # Stock data fetching
    SIMULATION = "simulation"        # Monte Carlo and hybrid simulations
    VALIDATION = "validation"        # Data validation operations
    BENCHMARK = "benchmark"          # Performance benchmarks
    EXTERNAL_API = "external_api"    # Third-party API calls

@dataclass
class TimeoutConfig:
    """Timeout configuration for different operations"""
    connect_timeout: float
    read_timeout: float
    total_timeout: float
    retry_timeout: float
    
    def __post_init__(self):
        """Validate timeout configurations"""
        if self.connect_timeout > self.total_timeout:
            raise ValueError("Connect timeout cannot be greater than total timeout")
        if self.read_timeout > self.total_timeout:
            raise ValueError("Read timeout cannot be greater than total timeout")

class TimeoutManager:
    """Centralized timeout management following Grok-4 recommendations"""
    
    # Base timeout configurations (in seconds)
    BASE_TIMEOUTS = {
        OperationType.QUICK_API: TimeoutConfig(
            connect_timeout=5.0,
            read_timeout=10.0,
            total_timeout=15.0,
            retry_timeout=30.0
        ),
        OperationType.DATA_FETCH: TimeoutConfig(
            connect_timeout=10.0,
            read_timeout=30.0,
            total_timeout=45.0,
            retry_timeout=120.0
        ),
        OperationType.SIMULATION: TimeoutConfig(
            connect_timeout=5.0,
            read_timeout=300.0,  # 5 minutes for long simulations
            total_timeout=600.0,  # 10 minutes total
            retry_timeout=900.0   # 15 minutes with retries
        ),
        OperationType.VALIDATION: TimeoutConfig(
            connect_timeout=5.0,
            read_timeout=120.0,   # 2 minutes for validation
            total_timeout=180.0,  # 3 minutes total
            retry_timeout=300.0   # 5 minutes with retries
        ),
        OperationType.BENCHMARK: TimeoutConfig(
            connect_timeout=10.0,
            read_timeout=600.0,   # 10 minutes for benchmarks
            total_timeout=900.0,  # 15 minutes total
            retry_timeout=1800.0  # 30 minutes with retries
        ),
        OperationType.EXTERNAL_API: TimeoutConfig(
            connect_timeout=10.0,
            read_timeout=60.0,    # 1 minute for external APIs
            total_timeout=90.0,   # 1.5 minutes total
            retry_timeout=180.0   # 3 minutes with retries
        )
    }
    
    # Environment-specific multipliers
    ENV_MULTIPLIERS = {
        "development": 1.0,
        "staging": 1.2,
        "production": 1.5,  # More conservative in production
        "test": 0.5         # Faster timeouts for tests
    }
    
    def __init__(self, environment: Optional[str] = None):
        """Initialize timeout manager with environment-specific adjustments"""
        self.environment = environment or os.getenv("ENVIRONMENT", "development")
        self.multiplier = self.ENV_MULTIPLIERS.get(self.environment, 1.0)
        
        # Adjust timeouts based on environment
        self.timeouts = {}
        for op_type, config in self.BASE_TIMEOUTS.items():
            self.timeouts[op_type] = TimeoutConfig(
                connect_timeout=config.connect_timeout * self.multiplier,
                read_timeout=config.read_timeout * self.multiplier,
                total_timeout=config.total_timeout * self.multiplier,
                retry_timeout=config.retry_timeout * self.multiplier
            )
    
    def get_timeout(self, operation_type: OperationType) -> TimeoutConfig:
        """Get timeout configuration for specific operation type"""
        return self.timeouts[operation_type]
    
    def get_axios_timeout(self, operation_type: OperationType) -> int:
        """Get timeout in milliseconds for Axios configuration"""
        config = self.get_timeout(operation_type)
        return int(config.total_timeout * 1000)
    
    def get_requests_timeout(self, operation_type: OperationType) -> tuple:
        """Get timeout tuple for Python requests library"""
        config = self.get_timeout(operation_type)
        return (config.connect_timeout, config.read_timeout)
    
    def get_httpx_timeout(self, operation_type: OperationType) -> Dict[str, float]:
        """Get timeout configuration for httpx library"""
        config = self.get_timeout(operation_type)
        return {
            "connect": config.connect_timeout,
            "read": config.read_timeout,
            "write": config.read_timeout,
            "pool": config.total_timeout
        }
    
    def get_polling_config(self, operation_type: OperationType) -> Dict[str, float]:
        """Get polling configuration with exponential backoff"""
        config = self.get_timeout(operation_type)
        
        if operation_type == OperationType.SIMULATION:
            return {
                "initial_interval": 2.0,   # Start with 2 seconds
                "max_interval": 30.0,      # Max 30 seconds between polls
                "backoff_factor": 1.5,     # Exponential backoff
                "max_total_time": config.total_timeout,
                "timeout_per_request": min(60.0, config.read_timeout)
            }
        else:
            return {
                "initial_interval": 1.0,
                "max_interval": 10.0,
                "backoff_factor": 2.0,
                "max_total_time": config.total_timeout,
                "timeout_per_request": config.read_timeout
            }
    
    def get_server_timeout(self, operation_type: OperationType) -> float:
        """Get server timeout configuration"""
        config = self.get_timeout(operation_type)
        # Server timeout should be longer than client timeout to allow proper error handling
        return config.total_timeout + 30.0
    
    def validate_timeout_hierarchy(self) -> Dict[str, str]:
        """Validate that timeouts follow proper hierarchy: client < network < server"""
        issues = []
        
        for op_type, config in self.timeouts.items():
            # Check internal hierarchy
            if config.connect_timeout > config.total_timeout:
                issues.append(f"{op_type.value}: connect_timeout > total_timeout")
            
            if config.read_timeout > config.total_timeout:
                issues.append(f"{op_type.value}: read_timeout > total_timeout")
            
            if config.total_timeout > config.retry_timeout:
                issues.append(f"{op_type.value}: total_timeout > retry_timeout")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "environment": self.environment,
            "multiplier": self.multiplier
        }
    
    def get_vercel_compliant_timeout(self, operation_type: OperationType) -> float:
        """Get Vercel-compliant timeout (max 10 seconds for serverless functions)"""
        config = self.get_timeout(operation_type)
        
        # For Vercel deployment, limit to 10 seconds
        if self.environment == "production" and "vercel" in os.getenv("VERCEL_URL", ""):
            return min(8.0, config.total_timeout)  # 8 seconds to be safe
        
        return config.total_timeout
    
    def get_monitoring_config(self) -> Dict[str, float]:
        """Get timeout thresholds for monitoring and alerting"""
        return {
            "warning_threshold": 0.8,    # Warn at 80% of timeout
            "critical_threshold": 0.95,  # Critical at 95% of timeout
            "timeout_percentile": 0.99,  # Monitor 99th percentile
            "alert_frequency": 300.0     # Alert every 5 minutes max
        }

# Global timeout manager instance
timeout_manager = TimeoutManager()

# Helper functions for easy access
def get_simulation_timeout() -> int:
    """Get simulation timeout in milliseconds for frontend"""
    return timeout_manager.get_axios_timeout(OperationType.SIMULATION)

def get_data_fetch_timeout() -> tuple:
    """Get data fetch timeout for Python requests"""
    return timeout_manager.get_requests_timeout(OperationType.DATA_FETCH)

def get_api_timeout() -> int:
    """Get general API timeout in milliseconds"""
    return timeout_manager.get_axios_timeout(OperationType.QUICK_API)

def get_polling_config() -> Dict[str, float]:
    """Get polling configuration for simulation status"""
    return timeout_manager.get_polling_config(OperationType.SIMULATION)

def validate_all_timeouts() -> Dict[str, any]:
    """Validate all timeout configurations"""
    return timeout_manager.validate_timeout_hierarchy()

# Export configuration for use in other modules
__all__ = [
    'TimeoutManager',
    'OperationType', 
    'TimeoutConfig',
    'timeout_manager',
    'get_simulation_timeout',
    'get_data_fetch_timeout',
    'get_api_timeout',
    'get_polling_config',
    'validate_all_timeouts'
]