import { useState, useMemo } from 'react';
import { 
  type ChartDataPoint, 
  MOCK_CHART_DATA, 
  TIMEFRAMES, 
  filterDataByTimeframe 
} from '../constants/mockChartData';

interface UseHistoricalRatesReturn {
  selectedPair: string;
  selectedTimeframe: string;
  chartData: ChartDataPoint[];
  availablePairs: string[];
  isLoading: boolean;
  setSelectedPair: (pair: string) => void;
  setSelectedTimeframe: (timeframe: string) => void;
}

/**
 * Custom hook for managing historical FX rates
 * Handles pair selection, timeframe filtering, and data retrieval
 */
export const useHistoricalRates = (initialPair: string = 'GBPUSD'): UseHistoricalRatesReturn => {
  const [selectedPair, setSelectedPair] = useState<string>(initialPair);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1M');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Get available pairs from mock data
  const availablePairs = Object.keys(MOCK_CHART_DATA);

  // Get filtered chart data based on selected pair and timeframe
  const chartData = useMemo(() => {
    const rawData = MOCK_CHART_DATA[selectedPair] || [];
    
    // Find timeframe configuration
    const timeframe = TIMEFRAMES.find(tf => tf.label === selectedTimeframe);
    if (!timeframe) return rawData;

    // Filter data by selected timeframe
    return filterDataByTimeframe(rawData, timeframe.days);
  }, [selectedPair, selectedTimeframe]);

  // Handle pair change with loading state
  const handlePairChange = (pair: string): void => {
    if (availablePairs.includes(pair)) {
      setIsLoading(true);
      setSelectedPair(pair);
      
      // Simulate loading delay (for future API integration)
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  };

  // Handle timeframe change with loading state
  const handleTimeframeChange = (timeframe: string): void => {
    const validTimeframe = TIMEFRAMES.find(tf => tf.label === timeframe);
    if (validTimeframe) {
      setIsLoading(true);
      setSelectedTimeframe(timeframe);
      
      // Simulate loading delay (for future API integration)
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
    }
  };

  return {
    selectedPair,
    selectedTimeframe,
    chartData,
    availablePairs,
    isLoading,
    setSelectedPair: handlePairChange,
    setSelectedTimeframe: handleTimeframeChange
  };
};