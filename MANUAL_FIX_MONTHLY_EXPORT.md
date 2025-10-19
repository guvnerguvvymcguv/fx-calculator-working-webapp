# MANUAL FIX REQUIRED - AdminDashboard.tsx Monthly Export

The automated edits placed `fetchMonthlyExportSchedule` in the wrong location. 

## Issue:
Line 168-211: `fetchMonthlyExportSchedule` is currently INSIDE the `useEffect(() => { const fetchCalculationCounts...` block. It needs to be moved OUTSIDE.

## Fix:

### Step 1: REMOVE lines 168-211 (the incorrectly placed function)

DELETE THIS BLOCK (currently inside the useEffect):
```typescript
  const fetchMonthlyExportSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      // ... rest of function
    }
  };
```

### Step 2: ADD `fetchMonthlyExportSchedule` in the CORRECT location

FIND the `fetchWeeklyExportSchedule` function (around line 300).

AFTER its closing `};`, ADD this:

```typescript
  const fetchMonthlyExportSchedule = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found in fetchMonthlyExportSchedule');
        return;
      }
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();
        
      if (!profile?.company_id) {
        console.log('No company_id found in fetchMonthlyExportSchedule');
        return;
      }
      
      console.log('Fetching monthly schedule for company:', profile.company_id);
      const { data: schedule, error } = await supabase
        .from('monthly_export_schedules')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .maybeSingle();
      
      console.log('Monthly schedule fetch result:', { schedule, error });
        
      if (schedule) {
        console.log('Setting monthly schedule:', schedule);
        setMonthlyExportSchedule(schedule);
        setMonthlyScheduleDay(schedule.day_of_month.toString());
        setMonthlyScheduleHour(schedule.hour.toString());
      } else {
        console.log('No active monthly schedule found, clearing state');
        setMonthlyExportSchedule(null);
      }
    } catch (error) {
      console.error('Error fetching monthly export schedule:', error);
    }
  };
```

### Step 3: ADD `saveMonthlyExportSchedule` function

FIND the `saveWeeklyExportSchedule` function.

AFTER its closing `};`, ADD:

```typescript
  const saveMonthlyExportSchedule = async () => {
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

      if (monthlyExportSchedule) {
        // Update existing schedule
        const { error } = await supabase
          .from('monthly_export_schedules')
          .update({
            day_of_month: parseInt(monthlyScheduleDay),
            hour: parseInt(monthlyScheduleHour),
            updated_at: new Date().toISOString()
          })
          .eq('id', monthlyExportSchedule.id);
        
        if (error) {
          console.error('Update error:', error);
          alert('Failed to update monthly schedule: ' + error.message);
          return;
        }
      } else {
        // Create new schedule
        const { error } = await supabase
          .from('monthly_export_schedules')
          .insert({
            company_id: profile.company_id,
            day_of_month: parseInt(monthlyScheduleDay),
            hour: parseInt(monthlyScheduleHour),
            is_active: true,
            export_type: 'salesforce_chatter'
          });
        
        if (error) {
          console.error('Insert error:', error);
          alert('Failed to create monthly schedule: ' + error.message);
          return;
        }
      }
      
      console.log('Monthly schedule saved successfully');
      await fetchMonthlyExportSchedule();
      setEditingMonthlySchedule(false);
    } catch (error) {
      console.error('Error saving monthly export schedule:', error);
      alert('Failed to save monthly export schedule');
    }
  };
```

### Step 4: ADD `disableMonthlyExport` function

FIND the `disableWeeklyExport` function.

AFTER its closing `};`, ADD:

```typescript
  const disableMonthlyExport = async () => {
    if (!monthlyExportSchedule) return;
    
    try {
      await supabase
        .from('monthly_export_schedules')
        .update({ is_active: false })
        .eq('id', monthlyExportSchedule.id);
      
      setMonthlyExportSchedule(null);
      setEditingMonthlySchedule(false);
    } catch (error) {
      console.error('Error disabling monthly export schedule:', error);
    }
  };
```

### Step 5: ADD Monthly Export UI Card

FIND the Weekly Export Schedule card (search for `{/* Weekly Export Schedule */}`).

RIGHT AFTER its closing `</Card>` tag, ADD:

```tsx
        {/* Monthly Export Schedule */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Calendar className="h-5 w-5 text-purple-400" />
                <span className="text-gray-300">Monthly Export:</span>
                {!editingMonthlySchedule && monthlyExportSchedule ? (
                  <>
                    <span className="text-white font-medium">
                      Active - Day {monthlyExportSchedule.day_of_month} at {monthlyExportSchedule.hour}:00
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingMonthlySchedule(true)}
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : !editingMonthlySchedule ? (
                  <Button
                    size="sm"
                    onClick={() => setEditingMonthlySchedule(true)}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Enable Monthly Export
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">Day:</span>
                    <select
                      value={monthlyScheduleDay}
                      onChange={(e) => setMonthlyScheduleDay(e.target.value)}
                      className="bg-gray-800 border border-gray-700 text-white px-3 py-1 rounded text-sm"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <span className="text-gray-400">at</span>
                    <select
                      value={monthlyScheduleHour}
                      onChange={(e) => setMonthlyScheduleHour(e.target.value)}
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
                      onClick={saveMonthlyExportSchedule}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingMonthlySchedule(false);
                        if (monthlyExportSchedule) {
                          setMonthlyScheduleDay(monthlyExportSchedule.day_of_month.toString());
                          setMonthlyScheduleHour(monthlyExportSchedule.hour.toString());
                        }
                      }}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      Cancel
                    </Button>
                    {monthlyExportSchedule && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={disableMonthlyExport}
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
```

## After completing these 5 steps:
1. Save the file
2. The monthly export UI will appear
3. Commit the changes

Sorry for the confusion with the automated edits!
