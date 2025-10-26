import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  Users, 
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
import { getUserLeads, updateLeadContactedStatus, deleteLead, getLeadStats, addOrUpdateLead } from '../lib/userLeads';
import type { UserLead } from '../lib/userLeads';
import { CalculationHistoryModal } from './ui/CalculationHistoryModal';

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
  const [companySearchTerm, setCompanySearchTerm] = useState(''); // Company search
  const [companySearchResults, setCompanySearchResults] = useState<any[]>([]); // Search results
  const [isSearching, setIsSearching] = useState(false); // Loading state
  const [addedCompanyNames, setAddedCompanyNames] = useState<Set<string>>(new Set()); // Track companies added in this session
  const [selectedLead, setSelectedLead] = useState<UserLead | null>(null); // For calculation history modal
  const [shownCompanies, setShownCompanies] = useState<string[]>([]); // Track all companies shown in this session
  const [hasSearched, setHasSearched] = useState(false); // Track if user has searched once
  const [currentOffset, setCurrentOffset] = useState(0); // Track pagination offset
  const [totalMatches, setTotalMatches] = useState(0); // Total number of matches found
  const [hasMoreResults, setHasMoreResults] = useState(false); // Whether more results available
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set()); // Track selected leads for bulk actions
  const [companyFinderEnabled, setCompanyFinderEnabled] = useState<boolean>(false); // Feature gate for Company Finder
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
    // Clear selection when filters change
    setSelectedLeads(new Set());
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
        
        // Check if Company Finder add-on is enabled
        const { data: company } = await supabase
          .from('companies')
          .select('company_finder_enabled')
          .eq('id', profile.company_id)
          .single();
        
        if (company) {
          setCompanyFinderEnabled(company.company_finder_enabled || false);
        }
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

  // Search for companies - using same logic as Calculator page
  const handleCompanySearch = async () => {
    if (companySearchTerm.length < 2) {
      return;
    }

    setIsSearching(true);
    
    try {
      // Get companies already in My Leads to exclude them
      const companiesInMyLeads = leads.map(lead => lead.custom_name);
      
      // Build exclusion list: shown companies + companies in My Leads
      const excludeCompanies = [
        ...shownCompanies,
        ...companiesInMyLeads
      ];
      
      console.log('Calling google-competitor-search API with:', {
        companyName: companySearchTerm,
        excludeCompanies,
        attempt: currentOffset / 5 + 1
      });
      
      // Call the same Supabase Edge Function used in Calculator
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-competitor-search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            companyName: companySearchTerm,
            limit: 5,
            excludeCompanies
          })
        }
      );

      const data = await response.json();
      console.log('API response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to find similar companies');
      }

      if (data.similarCompanies && data.similarCompanies.length > 0) {
        // Add new companies to shown list
        const newCompanyNames = data.similarCompanies.map((c: any) => c.name);
        setShownCompanies(prev => [...prev, ...newCompanyNames]);
        
        // Append to existing results (not replace)
        setCompanySearchResults(prev => [...prev, ...data.similarCompanies]);
        setHasSearched(true);
        setCurrentOffset(prev => prev + 5);
        setTotalMatches(prev => prev + data.similarCompanies.length);
        setHasMoreResults(true); // Allow searching for more
      } else {
        // No more companies found
        setHasMoreResults(false);
        if (!hasSearched) {
          alert('No similar companies found. Try a different company name.');
        } else {
          alert('No more similar companies found. All companies that match well enough have been shown!');
        }
      }
      
    } catch (error) {
      console.error('Error finding similar companies:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to find similar companies. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSearching(false);
    }
  };

  // Add company from search
  const handleAddFromSearch = async (companyName: string) => {
    const result = await addOrUpdateLead({
      userId: currentUser.id,
      companyName: companyName,
      source: 'manual_search',
      contacted: false
    });

    if (result.success) {
      // Add to session tracking
      const normalized = companyName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .replace(/\b(ltd|limited|plc|group|holdings|co|inc)\b/g, '')
        .trim()
        .replace(/\s+/g, '');
      
      setAddedCompanyNames(prev => new Set([...prev, normalized]));
      
      await loadLeads(currentUser.id);
      await loadStats(currentUser.id);
      alert(result.message);
    }
  };

  // Check if company already in leads
  const isCompanyInLeads = (companyName: string): boolean => {
    // Normalize the incoming company name using the same logic as normalizeCompanyName
    const normalized = companyName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Collapse whitespace
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(ltd|limited|plc|group|holdings|co|inc)\b/g, '') // Remove common suffixes
      .trim()
      .replace(/\s+/g, ''); // Remove all spaces
    
    console.log('Checking if company in leads:', {
      original: companyName,
      normalized: normalized,
      leadsCount: leads.length,
      addedThisSession: addedCompanyNames.has(normalized)
    });
    
    // Check if added in current session
    if (addedCompanyNames.has(normalized)) {
      console.log('Found in addedCompanyNames set');
      return true;
    }
    
    // Check against all leads (also remove spaces from their normalized names for comparison)
    const found = leads.some(lead => {
      const leadNormalized = lead.normalized_name?.replace(/\s+/g, '') || '';
      const matches = leadNormalized === normalized;
      if (matches) {
        console.log('Found match in leads:', lead.custom_name, leadNormalized);
      }
      return matches;
    });
    
    return found;
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Bulk action handlers
  const handleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      // Deselect all
      setSelectedLeads(new Set());
    } else {
      // Select all filtered leads
      const allIds = new Set(filteredLeads.map(lead => lead.id));
      setSelectedLeads(allIds);
    }
  };

  const handleToggleSelect = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleBulkMarkContacted = async (contacted: boolean) => {
    if (selectedLeads.size === 0) return;

    const confirmMessage = contacted
      ? `Mark ${selectedLeads.size} companies as contacted?`
      : `Mark ${selectedLeads.size} companies as not contacted?`;

    if (!confirm(confirmMessage)) return;

    try {
      // Update all selected leads
      for (const leadId of selectedLeads) {
        await updateLeadContactedStatus(leadId, contacted);
      }

      // Reload data
      await loadLeads(currentUser.id);
      await loadStats(currentUser.id);

      // Clear selection
      setSelectedLeads(new Set());

      alert(`Successfully updated ${selectedLeads.size} companies`);
    } catch (error) {
      console.error('Bulk update error:', error);
      alert('Failed to update some companies. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;

    if (!confirm(`Delete ${selectedLeads.size} companies from your list? This cannot be undone.`)) {
      return;
    }

    try {
      // Delete all selected leads
      for (const leadId of selectedLeads) {
        await deleteLead(leadId);
      }

      // Reload data
      await loadLeads(currentUser.id);
      await loadStats(currentUser.id);

      // Clear selection
      setSelectedLeads(new Set());

      alert(`Successfully deleted ${selectedLeads.size} companies`);
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert('Failed to delete some companies. Please try again.');
    }
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
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>

              <Button 
                variant="ghost" 
                onClick={() => navigate('/calculator')}
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Calculator
              </Button>

              {userRole === 'admin' && (
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/admin')}
                  className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
                >
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </Button>
              )}
              
              <Button 
                onClick={handleSignOut}
                variant="ghost"
                className="text-purple-200 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all duration-200"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Locked Overlay - Shows when Company Finder is disabled */}
      {!companyFinderEnabled && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ paddingTop: '5rem' }}>
          {/* Lock Message Box - Clear and on top */}
          <div className="relative z-50 max-w-md w-full bg-gray-900/95 border border-purple-600/50 rounded-lg p-8 text-center shadow-2xl">
            <div className="mb-6">
              <div className="w-16 h-16 bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Feature Locked</h1>
              <p className="text-gray-300">
                This feature requires the Company Finder add-on. Please contact your admin to enable this feature.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Blurred when locked */}
      <div className={!companyFinderEnabled ? 'filter blur-sm pointer-events-none select-none' : ''}>
        <div className="pt-32 pb-12 px-4">
          <div className="max-w-7xl mx-auto">
          {/* Company Search Section - Feature Gated */}
          {!companyFinderEnabled ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300 mb-8">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-purple-100 mb-2">
                    Company Finder Not Available
                  </h3>
                  <p className="text-purple-200/80 max-w-md">
                    This feature requires the Company Finder add-on. Please contact your admin to enable this feature.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300 mb-8">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-5 w-5 text-purple-300" />
                    <h3 className="text-lg font-semibold text-purple-100">Find New Companies</h3>
                  </div>
                
                {/* Search Bar + Button */}
                <div className="flex gap-3">
                  <div className="flex-1 max-w-2xl relative">
                    <Input
                      placeholder="Search for UK companies to add..."
                      value={companySearchTerm}
                      onChange={(e) => {
                        setCompanySearchTerm(e.target.value);
                        // Reset search results when user changes the search term
                        if (hasSearched && e.target.value !== companySearchTerm) {
                          setCompanySearchResults([]);
                          setShownCompanies([]);
                          setHasSearched(false);
                          setCurrentOffset(0);
                          setTotalMatches(0);
                          setHasMoreResults(false);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && companySearchTerm.length >= 2) {
                          handleCompanySearch();
                        }
                      }}
                      className="bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                    />
                  </div>
                  <Button
                    onClick={handleCompanySearch}
                    disabled={isSearching || companySearchTerm.length < 2}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold px-6 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0 whitespace-nowrap"
                  >
                    {isSearching ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        {hasSearched ? 'Find More' : 'Search'}
                      </>
                    )}
                  </Button>
                </div>

                {/* Search Results Dropdown */}
                {companySearchResults.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm text-purple-200 font-medium">
                      Showing {companySearchResults.length} of {totalMatches} similar companies
                    </p>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                    {companySearchResults.map((company, index) => (
                      <div
                        key={index}
                        className="p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-purple-100 mb-1">{company.name}</h4>
                            <p className="text-sm text-purple-300 mb-2">{company.industry}</p>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="px-2 py-1 bg-purple-600/30 rounded text-purple-200">
                                📍 {company.location}
                              </span>
                              <span className="px-2 py-1 bg-blue-600/30 rounded text-blue-200">
                                {company.size}
                              </span>
                            </div>
                            {company.reasoning && (
                              <p className="text-sm text-purple-200 mt-2 italic">"{company.reasoning}"</p>
                            )}
                          </div>
                          
                          {isCompanyInLeads(company.name) ? (
                            <span className="px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] text-sm whitespace-nowrap cursor-default">
                              ✓ Added
                            </span>
                          ) : (
                            <Button
                              onClick={() => handleAddFromSearch(company.name)}
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                            >
                              Add to List
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    </div>
                    
                    {/* Find More Button */}
                    {hasMoreResults && (
                      <Button
                        onClick={handleCompanySearch}
                        disabled={isSearching}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0"
                      >
                        {isSearching ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                            Finding Similar Companies...
                          </>
                        ) : (
                          <>
                            <Search className="h-4 w-4 mr-2" />
                            Find More Similar Companies
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {companySearchTerm.length >= 2 && !isSearching && companySearchResults.length === 0 && hasSearched && (
                  <p className="text-sm text-purple-300/60 text-center py-4">
                    No companies found. Try a different search term.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>)}

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
            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">Total Leads</p>
                  <p className="text-3xl font-bold text-purple-100">{stats.total}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">Contacted</p>
                  <p className="text-3xl font-bold text-purple-100">{stats.contacted}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">Not Contacted</p>
                  <p className="text-3xl font-bold text-purple-100">{stats.notContacted}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">From Calculator</p>
                  <p className="text-3xl font-bold text-purple-100">{stats.fromCalculator}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-purple-300 mb-1">From Search</p>
                  <p className="text-3xl font-bold text-purple-100">{stats.fromSearch}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20 rounded-xl shadow-xl hover:border-white/30 transition-all duration-300 mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-300" />
                  <Input
                    placeholder="Search companies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-gray-950/50 border border-white/0 hover:border-white/20 focus:border-white/40 text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors duration-200 outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:ring-offset-0 rounded-lg placeholder-gray-500"
                  />
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setFilterStatus('all')}
                    className={filterStatus === 'all'
                      ? 'bg-purple-600 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] cursor-default'
                      : 'text-purple-200 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10 border transition-all duration-200'}
                  >
                    All ({stats.total})
                  </Button>
                  <Button
                    onClick={() => setFilterStatus('contacted')}
                    className={filterStatus === 'contacted'
                      ? 'bg-purple-600 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] cursor-default'
                      : 'text-purple-200 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10 border transition-all duration-200'}
                  >
                    Contacted ({stats.contacted})
                  </Button>
                  <Button
                    onClick={() => setFilterStatus('not_contacted')}
                    className={filterStatus === 'not_contacted'
                      ? 'bg-purple-600 text-white font-semibold shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] cursor-default'
                      : 'text-purple-200 hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10 border transition-all duration-200'}
                  >
                    Not Contacted ({stats.notContacted})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions Bar */}
          {selectedLeads.size > 0 && (
            <Card className="bg-purple-600/20 backdrop-blur-md border-purple-400/30 rounded-xl shadow-xl mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-purple-100 font-semibold">
                      {selectedLeads.size} {selectedLeads.size === 1 ? 'company' : 'companies'} selected
                    </span>
                    <Button
                      onClick={() => setSelectedLeads(new Set())}
                      variant="ghost"
                      size="sm"
                      className="text-purple-200 hover:text-white hover:bg-white/10"
                    >
                      Clear Selection
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleBulkMarkContacted(true)}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Mark as Contacted
                    </Button>
                    <Button
                      onClick={() => handleBulkMarkContacted(false)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white"
                    >
                      Mark as Not Contacted
                    </Button>
                    <Button
                      onClick={handleBulkDelete}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leads Table */}
          <Card className="bg-white/10 backdrop-blur-md border-white/20">
            <CardHeader>
              <CardTitle className="text-purple-100 flex items-center gap-2">
                {/* Select All Checkbox */}
                <input
                  type="checkbox"
                  checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                />
                <Users className="h-5 w-5" />
                Companies ({filteredLeads.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-purple-300 mx-auto mb-4 opacity-50" />
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
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => handleToggleSelect(lead.id)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                        />
                        
                        {/* Company Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 
                              className="text-lg font-semibold text-purple-100 truncate cursor-pointer hover:text-purple-300 transition-colors"
                              onClick={() => setSelectedLead(lead)}
                            >
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
                            {lead.last_calculated_at && (
                              <span className="flex items-center gap-1 text-blue-300">
                                <TrendingUp className="h-3 w-3" />
                                Last calculated {new Date(lead.last_calculated_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-4">
                          {/* Contacted Toggle */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-purple-300 whitespace-nowrap">
                              {lead.contacted ? 'Contacted' : 'Not Contacted'}
                            </span>
                            <button
                              onClick={() => handleToggleContacted(lead.id, lead.contacted)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                                lead.contacted ? 'bg-purple-600' : 'bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  lead.contacted ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
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

      {/* Calculation History Modal */}
      {selectedLead && (
        <CalculationHistoryModal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          companyName={selectedLead.custom_name}
          normalizedName={selectedLead.normalized_name}
        />
      )}
    </div>
  );
}
