import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, Calendar, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function UserActivity() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [viewType, setViewType] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [metrics, setMetrics] = useState({
    totalCalculations: 0,
    averageTradeValue: 0
  });

  useEffect(() => {
    fetchUserData();
  }, [userId, viewType, selectedDate]);

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
            <h1 className="text-3xl font-bold text-white">
              {userData?.full_name || userData?.email}'s Activity
            </h1>
            <p className="text-gray-400">View detailed calculation history and metrics</p>
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
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400">Time</th>
                      <th className="text-left py-3 px-4 text-gray-400">Client</th>
                      <th className="text-left py-3 px-4 text-gray-400">Currency Pair</th>
                      <th className="text-left py-3 px-4 text-gray-400">Your Rate</th>
                      <th className="text-left py-3 px-4 text-gray-400">Competitor Rate</th>
                      <th className="text-left py-3 px-4 text-gray-400">Amount</th>
                      <th className="text-left py-3 px-4 text-gray-400">PIPs Saved</th>
                      <th className="text-left py-3 px-4 text-gray-400">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map((activity) => (
                      <tr key={activity.id} className="border-b border-gray-800">
                        <td className="py-3 px-4 text-white">
                          {new Date(activity.created_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3 px-4 text-gray-300">{activity.client_name || 'N/A'}</td>
                        <td className="py-3 px-4 text-gray-300">{activity.currency_pair}</td>
                        <td className="py-3 px-4 text-gray-300">{activity.your_rate?.toFixed(4)}</td>
                        <td className="py-3 px-4 text-gray-300">{activity.competitor_rate?.toFixed(4)}</td>
                        <td className="py-3 px-4 text-gray-300">
                          £{activity.amount?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-green-400">{activity.pips_difference}</td>
                        <td className="py-3 px-4 text-green-400">
                          £{activity.savings_amount?.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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