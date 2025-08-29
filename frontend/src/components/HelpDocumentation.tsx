'use client';

import React, { useState } from 'react';
import { 
  QuestionMarkCircleIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  XMarkIcon,
  BookOpenIcon,
  LightBulbIcon,
  ChartBarIcon,
  CpuChipIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';

interface HelpDocumentationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

export default function HelpDocumentation({ isOpen, onClose }: HelpDocumentationProps) {
  const [activeSection, setActiveSection] = useState<string>('overview');

  const helpSections: HelpSection[] = [
    {
      id: 'overview',
      title: 'Simulation Overview',
      icon: BookOpenIcon,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">What is Portfolio Simulation?</h4>
          <p className="text-sm text-gray-700">
            Portfolio simulation analyzes thousands of potential future scenarios to help you understand 
            the range of possible outcomes for your investment portfolio. This helps in making informed 
            decisions about asset allocation, risk management, and retirement planning.
          </p>
          
          <h4 className="font-medium text-gray-900">How It Works</h4>
          <ol className="list-decimal pl-4 space-y-2 text-sm text-gray-700">
            <li>Historical data is gathered for your selected assets</li>
            <li>Mathematical models simulate thousands of possible future scenarios</li>
            <li>Results are analyzed to show probabilities of different outcomes</li>
            <li>Statistical validation ensures the quality of projections</li>
          </ol>
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Tip:</strong> Simulations are probabilistic estimates, not predictions. 
              They help you understand potential risks and opportunities.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'methods',
      title: 'Simulation Methods',
      icon: ScaleIcon,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Traditional Bootstrap Method</h4>
          <p className="text-sm text-gray-700">
            Uses historical data blocks to generate scenarios. Simple and well-understood, 
            but may concentrate market crises leading to overly pessimistic long-term projections.
          </p>
          
          <h4 className="font-medium text-gray-900">Hybrid Econometric Method</h4>
          <p className="text-sm text-gray-700">
            Combines VAR (Vector Autoregression) and GARCH (volatility modeling) with 
            bootstrap sampling to reduce bias and capture market dynamics more accurately.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <h5 className="font-medium text-blue-900">Traditional Best For:</h5>
              <ul className="text-sm text-blue-800 mt-2 space-y-1">
                <li>• Quick analysis</li>
                <li>• Short-term projections</li>
                <li>• Conservative estimates</li>
              </ul>
            </div>
            
            <div className="p-3 bg-green-50 rounded-lg">
              <h5 className="font-medium text-green-900">Hybrid Best For:</h5>
              <ul className="text-sm text-green-800 mt-2 space-y-1">
                <li>• Long-term planning</li>
                <li>• Bias-free projections</li>
                <li>• Critical financial decisions</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'metrics',
      title: 'Understanding Metrics',
      icon: ChartBarIcon,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Key Performance Metrics</h4>
          
          <div className="space-y-3">
            <div className="p-3 border-l-4 border-blue-500 bg-blue-50">
              <h5 className="font-medium text-blue-900">Expected Return</h5>
              <p className="text-sm text-blue-800">
                Average annual return you can expect. Real returns are adjusted for inflation.
              </p>
            </div>
            
            <div className="p-3 border-l-4 border-yellow-500 bg-yellow-50">
              <h5 className="font-medium text-yellow-900">Volatility</h5>
              <p className="text-sm text-yellow-800">
                How much returns vary from year to year. Higher volatility means more uncertainty.
              </p>
            </div>
            
            <div className="p-3 border-l-4 border-green-500 bg-green-50">
              <h5 className="font-medium text-green-900">Sharpe Ratio</h5>
              <p className="text-sm text-green-800">
                Risk-adjusted return measure. Higher is better. Above 1.0 is good, above 2.0 is excellent.
              </p>
            </div>
            
            <div className="p-3 border-l-4 border-red-500 bg-red-50">
              <h5 className="font-medium text-red-900">Max Drawdown</h5>
              <p className="text-sm text-red-800">
                Largest peak-to-trough decline. Shows worst-case scenario risk.
              </p>
            </div>
            
            <div className="p-3 border-l-4 border-purple-500 bg-purple-50">
              <h5 className="font-medium text-purple-900">Safe Withdrawal Rate</h5>
              <p className="text-sm text-purple-800">
                Annual percentage you can withdraw with low risk of running out of money.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'validation',
      title: 'Statistical Validation',
      icon: CpuChipIcon,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">Why Validation Matters</h4>
          <p className="text-sm text-gray-700">
            Statistical validation ensures your simulation results are reliable and not distorted 
            by model assumptions or data limitations.
          </p>
          
          <h4 className="font-medium text-gray-900">Validation Tests</h4>
          <div className="space-y-3">
            <div className="p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-900">Kolmogorov-Smirnov Test</h5>
              <p className="text-sm text-gray-700">
                Compares simulation results with historical data to ensure realistic distributions.
              </p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-900">Moment Matching</h5>
              <p className="text-sm text-gray-700">
                Verifies that mean, variance, skewness, and kurtosis match expected values.
              </p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-lg">
              <h5 className="font-medium text-gray-900">Bias Analysis</h5>
              <p className="text-sm text-gray-700">
                Measures how much the hybrid method reduces bias compared to traditional bootstrap.
              </p>
            </div>
          </div>
          
          <div className="p-3 bg-green-50 rounded-lg">
            <h5 className="font-medium text-green-900">Validation Scores</h5>
            <ul className="text-sm text-green-800 mt-2 space-y-1">
              <li>• <strong>8.0+/10:</strong> Excellent - Results are highly reliable</li>
              <li>• <strong>6.0-7.9/10:</strong> Good - Results are generally trustworthy</li>
              <li>• <strong>Below 6.0/10:</strong> Needs improvement - Use with caution</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'best-practices',
      title: 'Best Practices',
      icon: LightBulbIcon,
      content: (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">For Accurate Results</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Use ETFs with at least 15-20 years of history for long-term projections</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Run at least 10,000 simulations for stable results</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Enable validation for hybrid simulations</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>Diversify across asset classes and geographies</span>
            </li>
          </ul>
          
          <h4 className="font-medium text-gray-900">Common Pitfalls to Avoid</h4>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start">
              <span className="text-red-500 mr-2">✗</span>
              <span>Don&apos;t use results as guaranteed predictions</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 mr-2">✗</span>
              <span>Don&apos;t ignore validation warnings</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 mr-2">✗</span>
              <span>Don&apos;t rely solely on median outcomes</span>
            </li>
            <li className="flex items-start">
              <span className="text-red-500 mr-2">✗</span>
              <span>Don&apos;t ignore transaction costs and taxes</span>
            </li>
          </ul>
          
          <div className="p-3 bg-yellow-50 rounded-lg">
            <h5 className="font-medium text-yellow-900">Remember</h5>
            <p className="text-sm text-yellow-800">
              All models are simplifications of reality. Use results as one input among many 
              in your financial planning process.
            </p>
          </div>
        </div>
      )
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 flex items-center">
              <QuestionMarkCircleIcon className="h-6 w-6 mr-2 text-blue-600" />
              Portfolio Simulation Guide
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Navigation */}
            <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
                  Contents
                </h3>
                <nav className="space-y-1">
                  {helpSections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          activeSection === section.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-3" />
                        {section.title}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6">
                {helpSections.map((section) => (
                  <div
                    key={section.id}
                    className={activeSection === section.id ? 'block' : 'hidden'}
                  >
                    <div className="flex items-center mb-4">
                      <section.icon className="h-6 w-6 mr-2 text-blue-600" />
                      <h3 className="text-lg font-bold text-gray-900">{section.title}</h3>
                    </div>
                    {section.content}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}