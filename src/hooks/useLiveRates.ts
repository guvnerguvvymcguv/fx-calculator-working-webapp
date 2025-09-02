import { useState, useEffect } from 'react';

// Define the FXPair interface locally to avoid import issues
interface FXPair {
  value: string;
  label: string;
  baseRate: number;
}

// Import the FX_PAIRS array
import { FX_PAIRS } from '../constants/fxPairs';

interface UseLiveRatesReturn {
  liveRate: number;
  isFlashing: boolean;
  getCurrentPair: () => FXPair | undefined;
  formattedRate: string;
}

/**
 * Custom hook for managing live FX rates
 * Handles rate updates, flashing animations, and pair changes
 */
export const useLiveRates = (
  selectedPair: string, 
  onRateUpdate?: (rate: string) => void
): UseLiveRatesReturn => {
  const [liveRate, setLiveRate] = useState<number>(1.3550);
  const [isFlashing, setIsFlashing] = useState<boolean>(false);

  // Update live rate every 5 seconds with slight random fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      const currentPair = FX_PAIRS.find(pair => pair.value === selectedPair);
      if (currentPair) {
        const baseRate = currentPair.baseRate;
        const fluctuation = (Math.random() - 0.5) * 0.0020; // ±0.1% fluctuation
        const newRate = baseRate + fluctuation;
        const formattedRate = Number(newRate.toFixed(4));
        
        setLiveRate(formattedRate);
        setIsFlashing(true);
        
        // Call callback if provided (to update your rate input)
        if (onRateUpdate) {
          onRateUpdate(formattedRate.toFixed(4));
        }
        
        // Stop flashing after animation
        setTimeout(() => setIsFlashing(false), 300);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedPair, onRateUpdate]);

  // Update rates when pair changes
  useEffect(() => {
    const currentPair = FX_PAIRS.find(pair => pair.value === selectedPair);
    if (currentPair) {
      setLiveRate(currentPair.baseRate);
      
      // Update your rate input when pair changes
      if (onRateUpdate) {
        onRateUpdate(currentPair.baseRate.toFixed(4));
      }
    }
  }, [selectedPair, onRateUpdate]);

  const getCurrentPair = (): FXPair | undefined => {
    return FX_PAIRS.find(pair => pair.value === selectedPair);
  };

  return {
    liveRate,
    isFlashing,
    getCurrentPair,
    formattedRate: liveRate.toFixed(4)
  };
};