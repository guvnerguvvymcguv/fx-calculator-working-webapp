import { useNavigate } from 'react-router-dom';
import { useContext, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, X, Calendar, Search, ChevronLeft, ChevronRight } from 'lucide-react';

// Import our custom hooks and components
import { Navbar } from './ui/Navbar';
import { HeroSection } from './ui/HeroSection';
import ProblemSolutionSection from "./ui/ProblemSolutionSection";
import { FeaturesGrid } from './ui/FeaturesGrid';
import PricingSection from "./ui/PricingSection";
import { Footer } from './ui/Footer';
import { MockCalculator } from './ui/MockCalculator';
import { HistoricalChart } from './ui/HistoricalChart';
import { AuthContext } from '../App';
import { MOCK_CHART_DATA, filterDataByTimeframe } from '../constants/mockChartData';

export default function LandingPage() {
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);

  // State for mock historical interface
  const [selectedPair, setSelectedPair] = useState('GBPUSD');
  const selectedTimeframe = '5D';
  const [showDatePicker, setShowDatePicker] = useState(true);
  const selectedDate = new Date(2025, 6, 8);
  const currentMonth = new Date(2025, 6);

  // Handle all the callback functions
  const handleSignUp = (): void => {
    // For now, redirect to login - in real app this would be signup page
    navigate('/login');
  };

  const handleLogin = (): void => {
    navigate('/login');
  };

  const handleLogout = (): void => {
    authContext?.logout();
  };

  const handleGetStarted = (): void => {
    navigate('/login');
  };

  const handleContactSales = (): void => {
    alert('Contact sales functionality - would redirect to sales form');
  };

  // Mock chart data for the historical rates demo
  const mockChartData = filterDataByTimeframe(MOCK_CHART_DATA[selectedPair] || [], 5); // 5D timeframe
  
  const handleMockPriceSelect = (price: number): void => {
    // Just log for demo purposes - in real app this would do something
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
      
      {/* Navigation */}
      <Navbar 
        isSignedIn={authContext?.isAuthenticated || false}
        onSignIn={handleLogin}
        onSignOut={handleLogout}
      />

      {/* Hero Section */}
      <HeroSection onSignUp={handleSignUp} />

      {/* Problem & Solution Section */}
      <ProblemSolutionSection />

      {/* Features Section */}
      <FeaturesGrid />

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
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-lg hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200"
          >
            <Play className="mr-2 h-5 w-5" />
            Sign Up Now
          </Button>
        </div>
      </section>

      {/* Historical Rates Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Historical Rates
          </h2>
          <p className="text-xl text-purple-200/80 mb-12">
            Access historical exchange rate data to compare with clients historical buys.
          </p>
          
          <div className="mb-8">
            {/* Mock Historical Rates Modal */}
            <div className="bg-[#10051A] backdrop-blur-md border border-white/20 rounded-xl shadow-2xl max-w-5xl mx-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/20">
                <h2 className="text-xl font-bold text-purple-200">Historical Exchange Rates</h2>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/20 text-purple-200 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Controls */}
              <div className="p-6 border-b border-white/20">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Currency Pair Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-purple-200">Pair:</label>
                    <div className="flex gap-1">
                      {availablePairs.map((pair) => (
                        <button
                          key={pair}
                          onClick={() => setSelectedPair(pair)}
                          className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                            selectedPair === pair
                              ? 'bg-purple-600 text-white'
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
                    <label className="text-sm font-medium text-purple-200">Timeframe:</label>
                    <div className="flex gap-1">
                      {timeframes.map((tf) => (
                        <button
                          key={tf}
                          className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors cursor-not-allowed ${
                            tf === '5D'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white/10 text-purple-200 hover:bg-white/20'
                          }`}
                          disabled={tf !== '5D'}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Calendar Button */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      variant="outline"
                      size="sm"
                      className="border-white/20 text-purple-200 hover:bg-white/10"
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Date/Time Search
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                    >
                      Reset View
                    </Button>
                  </div>
                </div>

                {/* Date/Time Picker */}
                {showDatePicker && (
                  <div className="mt-4 p-4 bg-white/5 border border-white/20 rounded-lg">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Calendar */}
                      <div>
                        <h4 className="text-sm font-medium text-purple-200 mb-3">Select Date</h4>
                        
                        {/* Month Navigation */}
                        <div className="flex items-center justify-between mb-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-200 hover:bg-white/10 cursor-not-allowed"
                            disabled
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-purple-200 font-medium">
                            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-200 hover:bg-white/10 cursor-not-allowed"
                            disabled
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-1 text-xs">
                          {/* Day headers */}
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="p-2 text-center text-purple-300 font-medium">
                              {day}
                            </div>
                          ))}
                          
                          {/* Calendar days */}
                          {generateCalendarDays().map((day, index) => (
                            <div key={index} className="relative">
                              {day ? (
                                <div
                                  className={`w-full p-2 text-center rounded cursor-not-allowed ${
                                    selectedDate && 
                                    selectedDate.getDate() === day && 
                                    selectedDate.getMonth() === currentMonth.getMonth() &&
                                    selectedDate.getFullYear() === currentMonth.getFullYear()
                                      ? 'bg-purple-600 text-white'
                                      : 'text-purple-200'
                                  }`}
                                >
                                  {day}
                                </div>
                              ) : (
                                <div className="p-2"></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Time Input and Search */}
                      <div>
                        <h4 className="text-sm font-medium text-purple-200 mb-3">Time & Search</h4>
                        
                        {selectedDate && (
                          <div className="mb-3 p-2 bg-purple-600/10 rounded border border-purple-600/20">
                            <div className="text-xs text-purple-300">Selected Date:</div>
                            <div className="text-sm text-purple-200 font-medium">
                              {formatDateDisplay(selectedDate)}
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs text-purple-300 mb-1">
                              Time (e.g., 13:00, 1:00 PM, 1pm)
                            </label>
                              <div className="w-full p-2 bg-white/10 border border-white/20 rounded text-purple-200">
                              10:00
                              </div>
                          </div>

                          <Button
                            disabled={!selectedDate}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
                          >
                            <Search className="h-4 w-4 mr-1" />
                            Find Rate
                          </Button>

                          {/* Display found rate */}
                          <div className="mt-3 p-3 bg-green-600/10 border border-green-600/20 rounded">
                            <div className="text-xs text-green-300 mb-1">Rate Found:</div>
                            <div className="text-lg font-bold text-green-400">1.3497</div>
                            <Button
                              size="sm"
                              className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white"
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
                <div className="mt-4 p-3 bg-purple-600/10 rounded-lg border border-purple-600/20">
                  <p className="text-sm text-purple-300">
                    💡 <strong>How to use:</strong> Use the Date/Time Search for specific rates, or hover over the chart to see historical rates and click on any point to select that rate for your calculation.
                  </p>
                </div>
              </div>
              
              {/* Chart Area */}
              <div className="p-6 flex justify-center">
                <div className="w-full max-w-4xl">
                  <HistoricalChart
                    data={mockChartData}
                    onPriceSelect={handleMockPriceSelect}
                    selectedPair={selectedPair}
                    width={800}
                    height={400}
                  />
                </div>
              </div>
              
              {/* Footer */}
              <div className="p-6 border-t border-white/20 bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-purple-300">
                    Showing {mockChartData.length} data points for {selectedPair.slice(0, 3)}/{selectedPair.slice(3)} ({selectedTimeframe})
                  </div>
                  <Button
                    variant="outline"
                    className="border-white/20 text-purple-200 hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection 
        onGetStarted={handleGetStarted}
        onContactSales={handleContactSales}
      />

      {/* Footer */}
      <Footer onLogin={handleLogin} />
    </div>
  );
}