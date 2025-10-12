import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

export default function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'junior' | null>(null);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const location = useLocation();  // ← Add this

  useEffect(() => {
    checkAccess();
  }, [adminOnly, location.pathname]);  // ← Add location.pathname

  const checkAccess = async () => {
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      console.log('ProtectedRoute - User:', user);
      
      if (!user) {
        console.log('ProtectedRoute - No user found');
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Get user profile with role
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id, role_type')
        .eq('id', user.id)
        .single();
      
      console.log('ProtectedRoute - Profile:', profile);
      console.log('ProtectedRoute - Profile Error:', profileError);

      if (!profile?.company_id) {
        console.log('ProtectedRoute - No company_id found');
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Store the user's role
      setUserRole(profile.role_type);

      // Check admin-only routes
      if (adminOnly && profile.role_type !== 'admin') {
        console.log('ProtectedRoute - Admin access required but user is:', profile.role_type);
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('subscription_status, trial_ends_at, subscription_active, account_locked')
        .eq('id', profile.company_id)
        .single();

      console.log('ProtectedRoute - Company:', company);
      console.log('ProtectedRoute - Company Error:', companyError);

      // Check if account is locked due to expired trial
      if (company?.account_locked === true) {
        console.log('ProtectedRoute - Account is LOCKED due to expired trial');
        setIsAccountLocked(true);
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Check if subscription is active or trial is still valid
      const now = new Date();
      const trialEndsAt = company?.trial_ends_at ? new Date(company.trial_ends_at) : null;
      
      console.log('ProtectedRoute - Subscription Status:', company?.subscription_status);
      console.log('ProtectedRoute - Subscription Active:', company?.subscription_active);
      console.log('ProtectedRoute - Trial Ends At:', trialEndsAt);
      console.log('ProtectedRoute - Now:', now);
      
      // Check if they have access (active subscription or valid trial)
      const hasValidSubscription = company?.subscription_active === true;
      const hasValidTrial = trialEndsAt && trialEndsAt > now;
      
      if (hasValidSubscription || hasValidTrial) {
        console.log('ProtectedRoute - Access GRANTED');
        setHasAccess(true);
      } else {
        console.log('ProtectedRoute - Access DENIED - No valid subscription or trial');
        setHasAccess(false);
      }
    } catch (error) {
      console.error('ProtectedRoute - Error checking access:', error);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Checking access...</div>
      </div>
    );
  }

  // Different redirects based on the reason for denial
  if (!hasAccess) {
    // If account is locked due to expired trial, show lock screen
    if (isAccountLocked) {
      return (
        <div className="min-h-screen bg-[#10051A] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-900/90 border border-gray-800 rounded-lg p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Account Locked</h1>
              <p className="text-gray-400 mb-6">
                Your subscription has ended. Please start a new subscription to regain access.
              </p>
            </div>
            
            <button 
              onClick={() => window.location.href = '/checkout'}
              className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              Start New Subscription
            </button>
          </div>
        </div>
      );
    }
    // If it's an admin-only route and user is junior, redirect to calculator
    if (adminOnly && userRole === 'junior') {
      return <Navigate to="/calculator" replace />;
    }
    // Otherwise redirect to pricing (no subscription or not logged in)
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}