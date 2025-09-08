import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Handle the hash fragment from Supabase
    const hash = window.location.hash;
    
    if (hash && hash.includes('type=recovery')) {
      // This is a password reset link
      // Supabase will handle the session automatically
      navigate('/reset-password', { replace: true });
    } else {
      // Redirect to home if no valid hash
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
      <div className="text-purple-300">Processing...</div>
    </div>
  );
}