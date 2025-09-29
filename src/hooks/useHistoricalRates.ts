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

// Updated timeframe configurations for TradingView-like density
const TIMEFRAMES = [
  { label: '1D', days: 1, targetPoints: 200 },  // ~200 points for 1 day
  { label: '5D', days: 5, targetPoints: 120 },  // ~120 points for 5 days
  { label: '1M', days: 30, targetPoints: 180 }, // ~180 points for 1 month
  { label: '3M', days: 90, targetPoints: 90 }   // 90 points for 3 months (daily)
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

  // Check if date is today
  const isToday = (date: Date): boolean => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is within hourly data range (30 days)
  const isWithinHourlyDataRange = (date: Date): boolean => {
    const maxDate = getMaxHistoricalDate();
    const thirtyDaysAgo = new Date(maxDate);
    thirtyDaysAgo.setDate(maxDate.getDate() - 30);
    return date >= thirtyDaysAgo && date <= maxDate;
  };

  // Determine the best interval based on date range and timeframe
  const determineInterval = (startDate: Date, endDate: Date, timeframe: string): 
    { interval: 'minute' | 'hourly' | 'daily', precision: 'minute' | 'hourly' | 'daily' } => {
    
    // Check if we're looking at today's data for 1D chart
    if (timeframe === '1D' && isToday(endDate)) {
      return { interval: 'minute', precision: 'minute' };
    }
    
    const startWithinRange = isWithinHourlyDataRange(startDate);
    const endWithinRange = isWithinHourlyDataRange(endDate);
    
    // If any part of the range is outside 30 days, use daily
    if (!startWithinRange || !endWithinRange) {
      return { interval: 'daily', precision: 'daily' };
    }
    
    // Within 30 days - use hourly (not minute for historical)
    switch (timeframe) {
      case '1D':
        return { interval: 'hourly', precision: 'hourly' }; // Historical 1D uses hourly
      case '5D':
        return { interval: 'hourly', precision: 'hourly' };
      case '1M':
        return { interval: 'hourly', precision: 'hourly' };
      case '3M':
        return { interval: 'daily', precision: 'daily' };
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

    const { interval, precision } = determineInterval(startDate, endDate, timeframe);

    return {
      start: formatToUKDate(startDate),
      end: formatToUKDate(endDate),
      interval,
      precision,
      targetPoints: timeConfig.targetPoints
    };
  };

  // Process API data with improved density
  const processApiData = (apiData: any[], targetPoints: number): ChartDataPoint[] => {
    if (!apiData || apiData.length === 0) return [];

    let processedData: ChartDataPoint[] = [];
    
    // Calculate sampling interval
    const sampleInterval = Math.max(1, Math.floor(apiData.length / targetPoints));
    
    // Sample data at calculated intervals
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
    
    // Ensure we don't exceed target points
    if (processedData.length > targetPoints) {
      processedData = processedData.slice(0, targetPoints);
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
          const transformedData = processApiData(historicalData, targetPoints);
          
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
        
        // Don't use mock data - show clear error message
        let errorMessage = '';
        if (apiError.message?.includes('max one month history')) {
          errorMessage = 'Data range exceeds API limits. Try a more recent date range.';
          // Try again with daily data
          try {
            const historicalData = await getHistoricalRates(
              selectedPair,
              start,
              end,
              'daily'
            );
            if (historicalData && historicalData.length > 0) {
              const transformedData = processApiData(historicalData, targetPoints);
              setChartData(transformedData);
              setIsRealData(true);
              setDataPrecision('daily');
              setError('Using daily precision for this date range');
              return;
            }
          } catch (retryError) {
            console.error('Retry with daily data failed:', retryError);
          }
        } else if (apiError.message?.includes('403')) {
          errorMessage = 'Unable to access historical data. Please check your API permissions.';
        } else if (apiError.message?.includes('404')) {
          errorMessage = 'No data available for this date range.';
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

  // Fetch specific rate for date/time with hybrid approach
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
      
      // Determine which interval to use based on date
      let interval: 'minute' | 'hourly' | 'daily';
      let precisionNote: string;
      
      if (isToday(date)) {
        interval = 'minute';
        precisionNote = 'minute precision';
      } else if (isWithinHourlyDataRange(date)) {
        interval = 'hourly';
        precisionNote = 'hourly precision (exact time not available for historical dates)';
      } else {
        interval = 'daily';
        precisionNote = 'daily precision only for this date';
      }
      
      try {
        const historicalData = await getHistoricalRates(
          selectedPair,
          validatedDate,
          validatedDate,
          interval
        );
        
        if (historicalData && historicalData.length > 0) {
          let rate: number;
          
          if (interval === 'minute') {
            // For minute data (today only), find closest time match
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
            
            rate = closestRate.close || closestRate.open;
            console.log(`Found real rate (minute precision): ${rate} for ${validatedDate} ${time}`);
            setError(null);
            setDataPrecision('minute');
          } else if (interval === 'hourly') {
            // For hourly data, find the hour that contains the requested time
            const targetHour = hours;
            const hourlyPoint = historicalData.find(point => {
              const pointDate = new Date(point.date);
              return pointDate.getHours() === targetHour;
            }) || historicalData[0];
            
            rate = hourlyPoint.close || hourlyPoint.open;
            console.log(`Found real rate (hourly precision): ${rate} for ${validatedDate} hour ${hours}:00`);
            setError(`Note: ${precisionNote}`);
            setDataPrecision('hourly');
          } else {
            // For daily data, use the day's close price
            rate = historicalData[0].close || historicalData[0].open;
            console.log(`Found real rate (daily precision): ${rate} for ${validatedDate}`);
            setError(`Note: ${precisionNote}`);
            setDataPrecision('daily');
          }
          
          await fetchHistoricalData(dateTime);
          
          return rate;
        } else {
          throw new Error('No data returned from API');
        }
      } catch (apiError: any) {
        console.error('API error fetching specific rate:', apiError);
        setError('Unable to fetch historical rate for this date/time');
        setChartData([]);
        return null;
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