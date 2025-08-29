'use client';

import React, { useMemo } from 'react';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon,
  BeakerIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import { ValidationReport as ValidationReportType } from '../services/hybridSimulationApi';

interface ValidationReportProps {
  report: ValidationReportType;
  className?: string;
}

const ValidationReport = React.memo(({ report, className = '' }: ValidationReportProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 0.8) return 'bg-green-50 border-green-200';
    if (score >= 0.6) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 0.8) return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    if (score >= 0.6) return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    return <XCircleIcon className="h-5 w-5 text-red-500" />;
  };

  const getScoreText = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    return 'Needs Improvement';
  };

  const getBiasReductionIcon = (percent: number) => {
    if (percent > 0) return <ArrowTrendingUpIcon className="h-4 w-4 text-green-500" />;
    return <ArrowTrendingDownIcon className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overall Score */}
      <div className={`p-6 rounded-lg border-2 ${getScoreBackground(report.overall_score)}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {getScoreIcon(report.overall_score)}
            <h3 className="text-lg font-medium text-gray-900">Statistical Validation Report</h3>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${getScoreColor(report.overall_score)}`}>
              {(report.overall_score * 10).toFixed(1)}/10
            </div>
            <div className={`text-sm font-medium ${getScoreColor(report.overall_score)}`}>
              {getScoreText(report.overall_score)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {report.validation_passed ? '✅ VALIDATION PASSED' : '❌ VALIDATION FAILED'}
          </span>
          <span className="text-sm text-gray-500">
            Production Ready: {report.overall_score >= 0.7 ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      {/* Distribution Tests */}
      <div className="bg-white border border-gray-200 rounded-lg p-6" role="region" aria-label="Distribution Test Results">
        <div className="flex items-center space-x-2 mb-4">
          <ChartBarIcon className="h-5 w-5 text-blue-600" />
          <h4 className="text-lg font-medium text-gray-900">Distribution Tests</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.test_results?.map((test, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">{test.test_name}</span>
                {test.passed ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircleIcon className="h-4 w-4 text-red-500" />
                )}
              </div>
              
              <div className="text-xs text-gray-600 space-y-1">
                <div>p-value: {test.p_value?.toFixed(4) ?? 'N/A'}</div>
                <div>Test statistic: {Number.isFinite(test.test_statistic) ? test.test_statistic.toFixed(4) : 'N/A'}</div>
                <div className={`font-medium ${test.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {test.passed ? 'PASS' : 'FAIL'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bias Reduction Analysis */}
      {report.bias_analysis && report.bias_analysis.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <BeakerIcon className="h-5 w-5 text-purple-600" />
            <h4 className="text-lg font-medium text-gray-900">Bias Reduction Analysis</h4>
          </div>
          
          <div className="space-y-4">
            {report.bias_analysis.map((analysis, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {analysis.metric.replace('_', ' ')}
                  </span>
                  <div className="flex items-center space-x-1">
                    {getBiasReductionIcon(analysis.bias_reduction_percent)}
                    <span className={`text-sm font-medium ${
                      analysis.bias_reduction_percent > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {analysis.bias_reduction_percent > 0 ? '+' : ''}{analysis.bias_reduction_percent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      analysis.improvement_score >= 0.7 ? 'bg-green-500' :
                      analysis.improvement_score >= 0.4 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${analysis.improvement_score * 100}%` }}
                  ></div>
                </div>
                
                <div className="mt-1 text-xs text-gray-600">
                  Improvement Score: {(analysis.improvement_score * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-lg font-medium text-blue-900 mb-4">📋 Recommendations</h4>
          <ul className="space-y-2">
            {report.recommendations.map((recommendation, index) => (
              <li key={index} className="text-sm text-blue-800">
                {recommendation}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Technical Details */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="text-lg font-medium text-gray-900 mb-4">Technical Summary</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {report.test_results.length}
            </div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {report.test_results.filter(t => t.passed).length}
            </div>
            <div className="text-sm text-gray-600">Tests Passed</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {report.test_results.filter(t => !t.passed).length}
            </div>
            <div className="text-sm text-gray-600">Tests Failed</div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <h5 className="text-sm font-medium text-gray-900 mb-2">Validation Methodology</h5>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• <strong>Kolmogorov-Smirnov Test:</strong> Compares simulation and historical distributions</li>
            <li>• <strong>Moment Matching:</strong> Validates mean, variance, skewness, and kurtosis</li>
            <li>• <strong>Bias Analysis:</strong> Measures improvement vs traditional bootstrap</li>
            <li>• <strong>Normality Tests:</strong> Ensures statistical assumptions are met</li>
          </ul>
        </div>
      </div>
    </div>
  );
});

ValidationReport.displayName = 'ValidationReport';

export default ValidationReport;