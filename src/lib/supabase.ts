import { createClient } from '@supabase/supabase-js'

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check that environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.')
}

// Create and export the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Optional: Export types for TypeScript support
export type { User, Session } from '@supabase/supabase-js'

// TypeScript interface for forex price data
// @ts-ignore
interface ForexPriceData {
  id: number;
  pair: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  created_at?: string;
}

/**
 * Get historical forex rate for a specific date and time
 * Following KISS principle - simple, direct query
 * @param pair - Currency pair (e.g., 'GBPUSD')
 * @param date - Date in YYYY-MM-DD format
 * @param time - Time in HH:MM format
 * @returns The closing price for that minute or null if not found
 */
export async function getHistoricalForexRate(
  pair: string, 
  date: string, 
  time: string
): Promise<number | null> {
  try {
    // Construct the start and end of the minute
    const minuteStart = `${date} ${time}:00`;
    const minuteEnd = `${date} ${time}:59`;
    
    console.log(`Querying Supabase for ${pair} between ${minuteStart} and ${minuteEnd}`);
    
    const { data, error } = await supabase
      .from('forex_prices')
      .select('close')
      .eq('pair', pair.toUpperCase())
      .gte('timestamp', minuteStart)
      .lte('timestamp', minuteEnd)
      .order('timestamp', { ascending: true })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Supabase query error:', error);
      return null;
    }
    
    if (data) {
      console.log(`Found rate: ${data.close} for ${pair} at ${minuteStart}`);
    } else {
      console.log(`No data found for ${pair} at ${minuteStart}`);
    }
    
    return data?.close || null;
  } catch (err) {
    console.error('Error fetching historical rate:', err);
    return null;
  }
}

/**
 * Get historical forex rates for a date range
 * Used for charting historical data
 * @param pair - Currency pair (e.g., 'GBPUSD')
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @param interval - Data interval: 'minute', '15min', '30min', 'hourly', or 'daily'
 * @returns Array of price data points
 */
export async function getHistoricalForexRange(
  pair: string,
  startDate: string,
  endDate: string,
  interval: 'minute' | '15min' | '30min' | 'hourly' | 'daily' = 'hourly'
): Promise<ForexPriceData[]> {
  try {
    console.log(`Fetching ${interval} data for ${pair} from ${startDate} to ${endDate}`);
    
    let allData: ForexPriceData[] = [];
    
    // For minute data (1D chart), fetch day by day to avoid limits
    if (interval === 'minute') {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Iterate through each day
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayStr = formatToSQLDate(d);
        const dayStart = `${dayStr} 00:00:00`;
        const dayEnd = `${dayStr} 23:59:59`;
        
        const { data, error } = await supabase
          .from('forex_prices')
          .select('*')
          .eq('pair', pair.toUpperCase())
          .gte('timestamp', dayStart)
          .lte('timestamp', dayEnd)
          .order('timestamp', { ascending: true });
        
        if (!error && data) {
          allData = allData.concat(data);
        }
      }
      
      console.log(`Returning ${allData.length} minute data points`);
      return allData;
    }
    
    // For other intervals, fetch data more intelligently
    const start = new Date(startDate + ' 00:00:00');
    const end = new Date(endDate + ' 23:59:59');
    
    // Build timestamps for the specific minutes we want
    const timestamps: string[] = [];
    
    for (let current = new Date(start); current <= end; current.setMinutes(current.getMinutes() + 1)) {
      const minutes = current.getMinutes();
      const hours = current.getHours();
      
      let shouldInclude = false;
      
      switch (interval) {
        case '15min':
          shouldInclude = minutes % 15 === 0;
          break;
        case '30min':
          shouldInclude = minutes % 30 === 0;
          break;
        case 'hourly':
          shouldInclude = minutes === 0;
          break;
        case 'daily':
          shouldInclude = hours === 0 && minutes === 0;
          break;
      }
      
      if (shouldInclude) {
        timestamps.push(formatTimestamp(current));
      }
    }
    
    console.log(`Fetching ${timestamps.length} specific timestamps for ${interval} interval`);
    
    // Fetch data in chunks to avoid query size limits
    const chunkSize = 500;
    
    for (let i = 0; i < timestamps.length; i += chunkSize) {
      const chunk = timestamps.slice(i, i + chunkSize);
      
      const { data, error } = await supabase
        .from('forex_prices')
        .select('*')
        .eq('pair', pair.toUpperCase())
        .in('timestamp', chunk)
        .order('timestamp', { ascending: true });
      
      if (!error && data) {
        allData = allData.concat(data);
      }
    }
    
    console.log(`Returning ${allData.length} sampled data points for ${interval} interval`);
    return allData;
    
  } catch (err) {
    console.error('Error fetching historical range:', err);
    return [];
  }
}

/**
 * Helper function to format Date to SQL timestamp string
 */
function formatToSQLDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to format Date to full SQL timestamp
 */
function formatTimestamp(date: Date): string {
  const dateStr = formatToSQLDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

/**
 * Check if historical data exists for a given pair and date
 * Useful for validation before attempting to fetch
 * @param pair - Currency pair
 * @param date - Date to check in YYYY-MM-DD format
 * @returns Boolean indicating if data exists
 */
export async function hasHistoricalData(
  pair: string,
  date: string
): Promise<boolean> {
  try {
    const startTimestamp = `${date} 00:00:00`;
    const endTimestamp = `${date} 23:59:59`;
    
    const { count, error } = await supabase
      .from('forex_prices')
      .select('*', { count: 'exact', head: true })
      .eq('pair', pair.toUpperCase())
      .gte('timestamp', startTimestamp)
      .lte('timestamp', endTimestamp);
    
    if (error) {
      console.error('Supabase count error:', error);
      return false;
    }
    
    return (count || 0) > 0;
  } catch (err) {
    console.error('Error checking data availability:', err);
    return false;
  }
}