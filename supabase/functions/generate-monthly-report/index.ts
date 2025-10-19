// Main Edge Function - Generate Monthly Client Reports
// Runs on 1st of every month at 9am

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import { generatePDF } from './generatePDF.ts';
import { sendEmail } from './sendEmail.ts';
import { aggregateClientData } from './queries.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async (req) => {
  try {
    console.log('🚀 Starting monthly client report generation...');

    // Get all companies that have monthly reports enabled
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, stripe_customer_id')
      .eq('monthly_reports_enabled', true);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!companies || companies.length === 0) {
      console.log('No companies have monthly reports enabled');
      return new Response(
        JSON.stringify({ message: 'No companies to process' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${companies.length} companies...`);

    const results = [];

    for (const company of companies) {
      try {
        console.log(`\n📊 Processing company: ${company.name}`);

        // Get previous month's date range
        const now = new Date();
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        const monthName = firstDayLastMonth.toLocaleDateString('en-GB', { 
          month: 'long', 
          year: 'numeric' 
        });

        // Aggregate client data for this company
        const clientData = await aggregateClientData(
          supabase,
          company.id,
          firstDayLastMonth.toISOString(),
          lastDayLastMonth.toISOString()
        );

        if (clientData.clients.length === 0) {
          console.log(`No activity for ${company.name} last month - skipping`);
          continue;
        }

        console.log(`Found ${clientData.clients.length} active clients for ${company.name}`);

        // Generate PDF
        const pdfBuffer = await generatePDF({
          companyName: company.name,
          monthName: monthName,
          summary: clientData.summary,
          clients: clientData.clients,
        });

        console.log('✅ PDF generated successfully');

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
          continue;
        }

        console.log(`Sending to ${admins.length} admins...`);

        // Send email to all admins
        for (const admin of admins) {
          try {
            await sendEmail({
              to: admin.email,
              adminName: admin.full_name || 'Admin',
              companyName: company.name,
              monthName: monthName,
              summary: clientData.summary,
              pdfBuffer: pdfBuffer,
            });

            console.log(`✅ Email sent to ${admin.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${admin.email}:`, emailError);
          }
        }

        results.push({
          company: company.name,
          clients: clientData.clients.length,
          calculations: clientData.summary.totalCalculations,
          adminsSent: admins.length,
        });

      } catch (error) {
        console.error(`Error processing ${company.name}:`, error);
        results.push({
          company: company.name,
          error: error.message,
        });
      }
    }

    console.log('\n✅ Monthly report generation complete!');
    console.log('Results:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Monthly reports generated successfully',
        results: results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in monthly report generation:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
