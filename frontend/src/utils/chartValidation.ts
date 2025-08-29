/**
 * Chart data validation utilities for ETF Research Platform
 */

export interface ChartValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validates percentile path data for charts
 */
export function validateChartData(data: any): ChartValidationResult {
  // Check if data exists
  if (!data) {
    return { valid: false, error: 'No data provided for chart' };
  }

  // Check for percentile_paths structure
  if (!data.percentile_paths && !data.time_years) {
    return { valid: false, error: 'Invalid data structure: missing required fields' };
  }

  // For newer data format (direct properties)
  if (data.time_years) {
    const { time_years, percentile_paths_nominal, percentile_paths_real } = data;
    
    // Check time series exists
    if (!Array.isArray(time_years) || time_years.length === 0) {
      return { valid: false, error: 'No time series data available' };
    }
    
    // Check percentile data exists
    if (!percentile_paths_nominal || !percentile_paths_real) {
      return { valid: false, error: 'Missing nominal or real percentile data' };
    }
    
    // Check data consistency
    const expectedLength = time_years.length;
    const percentileKeys = ['10th', '50th', '90th'];
    const warnings: string[] = [];
    
    for (const key of percentileKeys) {
      // Check nominal paths
      if (!percentile_paths_nominal[key]) {
        return { valid: false, error: `Missing ${key} percentile in nominal data` };
      }
      if (!Array.isArray(percentile_paths_nominal[key])) {
        return { valid: false, error: `Invalid ${key} percentile data type` };
      }
      if (percentile_paths_nominal[key].length !== expectedLength) {
        warnings.push(`Data length mismatch for ${key} percentile (expected ${expectedLength}, got ${percentile_paths_nominal[key].length})`);
      }
      
      // Check for NaN or Infinity values
      if (percentile_paths_nominal[key].some((v: number) => !isFinite(v))) {
        return { valid: false, error: `Invalid numeric values in ${key} percentile` };
      }
      
      // Check real paths
      if (!percentile_paths_real[key]) {
        warnings.push(`Missing ${key} percentile in real data`);
      } else if (!Array.isArray(percentile_paths_real[key])) {
        return { valid: false, error: `Invalid ${key} percentile real data type` };
      }
    }
    
    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }
  
  // For older data format (nested percentile_paths)
  const { percentile_paths } = data;
  const { time_years, percentile_paths_nominal, percentile_paths_real } = percentile_paths;
  
  // Check all required data exists
  if (!time_years?.length) {
    return { valid: false, error: 'No time series data available' };
  }
  
  if (!percentile_paths_nominal || !percentile_paths_real) {
    return { valid: false, error: 'Missing nominal or real percentile data' };
  }
  
  // Check data consistency
  const expectedLength = time_years.length;
  const percentileKeys = ['10th', '50th', '90th'];
  const warnings: string[] = [];
  
  for (const key of percentileKeys) {
    if (!percentile_paths_nominal[key] || percentile_paths_nominal[key].length !== expectedLength) {
      return { valid: false, error: `Invalid data length for ${key} percentile` };
    }
    
    // Check for NaN or Infinity values
    if (percentile_paths_nominal[key].some((v: number) => !isFinite(v))) {
      return { valid: false, error: `Invalid numeric values in ${key} percentile` };
    }
    
    // Warn if real data is missing
    if (!percentile_paths_real[key]) {
      warnings.push(`Missing ${key} percentile in real data`);
    }
  }
  
  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

/**
 * Safe chart data wrapper with error boundary
 */
export function createSafeChartData(data: any): any {
  const validation = validateChartData(data);
  
  if (!validation.valid) {
    console.error('Chart data validation failed:', validation.error);
    
    // Return minimal valid data structure to prevent crashes
    return {
      time_years: [0, 1],
      percentile_paths_nominal: {
        '10th': [100000, 100000],
        '50th': [100000, 100000],
        '90th': [100000, 100000],
      },
      percentile_paths_real: {
        '10th': [100000, 100000],
        '50th': [100000, 100000], 
        '90th': [100000, 100000],
      },
      initial_balance: 100000
    };
  }
  
  // Log any warnings
  if (validation.warnings) {
    console.warn('Chart data warnings:', validation.warnings);
  }
  
  return data;
}