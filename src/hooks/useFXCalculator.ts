import { useState } from 'react';

interface CalculationResults {
  priceDifference: string;
  pipsAdvantage: string;
  savingsPerTrade: string;
  annualSavings: string;
  clientSavingsPerTrade: string;
  clientAnnualSavings: string;
  percentageSavings: string;
  isAdvantage: boolean;
}

interface UseFXCalculatorReturn {
  yourRate: string;
  competitorRate: string;
  competitorName: string;
  comparisonDate: string;
  tradeAmount: string;
  tradesPerYear: string;
  selectedPips: number;
  results: CalculationResults | null;
  setYourRate: (rate: string) => void;
  setCompetitorRate: (rate: string) => void;
  setCompetitorName: (name: string) => void;
  setTradeAmount: (amount: string) => void;
  setTradesPerYear: (trades: string) => void;
  setSelectedPips: (pips: number) => void;
  calculateSavings: () => CalculationResults;
  resetCalculator: () => void;
}

/**
 * Custom hook for FX calculator business logic
 * Handles all calculation state and logic
 */
export const useFXCalculator = (): UseFXCalculatorReturn => {
  const [yourRate, setYourRate] = useState<string>('');
  const [competitorRate, setCompetitorRate] = useState<string>('');
  const [competitorName, setCompetitorName] = useState<string>('');
  const [tradeAmount, setTradeAmount] = useState<string>('');
  const [tradesPerYear, setTradesPerYear] = useState<string>('');
  const [selectedPips, setSelectedPips] = useState<number>(0);
  const [results, setResults] = useState<CalculationResults | null>(null);

  // Auto-populate today's date
  const comparisonDate = new Date().toLocaleDateString('en-US');

  const calculateSavings = (): CalculationResults => {
    let yourRateNum = parseFloat(yourRate);
    const competitorRateNum = parseFloat(competitorRate);
    const amount = parseFloat(tradeAmount);
    const trades = parseInt(tradesPerYear);

    if (!yourRateNum || !competitorRateNum || !amount || !trades) {
      throw new Error('Please fill in all fields');
    }

    // Apply pip inflation if selected (convert pips to rate adjustment)
    if (selectedPips > 0) {
      const pipAdjustment = selectedPips / 10000;
      yourRateNum = yourRateNum + pipAdjustment;
    }

    // Calculate rate difference (positive = you're better, negative = competitor is better)
    const rateDiff = competitorRateNum - yourRateNum;
    
    const pips = Math.abs(rateDiff * 10000);
    
    // Calculate cost in GBP to buy USD amount
    const costAtCompetitorRate = amount / competitorRateNum;
    const costAtYourRate = amount / yourRateNum;
    
    // Savings calculations
    const savingsPerTrade = costAtCompetitorRate - costAtYourRate;
    const annualSavings = savingsPerTrade * trades;
    const clientSavingsPerTrade = costAtCompetitorRate - costAtYourRate;
    const clientAnnualSavings = clientSavingsPerTrade * trades;

    // Calculate percentage savings
    const percentageSavings = (Math.abs(savingsPerTrade) / costAtCompetitorRate) * 100;

    const calculationResults: CalculationResults = {
      priceDifference: Math.abs(rateDiff).toFixed(4),
      pipsAdvantage: pips.toFixed(1),
      savingsPerTrade: Math.abs(savingsPerTrade).toFixed(2),
      annualSavings: Math.abs(annualSavings).toFixed(2),
      clientSavingsPerTrade: Math.abs(clientSavingsPerTrade).toFixed(2),
      clientAnnualSavings: Math.abs(clientAnnualSavings).toFixed(2),
      percentageSavings: percentageSavings.toFixed(2),
      isAdvantage: savingsPerTrade > 0
    };

    // TODO: Log all data for future Salesforce integration
    const comparisonData = {
      yourRate: yourRateNum.toFixed(4),
      competitorRate: competitorRate,
      competitorName: competitorName,
      tradeAmount: amount,
      tradesPerYear: trades,
      comparisonDate: comparisonDate,
      results: calculationResults
    };
    console.log('Comparison data logged:', comparisonData);

    setResults(calculationResults);
    return calculationResults;
  };

  const resetCalculator = (): void => {
    setYourRate('');
    setCompetitorRate('');
    setCompetitorName('');
    setTradeAmount('');
    setTradesPerYear('');
    setSelectedPips(0);
    setResults(null);
  };

  const updateYourRate = (rate: string): void => {
    setYourRate(rate);
    // Clear results when inputs change
    if (results) setResults(null);
  };

  return {
    // State
    yourRate,
    competitorRate,
    competitorName,
    comparisonDate,
    tradeAmount,
    tradesPerYear,
    selectedPips,
    results,
    
    // Actions
    setYourRate: updateYourRate,
    setCompetitorRate: (rate: string): void => {
      setCompetitorRate(rate);
      if (results) setResults(null);
    },
    setCompetitorName: (name: string): void => {
      setCompetitorName(name);
      if (results) setResults(null);
    },
    setTradeAmount: (amount: string): void => {
      setTradeAmount(amount);
      if (results) setResults(null);
    },
    setTradesPerYear: (trades: string): void => {
      setTradesPerYear(trades);
      if (results) setResults(null);
    },
    setSelectedPips: (pips: number): void => {
      setSelectedPips(pips);
      if (results) setResults(null);
    },
    calculateSavings,
    resetCalculator
  };
};