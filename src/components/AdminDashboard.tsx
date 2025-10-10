import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Users, Calculator, TrendingUp, UserCheck, Calendar, Download, X, Clock, Edit2, ArrowLeft, Settings, Check, AlertCircle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [companyData, setCompanyData] = useState<any>(null);
  const [userCalculationCounts, setUserCalculationCounts] = useState<Record<string, number>>({});
  const [calculationCountLoading, setCalculationCountLoading] = useState(false);
  const [processingUpdate, setProcessingUpdate] = useState(false);
  const [successMessageType, setSuccessMessageType] = useState<'checkout' | 'seat_update' | null>(null);
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
  // Check for seat update success FIRST (this takes priority)
  if (searchParams.get('seat_update') === 'success') {
    const newSeats = searchParams.get('seats');
    if (newSeats) {
      handleSeatUpdateSuccess(parseInt(newSeats));
    }
    setSuccessMessageType('seat_update');
    setShowSuccessMessage(true);
    setSearchParams({});
    setTimeout(() => {
      setShowSuccessMessage(false);
      setSuccessMessageType(null);
    }, 10000);
  }
  // Check for initial checkout success (only if not a seat update)
  else if (searchParams.get('checkout') === 'success') {
    setSuccessMessageType('checkout');
    setShowSuccessMessage(true);
    setSearchParams({});
    setTimeout(() => {
      setShowSuccessMessage(false);
      setSuccessMessageType(null);
    }, 10000);
  }
}, [searchParams, setSearchParams]);

const handleSeatUpdateSuccess = async (newSeatCount: number) => {
  setProcessingUpdate(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
      
      setProcessingUpdate(false);
    if (!profile?.company_id) return;
    
    // Get company data to find subscription ID
    const { data: company } = await supabase
      .from('companies')
      .select('id, stripe_subscription_id')
      .eq('id', profile.company_id)
      .single();
      
    if (!company?.stripe_subscription_id) return;
    
    // Call update-subscription to update Stripe (payment already taken)
    const { data: { session } } = await supabase.auth.getSession();
    const response = await supabase.functions.invoke('update-subscription', {
      body: {
        companyId: company.id,
        newSeatCount: newSeatCount,
        newPrice: calculatePriceForSeats(newSeatCount),
        skipPayment: true // Important: payment already taken
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    if (response.error) {
      setProcessingUpdate(false);
      console.error('Failed to update subscription:', response.error);
      alert('Seat update processing. Please refresh the page.');
    } else {
      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 10000);
      
      // Refresh dashboard data
      await fetchDashboardData();
    }
  } catch (error) {
    console.error('Error handling seat update:', error);
    alert('Seat update is being processed. Please refresh the page in a moment.');
    setProcessingUpdate(false);
  }
};

const calculatePriceForSeats = (seats: number) => {
  if (seats <= 14) return seats * 30;
  if (seats <= 29) return seats * 27;
  return seats * 24;
};

useEffect(() => {
    const fetchCalculationCounts = async () => {
      if (!showExportModal || teamMembers.length === 0) return;
      
      setCalculationCountLoading(true);
      try {
        const { start, end } = getExportDateRange();
        
        const counts: Record<string, number> = {};
        
        // Fetch calculations for each active team member for the selected period
        for (const member of teamMembers) {
          // Only count if member is active
          if (member.is_active !== false) {
            const { count } = await supabase
              .from('activity_logs')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', member.id)
              .gte('created_at', start.toISOString())
              .lte('created_at', end.toISOString());
            
            counts[member.id] = count || 0;
          }
        }
        
setUserCalculationCounts(counts);
      } catch (error) {
        console.error('Error fetching calculation counts:', error);
      } finally {
        setCalculationCountLoading(false);
      }
    };

    if (showExportModal && teamMembers.length > 0) {
      fetchCalculationCounts();
    }
  }, [exportDateRange, customDateRange, showExportModal, teamMembers]);

  useEffect(() => {
    console.log('AdminDashboard mounted, calling fetchDashboardData');
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

  const disconnectSalesforce = async () => {
    if (!confirm('Are you sure you want to disconnect from Salesforce? You will need to reconnect to resume exports.')) {
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();

      // Delete the Salesforce connection
      const { error } = await supabase
        .from('salesforce_connections')
        .delete()
        .eq('company_id', profile!.company_id);

      if (error) throw error;

      alert('Successfully disconnected from Salesforce');
      setSalesforceConnected(false);
      checkSalesforceConnection(); // Refresh connection status
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect. Please try again.');
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

  const getPeriodLabel = () => {
    switch (exportDateRange) {
      case 'today':
        return 'today';
      case 'thisWeek':
        return 'this week';
      case 'thisMonth':
        return 'this month';
      case 'custom':
        const start = new Date(customDateRange.start);
        const end = new Date(customDateRange.end);
        if (start.toDateString() === end.toDateString()) {
          return 'on ' + start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        }
        return 'in selected period';
      default:
        return '';
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
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thisWeek':
        // Get the start of the current week (Sunday)
        start = new Date(now);
        const day = start.getDay();
        const diff = start.getDate() - day;
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        
        // Get the end of the current week (Saturday)
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
        // Get the first day of the current month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        
        // Get the last day of the current month
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        start = new Date(customDateRange.start);
        start.setHours(0, 0, 0, 0);
        end = new Date(customDateRange.end);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const fetchDashboardData = async () => {
  console.log('=== fetchDashboardData START ===');
  try {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User fetched:', user);
    
    if (!user) {
      console.log('No user found, returning early');
      setLoading(false); // ADD THIS - was missing!
      return;
    }

    // Get user's company
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('company_id, role_type')
      .eq('id', user.id)
      .single();

    console.log('Profile fetched:', profile);
    console.log('Profile error:', profileError);

    if (!profile?.company_id) {
      console.log('No company_id found, returning early');
      setLoading(false); // ADD THIS - was missing!
      return;
    }

    // Verify admin access
    if (!['admin', 'super_admin'].includes(profile.role_type)) {
      console.log('User is not admin, redirecting to calculator');
      navigate('/calculator');
      setLoading(false); // ADD THIS - was missing!
      return;
    }

    console.log('Fetching company data...');
    // Fetch company data with cancellation fields
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*, cancel_at_period_end, scheduled_cancellation_date, cancelled_at')
      .eq('id', profile.company_id)
      .single();

    console.log('Company fetched:', company);
    console.log('Company error:', companyError);

    if (companyError) {
      console.error('Failed to fetch company:', companyError);
      setLoading(false);
      return;
    }

    setCompanyData(company);

    // Fetch ALL team members (including inactive for seat count)
    const { data: allMembers } = await supabase
      .from('user_profiles')
      .select(`
        *,
        activity_logs!left(count)
      `)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false });

    // Get date range for filtering
    const { start, end, previousStart, previousEnd } = getDateRangeFilter();

    // Fetch calculations for current period (ONLY from active JUNIOR users)
    const { data: activeJuniorMembers } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .eq('role_type', 'junior')  // ADDED: Only junior brokers
      .neq('is_active', false);

    const activeJuniorUserIds = activeJuniorMembers?.map(m => m.id) || [];

    // Fetch calculations for current period from active junior users only
    const { data: currentCalculations } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', profile.company_id)
      .in('user_id', activeJuniorUserIds.length > 0 ? activeJuniorUserIds : ['no-users'])
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    // Fetch calculations for previous period from active junior users only
    const { data: previousCalculations } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('company_id', profile.company_id)
      .in('user_id', activeJuniorUserIds.length > 0 ? activeJuniorUserIds : ['no-users'])
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
    const activeUserIdsInPeriod = new Set(currentCalculations?.map(calc => calc.user_id) || []);

    // Process team members data (only active members)
    const processedMembers = await Promise.all((allMembers || []).map(async (member) => {
      // Skip inactive members for calculations
      if (member.is_active === false) {
        return {
          ...member,
          weeklyActivity: 0,
          lastActive: null
        };
      }

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

    // Filter to only show active junior members in the team members list
    setTeamMembers(processedMembers.filter(m => m.role_type === 'junior' && m.is_active !== false));

    // Update metrics (count all members for seat usage)
    setMetrics({
      totalSeats: company?.subscription_seats || 0,
      usedSeats: allMembers?.length || 0,
      availableSeats: (company?.subscription_seats || 0) - (allMembers?.length || 0),
      periodCalculations: currentCalculations?.length || 0,
      previousPeriodCalculations: previousCalculations?.length || 0,
      avgTradeValue: avgTradeValue,
      activeUsers: activeUserIdsInPeriod.size
    });

      console.log('=== fetchDashboardData COMPLETE ===');
  } catch (error) {
    console.error('=== fetchDashboardData ERROR ===', error);
  } finally {
    console.log('=== Setting loading to false ===');
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
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get the company ID
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();
      
      const { start, end } = getExportDateRange();
      
      const response = await supabase.functions.invoke('salesforce-export-data', {
        body: { 
          userIds: selectedUsers,
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          companyId: profile!.company_id
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
    // If both periods have 0 calculations, no change
    if (metrics.previousPeriodCalculations === 0 && metrics.periodCalculations === 0) {
      return '0%';
    }
    // If previous was 0 but current has calculations
    if (metrics.previousPeriodCalculations === 0 && metrics.periodCalculations > 0) {
      return 'New';
    }
    // If previous had calculations but current is 0
    if (metrics.previousPeriodCalculations > 0 && metrics.periodCalculations === 0) {
      return '-100%';
    }
    // Normal percentage calculation
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

  // Calculate days remaining for cancellation
  const getDaysRemaining = () => {
    if (!companyData?.scheduled_cancellation_date) return 0;
    const now = new Date();
    const cancelDate = new Date(companyData.scheduled_cancellation_date);
    const diffInMs = cancelDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffInMs / (1000 * 60 * 60 * 24)));
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
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white p-2"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-400">Manage your team and track performance</p>
            </div>
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => navigate('/admin/account')}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <Settings className="h-4 w-4 mr-2" />
              Account Management
            </Button>
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

        {/* Success Message */}
{showSuccessMessage && (
  <div className="mb-6 p-4 bg-green-900/50 border border-green-600 rounded-lg">
    <div className="flex items-center gap-2">
      <Check className="h-5 w-5 text-green-400" />
      <p className="text-green-300">
        {successMessageType === 'seat_update' 
          ? 'Your account has been updated successfully.'
          : 'Payment successful! Your subscription is now active.'}
      </p>
    </div>
  </div>
)}

{/* Processing Update Message */}
{processingUpdate && (
  <div className="mb-6 p-4 bg-blue-900/50 border border-blue-600 rounded-lg">
    <div className="flex items-center gap-2">
      <Clock className="h-5 w-5 text-blue-400 animate-spin" />
      <p className="text-blue-300">
        Processing seat update... This may take a few moments.
      </p>
    </div>
  </div>
)}

        {/* Cancellation Warning Banner */}
        {companyData?.cancel_at_period_end && (
          <Card className="bg-amber-900/20 border-amber-600/30 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-400" />
                  <span className="text-amber-300 font-medium">
                    Subscription ending on {new Date(companyData.scheduled_cancellation_date).toLocaleDateString('en-GB')}
                  </span>
                  <span className="text-gray-300">
                    ({getDaysRemaining()} days remaining)
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/admin/account')}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  Manage Subscription
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                {salesforceConnected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={disconnectSalesforce}
                    className="border-red-600 text-red-400 hover:bg-red-900/20"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                )}
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
                    {calculationCountLoading ? (
                      <div className="text-center py-4 text-gray-400">
                        Loading calculation counts...
                      </div>
                    ) : (
                      teamMembers.map((member) => {
                        const calcCount = userCalculationCounts[member.id] || 0;
                        return (
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
                              {calcCount} calculation{calcCount !== 1 ? 's' : ''} {getPeriodLabel()}
                            </span>
                          </label>
                        );
                      })
                    )}
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
                <span className={
                  metrics.periodCalculations > metrics.previousPeriodCalculations ? 'text-green-400' : 
                  metrics.periodCalculations < metrics.previousPeriodCalculations ? 'text-red-400' : 
                  'text-gray-400'
                }>
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