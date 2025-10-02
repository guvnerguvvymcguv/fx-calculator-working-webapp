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
    const startTimestamp = `${startDate} 00:00:00`;
    const endTimestamp = `${endDate} 23:59:59`;
    
    console.log(`Querying Supabase for ${pair} from ${startTimestamp} to ${endTimestamp}`);
    
    // Build the base query without limit for proper sampling
    let query = supabase
      .from('forex_prices')
      .select('*')
      .eq('pair', pair.toUpperCase())
      .gte('timestamp', startTimestamp)
      .lte('timestamp', endTimestamp)
      .order('timestamp', { ascending: true });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase query error:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Apply timestamp-based sampling
    let sampledData: ForexPriceData[] = [];
    
    switch (interval) {
      case 'minute':
        // Return all minute data (no sampling needed)
        sampledData = data;
        break;
        
      case '15min':
        // Sample every 15 minutes based on timestamp
        sampledData = data.filter((item) => {
          const date = new Date(item.timestamp);
          const minutes = date.getMinutes();
          // Keep data points at 00, 15, 30, 45 minutes
          return minutes % 15 === 0;
        });
        break;
        
      case '30min':
        // Sample every 30 minutes based on timestamp
        sampledData = data.filter((item) => {
          const date = new Date(item.timestamp);
          const minutes = date.getMinutes();
          // Keep data points at 00, 30 minutes
          return minutes % 30 === 0;
        });
        break;
        
      case 'hourly':
        // Sample every hour based on timestamp
        sampledData = data.filter((item) => {
          const date = new Date(item.timestamp);
          const minutes = date.getMinutes();
          // Keep data points at 00 minutes (start of each hour)
          return minutes === 0;
        });
        break;
        
      case 'daily':
        // Sample once per day at midnight
        sampledData = data.filter((item) => {
          const date = new Date(item.timestamp);
          const hours = date.getHours();
          const minutes = date.getMinutes();
          // Keep data points at midnight (00:00)
          return hours === 0 && minutes === 0;
        });
        break;
        
      default:
        sampledData = data;
        break;
    }
    
    console.log(`Returning ${sampledData.length} sampled data points for ${interval} interval from ${data.length} total points`);
    return sampledData;
    
  } catch (err) {
    console.error('Error fetching historical range:', err);
    return [];
  }
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