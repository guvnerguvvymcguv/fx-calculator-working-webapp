import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SalesforceCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');
  
  useEffect(() => {
    handleCallback();
  }, []);
  
  const handleCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    if (!code) {
      setStatus('Error: No authorization code received');
      setTimeout(() => navigate('/admin/salesforce-settings'), 3000);
      return;
    }
    
    // Verify state parameter for CSRF protection
    const storedState = sessionStorage.getItem('sf_oauth_state');
    if (state !== storedState) {
      setStatus('Error: Invalid state parameter');
      setTimeout(() => navigate('/admin/salesforce-settings'), 3000);
      return;
    }
    
    // Get the PKCE code verifier
    const codeVerifier = sessionStorage.getItem('sf_code_verifier');
    
    if (!codeVerifier) {
      setStatus('Error: Missing code verifier');
      setTimeout(() => navigate('/admin/salesforce-settings'), 3000);
      return;
    }
    
    setStatus('Completing authorization...');
    
    try {
      // Exchange the code for tokens
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('salesforce-token-exchange', {
        body: { 
          code,
          redirectUri: `${window.location.origin}/salesforce-callback`,
          codeVerifier // Pass the PKCE code verifier
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }
      
      // Clean up session storage
      sessionStorage.removeItem('sf_oauth_state');
      sessionStorage.removeItem('sf_code_verifier');
      sessionStorage.removeItem('sf_auth_code');
      
      setStatus('Successfully connected to Salesforce!');
      setTimeout(() => navigate('/admin/salesforce-settings'), 2000);
      
    } catch (error) {
      console.error('Token exchange error:', error);
      setStatus('Failed to complete connection. Please try again.');
      setTimeout(() => navigate('/admin/salesforce-settings'), 3000);
    }
  };
  
  return (
    <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
      <div className="text-purple-300 text-xl">{status}</div>
    </div>
  );
}