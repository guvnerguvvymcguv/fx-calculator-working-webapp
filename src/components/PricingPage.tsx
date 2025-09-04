import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PricingPage = () => {
  const navigate = useNavigate();
  
  const handleSubscribe = () => {
    // Open in new tab (recommended)
    window.open('https://buy.stripe.com/7sY9AM3RF6THgKVda14Vy01', '_blank');
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
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-300">
            Scale with your team. Volume discounts applied automatically.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {/* Small Teams */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Small Teams</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">£50</span>
                <span className="text-gray-400">/seat/month</span>
              </div>
              <p className="text-purple-400 mt-2">1-14 seats</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Live FX rates
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Historical data & charts
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Savings calculations
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Salesforce integration
              </div>
            </CardContent>
          </Card>

          {/* Growing Teams - Most Popular */}
          <Card className="bg-purple-900/30 border-purple-600 backdrop-blur relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-sm">
              Most Popular
            </div>
            <CardHeader>
              <CardTitle className="text-2xl text-white">Growing Teams</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">£45</span>
                <span className="text-gray-400">/seat/month</span>
              </div>
              <p className="text-purple-400 mt-2">15-29 seats (10% off)</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Live FX rates
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Historical data & charts
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Savings calculations
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Salesforce integration
              </div>
            </CardContent>
          </Card>

          {/* Enterprise */}
          <Card className="bg-gray-900/50 border-gray-800 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-2xl text-white">Enterprise</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">£40</span>
                <span className="text-gray-400">/seat/month</span>
              </div>
              <p className="text-purple-400 mt-2">30+ seats (20% off)</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Live FX rates
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Historical data & charts
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Savings calculations
              </div>
              <div className="flex items-center text-gray-300">
                <Check className="w-5 h-5 text-green-500 mr-2" />
                Salesforce integration
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button 
            onClick={handleSubscribe}
            className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-6 px-12 text-lg rounded-lg"
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