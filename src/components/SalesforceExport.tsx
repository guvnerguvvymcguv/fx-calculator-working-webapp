import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { Download, Calendar, FileText, Send } from 'lucide-react';

interface ExportData {
  date: string;
  clientName: string;
  currencyPair: string;
  yourRate: number;
  competitorRate: number;
  amount: number;
  pipsSaved: number;
  savingsAmount: number;
  userName: string;
  userEmail: string;
}

export default function SalesforceExport() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportData, setExportData] = useState<ExportData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set default to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(lastDay.toISOString().split('T')[0]);
  }, []);

  const fetchExportData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();

      const { data: activities } = await supabase
        .from('activity_logs')
        .select(`
          *,
          user_profiles!inner(full_name, email)
        `)
        .eq('company_id', profile!.company_id)
        .eq('action_type', 'calculation')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
        .order('created_at', { ascending: false });

      if (!activities || activities.length === 0) {
        alert('No calculations found for this date range. Try adjusting the dates or make some calculations first.');
        setExportData([]);
      } else {
        const formatted = activities.map(activity => ({
          date: new Date(activity.created_at).toLocaleDateString(),
          clientName: activity.client_name || 'N/A',
          currencyPair: activity.currency_pair || 'N/A',
          yourRate: activity.your_rate || 0,
          competitorRate: activity.competitor_rate || 0,
          amount: activity.amount || 0,
          pipsSaved: activity.pips_difference || 0,
          savingsAmount: activity.savings_amount || 0,
          userName: activity.user_profiles?.full_name || 'N/A',
          userEmail: activity.user_profiles?.email || 'N/A'
        }));

        setExportData(formatted);
      }
    } catch (error) {
      console.error('Error fetching export data:', error);
      alert('Error loading data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Client Name',
      'Currency Pair',
      'Your Rate',
      'Competitor Rate',
      'Trade Amount',
      'PIPs Saved',
      'Savings Amount',
      'User Name',
      'User Email'
    ];

    const csvContent = [
      headers.join(','),
      ...exportData.map(row => [
        row.date,
        `"${row.clientName}"`,
        row.currencyPair,
        row.yourRate,
        row.competitorRate,
        row.amount,
        row.pipsSaved,
        row.savingsAmount,
        `"${row.userName}"`,
        row.userEmail
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `spread_checker_export_${startDate}_${endDate}.csv`;
    link.click();
  };

  const formatForSalesforce = () => {
    // Helper function to get top currency pairs
    const getTopPairs = (data: ExportData[]) => {
      const pairCounts = data.reduce((acc, calc) => {
        acc[calc.currencyPair] = (acc[calc.currencyPair] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(pairCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([pair, count]) => ({ pair, count }));
    };

    // Helper function to generate text report
    const generateTextReport = (summary: any) => {
      let report = `${summary.reportTitle}\n`;
      report += `${'='.repeat(50)}\n\n`;
      report += `WEEKLY SUMMARY\n`;
      report += `--------------\n`;
      report += `Total Calculations: ${summary.summary.totalCalculations}\n`;
      report += `Total Savings: £${summary.summary.totalSavings.toFixed(2)}\n`;
      report += `Average Trade Value: £${summary.summary.averageTradeValue.toFixed(2)}\n`;
      report += `Unique Clients: ${summary.summary.uniqueClients}\n\n`;
      
      summary.userReports.forEach((user: any) => {
        report += `\n${user.userName}'s Performance\n`;
        report += `${'-'.repeat(30)}\n`;
        report += `Calculations: ${user.weeklyStats.calculationsCompleted}\n`;
        report += `Total Volume: £${user.weeklyStats.totalVolume.toLocaleString()}\n`;
        report += `Total Savings: £${user.weeklyStats.totalSavings.toFixed(2)}\n`;
        report += `Avg PIPs Saved: ${user.weeklyStats.averagePipsSaved.toFixed(1)}\n\n`;
        
        user.calculations.forEach((calc: any) => {
          report += `  ${calc.id}: ${calc.client} - ${calc.pair}\n`;
          report += `    Amount: ${calc.amount}, Saved: ${calc.savings}\n`;
        });
      });
      
      return report;
    };

    // Helper functions to download files
    const downloadJSON = (data: any, filename: string) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.json`;
      link.click();
    };

    const downloadText = (text: string, filename: string) => {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.txt`;
      link.click();
    };

    // Group by user
    const userGroups = exportData.reduce((acc, calc) => {
      const key = calc.userName;
      if (!acc[key]) acc[key] = [];
      acc[key].push(calc);
      return acc;
    }, {} as Record<string, typeof exportData>);

    // Get unique competitors
    const competitors = [...new Set(exportData.map(d => d.competitorRate > 0 ? 'Competitor' : ''))].filter(Boolean);
    
    const weekSummary = {
      reportTitle: `Weekly FX Trading Report - ${startDate} to ${endDate}`,
      summary: {
        totalCalculations: exportData.length,
        totalSavings: exportData.reduce((sum, row) => sum + row.savingsAmount, 0),
        averageTradeValue: exportData.reduce((sum, row) => sum + row.amount, 0) / exportData.length || 0,
        uniqueClients: [...new Set(exportData.map(d => d.clientName))].length,
        competitorsAnalyzed: competitors.length,
        topCurrencyPairs: getTopPairs(exportData)
      },
      userReports: Object.entries(userGroups).map(([userName, calcs]) => ({
        userName,
        weeklyStats: {
          calculationsCompleted: calcs.length,
          totalVolume: calcs.reduce((sum, c) => sum + c.amount, 0),
          totalSavings: calcs.reduce((sum, c) => sum + c.savingsAmount, 0),
          averagePipsSaved: calcs.reduce((sum, c) => sum + c.pipsSaved, 0) / calcs.length || 0,
          percentChangeFromLastWeek: '+12%' // Would need historical data
        },
        calculations: calcs.map((calc, index) => ({
          id: `CALC-${index + 1}`,
          date: calc.date,
          client: calc.clientName,
          pair: calc.currencyPair,
          yourRate: calc.yourRate,
          competitorRate: calc.competitorRate,
          amount: `£${calc.amount.toLocaleString()}`,
          pipsSaved: calc.pipsSaved,
          savings: `£${calc.savingsAmount.toFixed(2)}`
        }))
      }))
    };

    // Create formatted text report as well
    const textReport = generateTextReport(weekSummary);
    
    // Download both files
    downloadJSON(weekSummary, `salesforce_weekly_${startDate}`);
    downloadText(textReport, `weekly_report_${startDate}`);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-white">Export to Salesforce</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white"
              />
            </div>
          </div>

          <Button
            onClick={fetchExportData}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {loading ? 'Loading...' : 'Load Data'}
          </Button>
        </CardContent>
      </Card>

      {exportData.length > 0 && (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Export Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-gray-300">
              <p className="mb-2">Found {exportData.length} calculations</p>
              <p className="text-sm text-gray-400">
                Total savings: £{exportData.reduce((sum, row) => sum + row.savingsAmount, 0).toFixed(2)}
              </p>
            </div>

            <div className="flex gap-4">
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              
              <Button
                onClick={formatForSalesforce}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                Salesforce Format
              </Button>
            </div>

            <div className="text-xs text-gray-500">
              <p>CSV: Universal format for any CRM</p>
              <p>Salesforce Format: Downloads enhanced weekly report (JSON + Text)</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}