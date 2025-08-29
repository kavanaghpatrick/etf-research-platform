// Data transformation utilities for Nivo charts

export interface ChartDataPoint {
  date: string; // ISO format
  price: number;
  volume?: number;
}

export interface NivoDataPoint {
  x: string | Date;
  y: number;
}

export interface NivoSeries {
  id: string;
  data: NivoDataPoint[];
}

export interface ApiTickerData {
  Date: string;
  Open?: number;
  High?: number;
  Low?: number;
  Close?: number;
  Volume?: number;
}

/**
 * Transform API ticker data to Nivo line chart format
 */
export function transformToNivoFormat(
  tickerData: ApiTickerData[],
  priceField: 'Open' | 'High' | 'Low' | 'Close' = 'Close',
  ticker: string = 'Price'
): NivoSeries[] {
  if (!tickerData || tickerData.length === 0) {
    return [];
  }

  const data: NivoDataPoint[] = tickerData.map((point) => ({
    x: new Date(point.Date),
    y: point[priceField] || 0,
  }));

  return [
    {
      id: ticker,
      data: data.sort((a, b) => new Date(a.x).getTime() - new Date(b.x).getTime()),
    },
  ];
}

/**
 * Transform multiple tickers data for comparison charts
 */
export function transformMultipleTickersToNivo(
  tickersData: Record<string, { data: ApiTickerData[] }>,
  priceField: 'Open' | 'High' | 'Low' | 'Close' = 'Close'
): NivoSeries[] {
  return Object.entries(tickersData).map(([ticker, tickerInfo]) =>
    transformToNivoFormat(tickerInfo.data, priceField, ticker)
  ).flat();
}

/**
 * Format price values for display
 */
export function formatPrice(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '$0.00';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format volume values for display
 */
export function formatVolume(value: number): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0';
  }

  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format date for chart axes based on data range
 */
export function formatChartDate(date: Date | string, dataLength: number): string {
  const d = new Date(date);
  
  if (dataLength <= 7) {
    // For very short ranges (1 week), show day and date
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  } else if (dataLength <= 30) {
    // For short ranges (up to 1 month), show month and day
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (dataLength <= 180) {
    // For 3-6 month ranges, show month and 2-digit year
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  } else if (dataLength <= 550) {
    // For 1-2 year ranges, show month and full year
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } else {
    // For multi-year ranges (2+ years), show month and full year
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}

/**
 * Calculate price change percentage between first and last data points
 */
export function calculatePriceChange(data: ApiTickerData[]): {
  change: number;
  changePercent: number;
  isPositive: boolean;
} {
  if (!data || data.length < 2) {
    return { change: 0, changePercent: 0, isPositive: true };
  }

  const sortedData = [...data].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  const firstPrice = sortedData[0].Close;
  const lastPrice = sortedData[sortedData.length - 1].Close;
  
  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;
  
  return {
    change,
    changePercent,
    isPositive: change >= 0,
  };
}

/**
 * Get data range boundaries for chart domain
 */
export function getDataRange(data: ApiTickerData[]): {
  minPrice: number;
  maxPrice: number;
  minDate: Date;
  maxDate: Date;
} {
  if (!data || data.length === 0) {
    const now = new Date();
    return {
      minPrice: 0,
      maxPrice: 100,
      minDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      maxDate: now,
    };
  }

  const prices = data.flatMap(d => [d.Open, d.High, d.Low, d.Close]).filter(p => p !== null && p !== undefined);
  const dates = data.map(d => new Date(d.Date));

  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minDate: new Date(Math.min(...dates.map(d => d.getTime()))),
    maxDate: new Date(Math.max(...dates.map(d => d.getTime()))),
  };
}

/**
 * Downsample data for performance with large datasets
 */
export function downsampleData(data: ApiTickerData[], maxPoints: number = 500): ApiTickerData[] {
  if (!data || data.length <= maxPoints) {
    return data;
  }

  const step = Math.ceil(data.length / maxPoints);
  const downsampled: ApiTickerData[] = [];

  for (let i = 0; i < data.length; i += step) {
    downsampled.push(data[i]);
  }

  // Always include the last data point
  if (downsampled[downsampled.length - 1] !== data[data.length - 1]) {
    downsampled.push(data[data.length - 1]);
  }

  return downsampled;
}

/**
 * Transform multiple tickers data for normalized comparison charts (percentage change from start)
 */
export function transformMultipleTickersToNivoNormalized(
  tickersData: Record<string, { data: ApiTickerData[] }>,
  priceField: 'Open' | 'High' | 'Low' | 'Close' = 'Close'
): NivoSeries[] {
  return Object.entries(tickersData).map(([ticker, tickerInfo]) => {
    const sortedData = [...tickerInfo.data].sort((a, b) => 
      new Date(a.Date).getTime() - new Date(b.Date).getTime()
    );
    
    if (sortedData.length === 0) {
      return { id: ticker, data: [] };
    }
    
    const firstPrice = sortedData[0][priceField] || 1;
    
    const normalizedData: NivoDataPoint[] = sortedData.map((point) => ({
      x: new Date(point.Date),
      y: ((point[priceField] || 0) / firstPrice - 1) * 100, // Percentage change from start
    }));
    
    return {
      id: ticker,
      data: normalizedData,
    };
  });
}