import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { Clock, Mail } from 'lucide-react';

export default function ExportScheduler() {
  const [schedule, setSchedule] = useState({
    enabled: false,
    dayOfWeek: 1, // Monday
    hour: 9, // 9 AM
    email: ''
  });

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    const { data: existing } = await supabase
      .from('export_schedules')
      .select('*')
      .eq('company_id', profile!.company_id)
      .single();

    if (existing) {
      setSchedule({
        enabled: existing.is_active,
        dayOfWeek: existing.day_of_week,
        hour: existing.hour,
        email: existing.recipient
      });
    }
  };

  const saveSchedule = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    await supabase
      .from('export_schedules')
      .upsert({
        company_id: profile!.company_id,
        schedule_type: 'weekly',
        day_of_week: schedule.dayOfWeek,
        hour: schedule.hour,
        recipient: schedule.email,
        is_active: schedule.enabled
      });

    alert('Schedule saved successfully');
  };

  return (
    <Card className="bg-gray-900/50 border-gray-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-400" />
          <CardTitle className="text-white">Automated Export Schedule</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) => setSchedule({...schedule, enabled: e.target.checked})}
            className="w-4 h-4"
          />
          <label className="text-white">Enable weekly automated export</label>
        </div>

        {schedule.enabled && (
          <>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Day of Week</label>
              <select
                value={schedule.dayOfWeek}
                onChange={(e) => setSchedule({...schedule, dayOfWeek: Number(e.target.value)})}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              >
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Time</label>
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

            <div>
              <label className="block text-sm text-gray-400 mb-1">Email Report To</label>
              <input
                type="email"
                value={schedule.email}
                onChange={(e) => setSchedule({...schedule, email: e.target.value})}
                placeholder="salesforce-admin@company.com"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            </div>
          </>
        )}

        <Button
          onClick={saveSchedule}
          className="w-full bg-purple-600 hover:bg-purple-700"
        >
          <Mail className="h-4 w-4 mr-2" />
          Save Schedule
        </Button>

        <p className="text-xs text-gray-500">
          When enabled, reports will be automatically emailed weekly with CSV and Salesforce JSON attachments
        </p>
      </CardContent>
    </Card>
  );
}