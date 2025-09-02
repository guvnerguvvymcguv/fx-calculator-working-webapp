export interface ChartDataPoint {
  timestamp: number;
  price: number;
}

export interface MockChartData {
  [key: string]: ChartDataPoint[];
}

/**
 * Generate mock historical data for a currency pair
 */
const generateMockData = (basePrice: number, days: number = 90): ChartDataPoint[] => {
  const data: ChartDataPoint[] = [];
  const now = Date.now();
  const hoursToGenerate = days * 24;
  
  let currentPrice = basePrice;
  
  for (let i = hoursToGenerate; i >= 0; i--) {
    const timestamp = now - (i * 60 * 60 * 1000); // Go back i hours
    
    // Add realistic price movement (±0.5% per hour max)
    const volatility = 0.005;
    const change = (Math.random() - 0.5) * volatility;
    currentPrice = currentPrice * (1 + change);
    
    // Keep prices within reasonable bounds
    const minPrice = basePrice * 0.85;
    const maxPrice = basePrice * 1.15;
    currentPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice));
    
    data.push({
      timestamp,
      price: Number(currentPrice.toFixed(4))
    });
  }
  
  return data.sort((a, b) => a.timestamp - b.timestamp);
};

/**
 * Mock historical chart data for FX pairs
 * 90 days of hourly data points
 */
export const MOCK_CHART_DATA: MockChartData = {
  'GBPUSD': generateMockData(1.3550, 90),
  'GBPEUR': generateMockData(1.1685, 90),
  'EURUSD': generateMockData(1.0825, 90),
};

/**
 * Time frame filters for chart data
 */
export const TIMEFRAMES = [
  { label: '1D', days: 1 },
  { label: '5D', days: 5 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
] as const;

/**
 * Filter chart data by timeframe
 */
export const filterDataByTimeframe = (data: ChartDataPoint[], days: number): ChartDataPoint[] => {
  const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
  return data.filter(point => point.timestamp >= cutoffTime);
};

/**
 * Format timestamp for display
 */
export const formatChartDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Get price at specific timestamp (closest match)
 */
export const getPriceAtTime = (data: ChartDataPoint[], targetTimestamp: number): ChartDataPoint | null => {
  if (data.length === 0) return null;
  
  let closest = data[0];
  let minDiff = Math.abs(data[0].timestamp - targetTimestamp);
  
  for (const point of data) {
    const diff = Math.abs(point.timestamp - targetTimestamp);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }
  
  return closest;
};