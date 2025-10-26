import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calculator, TrendingUp, History, Home, LayoutDashboard, Users, Globe } from 'lucide-react';

// Import our custom hooks and constants
import { useFXCalculator } from '../hooks/useFXCalculator';
import { useLiveRates } from '../hooks/useLiveRates';
import { FX_PAIRS, DEFAULT_PAIR } from '../constants/fxPairs';
import { HistoricalRateModal } from './ui/HistoricalRateModal';
import { signOut, getCurrentUser } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { saveCalculation } from '../lib/calculations';
import { addOrUpdateLead } from '../lib/userLeads';

// Helper function to get user profile
const getUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('user_profiles')
    .select('company_id, role_type')
    .eq('id', userId)
    .single();
  return data;
};

export default function CalculatorPage() {
  const [selectedPair, setSelectedPair] = useState(DEFAULT_PAIR);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'junior' | null>(null);
  const [findingCompanies, setFindingCompanies] = useState(false);
  const [similarCompanies, setSimilarCompanies] = useState<any[]>([]);
  const [addedCompanies, setAddedCompanies] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [totalMatches, setTotalMatches] = useState(0);
  const [companyFinderEnabled, setCompanyFinderEnabled] = useState<boolean>(false);
  const [shownCompanyNames, setShownCompanyNames] = useState<string[]>([]);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [noMoreCompanies, setNoMoreCompanies] = useState(false);
  const navigate = useNavigate();
  
  // Use our custom hooks for clean separation of concerns
  const calculator = useFXCalculator();
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

  // Load companies already in My Leads when component mounts
  useEffect(() => {
    if (currentUser) {
      loadExistingLeads();
    }
  }, [currentUser]);

  const loadExistingLeads = async () => {
    try {
      const { data: leads, error } = await supabase
        .from('user_leads')
        .select('custom_name')
        .eq('user_id', currentUser.id);

      if (error) throw error;

      if (leads && leads.length > 0) {
        const companyNames = new Set(leads.map(lead => lead.custom_name.toLowerCase()));
        setAddedCompanies(companyNames);
      }
    } catch (error) {
      console.error('Error loading existing leads:', error);
    }
  };

  const checkAuth = async () => {
    const { user, error } = await getCurrentUser();
    
    if (error || !user) {
      navigate('/login');
    } else {
      setCurrentUser(user);
      const profile = await getUserProfile(user.id);
      if (profile) {
        setUserRole(profile.role_type);
        
        const { data: company } = await supabase
          .from('companies')
          .select('company_finder_enabled')
          .eq('id', profile.company_id)
          .single();
        
        if (company) {
          setCompanyFinderEnabled(company.company_finder_enabled || false);
        }
      }
      setIsLoading(false);
    }
  };

  const handleCalculate = async () => {
    try {
      const results = calculator.calculateSavings();
      console.log('Calculation results:', results);
      
      const profile = await getUserProfile(currentUser.id);
      
      const yourRateWithPips = parseFloat(calculator.yourRate) + (calculator.selectedPips / 10000);
      const competitorRateFloat = parseFloat(calculator.competitorRate);
      const tradeAmountFloat = parseFloat(calculator.tradeAmount);
      const pipsDifference = Math.round((yourRateWithPips - competitorRateFloat) * 10000);
      const costWithCompetitor = tradeAmountFloat / competitorRateFloat;
      const costWithUs = tradeAmountFloat / yourRateWithPips;
      const savingsPerTrade = Math.abs(costWithUs - costWithCompetitor);
      const annualSavings = savingsPerTrade * parseInt(calculator.tradesPerYear);
      const percentageSavings = (savingsPerTrade / costWithCompetitor) * 100;
      
      const normalizedClientName = calculator.competitorName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const { error: calcError } = await supabase
        .from('calculations')
        .insert({
          user_id: currentUser.id,
          company_id: profile?.company_id,
          client_name: calculator.competitorName,
          normalized_client_name: normalizedClientName,
          calculation_data: {
            currency_pair: selectedPair,
            your_rate: parseFloat(calculator.yourRate),
            competitor_rate: competitorRateFloat,
            comparison_date: calculator.comparisonDate,
            trade_amount: tradeAmountFloat,
            trades_per_year: parseInt(calculator.tradesPerYear),
            pips_added: calculator.selectedPips,
            price_difference: results.priceDifference,
            difference_in_pips: pipsDifference,
            cost_with_competitor: costWithCompetitor,
            cost_with_us: costWithUs,
            savings_per_trade: savingsPerTrade,
            annual_savings: annualSavings,
            percentage_savings: percentageSavings,
            is_advantage: results.isAdvantage
          },
          trade_details: {
            your_rate: yourRateWithPips.toFixed(4),
            trade_amount: tradeAmountFloat,
            currency_pair: selectedPair,
            competitor_rate: competitorRateFloat.toFixed(4),
            trades_per_year: parseInt(calculator.tradesPerYear)
          },
          savings_amount: savingsPerTrade,
          created_at: new Date().toISOString()
        });

      if (calcError) {
        console.error('Failed to save calculation:', calcError);
      }
      
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
        
        const leadResult = await addOrUpdateLead({
          userId: currentUser.id,
          companyName: calculator.competitorName,
          source: 'calculator',
          contacted: true
        });
        
        if (leadResult.success) {
          console.log(leadResult.message);
          // Update addedCompanies set
          setAddedCompanies(prev => new Set(prev).add(calculator.competitorName.toLowerCase()));
        } else {
          console.error('Failed to save lead:', leadResult.message);
        }
        
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
            amount_to_buy: parseFloat(calculator.tradeAmount),
            trades_per_year: parseInt(calculator.tradesPerYear),
            payment_amount: calculator.selectedPips,
            pips_difference: pipsDifference,
            savings_amount: savingsPerTrade,
            cost_with_competitor: costWithCompetitor,
            cost_with_us: costWithUs,
            savings_per_trade: savingsPerTrade,
            annual_savings: annualSavings,
            percentage_savings: percentageSavings,
            comparison_date: calculator.comparisonDate,
            price_difference: parseFloat(results.priceDifference)
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

  const handleFindSimilarCompanies = async () => {
    if (!calculator.competitorName) {
      alert('Please enter a client name first');
      return;
    }

    setFindingCompanies(true);

    try {
      // Get companies already in My Leads
      const { data: myLeads } = await supabase
        .from('user_leads')
        .select('custom_name')
        .eq('user_id', currentUser.id);
      
      const companiesInMyLeads = myLeads?.map(lead => lead.custom_name) || [];
      
      // Build exclusion list: shown companies + companies in My Leads
      const excludeCompanies = [
        ...shownCompanyNames,
        ...companiesInMyLeads
      ];
      
      console.log('Calling google-competitor-search API with:', {
        companyName: calculator.competitorName,
        excludeCompanies,
        attempt: searchAttempt + 1
      });
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-competitor-search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyName: calculator.competitorName,
            limit: 5,
            excludeCompanies
          })
        }
      );

      const data = await response.json();
      console.log('API response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to find similar companies');
      }

      if (data.similarCompanies && data.similarCompanies.length > 0) {
        // Add new companies to shown list
        const newCompanyNames = data.similarCompanies.map((c: any) => c.name);
        setShownCompanyNames(prev => [...prev, ...newCompanyNames]);
        
        // Append to existing results (not replace)
        setSimilarCompanies(prev => [...prev, ...data.similarCompanies]);
        setHasSearched(true);
        setSearchAttempt(prev => prev + 1);
        setTotalMatches(prev => prev + data.similarCompanies.length);
        setNoMoreCompanies(false);
      } else {
        // No more companies found
        setNoMoreCompanies(true);
        if (!hasSearched) {
          alert('No similar companies found. Try a different company name.');
        }
      }
      
    } catch (error) {
      console.error('Error finding similar companies:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to find similar companies. Please try again.';
      alert(errorMessage);
    } finally {
      setFindingCompanies(false);
    }
  };

  const handleAddLead = async (companyName: string) => {
    try {
      const result = await addOrUpdateLead({
        userId: currentUser.id,
        companyName: companyName,
        source: 'similar_results',
        contacted: false
      });

      if (result.success) {
        setAddedCompanies(prev => new Set(prev).add(companyName.toLowerCase()));
        alert(result.message);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error adding lead:', error);
      alert('Failed to add company to your list');
    }
  };

  const isCompanyAdded = (companyName: string): boolean => {
    return addedCompanies.has(companyName.toLowerCase());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCalculate();
    }
  };

  const handleHistoricalRateSelect = (price: number) => {
    calculator.setYourRate(price.toFixed(4));
  };

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
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-purple-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                Spread Checker
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>

              <Button 
                variant="ghost" 
                onClick={() => navigate('/leads')}
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                <Users className="h-4 w-4 mr-2" />
                My Leads
              </Button>

              {userRole === 'admin' && (
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/admin')}
                  className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              )}
              
              <Button 
                onClick={handleSignOut}
                variant="ghost"
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="p-4 pt-32 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300" style={{ color: '#C7B3FF' }}>
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
                  <SelectTrigger className="bg-white/10 border-white/20 hover:border-white/40 text-purple-100 transition-colors duration-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-white/20">
                    {FX_PAIRS.map((pair) => (
                      <SelectItem key={pair.value} value={pair.value} className="text-purple-100 hover:bg-white/20 transition-colors duration-200">
                        {pair.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Live Rate Display */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/20 hover:border-white/40 transition-colors duration-200">
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
                  className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
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
                  className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                  placeholder="Enter competitor rate"
                />
              </div>

              {/* Client Name Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="competitor-name" className="text-sm font-medium text-purple-200">
                    Client Name
                  </Label>
                  <div className="group relative">
                    <button
                      type="button"
                      className="text-purple-300 hover:text-purple-100 transition-colors"
                      aria-label="Help"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-6 w-72 p-3 bg-gray-900 border border-purple-400/30 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                      <p className="text-xs text-purple-200 mb-2 font-semibold">💡 Search Tips:</p>
                      <ul className="text-xs text-purple-300 space-y-1">
                        <li>• For large retailers, try: "Tesco Stores", "Next Retail"</li>
                        <li>• Use operating company names, not holding companies</li>
                        <li>• Examples: "Sainsburys Supermarkets", "ASOS.COM LIMITED"</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <Input
                  id="competitor-name"
                  type="text"
                  value={calculator.competitorName}
                  onChange={(e) => calculator.setCompetitorName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                  placeholder="Enter competitor name"
                />
              </div>

              {/* Comparison Date Display */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-purple-200">
                  Comparison Date
                </Label>
                <div className="bg-white/5 border border-white/20 hover:border-white/40 text-purple-100 p-3 rounded-lg transition-colors duration-200">
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
                  className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
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
                  className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                  placeholder="Enter number of trades per year"
                />
              </div>

              {/* Pip Selection */}
              <div className="p-4 bg-white/5 rounded-lg border border-white/20 hover:border-white/40 transition-colors duration-200">
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
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        calculator.selectedPips === pips
                          ? 'bg-purple-600 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] cursor-default'
                          : 'text-purple-200 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10 border'
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
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <Calculator className="mr-2 h-5 w-5" />
                Calculate Savings
              </Button>

              {/* Results Display */}
              {calculator.results && (
                <>
                  <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300">
                    <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
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

                  {/* Find Similar Companies Button */}
                  {calculator.competitorName && (
                    !companyFinderEnabled ? (
                      <div className="p-6 bg-purple-600/10 rounded-lg border border-purple-400/30 text-center">
                        <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
                          <TrendingUp className="h-6 w-6 text-purple-400" />
                        </div>
                        <h4 className="text-lg font-semibold text-purple-100 mb-2">
                          Company Finder Not Available
                        </h4>
                        <p className="text-purple-200/80 text-sm max-w-md mx-auto">
                          This feature requires the Company Finder add-on. Please contact your admin to enable this feature.
                        </p>
                      </div>
                    ) : noMoreCompanies ? (
                      <div className="p-6 bg-blue-600/10 rounded-lg border border-blue-400/30 text-center">
                        <h4 className="text-lg font-semibold text-purple-100 mb-2">
                          No More Similar Companies Found
                        </h4>
                        <p className="text-purple-200/80 text-sm">
                          All companies that match well enough are already shown or in your list!
                        </p>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleFindSimilarCompanies}
                        disabled={findingCompanies}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {findingCompanies ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                            Finding Similar Companies...
                          </>
                        ) : hasSearched ? (
                          <>
                            <TrendingUp className="mr-2 h-5 w-5" />
                            Find More Similar Companies
                          </>
                        ) : (
                          <>
                            <TrendingUp className="mr-2 h-5 w-5" />
                            Find Similar Companies to {calculator.competitorName}
                          </>
                        )}
                      </Button>
                    )
                  )}

                  {/* Similar Companies Results */}
                  {similarCompanies.length > 0 && (
                    <div className="p-6 bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300">
                      <h3 className="text-lg font-semibold text-purple-200 mb-4 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Similar Companies (Showing {similarCompanies.length} of {totalMatches})
                      </h3>
                      
                      <div className="space-y-3">
                        {similarCompanies.map((company, index) => (
                          <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h4 className="font-semibold text-purple-100 mb-1">{company.name}</h4>
                                <p className="text-sm text-purple-300 mb-2">{company.industry}</p>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="px-2 py-1 bg-purple-600/30 rounded text-purple-200">
                                    📍 {company.location}
                                  </span>
                                  <span className="px-2 py-1 bg-blue-600/30 rounded text-blue-200">
                                    {company.size}
                                  </span>
                                  {company.isSubsidiary && (
                                    <span className="px-2 py-1 bg-orange-600/30 rounded text-orange-200 flex items-center gap-1">
                                      <Globe className="h-3 w-3" />
                                      UK Subsidiary
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-purple-200 mt-2 italic">"{company.reasoning}"</p>
                              </div>
                              {isCompanyAdded(company.name) ? (
                                <span className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] text-sm whitespace-nowrap cursor-default">
                                  ✓ Added
                                </span>
                              ) : (
                                <Button
                                  onClick={() => handleAddLead(company.name)}
                                  size="sm"
                                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-4 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 whitespace-nowrap"
                                >
                                  Add to List
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Reset Button */}
              <Button 
                onClick={() => {
                  calculator.resetCalculator();
                  setSimilarCompanies([]);
                  setHasSearched(false);
                  setTotalMatches(0);
                  setShownCompanyNames([]);
                  setSearchAttempt(0);
                  setNoMoreCompanies(false);
                }}
                variant="outline"
                className="w-full bg-transparent hover:bg-white/10 border border-transparent hover:border-white/20 text-purple-200 hover:text-white transition-all duration-200"
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
