import { AnimatedCard } from '../../components/ui/AnimatedCard';
import { CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CheckCircle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PricingSection() {
  const navigate = useNavigate();
  
  const handleGetStarted = () => {
    navigate('/pricing');
  };

  return (
    <section className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-purple-200/80">Choose the plan that works for your team</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Standard Plan */}
          <AnimatedCard>
            <div className="p-8">
            <CardHeader className="text-center pb-6">
              <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-purple-200">Per User</CardTitle>
              <div className="mt-4">
                <span className="text-3xl font-bold text-white">£30</span>
                <span className="text-purple-200/70">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Full calculator access</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Real-time FX rates</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Unlimited calculations</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Email support</span>
              </div>
              <Button 
                onClick={handleGetStarted}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200"
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
              <CardTitle className="text-2xl font-bold text-purple-200">Per User</CardTitle>
              <div className="mt-4">
                <span className="text-3xl font-bold text-white">£27</span>
                <span className="text-purple-200/70"> for 15-29 accounts</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Full calculator access</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Real-time FX rates</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Unlimited calculations</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Email support</span>
              </div>
              <Button 
                onClick={handleGetStarted}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200"
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
              <CardTitle className="text-2xl font-bold text-purple-200">Per User</CardTitle>
              <div className="mt-4">
                <span className="text-3xl font-bold text-white">£24</span>
                <span className="text-purple-200/70"> for 30+ accounts</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Full calculator access</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Real-time FX rates</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Unlimited calculations</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span className="text-purple-200">Email support</span>
              </div>
              <Button 
                onClick={handleGetStarted}
                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 hover:shadow-purple-400/60 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)] transition-all duration-200"
              >
                Get Started
              </Button>
            </CardContent>
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