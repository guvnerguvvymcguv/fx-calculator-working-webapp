# How to Add Monthly Reports UI to AdminDashboard

## Step 1: Add State Variables

Find this line in AdminDashboard.tsx (around line 29):
```typescript
const [successMessageType, setSuccessMessageType] = useState<'checkout' | 'seat_update' | null>(null);
```

**Add these 3 lines right after it:**
```typescript
const [monthlyReportsEnabled, setMonthlyReportsEnabled] = useState(false);
const [savingReportSettings, setSavingReportSettings] = useState(false);
const [testingReport, setTestingReport] = useState(false);
```

---

## Step 2: Add Icons Import

Find this line at the top (around line 5):
```typescript
import { Users, Calculator, TrendingUp, UserCheck, Calendar, Download, X, Clock, Edit2, ArrowLeft, Settings, Check, AlertCircle, LogOut } from 'lucide-react';
```

**Replace it with:**
```typescript
import { Users, Calculator, TrendingUp, UserCheck, Calendar, Download, X, Clock, Edit2, ArrowLeft, Settings, Check, AlertCircle, LogOut, FileText, Mail } from 'lucide-react';
```

---

## Step 3: Add Handler Functions

Find the `fetchDashboardData` function (search for `const fetchDashboardData`).

**Add these 3 functions BEFORE the return statement (near the bottom of the component, before the JSX):**

```typescript
const handleToggleMonthlyReports = async () => {
  setSavingReportSettings(true);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();
      
    if (!profile?.company_id) return;
    
    const { error } = await supabase
      .from('companies')
      .update({ monthly_reports_enabled: !monthlyReportsEnabled })
      .eq('id', profile.company_id);
      
    if (error) throw error;
    
    setMonthlyReportsEnabled(!monthlyReportsEnabled);
    alert(`Monthly reports ${!monthlyReportsEnabled ? 'enabled' : 'disabled'} successfully!`);
  } catch (error) {
    console.error('Error updating monthly reports setting:', error);
    alert('Failed to update settings. Please try again.');
  } finally {
    setSavingReportSettings(false);
  }
};

const handleTestReport = async () => {
  if (!confirm('This will generate and send a test report for the previous month to all admins. Continue?')) {
    return;
  }
  
  setTestingReport(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await supabase.functions.invoke('generate-monthly-report', {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    
    if (response.error) throw response.error;
    
    alert('Test report sent successfully! Check your email.');
  } catch (error) {
    console.error('Error generating test report:', error);
    alert('Failed to generate test report. Please try again.');
  } finally {
    setTestingReport(false);
  }
};
```

---

## Step 4: Load Monthly Reports Setting

Find inside the `fetchDashboardData` function where it sets `setCompanyData(company)` (search for this line).

**Add this line right after `setCompanyData(company);`:**
```typescript
setMonthlyReportsEnabled(company?.monthly_reports_enabled || false);
```

---

## Step 5: Add UI Card

Find the Team Members `</Card>` closing tag near the bottom (should be around line 850-900).

**Add this entire card RIGHT AFTER the Team Members card closing tag (before the final `</div></div>`):**

```tsx
        {/* Monthly Client Reports */}
        <Card className="bg-gray-900/50 border-gray-800 mt-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-purple-400" />
                <CardTitle className="text-xl text-white">Monthly Client Reports</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Description */}
              <div className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <Mail className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-white font-medium mb-1">Automated Client Intelligence Reports</p>
                  <p className="text-sm text-gray-400">
                    Receive a comprehensive PDF report on the 1st of every month with detailed insights about your clients' trading activity, 
                    currency pair usage, average trade values, and savings performance.
                  </p>
                </div>
              </div>

              {/* Toggle Section */}
              <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg">
                <div>
                  <p className="text-white font-medium">Monthly Reports</p>
                  <p className="text-sm text-gray-400">
                    {monthlyReportsEnabled 
                      ? 'Reports will be sent to all company admins on the 1st of each month'
                      : 'Enable to receive monthly PDF reports via email'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monthlyReportsEnabled}
                      onChange={handleToggleMonthlyReports}
                      disabled={savingReportSettings}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                  <span className={`text-sm font-medium ${monthlyReportsEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                    {monthlyReportsEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {/* Report Details */}
              {monthlyReportsEnabled && (
                <div className="p-4 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                  <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-400" />
                    Active - Next report scheduled
                  </h4>
                  <div className="space-y-2 text-sm text-gray-300">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Send Date:</span>
                      <span className="text-white">1st of every month at 9:00 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Recipients:</span>
                      <span className="text-white">All company admins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Report Period:</span>
                      <span className="text-white">Previous month's activity</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Format:</span>
                      <span className="text-white">PDF attachment via email</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Test Button */}
              <div className="flex justify-end pt-4 border-t border-gray-700">
                <Button
                  onClick={handleTestReport}
                  disabled={testingReport || !monthlyReportsEnabled}
                  variant="outline"
                  className="border-purple-600 text-purple-300 hover:bg-purple-900/30"
                >
                  {testingReport ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 mr-2" />
                      Generating Test Report...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Test Report
                    </>
                  )}
                </Button>
              </div>

              {!monthlyReportsEnabled && (
                <p className="text-xs text-gray-500 text-center">
                  Enable monthly reports to test the feature
                </p>
              )}
            </div>
          </CardContent>
        </Card>
```

---

## ✅ Done!

Save the file and the Monthly Reports UI will appear on the admin dashboard below the Team Members section.

The UI includes:
- Toggle switch to enable/disable monthly reports
- Information about when reports are sent
- Test button to manually generate a report
- Visual feedback when enabled/disabled
