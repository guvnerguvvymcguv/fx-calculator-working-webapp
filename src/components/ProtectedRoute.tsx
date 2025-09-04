import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      // Check if user is logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      // Check if user's company has active subscription
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      const { data: company } = await supabase
        .from('companies')
        .select('subscription_status, trial_ends_at')
        .eq('id', profile.company_id)
        .single();

      // Check if subscription is active or trial is still valid
      const now = new Date();
      const trialEndsAt = company?.trial_ends_at ? new Date(company.trial_ends_at) : null;
      
      if (company?.subscription_status === 'active' || 
          (company?.subscription_status === 'trialing' && trialEndsAt && trialEndsAt > now)) {
        setHasAccess(true);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
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

  if (!hasAccess) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
}