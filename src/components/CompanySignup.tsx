import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Users, Shield, Minus, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CompanySignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Company details
  const [companyName, setCompanyName] = useState('');
  const [companyDomain, setCompanyDomain] = useState('');
  
  // Admin details
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  
  // Seat selection
  const [adminSeats, setAdminSeats] = useState(1);
  const [juniorSeats, setJuniorSeats] = useState(5);
  
  // Password validation function
  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
      return 'Password must be at least 8 characters long';
    }
    if (!hasUpperCase || !hasLowerCase) {
      return 'Password must contain both uppercase and lowercase letters';
    }
    if (!hasNumbers) {
      return 'Password must contain at least one number';
    }
    if (!hasSpecialChar) {
      return 'Password must contain at least one special character';
    }
    return null;
  };
  
  const calculatePrice = () => {
    const totalSeats = adminSeats + juniorSeats;
    const pricePerSeat = 30;
    let discount = '0';
    
    if (totalSeats >= 30) {
      discount = '20';
    } else if (totalSeats >= 15) {
      discount = '10';
    }
    
    const basePrice = totalSeats * pricePerSeat;
    const discountAmount = basePrice * (parseInt(discount) / 100);
    const totalPrice = (basePrice - discountAmount).toFixed(2);
    
    return { totalSeats, discount, totalPrice };
  };
  
  const handleNext = () => {
    if (step === 1) {
      if (!companyName || !companyDomain) {
        alert('Please fill in all company details');
        return;
      }
    } else if (step === 2) {
      if (!adminEmail || !adminPassword || !adminName) {
        alert('Please fill in all admin details');
        return;
      }
      const passwordError = validatePassword(adminPassword);
      if (passwordError) {
        alert(passwordError);
        return;
      }
    }
    setStep(step + 1);
  };
  
  const handleCreateAccount = async () => {
    setIsLoading(true);
    
    try {
      const pricing = calculatePrice();
      
      console.log('Attempting signup for:', adminEmail);

      // ONLY create auth user with all metadata - trigger will handle the rest
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            // User metadata
            full_name: adminName,
            role: 'admin',
            role_type: 'super_admin',
            
            // Company metadata for trigger to use
            company_name: companyName,
            company_domain: companyDomain,
            admin_seats: adminSeats,
            junior_seats: juniorSeats,
            subscription_seats: pricing.totalSeats,
            price_per_month: parseFloat(pricing.totalPrice),
            discount_percentage: parseInt(pricing.discount),
            subscription_status: 'trialing',
            trial_ends_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
          }
        }
      });

      console.log('Signup response:', authData, authError);
      
      if (authError) {
        if (authError.message.includes('already registered')) {
          alert('This email is already registered. Please use a different email or sign in.');
          return;
        }
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('Failed to create user account');
      }
      
      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });
      
      if (signInError) {
        console.error('Sign in error:', signInError);
        throw new Error('Account created but could not sign in. Please try logging in manually.');
      }
      
      // Success! Database trigger will create company and profile
      // Navigate to admin dashboard
      navigate('/admin');
      
    } catch (error: any) {
      console.error('Signup error:', error);
      alert(`Error: ${error.message || 'Failed to create account. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const pricing = calculatePrice();
  
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>
      
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-gray-900/90 border-gray-800">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-white">
              {step === 1 && "Company Information"}
              {step === 2 && "Admin Account"}
              {step === 3 && "Select Your Plan"}
            </CardTitle>
            <CardDescription className="text-gray-400">
              Step {step} of 3 - {step === 3 ? "2 months free trial included" : "Set up your company account"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Step 1: Company Details */}
            {step === 1 && (
              <>
                <div>
                  <Label className="text-gray-300">Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Trading Ltd"
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Company Domain</Label>
                  <Input
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="acmetrading.com"
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used to verify employee email addresses
                  </p>
                </div>
              </>
            )}
            
            {/* Step 2: Admin Account */}
            {step === 2 && (
              <>
                <div>
                  <Label className="text-gray-300">Admin Name</Label>
                  <Input
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="John Smith"
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Admin Email</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="john@acmetrading.com"
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Password</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="mt-2 bg-gray-800 border-gray-700 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must be at least 8 characters with uppercase, lowercase, numbers, and special characters
                  </p>
                </div>
              </>
            )}
            
            {/* Step 3: Seat Selection */}
            {step === 3 && (
              <div className="space-y-8">
                {/* Admin Seats */}
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-purple-400" />
                      <div>
                        <h3 className="text-white font-medium">Admin Seats</h3>
                        <p className="text-gray-400 text-sm">Full access to admin dashboard and team management</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setAdminSeats(Math.max(1, adminSeats - 1))}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <Minus className="h-4 w-4 text-gray-300" />
                      </button>
                      <span className="text-white font-medium w-10 text-center">{adminSeats}</span>
                      <button
                        onClick={() => setAdminSeats(adminSeats + 1)}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <Plus className="h-4 w-4 text-gray-300" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Junior Broker Seats */}
                <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-purple-400" />
                      <div>
                        <h3 className="text-white font-medium">Junior Broker Seats</h3>
                        <p className="text-gray-400 text-sm">Access to calculator and trading tools</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setJuniorSeats(Math.max(0, juniorSeats - 1))}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <Minus className="h-4 w-4 text-gray-300" />
                      </button>
                      <span className="text-white font-medium w-10 text-center">{juniorSeats}</span>
                      <button
                        onClick={() => setJuniorSeats(juniorSeats + 1)}
                        className="p-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <Plus className="h-4 w-4 text-gray-300" />
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Pricing Summary */}
                <div className="bg-purple-900/20 rounded-lg p-6 border border-purple-800/50">
                  <div className="space-y-3">
                    <div className="flex justify-between text-gray-400">
                      <span>Total Seats</span>
                      <span className="text-white font-medium">{pricing.totalSeats}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Price per Seat</span>
                      <span className="text-white">£30.00/mo</span>
                    </div>
                    {pricing.discount !== '0' && (
                      <div className="flex justify-between text-green-400">
                        <span>Volume Discount</span>
                        <span>{pricing.discount}% off</span>
                      </div>
                    )}
                    <div className="border-t border-gray-700 pt-3">
                      <div className="flex justify-between">
                        <span className="text-white font-medium">Total Monthly</span>
                        <span className="text-2xl font-bold text-white">£{pricing.totalPrice}</span>
                      </div>
                    </div>
                    <div className="text-center text-purple-300 text-sm mt-4">
                      🎉 First 2 months FREE
                    </div>
                  </div>
                </div>
                
                {/* Pricing Tiers Info */}
                <div className="text-center text-gray-500 text-xs">
                  <p>Standard pricing: £30 per seat/month</p>
                  <p>Volume discounts: 15+ seats (10% off), 30+ seats (20% off)</p>
                </div>
              </div>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1}
                className="bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
              >
                Back
              </Button>
              
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={handleCreateAccount}
                  disabled={isLoading}
                  className="bg-purple-600 hover:bg-purple-700 text-white min-w-[150px]"
                >
                  {isLoading ? 'Creating Account...' : 'Start Free Trial'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}