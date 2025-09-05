import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, Mail, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [companyData, setCompanyData] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({
    totalCalculations: 0,
    weeklyChange: 0,
    averageTradeValue: 0,
    activeUsers: 0
  });

  useEffect(() => {
    checkAdminAccess();
    fetchDashboardData();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role_type')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'super_admin'].includes(profile.role_type)) {
      navigate('/calculator');
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get company info
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

      setCompanyData(company);

      // Get team members
      const { data: members } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile!.company_id);

      setTeamMembers(members || []);

      // Get activity metrics
      const { data: activities } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', profile!.company_id)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      calculateMetrics(activities || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (activities: any[]) => {
    const totalCalcs = activities.filter(a => a.action_type === 'calculation').length;
    const avgValue = activities.reduce((sum, a) => sum + (a.amount || 0), 0) / (activities.length || 1);
    const uniqueUsers = new Set(activities.map(a => a.user_id)).size;
    
    // Calculate weekly change (mock for now)
    const weeklyChange = 12; // You'd calculate this from historical data

    setMetrics({
      totalCalculations: totalCalcs,
      weeklyChange,
      averageTradeValue: avgValue,
      activeUsers: uniqueUsers
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage your team and track performance</p>
        </div>

        {/* Metrics Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-400" />
                <CardTitle className="text-sm text-gray-400">Total Seats</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {teamMembers.length} / {companyData?.subscription_seats || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {companyData?.subscription_seats - teamMembers.length} available
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-sm text-gray-400">Weekly Calculations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.totalCalculations}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <p className="text-xs text-green-400">
                  {metrics.weeklyChange > 0 ? '+' : ''}{metrics.weeklyChange}% from last week
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <CardTitle className="text-sm text-gray-400">Avg Trade Value</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                £{metrics.averageTradeValue.toLocaleString()}
              </div>
              <p className="text-xs text-gray-500 mt-1">Per calculation</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-sm text-gray-400">Active Users</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.activeUsers}</div>
              <p className="text-xs text-gray-500 mt-1">This week</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Members Table */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl text-white">Team Members</CardTitle>
              <Button 
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => navigate('/admin/invite')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Name</th>
                    <th className="text-left py-3 px-4 text-gray-400">Email</th>
                    <th className="text-left py-3 px-4 text-gray-400">Role</th>
                    <th className="text-left py-3 px-4 text-gray-400">Last Active</th>
                    <th className="text-left py-3 px-4 text-gray-400">Weekly Activity</th>
                    <th className="text-left py-3 px-4 text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="border-b border-gray-800">
                      <td className="py-3 px-4 text-white">{member.full_name || 'N/A'}</td>
                      <td className="py-3 px-4 text-gray-300">{member.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          member.role_type === 'admin' ? 'bg-purple-600' : 'bg-blue-600'
                        } text-white`}>
                          {member.role_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {member.last_active ? new Date(member.last_active).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-300">0 calculations</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
                          onClick={() => navigate(`/admin/user/${member.id}`)}
                        >
                          View Activity
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}