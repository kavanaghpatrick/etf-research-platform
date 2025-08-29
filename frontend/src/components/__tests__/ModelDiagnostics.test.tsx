import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ModelDiagnostics from '../ModelDiagnostics';
import { HybridSimulationResults } from '../../services/hybridSimulationApi';

const mockHybridResults: HybridSimulationResults = {
  task_id: 'test-task-123',
  status: 'completed',
  simulation_config: {
    var_max_lags: 5,
    garch_distribution: 'normal',
    bootstrap_block_length: 20,
    preserve_mean: true,
    use_parallel: true,
    max_workers: 4,
    random_seed: 42
  },
  results: {
    summary_statistics: {
      mean_final_value: 100000,
      median_final_value: 95000,
      std_final_value: 25000,
      mean_annual_return: 0.07,
      median_annual_return: 0.065,
      mean_volatility: 0.15,
      mean_max_drawdown: 0.12,
      mean_sharpe_ratio: 0.85
    },
    percentile_analysis: {},
    performance_metrics: {
      simulation_time: 45.2,
      paths_per_second: 1250,
      memory_usage_mb: 128.5,
      convergence_rate: 0.92
    },
    n_simulations: 10000,
    tickers: ['SPY', 'QQQ'],
    paths_sample: []
  }
};

describe('ModelDiagnostics', () => {
  it('renders performance overview correctly', () => {
    render(<ModelDiagnostics results={mockHybridResults} />);
    
    expect(screen.getByText('Model Performance Overview')).toBeInTheDocument();
    expect(screen.getByText('1250')).toBeInTheDocument(); // paths/sec
    expect(screen.getByText('45.2s')).toBeInTheDocument(); // execution time
    expect(screen.getByText('128.5MB')).toBeInTheDocument(); // memory usage
  });

  it('displays convergence status correctly', () => {
    render(<ModelDiagnostics results={mockHybridResults} />);
    
    expect(screen.getByText('Model Convergence Analysis')).toBeInTheDocument();
    expect(screen.getByText('92.0%')).toBeInTheDocument(); // convergence rate
  });

  it('shows configuration details', () => {
    render(<ModelDiagnostics results={mockHybridResults} />);
    
    expect(screen.getByText('VAR Model Configuration')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // max lags
    expect(screen.getByText('Normal')).toBeInTheDocument(); // GARCH distribution
  });

  it('handles missing results gracefully', () => {
    const resultsWithoutData: HybridSimulationResults = {
      ...mockHybridResults,
      results: undefined
    };

    render(<ModelDiagnostics results={resultsWithoutData} />);
    
    expect(screen.getByText('No model diagnostics available')).toBeInTheDocument();
  });

  it('formats numbers correctly with edge cases', () => {
    const resultsWithEdgeCases: HybridSimulationResults = {
      ...mockHybridResults,
      results: {
        ...mockHybridResults.results!,
        performance_metrics: {
          simulation_time: NaN,
          paths_per_second: Infinity,
          memory_usage_mb: -1,
          convergence_rate: 1.5 // Invalid rate
        }
      }
    };

    render(<ModelDiagnostics results={resultsWithEdgeCases} />);
    
    expect(screen.getAllByText('N/A')).toHaveLength(3);
  });

  it('provides performance recommendations', () => {
    const slowResults: HybridSimulationResults = {
      ...mockHybridResults,
      results: {
        ...mockHybridResults.results!,
        performance_metrics: {
          simulation_time: 180,
          paths_per_second: 300, // Slow
          memory_usage_mb: 600, // High
          convergence_rate: 0.8 // Low
        }
      }
    };

    render(<ModelDiagnostics results={slowResults} />);
    
    expect(screen.getByText('⚡ Performance Recommendations')).toBeInTheDocument();
    expect(screen.getByText(/Enable parallel processing/)).toBeInTheDocument();
    expect(screen.getByText(/Consider reducing simulation count/)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<ModelDiagnostics results={mockHybridResults} />);
    
    const overviewSection = screen.getByRole('region', { name: 'Model Performance Overview' });
    expect(overviewSection).toBeInTheDocument();
  });
});