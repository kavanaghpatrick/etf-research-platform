import { MonteCarloResponse } from '../services/monteCarloApi';
import { HybridSimulationResults } from '../services/hybridSimulationApi';

interface ExportData {
  results: MonteCarloResponse;
  hybridResults?: HybridSimulationResults | null;
  filename: string;
}

export function exportToCSV({ results, hybridResults, filename }: ExportData): void {
  const rows: string[][] = [];
  
  // Headers
  rows.push(['Portfolio Simulation Results']);
  rows.push(['Generated on', new Date().toLocaleString()]);
  rows.push([]);
  
  // Summary Statistics
  rows.push(['Summary Statistics']);
  rows.push(['Metric', '10th Percentile', '25th Percentile', 'Median', '75th Percentile', '90th Percentile']);
  
  const metrics = results.aggregated_metrics;
  rows.push([
    'Final Balance (Nominal)',
    metrics.final_balance_nominal.percentile_10th.toString(),
    metrics.final_balance_nominal.percentile_25th.toString(),
    metrics.final_balance_nominal.percentile_50th.toString(),
    metrics.final_balance_nominal.percentile_75th.toString(),
    metrics.final_balance_nominal.percentile_90th.toString()
  ]);
  
  rows.push([
    'Final Balance (Real)',
    metrics.final_balance_real.percentile_10th.toString(),
    metrics.final_balance_real.percentile_25th.toString(),
    metrics.final_balance_real.percentile_50th.toString(),
    metrics.final_balance_real.percentile_75th.toString(),
    metrics.final_balance_real.percentile_90th.toString()
  ]);
  
  rows.push([
    'Annual Return (%)',
    (metrics.annual_mean_return.percentile_10th * 100).toFixed(2),
    (metrics.annual_mean_return.percentile_25th * 100).toFixed(2),
    (metrics.annual_mean_return.percentile_50th * 100).toFixed(2),
    (metrics.annual_mean_return.percentile_75th * 100).toFixed(2),
    (metrics.annual_mean_return.percentile_90th * 100).toFixed(2)
  ]);
  
  rows.push([
    'Annual Volatility (%)',
    (metrics.annual_volatility.percentile_10th * 100).toFixed(2),
    (metrics.annual_volatility.percentile_25th * 100).toFixed(2),
    (metrics.annual_volatility.percentile_50th * 100).toFixed(2),
    (metrics.annual_volatility.percentile_75th * 100).toFixed(2),
    (metrics.annual_volatility.percentile_90th * 100).toFixed(2)
  ]);
  
  rows.push([
    'Sharpe Ratio',
    metrics.sharpe_ratio.percentile_10th.toFixed(3),
    metrics.sharpe_ratio.percentile_25th.toFixed(3),
    metrics.sharpe_ratio.percentile_50th.toFixed(3),
    metrics.sharpe_ratio.percentile_75th.toFixed(3),
    metrics.sharpe_ratio.percentile_90th.toFixed(3)
  ]);
  
  rows.push([
    'Max Drawdown (%)',
    (metrics.max_drawdown.percentile_10th * 100).toFixed(2),
    (metrics.max_drawdown.percentile_25th * 100).toFixed(2),
    (metrics.max_drawdown.percentile_50th * 100).toFixed(2),
    (metrics.max_drawdown.percentile_75th * 100).toFixed(2),
    (metrics.max_drawdown.percentile_90th * 100).toFixed(2)
  ]);
  
  rows.push([]);
  
  // Portfolio Composition
  rows.push(['Portfolio Composition']);
  rows.push(['Ticker', 'Allocation (%)']);
  results.portfolio_summary.forEach(item => {
    rows.push([item.ticker, (item.allocation * 100).toFixed(2)]);
  });
  
  rows.push([]);
  
  // Simulation Metadata
  rows.push(['Simulation Metadata']);
  rows.push(['Number of Simulations', results.simulation_metadata.num_simulations.toString()]);
  rows.push(['Time Period (Years)', results.simulation_metadata.time_period_years.toString()]);
  rows.push(['Historical Data Range', results.historical_data_range]);
  rows.push(['Execution Time (s)', results.execution_time.toFixed(2)]);
  
  // Hybrid-specific data
  if (hybridResults?.validation_report) {
    rows.push([]);
    rows.push(['Validation Results']);
    rows.push(['Validation Score', (hybridResults.validation_report.overall_score * 10).toFixed(1) + '/10']);
    rows.push(['Validation Passed', hybridResults.validation_report.validation_passed ? 'Yes' : 'No']);
    
    rows.push([]);
    rows.push(['Statistical Tests']);
    rows.push(['Test Name', 'Passed', 'P-Value']);
    hybridResults.validation_report.test_results.forEach(test => {
      rows.push([
        test.test_name,
        test.passed ? 'Yes' : 'No',
        test.p_value.toFixed(4)
      ]);
    });
  }
  
  // Convert to CSV string
  const csvContent = rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma
      const escaped = cell.replace(/"/g, '""');
      return escaped.includes(',') ? `"${escaped}"` : escaped;
    }).join(',')
  ).join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToJSON({ 
  results, 
  hybridResults, 
  simulationMethod,
  portfolio,
  filename 
}: ExportData & { 
  simulationMethod: string; 
  portfolio: Array<{ ticker: string; percentage: number }> 
}): void {
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      simulationMethod,
      version: '1.0'
    },
    portfolio,
    results,
    hybridResults: hybridResults || undefined,
    summary: {
      expectedReturn: results.aggregated_metrics.twrr_real.percentile_50th,
      volatility: results.aggregated_metrics.annual_volatility.percentile_50th,
      sharpeRatio: results.aggregated_metrics.sharpe_ratio.percentile_50th,
      safeWithdrawalRate: results.aggregated_metrics.safe_withdrawal_rate.percentile_50th,
      validationScore: hybridResults?.validation_report?.overall_score
    }
  };
  
  // Pretty print JSON
  const jsonContent = JSON.stringify(exportData, null, 2);
  
  // Download
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}