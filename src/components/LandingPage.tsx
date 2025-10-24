import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Play, X, Calendar, Search, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { AnimatedCard } from './ui/AnimatedCard';
import { supabase } from '../lib/supabase';

// Import our custom hooks and components
import { Navbar } from './ui/Navbar';
import { HeroSection } from './ui/HeroSection';
import ProblemSolutionSection from "./ui/ProblemSolutionSection";
import { USPSection } from './ui/USPSection';
import { FeaturesGrid } from './ui/FeaturesGrid';
import { HowItWorksSection } from './ui/HowItWorksSection';
import PricingSection from "./ui/PricingSection";
import { FAQSection } from './ui/FAQSection';
import { Footer } from './ui/Footer';
import { MockCalculator } from './ui/MockCalculator';
import { HistoricalChart } from './ui/HistoricalChart';
import { MOCK_CHART_DATA, filterDataByTimeframe } from '../constants/mockChartData';

// Add interface for props
interface LandingPageProps {
  isAuthenticated: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

// Update component to accept props
export default function LandingPage({ isAuthenticated, onSignIn, onSignOut }: LandingPageProps) {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<'admin' | 'junior' | null>(null);
  const [loading, setLoading] = useState(true);

  // State for mock historical interface
  const [selectedPair, setSelectedPair] = useState('GBPUSD');
  const selectedTimeframe = '5D';
  const [showDatePicker, setShowDatePicker] = useState(true);
  const selectedDate = new Date(2025, 6, 8);
  const currentMonth = new Date(2025, 6);

  // Check user role when authenticated
  useEffect(() => {
    const checkUserRole = async () => {
      if (isAuthenticated) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('role_type')
              .eq('id', user.id)
              .single();
            
            if (profile) {
              setUserRole(profile.role_type);
            }
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    };

    checkUserRole();
  }, [isAuthenticated]);

  // Handle navigation based on role
  const handleAuthenticatedNavigation = () => {
    if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'junior') {
      navigate('/calculator');
    }
  };

  // Modified sign in handler that considers authentication state
  const handleSignInOrNavigate = () => {
    if (isAuthenticated && userRole) {
      handleAuthenticatedNavigation();
    } else {
      onSignIn();
    }
  };

  // Handle all the callback functions
  const handleSignUp = (): void => {
    navigate('/pricing');
  };

  const handleLogin = (): void => {
    navigate('/login');
  };

  // Mock chart data for the historical rates demo
  const mockChartData = filterDataByTimeframe(MOCK_CHART_DATA[selectedPair] || [], 5); // 5D timeframe
  
  const handleMockPriceSelect = (price: number): void => {
    console.log('Selected price:', price);
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const availablePairs = ['GBPUSD', 'GBPEUR', 'EURUSD'];
  const timeframes = ['1D', '5D', '1M', '3M'];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#10051A', color: '#C7B3FF' }}>
      
      {/* Navigation - Updated to use auth state and role */}
      <Navbar 
        isSignedIn={isAuthenticated}
        onSignIn={handleSignInOrNavigate}
        onSignOut={onSignOut}
        userRole={userRole}
        loading={loading}
      />

      {/* Hero Section - Updated to use auth state */}
      <HeroSection 
        onSignUp={handleSignUp} 
        isAuthenticated={isAuthenticated}
        userRole={userRole}
        onNavigate={handleAuthenticatedNavigation}
      />

      {/* USP Section - Key value proposition */}
      <USPSection />

      {/* Problem & Solution Section */}
      <ProblemSolutionSection />

      {/* Features Section */}
      <FeaturesGrid />

      {/* Add-ons Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Supercharge Your Workflow
            </h2>
            <p className="text-xl text-purple-200/80">Optional add-ons to unlock even more power</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Company Finder Add-on */}
            <AnimatedCard>
              <div className="p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Search className="h-6 w-6 text-blue-400" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-purple-300">From</div>
                  <div className="text-2xl font-bold text-white">£5<span className="text-sm text-purple-200">/seat/mo</span></div>
                  <div className="text-xs text-purple-300">£3/seat annually</div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-purple-200 mb-3">Company Finder</h3>
              <p className="text-purple-200/80 mb-6">
                Find unlimited similar companies to expand your prospect list and never run out of leads.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Search by company name or location</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Find similar companies in the same industry</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Access full company details & contact info</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Build and manage your leads pipeline</span>
                </div>
              </div>
              </div>
            </AnimatedCard>

            {/* Client Data Tracking Add-on */}
            <AnimatedCard>
              <div className="p-8">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-purple-400" />
                </div>
                <div className="text-right">
                  <div className="text-sm text-purple-300">From</div>
                  <div className="text-2xl font-bold text-white">£5<span className="text-sm text-purple-200">/seat/mo</span></div>
                  <div className="text-xs text-purple-300">£3/seat annually</div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-purple-200 mb-3">Client Data Tracking</h3>
              <p className="text-purple-200/80 mb-6">
                Receive monthly PDF reports with comprehensive analytics on your team's performance.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Monthly PDF reports with key metrics</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Track total savings presented to clients</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Monitor team performance and trends</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-green-400 text-xs">✓</span>
                  </div>
                  <span className="text-purple-200/90 text-sm">Historical data for year-over-year comparison</span>
                </div>
              </div>
              </div>
            </AnimatedCard>
          </div>

          <div className="text-center">
            <Button 
              onClick={handleSignUp}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),0_8px_20px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),0_10px_28px_rgba(168,85,247,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              See Full Pricing
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Demo Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Spread Checker Calculator
          </h2>
          <p className="text-xl text-purple-200/80 mb-12">
            Here's an example of our intuitive FX calculator in action.
          </p>
          
          <div className="mb-8">
            <MockCalculator />
          </div>
          
          <Button 
            onClick={handleSignUp}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),0_8px_20px_rgba(168,85,247,0.3),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),0_10px_28px_rgba(168,85,247,0.4),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <Play className="mr-2 h-5 w-5" />
            Sign Up Now
          </Button>
        </div>
      </section>

      {/* Historical Rates Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Historical Rates
          </h2>
          <p className="text-xl text-purple-200/80 mb-12">
            Access historical exchange rate data to compare with clients historical buys.
          </p>
          
          <div className="mb-8">
            {/* Mock Historical Rates Modal - Matching MockCalculator Aesthetic */}
            <div className="bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border-white/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_16px_48px_rgba(168,85,247,0.2),0_24px_64px_rgba(59,130,246,0.1)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_20px_56px_rgba(168,85,247,0.3),0_28px_72px_rgba(59,130,246,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-white/20 max-w-5xl mx-auto" style={{ color: '#C7B3FF' }}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-400" />
                  <h2 className="text-lg font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">Historical Exchange Rates</h2>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/30 text-purple-200 hover:bg-white/10 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Controls */}
              <div className="p-4 border-b border-white/20 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Currency Pair Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-purple-200">Pair:</label>
                    <div className="flex gap-1">
                      {availablePairs.map((pair) => (
                        <button
                          key={pair}
                          onClick={() => setSelectedPair(pair)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            selectedPair === pair
                              ? 'bg-purple-600 text-white shadow-lg'
                              : 'bg-white/10 text-purple-200 hover:bg-white/20'
                          }`}
                        >
                          {pair.slice(0, 3)}/{pair.slice(3)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Timeframe Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-purple-200">Timeframe:</label>
                    <div className="flex gap-1">
                      {timeframes.map((tf) => (
                        <button
                          key={tf}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                            tf === '5D'
                              ? 'bg-purple-600 text-white shadow-lg cursor-not-allowed'
                              : 'bg-white/10 text-purple-200/50 cursor-not-allowed'
                          }`}
                          disabled={tf !== '5D'}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    variant="outline"
                    size="sm"
                    className="border-white/30 text-purple-200 hover:bg-white/10 transition-all duration-200 text-xs"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {showDatePicker ? 'Hide' : 'Show'} Date/Time Search
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-300 hover:bg-red-500/10 transition-all duration-200 text-xs"
                  >
                    Reset View
                  </Button>
                </div>

                {/* Date/Time Picker */}
                {showDatePicker && (
                  <div className="p-4 bg-white/5 border border-white/20 rounded-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Calendar */}
                      <div>
                        <h4 className="text-xs font-semibold text-purple-200 mb-3">Select Date</h4>
                        
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-200 hover:bg-white/10 cursor-not-allowed h-7 w-7 p-0"
                            disabled
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-purple-200 font-medium">
                            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-200 hover:bg-white/10 cursor-not-allowed h-7 w-7 p-0"
                            disabled
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {/* Day headers */}
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className="p-1.5 text-center text-purple-300 font-medium text-[10px]">
                              {day}
                            </div>
                          ))}
                          
                          {/* Calendar days */}
                          {generateCalendarDays().map((day, index) => (
                            <div key={index} className="relative">
                              {day ? (
                                <div
                                  className={`w-full p-1.5 text-center rounded text-[10px] cursor-not-allowed ${
                                    selectedDate && 
                                    selectedDate.getDate() === day && 
                                    selectedDate.getMonth() === currentMonth.getMonth() &&
                                    selectedDate.getFullYear() === currentMonth.getFullYear()
                                      ? 'bg-purple-600 text-white font-semibold'
                                      : 'text-purple-200 hover:bg-white/5'
                                  }`}
                                >
                                  {day}
                                </div>
                              ) : (
                                <div className="p-1.5"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Time Input and Search */}
                      <div>
                        <h4 className="text-xs font-semibold text-purple-200 mb-3">Time & Search</h4>
                        
                        {selectedDate && (
                          <div className="mb-3 p-2 bg-purple-600/10 rounded border border-purple-600/20">
                            <div className="text-[10px] text-purple-300 mb-0.5">Selected Date:</div>
                            <div className="text-xs text-purple-200 font-medium">
                              {formatDateDisplay(selectedDate)}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-purple-300 mb-1">
                              Time (e.g., 13:00, 1:00 PM, 1pm)
                            </label>
                            <div className="w-full p-2 bg-white/10 border border-white/20 rounded text-purple-200 text-xs">
                              10:00
                            </div>
                          </div>

                          <Button
                            disabled={!selectedDate}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50 text-xs h-8"
                          >
                            <Search className="h-3 w-3 mr-1" />
                            Find Rate
                          </Button>

                          {/* Display found rate */}
                          <div className="p-2 bg-green-600/10 border border-green-600/20 rounded">
                            <div className="text-[10px] text-green-300 mb-1">Rate Found:</div>
                            <div className="text-base font-bold text-green-400">1.3497</div>
                            <Button
                              size="sm"
                              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-xs h-7"
                            >
                              Use This Rate
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Instructions */}
                <div className="p-3 bg-purple-600/10 rounded-lg border border-purple-600/20">
                  <p className="text-xs text-purple-300">
                    💡 <strong>How to use:</strong> Use the Date/Time Search for specific rates, or hover over the chart to see historical rates and click on any point to select that rate for your calculation.
                  </p>
                </div>
              </div>
              
              {/* Chart Area */}
              <div className="p-6 flex justify-center bg-white/[0.02]">
                <div className="w-full max-w-4xl">
                  <HistoricalChart
                    data={mockChartData.map(point => ({
                    ...point,
                    date: new Date(point.timestamp).toISOString()
          }))}
                    onPriceSelect={handleMockPriceSelect}
                    selectedPair={selectedPair}
                    width={800}
                    height={400}
                  />
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-4 border-t border-white/20 bg-white/5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-purple-300">
                    Showing {mockChartData.length} data points for {selectedPair.slice(0, 3)}/{selectedPair.slice(3)} ({selectedTimeframe})
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/30 text-purple-200 hover:bg-white/10 transition-all duration-200 text-xs h-8"
                  >
                    Close Preview
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* FAQ Section */}
      <FAQSection />

      {/* Footer */}
      <Footer onLogin={handleLogin} />
    </div>
  );
}