import { useState, useEffect } from 'react';
import { getLiveRate, formatPairDisplay } from '../lib/tradermade';

interface UseLiveRatesReturn {
  currentRate: string;
  formattedRate: string;
  isLoading: boolean;
  isFlashing: boolean;
  lastUpdate: string | null;
  error: string | null;
  getCurrentPair: () => { value: string; label: string } | undefined;
}

// Map your FX pairs to TraderMade format
const FX_PAIRS_MAPPING: Record<string, string> = {
  'GBPEUR': 'GBPEUR',
  'GBPUSD': 'GBPUSD',
  'EURUSD': 'EURUSD',
  'GBPNOK': 'GBPNOK',
  'GBPSEK': 'GBPSEK',
  'GBPAUD': 'GBPAUD'
};

export const useLiveRates = (selectedPair: string): UseLiveRatesReturn => {
  const [currentRate, setCurrentRate] = useState<string>('Loading...');
  const [formattedRate, setFormattedRate] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch live rate from TraderMade
  const fetchLiveRate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const apiPair = FX_PAIRS_MAPPING[selectedPair];
      if (!apiPair) {
        throw new Error(`Unsupported currency pair: ${selectedPair}`);
      }

      const rate = await getLiveRate(apiPair);
      
      if (rate) {
        const midRate = rate.mid.toFixed(4);
        
        // Check if rate changed to trigger flash
        if (currentRate !== 'Loading...' && currentRate !== midRate) {
          setIsFlashing(true);
          setTimeout(() => setIsFlashing(false), 500);
        }
        
        setCurrentRate(midRate);
        setFormattedRate(midRate);
        setLastUpdate(new Date().toLocaleTimeString());
      } else {
        throw new Error('No rate data received');
      }
    } catch (err) {
      console.error('Error fetching live rate:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch rate');
      
      // Fallback to mock data for development
      const mockRate = getMockRate(selectedPair);
      setCurrentRate(mockRate);
      setFormattedRate(mockRate);
    } finally {
      setIsLoading(false);
    }
  };

  // Get mock rate as fallback
  const getMockRate = (pair: string): string => {
    const mockRates: Record<string, string> = {
      'GBPEUR': '1.1854',
      'GBPUSD': '1.2735',
      'EURUSD': '1.0742',
      'GBPNOK': '13.5621',
      'GBPSEK': '13.8945',
      'GBPAUD': '1.9234'
    };
    return mockRates[pair] || '1.0000';
  };

  // Fetch rate on mount and when pair changes
  useEffect(() => {
    fetchLiveRate();
    
    // Refresh every 30 seconds (adjust based on your needs)
    const interval = setInterval(fetchLiveRate, 30000);
    
    return () => clearInterval(interval);
  }, [selectedPair]);

  const getCurrentPair = () => {
    const displayFormat = formatPairDisplay(FX_PAIRS_MAPPING[selectedPair] || selectedPair);
    return {
      value: selectedPair,
      label: displayFormat
    };
  };

  return {
    currentRate,
    formattedRate,
    isLoading,
    isFlashing,
    lastUpdate,
    error,
    getCurrentPair
  };
};