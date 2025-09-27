import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Users, Plus, Minus, AlertCircle, Clock, Trash2, UserX, UserCheck, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import CancelSubscriptionModal from './CancelSubscriptionModal';

export default function AccountManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [seatChanges, setSeatChanges] = useState({
    adminSeats: 0,
    juniorSeats: 0
  });

  useEffect(() => {
    fetchAccountData();
  }, []);

  const fetchAccountData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id, role_type')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id || profile.role_type !== 'admin') {
        navigate('/admin');
        return;
      }

      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      // Fetch all members including inactive ones
      const { data: members } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('is_active', { ascending: false })
        .order('full_name');

      // Only count active members for seat calculation
      const adminCount = members?.filter(m => m.role_type === 'admin' && (m.is_active !== false)).length || 0;
      const juniorCount = members?.filter(m => m.role_type === 'junior' && (m.is_active !== false)).length || 0;
      const actualUsedSeats = adminCount + juniorCount;
      const totalSeats = companyData?.subscription_seats || 0;

      // Calculate trial status
      const now = new Date();
      const trialEndsAt = companyData?.trial_ends_at ? new Date(companyData.trial_ends_at) : null;
      const isInTrial = trialEndsAt && trialEndsAt > now && !companyData?.subscription_active;
      const daysLeftInTrial = isInTrial ? Math.floor((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Get allocated seats from company data if available, otherwise calculate from total
      let allocatedAdminSeats = companyData?.admin_seats || 0;
      let allocatedJuniorSeats = companyData?.junior_seats || 0;
      
      // If no allocation stored, default to current usage or distribute the total seats
      if (allocatedAdminSeats === 0 && allocatedJuniorSeats === 0) {
        if (totalSeats > 0) {
          // If we have seats but no allocation, use current members as baseline
          allocatedAdminSeats = Math.max(1, adminCount); // At least 1 admin
          allocatedJuniorSeats = totalSeats - allocatedAdminSeats;
        } else {
          // Default for new setup
          allocatedAdminSeats = 1;
          allocatedJuniorSeats = 10;
        }
      }

      setCompany({
        ...companyData,
        currentAdminSeats: adminCount,
        currentJuniorSeats: juniorCount,
        currentTotalSeats: totalSeats,
        actualUsedSeats: actualUsedSeats,
        remainingSeats: totalSeats - actualUsedSeats,
        isInTrial,
        daysLeftInTrial,
        trialEndsAt
      });
      
      // Initialize seat changes to current allocation
      setSeatChanges({
        adminSeats: allocatedAdminSeats,
        juniorSeats: allocatedJuniorSeats
      });

      setTeamMembers(members || []);
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (totalSeats: number) => {
    if (totalSeats <= 14) return totalSeats * 30;
    if (totalSeats <= 29) return totalSeats * 27;
    return totalSeats * 24;
  };

  const getPricePerSeat = (totalSeats: number) => {
    if (totalSeats <= 14) return 30;
    if (totalSeats <= 29) return 27;
    return 24;
  };

  const handleSeatChange = (type: 'admin' | 'junior', change: number) => {
    setSeatChanges(prev => {
      const newValue = type === 'admin' 
        ? Math.max(1, prev.adminSeats + change) // At least 1 admin
        : Math.max(0, prev.juniorSeats + change);
      
      return {
        ...prev,
        [type === 'admin' ? 'adminSeats' : 'juniorSeats']: newValue
      };
    });
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      const totalNewSeats = seatChanges.adminSeats + seatChanges.juniorSeats;
      const newPrice = calculatePrice(totalNewSeats);

      console.log('Attempting to save:', {
        adminSeats: seatChanges.adminSeats,
        juniorSeats: seatChanges.juniorSeats,
        totalNewSeats,
        newPrice,
        companyId: company.id
      });

      // Update company subscription seats and allocation in database
      const { data, error: companyError } = await supabase
        .from('companies')
        .update({
          subscription_seats: totalNewSeats,
          subscription_price: newPrice,
          admin_seats: seatChanges.adminSeats,
          junior_seats: seatChanges.juniorSeats,
          updated_at: new Date().toISOString()
        })
        .eq('id', company.id)
        .select();

      if (companyError) {
        console.error('Database update FAILED:', companyError);
        alert(`Database update failed: ${companyError.message}\n\nDetails: ${JSON.stringify(companyError.details)}\n\nHint: ${companyError.hint}`);
        throw companyError;
      }

      if (!data || data.length === 0) {
        console.error('No rows updated - check if company ID exists:', company.id);
        alert('No rows were updated. The company ID might not exist.');
        throw new Error('No rows updated');
      }

      console.log('Database update successful:', data);
      
      // Customize alert message based on subscription type
      let alertMessage = `Successfully updated!\n\nNew allocation:\n- Admin seats: ${seatChanges.adminSeats}\n- Junior seats: ${seatChanges.juniorSeats}\n- Total: ${totalNewSeats} seats`;
      
      if (company.isInTrial) {
        alertMessage += `\n- Price: £${newPrice}/month\n\n* Billing will start after your trial ends`;
      } else if (company.subscription_type === 'monthly') {
        alertMessage += `\n- New price: £${newPrice}/month\n\n* Your next monthly payment will reflect this change`;
      } else if (company.subscription_type === 'annual') {
        alertMessage += `\n\n* Seats updated for your annual subscription`;
      }
      
      alert(alertMessage);

      // Only update Stripe if they're on active monthly subscription
      if (company.subscription_active && company.subscription_type === 'monthly') {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await supabase.functions.invoke('update-subscription', {
          body: { 
            companyId: company.id,
            newSeatCount: totalNewSeats,
            newPrice: newPrice
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          }
        });

        if (response.error) {
          console.error('Stripe update error:', response.error);
          // Don't throw - database is already updated
          alert('Note: Seats updated in database but Stripe subscription update failed. Please contact support.');
        }
      }
      
      await fetchAccountData();
    } catch (error) {
      console.error('Error in handleSaveChanges:', error);
      alert(`Failed to update subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (memberId: string) => {
    console.log('removeMember called with ID:', memberId);
    
    if (!confirm('Are you sure you want to permanently delete this member? This will also delete all their activity history. This action cannot be undone.')) {
      console.log('User cancelled deletion');
      return;
    }

    console.log('User confirmed deletion, proceeding...');

    try {
      // First, delete all activity logs for this user
      console.log('Deleting activity logs for user...');
      const { data: logsData, error: logsError } = await supabase
        .from('activity_logs')
        .delete()
        .eq('user_id', memberId)
        .select();

      if (logsError) {
        console.error('Error deleting activity logs:', logsError);
        console.error('Activity logs error details:', {
          message: logsError.message,
          details: logsError.details,
          hint: logsError.hint,
          code: logsError.code
        });
        throw logsError;
      }

      console.log(`Deleted ${logsData?.length || 0} activity log entries`);

      // Now delete the user profile
      console.log('Attempting to delete member from user_profiles...');
      const { data, error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', memberId)
        .select();

      console.log('Delete response - Data:', data);
      console.log('Delete response - Error:', error);

      if (error) {
        console.error('Delete error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('Member removed successfully, refreshing data...');
      alert('Member and all activity history removed successfully');
      await fetchAccountData();
    } catch (error) {
      console.error('Error removing member - Full error object:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to remove member: ${errorMessage}`);
    }
  };

  const toggleUserStatus = async (memberId: string, isActive: boolean) => {
    const action = isActive ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} this member?`)) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: !isActive })
        .eq('id', memberId);

      if (error) throw error;
      
      alert(`Member ${action}d successfully`);
      await fetchAccountData();
    } catch (error) {
      console.error(`Error ${action}ing member:`, error);
      alert(`Failed to ${action} member`);
    }
  };

  const changeUserRole = async (memberId: string, newRole: 'admin' | 'junior') => {
    // Check if there would still be at least one admin
    if (newRole === 'junior') {
      const adminCount = teamMembers.filter(m => m.role_type === 'admin' && m.id !== memberId && (m.is_active !== false)).length;
      if (adminCount === 0) {
        alert('Cannot change role: At least one active admin is required');
        return;
      }
    }

    if (!confirm(`Are you sure you want to change this user to ${newRole}?`)) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role_type: newRole })
        .eq('id', memberId);

      if (error) throw error;
      
      alert('Role updated successfully');
      await fetchAccountData();
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  const sendPasswordReset = async (email: string, memberName: string) => {
    if (!confirm(`Send password reset email to ${memberName}?`)) return;

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      alert(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset:', error);
      alert('Failed to send password reset email');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Loading account data...</div>
      </div>
    );
  }

  const totalNewSeats = seatChanges.adminSeats + seatChanges.juniorSeats;
  const currentPrice = calculatePrice(company.currentTotalSeats);
  const newPrice = calculatePrice(totalNewSeats);
  const priceDifference = newPrice - currentPrice;
  const pricePerSeat = getPricePerSeat(totalNewSeats);
  const isChangingSeats = totalNewSeats !== company.currentTotalSeats;

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
            <h1 className="text-3xl font-bold text-white">Account Management</h1>
            <p className="text-gray-400">Manage seats and subscription</p>
          </div>
        </div>

        {/* Trial Status Notice */}
        {company?.isInTrial && (
          <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-700 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-400" />
                  <span className="text-white font-medium">
                    Free Trial - {company.daysLeftInTrial} days remaining
                  </span>
                  <span className="text-gray-300 text-sm">
                    (Expires {new Date(company.trialEndsAt).toLocaleDateString()})
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/checkout')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription Type Notice */}
        {!company?.isInTrial && company?.subscription_type && (
          <Card className="bg-gray-900/50 border-gray-800 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-purple-400" />
                <span className="text-gray-300">
                  Current plan: <span className="text-white font-medium">
                    {company.subscription_type === 'annual' ? 'Annual' : 'Monthly'} Subscription
                  </span>
                  {company.subscription_type === 'annual' && (
                    <span className="text-gray-400 ml-2">
                      (Seat changes will apply immediately)
                    </span>
                  )}
                  {company.subscription_type === 'monthly' && (
                    <span className="text-gray-400 ml-2">
                      (Price changes will apply to your next payment)
                    </span>
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seat Management */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Seat Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Admin Seats */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Admin Seats</p>
                  <p className="text-gray-400 text-sm">Full dashboard access</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSeatChange('admin', -1)}
                    disabled={seatChanges.adminSeats <= 1}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-white text-xl w-12 text-center">
                    {seatChanges.adminSeats}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSeatChange('admin', 1)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Junior Seats */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Junior Broker Seats</p>
                  <p className="text-gray-400 text-sm">Calculator access only</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSeatChange('junior', -1)}
                    disabled={seatChanges.juniorSeats <= 0}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="text-white text-xl w-12 text-center">
                    {seatChanges.juniorSeats}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSeatChange('junior', 1)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Pricing Info */}
              <div className="border-t border-gray-700 pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-gray-400">
                    <span>Current seats:</span>
                    <span>{company.currentTotalSeats} seats</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Remaining seats:</span>
                    <span>{company.remainingSeats} seats</span>
                  </div>
                  {isChangingSeats && (
                    <div className="flex justify-between text-white">
                      <span>New total:</span>
                      <span className="font-medium">{totalNewSeats} seats</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-400">
                    <span>Price per seat:</span>
                    <span>£{pricePerSeat}/month</span>
                  </div>
                  {isChangingSeats && company.subscription_type !== 'annual' && (
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
                      <span className="text-white">Monthly price change:</span>
                      <span className={`text-xl font-bold ${priceDifference > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                        {priceDifference > 0 ? '+' : ''}£{Math.abs(priceDifference)}/month
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-white mt-2">
                    <span>{isChangingSeats ? 'New' : 'Current'} monthly total:</span>
                    <span>£{isChangingSeats ? newPrice : currentPrice}/month</span>
                  </div>
                  {company?.isInTrial && (
                    <p className="text-purple-400 text-sm mt-2">
                      * Billing starts after your trial ends
                    </p>
                  )}
                </div>

                {/* Discount Tiers Info */}
                <div className="mt-4 p-3 bg-gray-800/50 rounded">
                  <p className="text-purple-400 text-sm mb-2">Pricing Tiers:</p>
                  <div className="space-y-1 text-sm">
                    <div className={`flex justify-between ${totalNewSeats <= 14 ? 'text-purple-300' : 'text-gray-500'}`}>
                      <span>1-14 seats:</span>
                      <span>£30/seat/month</span>
                    </div>
                    <div className={`flex justify-between ${totalNewSeats >= 15 && totalNewSeats <= 29 ? 'text-purple-300' : 'text-gray-500'}`}>
                      <span>15-29 seats:</span>
                      <span>£27/seat/month (10% off)</span>
                    </div>
                    <div className={`flex justify-between ${totalNewSeats >= 30 ? 'text-purple-300' : 'text-gray-500'}`}>
                      <span>30+ seats:</span>
                      <span>£24/seat/month (20% off)</span>
                    </div>
                  </div>
                </div>

                {isChangingSeats && (
                  <Button
                    onClick={handleSaveChanges}
                    disabled={saving}
                    className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                  >
                    {saving ? 'Updating...' : 'Update Subscription'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Team Members */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-xl text-white">Current Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className={`flex items-center justify-between p-3 rounded ${
                  member.is_active === false ? 'bg-gray-900/30 opacity-60' : 'bg-gray-800/50'
                }`}>
                  <div>
                    <p className={`${member.is_active === false ? 'text-gray-500' : 'text-white'}`}>
                      {member.full_name || member.email}
                      {member.is_active === false && <span className="ml-2 text-xs text-red-400">(Inactive)</span>}
                    </p>
                    <p className="text-gray-400 text-sm">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.is_active !== false && (
                      <select
                        value={member.role_type}
                        onChange={(e) => changeUserRole(member.id, e.target.value as 'admin' | 'junior')}
                        className="bg-gray-700 border border-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-600 cursor-pointer"
                        disabled={member.id === currentUserId}
                      >
                        <option value="admin">Admin</option>
                        <option value="junior">Junior</option>
                      </select>
                    )}
                    {member.is_active !== false && member.id !== currentUserId && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendPasswordReset(member.email, member.full_name || member.email)}
                        className="border-blue-600 text-blue-400 hover:bg-blue-900/20"
                        title="Send password reset email"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    {member.id !== currentUserId && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleUserStatus(member.id, member.is_active !== false)}
                          className={member.is_active !== false 
                            ? "border-orange-600 text-orange-400 hover:bg-orange-900/20"
                            : "border-green-600 text-green-400 hover:bg-green-900/20"
                          }
                          title={member.is_active !== false ? 'Deactivate user' : 'Reactivate user'}
                        >
                          {member.is_active !== false ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </Button>
                        {teamMembers.length > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeMember(member.id)}
                            className="border-red-600 text-red-400 hover:bg-red-900/20"
                            title="Permanently delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cancel Subscription Section - Show for both trial and active subscriptions */}
        {(company?.isInTrial || company?.subscription_active) && (
          <Card className="bg-red-900/10 border-red-900/30 mt-8">
            <CardHeader>
              <CardTitle className="text-lg text-red-300">
                {company?.isInTrial ? 'Cancel Trial' : 'Cancel Subscription'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">
                  {company?.isInTrial ? (
                    'If you cancel your trial, your account will be locked immediately and you will lose access to all features.'
                  ) : (
                    <>
                      Once you cancel your subscription, your team will lose access when your current billing period ends.
                      {company.subscription_type === 'annual' 
                        ? ' Since you have an annual subscription, you will continue to have access until the end of your year.'
                        : ' You will continue to have access until the end of the current month.'}
                    </>
                  )}
                </p>
                
                <Button
                  onClick={() => setShowCancelModal(true)}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-900/20"
                >
                  {company?.isInTrial ? 'Cancel Trial' : 'Cancel Subscription'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancel Subscription Modal */}
        <CancelSubscriptionModal
          isOpen={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          companyId={company?.id}
          subscriptionType={company?.isInTrial ? 'trial' : company?.subscription_type}
          onSuccess={() => {
            if (company?.isInTrial) {
              alert('Trial cancelled. Your account has been locked.');
              navigate('/login');
            } else {
              alert('Subscription cancelled. Redirecting to dashboard...');
              navigate('/admin');
            }
          }}
        />
      </div>
    </div>
  );
}