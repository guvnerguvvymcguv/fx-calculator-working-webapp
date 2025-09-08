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
        <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Reset Your Password</h2>
            
            {isValidToken ? (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter new password"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Confirm new password"
                    required
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
                  className="w-full bg-purple-600 hover:bg-purple-700 py-3"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            ) : (
              <div className="text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <Button 
                  onClick={() => navigate('/login')}
                  className="bg-purple-600 hover:bg-purple-700"
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