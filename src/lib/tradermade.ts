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

// Get the maximum available date for historical data (current real-world date)
export function getMaxHistoricalDate(): Date {
  // TraderMade's historical data is available up to the current real-world date
  // Since we're in late 2024 in real time, cap at current real date
  const realWorldToday = new Date();
  realWorldToday.setDate(realWorldToday.getDate() - 3); // 3-day buffer
  return realWorldToday;
}

// Validate and adjust date to be within available range
export function validateHistoricalDate(dateStr: string): string {
  const requestedDate = new Date(dateStr);
  const maxDate = getMaxHistoricalDate();
  const minDate = new Date('2018-01-01'); // Reliable minute data start
  
  // If date is in the future (beyond real-world time), cap it
  if (requestedDate > maxDate) {
    console.warn(`Date ${dateStr} is beyond available data. Using ${maxDate.toISOString().split('T')[0]} instead.`);
    return maxDate.toISOString().split('T')[0];
  }
  
  // If date is too far in the past
  if (requestedDate < minDate) {
    console.warn(`Date ${dateStr} is before available data. Using ${minDate.toISOString().split('T')[0]} instead.`);
    return minDate.toISOString().split('T')[0];
  }
  
  return dateStr;
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

// Get historical data for a pair with date validation
export async function getHistoricalRates(
  pair: string,
  startDate: string,
  endDate: string,
  interval: 'daily' | 'hourly' | 'minute' = 'daily'
): Promise<HistoricalData[]> {
  try {
    // Validate and adjust dates to be within available range
    const validatedStartDate = validateHistoricalDate(startDate);
    const validatedEndDate = validateHistoricalDate(endDate);
    
    // Ensure start date is before end date
    let finalStartDate = validatedStartDate;
    let finalEndDate = validatedEndDate;
    if (new Date(finalStartDate) > new Date(finalEndDate)) {
      console.error('Start date is after end date, swapping them');
      const temp = finalStartDate;
      finalStartDate = finalEndDate;
      finalEndDate = temp;
    }
    
    // Log if dates were adjusted
    if (finalStartDate !== startDate || finalEndDate !== endDate) {
      console.info(`Date range adjusted from ${startDate} - ${endDate} to ${finalStartDate} - ${finalEndDate}`);
    }
    
    const response = await fetch(
      `${BASE_URL}/timeseries?currency=${pair}&api_key=${API_KEY}&start_date=${finalStartDate}&end_date=${finalEndDate}&format=records&interval=${interval}`
    );
    
    if (!response.ok) {
      // Provide more detailed error information
      const errorText = await response.text().catch(() => '');
      console.error(`TraderMade API Error ${response.status}:`, errorText);
      
      if (response.status === 403) {
        throw new Error(`Access denied. Please check your API key permissions.`);
      } else if (response.status === 404) {
        throw new Error(`No data available for ${pair} between ${finalStartDate} and ${finalEndDate}`);
      } else if (response.status === 429) {
        throw new Error(`Rate limit exceeded. Please try again later.`);
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }
    
    const data = await response.json();
    
    // Check if we got valid data
    if (!data.quotes || data.quotes.length === 0) {
      console.warn(`No historical data returned for ${pair} between ${finalStartDate} and ${finalEndDate}`);
      return [];
    }
    
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

// Check if a date has available historical data
export function isDateAvailable(dateStr: string): boolean {
  const date = new Date(dateStr);
  const maxDate = getMaxHistoricalDate();
  const minDate = new Date('2020-01-01');
  
  return date >= minDate && date <= maxDate;
}

// Get the available date range for historical data
export function getAvailableDateRange(): { min: string, max: string } {
  const minDate = new Date('2020-01-01');
  const maxDate = getMaxHistoricalDate();
  
  return {
    min: minDate.toISOString().split('T')[0],
    max: maxDate.toISOString().split('T')[0]
  };
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