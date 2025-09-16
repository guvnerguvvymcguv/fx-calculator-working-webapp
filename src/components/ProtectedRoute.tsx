import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
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

  useEffect(() => {
    checkAccess();
  }, [adminOnly]);

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
    // If account is locked due to expired trial, redirect to checkout
    if (isAccountLocked) {
      return <Navigate to="/checkout" replace />;
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