"""
GPU acceleration module for hybrid econometric simulation
Provides Apple Silicon M4 optimized operations using MLX
"""

from .mlx_gpu_optimizer import MLXGPUOptimizer, mlx_optimizer, GPUPerformanceMetrics

__all__ = [
    'MLXGPUOptimizer',
    'mlx_optimizer',
    'GPUPerformanceMetrics'
]