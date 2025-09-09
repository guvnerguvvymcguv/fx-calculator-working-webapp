import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Send, ArrowLeft } from 'lucide-react';

export default function SalesforceSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  useEffect(() => {
    checkSalesforceConnection();
    
    // Check if we just completed authorization
    if (searchParams.get('authorized') === 'true') {
      const code = sessionStorage.getItem('sf_auth_code');
      if (code) {
        handleTokenExchange(code);
        sessionStorage.removeItem('sf_auth_code');
      }
    }
  }, []);

  const checkSalesforceConnection = async () => {
    try {
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
        setIsConnected(true);
        setConnectionDetails(sfConnection);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleTokenExchange = async (code: string) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('salesforce-token-exchange', {
        body: { 
          code,
          redirectUri: `${window.location.origin}/salesforce-callback`
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      alert('Successfully connected to Salesforce!');
      checkSalesforceConnection(); // Refresh the connection status
      
    } catch (error) {
      console.error('Token exchange error:', error);
      alert('Failed to complete connection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const initiateSalesforceOAuth = () => {
    const clientId = import.meta.env.VITE_SALESFORCE_CLIENT_ID;
    
    if (!clientId) {
      alert('Salesforce Client ID is not configured. Please check environment variables.');
      return;
    }
    
    const redirectUri = `${window.location.origin}/salesforce-callback`;
    const state = Math.random().toString(36).substring(7);
    
    sessionStorage.setItem('sf_oauth_state', state);
    
    // Using generic login.salesforce.com for Connected App
    const authUrl = `https://login.salesforce.com/services/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `state=${state}&` +
      `scope=${encodeURIComponent('api refresh_token offline_access')}`;
    
    console.log('OAuth URL:', authUrl); // Debug logging
    window.location.href = authUrl;
  };

  const testExport = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('salesforce-export-test', {
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (response.error) {
        throw response.error;
      }

      alert('Test data successfully sent to Salesforce!');
    } catch (error) {
      console.error('Export test failed:', error);
      alert('Export test failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingConnection) {
    return (
      <div className="min-h-screen bg-[#10051A] flex items-center justify-center">
        <div className="text-purple-300">Checking Salesforce connection...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            onClick={() => navigate('/admin')}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold text-white">Salesforce Integration</h1>
        </div>
        
        {/* Connection Status */}
        <Card className="bg-gray-900/50 border-gray-800 mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              Connection Status
              {isConnected ? (
                <CheckCircle className="h-6 w-6 text-green-400" />
              ) : (
                <XCircle className="h-6 w-6 text-red-400" />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="space-y-4">
                <p className="text-gray-300">
                  Connected to Salesforce instance
                </p>
                <p className="text-gray-400 text-sm">
                  Last synced: {connectionDetails?.last_sync 
                    ? new Date(connectionDetails.last_sync).toLocaleString() 
                    : 'Never'}
                </p>
                <Button
                  onClick={testExport}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Test Export
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-400">
                  Connect your Salesforce account to enable automatic data exports
                </p>
                <Button
                  onClick={initiateSalesforceOAuth}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={loading}
                >
                  Connect to Salesforce
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Click "Connect to Salesforce" to authorize SpreadChecker</li>
              <li>Log in with your Salesforce admin credentials</li>
              <li>Approve the requested permissions</li>
              <li>Your calculation data will sync automatically to Salesforce</li>
              <li>Set up weekly export schedules from the Admin Dashboard</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}