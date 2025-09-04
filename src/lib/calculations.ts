/**
 * Pure calculation functions for FX operations
 * Following KISS principle - simple, testable math functions
 */

import { supabase } from './supabase';

interface ValidationInputs {
  yourRate: string;
  competitorRate: string;
  tradeAmount: string;
  tradesPerYear: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  values: {
    yourRate: number;
    competitorRate: number;
    tradeAmount: number;
    tradesPerYear: number;
  };
}

interface CalculationData {
  currencyPair: string;
  yourRate: number;
  competitorRate: number;
  clientName: string;
  tradeAmount: number;
  tradesPerYear: number;
  selectedPips?: number[];
  results: any;
  timestamp: string;
}

/**
 * Calculate PIPs difference between two rates
 */
export const calculatePips = (rate1: number, rate2: number): number => {
  return Math.abs((rate1 - rate2) * 10000);
};

/**
 * Calculate savings per trade
 */
export const calculateSavingsPerTrade = (rateDifference: number, tradeAmount: number): number => {
  return rateDifference * tradeAmount;
};

/**
 * Calculate annual savings
 */
export const calculateAnnualSavings = (savingsPerTrade: number, tradesPerYear: number): number => {
  return savingsPerTrade * tradesPerYear;
};

/**
 * Apply margin inflation to rate difference
 */
export const calculateMarginAdjustment = (baseRate: number, marginPercent: number = 0.005): number => {
  return baseRate * marginPercent;
};

/**
 * Validate calculation inputs
 */
export const validateCalculationInputs = ({ yourRate, competitorRate, tradeAmount, tradesPerYear }: ValidationInputs): ValidationResult => {
  const yourRateNum = parseFloat(yourRate);
  const competitorRateNum = parseFloat(competitorRate);
  const amount = parseFloat(tradeAmount);
  const trades = parseInt(tradesPerYear);

  const errors: string[] = [];

  if (!yourRateNum || yourRateNum <= 0) {
    errors.push('Your rate must be a positive number');
  }

  if (!competitorRateNum || competitorRateNum <= 0) {
    errors.push('Competitor rate must be a positive number');
  }

  if (!amount || amount <= 0) {
    errors.push('Trade amount must be a positive number');
  }

  if (!trades || trades <= 0) {
    errors.push('Trades per year must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors,
    values: {
      yourRate: yourRateNum,
      competitorRate: competitorRateNum,
      tradeAmount: amount,
      tradesPerYear: trades
    }
  };
};

/**
 * Format number for display
 */
export const formatNumber = (value: number, decimals: number = 2): string => {
  return Number(value).toFixed(decimals);
};

/**
 * Generate rate fluctuation for live updates
 */
export const generateRateFluctuation = (baseRate: number, maxFluctuation: number = 0.002): number => {
  const fluctuation = (Math.random() - 0.5) * maxFluctuation;
  return baseRate + (baseRate * fluctuation);
};

/**
 * Save calculation to database
 */
export async function saveCalculation(data: CalculationData) {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    // Get user's company_id from user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    // Prepare calculation data for database
    const calculationRecord = {
      user_id: user.id,
      company_id: profile?.company_id || null,
      calculation_data: data,
      client_name: data.clientName,
      trade_details: {
        currency_pair: data.currencyPair,
        your_rate: data.yourRate,
        competitor_rate: data.competitorRate,
        trade_amount: data.tradeAmount,
        trades_per_year: data.tradesPerYear
      },
      savings_amount: data.results?.totalSavings || 0
    };

    // Insert into calculations table
    const { data: savedCalc, error } = await supabase
      .from('calculations')
      .insert(calculationRecord)
      .select()
      .single();

    if (error) {
      console.error('Error saving calculation:', error);
      return { success: false, error: error.message };
    }

    console.log('Calculation saved successfully:', savedCalc);
    return { success: true, data: savedCalc };

  } catch (error) {
    console.error('Unexpected error saving calculation:', error);
    return { success: false, error: 'Failed to save calculation' };
  }
}