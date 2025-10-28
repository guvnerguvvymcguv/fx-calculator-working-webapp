import { useState } from 'react';
import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CheckCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PricingSection() {
  const navigate = useNavigate();
  const [isAnnual, setIsAnnual] = useState(false);
  
  const handleGetStarted = () => {
    navigate('/pricing');
  };

  // Monthly prices
  const monthlyPrices = {
    small: 30,
    growing: 27,
    enterprise: 24
  };

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-purple-200/80 mb-8">Choose the plan that works for your team</p>
          
          {/* Monthly/Annual Toggle */}
          <div className="flex justify-center mb-8">
            <div className="bg-gray-900/50 rounded-lg p-1 flex relative shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)] border border-white/10">
              {/* Sliding background indicator */}
              <div 
                className="absolute top-1 bottom-1 bg-purple-600 rounded-md transition-all duration-300 ease-in-out shadow-[0_2px_8px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
                style={{ 
                  width: isAnnual ? 'calc(50% + 36px)' : 'calc(50% - 32px)',
                  left: isAnnual ? 'calc(50% - 40px)' : '0.25rem'
                }}
              />
              
              <button
                onClick={() => setIsAnnual(false)}
                className={`relative z-10 px-6 py-2 rounded-md transition-all duration-300 ${
                  !isAnnual 
                    ? 'text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setIsAnnual(true)}
                className={`relative z-10 px-6 py-2 rounded-md transition-all duration-300 ${
                  isAnnual 
                    ? 'text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Annually
                <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Standard Plan */}
          <AnimatedCard>
            <div className="p-8">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-purple-200">Small Teams</CardTitle>
              <div className="mt-4">
                {!isAnnual ? (
                  <>
                    <span className="text-3xl font-bold text-white">£{monthlyPrices.small}</span>
                    <span className="text-purple-200/70">/seat/month</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-white">£{(monthlyPrices.small * 0.8).toFixed(0)}</span>
                    <span className="text-purple-200/70">/seat/month</span>
                    <div className="text-sm text-green-400 font-semibold mt-1">
                      Save 20% (billed annually)
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-purple-300 mt-2">1-5 seats</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Live FX rates</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Historical data & charts</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Savings calculations</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Salesforce integration</span>
              </div>
              <Button 
                onClick={handleGetStarted}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Get Started
              </Button>
            </CardContent>
            </div>
          </AnimatedCard>

          {/* Team Plan - 15-29 accounts */}
          <AnimatedCard className="relative">
            <div className="p-8">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                10% Discount
              </span>
            </div>
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-purple-200">Growing Teams</CardTitle>
              <div className="mt-4">
                {!isAnnual ? (
                  <>
                    <span className="text-3xl font-bold text-white">£{monthlyPrices.growing}</span>
                    <span className="text-purple-200/70">/seat/month</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-white">£{(monthlyPrices.growing * 0.8).toFixed(1)}</span>
                    <span className="text-purple-200/70">/seat/month</span>
                    <div className="text-sm text-green-400 font-semibold mt-1">
                      Save 20% (billed annually)
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-purple-300 mt-2">6-12 seats (10% off)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Live FX rates</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Historical data & charts</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Savings calculations</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Salesforce integration</span>
              </div>
              <Button 
                onClick={handleGetStarted}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Get Started
              </Button>
            </CardContent>
            </div>
          </AnimatedCard>

          {/* Enterprise Plan - 30+ accounts */}
          <AnimatedCard className="relative">
            <div className="p-8">
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                20% Discount
              </span>
            </div>
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-purple-200">Enterprise</CardTitle>
              <div className="mt-4">
                {!isAnnual ? (
                  <>
                    <span className="text-3xl font-bold text-white">£{monthlyPrices.enterprise}</span>
                    <span className="text-purple-200/70">/seat/month</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-white">£{(monthlyPrices.enterprise * 0.8).toFixed(1)}</span>
                    <span className="text-purple-200/70">/seat/month</span>
                    <div className="text-sm text-green-400 font-semibold mt-1">
                      Save 20% (billed annually)
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-purple-300 mt-2">13+ seats (20% off)</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Live FX rates</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Historical data & charts</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Savings calculations</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Salesforce integration</span>
              </div>
              <Button 
                onClick={handleGetStarted}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                Get Started
              </Button>
            </CardContent>
            </div>
          </AnimatedCard>
        </div>

        <div className="text-center mt-12">
          <p className="text-purple-200/70">
            All plans include a <span className="text-purple-300 font-semibold">2-month free trial</span>
          </p>
        </div>
      </div>
    </section>
  );
}