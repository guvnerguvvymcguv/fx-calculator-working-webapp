import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, Calculator, TrendingUp, UserCheck, Calendar, Download, X, Clock, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last7days');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState('today');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  const [salesforceConnected, setSalesforceConnected] = useState(false);
  const [weeklyExportSchedule, setWeeklyExportSchedule] = useState<any>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleDay, setScheduleDay] = useState('1'); // Monday
  const [scheduleHour, setScheduleHour] = useState('9'); // 9 AM
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
    checkSalesforceConnection();
    fetchWeeklyExportSchedule();
  }, [dateRange]);

  const checkSalesforceConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
        
      if (!profile?.company_id) return;
      
      const { data: sfConnection } = await supabase
        .from('salesforce_connections')
        .select('*')
        .eq('company_id', profile.company_id)
        .single();
        
      setSalesforceConnected(!!sfConnection);
    } catch (error) {
      console.error('Error checking Salesforce connection:', error);
      setSalesforceConnected(false);
    }
  };

  const fetchWeeklyExportSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
        
      if (!profile?.company_id) return;
      
      const { data: schedule } = await supabase
        .from('export_schedules')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .single();
        
      if (schedule) {
        setWeeklyExportSchedule(schedule);
        setScheduleDay(schedule.day_of_week.toString());
        setScheduleHour(schedule.hour.toString());
      }
    } catch (error) {
      console.error('Error fetching export schedule:', error);
    }
  };

  const saveWeeklyExportSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('No user found');
        return;
      }
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
        
      if (!profile?.company_id) {
        console.error('No company_id found');
        return;
      }

      if (weeklyExportSchedule) {
        // Update existing schedule
        const { error } = await supabase
          .from('export_schedules')
          .update({
            day_of_week: parseInt(scheduleDay),
            hour: parseInt(scheduleHour),
            updated_at: new Date().toISOString()
          })
          .eq('id', weeklyExportSchedule.id);
        
        if (error) {
          console.error('Update error:', error);
          alert('Failed to update schedule: ' + error.message);
          return;
        }
      } else {
        // Create new schedule
        const { error } = await supabase
          .from('export_schedules')
          .insert({
            company_id: profile.company_id,
            day_of_week: parseInt(scheduleDay),
            hour: parseInt(scheduleHour),
            is_active: true,
            export_type: 'salesforce_chatter'
          });
        
        if (error) {
          console.error('Insert error:', error);
          alert('Failed to create schedule: ' + error.message);
          return;
        }
      }
      
      console.log('Schedule saved successfully');
      await fetchWeeklyExportSchedule();
      setEditingSchedule(false);
    } catch (error) {
      console.error('Error saving export schedule:', error);
      alert('Failed to save export schedule');
    }
  };

  const disableWeeklyExport = async () => {
    if (!weeklyExportSchedule) return;
    
    try {
      await supabase
        .from('export_schedules')
        .update({ is_active: false })
        .eq('id', weeklyExportSchedule.id);
      
      setWeeklyExportSchedule(null);
      setEditingSchedule(false);
    } catch (error) {
      console.error('Error disabling export schedule:', error);
    }
  };

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

  const getExportDateRange = () => {
    const now = new Date();
    let start, end;

    switch (exportDateRange) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case 'thisWeek':
        // Last 5 working days
        start = new Date();
        start.setDate(start.getDate() - 4);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
        // Last 30 days
        start = new Date();
        start.setDate(start.getDate() - 29);
        start.setHours(0, 0, 0, 0);
        end = new Date();
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        start = new Date(customDateRange.start);
        end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
    }

    return { start, end };
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
        const amount = parseFloat(calc.amount) || 0;
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

      setTeamMembers(processedMembers.filter(m => m.role_type === 'junior'));

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

  const handleExportClick = async () => {
    // Check if Salesforce is connected first
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    const { data: sfConnection } = await supabase
      .from('salesforce_connections')
      .select('*')
      .eq('company_id', profile!.company_id)
      .single();
    
    if (sfConnection) {
      // Show export modal
      setShowExportModal(true);
      setSelectedUsers([]); // Reset selection
      setExportDateRange('today'); // Reset to today
    } else {
      // If not connected, redirect to Salesforce settings to connect first
      navigate('/admin/salesforce-settings');
    }
  };

  const handleUserToggle = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === teamMembers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(teamMembers.map(m => m.id));
    }
  };

  const handleExportToSalesforce = async () => {
    if (selectedUsers.length === 0) {
      alert('Please select at least one user to export');
      return;
    }

    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { start, end } = getExportDateRange();
      
      const response = await supabase.functions.invoke('salesforce-export-data', {
        body: { 
          userIds: selectedUsers,
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString()
          }
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }
      
      alert('Data successfully exported to Salesforce!');
      setShowExportModal(false);
      checkSalesforceConnection(); // Refresh connection status
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
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

  const getDayName = (day: string) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[parseInt(day)];
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
              <div className="flex items-center gap-2 ml-auto">
                {salesforceConnected ? (
                  <span className="text-green-400 text-sm">✓ Connected</span>
                ) : (
                  <span className="text-yellow-400 text-sm">⚠ Not Connected</span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportClick}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Export Schedule */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="h-5 w-5 text-purple-400" />
                <span className="text-gray-300">Weekly Export:</span>
                {!editingSchedule && weeklyExportSchedule ? (
                  <>
                    <span className="text-white font-medium">
                      Active - {getDayName(weeklyExportSchedule.day_of_week.toString())} at {weeklyExportSchedule.hour}:00
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingSchedule(true)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : !editingSchedule ? (
                  <Button
                    size="sm"
                    onClick={() => setEditingSchedule(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Enable Weekly Export
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <select
                      value={scheduleDay}
                      onChange={(e) => setScheduleDay(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded text-sm"
                    >
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                    </select>
                    <span className="text-gray-400">at</span>
                    <select
                      value={scheduleHour}
                      onChange={(e) => setScheduleHour(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i.toString().padStart(2, '0')}:00
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={saveWeeklyExportSchedule}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingSchedule(false);
                        if (weeklyExportSchedule) {
                          setScheduleDay(weeklyExportSchedule.day_of_week.toString());
                          setScheduleHour(weeklyExportSchedule.hour.toString());
                        }
                      }}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    {weeklyExportSchedule && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={disableWeeklyExport}
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                      >
                        Disable
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="bg-gray-900 border-gray-800 w-full max-w-2xl">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl text-white">Export to Salesforce</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {/* Date Range Selection */}
                <div className="mb-6">
                  <h3 className="text-gray-300 mb-3">Select Time Period:</h3>
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    <Button
                      variant={exportDateRange === 'today' ? 'default' : 'outline'}
                      onClick={() => setExportDateRange('today')}
                      className={exportDateRange === 'today' 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                    >
                      Today
                    </Button>
                    <Button
                      variant={exportDateRange === 'thisWeek' ? 'default' : 'outline'}
                      onClick={() => setExportDateRange('thisWeek')}
                      className={exportDateRange === 'thisWeek' 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                    >
                      This Week
                    </Button>
                    <Button
                      variant={exportDateRange === 'thisMonth' ? 'default' : 'outline'}
                      onClick={() => setExportDateRange('thisMonth')}
                      className={exportDateRange === 'thisMonth' 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                    >
                      This Month
                    </Button>
                    <Button
                      variant={exportDateRange === 'custom' ? 'default' : 'outline'}
                      onClick={() => setExportDateRange('custom')}
                      className={exportDateRange === 'custom' 
                        ? 'bg-purple-600 hover:bg-purple-700' 
                        : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
                    >
                      Custom
                    </Button>
                  </div>
                  
                  {exportDateRange === 'custom' && (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={customDateRange.start}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded"
                      />
                      <span className="text-gray-400 self-center">to</span>
                      <input
                        type="date"
                        value={customDateRange.end}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-gray-800 border border-gray-700 text-white px-3 py-2 rounded"
                      />
                    </div>
                  )}
                </div>

                {/* User Selection */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-gray-300">Select Users:</h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSelectAll}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      {selectedUsers.length === teamMembers.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-gray-700 rounded p-3">
                    {teamMembers.map((member) => (
                      <label 
                        key={member.id} 
                        className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(member.id)}
                          onChange={() => handleUserToggle(member.id)}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-white">{member.full_name || member.email}</span>
                        <span className="text-gray-400 text-sm ml-auto">
                          {member.weeklyActivity} calculations this week
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportModal(false)}
                    className="border-gray-600 text-gray-300 hover:bg-gray-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleExportToSalesforce}
                    disabled={exporting || selectedUsers.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {exporting ? 'Exporting...' : 'Send to Salesforce'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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