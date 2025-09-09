import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, Calculator, TrendingUp, UserCheck, Calendar, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last7days');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    totalSeats: 0,
    usedSeats: 0,
    availableSeats: 0,
    periodCalculations: 0,
    previousPeriodCalculations: 0,
    avgTradeValue: 0,
    activeUsers: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const getDateRangeFilter = () => {
    const now = new Date();
    const ranges: { [key: string]: { start: Date, end: Date, previousStart: Date, previousEnd: Date } } = {
      'today': {
        start: new Date(now.setHours(0, 0, 0, 0)),
        end: new Date(now.setHours(23, 59, 59, 999)),
        previousStart: new Date(now.setDate(now.getDate() - 1)),
        previousEnd: new Date(now.setHours(23, 59, 59, 999))
      },
      'last7days': {
        start: new Date(now.setDate(now.getDate() - 6)),
        end: new Date(),
        previousStart: new Date(now.setDate(now.getDate() - 13)),
        previousEnd: new Date(now.setDate(now.getDate() - 7))
      },
      'lastMonth': {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        previousStart: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        previousEnd: new Date(now.getFullYear(), now.getMonth(), 0)
      },
      'lastQuarter': {
        start: new Date(now.setMonth(now.getMonth() - 3)),
        end: new Date(),
        previousStart: new Date(now.setMonth(now.getMonth() - 6)),
        previousEnd: new Date(now.setMonth(now.getMonth() - 3))
      }
    };

    return ranges[dateRange] || ranges['last7days'];
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's company
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id, role_type')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Verify admin access
      if (!['admin', 'super_admin'].includes(profile.role_type)) {
        navigate('/calculator');
        return;
      }

      // Fetch company data
      const { data: company } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();

      // Fetch team members with their calculation counts
      const { data: members } = await supabase
        .from('user_profiles')
        .select(`
          *,
          activity_logs!left(count)
        `)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false });

      // Get date range for filtering
      const { start, end, previousStart, previousEnd } = getDateRangeFilter();

      // Fetch calculations for current period
      const { data: currentCalculations } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Fetch calculations for previous period
      const { data: previousCalculations } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', profile.company_id)
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString());

      // Calculate average trade value
      const totalTradeValue = currentCalculations?.reduce((sum, calc) => {
        const amount = parseFloat(calc.amount_to_buy) || 0;
        return sum + amount;
      }, 0) || 0;

      const avgTradeValue = currentCalculations?.length ? 
        totalTradeValue / currentCalculations.length : 0;

      // Count active users (users who made calculations in current period)
      const activeUserIds = new Set(currentCalculations?.map(calc => calc.user_id) || []);

      // Process team members data
      const processedMembers = await Promise.all((members || []).map(async (member) => {
        // Get member's calculations for the current period
        const { data: memberCalcs } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', member.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());

        // Get last activity
        const { data: lastCalc } = await supabase
          .from('activity_logs')
          .select('created_at')
          .eq('user_id', member.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        return {
          ...member,
          weeklyActivity: memberCalcs?.length || 0,
          lastActive: lastCalc?.created_at || null
        };
      }));

      setTeamMembers(processedMembers);

      // Update metrics
      setMetrics({
        totalSeats: company?.subscription_seats || 0,
        usedSeats: members?.length || 0,
        availableSeats: (company?.subscription_seats || 0) - (members?.length || 0),
        periodCalculations: currentCalculations?.length || 0,
        previousPeriodCalculations: previousCalculations?.length || 0,
        avgTradeValue: avgTradeValue,
        activeUsers: activeUserIds.size
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const calculatePercentageChange = () => {
    if (metrics.previousPeriodCalculations === 0) return '+100%';
    const change = ((metrics.periodCalculations - metrics.previousPeriodCalculations) / 
                    metrics.previousPeriodCalculations) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  };

  const formatLastActive = (date: string | null) => {
    if (!date) return 'Never';
    const lastActive = new Date(date);
    const now = new Date();
    const diffInHours = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)} days ago`;
    return lastActive.toLocaleDateString();
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-gray-400">Manage your team and track performance</p>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/calculator')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Calculator className="h-4 w-4 mr-2" />
              Use Calculator
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-purple-400" />
              <span className="text-gray-300">Date Range:</span>
              <div className="flex gap-2">
                {['today', 'last7days', 'lastMonth', 'lastQuarter'].map((range) => (
                  <Button
                    key={range}
                    size="sm"
                    variant={dateRange === range ? 'default' : 'outline'}
                    onClick={() => setDateRange(range)}
                    className={dateRange === range 
                      ? 'bg-purple-600 hover:bg-purple-700' 
                      : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                  >
                    {range === 'today' ? 'Today' :
                     range === 'last7days' ? 'Last 7 Days' :
                     range === 'lastMonth' ? 'Last Month' : 'Last Quarter'}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Seats</CardTitle>
              <Users className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {metrics.usedSeats} / {metrics.totalSeats}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {metrics.availableSeats} available
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Period Calculations</CardTitle>
              <Calculator className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.periodCalculations}</div>
              <p className="text-xs text-gray-400 mt-1">
                <span className={metrics.periodCalculations >= metrics.previousPeriodCalculations ? 
                  'text-green-400' : 'text-red-400'}>
                  {calculatePercentageChange()} vs previous
                </span>
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Avg Trade Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(metrics.avgTradeValue)}
              </div>
              <p className="text-xs text-gray-400 mt-1">Per calculation</p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Active Users</CardTitle>
              <UserCheck className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{metrics.activeUsers}</div>
              <p className="text-xs text-gray-400 mt-1">In period</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="flex justify-between items-center">
            <CardTitle className="text-xl text-white">Team Members</CardTitle>
            <Button
              onClick={() => navigate('/admin/invite')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Invite Members
            </Button>
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
                      <td className="py-3 px-4 text-white">
                        {member.full_name || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{member.email}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs ${
                          member.role_type === 'admin' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-blue-600 text-white'
                        }`}>
                          {member.role_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {formatLastActive(member.lastActive)}
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        ↗ {member.weeklyActivity} calculations
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/user/${member.id}`)}
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
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