import { useState, useEffect } from 'react';
import { getHistoricalRates, validateHistoricalDate, getMaxHistoricalDate } from '../lib/tradermade';

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
  dataPrecision: 'minute' | 'hourly' | 'daily';
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

// Updated timeframe configurations
const TIMEFRAMES = [
  { label: '1D', days: 1, targetPoints: 1440 },  // All minute points for 1 day
  { label: '5D', days: 5, targetPoints: 120 },   // Hourly points for 5 days
  { label: '1M', days: 30, targetPoints: 720 },  // Hourly points for 30 days
  { label: '3M', days: 90, targetPoints: 2160 }  // Hourly points for 90 days
];

export const useHistoricalRates = (initialPair: string = 'GBPUSD'): UseHistoricalRatesReturn => {
  const [selectedPair, setSelectedPair] = useState<string>(initialPair);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRealData, setIsRealData] = useState<boolean>(false);
  const [dataPrecision, setDataPrecision] = useState<'minute' | 'hourly' | 'daily'>('daily');
  const [searchedDate, setSearchedDate] = useState<Date | null>(null);

  // Format date to UK timezone
  const formatToUKDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Determine the best interval based on timeframe
  const determineInterval = (timeframe: string): 
    { interval: 'minute' | 'hourly' | 'daily', precision: 'minute' | 'hourly' | 'daily' } => {
    
    switch (timeframe) {
      case '1D':
        return { interval: 'minute', precision: 'minute' }; // Minute data for 1 day
      case '5D':
        return { interval: 'hourly', precision: 'hourly' }; // Hourly to avoid 2-day minute limit
      case '1M':
        return { interval: 'hourly', precision: 'hourly' }; // Hourly for 1 month
      case '3M':
        return { interval: 'hourly', precision: 'hourly' }; // Hourly for 3 months
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

    const maxAvailableDate = getMaxHistoricalDate();
    let endDate: Date;
    let startDate: Date;

    if (centerDate) {
      const validCenterDate = new Date(validateHistoricalDate(formatToUKDate(centerDate)));
      const halfDays = Math.floor(timeConfig.days / 2);
      startDate = new Date(validCenterDate);
      startDate.setDate(validCenterDate.getDate() - halfDays);
      endDate = new Date(validCenterDate);
      endDate.setDate(validCenterDate.getDate() + halfDays);
    } else {
      endDate = maxAvailableDate;
      startDate = new Date(maxAvailableDate);
      startDate.setDate(maxAvailableDate.getDate() - timeConfig.days);
    }

    if (endDate > maxAvailableDate) {
      endDate = maxAvailableDate;
    }

    const { interval, precision } = determineInterval(timeframe);

    return {
      start: formatToUKDate(startDate),
      end: formatToUKDate(endDate),
      interval,
      precision,
      targetPoints: timeConfig.targetPoints
    };
  };

  // Process API data - don't sample if we want all the data
  const processApiData = (apiData: any[], targetPoints: number, timeframe: string): ChartDataPoint[] => {
    if (!apiData || apiData.length === 0) return [];

    let processedData: ChartDataPoint[] = [];
    
    // For 1D with minute data, keep all points
    if (timeframe === '1D') {
      processedData = apiData.map(point => ({
        date: point.date,
        price: point.close || point.mid || point.open,
        timestamp: new Date(point.date).getTime()
      }));
    } else {
      // For other timeframes, sample if needed
      const sampleInterval = Math.max(1, Math.floor(apiData.length / targetPoints));
      
      for (let i = 0; i < apiData.length; i += sampleInterval) {
        if (i < apiData.length) {
          const point = apiData[i];
          processedData.push({
            date: point.date,
            price: point.close || point.mid || point.open,
            timestamp: new Date(point.date).getTime()
          });
        }
      }
      
      // Ensure we don't exceed target points for non-1D timeframes
      if (processedData.length > targetPoints) {
        processedData = processedData.slice(0, targetPoints);
      }
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
      
      const { start, end, interval, precision, targetPoints } = getDateRange(selectedTimeframe, centerDate);
      
      console.log(`Fetching ${interval} data from ${start} to ${end} for ${selectedPair}`);
      setDataPrecision(precision);
      
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          start,
          end,
          interval
        );
        
        console.log('TraderMade API response:', historicalData);
        
        if (historicalData && historicalData.length > 0) {
          const transformedData = processApiData(historicalData, targetPoints, selectedTimeframe);
          
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
        
        // Show clear error message
        let errorMessage = '';
        if (apiError.message?.includes('403')) {
          errorMessage = 'Unable to access historical data. Please check your API permissions.';
        } else if (apiError.message?.includes('404')) {
          errorMessage = 'No data available for this date range.';
        } else if (apiError.message?.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else {
          errorMessage = 'Unable to fetch historical data. Please try again.';
        }
        
        setChartData([]);
        setError(errorMessage);
        setIsRealData(false);
      }
    } catch (err: any) {
      console.error('Error in fetchHistoricalData:', err);
      setError('Failed to load historical data');
      setChartData([]);
      setIsRealData(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch specific rate for date/time - ALWAYS use minute precision for single day
  const fetchRateForDateTime = async (date: Date, time: string): Promise<number | null> => {
    try {
      const maxDate = getMaxHistoricalDate();
      if (date > maxDate) {
        setError(`Historical data only available up to ${maxDate.toLocaleDateString('en-GB')}`);
        return null;
      }
     
      const dateStr = formatToUKDate(date);
      const validatedDate = validateHistoricalDate(dateStr);
      
      console.log(`Fetching specific rate for ${validatedDate} at ${time}`);
      
      const timeParts = time.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
      if (!timeParts) {
        setError('Invalid time format. Use format like 09:00 or 9:00 AM');
        return null;
      }
      
      let hours = parseInt(timeParts[1]);
      const minutes = parseInt(timeParts[2] || '0');
      const meridiem = timeParts[3]?.toLowerCase();
      
      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      
      const dateTime = new Date(date);
      dateTime.setHours(hours, minutes, 0, 0);
      
      setSearchedDate(dateTime);
      
      // Always try minute data first for date/time search (single day request)
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          validatedDate,
          validatedDate,
          'minute'  // Always use minute for single day
        );
        
        if (historicalData && historicalData.length > 0) {
          // Find closest time match for minute data
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
          
          const rate = closestRate.close || closestRate.open;
          console.log(`Found real rate (minute precision): ${rate} for ${validatedDate} ${time}`);
          setError(null);
          // Don't update the chart - just return the rate
          
          return rate;
        } else {
          throw new Error('No data returned from API');
        }
      } catch (apiError: any) {
        // If minute data fails, try hourly as fallback
        console.log('Minute data failed, trying hourly fallback');
        try {
          const historicalData = await getHistoricalRates(
            selectedPair,
            validatedDate,
            validatedDate,
            'hourly'
          );
          
          if (historicalData && historicalData.length > 0) {
            const targetHour = hours;
            const hourlyPoint = historicalData.find(point => {
              const pointDate = new Date(point.date);
              return pointDate.getHours() === targetHour;
            }) || historicalData[0];
            
            const rate = hourlyPoint.close || hourlyPoint.open;
            console.log(`Found real rate (hourly precision fallback): ${rate} for ${validatedDate} hour ${hours}:00`);
            setError('Note: Using hourly average for this date');
            
            return rate;
          } else {
            throw new Error('No hourly data available');
          }
        } catch (hourlyError) {
          console.error('Both minute and hourly data failed:', hourlyError);
          setError('Unable to fetch historical rate for this date/time');
          return null;
        }
      }
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
    dataPrecision,
    setSelectedPair,
    setSelectedTimeframe,
    fetchRateForDateTime,
    fetchHistoricalDataForDate: fetchHistoricalData
  };
};