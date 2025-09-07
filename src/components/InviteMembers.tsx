import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { ArrowLeft, Mail, Users, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function InviteMembers() {
  const navigate = useNavigate();
  const [emails, setEmails] = useState<string[]>(['']);
  const [roleType, setRoleType] = useState<'junior' | 'admin'>('junior');
  const [loading, setLoading] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [availableSeats, setAvailableSeats] = useState(0);
  const [invitations, setInvitations] = useState<any[]>([]);

  useEffect(() => {
    fetchCompanyData();
    fetchInvitations();
  }, []);

  const fetchCompanyData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', profile!.company_id)
      .single();

    const { data: members } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('company_id', profile!.company_id);

    const usedSeats = members?.length || 0;
    const totalSeats = company?.subscription_seats || 0;
    
    setCompanyData(company);
    setAvailableSeats(totalSeats - usedSeats);
  };

  const fetchInvitations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    const { data: invites } = await supabase
      .from('invitations')
      .select('*')
      .eq('company_id', profile!.company_id)
      .order('created_at', { ascending: false });

    setInvitations(invites || []);
  };

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const generateInviteToken = () => {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const sendInvitations = async () => {
    setLoading(true);
    const validEmails = emails.filter(email => email && email.includes('@'));
    
    if (validEmails.length === 0) {
      alert('Please enter at least one valid email address');
      setLoading(false);
      return;
    }

    if (validEmails.length > availableSeats) {
      alert(`You only have ${availableSeats} seats available`);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      for (const email of validEmails) {
        const token = generateInviteToken();
        
        // Save invitation to database
        await supabase.from('invitations').insert({
          company_id: companyData.id,
          invited_by: user!.id,
          email: email,
          role_type: roleType,
          token: token,
          status: 'pending'
        });

        // In production, this would trigger an email through your email service
        // For now, we'll just log the invite link
        console.log(`Invite link for ${email}: ${window.location.origin}/join?token=${token}`);
      }

      alert(`Successfully sent ${validEmails.length} invitation(s)`);
      setEmails(['']);
      fetchInvitations();
    } catch (error) {
      console.error('Error sending invitations:', error);
      alert('Failed to send invitations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/admin')}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Invite Team Members</h1>
            <p className="text-gray-400">Send invitations to join your team</p>
          </div>
        </div>

        {/* Available Seats Alert */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-purple-400" />
                <div>
                  <p className="text-white font-semibold">Available Seats</p>
                  <p className="text-sm text-gray-400">You can invite up to {availableSeats} more team members</p>
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-400">{availableSeats}</div>
            </div>
          </CardContent>
        </Card>

        {/* Invitation Form */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-white">New Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Role Selection */}
            <div>
              <Label className="text-gray-300">Member Role</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  type="button"
                  onClick={() => setRoleType('junior')}
                  variant={roleType === 'junior' ? 'default' : 'outline'}
                  className={roleType === 'junior' 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                >
                  Junior Broker
                </Button>
                <Button
                  type="button"
                  onClick={() => setRoleType('admin')}
                  variant={roleType === 'admin' ? 'default' : 'outline'}
                  className={roleType === 'admin' 
                    ? 'bg-purple-600 hover:bg-purple-700' 
                    : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                >
                  Admin
                </Button>
              </div>
            </div>

            {/* Email Fields */}
            <div>
              <Label className="text-gray-300">Email Addresses</Label>
              <div className="space-y-2 mt-2">
                {emails.map((email, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => updateEmail(index, e.target.value)}
                      placeholder="colleague@company.com"
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    {emails.length > 1 && (
                      <Button
                        type="button"
                        onClick={() => removeEmailField(index)}
                        variant="outline"
                        size="sm"
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <Button
                type="button"
                onClick={addEmailField}
                variant="outline"
                className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Email
              </Button>
            </div>

            {/* Send Button */}
            <Button
              onClick={sendInvitations}
              disabled={loading || availableSeats === 0}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
            >
              <Mail className="h-4 w-4 mr-2" />
              {loading ? 'Sending...' : 'Send Invitations'}
            </Button>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-xl text-white">Invitation History</CardTitle>
          </CardHeader>
          <CardContent>
            {invitations.length > 0 ? (
              <div className="space-y-2">
                {invitations.map((invite) => (
                  <div key={invite.id} className="flex justify-between items-center p-3 bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-white">{invite.email}</p>
                      <p className="text-xs text-gray-400">
                        {invite.role_type} • {invite.status} • 
                        {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      invite.status === 'accepted' ? 'bg-green-600' : 
                      invite.status === 'expired' ? 'bg-red-600' : 'bg-yellow-600'
                    } text-white`}>
                      {invite.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-4">No invitations sent yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}