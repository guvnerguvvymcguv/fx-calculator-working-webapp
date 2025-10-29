import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isValidToken, setIsValidToken] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a recovery token in the URL
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const type = hashParams.get('type');
    
    if (accessToken && type === 'recovery') {
      setIsValidToken(true);
    } else {
      setError('Invalid or expired reset link. Please request a new password reset.');
    }
  }, []);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ 
      password: newPassword 
    });
    
    if (error) {
      setError(error.message);
    } else {
      alert('Password updated successfully!');
      navigate('/login');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
      <button
        onClick={() => navigate('/login')}
        className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>

      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border-white/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_16px_48px_rgba(168,85,247,0.2),0_24px_64px_rgba(59,130,246,0.1)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_20px_56px_rgba(168,85,247,0.3),0_28px_72px_rgba(59,130,246,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-white/20">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Reset Your Password</h2>
            
            {isValidToken ? (
              <form onSubmit={handlePasswordReset} className="space-y-6">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                    placeholder="Enter new password"
                    required
                    minLength={8}
                  />
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                    placeholder="Confirm new password"
                    required
                    minLength={8}
                  />
                </div>
                
                {error && (
                  <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                    {error}
                  </div>
                )}
                
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            ) : (
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Button 
                  onClick={() => navigate('/login')}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-3 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                >
                  Back to Login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
