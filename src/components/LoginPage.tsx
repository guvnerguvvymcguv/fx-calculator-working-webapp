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
      // Check if account is active before proceeding
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('is_active, role_type, role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError('Unable to verify account status');
        setIsLoading(false);
        return;
      }

      // Check if account is deactivated
      if (profile?.is_active === false) {
        // Sign them out immediately
        await supabase.auth.signOut();
        setError('Your account has been deactivated. Please contact your administrator to reactivate your account.');
        setIsLoading(false);
        return;
      }

      // Account is active, proceed with normal login flow
      authContext?.login();
      
      // Check user role if admin login selected
      if (loginType === 'admin') {
        console.log('Admin login attempted for user:', data.user.id);
        console.log('User profile role:', profile.role_type);
        
        // Check role from profile
        if (profile.role_type === 'admin' || profile.role === 'admin') {
          console.log('Admin access granted');
          navigate('/admin');
        } else {
          setError('You do not have admin access');
          setIsLoading(false);
          return;
        }
      } else {
        // Regular user login - could be admin or junior
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
      redirectTo: 'https://spreadchecker.co.uk/reset-password',
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
        <Card className="w-full max-w-md bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border-white/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_16px_48px_rgba(168,85,247,0.2),0_24px_64px_rgba(59,130,246,0.1)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_20px_56px_rgba(168,85,247,0.3),0_28px_72px_rgba(59,130,246,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-white/20">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Spread Checker</h1>
              <p className="text-gray-400">Sign in to access your account</p>
            </div>
            
            {/* Login Type Toggle */}
            <div className="flex justify-center mb-6">
              <div className="bg-gray-900/50 rounded-lg p-1 flex relative shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)] border border-white/10">
                {/* Sliding background indicator */}
                <div 
                  className="absolute top-1 bottom-1 bg-purple-600 rounded-md transition-all duration-300 ease-in-out shadow-[0_2px_8px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]"
                  style={{ 
                    width: 'calc(50% - 4px)',
                    left: loginType === 'admin' ? 'calc(50% + 2px)' : '0.25rem'
                  }}
                />
                
                <button
                  type="button"
                  onClick={() => setLoginType('user')}
                  className={`relative z-10 px-6 py-2 rounded-md transition-all duration-300 ${
                    loginType === 'user'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  User
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('admin')}
                  className={`relative z-10 px-6 py-2 rounded-md transition-all duration-300 ${
                    loginType === 'admin'
                      ? 'text-white'
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
                  className="w-full px-4 py-2 bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
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
                  className="w-full px-4 py-2 bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
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
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : `Sign In as ${loginType === 'admin' ? 'Admin' : 'User'}`}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?{' '}
                <a href="/pricing" className="text-purple-400 hover:text-purple-300 font-medium">
                  Sign Up
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