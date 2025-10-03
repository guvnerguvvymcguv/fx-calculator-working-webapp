import { useState, useEffect } from 'react';
import { getHistoricalForexRate, getHistoricalForexRange, hasHistoricalData } from '../lib/supabase';

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
  dataPrecision: 'minute' | '5min' | '15min' | '30min' | 'hourly' | 'daily';
  setSelectedPair: (pair: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;
  fetchRateForDateTime: (date: Date, time: string) => Promise<number | null>;
  fetchHistoricalDataForDate?: (centerDate: Date, timeframe: string) => Promise<void>;
  fetchDataWithGranularity?: (granularity: string) => Promise<void>;
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

// Updated timeframe configurations - removed 1M and 3M, added 2M
const TIMEFRAMES = [
  { label: '1D', days: 1, targetPoints: 1440 },   // All minute points for 1 day
  { label: '5D', days: 5, targetPoints: 480 },    // Default 15-min points for 5 days
  { label: '2M', days: 60, targetPoints: 2880 }   // Default 30-min points for 60 days
];

// Pair mapping for inverses (query EURGBP for GBPEUR label)
const PAIR_MAP: Record<string, string> = {
  'GBPEUR': 'EURGBP',
};

export const useHistoricalRates = (initialPair: string = 'GBPUSD'): UseHistoricalRatesReturn => {
  const [selectedPair, setSelectedPair] = useState<string>(initialPair);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('2M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isRealData = true; // Always true with Supabase data
  const [dataPrecision, setDataPrecision] = useState<'minute' | '5min' | '15min' | '30min' | 'hourly' | 'daily'>('30min');
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);

  // Format date to YYYY-MM-DD format for Supabase
  const formatToSQLDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Convert granularity string to interval type
  const granularityToInterval = (granularity: string): 'minute' | '5min' | '15min' | '30min' | 'hourly' | 'daily' => {
    switch (granularity) {
      case '1-min':
        return 'minute';
      case '5-min':
        return '5min';
      case '15-min':
        return '15min';
      case '30-min':
        return '30min';
      case '1-hour':
        return 'hourly';
      default:
        return '30min';
    }
  };

  // Determine the default interval based on timeframe
  const determineDefaultInterval = (timeframe: string): 
    { interval: 'minute' | '5min' | '15min' | '30min' | 'hourly' | 'daily', precision: 'minute' | '5min' | '15min' | '30min' | 'hourly' | 'daily' } => {
    
    switch (timeframe) {
      case '1D':
        return { interval: 'minute', precision: 'minute' }; // Always minute data for 1 day
      case '5D':
        return { interval: '15min', precision: '15min' }; // Start with 15-min data for 5 days
      case '2M':
        return { interval: '30min', precision: '30min' }; // Start with 30-min data for 2 months
      default:
        return { interval: 'daily', precision: 'daily' };
    }
  };

  // Calculate date range based on timeframe
  const getDateRange = (timeframe: string, centerDate?: Date) => {
    const timeConfig = TIMEFRAMES.find(t => t.label === timeframe);
    if (!timeConfig) {
      throw new Error(`Invalid timeframe: ${timeframe}`);
    }

    // Get current date (we have data up to yesterday)
    const maxAvailableDate = new Date(); // Current date
    let endDate: Date;
    let startDate: Date;

    if (centerDate) {
      const halfDays = Math.floor(timeConfig.days / 2);
      startDate = new Date(centerDate);
      startDate.setDate(centerDate.getDate() - halfDays);
      endDate = new Date(centerDate);
      endDate.setDate(centerDate.getDate() + halfDays);
    } else {
      endDate = maxAvailableDate;
      startDate = new Date(maxAvailableDate);
      startDate.setDate(maxAvailableDate.getDate() - timeConfig.days);
    }

    // Cap at our data range (dynamic)
    const minDataDate = new Date('2024-09-30');
    const maxDataDate = new Date();
    maxDataDate.setDate(maxDataDate.getDate() - 1); // Allow up to yesterday
    
    if (startDate < minDataDate) startDate = minDataDate;
    if (endDate > maxDataDate) endDate = maxDataDate;

    // Ensure start <= end (fix reversed range)
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    // Store the date range for later use
    setDateRange({ start: startDate, end: endDate });

    const { interval, precision } = determineDefaultInterval(timeframe);

    return {
      start: formatToSQLDate(startDate),
      end: formatToSQLDate(endDate),
      interval,
      precision,
      targetPoints: timeConfig.targetPoints
    };
  };

  // Process Supabase data into chart format
  const processSupabaseData = (data: any[]): ChartDataPoint[] => {
    if (!data || data.length === 0) return [];

    return data.map(point => ({
      date: point.timestamp,
      price: point.close,
      timestamp: new Date(point.timestamp).getTime()
    }));
  };

  // Fetch historical data from Supabase with specific granularity
const fetchHistoricalDataWithGranularity = async (granularity?: string, centerDate?: Date) => {
  try {
    setIsLoading(true);
    setError(null);
    
    let interval: 'minute' | '5min' | '15min' | '30min' | 'hourly' | 'daily';
    let start: string;
    let end: string;
    
    if (granularity && dateRange) {
      // Use the stored date range with new granularity
      const convertedInterval = granularityToInterval(granularity);
      interval = convertedInterval;
      start = formatToSQLDate(dateRange.start);
      end = formatToSQLDate(dateRange.end);
    } else {
      // Use default calculation
      const rangeData = getDateRange(selectedTimeframe, centerDate);
      interval = rangeData.interval;
      start = rangeData.start;
      end = rangeData.end;
    }
    
    console.log(`Fetching ${interval} data from ${start} to ${end} for ${selectedPair} from Supabase`);
    
    // Set data precision based on interval using switch statement
    switch (interval) {
      case 'minute':
        setDataPrecision('minute');
        break;
      case '5min':
        setDataPrecision('5min');
        break;
      case '15min':
        setDataPrecision('15min');
        break;
      case '30min':
        setDataPrecision('30min');
        break;
      case 'hourly':
        setDataPrecision('hourly');
        break;
      case 'daily':
        setDataPrecision('daily');
        break;
      default:
        setDataPrecision('daily');
    }
    
    // Fetch from Supabase - explicitly type the interval parameter
    const queryPair = PAIR_MAP[selectedPair] || selectedPair;
    const typedInterval = interval as Parameters<typeof getHistoricalForexRange>[3];
    const historicalData = await getHistoricalForexRange(
      queryPair,
      start,
      end,
      typedInterval
    );
    
    // Invert for GBPEUR (close only; extend to OHLC if charts need full)
    if (selectedPair === 'GBPEUR') {
      historicalData.forEach((point: any) => {
        point.close = 1 / point.close;
      });
    }
    
    console.log(`Supabase returned ${historicalData.length} data points`);
    
    if (historicalData && historicalData.length > 0) {
      const transformedData = processSupabaseData(historicalData);
      
      if (transformedData.length > 0) {
        console.log(`Displaying ${transformedData.length} points from Supabase`);
        setChartData(transformedData);
        setError(null);
      } else {
        throw new Error('No valid data points after processing');
      }
    } else {
      // Check if we have any data for this pair/date
      const hasData = await hasHistoricalData(queryPair, start);
      if (!hasData) {
        setError('No historical data available for this date range');
      } else {
        setError('Unable to load data. Please try again.');
      }
      setChartData([]);
    }
  } catch (err: any) {
    console.error('Error in fetchHistoricalData:', err);
    setError('Failed to load historical data from database');
    setChartData([]);
  } finally {
    setIsLoading(false);
  }
};

  // Fetch specific rate for date/time from Supabase
  const fetchRateForDateTime = async (date: Date, time: string): Promise<number | null> => {
    try {
      // Validate date is within our data range (dynamic)
      const minDate = new Date('2024-09-30');
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() - 1); // Allow up to yesterday
      
      if (date < minDate || date > maxDate) {
        const minDateStr = minDate.toLocaleDateString('en-GB');
        const maxDateStr = maxDate.toLocaleDateString('en-GB');
        setError(`Historical data only available from ${minDateStr} to ${maxDateStr}`);
        return null;
      }
      
      const dateStr = formatToSQLDate(date);
      
      console.log(`Fetching specific rate for ${dateStr} at ${time} from Supabase`);
      
      // Parse time string
      const timeParts = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (!timeParts) {
        setError('Invalid time format. Use format like 09:00 or 9:00 AM');
        return null;
      }
      
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2] || '0');
      const meridiem = timeParts[3]?.toLowerCase();
      
      // Handle 12-hour format
      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      
      // Format time as HH:MM
      const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      // Query Supabase for exact minute
      const queryPair = PAIR_MAP[selectedPair] || selectedPair;
      const rawRate = await getHistoricalForexRate(
        queryPair,
        dateStr,
        formattedTime
      );
      
      if (rawRate !== null) {
        const displayRate = selectedPair === 'GBPEUR' ? 1 / rawRate : rawRate;
        console.log(`Found raw rate: ${rawRate} (display: ${displayRate}) for ${dateStr} ${formattedTime}`);
        setError(null);
        return displayRate;
      } else {
        // If exact minute not found, try to get the closest minute within the same hour
        console.log('Exact minute not found, checking if data exists for this date');
        
        const hasData = await hasHistoricalData(queryPair, dateStr);
        if (hasData) {
          setError('Rate not available for exact time. Try a different time.');
        } else {
          setError('No data available for this date');
        }
        return null;
      }
    } catch (err: any) {
      console.error('Error fetching specific rate:', err);
      setError('Error fetching rate: ' + err.message);
      return null;
    }
  };

  // Wrapper for fetchDataWithGranularity to be exposed in the return
  const fetchDataWithGranularity = async (granularity: string): Promise<void> => {
    await fetchHistoricalDataWithGranularity(granularity);
  };

  // Fetch data when pair or timeframe changes
  useEffect(() => {
    fetchHistoricalDataWithGranularity();
  }, [selectedPair, selectedTimeframe]);

  const availablePairs = AVAILABLE_PAIRS.map(p => p.value);

  return {
    selectedPair,
    selectedTimeframe,
    chartData,
    availablePairs,
    isLoading,
    error,
    isRealData, // Always true with Supabase data
    dataPrecision,
    setSelectedPair,
    setSelectedTimeframe,
    fetchRateForDateTime,
    fetchHistoricalDataForDate: async (centerDate: Date, _timeframe: string) => {
      await fetchHistoricalDataWithGranularity(undefined, centerDate);
    },
    fetchDataWithGranularity
  };
};