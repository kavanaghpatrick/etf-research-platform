import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ValidationReport from '../ValidationReport';
import { ValidationReport as ValidationReportType } from '../../services/hybridSimulationApi';

const mockValidationReport: ValidationReportType = {
  validation_passed: true,
  overall_score: 0.85,
  test_results: [
    {
      test_name: 'KS Test - Returns',
      passed: true,
      p_value: 0.15,
      test_statistic: 0.045
    },
    {
      test_name: 'KS Test - Volatility',
      passed: false,
      p_value: 0.03,
      test_statistic: 0.12
    }
  ],
  bias_analysis: [
    {
      metric: 'expected_return',
      bias_reduction_percent: 15.2,
      improvement_score: 0.78
    }
  ],
  recommendations: [
    'Consider increasing simulation count',
    'Validate data quality for recent periods'
  ],
  detailed_report: 'Statistical validation completed successfully'
};

describe('ValidationReport', () => {
  it('renders validation report with correct score', () => {
    render(<ValidationReport report={mockValidationReport} />);
    
    expect(screen.getByText('8.5/10')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('✅ VALIDATION PASSED')).toBeInTheDocument();
  });

  it('displays test results correctly', () => {
    render(<ValidationReport report={mockValidationReport} />);
    
    expect(screen.getByText('KS Test - Returns')).toBeInTheDocument();
    expect(screen.getByText('KS Test - Volatility')).toBeInTheDocument();
    expect(screen.getByText('PASS')).toBeInTheDocument();
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });

  it('shows bias analysis when available', () => {
    render(<ValidationReport report={mockValidationReport} />);
    
    expect(screen.getByText('Bias Reduction Analysis')).toBeInTheDocument();
    expect(screen.getByText('Expected return')).toBeInTheDocument();
    expect(screen.getByText('+15.2%')).toBeInTheDocument();
  });

  it('displays recommendations', () => {
    render(<ValidationReport report={mockValidationReport} />);
    
    expect(screen.getByText('📋 Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Consider increasing simulation count')).toBeInTheDocument();
    expect(screen.getByText('Validate data quality for recent periods')).toBeInTheDocument();
  });

  it('handles edge cases gracefully', () => {
    const reportWithNaN: ValidationReportType = {
      ...mockValidationReport,
      test_results: [
        {
          test_name: 'Edge Case Test',
          passed: false,
          p_value: NaN,
          test_statistic: Infinity
        }
      ]
    };

    render(<ValidationReport report={reportWithNaN} />);
    
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<ValidationReport report={mockValidationReport} />);
    
    const distributionSection = screen.getByRole('region', { name: 'Distribution Test Results' });
    expect(distributionSection).toBeInTheDocument();
  });
});