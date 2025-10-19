-- Add monthly reports settings to companies table

-- Add monthly_reports_enabled column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' AND column_name = 'monthly_reports_enabled'
  ) THEN
    ALTER TABLE companies ADD COLUMN monthly_reports_enabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN companies.monthly_reports_enabled IS 'Whether to send monthly client data reports to admins';
