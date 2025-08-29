"""
Hybrid Econometric Simulation Engine
Production-grade parametric-bootstrap portfolio modeling architecture
"""

__version__ = "1.0.0"
__author__ = "ETF Research Platform Team"

from .models.hybrid_engine import HybridEconometricEngine
from .models.var_model import SimpleVARModel
from .models.garch_model import GARCHVolatilityModel
from .models.bootstrap import StationaryBlockBootstrap
from .utils.numerical_stability import NumericalStabilityHandler
from .validation.distribution_validation import DistributionValidation

__all__ = [
    'HybridEconometricEngine',
    'SimpleVARModel', 
    'GARCHVolatilityModel',
    'StationaryBlockBootstrap',
    'NumericalStabilityHandler',
    'DistributionValidation'
]