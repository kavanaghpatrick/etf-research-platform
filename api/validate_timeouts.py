"""
Quick timeout validation script based on Grok-4 recommendations
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from timeout_configurations import (
    TimeoutManager, 
    OperationType, 
    validate_all_timeouts,
    get_simulation_timeout,
    get_polling_config
)

def main():
    print("🔍 Comprehensive Timeout Validation")
    print("=" * 50)
    
    # 1. Test timeout manager initialization
    print("\n1. Testing timeout manager initialization...")
    manager = TimeoutManager("development")
    print(f"   Environment: {manager.environment}")
    print(f"   Multiplier: {manager.multiplier}")
    
    # 2. Test all operation types
    print("\n2. Testing all operation type configurations...")
    for op_type in OperationType:
        config = manager.get_timeout(op_type)
        print(f"   {op_type.value}:")
        print(f"     Connect: {config.connect_timeout}s")
        print(f"     Read: {config.read_timeout}s")
        print(f"     Total: {config.total_timeout}s")
        print(f"     Retry: {config.retry_timeout}s")
        
        # Validate hierarchy
        assert config.connect_timeout <= config.total_timeout, f"Connect timeout too high for {op_type.value}"
        assert config.read_timeout <= config.total_timeout, f"Read timeout too high for {op_type.value}"
        assert config.total_timeout <= config.retry_timeout, f"Total timeout too high for {op_type.value}"
        
        print(f"     ✅ Hierarchy valid")
    
    # 3. Test conversion functions
    print("\n3. Testing timeout conversion functions...")
    
    # Axios timeout (milliseconds)
    axios_timeout = manager.get_axios_timeout(OperationType.SIMULATION)
    print(f"   Axios timeout: {axios_timeout}ms ({axios_timeout/1000}s)")
    assert isinstance(axios_timeout, int), "Axios timeout should be integer"
    assert axios_timeout > 0, "Axios timeout should be positive"
    
    # Requests timeout (tuple)
    requests_timeout = manager.get_requests_timeout(OperationType.DATA_FETCH)
    print(f"   Requests timeout: {requests_timeout}")
    assert isinstance(requests_timeout, tuple), "Requests timeout should be tuple"
    assert len(requests_timeout) == 2, "Requests timeout should have 2 elements"
    assert requests_timeout[0] > 0 and requests_timeout[1] > 0, "Requests timeout elements should be positive"
    
    # HTTPX timeout (dict)
    httpx_timeout = manager.get_httpx_timeout(OperationType.EXTERNAL_API)
    print(f"   HTTPX timeout: {httpx_timeout}")
    assert isinstance(httpx_timeout, dict), "HTTPX timeout should be dict"
    required_keys = ['connect', 'read', 'write', 'pool']
    for key in required_keys:
        assert key in httpx_timeout, f"HTTPX timeout missing key: {key}"
        assert httpx_timeout[key] > 0, f"HTTPX timeout {key} should be positive"
    
    print("   ✅ All conversions valid")
    
    # 4. Test polling configuration
    print("\n4. Testing polling configuration...")
    polling_config = manager.get_polling_config(OperationType.SIMULATION)
    print(f"   Polling config: {polling_config}")
    
    required_keys = ['initial_interval', 'max_interval', 'backoff_factor', 'max_total_time', 'timeout_per_request']
    for key in required_keys:
        assert key in polling_config, f"Polling config missing key: {key}"
        assert polling_config[key] > 0, f"Polling config {key} should be positive"
    
    assert polling_config['initial_interval'] < polling_config['max_interval'], "Initial interval should be less than max"
    assert polling_config['backoff_factor'] > 1.0, "Backoff factor should be greater than 1"
    assert polling_config['timeout_per_request'] <= polling_config['max_total_time'], "Per-request timeout should be less than total"
    
    print("   ✅ Polling configuration valid")
    
    # 5. Test global validation
    print("\n5. Running global timeout validation...")
    validation_result = validate_all_timeouts()
    print(f"   Validation result: {validation_result}")
    
    if validation_result['valid']:
        print("   ✅ All timeout configurations are valid!")
    else:
        print("   ❌ Timeout configuration issues found:")
        for issue in validation_result['issues']:
            print(f"     - {issue}")
        return False
    
    # 6. Test environment multipliers
    print("\n6. Testing environment multipliers...")
    environments = ['development', 'staging', 'production', 'test']
    
    for env in environments:
        env_manager = TimeoutManager(env)
        config = env_manager.get_timeout(OperationType.QUICK_API)
        print(f"   {env}: total_timeout = {config.total_timeout}s (multiplier: {env_manager.multiplier})")
    
    print("   ✅ Environment multipliers working")
    
    # 7. Test helper functions
    print("\n7. Testing helper functions...")
    
    sim_timeout = get_simulation_timeout()
    print(f"   Simulation timeout: {sim_timeout}ms ({sim_timeout/1000}s)")
    assert isinstance(sim_timeout, int), "Simulation timeout should be integer"
    assert sim_timeout >= 60000, "Simulation timeout should be at least 60 seconds"
    
    polling_config = get_polling_config()
    print(f"   Polling config: {polling_config}")
    assert isinstance(polling_config, dict), "Polling config should be dict"
    
    print("   ✅ Helper functions working")
    
    # 8. Test realistic scenarios
    print("\n8. Testing realistic timeout scenarios...")
    
    # Quick API should be fast
    quick_config = manager.get_timeout(OperationType.QUICK_API)
    assert quick_config.total_timeout <= 60, "Quick API timeout should be ≤ 60s"
    
    # Simulation should be generous
    sim_config = manager.get_timeout(OperationType.SIMULATION)
    assert sim_config.total_timeout >= 300, "Simulation timeout should be ≥ 5 minutes"
    
    # Benchmark should be longest
    benchmark_config = manager.get_timeout(OperationType.BENCHMARK)
    assert benchmark_config.total_timeout >= sim_config.total_timeout, "Benchmark timeout should be ≥ simulation timeout"
    
    print("   ✅ Realistic scenarios valid")
    
    print("\n" + "=" * 50)
    print("🎉 ALL TIMEOUT CONFIGURATIONS VALIDATED SUCCESSFULLY!")
    print("=" * 50)
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)