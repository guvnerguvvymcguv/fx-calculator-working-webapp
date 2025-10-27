import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Play, Search, TrendingUp } from 'lucide-react';
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
import { MockHistoricalRates } from './ui/MockHistoricalRates';

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
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
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
            <MockHistoricalRates />
          </div>
          
          <Button 
            onClick={handleSignUp}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-8 py-4 text-lg rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            <Play className="mr-2 h-5 w-5" />
            Sign Up Now
          </Button>
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