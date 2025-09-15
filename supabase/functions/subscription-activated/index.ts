// supabase/functions/subscription-activated/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Resend } from 'https://esm.sh/resend@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      throw new Error('RESEND_API_KEY not configured')
    }
    const resend = new Resend(resendKey)

    // Initialize Supabase with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request body
    const body = await req.json()
    const { companyId, subscriptionType, seatCount, adminSeats, juniorSeats, monthlyPrice } = body
    
    console.log('Sending subscription activated email for company:', companyId)

    // Get company and admin details
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select(`
        *,
        user_profiles!inner(
          email,
          full_name,
          role_type
        )
      `)
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      throw new Error('Company not found')
    }

    // Get all admin emails for this company
    const admins = company.user_profiles.filter((u: any) => u.role_type === 'admin')
    let emailsSent = 0

    for (const admin of admins) {
      try {
        await resend.emails.send({
          from: 'SpreadChecker <noreply@spreadchecker.co.uk>',
          to: admin.email,
          subject: '🎉 Welcome to SpreadChecker - Your Subscription is Active!',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .feature-box { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #667eea; }
                .details-table { width: 100%; background: white; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .details-table td { padding: 8px 0; }
                .details-table .label { font-weight: bold; color: #666; width: 40%; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                .success-badge { background: #10b981; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; margin-top: 10px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>🎉 Welcome to SpreadChecker!</h1>
                  <div class="success-badge">Subscription Active</div>
                </div>
                <div class="content">
                  <p>Hi ${admin.full_name || 'there'},</p>
                  
                  <p><strong>Congratulations!</strong> Your SpreadChecker subscription is now active. Your team can continue using all features without interruption.</p>
                  
                  <div class="details-table">
                    <h3 style="margin-top: 0; color: #667eea;">Your Subscription Details</h3>
                    <table style="width: 100%;">
                      <tr>
                        <td class="label">Plan Type:</td>
                        <td style="text-transform: capitalize;">${subscriptionType === 'annual' ? 'Annual (12 months)' : 'Monthly'}</td>
                      </tr>
                      <tr>
                        <td class="label">Total Seats:</td>
                        <td>${seatCount} seats</td>
                      </tr>
                      <tr>
                        <td class="label">Admin Seats:</td>
                        <td>${adminSeats || 0}</td>
                      </tr>
                      <tr>
                        <td class="label">Junior Broker Seats:</td>
                        <td>${juniorSeats || 0}</td>
                      </tr>
                      ${subscriptionType === 'monthly' ? `
                      <tr>
                        <td class="label">Monthly Price:</td>
                        <td>£${monthlyPrice}/month (inc. VAT)</td>
                      </tr>
                      ` : `
                      <tr>
                        <td class="label">Annual Price:</td>
                        <td>£${(monthlyPrice * 12 * 0.9 * 1.2).toFixed(2)} (inc. VAT)</td>
                      </tr>
                      <tr>
                        <td class="label">You Saved:</td>
                        <td style="color: #10b981; font-weight: bold;">£${(monthlyPrice * 12 * 0.1 * 1.2).toFixed(2)} (10% discount)</td>
                      </tr>
                      `}
                    </table>
                  </div>

                  <h3 style="color: #667eea;">What's Available to Your Team:</h3>
                  
                  <div class="feature-box">
                    <strong>📊 Live Rate Calculator</strong>
                    <p style="margin: 5px 0 0 0;">Instant spread calculations with real-time currency rates</p>
                  </div>
                  
                  <div class="feature-box">
                    <strong>👥 Team Management</strong>
                    <p style="margin: 5px 0 0 0;">Add team members, track activity, and manage permissions</p>
                  </div>
                  
                  <div class="feature-box">
                    <strong>📈 Performance Analytics</strong>
                    <p style="margin: 5px 0 0 0;">Track comparisons, client interactions, and team productivity</p>
                  </div>
                  
                  <div class="feature-box">
                    <strong>🔄 Salesforce Integration</strong>
                    <p style="margin: 5px 0 0 0;">Automated weekly exports to keep your CRM updated</p>
                  </div>

                  <h3 style="color: #667eea;">Quick Actions:</h3>
                  
                  <div style="text-align: center;">
                    <a href="https://spreadchecker.co.uk/admin" class="button">Go to Dashboard</a>
                  </div>
                  
                  <p><strong>Need help getting started?</strong></p>
                  <ul>
                    <li><a href="https://spreadchecker.co.uk/admin/invite">Invite team members</a></li>
                    <li><a href="https://spreadchecker.co.uk/admin/salesforce">Set up Salesforce integration</a></li>
                    <li><a href="https://spreadchecker.co.uk/admin/account">Manage your subscription</a></li>
                  </ul>
                  
                  <div style="background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>💡 Pro Tip:</strong> Set up your weekly Salesforce export schedule in the Admin Dashboard to automate your reporting workflow.</p>
                  </div>
                  
                  <p>If you have any questions or need assistance, simply reply to this email and our team will be happy to help.</p>
                  
                  <p>Thank you for choosing SpreadChecker to power your team's success!</p>
                  
                  <p>Best regards,<br>The SpreadChecker Team</p>
                </div>
                <div class="footer">
                  <p>© 2024 SpreadChecker. All rights reserved.</p>
                  <p style="margin-top: 10px;">
                    ${subscriptionType === 'monthly' 
                      ? 'You can manage your subscription or cancel anytime from your account settings.' 
                      : 'Your annual subscription will renew automatically in 12 months.'}
                  </p>
                </div>
              </div>
            </body>
            </html>
          `
        })
        emailsSent++
        console.log(`Subscription activation email sent to ${admin.email}`)
      } catch (emailError) {
        console.error(`Failed to send activation email to ${admin.email}:`, emailError)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        company: company.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Subscription activated email error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})