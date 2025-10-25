import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Users, Shield, Minus, Plus, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CompanySignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const billingPeriod = searchParams.get('plan') || 'monthly';
  const invitationId = searchParams.get('invitation');
  
  // Invitation state
  const [invitation, setInvitation] = useState<any>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteError, setInviteError] = useState('');
  
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
  
  // Fetch invitation details if ID is present
  useEffect(() => {
    if (invitationId) {
      fetchInvitation();
    }
  }, [invitationId]);
  
  const fetchInvitation = async () => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select(`
          *,
          companies (
            id,
            name,
            domain
          )
        `)
        .eq('id', invitationId)
        .eq('status', 'pending')
        .single();
      
      if (error || !data) {
        setInviteError('Invalid or expired invitation');
        return;
      }
      
      setInvitation(data);
    } catch (error) {
      console.error('Error fetching invitation:', error);
      setInviteError('Failed to load invitation');
    }
  };
  
  const handleInvitedUserSignup = async () => {
    if (!invitation) return;
    
    setIsLoading(true);
    setInviteError('');
    
    try {
      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: invitePassword,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from signup');
      
      // Call the edge function to create the user profile with company assignment
const { error: profileError } = await supabase.functions.invoke(
  'create-user-profile',
  {
    body: {
      userId: authData.user.id,
      email: invitation.email,
      companyId: invitation.company_id,
      roleType: invitation.role,
      fullName: invitation.invitee_name,
      invitedBy: invitation.invited_by,
      invitedAt: invitation.created_at
    }
  }
);
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        // If profile already exists (409), try to sign in instead
        if (profileError.status === 409) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password: invitePassword
          });
          
          if (signInError) {
            setInviteError('Account already exists. Please use your existing password.');
            return;
          }
        } else {
          throw profileError;
        }
      }
      
      // Update invitation status
      const { error: inviteUpdateError } = await supabase
        .from('invitations')
        .update({ 
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitationId);
      
      if (inviteUpdateError) {
        console.error('Failed to update invitation:', inviteUpdateError);
      }
      
      // Sign in the user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: invitePassword
      });
      
      if (signInError) throw signInError;
      
      // Navigate based on role
      if (invitation.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/calculator');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      setInviteError(error.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };
  
  // If this is an invitation acceptance, show different UI
  if (invitationId && invitation) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-400" />
        </button>
        
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">
                Accept Invitation
              </CardTitle>
              <CardDescription className="text-gray-400">
                You've been invited to join {invitation.companies?.name}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="p-4 bg-gray-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Email</span>
                </div>
                <p className="text-white font-medium">{invitation.email}</p>
              </div>
              
              <div className="p-4 bg-gray-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Role</span>
                </div>
                <p className="text-white font-medium capitalize">{invitation.role} Broker</p>
              </div>
              
              <div>
                <Label className="text-gray-300">Create Password</Label>
                <Input
                  type="password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="mt-2 bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be 8+ characters with uppercase, lowercase, numbers, and special characters
                </p>
              </div>
              
              {inviteError && (
                <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <p className="text-sm text-red-400">{inviteError}</p>
                </div>
              )}
              
              <Button
                onClick={handleInvitedUserSignup}
                disabled={isLoading || !invitePassword}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                {isLoading ? 'Creating Account...' : 'Accept Invitation'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // If invitation ID provided but loading failed
  if (invitationId && inviteError) {
    return (
      <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
        <button
          onClick={() => navigate('/')}
          className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-400" />
        </button>
        
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">
                Invalid Invitation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 mb-4">{inviteError}</p>
              <Button
                onClick={() => navigate('/')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              >
                Return to Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  // Password validation function
  const validatePassword = (password: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (password.length < minLength) {
      return "Password must be at least 8 characters long";
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return "Password must contain uppercase, lowercase, numbers, and special characters";
    }
    return null;
  };
  
  const calculatePrice = () => {
    const totalSeats = adminSeats + juniorSeats;
    const basePrice = 30; // £30 per seat
    let discount = 0;
    
    if (totalSeats >= 30) {
      discount = 0.20; // 20% off
    } else if (totalSeats >= 15) {
      discount = 0.10; // 10% off
    }
    
    const pricePerSeat = basePrice * (1 - discount);
    const monthlyPrice = pricePerSeat * totalSeats;
    
    // Calculate annual price with 10% discount
    const annualPrice = monthlyPrice * 12 * 0.9;
    const annualMonthlyEquivalent = annualPrice / 12;
    
    return {
      pricePerSeat: pricePerSeat.toFixed(2),
      monthlyPrice: monthlyPrice.toFixed(2),
      annualPrice: annualPrice.toFixed(2),
      annualMonthlyEquivalent: annualMonthlyEquivalent.toFixed(2),
      discount: (discount * 100).toFixed(0),
      totalSeats
    };
  };
  
  const handleNext = () => {
    if (step === 1 && companyName && companyDomain) {
      setStep(2);
    } else if (step === 2) {
      // Validate password before moving to step 3
      const passwordError = validatePassword(adminPassword);
      if (passwordError) {
        alert(passwordError);
        return;
      }
      if (adminEmail && adminPassword && adminName) {
        setStep(3);
      }
    }
  };
  
  const handleCheckout = async () => {
    setIsLoading(true);
    const pricing = calculatePrice();
    
    try {
      // Sign up new user with ALL company metadata - trigger will handle company and profile creation
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminEmail,
        password: adminPassword,
        options: {
          data: {
            full_name: adminName,
            company_name: companyName,
            company_domain: companyDomain,
            admin_seats: adminSeats,
            junior_seats: juniorSeats,
            subscription_seats: pricing.totalSeats,
            price_per_month: parseFloat(pricing.monthlyPrice),
            discount_percentage: parseInt(pricing.discount),
            subscription_status: 'trialing',
            subscription_type: billingPeriod,
            subscription_active: true,
            trial_ends_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            role: 'admin',
          }
        }
      });
      
      if (authError) {
        // Check if user already exists error
        if (authError.message.includes('already registered')) {
          alert('This email is already registered. Please use a different email or sign in.');
          return;
        }
        throw authError;
      }
      
      if (!authData.user) {
        throw new Error('Failed to create user account');
      }
      
      // Sign in the user to establish a session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });
      
      if (signInError) throw signInError;
      
      // Navigate to admin dashboard (they're now signed in)
      // The database trigger has already created the company and profile
      navigate('/signup-success');
      
    } catch (error: any) {
      console.error('Detailed signup error:', error);
      
      // More specific error messages
      if (error.message?.includes('duplicate key')) {
        alert('A company with this name already exists. Please use a different company name.');
      } else if (error.message?.includes('violates check constraint')) {
        alert('Please ensure all fields are filled correctly.');
      } else {
        alert(`Error: ${error.message || 'Failed to create account. Please try again.'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const pricing = calculatePrice();
  const isAnnual = billingPeriod === 'annual';
  
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>
      
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-gradient-to-b from-purple-500/10 to-purple-500/5 backdrop-blur-xl border-purple-500/30 rounded-xl shadow-[0_0_32px_rgba(168,85,247,0.15),0_0_48px_rgba(168,85,247,0.1),0_0_64px_rgba(168,85,247,0.05),inset_0_1px_0_rgba(255,255,255,0.1)] border-t-purple-500/20">
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
                    className="mt-2 bg-gray-950/50 border border-transparent focus:border-white/20 hover:border-white/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-200"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Company Domain</Label>
                  <Input
                    value={companyDomain}
                    onChange={(e) => setCompanyDomain(e.target.value)}
                    placeholder="acmetrading.com"
                    className="mt-2 bg-gray-950/50 border border-transparent focus:border-white/20 hover:border-white/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-200"
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
                    className="mt-2 bg-gray-950/50 border border-transparent focus:border-white/20 hover:border-white/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-200"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Admin Email</Label>
                  <Input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="john@acmetrading.com"
                    className="mt-2 bg-gray-950/50 border border-transparent focus:border-white/20 hover:border-white/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-200"
                  />
                </div>
                
                <div>
                  <Label className="text-gray-300">Password</Label>
                  <Input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="mt-2 bg-gray-950/50 border border-transparent focus:border-white/20 hover:border-white/20 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-all duration-200"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must be 8+ characters with uppercase, lowercase, numbers, and special characters
                  </p>
                </div>
              </>
            )}
            
            {/* Step 3: Seat Selection */}
            {step === 3 && (
              <>
                <div className="space-y-4">
                  {/* Admin Seats */}
                  <div className="p-4 bg-gray-900/50 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)] border border-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-purple-400" />
                        <Label className="text-gray-300">Admin Seats</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAdminSeats(Math.max(1, adminSeats - 1))}
                          className="text-gray-400 hover:text-white"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-xl font-bold text-white w-12 text-center">
                          {adminSeats}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAdminSeats(adminSeats + 1)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Full access to admin dashboard and team management
                    </p>
                  </div>
                  
                  {/* Junior Seats */}
                  <div className="p-4 bg-gray-900/50 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)] border border-purple-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-400" />
                        <Label className="text-gray-300">Junior Broker Seats</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setJuniorSeats(Math.max(0, juniorSeats - 1))}
                          className="text-gray-400 hover:text-white"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="text-xl font-bold text-white w-12 text-center">
                          {juniorSeats}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setJuniorSeats(juniorSeats + 1)}
                          className="text-gray-400 hover:text-white"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Access to calculator and trading tools
                    </p>
                  </div>
                </div>
                
                {/* Pricing Summary */}
                <div className="p-4 bg-purple-900/30 border border-purple-500/30 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] ">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Seats</span>
                      <span className="text-white">{pricing.totalSeats}</span>
                    </div>
                    {pricing.discount !== "0" && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Volume Discount</span>
                        <span className="text-green-400">-{pricing.discount}%</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Price per Seat</span>
                      <span className="text-white">£{pricing.pricePerSeat}/mo</span>
                    </div>
                    {isAnnual && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Annual Discount</span>
                        <span className="text-green-400">-10%</span>
                      </div>
                    )}
                    <div className="border-t border-gray-700 pt-2 flex justify-between">
                      <span className="text-white font-semibold">
                        {isAnnual ? 'Total Annual' : 'Total Monthly'}
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-white">
                          {isAnnual ? `£${pricing.annualPrice}` : `£${pricing.monthlyPrice}`}
                        </span>
                        {isAnnual && (
                          <div className="text-xs text-gray-400">
                            £{pricing.annualMonthlyEquivalent}/month
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-center text-green-400 text-sm mt-2">
                      🎉 First 2 months FREE
                    </div>
                    {isAnnual && (
                      <div className="text-center text-gray-400 text-xs">
                        Billed annually after trial ends
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Pricing info */}
                <div className="text-xs text-gray-400 text-center">
                  <p>
                    {pricing.totalSeats >= 30 ? '20% Enterprise discount applied' : 
                     pricing.totalSeats >= 15 ? '10% Team discount applied' : 
                     'Standard pricing: £30 per seat/month'}
                  </p>
                  <p className="mt-1">Volume discounts: 15+ seats (10% off), 30+ seats (20% off)</p>
                  {isAnnual && (
                    <p className="mt-1">Annual billing: Additional 10% discount</p>
                  )}
                </div>
              </>
            )}
            
            {/* Navigation Buttons */}
            <div className="flex justify-between">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Back
                </Button>
              )}
              
              <div className="ml-auto">
                {step < 3 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    onClick={handleCheckout}
                    disabled={isLoading}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating Account...' : 'Start Free Trial'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}