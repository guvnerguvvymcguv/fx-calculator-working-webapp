-- Add add-on status columns to companies table
-- These track whether each company has the add-ons enabled

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS company_finder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS client_data_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN companies.company_finder_enabled IS 'Whether Company Finder add-on is active (£5/mo or included in annual)';
COMMENT ON COLUMN companies.client_data_enabled IS 'Whether Client Data Tracking add-on is active (£5/mo or included in annual)';
