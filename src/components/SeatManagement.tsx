import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { Users, Trash2, AlertTriangle, CreditCard, Plus, Minus } from 'lucide-react';

export default function SeatManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id, role_type')
        .eq('id', user!.id)
        .single();

      // Only super_admin can manage seats
      if (profile?.role_type !== 'super_admin') {
        navigate('/admin');
        return;
      }

      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile!.company_id)
        .single();

      const { data: members } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile!.company_id)
        .neq('id', user!.id); // Don't show current user

      setCompanyData(company);
      setTeamMembers(members || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSeatChange = async (change: number) => {
    if (companyData.subscription_seats + change < teamMembers.length + 1) {
      alert('Cannot reduce seats below current team size');
      return;
    }

    try {
      setLoading(true);
      const newSeatCount = companyData.subscription_seats + change;
      
      await supabase
        .from('companies')
        .update({ 
          subscription_seats: newSeatCount,
          monthly_price: newSeatCount * 30 // £30 per seat
        })
        .eq('id', companyData.id);

      // Log the change
      await supabase.from('activity_logs').insert({
        company_id: companyData.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'seat_change',
        description: `Changed seats from ${companyData.subscription_seats} to ${newSeatCount}`,
        amount: change
      });

      await fetchData();
      alert(`Successfully ${change > 0 ? 'added' : 'removed'} ${Math.abs(change)} seat(s)`);
    } catch (error) {
      console.error('Error changing seats:', error);
      alert('Failed to update seats');
    } finally {
      setLoading(false);
    }
  };

  const removeSelectedUsers = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setLoading(true);
      
      // Remove users from the company
      for (const userId of selectedUsers) {
        await supabase
          .from('user_profiles')
          .update({ 
            company_id: null,
            role_type: null 
          })
          .eq('id', userId);

        // Deactivate their auth account
        await supabase.auth.admin.updateUserById(userId, {
          ban_duration: '876600h' // Effectively permanent ban
        });
      }

      // Log the removal
      await supabase.from('activity_logs').insert({
        company_id: companyData.id,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'users_removed',
        description: `Removed ${selectedUsers.length} user(s)`,
        amount: selectedUsers.length
      });

      setSelectedUsers([]);
      setShowConfirmDialog(false);
      await fetchData();
      alert(`Successfully removed ${selectedUsers.length} user(s)`);
    } catch (error) {
      console.error('Error removing users:', error);
      alert('Failed to remove users');
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyCost = () => {
    return companyData?.subscription_seats * 30;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Loading seat management...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Seat Management</h1>
          <p className="text-gray-400">Manage team size and billing</p>
        </div>

        {/* Current Plan */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Current Plan</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Seats</span>
                  <span className="text-white font-bold">{companyData?.subscription_seats}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Used Seats</span>
                  <span className="text-white font-bold">{teamMembers.length + 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Available</span>
                  <span className="text-green-400 font-bold">
                    {companyData?.subscription_seats - (teamMembers.length + 1)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-400" />
                <CardTitle className="text-white">Monthly Billing</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Price per Seat</span>
                  <span className="text-white">£30/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Monthly</span>
                  <span className="text-white font-bold text-2xl">
                    £{calculateMonthlyCost()}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Next billing date: {new Date(companyData?.trial_end_date).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Adjust Seats */}
        <Card className="bg-gray-900/50 border-gray-800 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Adjust Seat Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => handleSeatChange(-1)}
                disabled={companyData?.subscription_seats <= teamMembers.length + 1}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Minus className="h-4 w-4" />
              </Button>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {companyData?.subscription_seats}
                </div>
                <div className="text-sm text-gray-400">Total Seats</div>
              </div>

              <Button
                onClick={() => handleSeatChange(1)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4" />
              </Button>

              <div className="ml-8 text-gray-400">
                New monthly cost: £{(companyData?.subscription_seats * 30)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remove Users */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Team Members</CardTitle>
              {selectedUsers.length > 0 && (
                <Button
                  onClick={() => setShowConfirmDialog(true)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove {selectedUsers.length} User(s)
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {teamMembers.map((member) => (
                <div 
                  key={member.id} 
                  className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition ${
                    selectedUsers.includes(member.id) 
                      ? 'bg-red-900/30 border border-red-600' 
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                  onClick={() => toggleUserSelection(member.id)}
                >
                  <div>
                    <p className="text-white font-medium">{member.full_name || member.email}</p>
                    <p className="text-sm text-gray-400">{member.role_type}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(member.id)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Confirm Dialog */}
        {showConfirmDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="bg-gray-900 border-gray-700 max-w-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <CardTitle className="text-white">Confirm User Removal</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">
                  Are you sure you want to remove {selectedUsers.length} user(s)? 
                  They will lose access immediately and cannot be restored.
                </p>
                <div className="flex gap-4">
                  <Button
                    onClick={() => setShowConfirmDialog(false)}
                    variant="outline"
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={removeSelectedUsers}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Remove Users
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}