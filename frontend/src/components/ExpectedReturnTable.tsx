'use client';

import { formatPercentage } from '../services/monteCarloApi';

interface ExpectedReturnTableProps {
  data: {
    timeHorizons: number[];
    percentiles: { 
      name: string; 
      values: number[]; 
      color: string;
    }[];
  } | null;
  showReal?: boolean;
}

export default function ExpectedReturnTable({ data, showReal = true }: ExpectedReturnTableProps) {
  if (!data) {
    return (
      <div className="mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Expected Annual Return</h3>
        <div className="text-center py-8 text-gray-500">
          Expected return data not available. Please run a new simulation.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Expected Annual Return</h3>
        <div className="text-sm text-gray-500">
          {showReal ? 'Real (Inflation-Adjusted)' : 'Nominal'} Returns
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Percentile
              </th>
              {data.timeHorizons.map((years) => (
                <th 
                  key={years} 
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {years} Year{years !== 1 ? 's' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.percentiles.map((percentile, idx) => (
              <tr key={percentile.name} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  <span className={`inline-flex items-center ${percentile.color}`}>
                    {percentile.name}
                  </span>
                </td>
                {percentile.values.map((value, valueIdx) => (
                  <td 
                    key={valueIdx} 
                    className="px-4 py-3 whitespace-nowrap text-sm text-center font-mono"
                  >
                    <span className={`${percentile.color} font-medium`}>
                      {formatPercentage(value)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        <p>
          • These are annualized returns calculated from Monte Carlo simulation paths
        </p>
        <p>
          • Returns are {showReal ? 'adjusted for inflation' : 'before inflation'} and 
          represent geometric (compound) annual growth rates
        </p>
        <p>
          • Historical performance does not guarantee future results
        </p>
      </div>
    </div>
  );
}