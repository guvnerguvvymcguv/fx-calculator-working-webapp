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
      .lte('timestamp', minuteEnd)  // Use lte with :59 seconds instead of lt with ISO string
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