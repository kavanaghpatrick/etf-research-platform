import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportExporter from '../ReportExporter';
import { MonteCarloResponse } from '../../services/monteCarloApi';
import * as dataExporter from '../../utils/dataExporter';
import * as reportGenerator from '../../utils/reportGenerator';

// Mock the export utilities
jest.mock('../../utils/dataExporter');
jest.mock('../../utils/reportGenerator');

const mockResults: MonteCarloResponse = {
  aggregated_metrics: {
    final_balance_nominal: { percentile_50th: 100000, percentile_10th: 80000, percentile_90th: 120000, percentile_25th: 90000, percentile_75th: 110000 },
    final_balance_real: { percentile_50th: 95000, percentile_10th: 76000, percentile_90th: 114000, percentile_25th: 85500, percentile_75th: 104500 },
    annual_mean_return: { percentile_50th: 0.07, percentile_10th: 0.04, percentile_90th: 0.10, percentile_25th: 0.055, percentile_75th: 0.085 },
    annual_volatility: { percentile_50th: 0.15, percentile_10th: 0.12, percentile_90th: 0.18, percentile_25th: 0.135, percentile_75th: 0.165 },
    sharpe_ratio: { percentile_50th: 0.85, percentile_10th: 0.6, percentile_90th: 1.1, percentile_25th: 0.725, percentile_75th: 0.975 },
    max_drawdown: { percentile_50th: 0.12, percentile_10th: 0.08, percentile_90th: 0.18, percentile_25th: 0.10, percentile_75th: 0.14 },
    twrr_real: { percentile_50th: 0.065, percentile_10th: 0.035, percentile_90th: 0.095, percentile_25th: 0.05, percentile_75th: 0.08 },
    sortino_ratio: { percentile_50th: 1.2, percentile_10th: 0.8, percentile_90th: 1.6, percentile_25th: 1.0, percentile_75th: 1.4 },
    safe_withdrawal_rate: { percentile_50th: 0.04, percentile_10th: 0.03, percentile_90th: 0.05, percentile_25th: 0.035, percentile_75th: 0.045 },
    perpetual_withdrawal_rate: { percentile_50th: 0.03, percentile_10th: 0.02, percentile_90th: 0.04, percentile_25th: 0.025, percentile_75th: 0.035 }
  },
  portfolio_summary: [
    { ticker: 'SPY', allocation: 0.6 },
    { ticker: 'QQQ', allocation: 0.4 }
  ],
  simulation_metadata: {
    num_simulations: 10000,
    time_period_years: 30,
    historical_trading_days: 7500,
    block_size_days: 20
  },
  historical_data_range: '1994-01-01 to 2024-01-01',
  execution_time: 45.2
};

const mockPortfolio = [
  { ticker: 'SPY', percentage: 60 },
  { ticker: 'QQQ', percentage: 40 }
];

describe('ReportExporter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders export options correctly', () => {
    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('Export Report')).toBeInTheDocument();
  });

  it('switches between export formats', () => {
    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const csvButton = screen.getByText('CSV');
    fireEvent.click(csvButton);

    expect(screen.getByText('Raw data for analysis')).toBeInTheDocument();
  });

  it('handles PDF export', async () => {
    const generatePDFSpy = jest.spyOn(reportGenerator, 'generatePDFReport').mockResolvedValue(undefined);

    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(generatePDFSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          results: mockResults,
          simulationMethod: 'traditional',
          portfolio: mockPortfolio
        })
      );
    });
  });

  it('handles CSV export', async () => {
    const exportCSVSpy = jest.spyOn(dataExporter, 'exportToCSV').mockImplementation(() => {});

    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const csvButton = screen.getByText('CSV');
    fireEvent.click(csvButton);

    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(exportCSVSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          results: mockResults
        })
      );
    });
  });

  it('handles JSON export', async () => {
    const exportJSONSpy = jest.spyOn(dataExporter, 'exportToJSON').mockImplementation(() => {});

    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const jsonButton = screen.getByText('JSON');
    fireEvent.click(jsonButton);

    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(exportJSONSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          results: mockResults,
          simulationMethod: 'traditional',
          portfolio: mockPortfolio
        })
      );
    });
  });

  it('shows loading state during export', async () => {
    jest.spyOn(reportGenerator, 'generatePDFReport').mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);

    expect(screen.getByText('Exporting...')).toBeInTheDocument();
  });

  it('shows success state after export', async () => {
    jest.spyOn(reportGenerator, 'generatePDFReport').mockResolvedValue(undefined);

    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(screen.getByText('Exported!')).toBeInTheDocument();
    });
  });

  it('does not render when no results', () => {
    const { container } = render(
      <ReportExporter
        results={null}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('handles export errors gracefully', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(reportGenerator, 'generatePDFReport').mockRejectedValue(new Error('Export failed'));

    render(
      <ReportExporter
        results={mockResults}
        simulationMethod="traditional"
        portfolio={mockPortfolio}
      />
    );

    const exportButton = screen.getByText('Export Report');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});