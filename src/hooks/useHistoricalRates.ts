import { useState, useEffect } from 'react';
import { getHistoricalRates } from '../lib/tradermade';

interface ChartDataPoint {
  date: string;
  price: number;
  timestamp: number; // Add timestamp for chart compatibility
}

interface UseHistoricalRatesReturn {
  selectedPair: string;
  selectedTimeframe: string;
  chartData: ChartDataPoint[];
  availablePairs: string[];
  isLoading: boolean;
  error: string | null;
  setSelectedPair: (pair: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  fetchRateForDateTime: (date: Date, time: string) => Promise<number | null>;
}

// Available pairs matching main calculator
const AVAILABLE_PAIRS = [
  { value: 'GBPUSD', label: 'GBP/USD' },
  { value: 'GBPEUR', label: 'GBP/EUR' },
  { value: 'EURUSD', label: 'EUR/USD' },
  { value: 'GBPNOK', label: 'GBP/NOK' },
  { value: 'GBPSEK', label: 'GBP/SEK' },
  { value: 'GBPAUD', label: 'GBP/AUD' }
];

// Timeframe configurations - Fixed for 1D
const TIMEFRAMES = [
  { label: '1D', days: 1, interval: 'hourly', hoursToShow: 24 },
  { label: '5D', days: 5, interval: 'daily' },
  { label: '1M', days: 30, interval: 'daily' },
  { label: '3M', days: 90, interval: 'daily' }
];

export const useHistoricalRates = (initialPair: string = 'GBPUSD'): UseHistoricalRatesReturn => {
  const [selectedPair, setSelectedPair] = useState<string>(initialPair);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range based on timeframe
  const getDateRange = (timeframe: string) => {
    const endDate = new Date();
    const startDate = new Date();
    
    const timeConfig = TIMEFRAMES.find(t => t.label === timeframe);
    if (timeConfig) {
      // For 1D, fetch 2 days to ensure we have enough hourly data
      const daysToFetch = timeConfig.label === '1D' ? 2 : timeConfig.days;
      startDate.setDate(endDate.getDate() - daysToFetch);
    } else {
      startDate.setDate(endDate.getDate() - 30); // Default to 1 month
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      interval: timeConfig?.interval || 'daily'
    };
  };

  // Get mock data as fallback - Enhanced for 1D
  const getMockData = (pair: string, timeframe: string): ChartDataPoint[] => {
    const timeConfig = TIMEFRAMES.find(t => t.label === timeframe);
    const basePrices: Record<string, number> = {
      'GBPUSD': 1.27,
      'GBPEUR': 1.18,
      'EURUSD': 1.07,
      'GBPNOK': 13.56,
      'GBPSEK': 13.89,
      'GBPAUD': 1.92
    };
    const basePrice = basePrices[pair] || 1.0;
    
    const data: ChartDataPoint[] = [];
    let currentPrice = basePrice;
    
    if (timeframe === '1D') {
      // Generate hourly data for the last 24 hours
      for (let i = 24; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i);
        
        // Create more realistic hourly price movement
        const hourlyChange = (Math.random() - 0.5) * 0.0005; // Smaller changes for hourly
        currentPrice = currentPrice * (1 + hourlyChange);
        
        data.push({
          date: date.toISOString(),
          price: Number(currentPrice.toFixed(4)),
          timestamp: date.getTime()
        });
      }
    } else {
      // Daily data for other timeframes
      const days = timeConfig?.days || 30;
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const dailyChange = (Math.random() - 0.5) * 0.01;
        currentPrice = currentPrice * (1 + dailyChange);
        const intradayVariation = (Math.random() - 0.5) * 0.002;
        
        data.push({
          date: date.toISOString().split('T')[0],
          price: Number((currentPrice + intradayVariation).toFixed(4)),
          timestamp: date.getTime()
        });
      }
    }
    
    console.log(`Generated mock data for ${timeframe}, points:`, data.length);
    return data;
  };

  // Fetch historical data from TraderMade
  const fetchHistoricalData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { start, end, interval } = getDateRange(selectedTimeframe);
      
      // Try to fetch from TraderMade API
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          start,
          end,
          interval as 'daily' | 'hourly' | 'minute'
        );
        
        console.log('TraderMade API response:', historicalData);
        
        if (historicalData && historicalData.length > 0) {
          // Transform data for chart with timestamp
          let transformedData: ChartDataPoint[] = historicalData.map(point => ({
            date: point.date,
            price: point.close,
            timestamp: new Date(point.date).getTime()
          }));
          
          // For 1D timeframe, filter to last 24 hours only
          if (selectedTimeframe === '1D') {
            const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
            transformedData = transformedData.filter(point => point.timestamp >= cutoffTime);
          }
          
          console.log('Using real TraderMade data, points:', transformedData.length);
          setChartData(transformedData);
          setError(null);
        } else {
          console.log('No data from TraderMade, using mock data');
          setChartData(getMockData(selectedPair, selectedTimeframe));
          setError('Using simulated data - TraderMade data temporarily unavailable');
        }
      } catch (apiError) {
        console.error('TraderMade API error:', apiError);
        // Use mock data as fallback
        setChartData(getMockData(selectedPair, selectedTimeframe));
        setError('Using simulated data - Unable to fetch live data');
      }
    } catch (err) {
      console.error('Error in fetchHistoricalData:', err);
      setError('Failed to load historical data');
      setChartData(getMockData(selectedPair, selectedTimeframe));
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch specific rate for date/time - Enhanced with validation
  const fetchRateForDateTime = async (date: Date, time: string): Promise<number | null> => {
    try {
      // Validate date is not in the future
      const now = new Date();
      if (date > now) {
        console.error('Cannot fetch rates for future dates');
        setError('Cannot fetch rates for future dates');
        return null;
      }
      
      // Format date for TraderMade API
      const dateStr = date.toISOString().split('T')[0];
      
      console.log(`Fetching rate for ${dateStr} at ${time}`);
      
      // Parse time for minute-level data
      const [hours, minutes] = time.split(':').map(num => parseInt(num) || 0);
      const dateTime = new Date(date);
      dateTime.setHours(hours, minutes, 0, 0);
      
      // Check if the datetime is in the future
      if (dateTime > now) {
        console.error('Cannot fetch rates for future times');
        setError('Cannot fetch rates for future times');
        return null;
      }
      
      // Try to get minute-level data with Professional plan
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          dateStr,
          dateStr,
          'minute' // Use minute data for specific times
        );
        
        if (historicalData && historicalData.length > 0) {
          // Find the closest time match
          const targetTime = dateTime.getTime();
          let closestRate = historicalData[0];
          let closestDiff = Infinity;
          
          for (const point of historicalData) {
            const pointTime = new Date(point.date).getTime();
            const diff = Math.abs(pointTime - targetTime);
            if (diff < closestDiff) {
              closestDiff = diff;
              closestRate = point;
            }
          }
          
          console.log(`Found rate: ${closestRate.close} for ${dateStr} ${time}`);
          setError(null); // Clear any previous errors
          return closestRate.close;
        }
      } catch (apiError: any) {
        console.error('API error fetching specific rate:', apiError);
        // Check if it's a 403 error
        if (apiError.message?.includes('403') || apiError.message?.includes('HTTP error')) {
          setError('API access error - Using simulated data');
        }
      }
      
      // Fallback to mock rate
      const basePrices: Record<string, number> = {
        'GBPUSD': 1.27,
        'GBPEUR': 1.18,
        'EURUSD': 1.07,
        'GBPNOK': 13.56,
        'GBPSEK': 13.89,
        'GBPAUD': 1.92
      };
      const basePrice = basePrices[selectedPair] || 1.0;
      const mockRate = basePrice + (Math.random() - 0.5) * 0.02;
      setError('Using simulated data - TraderMade data temporarily unavailable');
      return mockRate;
    } catch (err) {
      console.error('Error fetching specific rate:', err);
      setError('Error fetching historical rate');
      return null;
    }
  };

  // Fetch data when pair or timeframe changes
  useEffect(() => {
    fetchHistoricalData();
  }, [selectedPair, selectedTimeframe]);

  const availablePairs = AVAILABLE_PAIRS.map(p => p.value);

  return {
    selectedPair,
    selectedTimeframe,
    chartData,
    availablePairs,
    isLoading,
    error,
    setSelectedPair,
    setSelectedTimeframe,
    fetchRateForDateTime
  };
};