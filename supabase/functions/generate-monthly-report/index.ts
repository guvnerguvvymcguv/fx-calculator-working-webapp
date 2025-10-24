// Main Edge Function - Generate Monthly Client Reports
// Runs on 1st of every month at 9am OR manually for testing

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { generatePDF } from './generatePDF.ts';
import { sendEmail } from './sendEmail.ts';
import { aggregateClientData } from './queries.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('🚀 Starting monthly client report generation...');

    // Get request body to check for company_id and scheduled mode
    const requestBody = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { company_id, scheduled } = requestBody;

    console.log('Request body:', requestBody);
    console.log('Company ID:', company_id);
    console.log('Scheduled mode:', scheduled);

    // Determine which date range to use
    const isTestMode = company_id && !scheduled;

    let startDate: Date;
    let endDate: Date;

    if (isTestMode) {
      // TEST MODE: Use last 30 days
      const now = new Date();
      endDate = now;
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 30);
      console.log('🧪 TEST MODE: Last 30 days');
    } else {
      // PRODUCTION/SCHEDULED MODE: Use previous month
      const now = new Date();
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      lastDayLastMonth.setHours(23, 59, 59, 999);

      startDate = firstDayLastMonth;
      endDate = lastDayLastMonth;
      console.log('🚀 PRODUCTION MODE: Previous month');
    }

    // If test mode, get the specific company
    let companies;
    let companiesError;

    if (company_id) {
      // TEST MODE: Get specific company for testing
      console.log('Test mode - fetching company:', company_id);
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, stripe_customer_id, monthly_reports_enabled, client_data_enabled')
        .eq('id', company_id)
        .single();

      companies = data ? [data] : [];
      companiesError = error;

      console.log('Test company data:', companies);
    } else {
      // PRODUCTION MODE: Get all companies with reports enabled
      console.log('Production mode - fetching all enabled companies');
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, stripe_customer_id, monthly_reports_enabled, client_data_enabled')
        .eq('client_data_enabled', true)
        .eq('monthly_reports_enabled', true);

      companies = data;
      companiesError = error;
    }

    if (companiesError) {
      console.error('Error fetching companies:', companiesError);
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!companies || companies.length === 0) {
      console.log('No companies have monthly reports enabled or no activity');
      return new Response(
        JSON.stringify({
          success: true,
          message: company_id ? 'Company not found or reports not enabled' : 'No companies to process'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`Processing ${companies.length} companies...`);

    const results = [];

    for (const company of companies) {
      try {
        console.log(`\n📊 Processing company: ${company.name}`);

        // Check if reports are enabled
        if (!company.client_data_enabled) {
          console.log(`Client data not enabled for ${company.name} - skipping`);
          results.push({
            company: company.name,
            skipped: true,
            reason: 'Client data addon not enabled'
          });
          continue;
        }

        if (!company.monthly_reports_enabled && !company_id) {
          console.log(`Monthly reports not enabled for ${company.name} - skipping`);
          results.push({
            company: company.name,
            skipped: true,
            reason: 'Monthly reports not enabled'
          });
          continue;
        }

        // Use the dates calculated at the top
        const firstDay = new Date(startDate);
        firstDay.setHours(0, 0, 0, 0);

        const lastDay = new Date(endDate);
        lastDay.setHours(23, 59, 59, 999);

        let monthName: string;
        if (isTestMode) {
          monthName = `Last 30 Days (${firstDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${lastDay.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})`;
        } else {
          monthName = firstDay.toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric'
          });
        }

        console.log(`Date range: ${firstDay.toISOString()} to ${lastDay.toISOString()}`);

        // Aggregate client data for this company
        const clientData = await aggregateClientData(
          supabase,
          company.id,
          firstDay.toISOString(),
          lastDay.toISOString()
        );

        console.log(`Found ${clientData.clients.length} clients with ${clientData.summary.totalCalculations} total calculations`);

        if (clientData.clients.length === 0) {
          console.log(`No activity for ${company.name} last month - skipping`);
          results.push({
            company: company.name,
            skipped: true,
            reason: 'No activity in period'
          });
          continue;
        }

        console.log(`Found ${clientData.clients.length} active clients for ${company.name}`);

        // Generate PDF
        console.log('Generating PDF...');
        const pdfBuffer = await generatePDF({
          companyName: company.name,
          monthName: monthName,
          summary: clientData.summary,
          clients: clientData.clients,
        });

        console.log('✅ PDF generated successfully, size:', pdfBuffer.length, 'bytes');

        // Get all admins for this company
        const { data: admins, error: adminsError } = await supabase
          .from('user_profiles')
          .select('id, email, full_name')
          .eq('company_id', company.id)
          .eq('role_type', 'admin');

        if (adminsError) {
          throw new Error(`Failed to fetch admins: ${adminsError.message}`);
        }

        if (!admins || admins.length === 0) {
          console.log(`No admins found for ${company.name} - skipping email`);
          results.push({
            company: company.name,
            clients: clientData.clients.length,
            calculations: clientData.summary.totalCalculations,
            adminsSent: 0,
            error: 'No admins found'
          });
          continue;
        }

        console.log(`Sending to ${admins.length} admins...`);

        // Send email to all admins
        let emailsSent = 0;
        for (const admin of admins) {
          try {
            console.log(`Sending email to ${admin.email}...`);
            await sendEmail({
              to: admin.email,
              adminName: admin.full_name || 'Admin',
              companyName: company.name,
              monthName: monthName,
              summary: clientData.summary,
              pdfBuffer: pdfBuffer,
            });

            emailsSent++;
            console.log(`✅ Email sent to ${admin.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
          }
        }

        results.push({
          company: company.name,
          clients: clientData.clients.length,
          calculations: clientData.summary.totalCalculations,
          adminsSent: emailsSent,
        });

      } catch (error) {
        console.error(`Error processing ${company.name}:`, error);
        results.push({
          company: company.name,
          error: error.message || 'Unknown error',
        });
      }
    }

    console.log('\n✅ Monthly report generation complete!');
    console.log('Results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: company_id ? 'Test report generated successfully' : 'Monthly reports generated successfully',
        mode: isTestMode ? 'test' : 'production',
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in monthly report generation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred',
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
