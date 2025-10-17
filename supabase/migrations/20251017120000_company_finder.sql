-- Company Finder Feature Migration
-- Creates tables for storing similar companies and search history

-- Table to store similar companies found by the AI
CREATE TABLE IF NOT EXISTS similar_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  source_company_name text NOT NULL,
  similar_company_name text NOT NULL,
  industry text,
  company_size text,
  turnover_range text,
  location text,
  country text,
  reasoning text,
  confidence_score numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Table to track company search history
CREATE TABLE IF NOT EXISTS company_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query text NOT NULL,
  results_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_similar_companies_company_id ON similar_companies(company_id);
CREATE INDEX IF NOT EXISTS idx_similar_companies_source_company ON similar_companies(source_company_name);
CREATE INDEX IF NOT EXISTS idx_company_searches_company_id ON company_searches(company_id);
CREATE INDEX IF NOT EXISTS idx_company_searches_user_id ON company_searches(user_id);

-- RLS Policies for similar_companies table
ALTER TABLE similar_companies ENABLE ROW LEVEL SECURITY;

-- Admins can view their company's similar companies
CREATE POLICY "Admins can view their company's similar companies"
ON similar_companies
FOR SELECT
TO public
USING (
  company_id IN (
    SELECT user_profiles.company_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role_type = ANY (ARRAY['admin'::text, 'super_admin'::text])
  )
);

-- Admins can insert similar companies for their company
CREATE POLICY "Admins can insert similar companies"
ON similar_companies
FOR INSERT
TO public
WITH CHECK (
  company_id IN (
    SELECT user_profiles.company_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role_type = ANY (ARRAY['admin'::text, 'super_admin'::text])
  )
);

-- Admins can delete their company's similar companies
CREATE POLICY "Admins can delete their company's similar companies"
ON similar_companies
FOR DELETE
TO public
USING (
  company_id IN (
    SELECT user_profiles.company_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role_type = ANY (ARRAY['admin'::text, 'super_admin'::text])
  )
);

-- RLS Policies for company_searches table
ALTER TABLE company_searches ENABLE ROW LEVEL SECURITY;

-- Users can view their own search history
CREATE POLICY "Users can view their own search history"
ON company_searches
FOR SELECT
TO public
USING (
  user_id = auth.uid()
  OR
  company_id IN (
    SELECT user_profiles.company_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role_type = ANY (ARRAY['admin'::text, 'super_admin'::text])
  )
);

-- Users can insert their own searches
CREATE POLICY "Users can insert their own searches"
ON company_searches
FOR INSERT
TO public
WITH CHECK (
  user_id = auth.uid()
  AND
  company_id IN (
    SELECT user_profiles.company_id
    FROM user_profiles
    WHERE user_profiles.id = auth.uid()
  )
);
