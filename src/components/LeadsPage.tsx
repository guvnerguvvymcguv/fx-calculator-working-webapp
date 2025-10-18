import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { 
  Briefcase, 
  Search, 
  Trash2, 
  TrendingUp,
  Home,
  LayoutDashboard,
  Calendar,
  MapPin,
  Building2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { getUserLeads, updateLeadContactedStatus, deleteLead, getLeadStats } from '../lib/userLeads';
import type { UserLead } from '../lib/userLeads';

// Helper function to get user profile
const getUserProfile = async (userId: string) => {
  const { data } = await supabase
    .from('user_profiles')
    .select('company_id, role_type')
    .eq('id', userId)
    .single();
  return data;
};

export default function LeadsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'junior' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [leads, setLeads] = useState<UserLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<UserLead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'contacted' | 'not_contacted'>('all');
  const [stats, setStats] = useState({
    total: 0,
    contacted: 0,
    notContacted: 0,
    fromCalculator: 0,
    fromSearch: 0
  });
  const navigate = useNavigate();

  // Check authentication and load leads
  useEffect(() => {
    checkAuth();
  }, []);

  // Apply filters whenever search term, filter status, or leads change
  useEffect(() => {
    applyFilters();
  }, [searchTerm, filterStatus, leads]);

  const checkAuth = async () => {
    const { user, error } = await getCurrentUser();
    
    if (error || !user) {
      navigate('/login');
    } else {
      setCurrentUser(user);
      const profile = await getUserProfile(user.id);
      if (profile) {
        setUserRole(profile.role_type);
      }
      await loadLeads(user.id);
      await loadStats(user.id);
      setIsLoading(false);
    }
  };

  const loadLeads = async (userId: string) => {
    const { success, leads: fetchedLeads } = await getUserLeads(userId);
    if (success) {
      setLeads(fetchedLeads);
    }
  };

  const loadStats = async (userId: string) => {
    const stats = await getLeadStats(userId);
    setStats(stats);
  };

  const applyFilters = () => {
    let filtered = [...leads];

    // Filter by status
    if (filterStatus === 'contacted') {
      filtered = filtered.filter(lead => lead.contacted);
    } else if (filterStatus === 'not_contacted') {
      filtered = filtered.filter(lead => !lead.contacted);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(lead => 
        lead.custom_name.toLowerCase().includes(searchLower) ||
        lead.industry?.toLowerCase().includes(searchLower) ||
        lead.location?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredLeads(filtered);
  };

  const handleToggleContacted = async (leadId: string, currentStatus: boolean) => {
    const { success } = await updateLeadContactedStatus(leadId, !currentStatus);
    if (success) {
      await loadLeads(currentUser.id);
      await loadStats(currentUser.id);
    }
  };

  const handleDeleteLead = async (leadId: string, companyName: string) => {
    if (confirm(`Are you sure you want to remove ${companyName} from your list?`)) {
      const { success } = await deleteLead(leadId);
      if (success) {
        await loadLeads(currentUser.id);
        await loadStats(currentUser.id);
      }
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#10051A' }}>
        <div className="text-purple-300">Loading your leads...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#10051A' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/5 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-purple-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
                Spread Checker
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/')}
                className="text-purple-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>

              <Button 
                variant="ghost" 
                onClick={() => navigate('/calculator')}
                className="text-purple-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Calculator
              </Button>

              {userRole === 'admin' && (
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/admin')}
                  className="text-purple-200 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              )}
              
              <Button 
                onClick={handleSignOut}
                variant="ghost"
                className="text-purple-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-32 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent mb-2">
              Your Leads
            </h1>
            <p className="text-purple-200/80">
              Manage companies you've contacted or found through search
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">Total Leads</p>
                  <p className="text-3xl font-bold text-purple-100">{stats.total}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">Contacted</p>
                  <p className="text-3xl font-bold text-green-400">{stats.contacted}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">Not Contacted</p>
                  <p className="text-3xl font-bold text-yellow-400">{stats.notContacted}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">From Calculator</p>
                  <p className="text-3xl font-bold text-blue-400">{stats.fromCalculator}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">From Search</p>
                  <p className="text-3xl font-bold text-purple-400">{stats.fromSearch}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-300" />
                  <Input
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/10 border-white/20 text-purple-100 placeholder:text-purple-300/60"
                  />
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setFilterStatus('all')}
                    variant={filterStatus === 'all' ? 'default' : 'outline'}
                    className={filterStatus === 'all' 
                      ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                      : 'border-white/20 text-purple-200 hover:bg-white/10'}
                  >
                    All ({stats.total})
                  </Button>
                  <Button
                    onClick={() => setFilterStatus('contacted')}
                    variant={filterStatus === 'contacted' ? 'default' : 'outline'}
                    className={filterStatus === 'contacted' 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'border-white/20 text-purple-200 hover:bg-white/10'}
                  >
                    Contacted ({stats.contacted})
                  </Button>
                  <Button
                    onClick={() => setFilterStatus('not_contacted')}
                    variant={filterStatus === 'not_contacted' ? 'default' : 'outline'}
                    className={filterStatus === 'not_contacted' 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                      : 'border-white/20 text-purple-200 hover:bg-white/10'}
                  >
                    Not Contacted ({stats.notContacted})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leads Table */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-purple-100 flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Companies ({filteredLeads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="h-12 w-12 text-purple-300 mx-auto mb-4 opacity-50" />
                  <p className="text-purple-200 mb-2">No companies found</p>
                  <p className="text-purple-300/60 text-sm">
                    {searchTerm || filterStatus !== 'all' 
                      ? 'Try adjusting your filters' 
                      : 'Start by doing a calculation or searching for companies'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Company Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-purple-100 truncate">
                              {lead.custom_name}
                            </h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              lead.source === 'calculator' 
                                ? 'bg-blue-600/30 text-blue-200' 
                                : 'bg-purple-600/30 text-purple-200'
                            }`}>
                              {lead.source === 'calculator' ? 'Calculator' : 'Search'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-3 text-sm text-purple-300">
                            {lead.industry && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {lead.industry}
                              </span>
                            )}
                            {lead.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {lead.location}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Added {new Date(lead.first_added_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                          {/* Contacted Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-purple-300 whitespace-nowrap">
                              {lead.contacted ? 'Contacted' : 'Not Contacted'}
                            </span>
                            <Switch
                              checked={lead.contacted}
                              onCheckedChange={() => handleToggleContacted(lead.id, lead.contacted)}
                              className={lead.contacted ? 'bg-green-500' : 'bg-gray-400'}
                            />
                          </div>

                          {/* Delete Button */}
                          <Button
                            onClick={() => handleDeleteLead(lead.id, lead.custom_name)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
