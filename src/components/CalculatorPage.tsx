import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calculator, TrendingUp, DollarSign, History } from 'lucide-react';

// Import our custom hooks and constants
import { useFXCalculator } from '../hooks/useFXCalculator';
import { useLiveRates } from '../hooks/useLiveRates';
import { FX_PAIRS, DEFAULT_PAIR } from '../constants/fxPairs';
import { Navbar } from './ui/Navbar';
import { HistoricalRateModal } from './ui/HistoricalRateModal';
import { signOut, getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { saveCalculation } from '../lib/calculations';

// Helper function to get user profile
const getUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('user_profiles')
    .select('company_id')
    .eq('id', userId)
    .single();
  return data;
};

export default function CalculatorPage() {
  const [selectedPair, setSelectedPair] = useState(DEFAULT_PAIR);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate();
  
  // Use our custom hooks for clean separation of concerns
  const calculator = useFXCalculator();
  // Don't auto-update Your Rate - let users type freely
  const liveRates = useLiveRates(selectedPair);

  // Check authentication on component mount
  useEffect(() => {
    checkAuth();
    
    // Set up auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login');
      }
    });

    // Cleanup listener on unmount
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    const { user, error } = await getCurrentUser();
    
    if (error || !user) {
      // Not authenticated, redirect to login
      navigate('/login');
    } else {
      // User is authenticated
      setCurrentUser(user);
      setIsLoading(false);
    }
  };

  const handleCalculate = async () => {
    try {
      const results = calculator.calculateSavings();
      console.log('Calculation results:', results);
      
      // Get user profile for company_id
      const profile = await getUserProfile(currentUser.id);
      
      // Calculate values for activity log
      const yourRateWithPips = parseFloat(calculator.yourRate) + (calculator.selectedPips / 10000);
      const competitorRateFloat = parseFloat(calculator.competitorRate);
      const pipsDifference = Math.round((yourRateWithPips - competitorRateFloat) * 10000);
      const savingsPerTrade = parseFloat(results.savingsPerTrade.replace(/[^0-9.-]/g, ''));
      
      // Save calculation to database
      const calculationData = {
        currencyPair: selectedPair,
        yourRate: parseFloat(calculator.yourRate),
        competitorRate: competitorRateFloat,
        clientName: calculator.competitorName,
        tradeAmount: parseFloat(calculator.tradeAmount),
        tradesPerYear: parseInt(calculator.tradesPerYear),
        selectedPips: [calculator.selectedPips],
        results: results,
        timestamp: new Date().toISOString()
      };
      
      const { success, error } = await saveCalculation(calculationData);
      
      if (success) {
        console.log('Calculation saved successfully');
        
        // Log to activity_logs table
        const { error: logError } = await supabase
          .from('activity_logs')
          .insert({
            user_id: currentUser.id,
            company_id: profile?.company_id,
            action_type: 'calculation',
            calculation_data: {
              currency_pair: selectedPair,
              your_rate: parseFloat(calculator.yourRate),
              competitor_rate: competitorRateFloat,
              amount: parseFloat(calculator.tradeAmount),
              trades_per_year: parseInt(calculator.tradesPerYear),
              margin: calculator.selectedPips
            },
            client_name: calculator.competitorName,
            currency_pair: selectedPair,
            your_rate: yourRateWithPips,
            competitor_rate: competitorRateFloat,
            amount: parseFloat(calculator.tradeAmount),
            pips_difference: pipsDifference,
            savings_amount: savingsPerTrade
          });

        if (logError) {
          console.error('Failed to log activity:', logError);
        }
      } else {
        console.error('Failed to save calculation:', error);
      }
    } catch (error) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert('An error occurred during calculation');
      }
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      console.error('Error signing out:', error);
      alert('Error signing out. Please try again.');
    } else {
      navigate('/login');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCalculate();
    }
  };

  const handleHistoricalRateSelect = (price: number) => {
    calculator.setYourRate(price.toFixed(4));
  };

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#10051A' }}>
        <div className="text-purple-300">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#10051A' }}>
      {/* Navigation */}
      <Navbar 
        isSignedIn={true}
        onSignIn={() => {}}
        onSignOut={handleSignOut}
      />

      <div className="p-4 pt-32 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl" style={{ color: '#C7B3FF' }}>
            <CardHeader className="text-center pb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-8 w-8 text-purple-400" />
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                  Spread Checker
                </CardTitle>
              </div>
              <CardDescription className="text-purple-200/80">
                Calculate competitive advantages and client savings in real-time
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* FX Pair Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-purple-200">
                  Currency Pair
                </Label>
                <Select value={selectedPair} onValueChange={setSelectedPair}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-purple-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    {FX_PAIRS.map((pair) => (
                      <SelectItem key={pair.value} value={pair.value} className="text-purple-100">
                        {pair.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live Rate Display */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className={`h-5 w-5 ${liveRates.isFlashing ? 'text-green-400' : 'text-purple-400'}`} />
                  <Label className="text-sm font-medium text-purple-200">
                    Live Market Rate: {liveRates.getCurrentPair()?.label}
                  </Label>
                </div>
                <div className={`text-2xl font-bold transition-colors duration-300 ${
                  liveRates.isFlashing ? 'text-green-400' : 'text-purple-300'
                }`}>
                  {liveRates.formattedRate}
                </div>
              </div>

              {/* Your Rate Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="your-rate" className="text-sm font-medium text-purple-200">
                    Your Rate {calculator.selectedPips > 0 && `(+${calculator.selectedPips} pips)`}
                  </Label>
                  <Button
                    onClick={() => setIsHistoricalModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="border-white/20 text-purple-200 hover:bg-white/10 text-xs"
                  >
                    <History className="h-3 w-3 mr-1" />
                    Historical Rate
                  </Button>
                </div>
                <Input
                  id="your-rate"
                  type="text"
                  value={calculator.selectedPips > 0 && calculator.yourRate ? 
                    (parseFloat(calculator.yourRate) + (calculator.selectedPips / 10000)).toFixed(4) : 
                    calculator.yourRate
                  }
                  onChange={(e) => calculator.setYourRate(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-white/10 border-white/20 text-purple-100 placeholder:text-purple-300/60"
                  placeholder="Enter your rate"
                />
              </div>

              {/* Competitor Rate Input */}
              <div className="space-y-2">
                <Label htmlFor="competitor-rate" className="text-sm font-medium text-purple-200">
                  Competitor Rate
                </Label>
                <Input
                  id="competitor-rate"
                  type="text"
                  value={calculator.competitorRate}
                  onChange={(e) => calculator.setCompetitorRate(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-white/10 border-white/20 text-purple-100 placeholder:text-purple-300/60"
                  placeholder="Enter competitor rate"
                />
              </div>

              {/* Client Name Input */}
              <div className="space-y-2">
                <Label htmlFor="competitor-name" className="text-sm font-medium text-purple-200">
                  Client Name
                </Label>
                <Input
                  id="competitor-name"
                  type="text"
                  value={calculator.competitorName}
                  onChange={(e) => calculator.setCompetitorName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-white/10 border-white/20 text-purple-100 placeholder:text-purple-300/60"
                  placeholder="Enter competitor name"
                />
              </div>

              {/* Comparison Date Display */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-purple-200">
                  Comparison Date
                </Label>
                <div className="bg-white/5 border-white/20 text-purple-100 p-3 rounded-lg">
                  {calculator.comparisonDate}
                </div>
              </div>

              {/* Trade Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="trade-amount" className="text-sm font-medium text-purple-200">
                  Amount to Buy
                </Label>
                <Input
                  id="trade-amount"
                  type="text"
                  value={calculator.tradeAmount}
                  onChange={(e) => calculator.setTradeAmount(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-white/10 border-white/20 text-purple-100 placeholder:text-purple-300/60"
                  placeholder="Enter amount to buy"
                />
              </div>

              {/* Trades Per Year Input */}
              <div className="space-y-2">
                <Label htmlFor="trades-per-year" className="text-sm font-medium text-purple-200">
                  Trades Per Year
                </Label>
                <Input
                  id="trades-per-year"
                  type="text"
                  value={calculator.tradesPerYear}
                  onChange={(e) => calculator.setTradesPerYear(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-white/10 border-white/20 text-purple-100 placeholder:text-purple-300/60"
                  placeholder="Enter number of trades per year"
                />
              </div>

              {/* Pip Selection */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/20">
                <Label className="text-sm font-medium text-purple-200 mb-3 block">
                  Inflate Your Margin (Pips)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {[0, 10, 20, 30, 40, 50].map((pips) => (
                    <label key={pips} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="pips"
                        value={pips}
                        checked={calculator.selectedPips === pips}
                        onChange={() => calculator.setSelectedPips(pips)}
                        className="sr-only"
                      />
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        calculator.selectedPips === pips
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/10 text-purple-200 hover:bg-white/20'
                      }`}>
                        {pips === 0 ? 'None' : `${pips} pips`}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Calculate Button */}
              <Button 
                onClick={handleCalculate}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200"
              >
                <Calculator className="mr-2 h-5 w-5" />
                Calculate Savings
              </Button>

              {/* Results Display */}
              {calculator.results && (
                <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg border border-purple-400/30">
                  <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Calculation Results
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Price Difference</p>
                      <p className="text-xl font-bold text-purple-100">
                        {calculator.results.isAdvantage ? '+' : '-'}{calculator.results.priceDifference}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Pips</p>
                      <p className="text-xl font-bold text-purple-100">
                        {calculator.results.pipsAdvantage} pips
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Cost With Competitor</p>
                      <p className={`text-xl font-bold ${calculator.results.isAdvantage ? 'text-red-400' : 'text-green-400'}`}>
                        {(parseFloat(calculator.tradeAmount) / parseFloat(calculator.competitorRate)).toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Cost With Us</p>
                      <p className={`text-xl font-bold ${calculator.results.isAdvantage ? 'text-green-400' : 'text-red-400'}`}>
                        {(parseFloat(calculator.tradeAmount) / (parseFloat(calculator.yourRate) + (calculator.selectedPips / 10000))).toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Savings Per Trade</p>
                      <p className={`text-xl font-bold ${calculator.results.isAdvantage ? 'text-green-400' : 'text-red-400'}`}>
                        {calculator.results.savingsPerTrade}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Annual Savings</p>
                      <p className={`text-2xl font-bold ${calculator.results.isAdvantage ? 'text-green-400' : 'text-red-400'}`}>
                        {calculator.results.annualSavings}
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-purple-300">Percentage Savings</p>
                      <p className={`text-xl font-bold ${calculator.results.isAdvantage ? 'text-green-400' : 'text-red-400'}`}>
                        {calculator.results.percentageSavings}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Button */}
              <Button 
                onClick={calculator.resetCalculator}
                variant="outline"
                className="w-full border-white/20 text-purple-200 hover:bg-white/10"
              >
                Reset Calculator
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Historical Rate Modal */}
      <HistoricalRateModal
        isOpen={isHistoricalModalOpen}
        onClose={() => setIsHistoricalModalOpen(false)}
        onPriceSelect={handleHistoricalRateSelect}
        selectedPair={selectedPair}
      />
    </div>
  );
}