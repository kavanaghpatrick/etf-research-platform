import { MonteCarloResponse, formatLargeNumber, formatPercentage } from '../services/monteCarloApi';
import { HybridSimulationResults } from '../services/hybridSimulationApi';

// Type declarations for jsPDF when dynamically imported
type JsPDFAutoTable = {
  autoTable: (options: any) => any;
};

interface ReportOptions {
  results: MonteCarloResponse;
  hybridResults?: HybridSimulationResults | null;
  simulationMethod: string;
  portfolio: Array<{ ticker: string; percentage: number }>;
  filename: string;
}

export async function generatePDFReport({
  results,
  hybridResults,
  simulationMethod,
  portfolio,
  filename
}: ReportOptions): Promise<void> {
  // Lazy load jsPDF and jspdf-autotable only when PDF generation is needed
  // This saves ~250KB from the initial bundle
  const [{ default: jsPDF }, _] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  const doc = new jsPDF() as any; // Type assertion for autoTable
  let yPosition = 20;

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Portfolio Simulation Report', 105, yPosition, { align: 'center' });
  yPosition += 10;

  // Subtitle
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${simulationMethod === 'hybrid' ? 'Hybrid Econometric' : 'Monte Carlo'} Simulation`, 105, yPosition, { align: 'center' });
  yPosition += 15;

  // Report Date
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 20, yPosition);
  yPosition += 15;

  // Executive Summary Box
  doc.setFillColor(240, 240, 240);
  doc.rect(15, yPosition - 5, 180, 45, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 20, yPosition);
  yPosition += 8;

  const metrics = results.aggregated_metrics;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Expected Annual Return (Real): ${formatPercentage(metrics.twrr_real.percentile_50th)}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Annual Volatility: ${formatPercentage(metrics.annual_volatility.percentile_50th)}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Sharpe Ratio: ${metrics.sharpe_ratio.percentile_50th.toFixed(2)}`, 20, yPosition);
  yPosition += 6;
  doc.text(`Safe Withdrawal Rate: ${formatPercentage(metrics.safe_withdrawal_rate.percentile_50th)}`, 20, yPosition);
  yPosition += 6;
  
  if (hybridResults?.validation_report) {
    doc.text(`Validation Score: ${(hybridResults.validation_report.overall_score * 10).toFixed(1)}/10`, 20, yPosition);
  }
  yPosition += 15;

  // Portfolio Composition
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Portfolio Composition', 20, yPosition);
  yPosition += 5;

  const portfolioData = portfolio.map(item => [
    item.ticker,
    `${item.percentage.toFixed(1)}%`
  ]);

  doc.autoTable({
    startY: yPosition,
    head: [['Ticker', 'Allocation']],
    body: portfolioData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 80, halign: 'right' }
    }
  });

  yPosition = doc.lastAutoTable.finalY + 15;

  // Simulation Results Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Simulation Results - Key Metrics', 20, yPosition);
  yPosition += 5;

  const metricsData = [
    ['Final Balance (Nominal)', 
      formatLargeNumber(metrics.final_balance_nominal.percentile_10th),
      formatLargeNumber(metrics.final_balance_nominal.percentile_50th),
      formatLargeNumber(metrics.final_balance_nominal.percentile_90th)
    ],
    ['Final Balance (Real)', 
      formatLargeNumber(metrics.final_balance_real.percentile_10th),
      formatLargeNumber(metrics.final_balance_real.percentile_50th),
      formatLargeNumber(metrics.final_balance_real.percentile_90th)
    ],
    ['Annual Return', 
      formatPercentage(metrics.annual_mean_return.percentile_10th),
      formatPercentage(metrics.annual_mean_return.percentile_50th),
      formatPercentage(metrics.annual_mean_return.percentile_90th)
    ],
    ['Annual Volatility', 
      formatPercentage(metrics.annual_volatility.percentile_10th),
      formatPercentage(metrics.annual_volatility.percentile_50th),
      formatPercentage(metrics.annual_volatility.percentile_90th)
    ],
    ['Max Drawdown', 
      formatPercentage(metrics.max_drawdown.percentile_10th),
      formatPercentage(metrics.max_drawdown.percentile_50th),
      formatPercentage(metrics.max_drawdown.percentile_90th)
    ]
  ];

  doc.autoTable({
    startY: yPosition,
    head: [['Metric', '10th Percentile', 'Median (50th)', '90th Percentile']],
    body: metricsData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
    margin: { left: 20, right: 20 }
  });

  yPosition = doc.lastAutoTable.finalY + 15;

  // Check if we need a new page
  if (yPosition > 250) {
    doc.addPage();
    yPosition = 20;
  }

  // Validation Results (if hybrid)
  if (hybridResults?.validation_report) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Statistical Validation Results', 20, yPosition);
    yPosition += 5;

    const validationData = hybridResults.validation_report.test_results.map(test => [
      test.test_name,
      test.passed ? 'PASS' : 'FAIL',
      test.p_value.toFixed(4)
    ]);

    doc.autoTable({
      startY: yPosition,
      head: [['Test Name', 'Result', 'P-Value']],
      body: validationData,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      margin: { left: 20, right: 20 },
      bodyStyles: {
        textColor: function(data: any) {
          return data.row.raw[1] === 'PASS' ? [34, 197, 94] : [239, 68, 68];
        }
      }
    });

    yPosition = doc.lastAutoTable.finalY + 15;
  }

  // Simulation Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text(`Simulation Parameters: ${results.simulation_metadata.num_simulations.toLocaleString()} scenarios, ${results.simulation_metadata.time_period_years} years`, 20, yPosition);
  yPosition += 5;
  doc.text(`Historical Data: ${results.historical_data_range}`, 20, yPosition);
  yPosition += 5;
  doc.text(`Execution Time: ${results.execution_time.toFixed(2)} seconds`, 20, yPosition);

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
  }

  // Save the PDF
  doc.save(filename);
}