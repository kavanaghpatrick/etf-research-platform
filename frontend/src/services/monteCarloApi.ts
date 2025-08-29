import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export interface PortfolioAllocation {
  ticker: string;
  percentage: number;
}

export interface MonteCarloRequest {
  portfolio: PortfolioAllocation[];
  time_period_years: number;
  initial_balance: number;
  num_simulations: number;
  historical_start_date: string;
}

export interface MetricPercentiles {
  percentile_10th: number;
  percentile_25th: number;
  percentile_50th: number;
  percentile_75th: number;
  percentile_90th: number;
}

export interface AggregatedMetrics {
  twrr_nominal: MetricPercentiles;
  twrr_real: MetricPercentiles;
  final_balance_nominal: MetricPercentiles;
  final_balance_real: MetricPercentiles;
  annual_mean_return: MetricPercentiles;
  annual_volatility: MetricPercentiles;
  sharpe_ratio: MetricPercentiles;
  sortino_ratio: MetricPercentiles;
  max_drawdown: MetricPercentiles;
  max_drawdown_excl_cashflows: MetricPercentiles;
  safe_withdrawal_rate: MetricPercentiles;
  perpetual_withdrawal_rate: MetricPercentiles;
}

export interface SimulationMetadata {
  num_simulations: number;
  time_period_years: number;
  block_size_days: number;
  historical_trading_days: number;
}

export interface TreasuryMetadata {
  risk_free_rate: number;
  risk_free_rate_percentage: string;
  duration: string;
  source: string;
  cache_hours: number;
  fallback_rate: number;
  last_updated?: string;
}

export interface DataDisclosure {
  ticker: string;
  requested_start: string;
  actual_start: string;
  requested_end: string;
  actual_end: string;
  years_requested: number;
  years_actual: number;
  years_missing: number;
  disclosure?: string;
}

export interface MonteCarloResponse {
  aggregated_metrics: AggregatedMetrics;
  execution_time: number;
  historical_data_range: string;
  simulation_metadata: SimulationMetadata;
  treasury_metadata?: TreasuryMetadata;
  data_disclosures?: DataDisclosure[];
  portfolio_summary: Array<{
    ticker: string;
    allocation: number;
  }>;
  percentile_paths?: {
    time_years: number[];
    percentile_paths_nominal: Record<string, number[]>;
    percentile_paths_real: Record<string, number[]>;
    initial_balance: number;
  };
}

export const monteCarloApi = {
  async runSimulation(request: MonteCarloRequest): Promise<MonteCarloResponse> {
    try {
      const response = await axios.post<MonteCarloResponse>(
        `${API_BASE_URL}/api/monte-carlo/simulate`,
        request,
        {
          timeout: 60000, // 60 second timeout for large simulations
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monte Carlo API error:', error.response?.data || error.message);
        
        if (error.response?.status === 422) {
          throw new Error('Invalid simulation parameters. Please check your inputs.');
        } else if (error.response?.status === 500) {
          throw new Error('Server error during simulation. Please try again.');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Simulation timed out. Try reducing the number of simulations.');
        }
      }
      
      throw new Error('Failed to run Monte Carlo simulation');
    }
  },

  async getAvailableTickers(): Promise<string[]> {
    try {
      const response = await axios.get<string[]>(
        `${API_BASE_URL}/api/tickers/available`,
        { timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch available tickers:', error);
      // Return default tickers if API fails
      return ['SPY', 'QQQ', 'BND', 'VTI', 'VOO', 'IWM', 'EFA', 'EEM', 'GLD', 'TLT'];
    }
  },

  async getInflationData(): Promise<any> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/inflation/data`,
        { timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch inflation data:', error);
      return null;
    }
  },

  async getTreasuryRates(): Promise<any> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/treasury/rates`,
        { timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch Treasury rates:', error);
      return null;
    }
  },

  async getCurrentRiskFreeRate(): Promise<any> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/treasury/current`,
        { timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to fetch current risk-free rate:', error);
      return null;
    }
  },

  async setTreasuryDuration(duration: string): Promise<any> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/treasury/duration`,
        null,
        { 
          params: { duration },
          timeout: 10000 
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to set Treasury duration:', error);
      throw error;
    }
  }
};

// Helper function to format large numbers
export function formatLargeNumber(value: number): string {
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(2)}B`;
  } else if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
}

// Helper function to format percentages
export function formatPercentage(value: number, decimals: number = 1): string {
  // Convert decimal to percentage (e.g., 0.1057 -> 10.57%)
  const percentageValue = value * 100;
  return `${percentageValue.toFixed(decimals)}%`;
}

// Helper function to get risk level from volatility
export function getRiskLevel(volatility: number): { level: string; color: string } {
  if (volatility < 10) {
    return { level: 'Low', color: 'text-green-600' };
  } else if (volatility < 20) {
    return { level: 'Moderate', color: 'text-yellow-600' };
  } else if (volatility < 30) {
    return { level: 'High', color: 'text-orange-600' };
  } else {
    return { level: 'Very High', color: 'text-red-600' };
  }
}