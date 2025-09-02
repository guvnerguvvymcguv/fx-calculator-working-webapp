export interface FXPair {
  value: string;
  label: string;
  baseRate: number;
}

/**
 * FX Pairs configuration data
 * Single source of truth for all currency pairs
 */
export const FX_PAIRS: FXPair[] = [
  { value: 'GBPUSD', label: 'GBP/USD', baseRate: 1.3550 },
  { value: 'GBPEUR', label: 'GBP/EUR', baseRate: 1.1685 },
  { value: 'EURUSD', label: 'EUR/USD', baseRate: 1.0825 },
];

/**
 * Default selected pair
 */
export const DEFAULT_PAIR: string = 'GBPUSD';

/**
 * Demo access code for login
 */
export const DEMO_ACCESS_CODE: string = '123456';