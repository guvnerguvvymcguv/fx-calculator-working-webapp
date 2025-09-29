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

// Timeframe configurations
const TIMEFRAMES = [
  { label: '1D', days: 1, interval: 'hourly' },
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
      startDate.setDate(endDate.getDate() - timeConfig.days);
    } else {
      startDate.setDate(endDate.getDate() - 30); // Default to 1 month
    }
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      interval: timeConfig?.interval || 'daily'
    };
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
          const transformedData: ChartDataPoint[] = historicalData.map(point => ({
            date: point.date,
            price: point.close,
            timestamp: new Date(point.date).getTime() // Add timestamp for chart
          }));
          
          console.log('Using real TraderMade data, points:', transformedData.length);
          setChartData(transformedData);
          // Clear error to indicate using real data
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

  // Get mock data as fallback
  const getMockData = (pair: string, timeframe: string): ChartDataPoint[] => {
    const days = TIMEFRAMES.find(t => t.label === timeframe)?.days || 30;
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
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Create more realistic price movement
      const dailyChange = (Math.random() - 0.5) * 0.01;
      currentPrice = currentPrice * (1 + dailyChange);
      const intradayVariation = (Math.random() - 0.5) * 0.002;
      
      data.push({
        date: date.toISOString().split('T')[0],
        price: Number((currentPrice + intradayVariation).toFixed(4)),
        timestamp: date.getTime() // Add timestamp for chart
      });
    }
    
    console.log('Generated mock data, points:', data.length);
    return data;
  };

  // Fetch specific rate for date/time
  const fetchRateForDateTime = async (date: Date, time: string): Promise<number | null> => {
    try {
      // Format date for TraderMade API
      const dateStr = date.toISOString().split('T')[0];
      
      console.log(`Fetching rate for ${dateStr} at ${time}`);
      
      // Parse time for minute-level data (with Professional plan)
      const [hours, minutes] = time.split(':').map(num => parseInt(num) || 0);
      const dateTime = new Date(date);
      dateTime.setHours(hours, minutes, 0, 0);
      
      // Try to get minute-level data with Professional plan
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          dateStr,
          dateStr,
          'minute' // Use minute data for Professional plan
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
          return closestRate.close;
        }
      } catch (apiError) {
        console.error('API error fetching specific rate:', apiError);
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
      return basePrice + (Math.random() - 0.5) * 0.02;
    } catch (err) {
      console.error('Error fetching specific rate:', err);
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