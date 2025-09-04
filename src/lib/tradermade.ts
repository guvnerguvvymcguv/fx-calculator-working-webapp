// TraderMade API Service
const API_KEY = import.meta.env.VITE_TRADERMADE_API_KEY;
const BASE_URL = 'https://marketdata.tradermade.com/api/v1';

// Currency pairs mapping (TraderMade format)
export const TRADERMADE_PAIRS = {
  'GBPEUR': 'GBPEUR',
  'GBPUSD': 'GBPUSD', 
  'EURUSD': 'EURUSD',
  'GBPNOK': 'GBPNOK',
  'GBPSEK': 'GBPSEK',
  'GBPAUD': 'GBPAUD'
};

interface LiveRate {
  currency: string;
  bid: number;
  ask: number;
  mid: number;
  timestamp: number;
}

interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Get live rates for multiple pairs
export async function getLiveRates(pairs: string[]): Promise<LiveRate[]> {
  try {
    const pairsString = pairs.join(',');
    const response = await fetch(
      `${BASE_URL}/live?currency=${pairsString}&api_key=${API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.quotes.map((quote: any) => ({
      currency: quote.instrument,
      bid: quote.bid,
      ask: quote.ask,
      mid: quote.mid,
      timestamp: quote.timestamp
    }));
  } catch (error) {
    console.error('Error fetching live rates:', error);
    throw error;
  }
}

// Get live rate for a single pair
export async function getLiveRate(pair: string): Promise<LiveRate | null> {
  try {
    const rates = await getLiveRates([pair]);
    return rates[0] || null;
  } catch (error) {
    console.error(`Error fetching rate for ${pair}:`, error);
    return null;
  }
}

// Get historical data for a pair
export async function getHistoricalRates(
  pair: string,
  startDate: string,
  endDate: string,
  interval: 'daily' | 'hourly' | 'minute' = 'daily'
): Promise<HistoricalData[]> {
  try {
    const response = await fetch(
      `${BASE_URL}/timeseries?currency=${pair}&api_key=${API_KEY}&start_date=${startDate}&end_date=${endDate}&format=records&interval=${interval}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.quotes.map((quote: any) => ({
      date: quote.date,
      open: quote.open,
      high: quote.high,
      low: quote.low,
      close: quote.close
    }));
  } catch (error) {
    console.error('Error fetching historical rates:', error);
    throw error;
  }
}

// Format pair for display (e.g., GBPUSD -> GBP/USD)
export function formatPairDisplay(pair: string): string {
  if (pair.length === 6) {
    return `${pair.slice(0, 3)}/${pair.slice(3)}`;
  }
  return pair;
}

// Convert display format to API format (e.g., GBP/USD -> GBPUSD)
export function formatPairForAPI(displayPair: string): string {
  return displayPair.replace('/', '');
}