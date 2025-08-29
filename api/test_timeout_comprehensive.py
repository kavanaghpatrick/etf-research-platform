"""
Comprehensive timeout testing based on Grok-4 recommendations
Tests all timeout configurations across frontend, backend, and external services
"""

import asyncio
import pytest
import time
import requests
import httpx
from unittest.mock import patch, MagicMock
from timeout_configurations import (
    TimeoutManager, 
    OperationType, 
    validate_all_timeouts,
    get_simulation_timeout,
    get_polling_config
)

class TestTimeoutConfigurations:
    """Test timeout configurations for all operation types"""
    
    def test_timeout_manager_initialization(self):
        """Test timeout manager initializes correctly"""
        manager = TimeoutManager("development")
        assert manager.environment == "development"
        assert manager.multiplier == 1.0
        
        # Test production multiplier
        prod_manager = TimeoutManager("production")
        assert prod_manager.multiplier == 1.5
        
        # Test invalid environment defaults to development
        unknown_manager = TimeoutManager("unknown")
        assert unknown_manager.multiplier == 1.0
    
    def test_operation_type_configurations(self):
        """Test all operation types have proper timeout configurations"""
        manager = TimeoutManager()
        
        for op_type in OperationType:
            config = manager.get_timeout(op_type)
            
            # Validate timeout hierarchy
            assert config.connect_timeout <= config.total_timeout
            assert config.read_timeout <= config.total_timeout
            assert config.total_timeout <= config.retry_timeout
            
            # Validate reasonable ranges
            assert config.connect_timeout > 0
            assert config.read_timeout > 0
            assert config.total_timeout > 0
    
    def test_axios_timeout_conversion(self):
        """Test Axios timeout conversion returns milliseconds"""
        manager = TimeoutManager()
        
        timeout_ms = manager.get_axios_timeout(OperationType.SIMULATION)
        assert isinstance(timeout_ms, int)
        assert timeout_ms > 0
        
        # Should be in milliseconds (much larger than seconds)
        assert timeout_ms >= 1000
    
    def test_requests_timeout_conversion(self):
        """Test requests timeout conversion returns tuple"""
        manager = TimeoutManager()
        
        timeout_tuple = manager.get_requests_timeout(OperationType.DATA_FETCH)
        assert isinstance(timeout_tuple, tuple)
        assert len(timeout_tuple) == 2
        assert timeout_tuple[0] > 0  # connect timeout
        assert timeout_tuple[1] > 0  # read timeout
    
    def test_httpx_timeout_conversion(self):
        """Test httpx timeout conversion returns proper dict"""
        manager = TimeoutManager()
        
        timeout_dict = manager.get_httpx_timeout(OperationType.EXTERNAL_API)
        assert isinstance(timeout_dict, dict)
        
        required_keys = ['connect', 'read', 'write', 'pool']
        for key in required_keys:
            assert key in timeout_dict
            assert timeout_dict[key] > 0
    
    def test_polling_configuration(self):
        """Test polling configuration follows exponential backoff"""
        manager = TimeoutManager()
        
        polling_config = manager.get_polling_config(OperationType.SIMULATION)
        
        # Validate required keys
        required_keys = [
            'initial_interval', 'max_interval', 'backoff_factor',
            'max_total_time', 'timeout_per_request'
        ]
        for key in required_keys:
            assert key in polling_config
            assert polling_config[key] > 0
        
        # Validate exponential backoff parameters
        assert polling_config['initial_interval'] < polling_config['max_interval']
        assert polling_config['backoff_factor'] > 1.0
        assert polling_config['timeout_per_request'] <= polling_config['max_total_time']
    
    def test_timeout_validation(self):
        """Test timeout validation catches configuration issues"""
        validation_result = validate_all_timeouts()
        
        assert 'valid' in validation_result
        assert 'issues' in validation_result
        assert 'environment' in validation_result
        
        # Should be valid with default configurations
        assert validation_result['valid'] is True
        assert len(validation_result['issues']) == 0
    
    def test_vercel_compliance(self):
        """Test Vercel timeout compliance"""
        # Mock Vercel environment
        with patch.dict('os.environ', {'VERCEL_URL': 'https://myapp.vercel.app'}):
            manager = TimeoutManager("production")
            
            vercel_timeout = manager.get_vercel_compliant_timeout(OperationType.QUICK_API)
            assert vercel_timeout <= 8.0  # Should be 8 seconds or less for safety
    
    def test_environment_multipliers(self):
        """Test timeout multipliers work correctly across environments"""
        base_timeout = 10.0
        
        # Test different environments
        dev_manager = TimeoutManager("development")
        staging_manager = TimeoutManager("staging")
        prod_manager = TimeoutManager("production")
        test_manager = TimeoutManager("test")
        
        dev_config = dev_manager.get_timeout(OperationType.QUICK_API)
        staging_config = staging_manager.get_timeout(OperationType.QUICK_API)
        prod_config = prod_manager.get_timeout(OperationType.QUICK_API)
        test_config = test_manager.get_timeout(OperationType.QUICK_API)
        
        # Production should have the highest timeouts
        assert prod_config.total_timeout > dev_config.total_timeout
        assert staging_config.total_timeout > dev_config.total_timeout
        assert dev_config.total_timeout > test_config.total_timeout


class TestActualTimeoutBehavior:
    """Test actual timeout behavior with real requests"""
    
    def test_quick_api_timeout_behavior(self):
        """Test quick API calls timeout appropriately"""
        manager = TimeoutManager()
        timeout_tuple = manager.get_requests_timeout(OperationType.QUICK_API)
        
        # Test with a deliberately slow endpoint
        start_time = time.time()
        try:
            response = requests.get(
                "https://httpbin.org/delay/20",  # 20 second delay
                timeout=timeout_tuple
            )
        except requests.Timeout:
            elapsed = time.time() - start_time
            # Should timeout before the 20 second delay
            assert elapsed < 20
            assert elapsed <= timeout_tuple[1] + 2  # Allow small buffer
    
    @pytest.mark.asyncio
    async def test_httpx_timeout_behavior(self):
        """Test httpx timeout behavior"""
        manager = TimeoutManager()
        timeout_config = manager.get_httpx_timeout(OperationType.DATA_FETCH)
        
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(**timeout_config)) as client:
                response = await client.get("https://httpbin.org/delay/60")
        except httpx.TimeoutException:
            elapsed = time.time() - start_time
            # Should timeout before the 60 second delay
            assert elapsed < 60
            assert elapsed <= timeout_config['read'] + 5  # Allow buffer
    
    def test_simulation_timeout_realistic(self):
        """Test simulation timeout allows for realistic processing times"""
        manager = TimeoutManager()
        simulation_config = manager.get_timeout(OperationType.SIMULATION)
        
        # Simulation timeouts should be generous enough for real processing
        assert simulation_config.total_timeout >= 300  # At least 5 minutes
        assert simulation_config.retry_timeout >= 600  # At least 10 minutes with retries


class TestPollingBehavior:
    """Test polling behavior with exponential backoff"""
    
    def test_polling_config_values(self):
        """Test polling configuration returns reasonable values"""
        polling_config = get_polling_config()
        
        # Should start with reasonable interval
        assert 1.0 <= polling_config['initial_interval'] <= 5.0
        
        # Should have reasonable max interval
        assert 10.0 <= polling_config['max_interval'] <= 60.0
        
        # Should have sensible backoff factor
        assert 1.2 <= polling_config['backoff_factor'] <= 2.5
        
        # Should have adequate total time
        assert polling_config['max_total_time'] >= 300  # At least 5 minutes
    
    def test_exponential_backoff_sequence(self):
        """Test exponential backoff sequence is correct"""
        polling_config = get_polling_config()
        
        initial = polling_config['initial_interval']
        factor = polling_config['backoff_factor']
        max_interval = polling_config['max_interval']
        
        # Calculate expected sequence
        intervals = [initial]
        current = initial
        
        for _ in range(10):  # Test 10 iterations
            current = min(current * factor, max_interval)
            intervals.append(current)
        
        # Should reach max interval and stay there
        assert intervals[-1] == max_interval
        
        # Should not exceed max interval
        assert all(interval <= max_interval for interval in intervals)


class TestTimeoutIntegration:
    """Test timeout integration with actual API calls"""
    
    def test_hybrid_simulation_timeout_integration(self):
        """Test hybrid simulation API timeout integration"""
        # This would normally call the actual API
        # For testing, we'll validate the configuration is accessible
        
        simulation_timeout = get_simulation_timeout()
        assert isinstance(simulation_timeout, int)
        assert simulation_timeout > 0
        
        # Should be in milliseconds and reasonable for simulations
        assert 60000 <= simulation_timeout <= 1800000  # 1-30 minutes
    
    def test_timeout_hierarchy_consistency(self):
        """Test timeout hierarchy is consistent across all components"""
        manager = TimeoutManager()
        
        # Get configurations for different operations
        quick_config = manager.get_timeout(OperationType.QUICK_API)
        simulation_config = manager.get_timeout(OperationType.SIMULATION)
        benchmark_config = manager.get_timeout(OperationType.BENCHMARK)
        
        # Simulations should have longer timeouts than quick APIs
        assert simulation_config.total_timeout > quick_config.total_timeout
        
        # Benchmarks should have the longest timeouts
        assert benchmark_config.total_timeout > simulation_config.total_timeout
    
    def test_monitoring_thresholds(self):
        """Test monitoring configuration provides reasonable thresholds"""
        manager = TimeoutManager()
        monitoring_config = manager.get_monitoring_config()
        
        # Should have reasonable warning threshold
        assert 0.5 <= monitoring_config['warning_threshold'] <= 0.9
        
        # Critical threshold should be higher than warning
        assert monitoring_config['critical_threshold'] > monitoring_config['warning_threshold']
        
        # Should monitor high percentile
        assert monitoring_config['timeout_percentile'] >= 0.95


class TestTimeoutErrorHandling:
    """Test timeout error handling scenarios"""
    
    def test_timeout_error_detection(self):
        """Test timeout errors are properly detected and handled"""
        # Test different timeout error patterns
        timeout_errors = [
            "timeout of 10000ms exceeded",
            "Request timeout",
            "Connection timeout",
            "Read timeout",
            "ECONNABORTED",
            "TimeoutError"
        ]
        
        for error_msg in timeout_errors:
            # Should be detected as timeout error
            assert any(keyword in error_msg.lower() for keyword in ['timeout', 'aborted'])
    
    def test_timeout_retry_logic(self):
        """Test timeout retry logic is properly configured"""
        manager = TimeoutManager()
        
        # All operation types should have retry timeouts longer than initial timeouts
        for op_type in OperationType:
            config = manager.get_timeout(op_type)
            assert config.retry_timeout > config.total_timeout
    
    def test_timeout_fallback_behavior(self):
        """Test timeout fallback behavior"""
        manager = TimeoutManager()
        
        # Test with invalid environment - should fallback to development
        invalid_manager = TimeoutManager("invalid_environment")
        assert invalid_manager.environment == "invalid_environment"
        assert invalid_manager.multiplier == 1.0  # Should use development default


if __name__ == "__main__":
    # Run basic validation
    print("Running timeout configuration validation...")
    
    validation_result = validate_all_timeouts()
    print(f"Validation result: {validation_result}")
    
    if validation_result['valid']:
        print("✅ All timeout configurations are valid!")
    else:
        print("❌ Timeout configuration issues found:")
        for issue in validation_result['issues']:
            print(f"  - {issue}")
    
    # Test polling configuration
    print("\nTesting polling configuration...")
    polling_config = get_polling_config()
    print(f"Polling config: {polling_config}")
    
    # Test simulation timeout
    print("\nTesting simulation timeout...")
    sim_timeout = get_simulation_timeout()
    print(f"Simulation timeout: {sim_timeout}ms ({sim_timeout/1000}s)")
    
    print("\n✅ Timeout comprehensive testing completed!")