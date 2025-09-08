import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { ArrowLeft } from 'lucide-react';
import { signIn } from '../lib/auth';
import { AuthContext } from '../App';
import { supabase } from '../lib/supabase';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginType, setLoginType] = useState<'user' | 'admin'>('user');
  const [successMessage, setSuccessMessage] = useState('');
  
  const navigate = useNavigate();
  const authContext = useContext(AuthContext);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password');
      setIsLoading(false);
      return;
    }

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setIsLoading(false);
    } else if (data.user) {
      authContext?.login();
      
      // Check user role if admin login selected
      if (loginType === 'admin') {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role_type')
          .eq('id', data.user.id)
          .single();
        
        if (profile && ['admin', 'super_admin'].includes(profile.role_type)) {
          navigate('/admin');
        } else {
          setError('You do not have admin access');
          setIsLoading(false);
          return;
        }
      } else {
        navigate('/calculator');
      }
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccessMessage('');
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://spreadchecker.co.uk/auth',  // Changed to /auth
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccessMessage('Password reset email sent! Check your inbox.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
        aria-label="Back to homepage"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>

      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Spread Checker</h1>
              <p className="text-gray-400">Sign in to access your account</p>
            </div>
            
            {/* Login Type Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-gray-800 p-1 rounded-lg flex">
                <button
                  type="button"
                  onClick={() => setLoginType('user')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    loginType === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('admin')}
                  className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                    loginType === 'admin'
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Admin
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="you@company.com"
                  disabled={isLoading}
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="bg-green-900/20 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg text-sm">
                  {successMessage}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500" 
                    checked
                    disabled
                  />
                  <span className="ml-2 text-sm text-gray-400">You'll stay signed in for 7 days</span>
                </div>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-sm text-purple-400 hover:text-purple-300"
                >
                  Forgot password?
                </button>
              </div>
              
              <Button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : `Sign In as ${loginType === 'admin' ? 'Admin' : 'User'}`}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?{' '}
                <a href="/signup" className="text-purple-400 hover:text-purple-300 font-medium">
                  Contact Sales
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;