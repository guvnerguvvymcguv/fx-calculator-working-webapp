import { useState, useEffect } from 'react';
import { getHistoricalRates } from '../lib/tradermade';

interface ChartDataPoint {
  date: string;
  price: number;
  timestamp: number;
}

interface UseHistoricalRatesReturn {
  selectedPair: string;
  selectedTimeframe: string;
  chartData: ChartDataPoint[];
  availablePairs: string[];
  isLoading: boolean;
  error: string | null;
  isRealData: boolean;
  setSelectedPair: (pair: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  fetchRateForDateTime: (date: Date, time: string) => Promise<number | null>;
  fetchHistoricalDataForDate?: (centerDate: Date, timeframe: string) => Promise<void>;
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

// Timeframe configurations with proper intervals
const TIMEFRAMES = [
  { label: '1D', days: 1, interval: 'minute', pointsInterval: 30 }, // Every 30 minutes for 24 hours = 48 points
  { label: '5D', days: 5, interval: 'hourly', pointsInterval: 3 }, // Every 3 hours for 5 days = 40 points
  { label: '1M', days: 30, interval: 'daily', pointsInterval: 1 }, // Daily for 30 days = 30 points
  { label: '3M', days: 90, interval: 'daily', pointsInterval: 1 } // Daily for 90 days = 90 points
];

export const useHistoricalRates = (initialPair: string = 'GBPUSD'): UseHistoricalRatesReturn => {
  const [selectedPair, setSelectedPair] = useState<string>(initialPair);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState<boolean>(false);
  const [searchedDate, setSearchedDate] = useState<Date | null>(null);

  // Format date to UK timezone
  const formatToUKDate = (date: Date): string => {
    // Use UTC methods to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate date range based on timeframe
  const getDateRange = (timeframe: string, centerDate?: Date) => {
    const timeConfig = TIMEFRAMES.find(t => t.label === timeframe);
    if (!timeConfig) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    let endDate: Date;
    let startDate: Date;

    if (centerDate) {
      // For searched dates, center the range around the searched date
      const halfDays = Math.floor(timeConfig.days / 2);
      startDate = new Date(centerDate);
      startDate.setDate(centerDate.getDate() - halfDays);
      endDate = new Date(centerDate);
      endDate.setDate(centerDate.getDate() + halfDays);
    } else {
      // For normal view, show from past to now
      endDate = new Date();
      startDate = new Date();
      startDate.setDate(endDate.getDate() - timeConfig.days);
    }

    // Ensure we don't request future dates
    const today = new Date();
    if (endDate > today) {
      endDate = today;
    }

    return {
      start: formatToUKDate(startDate),
      end: formatToUKDate(endDate),
      interval: timeConfig.interval,
      pointsInterval: timeConfig.pointsInterval
    };
  };

  // Generate more realistic mock data with proper density
  const getMockData = (pair: string, timeframe: string, centerDate?: Date): ChartDataPoint[] => {
    const timeConfig = TIMEFRAMES.find(t => t.label === timeframe);
    if (!timeConfig) return [];

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
    
    // Calculate number of points based on timeframe
    let numPoints: number;
    let intervalHours: number;
    
    switch (timeframe) {
      case '1D':
        numPoints = 48; // 48 half-hour points for 24 hours
        intervalHours = 0.5;
        break;
      case '5D':
        numPoints = 40; // 40 points over 5 days (every 3 hours)
        intervalHours = 3;
        break;
      case '1M':
        numPoints = 30; // 30 daily points
        intervalHours = 24;
        break;
      case '3M':
        numPoints = 90; // 90 daily points
        intervalHours = 24;
        break;
      default:
        numPoints = 30;
        intervalHours = 24;
    }
    
    // Generate data points
    const startDate = centerDate ? new Date(centerDate) : new Date();
    const startOffset = centerDate ? -Math.floor(numPoints / 2) : -numPoints + 1;
    
    for (let i = 0; i < numPoints; i++) {
      const pointDate = new Date(startDate);
      pointDate.setHours(pointDate.getHours() + (startOffset + i) * intervalHours);
      
      // Don't include future dates
      if (pointDate > new Date()) continue;
      
      // Create realistic price movement
      const volatility = timeframe === '1D' ? 0.0005 : 0.001; // Less volatility for shorter timeframes
      const change = (Math.random() - 0.5) * volatility;
      currentPrice = currentPrice * (1 + change);
      
      // Keep price within realistic bounds
      const maxDeviation = basePrice * 0.05; // 5% max deviation
      currentPrice = Math.max(basePrice - maxDeviation, Math.min(basePrice + maxDeviation, currentPrice));
      
      data.push({
        date: pointDate.toISOString(),
        price: Number(currentPrice.toFixed(4)),
        timestamp: pointDate.getTime()
      });
    }
    
    console.log(`Generated mock data for ${timeframe}, points:`, data.length);
    return data.sort((a, b) => a.timestamp - b.timestamp);
  };

  // Process API data to ensure proper density
  const processApiData = (apiData: any[], timeframe: string): ChartDataPoint[] => {
    const timeConfig = TIMEFRAMES.find(t => t.label === timeframe);
    if (!timeConfig || !apiData || apiData.length === 0) return [];

    let processedData: ChartDataPoint[] = [];

    // For minute/hourly data, sample at appropriate intervals
    if (timeframe === '1D' && timeConfig.interval === 'minute') {
      // Take every 30th minute for 1D view
      processedData = apiData
        .filter((_, index) => index % 30 === 0)
        .map(point => ({
          date: point.date,
          price: point.close,
          timestamp: new Date(point.date).getTime()
        }));
    } else if (timeframe === '5D' && timeConfig.interval === 'hourly') {
      // Take every 3rd hour for 5D view
      processedData = apiData
        .filter((_, index) => index % 3 === 0)
        .map(point => ({
          date: point.date,
          price: point.close,
          timestamp: new Date(point.date).getTime()
        }));
    } else {
      // For daily data, use all points
      processedData = apiData.map(point => ({
        date: point.date,
        price: point.close,
        timestamp: new Date(point.date).getTime()
      }));
    }

    console.log(`Processed ${processedData.length} points from ${apiData.length} API data points`);
    return processedData;
  };

  // Fetch historical data from TraderMade
  const fetchHistoricalData = async (centerDate?: Date) => {
    try {
      setIsLoading(true);
      setError(null);
      setIsRealData(false);
      
      const { start, end, interval } = getDateRange(selectedTimeframe, centerDate);
      
      console.log(`Fetching ${interval} data from ${start} to ${end} for ${selectedPair}`);
      
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
          // Process data to get appropriate density
          const transformedData = processApiData(historicalData, selectedTimeframe);
          
          if (transformedData.length > 0) {
            console.log(`Using real TraderMade data, ${transformedData.length} points`);
            setChartData(transformedData);
            setIsRealData(true);
            setError(null);
          } else {
            throw new Error('No valid data points after processing');
          }
        } else {
          throw new Error('No data returned from API');
        }
      } catch (apiError: any) {
        console.error('TraderMade API error:', apiError);
        
        // Check for specific error types
        let errorMessage = 'Using simulated data - ';
        if (apiError.message?.includes('403')) {
          errorMessage += 'API access denied. Check API key permissions.';
        } else if (apiError.message?.includes('404')) {
          errorMessage += 'Data not available for this date range.';
        } else if (apiError.message?.includes('429')) {
          errorMessage += 'Rate limit reached. Please try again later.';
        } else {
          errorMessage += 'Unable to fetch live data.';
        }
        
        // Use mock data as fallback
        setChartData(getMockData(selectedPair, selectedTimeframe, centerDate));
        setError(errorMessage);
        setIsRealData(false);
      }
    } catch (err: any) {
      console.error('Error in fetchHistoricalData:', err);
      setError('Failed to load historical data - Using simulated data');
      setChartData(getMockData(selectedPair, selectedTimeframe, centerDate));
      setIsRealData(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch specific rate for date/time
  const fetchRateForDateTime = async (date: Date, time: string): Promise<number | null> => {
    try {
      // Validate date is not in future
      const now = new Date();
      if (date > now) {
        setError('Cannot fetch rates for future dates');
        return null;
      }
      
      // Format date for TraderMade API
      const dateStr = formatToUKDate(date);
      
      console.log(`Fetching specific rate for ${dateStr} at ${time}`);
      
      // Parse time
      const timeParts = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (!timeParts) {
        setError('Invalid time format. Use format like 09:00 or 9:00 AM');
        return null;
      }
      
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2] || '0');
      const meridiem = timeParts[3]?.toLowerCase();
      
      // Convert to 24-hour format if PM
      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      
      const dateTime = new Date(date);
      dateTime.setHours(hours, minutes, 0, 0);
      
      // Store the searched date for chart centering
      setSearchedDate(dateTime);
      
      // Try to get minute-level data
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          dateStr,
          dateStr,
          'minute'
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
          
          console.log(`Found real rate: ${closestRate.close} for ${dateStr} ${time}`);
          setError(null);
          
          // Update chart to center on this date
          await fetchHistoricalData(dateTime);
          
          return closestRate.close;
        }
      } catch (apiError: any) {
        console.error('API error fetching specific rate:', apiError);
        setError('Unable to fetch real rate - Showing simulated rate');
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
      
      // Update chart with mock data centered on searched date
      await fetchHistoricalData(dateTime);
      
      return mockRate;
    } catch (err: any) {
      console.error('Error fetching specific rate:', err);
      setError('Error fetching rate: ' + err.message);
      return null;
    }
  };

  // Fetch data when pair or timeframe changes
  useEffect(() => {
    fetchHistoricalData(searchedDate || undefined);
  }, [selectedPair, selectedTimeframe]);

  const availablePairs = AVAILABLE_PAIRS.map(p => p.value);

  return {
    selectedPair,
    selectedTimeframe,
    chartData,
    availablePairs,
    isLoading,
    error,
    isRealData,
    setSelectedPair,
    setSelectedTimeframe,
    fetchRateForDateTime,
    fetchHistoricalDataForDate: fetchHistoricalData
  };
};