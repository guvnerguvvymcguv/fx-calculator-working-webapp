-- Phase 1: Lead Management System - Clean Migration
-- Creates new tables without conflicting with existing schema

-- 1. USER'S SAVED LEADS/COMPANIES (NEW TABLE)
CREATE TABLE IF NOT EXISTS user_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  companies_house_id UUID, -- Will link to companies_house_data table
  
  -- Company identification
  custom_name VARCHAR(200) NOT NULL,
  normalized_name VARCHAR(200) NOT NULL,
  company_number VARCHAR(8),
  
  -- Status tracking
  contacted BOOLEAN DEFAULT false,
  source VARCHAR(50) NOT NULL, -- 'calculator' | 'manual_search' | 'similar_results'
  
  -- Timestamps
  first_added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Cached company metadata
  industry VARCHAR(100),
  sic_codes TEXT[],
  estimated_size VARCHAR(50),
  location VARCHAR(200),
  postcode VARCHAR(10),
  notes TEXT,
  
  UNIQUE(user_id, normalized_name)
);

-- 2. COMPANIES HOUSE BULK DATA (NEW TABLE - different from existing 'companies')
-- This is for UK Companies House data, separate from your subscription 'companies' table
CREATE TABLE IF NOT EXISTS companies_house_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  accounts_category VARCHAR(50),
  num_mort_charges INTEGER DEFAULT 0,
  last_accounts_date DATE,
  
  -- Location
  postcode VARCHAR(10),
  postcode_prefix VARCHAR(3),
  post_town VARCHAR(50),
  county VARCHAR(100),
  country VARCHAR(50),
  address_line1 VARCHAR(300),
  
  -- Metadata
  company_age INTEGER,
  date_of_creation DATE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_source VARCHAR(50) DEFAULT 'companies_house'
);

-- 3. ADD COLUMNS TO EXISTING CALCULATIONS TABLE
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculations' AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE calculations ADD COLUMN lead_id UUID REFERENCES user_leads(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'calculations' AND column_name = 'normalized_client_name'
  ) THEN
    ALTER TABLE calculations ADD COLUMN normalized_client_name VARCHAR(200);
  END IF;
END $$;

-- 4. SIMILAR COMPANIES CACHE (NEW TABLE)
CREATE TABLE IF NOT EXISTS similar_companies_cache (
  source_company_id UUID REFERENCES companies_house_data(id) ON DELETE CASCADE,
  similar_company_id UUID REFERENCES companies_house_data(id) ON DELETE CASCADE,
  similarity_score NUMERIC(3,2),
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (source_company_id, similar_company_id)
);

-- INDEXES
-- user_leads indexes
CREATE INDEX IF NOT EXISTS idx_user_leads_user ON user_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_leads_normalized ON user_leads(normalized_name);
CREATE INDEX IF NOT EXISTS idx_user_leads_contacted ON user_leads(contacted);
CREATE INDEX IF NOT EXISTS idx_user_leads_source ON user_leads(source);
CREATE INDEX IF NOT EXISTS idx_user_leads_created ON user_leads(first_added_at DESC);

-- calculations indexes
CREATE INDEX IF NOT EXISTS idx_calculations_lead ON calculations(lead_id);
CREATE INDEX IF NOT EXISTS idx_calculations_normalized ON calculations(normalized_client_name);

-- companies_house_data indexes
CREATE INDEX IF NOT EXISTS idx_ch_data_number ON companies_house_data(company_number);
CREATE INDEX IF NOT EXISTS idx_ch_data_status ON companies_house_data(company_status) WHERE company_status = 'active';
CREATE INDEX IF NOT EXISTS idx_ch_data_accounts ON companies_house_data(accounts_category);
CREATE INDEX IF NOT EXISTS idx_ch_data_postcode ON companies_house_data(postcode_prefix);
CREATE INDEX IF NOT EXISTS idx_ch_data_sic1 ON companies_house_data(sic_code1);
CREATE INDEX IF NOT EXISTS idx_ch_data_sic2 ON companies_house_data(sic_code2);
CREATE INDEX IF NOT EXISTS idx_ch_data_sic3 ON companies_house_data(sic_code3);
CREATE INDEX IF NOT EXISTS idx_ch_data_sic4 ON companies_house_data(sic_code4);
CREATE INDEX IF NOT EXISTS idx_ch_data_recent_accounts ON companies_house_data(last_accounts_date) 
  WHERE last_accounts_date > '2024-01-01';
CREATE INDEX IF NOT EXISTS idx_ch_data_name_search ON companies_house_data 
  USING gin(to_tsvector('english', company_name));

-- similar_companies_cache indexes
CREATE INDEX IF NOT EXISTS idx_cache_source ON similar_companies_cache(source_company_id);
CREATE INDEX IF NOT EXISTS idx_cache_score ON similar_companies_cache(similarity_score DESC);

-- ROW LEVEL SECURITY
-- user_leads RLS
ALTER TABLE user_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own leads" ON user_leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON user_leads;
DROP POLICY IF EXISTS "Users can update own leads" ON user_leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON user_leads;

CREATE POLICY "Users can view own leads"
  ON user_leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads"
  ON user_leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads"
  ON user_leads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads"
  ON user_leads FOR DELETE
  USING (auth.uid() = user_id);

-- companies_house_data RLS (read-only for authenticated)
ALTER TABLE companies_house_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read CH data" ON companies_house_data;

CREATE POLICY "Authenticated users can read CH data"
  ON companies_house_data FOR SELECT
  TO authenticated
  USING (true);

-- similar_companies_cache RLS (read-only for authenticated)
ALTER TABLE similar_companies_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cache" ON similar_companies_cache;

CREATE POLICY "Authenticated users can read cache"
  ON similar_companies_cache FOR SELECT
  TO authenticated
  USING (true);

-- TRIGGER for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_leads_updated_at ON user_leads;

CREATE TRIGGER update_user_leads_updated_at
  BEFORE UPDATE ON user_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- COMMENTS
COMMENT ON TABLE user_leads IS 'User saved companies/leads from calculator or search';
COMMENT ON TABLE companies_house_data IS 'Companies House bulk data for similarity matching';
COMMENT ON TABLE similar_companies_cache IS 'Precomputed similarity scores';
COMMENT ON COLUMN user_leads.normalized_name IS 'Lowercase, no punctuation for duplicate detection';
COMMENT ON COLUMN user_leads.source IS 'calculator | manual_search | similar_results';
COMMENT ON COLUMN companies_house_data.accounts_category IS 'MICRO-ENTITY/SMALL/MEDIUM/FULL/GROUP';
