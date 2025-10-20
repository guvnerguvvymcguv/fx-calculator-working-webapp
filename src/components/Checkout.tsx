import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, CreditCard, Check, Plus, Minus, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [seatChanges, setSeatChanges] = useState({
    adminSeats: 0,
    juniorSeats: 0
  });
  const [currentMembers, setCurrentMembers] = useState({
    adminCount: 0,
    juniorCount: 0
  });
  const [companyFinderEnabled, setCompanyFinderEnabled] = useState(false);
  const [clientDataEnabled, setClientDataEnabled] = useState(false);

  useEffect(() => {
    fetchCompanyData();
    
    // Check for canceled payment
    const params = new URLSearchParams(window.location.search);
    if (params.get('canceled') === 'true') {
      alert('Payment was canceled. You can try again when ready.');
      window.history.replaceState({}, '', '/checkout');
    }
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

      // Fetch current team members to get actual counts
      const { data: members } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true);

      const adminCount = members?.filter(m => m.role_type === 'admin').length || 0;
      const juniorCount = members?.filter(m => m.role_type === 'junior').length || 0;

      setCurrentMembers({
        adminCount,
        juniorCount
      });

      // Get allocated seats from company data or use current members as baseline
      let allocatedAdminSeats = companyData?.admin_seats || 0;
      let allocatedJuniorSeats = companyData?.junior_seats || 0;
      
      if (allocatedAdminSeats === 0 && allocatedJuniorSeats === 0) {
        allocatedAdminSeats = Math.max(1, adminCount);
        allocatedJuniorSeats = Math.max(10, juniorCount);
      }

      setSeatChanges({
        adminSeats: allocatedAdminSeats,
        juniorSeats: allocatedJuniorSeats
      });

      setCompany(companyData);
    } catch (error) {
      console.error('Error fetching company:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePricePerSeat = (totalSeats: number) => {
    if (totalSeats <= 14) return 30;
    if (totalSeats <= 29) return 27;
    return 24;
  };

  const calculateMonthlyPrice = (totalSeats: number) => {
    return totalSeats * calculatePricePerSeat(totalSeats);
  };

  const handleSeatChange = (type: 'admin' | 'junior', change: number) => {
    setSeatChanges(prev => {
      const newValue = type === 'admin' 
        ? Math.max(1, prev.adminSeats + change) // At least 1 admin
        : Math.max(0, prev.juniorSeats + change);
      
      // Ensure we don't go below current member count
      if (type === 'admin' && newValue < currentMembers.adminCount) {
        alert(`You have ${currentMembers.adminCount} active admin(s). You cannot reduce below this number.`);
        return prev;
      }
      if (type === 'junior' && newValue < currentMembers.juniorCount) {
        alert(`You have ${currentMembers.juniorCount} active junior broker(s). You cannot reduce below this number.`);
        return prev;
      }
      
      return {
        ...prev,
        [type === 'admin' ? 'adminSeats' : 'juniorSeats']: newValue
      };
    });
  };

  const totalSeats = seatChanges.adminSeats + seatChanges.juniorSeats;
  const monthlyPrice = calculateMonthlyPrice(totalSeats);
  const pricePerSeat = calculatePricePerSeat(totalSeats);
  
  // Calculate add-on pricing based on billing period and seat count
  const calculateAddonPrice = () => {
    const addonPricePerSeat = billingPeriod === 'monthly' ? 5 : 3; // £5/seat monthly or £3/seat annual
    const addonSubtotal = addonPricePerSeat * totalSeats;
    
    if (billingPeriod === 'annual') {
      // Annual: £3/seat/month × 12 months × 0.9 (10% discount)
      return addonSubtotal * 12 * 0.9;
    }
    return addonSubtotal;
  };
  
  const addonPriceEach = calculateAddonPrice();
  const totalAddonsPrice = (companyFinderEnabled ? addonPriceEach : 0) + (clientDataEnabled ? addonPriceEach : 0);
  
  // Calculate annual price per seat (monthly price with 10% discount)
  const annualPricePerSeat = pricePerSeat * 12 * 0.9;

  const calculatePrice = () => {
    let subtotal = monthlyPrice + totalAddonsPrice;
    
    if (billingPeriod === 'annual') {
      subtotal = (monthlyPrice * 12 * 0.9) + totalAddonsPrice; // Base seats with discount + add-ons
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

      // DO NOT update the database here - just pass the desired seats to Stripe
      // The webhook will handle the update after successful payment
      
      console.log('Starting checkout with:', {
        companyId: company.id,
        billingPeriod,
        seatCount: totalSeats,
        pricePerMonth: monthlyPrice,
        adminSeats: seatChanges.adminSeats,
        juniorSeats: seatChanges.juniorSeats
      });
      
      // Call your Stripe checkout edge function with seat details
      const response = await supabase.functions.invoke('create-checkout-session', {
        body: {
          companyId: company.id,
          billingPeriod,
          seatCount: totalSeats,
          pricePerMonth: monthlyPrice,
          adminSeats: seatChanges.adminSeats,
          juniorSeats: seatChanges.juniorSeats,
          companyFinderEnabled,
          clientDataEnabled
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

  const { vat, total } = calculatePrice();

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

        {/* Seat Management */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Configure Your Seats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Admin Seats */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Admin Seats</p>
                <p className="text-gray-400 text-sm">Full dashboard access</p>
                {currentMembers.adminCount > 0 && (
                  <p className="text-xs text-purple-400 mt-1">
                    Currently have {currentMembers.adminCount} active admin(s)
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSeatChange('admin', -1)}
                  disabled={seatChanges.adminSeats <= 1 || seatChanges.adminSeats <= currentMembers.adminCount}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-white text-xl w-12 text-center">
                  {seatChanges.adminSeats}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSeatChange('admin', 1)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Junior Seats */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-medium">Junior Broker Seats</p>
                <p className="text-gray-400 text-sm">Calculator access only</p>
                {currentMembers.juniorCount > 0 && (
                  <p className="text-xs text-purple-400 mt-1">
                    Currently have {currentMembers.juniorCount} active junior broker(s)
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSeatChange('junior', -1)}
                  disabled={seatChanges.juniorSeats <= 0 || seatChanges.juniorSeats <= currentMembers.juniorCount}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-white text-xl w-12 text-center">
                  {seatChanges.juniorSeats}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSeatChange('junior', 1)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="border-t border-gray-700 pt-4 space-y-2">
              <div className="flex justify-between text-gray-400">
                <span>Total seats:</span>
                <span>{totalSeats}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Price per seat:</span>
                <span>
                  {billingPeriod === 'monthly' 
                    ? `£${pricePerSeat}/month`
                    : `£${annualPricePerSeat.toFixed(0)}/year`
                  }
                </span>
              </div>
              <div className="flex justify-between text-white font-semibold">
                <span>{billingPeriod === 'monthly' ? 'Monthly' : 'Annual'} price:</span>
                <span>
                  {billingPeriod === 'monthly' 
                    ? `£${monthlyPrice}`
                    : `£${(monthlyPrice * 12 * 0.9).toFixed(0)}`
                  }
                </span>
              </div>
              
              {/* Discount Tiers Info */}
              <div className="mt-4 p-3 bg-gray-800/50 rounded">
                <p className="text-purple-400 text-sm mb-2">Pricing Tiers:</p>
                <div className="space-y-1 text-sm">
                  <div className={`flex justify-between ${totalSeats <= 14 ? 'text-purple-300' : 'text-gray-500'}`}>
                    <span>1-14 seats:</span>
                    <span>
                      {billingPeriod === 'monthly' 
                        ? '£30/seat/month'
                        : '£324/seat/year'
                      }
                    </span>
                  </div>
                  <div className={`flex justify-between ${totalSeats >= 15 && totalSeats <= 29 ? 'text-purple-300' : 'text-gray-500'}`}>
                    <span>15-29 seats:</span>
                    <span>
                      {billingPeriod === 'monthly' 
                        ? '£27/seat/month (10% off)'
                        : '£291/seat/year (10% off)'
                      }
                    </span>
                  </div>
                  <div className={`flex justify-between ${totalSeats >= 30 ? 'text-purple-300' : 'text-gray-500'}`}>
                    <span>30+ seats:</span>
                    <span>
                      {billingPeriod === 'monthly' 
                        ? '£24/seat/month (20% off)'
                        : '£259/seat/year (20% off)'
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add-ons Section - Only show if seats selected */}
        {totalSeats > 0 && (
          <Card className="bg-gray-900/50 border-gray-800 mb-6">
            <CardHeader>
              <CardTitle className="text-white">Optional Add-ons</CardTitle>
              <p className="text-gray-400 text-sm mt-2">
                Enhance your subscription with powerful features
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Company Finder Add-on */}
              <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                <input
                  type="checkbox"
                  id="company-finder"
                  checked={companyFinderEnabled}
                  onChange={(e) => setCompanyFinderEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="company-finder" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-white font-semibold">Company Finder</h4>
                    <span className="text-purple-400 font-medium">
                      {billingPeriod === 'monthly' 
                        ? `+£${(5 * totalSeats).toFixed(0)}/month`
                        : `+£${addonPriceEach.toFixed(0)}/year`
                      }
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Unlimited AI-powered company search to expand your pipeline
                  </p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>• Unlimited company searches</li>
                    <li>• AI-powered similarity matching</li>
                    <li>• Lead management dashboard</li>
                    <li>• Export to Salesforce</li>
                  </ul>
                  <p className="text-xs text-purple-400 mt-2">
                    {billingPeriod === 'monthly' 
                      ? `£5/seat/month (× ${totalSeats} seats)`
                      : `£3/seat/month (× ${totalSeats} seats, billed annually with 10% discount)`
                    }
                  </p>
                </label>
              </div>

              {/* Client Data Tracking Add-on */}
              <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg hover:bg-gray-800/70 transition-colors">
                <input
                  type="checkbox"
                  id="client-data"
                  checked={clientDataEnabled}
                  onChange={(e) => setClientDataEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="client-data" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-white font-semibold">Client Data Tracking</h4>
                    <span className="text-purple-400 font-medium">
                      {billingPeriod === 'monthly' 
                        ? `+£${(5 * totalSeats).toFixed(0)}/month`
                        : `+£${addonPriceEach.toFixed(0)}/year`
                      }
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Automated monthly PDF reports with client analytics
                  </p>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>• Monthly PDF reports</li>
                    <li>• Per-client analytics</li>
                    <li>• Currency pair tracking</li>
                    <li>• Competitor analysis</li>
                  </ul>
                  <p className="text-xs text-purple-400 mt-2">
                    {billingPeriod === 'monthly' 
                      ? `£5/seat/month (× ${totalSeats} seats)`
                      : `£3/seat/month (× ${totalSeats} seats, billed annually with 10% discount)`
                    }
                  </p>
                </label>
              </div>

              {totalAddonsPrice > 0 && (
                <div className="p-3 bg-purple-900/20 border border-purple-600/30 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-purple-300 text-sm font-medium">
                      Total Add-ons:
                    </span>
                    <span className="text-purple-300 font-semibold">
                      {billingPeriod === 'monthly' 
                        ? `£${totalAddonsPrice.toFixed(0)}/month`
                        : `£${totalAddonsPrice.toFixed(0)}/year`
                      }
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                    £{monthlyPrice}/month
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
                    £{Math.round(monthlyPrice * 0.9)}/month
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
            {billingPeriod === 'monthly' ? (
              <>
                <div className="flex justify-between text-gray-400">
                  <span>{totalSeats} seats × 1 month</span>
                  <span>£{monthlyPrice.toFixed(2)}</span>
                </div>
                {companyFinderEnabled && (
                  <div className="flex justify-between text-gray-400">
                    <span>Company Finder ({totalSeats} seats)</span>
                    <span>£{(5 * totalSeats).toFixed(2)}</span>
                  </div>
                )}
                {clientDataEnabled && (
                  <div className="flex justify-between text-gray-400">
                    <span>Client Data Tracking ({totalSeats} seats)</span>
                    <span>£{(5 * totalSeats).toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between text-gray-400">
                  <span>{totalSeats} seats × 12 months</span>
                  <span>£{(monthlyPrice * 12).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-400">
                  <span>Annual discount on seats (10%)</span>
                  <span>-£{(monthlyPrice * 12 * 0.1).toFixed(2)}</span>
                </div>
                {companyFinderEnabled && (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>Company Finder ({totalSeats} seats × 12 months)</span>
                      <span>£{(3 * totalSeats * 12).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-400">
                      <span>Annual discount on add-on (10%)</span>
                      <span>-£{(3 * totalSeats * 12 * 0.1).toFixed(2)}</span>
                    </div>
                  </>
                )}
                {clientDataEnabled && (
                  <>
                    <div className="flex justify-between text-gray-400">
                      <span>Client Data Tracking ({totalSeats} seats × 12 months)</span>
                      <span>£{(3 * totalSeats * 12).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-400">
                      <span>Annual discount on add-on (10%)</span>
                      <span>-£{(3 * totalSeats * 12 * 0.1).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </>
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