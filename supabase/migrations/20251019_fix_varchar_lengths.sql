-- Fix VARCHAR lengths for companies_house_data
-- Some values are longer than 50 characters

ALTER TABLE companies_house_data 
  ALTER COLUMN company_type TYPE VARCHAR(100);

ALTER TABLE companies_house_data 
  ALTER COLUMN accounts_category TYPE VARCHAR(100);

ALTER TABLE companies_house_data 
  ALTER COLUMN country TYPE VARCHAR(100);

ALTER TABLE companies_house_data 
  ALTER COLUMN company_status TYPE VARCHAR(50);
