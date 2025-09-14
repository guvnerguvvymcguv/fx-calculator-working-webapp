import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, CreditCard, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        navigate('/');
        return;
      }

      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      setCompany(companyData);
    } catch (error) {
      console.error('Error fetching company:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = () => {
    if (!company) return { subtotal: 0, vat: 0, total: 0 };
    
    const monthlyPrice = company.subscription_price || 0;
    let subtotal = monthlyPrice;
    
    if (billingPeriod === 'annual') {
      subtotal = monthlyPrice * 12 * 0.9; // 10% discount for annual
    }
    
    const vat = subtotal * 0.2; // 20% VAT
    const total = subtotal + vat;
    
    return { subtotal, vat, total };
  };

  const handleCheckout = async () => {
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        alert('Please log in to continue');
        navigate('/login');
        return;
      }
      
      console.log('Starting checkout with:', {
        companyId: company.id,
        billingPeriod,
        seatCount: company.subscription_seats,
        pricePerMonth: company.subscription_price
      });
      
      // Call your Stripe checkout edge function
      const response = await supabase.functions.invoke('create-checkout-session', {
        body: {
          companyId: company.id,
          billingPeriod,
          seatCount: company.subscription_seats,
          pricePerMonth: company.subscription_price
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      console.log('Checkout response:', response);

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create checkout session');
      }

      if (response.data?.url) {
        // Redirect to Stripe Checkout
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert(`Checkout failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
      <div className="text-purple-300">Loading...</div>
    </div>;
  }

  const { subtotal, vat, total } = calculatePrice();

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-2xl mx-auto">
        <Button
          onClick={() => navigate('/admin/account')}
          variant="outline"
          className="mb-6 border-gray-600 text-gray-300 hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Account Management
        </Button>

        <h1 className="text-3xl font-bold text-white mb-8">Complete Your Subscription</h1>

        {/* Billing Period Selection */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card 
            className={`cursor-pointer transition-all ${
              billingPeriod === 'monthly' 
                ? 'bg-purple-900/50 border-purple-600' 
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setBillingPeriod('monthly')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">Monthly</h3>
                  <p className="text-gray-400 text-sm mt-1">Pay as you go</p>
                  <p className="text-white text-2xl font-bold mt-3">
                    £{company?.subscription_price}/month
                  </p>
                </div>
                {billingPeriod === 'monthly' && (
                  <Check className="h-5 w-5 text-purple-400" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${
              billingPeriod === 'annual' 
                ? 'bg-purple-900/50 border-purple-600' 
                : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
            }`}
            onClick={() => setBillingPeriod('annual')}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">Annual</h3>
                  <p className="text-green-400 text-sm mt-1">Save 10%</p>
                  <p className="text-white text-2xl font-bold mt-3">
                    £{(company?.subscription_price * 12 * 0.9 / 12).toFixed(0)}/month
                  </p>
                  <p className="text-gray-400 text-xs">Billed annually</p>
                </div>
                {billingPeriod === 'annual' && (
                  <Check className="h-5 w-5 text-purple-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-gray-400">
              <span>{company?.subscription_seats} seats × {billingPeriod === 'monthly' ? '1 month' : '12 months'}</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>
            {billingPeriod === 'annual' && (
              <div className="flex justify-between text-green-400">
                <span>Annual discount (10%)</span>
                <span>-£{(company?.subscription_price * 12 * 0.1).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>VAT (20%)</span>
              <span>£{vat.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-700 pt-3 flex justify-between text-white text-lg font-semibold">
              <span>Total</span>
              <span>£{total.toFixed(2)}</span>
            </div>
            <p className="text-gray-400 text-sm">
              {billingPeriod === 'monthly' 
                ? 'Charged monthly to your card' 
                : 'One-time payment for 12 months'}
            </p>
          </CardContent>
        </Card>

        <Button
          onClick={handleCheckout}
          disabled={processing}
          className="w-full py-6 text-lg bg-purple-600 hover:bg-purple-700"
        >
          {processing ? (
            'Processing...'
          ) : (
            <>
              <CreditCard className="mr-2 h-5 w-5" />
              Proceed to Payment
            </>
          )}
        </Button>

        <p className="text-gray-400 text-sm text-center mt-4">
          Secure payment powered by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  );
}