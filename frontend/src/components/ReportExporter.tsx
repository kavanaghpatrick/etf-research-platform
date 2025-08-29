'use client';

import React, { useState } from 'react';
import { 
  ArrowDownTrayIcon, 
  DocumentTextIcon, 
  ChartBarIcon,
  TableCellsIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { MonteCarloResponse } from '../services/monteCarloApi';
import { HybridSimulationResults } from '../services/hybridSimulationApi';
import { generatePDFReport } from '../utils/reportGenerator';
import { exportToCSV, exportToJSON } from '../utils/dataExporter';

interface ReportExporterProps {
  results: MonteCarloResponse | null;
  hybridResults?: HybridSimulationResults | null;
  simulationMethod: 'traditional' | 'hybrid';
  portfolio: Array<{ ticker: string; percentage: number }>;
  className?: string;
}

export type ExportFormat = 'pdf' | 'csv' | 'json';

export default function ReportExporter({ 
  results, 
  hybridResults, 
  simulationMethod,
  portfolio,
  className = '' 
}: ReportExporterProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleExport = async () => {
    if (!results) return;

    setIsExporting(true);
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const baseFilename = `${simulationMethod}_simulation_${timestamp}`;

      switch (exportFormat) {
        case 'pdf':
          await generatePDFReport({
            results,
            hybridResults,
            simulationMethod,
            portfolio,
            filename: `${baseFilename}.pdf`
          });
          break;

        case 'csv':
          exportToCSV({
            results,
            hybridResults,
            filename: `${baseFilename}.csv`
          });
          break;

        case 'json':
          exportToJSON({
            results,
            hybridResults,
            simulationMethod,
            portfolio,
            filename: `${baseFilename}.json`
          });
          break;
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!results) return null;

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* Format Selector */}
      <div className="flex rounded-lg shadow-sm">
        <button
          onClick={() => setExportFormat('pdf')}
          className={`px-4 py-2 text-sm font-medium rounded-l-lg border ${
            exportFormat === 'pdf'
              ? 'bg-blue-50 border-blue-500 text-blue-700 z-10'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          disabled={isExporting}
        >
          <DocumentTextIcon className="h-4 w-4 inline mr-1" />
          PDF
        </button>
        <button
          onClick={() => setExportFormat('csv')}
          className={`px-4 py-2 text-sm font-medium border-t border-b ${
            exportFormat === 'csv'
              ? 'bg-blue-50 border-blue-500 text-blue-700 z-10'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          disabled={isExporting}
        >
          <TableCellsIcon className="h-4 w-4 inline mr-1" />
          CSV
        </button>
        <button
          onClick={() => setExportFormat('json')}
          className={`px-4 py-2 text-sm font-medium rounded-r-lg border ${
            exportFormat === 'json'
              ? 'bg-blue-50 border-blue-500 text-blue-700 z-10'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
          disabled={isExporting}
        >
          <ChartBarIcon className="h-4 w-4 inline mr-1" />
          JSON
        </button>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
          isExporting 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
        }`}
      >
        {isExporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Exporting...
          </>
        ) : showSuccess ? (
          <>
            <CheckIcon className="h-4 w-4 mr-2" />
            Exported!
          </>
        ) : (
          <>
            <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
            Export Report
          </>
        )}
      </button>

      {/* Format Info */}
      <div className="text-xs text-gray-500">
        {exportFormat === 'pdf' && 'Full report with charts'}
        {exportFormat === 'csv' && 'Raw data for analysis'}
        {exportFormat === 'json' && 'Complete simulation data'}
      </div>
    </div>
  );
}