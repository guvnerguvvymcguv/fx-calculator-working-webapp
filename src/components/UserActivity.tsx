import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Calendar, TrendingUp, Activity, Download, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function UserActivity() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [viewType, setViewType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportDateRange, setExportDateRange] = useState('today');
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  const [salesforceConnected, setSalesforceConnected] = useState(false);
  const [metrics, setMetrics] = useState({
    totalCalculations: 0,
    averageTradeValue: 0
  });

  useEffect(() => {
    fetchUserData();
    checkSalesforceConnection();
  }, [userId, viewType, selectedDate]);

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

  const fetchUserData = async () => {
    try {
      // Get user info
      const { data: user } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      setUserData(user);

      // Calculate date range based on view type
      let startDate, endDate;
      
      if (viewType === 'daily') {
        startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
      } else if (viewType === 'weekly') {
        const dayOfWeek = selectedDate.getDay();
        startDate = new Date(selectedDate);
        startDate.setDate(selectedDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else { // monthly
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
      }

      // Get user activities
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('action_type', 'calculation')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      setActivities(logs || []);

      // Calculate metrics
      if (logs && logs.length > 0) {
        const avgValue = logs.reduce((sum, log) => sum + (log.amount || 0), 0) / logs.length;
        setMetrics({
          totalCalculations: logs.length,
          averageTradeValue: avgValue
        });
      } else {
        setMetrics({
          totalCalculations: 0,
          averageTradeValue: 0
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    
    if (viewType === 'daily') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewType === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else { // monthly
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    
    setSelectedDate(newDate);
  };

  const getDateRangeDisplay = () => {
    if (viewType === 'daily') {
      return selectedDate.toLocaleDateString('en-GB', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } else if (viewType === 'weekly') {
      const startOfWeek = new Date(selectedDate);
      const dayOfWeek = selectedDate.getDay();
      startOfWeek.setDate(selectedDate.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      
      return `${startOfWeek.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      return selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
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

  const handleExportClick = async () => {
    if (salesforceConnected) {
      setShowExportModal(true);
      setExportDateRange('today');
    } else {
      navigate('/admin/salesforce-settings');
    }
  };

  const handleExportToSalesforce = async () => {
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
          userIds: [userId], // Single user ID in array
          dateRange: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          companyId: profile!.company_id // ADD THIS LINE
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
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Loading user activity...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/admin')}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">
                {userData?.full_name || userData?.email}'s Activity
              </h1>
              <p className="text-gray-400">View detailed calculation history and metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {salesforceConnected ? (
              <span className="text-green-400 text-sm">✓ Connected</span>
            ) : (
              <span className="text-yellow-400 text-sm">⚠ Not Connected</span>
            )}
            <Button
              onClick={handleExportClick}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              <Download className="h-4 w-4 mr-2" />
              Export to Salesforce
            </Button>
          </div>
        </div>

        {/* View Type Selector */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setViewType('daily')}
            variant={viewType === 'daily' ? 'default' : 'outline'}
            className={viewType === 'daily' 
              ? 'bg-purple-600 hover:bg-purple-700' 
              : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
          >
            Daily
          </Button>
          <Button
            onClick={() => setViewType('weekly')}
            variant={viewType === 'weekly' ? 'default' : 'outline'}
            className={viewType === 'weekly' 
              ? 'bg-purple-600 hover:bg-purple-700' 
              : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
          >
            Weekly
          </Button>
          <Button
            onClick={() => setViewType('monthly')}
            variant={viewType === 'monthly' ? 'default' : 'outline'}
            className={viewType === 'monthly' 
              ? 'bg-purple-600 hover:bg-purple-700' 
              : 'border-gray-600 text-gray-300 hover:bg-gray-800'}
          >
            Monthly
          </Button>
        </div>

        {/* Date Navigation */}
        <div className="flex items-center justify-between mb-6 p-4 bg-gray-900/50 rounded-lg">
          <Button
            onClick={() => changeDate('prev')}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Previous
          </Button>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            <span className="text-xl font-semibold text-white">
              {getDateRangeDisplay()}
            </span>
          </div>
          <Button
            onClick={() => changeDate('next')}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            Next
          </Button>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="bg-gray-900 border-gray-800 w-full max-w-md">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl text-white">
                  Export {userData?.full_name || userData?.email}'s Data
                </CardTitle>
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
                  <div className="grid grid-cols-2 gap-2 mb-4">
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
                    disabled={exporting}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                  >
                    {exporting ? 'Exporting...' : 'Send to Salesforce'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Metrics Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <CardTitle className="text-sm text-gray-400">Total Calculations</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{metrics.totalCalculations}</div>
              <p className="text-xs text-gray-500 mt-1">
                {viewType === 'daily' ? 'Today' : viewType === 'weekly' ? 'This week' : 'This month'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <CardTitle className="text-sm text-gray-400">Average Trade Value</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">
                £{metrics.averageTradeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">Per calculation</p>
            </CardContent>
          </Card>
        </div>

        {/* Calculations Table */}
<Card className="bg-gray-900/50 border-gray-800">
  <CardHeader>
    <CardTitle className="text-xl text-white">Calculation Details</CardTitle>
  </CardHeader>
  <CardContent>
    {activities.length > 0 ? (
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          {activities.map((activity) => {
  // Extract data directly from activity (stored at root level in activity_logs)
  const costWithCompetitor = activity.cost_with_competitor || 0;
  const costWithUs = activity.cost_with_us || 0;
  const annualSavings = activity.annual_savings || 0;
  const percentageSavings = activity.percentage_savings || 0;
  const tradesPerYear = activity.trades_per_year || 0;
  const comparisonDate = activity.comparison_date || '';
  const priceDifference = activity.price_difference || 0;
  
  // WIN/LOSS LOGIC - Following same pattern as Calculator
  const yourRate = activity.your_rate || 0;
  const competitorRate = activity.competitor_rate || 0;
  const isWin = yourRate > competitorRate; // If your rate is higher, you WIN
  
  return (
    <div key={activity.id} className="border-b border-gray-700 py-4">
      {/* Row 1: Calc Details */}
      <div className="grid grid-cols-8 gap-4 mb-2">
        <div>
          <div className="text-xs text-gray-500 mb-1">Time & Date</div>
          <div className="text-sm text-white">
            {new Date(activity.created_at).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: viewType !== 'daily' ? 'numeric' : undefined,
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Currency Pair</div>
          <div className="text-sm text-white font-semibold">
            {activity.currency_pair || 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Your Rate</div>
          <div className="text-sm text-gray-300">
            {yourRate.toFixed(4) || 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Comp Rate</div>
          <div className="text-sm text-gray-300">
            {competitorRate.toFixed(4) || 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Client Name</div>
          <div className="text-sm text-gray-300">
            {activity.client_name || 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Comp Date</div>
          <div className="text-sm text-gray-300">
            {comparisonDate ? new Date(comparisonDate).toLocaleDateString('en-GB') : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Amt to Buy</div>
          <div className="text-sm text-gray-300">
            £{activity.amount?.toLocaleString() || '0'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Trades/Year</div>
          <div className="text-sm text-gray-300">
            {tradesPerYear || 'N/A'}
          </div>
        </div>
      </div>
      
      {/* Row 2: Results - WITH WIN/LOSS CONDITIONAL COLORS */}
      <div className="grid grid-cols-8 gap-4 pl-0 border-l-4 border-purple-500 ml-0 pl-2">
        <div>
          <div className="text-xs text-gray-500 mb-1">Price Diff</div>
          <div className="text-sm text-white font-semibold">
            {priceDifference > 0 ? '+' : ''}{priceDifference.toFixed(4)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">PIPs</div>
          <div className={`text-sm font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            {activity.pips_difference || 0}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Cost w/ Comp</div>
          <div className={`text-sm ${isWin ? 'text-red-400' : 'text-green-400'}`}>
            £{costWithCompetitor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Cost w/ Us</div>
          <div className={`text-sm ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            £{costWithUs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Savings/Trade</div>
          <div className={`text-sm font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            £{activity.savings_amount?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Annual Savings</div>
          <div className={`text-sm font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            £{annualSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">% Savings</div>
          <div className={`text-sm font-semibold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            {percentageSavings.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
})}
        </div>
      </div>
    ) : (
      <div className="text-center py-8 text-gray-400">
        No calculations found for this period
      </div>
    )}
  </CardContent>
</Card>
      </div>
    </div>
  );
}