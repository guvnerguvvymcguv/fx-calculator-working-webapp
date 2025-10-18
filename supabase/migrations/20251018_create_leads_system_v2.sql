-- Phase 1: Lead Management System (Fixed for existing companies table)
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
-- Add columns to existing calculations table if they don't exist

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

-- 3. UPDATE EXISTING COMPANIES TABLE (don't recreate, just add missing columns)
-- The companies table already exists, so we'll add any missing columns

DO $$
BEGIN
  -- Add company_number if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_number'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_number VARCHAR(8) UNIQUE;
  END IF;

  -- Add company_name if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_name TEXT NOT NULL DEFAULT '';
  END IF;

  -- Add company_status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_status'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_status VARCHAR(20);
  END IF;

  -- Add company_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_type'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_type VARCHAR(50);
  END IF;

  -- Add SIC codes if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'sic_code1'
  ) THEN
    ALTER TABLE companies ADD COLUMN sic_code1 VARCHAR(5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'sic_code2'
  ) THEN
    ALTER TABLE companies ADD COLUMN sic_code2 VARCHAR(5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'sic_code3'
  ) THEN
    ALTER TABLE companies ADD COLUMN sic_code3 VARCHAR(5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'sic_code4'
  ) THEN
    ALTER TABLE companies ADD COLUMN sic_code4 VARCHAR(5);
  END IF;

  -- Add size indicators if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'accounts_category'
  ) THEN
    ALTER TABLE companies ADD COLUMN accounts_category VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'num_mort_charges'
  ) THEN
    ALTER TABLE companies ADD COLUMN num_mort_charges INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'last_accounts_date'
  ) THEN
    ALTER TABLE companies ADD COLUMN last_accounts_date DATE;
  END IF;

  -- Add location fields if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'postcode'
  ) THEN
    ALTER TABLE companies ADD COLUMN postcode VARCHAR(10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'postcode_prefix'
  ) THEN
    ALTER TABLE companies ADD COLUMN postcode_prefix VARCHAR(3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'post_town'
  ) THEN
    ALTER TABLE companies ADD COLUMN post_town VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'county'
  ) THEN
    ALTER TABLE companies ADD COLUMN county VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'country'
  ) THEN
    ALTER TABLE companies ADD COLUMN country VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE companies ADD COLUMN address_line1 VARCHAR(300);
  END IF;

  -- Add derived fields if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_age'
  ) THEN
    ALTER TABLE companies ADD COLUMN company_age INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'date_of_creation'
  ) THEN
    ALTER TABLE companies ADD COLUMN date_of_creation DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE companies ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'data_source'
  ) THEN
    ALTER TABLE companies ADD COLUMN data_source VARCHAR(50) DEFAULT 'companies_house';
  END IF;
END $$;

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

-- companies indexes (only create if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_number ON companies(company_number);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_status'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(company_status) WHERE company_status = 'active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'accounts_category'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_accounts ON companies(accounts_category);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'postcode_prefix'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_postcode ON companies(postcode_prefix);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'sic_code1'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_sic1 ON companies(sic_code1);
    CREATE INDEX IF NOT EXISTS idx_companies_sic2 ON companies(sic_code2);
    CREATE INDEX IF NOT EXISTS idx_companies_sic3 ON companies(sic_code3);
    CREATE INDEX IF NOT EXISTS idx_companies_sic4 ON companies(sic_code4);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'last_accounts_date'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_recent_accounts ON companies(last_accounts_date) 
      WHERE last_accounts_date > '2024-01-01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'company_name'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_companies_name_search ON companies 
      USING gin(to_tsvector('english', company_name));
  END IF;
END $$;

-- similar_companies_cache indexes
CREATE INDEX IF NOT EXISTS idx_cache_source ON similar_companies_cache(source_company_id);
CREATE INDEX IF NOT EXISTS idx_cache_score ON similar_companies_cache(similarity_score DESC);

-- ROW LEVEL SECURITY (RLS) Policies
-- Enable RLS on user_leads
ALTER TABLE user_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can view own leads" ON user_leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON user_leads;
DROP POLICY IF EXISTS "Users can update own leads" ON user_leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON user_leads;

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

DROP POLICY IF EXISTS "Authenticated users can read companies" ON companies;

CREATE POLICY "Authenticated users can read companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

-- Cache table is read-only for all authenticated users
ALTER TABLE similar_companies_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cache" ON similar_companies_cache;

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

DROP TRIGGER IF EXISTS update_user_leads_updated_at ON user_leads;

CREATE TRIGGER update_user_leads_updated_at
  BEFORE UPDATE ON user_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- COMMENTS for documentation
COMMENT ON TABLE user_leads IS 'Stores companies that users have saved/contacted via calculator or search';
COMMENT ON TABLE similar_companies_cache IS 'Precomputed similarity scores for performance';
COMMENT ON COLUMN user_leads.normalized_name IS 'Lowercase, no punctuation version for duplicate detection';
COMMENT ON COLUMN user_leads.source IS 'How the lead was added: calculator, manual_search, or similar_results';
