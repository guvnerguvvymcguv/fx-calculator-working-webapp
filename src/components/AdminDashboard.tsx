import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, Mail, Activity, ArrowLeft, Calculator, LogOut, AlertTriangle, Download } from 'lucide-react';
import DateFilter from './DateFilter';
import SalesforceExport from './SalesforceExport';
import ExportScheduler from './ExportScheduler';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [dateFilter, setDateFilter] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });
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

  useEffect(() => {
    if (!loading) {
      fetchDashboardData();
    }
  }, [dateFilter]);

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

    setUserProfile(profile);

    if (!profile || !['admin', 'super_admin'].includes(profile.role_type)) {
      navigate('/calculator');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleApplyDateFilter = (start: Date, end: Date) => {
    setDateFilter({ start, end });
  };

  const handleClearDateFilter = () => {
    setDateFilter({ start: null, end: null });
  };

  const fetchDashboardData = async () => {
    setError(null);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error('Failed to authenticate user');
      }
      
      // Get company info
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('company_id, role_type')
        .eq('id', user!.id)
        .single();

      if (profileError) {
        throw new Error('Failed to load user profile');
      }

      setUserProfile(profile);

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile!.company_id)
        .single();

      if (companyError) {
        throw new Error('Failed to load company data');
      }

      setCompanyData(company);

      // Get team members
      const { data: members, error: membersError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('company_id', profile!.company_id);

      if (membersError) {
        console.error('Warning: Could not load team members', membersError);
      }

      setTeamMembers(members || []);

      // Use date filter if set, otherwise use current/previous week
      let currentPeriodStart = dateFilter.start ? new Date(dateFilter.start) : new Date();
      
      if (!dateFilter.start) {
        // Default to current week if no filter
        currentPeriodStart.setDate(currentPeriodStart.getDate() - currentPeriodStart.getDay());
        currentPeriodStart.setHours(0, 0, 0, 0);
      }

      let currentPeriodQuery = supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', profile!.company_id);

      if (dateFilter.start && dateFilter.end) {
        currentPeriodQuery = currentPeriodQuery
          .gte('created_at', dateFilter.start.toISOString())
          .lte('created_at', dateFilter.end.toISOString());
      } else {
        currentPeriodQuery = currentPeriodQuery
          .gte('created_at', currentPeriodStart.toISOString());
      }

      const { data: currentPeriodActivities, error: activitiesError } = await currentPeriodQuery;

      if (activitiesError) {
        console.error('Warning: Could not load activities', activitiesError);
      }

      // Get comparison period (same duration, but earlier)
      let previousPeriodActivities: any[] = [];
      if (!dateFilter.start) {
        // Default weekly comparison
        const previousWeekStart = new Date(currentPeriodStart);
        previousWeekStart.setDate(previousWeekStart.getDate() - 7);

        const { data: prevActivities } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('company_id', profile!.company_id)
          .gte('created_at', previousWeekStart.toISOString())
          .lt('created_at', currentPeriodStart.toISOString());
        
        previousPeriodActivities = prevActivities || [];
      }

      calculateMetrics(currentPeriodActivities || [], previousPeriodActivities);
      
    } catch (error: any) {
      console.error('Dashboard error:', error);
      setError(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (currentPeriod: any[], previousPeriod: any[]) => {
    const currentPeriodCalcs = currentPeriod.filter(a => a.action_type === 'calculation').length;
    const previousPeriodCalcs = previousPeriod.filter(a => a.action_type === 'calculation').length;
    
    const avgValue = currentPeriod.reduce((sum, a) => sum + (a.amount || 0), 0) / (currentPeriod.length || 1);
    const uniqueUsers = new Set(currentPeriod.map(a => a.user_id)).size;
    
    // Calculate actual period-over-period change
    let periodChange = 0;
    if (previousPeriodCalcs > 0) {
      periodChange = Math.round(((currentPeriodCalcs - previousPeriodCalcs) / previousPeriodCalcs) * 100);
    } else if (currentPeriodCalcs > 0) {
      periodChange = 100;
    }

    setMetrics({
      totalCalculations: currentPeriodCalcs,
      weeklyChange: periodChange,
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

  if (error) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center p-4">
        <Card className="max-w-md bg-gray-900/90 border-gray-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <CardTitle className="text-white">Dashboard Error</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 mb-4">{error}</p>
            <div className="flex gap-4">
              <Button 
                onClick={() => window.location.reload()} 
                className="bg-purple-600 hover:bg-purple-700"
              >
                Retry
              </Button>
              <Button 
                onClick={() => navigate('/')} 
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Go Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      {/* Top Navigation Bar */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate('/')}
            className="p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-400" />
          </button>
          
          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/calculator')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Use Calculator
            </Button>
            {userProfile?.role_type === 'super_admin' && (
              <Button
                onClick={() => navigate('/admin/seats')}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Seats
              </Button>
            )}
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage your team and track performance</p>
        </div>

        {/* Date Filter */}
        <DateFilter 
          onApplyFilter={handleApplyDateFilter}
          onClearFilter={handleClearDateFilter}
        />

        {/* Export Section */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Metrics Overview</h2>
          <Button
            onClick={() => setShowExport(!showExport)}
            variant="outline"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>

        {showExport && (
          <div className="space-y-6">
            <SalesforceExport />
            <ExportScheduler />
          </div>
        )}

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
                <CardTitle className="text-sm text-gray-400">
                  {dateFilter.start ? 'Period' : 'Weekly'} Calculations
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.totalCalculations}</div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-green-400" />
                <p className="text-xs text-green-400">
                  {metrics.weeklyChange > 0 ? '+' : ''}{metrics.weeklyChange}% 
                  {dateFilter.start ? ' vs previous' : ' from last week'}
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
              <p className="text-xs text-gray-500 mt-1">
                {dateFilter.start ? 'In period' : 'This week'}
              </p>
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