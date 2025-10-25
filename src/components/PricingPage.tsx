import { useState } from 'react';
import { Button } from './ui/button';
import { AnimatedCard } from './ui/AnimatedCard';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PricingPage = () => {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Monthly prices
  const monthlyPrices = {
    small: 30,
    growing: 27,
    enterprise: 24
  };

  // Annual prices (10% additional discount)
  const annualPrices = {
    small: monthlyPrices.small * 12 * 0.9,
    growing: monthlyPrices.growing * 12 * 0.9,
    enterprise: monthlyPrices.enterprise * 12 * 0.9
  };

  // Handle toggle with animation
  const handleToggle = (annual: boolean) => {
    if (annual !== isAnnual) {
      setIsTransitioning(true);
      // Brief delay before changing state to allow fade-out
      setTimeout(() => {
        setIsAnnual(annual);
        // Reset transition state after fade-in completes
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }, 150);
    }
  };

  return (
    <div className="min-h-screen bg-[#10051A] p-8 relative">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
        aria-label="Back to homepage"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>
      
      <div className="max-w-6xl mx-auto">
        {/* Header - First to animate */}
        <div className="text-center mb-12 animate-fade-in-up">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-purple-200/80">
            Scale with your team. Volume discounts applied automatically.
          </p>
        </div>

        {/* Monthly/Annual Toggle - Slight delay */}
        <div className="flex justify-center mb-12 animate-fade-in-up" style={{ animationDelay: '0.1s', opacity: 0 }}>
          <div className="bg-gray-900/50 rounded-lg p-1 flex relative">
            {/* Sliding background indicator */}
            <div 
              className={`absolute top-1 bottom-1 bg-purple-600 rounded-md transition-all duration-300 ease-in-out ${
                isAnnual ? 'left-[calc(50%+0.125rem)] right-1' : 'left-1 right-[calc(50%+0.125rem)]'
              }`}
              style={{ width: 'calc(50% - 0.375rem)' }}
            />
            
            <button
              onClick={() => handleToggle(false)}
              className={`relative z-10 px-6 py-2 rounded-md transition-all duration-300 ${
                !isAnnual 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => handleToggle(true)}
              className={`relative z-10 px-6 py-2 rounded-md transition-all duration-300 ${
                isAnnual 
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annually
              <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                Save 10%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards - Staggered animation */}
        <div className="grid md:grid-cols-3 gap-8 mb-12 animate-fade-in-up" style={{ animationDelay: '0.2s', opacity: 0 }}>
          {/* Small Teams */}
          <div className={`transition-all duration-400 ${isTransitioning ? 'scale-[1.02]' : 'scale-100'}`}>
            <AnimatedCard>
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-purple-200 mb-4">Small Teams</h3>
                <div className={`mt-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                  {!isAnnual ? (
                    <>
                      <span className="text-4xl font-bold text-white">£{monthlyPrices.small}</span>
                      <span className="text-purple-200/80">/seat/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-white">£{annualPrices.small.toFixed(0)}</span>
                      <span className="text-purple-200/80">/seat/year</span>
                      <div className="text-sm text-purple-200/70 mt-1">
                        £{(annualPrices.small / 12).toFixed(0)}/month
                      </div>
                    </>
                  )}
                </div>
                <p className="text-purple-300 mt-2 mb-6">1-14 seats</p>
                
                <div className="space-y-3">
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Live FX rates
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Historical data & charts
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Savings calculations
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Salesforce integration
                  </div>
                </div>
              </div>
            </AnimatedCard>
          </div>

          {/* Growing Teams - Most Popular */}
          <div className={`transition-all duration-400 ${isTransitioning ? 'scale-[1.02]' : 'scale-100'}`} style={{ transitionDelay: '50ms' }}>
            <AnimatedCard>
              <div className="p-6 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-sm z-10">
                  Most Popular
                </div>
                <h3 className="text-2xl font-semibold text-purple-200 mb-4">Growing Teams</h3>
                <div className={`mt-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                  {!isAnnual ? (
                    <>
                      <span className="text-4xl font-bold text-white">£{monthlyPrices.growing}</span>
                      <span className="text-purple-200/80">/seat/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-white">£{annualPrices.growing.toFixed(0)}</span>
                      <span className="text-purple-200/80">/seat/year</span>
                      <div className="text-sm text-purple-200/70 mt-1">
                        £{(annualPrices.growing / 12).toFixed(0)}/month
                      </div>
                    </>
                  )}
                </div>
                <p className="text-purple-300 mt-2 mb-6">15-29 seats (10% off)</p>
                
                <div className="space-y-3">
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Live FX rates
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Historical data & charts
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Savings calculations
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Salesforce integration
                  </div>
                </div>
              </div>
            </AnimatedCard>
          </div>

          {/* Enterprise */}
          <div className={`transition-all duration-400 ${isTransitioning ? 'scale-[1.02]' : 'scale-100'}`} style={{ transitionDelay: '100ms' }}>
            <AnimatedCard>
              <div className="p-6">
                <h3 className="text-2xl font-semibold text-purple-200 mb-4">Enterprise</h3>
                <div className={`mt-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                  {!isAnnual ? (
                    <>
                      <span className="text-4xl font-bold text-white">£{monthlyPrices.enterprise}</span>
                      <span className="text-purple-200/80">/seat/month</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold text-white">£{annualPrices.enterprise.toFixed(0)}</span>
                      <span className="text-purple-200/80">/seat/year</span>
                      <div className="text-sm text-purple-200/70 mt-1">
                        £{(annualPrices.enterprise / 12).toFixed(0)}/month
                      </div>
                    </>
                  )}
                </div>
                <p className="text-purple-300 mt-2 mb-6">30+ seats (20% off)</p>
                
                <div className="space-y-3">
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Live FX rates
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Historical data & charts
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Savings calculations
                  </div>
                  <div className="flex items-center text-purple-200/90">
                    <Check className="w-5 h-5 text-green-400 mr-2" />
                    Salesforce integration
                  </div>
                </div>
              </div>
            </AnimatedCard>
          </div>
        </div>

        {/* Add-ons Section */}
        <div className="mt-16 mb-12 animate-fade-in-up" style={{ animationDelay: '0.3s', opacity: 0 }}>
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
              Supercharge with Add-ons
            </h2>
            <p className="text-xl text-purple-200/80">
              Enhance your subscription with powerful features
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Company Finder Add-on - Using "Our Solution" styling */}
            <div className={`bg-gradient-to-b from-green-500/10 to-green-500/5 backdrop-blur-xl border-green-500/30 rounded-xl shadow-[0_0_32px_rgba(34,197,94,0.15),0_0_48px_rgba(34,197,94,0.1),0_0_64px_rgba(34,197,94,0.05),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(34,197,94,0.25),0_0_60px_rgba(34,197,94,0.15),0_0_80px_rgba(34,197,94,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-green-500/20 p-6 relative ${isTransitioning ? 'scale-[1.01]' : 'scale-100'}`}>
              <div className={`absolute top-4 right-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  {isAnnual ? '£3/seat/month' : '£5/seat/month'}
                </span>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-green-300 mb-3">Company Finder</h3>
                  <div className={`mb-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                    {!isAnnual ? (
                      <>
                        <span className="text-3xl font-bold text-white">£5</span>
                        <span className="text-green-200/80">/seat/month</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-white">£3</span>
                        <span className="text-green-200/80">/seat/month</span>
                        <div className="text-sm text-green-200/70 mt-1">
                          £36/seat/year (billed annually)
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-purple-200/80 mb-4">
                    Unlimited AI-powered company search to expand your sales pipeline
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Unlimited company searches</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">AI-powered similarity matching</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Lead management dashboard</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Export to Salesforce</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Data Tracking Add-on - Using "Our Solution" styling */}
            <div className={`bg-gradient-to-b from-green-500/10 to-green-500/5 backdrop-blur-xl border-green-500/30 rounded-xl shadow-[0_0_32px_rgba(34,197,94,0.15),0_0_48px_rgba(34,197,94,0.1),0_0_64px_rgba(34,197,94,0.05),inset_0_1px_0_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(34,197,94,0.25),0_0_60px_rgba(34,197,94,0.15),0_0_80px_rgba(34,197,94,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-green-500/20 p-6 relative ${isTransitioning ? 'scale-[1.01]' : 'scale-100'}`}>
              <div className={`absolute top-4 right-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
                  {isAnnual ? '£3/seat/month' : '£5/seat/month'}
                </span>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-green-300 mb-3">Client Data Tracking</h3>
                  <div className={`mb-4 transition-opacity duration-200 ${isTransitioning ? 'opacity-50' : 'opacity-100'}`}>
                    {!isAnnual ? (
                      <>
                        <span className="text-3xl font-bold text-white">£5</span>
                        <span className="text-green-200/80">/seat/month</span>
                      </>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-white">£3</span>
                        <span className="text-green-200/80">/seat/month</span>
                        <div className="text-sm text-green-200/70 mt-1">
                          £36/seat/year (billed annually)
                        </div>
                      </>
                    )}
                  </div>
                  <p className="text-purple-200/80 mb-4">
                    Automated monthly PDF reports with comprehensive client analytics
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Monthly PDF reports</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Per-client analytics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Currency pair tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-400" />
                      <span className="text-green-200 text-sm">Competitor analysis</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add-ons Note - 3D Purple Styling */}
          <div className="mt-12 mb-12 bg-gradient-to-b from-purple-500/10 to-purple-500/5 backdrop-blur-xl border-purple-500/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] border-t-purple-500/20 p-6 text-center">
            <p className="text-purple-200">
              <span className="font-semibold">All add-ons are per-seat pricing.</span> Select them during checkout or add them later from your account settings.
            </p>
          </div>
        </div>

        {/* CTA Button - Last to animate */}
        <div className="text-center mt-8 animate-fade-in-up" style={{ animationDelay: '0.4s', opacity: 0 }}>
          <Button 
            onClick={() => navigate(`/signup?plan=${isAnnual ? 'annual' : 'monthly'}`)}
            className="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition duration-200 shadow-lg"
          >
            Start Free Trial
         </Button>
          <p className="text-gray-400 mt-4">60 days free</p>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
