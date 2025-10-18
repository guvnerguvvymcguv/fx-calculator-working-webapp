-- Phase 1: Lead Management System
-- Creates tables for tracking user leads and company searches

-- 1. USER'S SAVED LEADS/COMPANIES
CREATE TABLE IF NOT EXISTS user_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID, -- Will link to bulk companies table later
  
  -- Company identification
  custom_name VARCHAR(200) NOT NULL, -- What user typed (e.g., "Superdry")
  normalized_name VARCHAR(200) NOT NULL, -- Cleaned version for matching
  company_number VARCHAR(8), -- From Companies House
  
  -- Status tracking
  contacted BOOLEAN DEFAULT false,
  source VARCHAR(50) NOT NULL, -- 'calculator' | 'manual_search' | 'similar_results'
  
  -- Timestamps
  first_added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Company metadata (cached from search)
  industry VARCHAR(100),
  sic_codes TEXT[], -- Array of SIC codes
  estimated_size VARCHAR(50), -- MICRO/SMALL/MEDIUM/FULL/GROUP
  location VARCHAR(200),
  postcode VARCHAR(10),
  
  -- User notes
  notes TEXT,
  
  -- Prevent duplicate leads per user
  UNIQUE(user_id, normalized_name)
);

-- 2. ENHANCED CALCULATIONS TABLE (links to leads)
-- Note: We already have a calculations table, so we'll add columns via ALTER
-- This migration will add the missing columns if they don't exist

DO $$ 
BEGIN
  -- Add lead_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculations' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE calculations ADD COLUMN lead_id UUID REFERENCES user_leads(id) ON DELETE SET NULL;
  END IF;

  -- Add normalized_client_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculations' AND column_name = 'normalized_client_name'
  ) THEN
    ALTER TABLE calculations ADD COLUMN normalized_client_name VARCHAR(200);
  END IF;
END $$;

-- 3. COMPANIES BULK DATA TABLE (for Companies House import)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_number VARCHAR(8) UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  company_status VARCHAR(20),
  company_type VARCHAR(50),
  
  -- Industry codes
  sic_code1 VARCHAR(5),
  sic_code2 VARCHAR(5),
  sic_code3 VARCHAR(5),
  sic_code4 VARCHAR(5),
  
  -- Size indicators
  accounts_category VARCHAR(50), -- FULL/GROUP/SMALL/MICRO/etc
  num_mort_charges INTEGER DEFAULT 0, -- Number of mortgages (size proxy)
  last_accounts_date DATE, -- Account recency
  
  -- Location
  postcode VARCHAR(10),
  postcode_prefix VARCHAR(3), -- First 3 chars for regional matching
  post_town VARCHAR(50),
  county VARCHAR(100),
  country VARCHAR(50),
  address_line1 VARCHAR(300),
  
  -- Derived fields
  company_age INTEGER, -- Years since incorporation
  date_of_creation DATE,
  
  -- Meta
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_source VARCHAR(50) DEFAULT 'companies_house'
);

-- 4. SIMILAR COMPANIES CACHE (for performance optimization)
CREATE TABLE IF NOT EXISTS similar_companies_cache (
  source_company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  similar_company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  similarity_score NUMERIC(3,2), -- 0.00 to 1.00
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  PRIMARY KEY (source_company_id, similar_company_id)
);

-- INDEXES for fast queries
-- user_leads indexes
CREATE INDEX IF NOT EXISTS idx_user_leads_user ON user_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leads_normalized ON user_leads(normalized_name);
CREATE INDEX IF NOT EXISTS idx_user_leads_contacted ON user_leads(contacted);
CREATE INDEX IF NOT EXISTS idx_user_leads_source ON user_leads(source);
CREATE INDEX IF NOT EXISTS idx_user_leads_created ON user_leads(first_added_at DESC);

-- calculations indexes
CREATE INDEX IF NOT EXISTS idx_calculations_lead ON calculations(lead_id);
CREATE INDEX IF NOT EXISTS idx_calculations_normalized ON calculations(normalized_client_name);

-- companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_number ON companies(company_number);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(company_status) WHERE company_status = 'active';
CREATE INDEX IF NOT EXISTS idx_companies_accounts ON companies(accounts_category);
CREATE INDEX IF NOT EXISTS idx_companies_postcode ON companies(postcode_prefix);
CREATE INDEX IF NOT EXISTS idx_companies_sic1 ON companies(sic_code1);
CREATE INDEX IF NOT EXISTS idx_companies_sic2 ON companies(sic_code2);
CREATE INDEX IF NOT EXISTS idx_companies_sic3 ON companies(sic_code3);
CREATE INDEX IF NOT EXISTS idx_companies_sic4 ON companies(sic_code4);
CREATE INDEX IF NOT EXISTS idx_companies_recent_accounts ON companies(last_accounts_date) 
  WHERE last_accounts_date > '2024-01-01';

-- GIN index for full-text search on company names
CREATE INDEX IF NOT EXISTS idx_companies_name_search ON companies 
  USING gin(to_tsvector('english', company_name));

-- similar_companies_cache indexes
CREATE INDEX IF NOT EXISTS idx_cache_source ON similar_companies_cache(source_company_id);
CREATE INDEX IF NOT EXISTS idx_cache_score ON similar_companies_cache(similarity_score DESC);

-- ROW LEVEL SECURITY (RLS) Policies
-- Enable RLS on user_leads
ALTER TABLE user_leads ENABLE ROW LEVEL SECURITY;

-- Users can only see their own leads
CREATE POLICY "Users can view own leads"
  ON user_leads FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own leads
CREATE POLICY "Users can insert own leads"
  ON user_leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own leads
CREATE POLICY "Users can update own leads"
  ON user_leads FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own leads
CREATE POLICY "Users can delete own leads"
  ON user_leads FOR DELETE
  USING (auth.uid() = user_id);

-- Companies table is read-only for all authenticated users
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Cache table is read-only for all authenticated users
ALTER TABLE similar_companies_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cache"
  ON similar_companies_cache FOR SELECT
  TO authenticated
  USING (true);

-- TRIGGER: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_leads_updated_at
  BEFORE UPDATE ON user_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- COMMENTS for documentation
COMMENT ON TABLE user_leads IS 'Stores companies that users have saved/contacted via calculator or search';
COMMENT ON TABLE companies IS 'Bulk Companies House data for similarity matching';
COMMENT ON TABLE similar_companies_cache IS 'Precomputed similarity scores for performance';
COMMENT ON COLUMN user_leads.normalized_name IS 'Lowercase, no punctuation version for duplicate detection';
COMMENT ON COLUMN user_leads.source IS 'How the lead was added: calculator, manual_search, or similar_results';
COMMENT ON COLUMN companies.accounts_category IS 'MICRO-ENTITY/SMALL/MEDIUM/FULL/GROUP - indicates company size';
COMMENT ON COLUMN companies.num_mort_charges IS 'Number of mortgages - proxy for company size/borrowing';
