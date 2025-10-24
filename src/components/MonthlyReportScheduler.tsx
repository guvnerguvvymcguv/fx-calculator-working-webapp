import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Calendar, Clock, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MonthlyReportScheduler() {
  const [schedule, setSchedule] = useState({
    enabled: false,
    dayOfMonth: 1,
    hour: 9,
    timezone: 'Europe/London'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data: scheduleData } = await supabase
        .from('monthly_report_schedule')
        .select('*')
        .eq('company_id', profile.company_id)
        .single();

      if (scheduleData) {
        setSchedule({
          enabled: scheduleData.enabled,
          dayOfMonth: scheduleData.day_of_month,
          hour: scheduleData.hour,
          timezone: scheduleData.timezone
        });
      }
    } catch (error) {
      console.error('Error loading schedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile?.company_id) throw new Error('No company found');

      const { error } = await supabase
        .from('monthly_report_schedule')
        .upsert({
          company_id: profile.company_id,
          enabled: schedule.enabled,
          day_of_month: schedule.dayOfMonth,
          hour: schedule.hour,
          timezone: schedule.timezone,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'company_id'
        });

      if (error) throw error;

      alert(schedule.enabled
        ? `Monthly reports scheduled for day ${schedule.dayOfMonth} at ${schedule.hour.toString().padStart(2, '0')}:00`
        : 'Monthly reports schedule saved (currently disabled)'
      );
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Failed to save schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-6">
          <p className="text-gray-400">Loading schedule...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <Calendar className="h-5 w-5 text-purple-400" />
          Schedule Monthly Reports
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded">
          <div>
            <p className="text-white font-medium">Automated Monthly Reports</p>
            <p className="text-sm text-gray-400">
              {schedule.enabled
                ? `Reports will be sent on day ${schedule.dayOfMonth} at ${schedule.hour.toString().padStart(2, '0')}:00`
                : 'Enable to receive automated monthly client reports'}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => setSchedule({...schedule, enabled: e.target.checked})}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        {schedule.enabled && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Day of Month</label>
              <select
                value={schedule.dayOfMonth}
                onChange={(e) => setSchedule({...schedule, dayOfMonth: Number(e.target.value)})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              >
                {Array.from({length: 28}, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Limited to 1-28 to ensure delivery in all months
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Time (24-hour)</label>
              <select
                value={schedule.hour}
                onChange={(e) => setSchedule({...schedule, hour: Number(e.target.value)})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              >
                {Array.from({length: 24}, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 bg-blue-900/20 border border-blue-800 rounded">
              <div className="flex gap-2">
                <Clock className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-300">
                    Reports will include data from the <strong>previous month</strong>
                  </p>
                  <p className="text-xs text-blue-400 mt-1">
                    Example: A report sent on January 5th will contain December's data
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <Button
          onClick={saveSchedule}
          disabled={saving}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          <Mail className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Schedule'}
        </Button>

        <p className="text-xs text-gray-500">
          All admin users will receive the monthly client report at the scheduled time
        </p>
      </CardContent>
    </Card>
  );
}
