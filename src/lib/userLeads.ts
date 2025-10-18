/**
 * Database operations for User Leads Management
 * Handles CRUD operations for user_leads table with smart duplicate detection
 */

import { supabase } from './supabase';
import { normalizeCompanyName, isSimilarCompany } from './companyNameUtils';

export interface UserLead {
  id: string;
  user_id: string;
  companies_house_id?: string; // Links to companies_house_data table
  custom_name: string;
  normalized_name: string;
  company_number?: string;
  contacted: boolean;
  source: 'calculator' | 'manual_search' | 'similar_results';
  first_added_at: string;
  last_contacted_at?: string;
  updated_at: string;
  industry?: string;
  sic_codes?: string[];
  estimated_size?: string;
  location?: string;
  postcode?: string;
  notes?: string;
}

export interface AddLeadParams {
  userId: string;
  companyName: string;
  source: 'calculator' | 'manual_search' | 'similar_results';
  contacted?: boolean;
  companyNumber?: string;
  industry?: string;
  sicCodes?: string[];
  estimatedSize?: string;
  location?: string;
  postcode?: string;
}

/**
 * Find existing lead by company name (with fuzzy matching)
 * Checks for exact normalized match and similar names
 */
export async function findExistingLead(
  userId: string,
  companyName: string
): Promise<UserLead | null> {
  const normalized = normalizeCompanyName(companyName);

  // First try exact normalized match
  const { data: exactMatch } = await supabase
    .from('user_leads')
    .select('*')
    .eq('user_id', userId)
    .eq('normalized_name', normalized)
    .single();

  if (exactMatch) return exactMatch;

  // If no exact match, check all user's leads for fuzzy match
  const { data: allLeads } = await supabase
    .from('user_leads')
    .select('*')
    .eq('user_id', userId);

  if (allLeads) {
    for (const lead of allLeads) {
      if (isSimilarCompany(companyName, lead.custom_name)) {
        return lead;
      }
    }
  }

  return null;
}

/**
 * Add or update a lead
 * Returns existing lead if found, creates new one otherwise
 */
export async function addOrUpdateLead(
  params: AddLeadParams
): Promise<{ success: boolean; lead: UserLead | null; isNew: boolean; message: string }> {
  try {
    const { userId, companyName, source, contacted = false } = params;
    const normalized = normalizeCompanyName(companyName);

    // Check for existing lead
    const existingLead = await findExistingLead(userId, companyName);

    if (existingLead) {
      // Update existing lead
      const updates: Partial<UserLead> = {
        updated_at: new Date().toISOString(),
      };

      // If this is from calculator, mark as contacted
      if (source === 'calculator') {
        updates.contacted = true;
        updates.last_contacted_at = new Date().toISOString();
      }

      // Update company metadata if provided
      if (params.industry) updates.industry = params.industry;
      if (params.sicCodes) updates.sic_codes = params.sicCodes;
      if (params.estimatedSize) updates.estimated_size = params.estimatedSize;
      if (params.location) updates.location = params.location;
      if (params.postcode) updates.postcode = params.postcode;

      const { data: updatedLead, error } = await supabase
        .from('user_leads')
        .update(updates)
        .eq('id', existingLead.id)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        lead: updatedLead,
        isNew: false,
        message: source === 'calculator' 
          ? `Marked ${companyName} as contacted`
          : `${companyName} already in your list`
      };
    }

    // Create new lead
    const newLead = {
      user_id: userId,
      custom_name: companyName,
      normalized_name: normalized,
      company_number: params.companyNumber,
      contacted,
      source,
      first_added_at: new Date().toISOString(),
      last_contacted_at: contacted ? new Date().toISOString() : null,
      industry: params.industry,
      sic_codes: params.sicCodes,
      estimated_size: params.estimatedSize,
      location: params.location,
      postcode: params.postcode,
    };

    const { data: createdLead, error } = await supabase
      .from('user_leads')
      .insert(newLead)
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      lead: createdLead,
      isNew: true,
      message: `Added ${companyName} to your list`
    };

  } catch (error) {
    console.error('Error adding/updating lead:', error);
    return {
      success: false,
      lead: null,
      isNew: false,
      message: error instanceof Error ? error.message : 'Failed to add lead'
    };
  }
}

/**
 * Get all leads for a user with optional filtering
 */
export async function getUserLeads(
  userId: string,
  filters?: {
    contacted?: boolean;
    source?: string;
    searchTerm?: string;
  }
): Promise<{ success: boolean; leads: UserLead[]; error?: string }> {
  try {
    let query = supabase
      .from('user_leads')
      .select('*')
      .eq('user_id', userId)
      .order('first_added_at', { ascending: false });

    if (filters?.contacted !== undefined) {
      query = query.eq('contacted', filters.contacted);
    }

    if (filters?.source) {
      query = query.eq('source', filters.source);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Client-side search filtering (for fuzzy matching)
    let leads = data || [];
    if (filters?.searchTerm) {
      const searchNormalized = normalizeCompanyName(filters.searchTerm);
      leads = leads.filter(lead => 
        lead.normalized_name.includes(searchNormalized) ||
        isSimilarCompany(filters.searchTerm, lead.custom_name)
      );
    }

    return { success: true, leads };

  } catch (error) {
    console.error('Error fetching leads:', error);
    return {
      success: false,
      leads: [],
      error: error instanceof Error ? error.message : 'Failed to fetch leads'
    };
  }
}

/**
 * Update lead contacted status
 */
export async function updateLeadContactedStatus(
  leadId: string,
  contacted: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: Partial<UserLead> = {
      contacted,
      updated_at: new Date().toISOString(),
    };

    if (contacted) {
      updates.last_contacted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('user_leads')
      .update(updates)
      .eq('id', leadId);

    if (error) throw error;

    return { success: true };

  } catch (error) {
    console.error('Error updating lead status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update lead'
    };
  }
}

/**
 * Delete a lead
 */
export async function deleteLead(leadId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_leads')
      .delete()
      .eq('id', leadId);

    if (error) throw error;

    return { success: true };

  } catch (error) {
    console.error('Error deleting lead:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete lead'
    };
  }
}

/**
 * Get lead statistics for a user
 */
export async function getLeadStats(
  userId: string
): Promise<{
  total: number;
  contacted: number;
  notContacted: number;
  fromCalculator: number;
  fromSearch: number;
}> {
  const { data: leads } = await supabase
    .from('user_leads')
    .select('contacted, source')
    .eq('user_id', userId);

  if (!leads) {
    return {
      total: 0,
      contacted: 0,
      notContacted: 0,
      fromCalculator: 0,
      fromSearch: 0
    };
  }

  return {
    total: leads.length,
    contacted: leads.filter(l => l.contacted).length,
    notContacted: leads.filter(l => !l.contacted).length,
    fromCalculator: leads.filter(l => l.source === 'calculator').length,
    fromSearch: leads.filter(l => l.source === 'manual_search' || l.source === 'similar_results').length
  };
}

/**
 * Check if a company is already in user's lead list
 */
export async function isCompanyInLeadList(
  userId: string,
  companyName: string
): Promise<{ inList: boolean; lead?: UserLead }> {
  const existingLead = await findExistingLead(userId, companyName);
  
  return {
    inList: !!existingLead,
    lead: existingLead || undefined
  };
}
