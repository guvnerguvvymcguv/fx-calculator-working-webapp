import { useState, useContext, useEffect } from 'react';
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

  // Check for success messages in URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'success') {
      setSuccessMessage('Password reset successful. Please sign in with your new password.');
    }
  }, []);

  // Function to setup company and profile after first login
  const setupCompanyAndProfile = async (user: any) => {
    try {
      const metadata = user.user_metadata;
      
      // Check if setup is needed
      if (!metadata.needs_setup) {
        return; // Setup already done
      }
      
      // Check if company already exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
      
      if (existingProfile?.company_id) {
        // Already setup
        return;
      }
      
      // Create company from metadata
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: metadata.company_name,
          domain: metadata.company_domain,
          admin_seats: metadata.admin_seats,
          junior_seats: metadata.junior_seats,
          subscription_seats: metadata.subscription_seats,
          price_per_month: metadata.price_per_month,
          discount_percentage: metadata.discount_percentage,
          subscription_status: metadata.subscription_status || 'trialing',
          trial_ends_at: metadata.trial_ends_at
        })
        .select()
        .single();
      
      if (companyError) {
        console.error('Company creation error:', companyError);
        throw companyError;
      }
      
      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          company_id: company.id,
          role: metadata.role || 'admin',
          role_type: metadata.role_type || 'super_admin',
          full_name: metadata.full_name
        });
      
      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw profileError;
      }
      
      // Update user metadata to mark setup as complete
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          ...metadata,
          needs_setup: false
        }
      });
      
      if (updateError) {
        console.error('Failed to update user metadata:', updateError);
      }
      
      console.log('Company and profile setup completed successfully');
      
    } catch (error) {
      console.error('Setup error:', error);
      // Don't block login, but log the error
    }
  };

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
      // Setup company and profile if needed (for first login after email confirmation)
      await setupCompanyAndProfile(data.user);
      
      authContext?.login();
      
      // Check user role if admin login selected
      if (loginType === 'admin') {
        console.log('Admin login attempted for user:', data.user.id);
        console.log('User metadata:', data.user.user_metadata);
        
        // Check role from user metadata first (avoids RLS issues)
        const metadataRole = data.user.user_metadata?.role || data.user.user_metadata?.role_type;
        
        if (metadataRole && ['admin', 'super_admin'].includes(metadataRole)) {
          console.log('Admin access granted via metadata');
          navigate('/admin');
        } else {
          // Fallback: Try direct database query with .rpc() to bypass RLS
          try {
            const { data: roleData, error: roleError } = await supabase.rpc('get_user_role', {
              user_id: data.user.id
            });
            
            console.log('RPC role check:', roleData, roleError);
            
            if (roleData && ['admin', 'super_admin'].includes(roleData)) {
              navigate('/admin');
            } else {
              setError('You do not have admin access');
              setIsLoading(false);
              return;
            }
          } catch (err) {
            console.error('Role check failed:', err);
            setError('Unable to verify admin access');
            setIsLoading(false);
            return;
          }
        }
      } else {
        navigate('/calculator');
      }
      setIsLoading(false);
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