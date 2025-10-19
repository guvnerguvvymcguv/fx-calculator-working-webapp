-- Add monthly_reports_enabled column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS monthly_reports_enabled BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN companies.monthly_reports_enabled IS 'Whether to send monthly client intelligence reports to admins';
