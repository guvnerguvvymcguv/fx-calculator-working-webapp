import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function SalesforceCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing...');
  
  useEffect(() => {
    handleCallback();
  }, []);
  
  const handleCallback = async () => {
    const code = searchParams.get('code');
    
    if (!code) {
      setStatus('Error: No authorization code received');
      setTimeout(() => navigate('/admin/salesforce-settings'), 3000);
      return;
    }
    
    // For now, we'll need to handle the token exchange through a Supabase Edge Function
    // Since we can't expose the client secret in the browser
    setStatus('Authorization successful! Redirecting...');
    
    // Store the code temporarily and redirect
    sessionStorage.setItem('sf_auth_code', code);
    navigate('/admin/salesforce-settings?authorized=true');
  };
  
  return (
    <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
      <div className="text-purple-300 text-xl">{status}</div>
    </div>
  );
}