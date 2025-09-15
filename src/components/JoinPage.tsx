import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, User, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function JoinPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [company, setCompany] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }
    verifyInvitation();
  }, [token]);

  const verifyInvitation = async () => {
    try {
      // Fetch invitation details
      const { data: invite, error: inviteError } = await supabase
        .from('invitations')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !invite) {
        setError('Invalid or expired invitation');
        setLoading(false);
        return;
      }

      if (invite.status === 'accepted') {
        setError('This invitation has already been used');
        setLoading(false);
        return;
      }

      // Check if invitation is expired (7 days)
      const createdAt = new Date(invite.created_at);
      const now = new Date();
      const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceCreation > 7) {
        setError('This invitation has expired');
        setLoading(false);
        return;
      }

      // Fetch company details
      const { data: companyData } = await supabase
        .from('companies')
        .select('name')
        .eq('id', invite.company_id)
        .single();

      setCompany(companyData);
      setInvitation(invite);
    } catch (err) {
      setError('Error verifying invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create user account
      const { error: authError } = await supabase.auth.signUp({
        email: invitation.email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            company_id: invitation.company_id,
            role_type: invitation.role_type,
            invited_by: invitation.invited_by,
            full_name: firstName.trim()
          }
        }
      });

      if (authError) throw authError;

      // Immediately sign in to confirm the user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invitation.email,
        password: password
      });

      if (signInError) throw signInError;

      if (signInData.user) {
        // Call Edge Function to create profile (bypasses RLS)
        const { error: profileError } = await supabase.functions.invoke('create-user-profile', {
          body: {
            userId: signInData.user.id,
            email: invitation.email,
            companyId: invitation.company_id,
            roleType: invitation.role_type,
            fullName: firstName.trim()
          }
        });

        if (profileError) throw profileError;

        // Update invitation status
        await supabase
          .from('invitations')
          .update({ 
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('token', token);

        // Navigate based on role
        if (invitation.role_type === 'admin') {
          navigate('/admin');
        } else {
          navigate('/calculator');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Verifying invitation...</div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
          <CardContent className="p-8 text-center">
            <div className="text-red-400 mb-4">{error}</div>
            <Button 
              onClick={() => navigate('/')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#10051A' }}>
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>

      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-white mb-2">Join {company?.name || 'Spread Checker'}</h1>
              <p className="text-gray-400">Create your account to get started</p>
            </div>

            {/* Role Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-600/50 rounded-lg">
                {invitation?.role_type === 'admin' ? (
                  <>
                    <Shield className="h-4 w-4 text-purple-400" />
                    <span className="text-purple-300 font-medium">Admin Account</span>
                  </>
                ) : (
                  <>
                    <User className="h-4 w-4 text-purple-400" />
                    <span className="text-purple-300 font-medium">Junior Broker Account</span>
                  </>
                )}
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-6">
              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2">
                  Email
                </Label>
                <div className="relative">
                  <Input
                    type="email"
                    value={invitation?.email || ''}
                    disabled
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">This email was invited to join the team</p>
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2">
                  First Name
                </Label>
                <Input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2">
                  Password
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Create a password"
                  required
                  minLength={8}
                />
              </div>

              <div>
                <Label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Confirm your password"
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
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Already have an account?{' '}
                <a href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
                  Sign In
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}