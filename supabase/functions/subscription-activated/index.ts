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
          subject: 'Welcome to SpreadChecker - Your Subscription is Active',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      <!-- Header -->
                      <tr>
                        <td style="background: #667eea; color: white; padding: 40px 30px; text-align: center;">
                          <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: white;">Welcome to SpreadChecker</h1>
                          <table cellpadding="0" cellspacing="0" align="center" style="margin-top: 12px;">
                            <tr>
                              <td style="background: white; color: #667eea; padding: 6px 18px; border-radius: 20px; font-size: 14px; font-weight: 600;">Subscription Active</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <!-- Content -->
                      <tr>
                        <td style="padding: 40px 30px;">
                          <p style="margin: 16px 0; color: #4a4a4a;">Hi ${admin.full_name || 'there'},</p>
                          
                          <p style="margin: 16px 0; color: #4a4a4a;"><strong>Congratulations!</strong> Your SpreadChecker subscription is now active. Your team can continue using all features without interruption.</p>
                          
                          <!-- Details Table -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fc; border-radius: 8px; padding: 20px; margin: 24px 0;">
                            <tr>
                              <td style="padding: 20px;">
                                <h3 style="margin-top: 0; color: #667eea;">Your Subscription Details</h3>
                                <table style="width: 100%;">
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">Plan Type:</td>
                                    <td style="padding: 10px 0; color: #4a4a4a; text-transform: capitalize;">${subscriptionType === 'annual' ? 'Annual (12 months)' : 'Monthly'}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">Total Seats:</td>
                                    <td style="padding: 10px 0; color: #4a4a4a;">${seatCount} seats</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">Admin Seats:</td>
                                    <td style="padding: 10px 0; color: #4a4a4a;">${adminSeats || 0}</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">Junior Broker Seats:</td>
                                    <td style="padding: 10px 0; color: #4a4a4a;">${juniorSeats || 0}</td>
                                  </tr>
                                  ${subscriptionType === 'monthly' ? `
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">Monthly Price:</td>
                                    <td style="padding: 10px 0; color: #4a4a4a;">£${monthlyPrice}/month (inc. VAT)</td>
                                  </tr>
                                  ` : `
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">Annual Price:</td>
                                    <td style="padding: 10px 0; color: #4a4a4a;">£${(monthlyPrice * 12 * 0.9 * 1.2).toFixed(2)} (inc. VAT)</td>
                                  </tr>
                                  <tr>
                                    <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 40%;">You Saved:</td>
                                    <td style="padding: 10px 0; color: #667eea; font-weight: bold;">£${(monthlyPrice * 12 * 0.1 * 1.2).toFixed(2)} (10% discount)</td>
                                  </tr>
                                  `}
                                </table>
                              </td>
                            </tr>
                          </table>

                          <h3 style="color: #667eea;">What's Available to Your Team:</h3>
                          
                          <!-- Feature Boxes -->
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
                            <tr>
                              <td style="background: #f8f9fc; padding: 16px 20px; border-radius: 6px; border-left: 3px solid #667eea;">
                                <strong style="color: #2d2d2d;">Live Rate Calculator</strong>
                                <p style="margin: 8px 0 0 0; color: #4a4a4a;">Instant spread calculations with real-time currency rates</p>
                              </td>
                            </tr>
                          </table>
                          
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
                            <tr>
                              <td style="background: #f8f9fc; padding: 16px 20px; border-radius: 6px; border-left: 3px solid #667eea;">
                                <strong style="color: #2d2d2d;">Team Management</strong>
                                <p style="margin: 8px 0 0 0; color: #4a4a4a;">Add team members, track activity, and manage permissions</p>
                              </td>
                            </tr>
                          </table>
                          
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
                            <tr>
                              <td style="background: #f8f9fc; padding: 16px 20px; border-radius: 6px; border-left: 3px solid #667eea;">
                                <strong style="color: #2d2d2d;">Performance Analytics</strong>
                                <p style="margin: 8px 0 0 0; color: #4a4a4a;">Track comparisons, client interactions, and team productivity</p>
                              </td>
                            </tr>
                          </table>
                          
                          <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
                            <tr>
                              <td style="background: #f8f9fc; padding: 16px 20px; border-radius: 6px; border-left: 3px solid #667eea;">
                                <strong style="color: #2d2d2d;">Salesforce Integration</strong>
                                <p style="margin: 8px 0 0 0; color: #4a4a4a;">Automated weekly exports to keep your CRM updated</p>
                              </td>
                            </tr>
                          </table>

                          <!-- Button -->
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" style="padding: 24px 0;">
                                <a href="https://spreadchecker.co.uk/login" style="display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Go to Login</a>
                              </td>
                            </tr>
                          </table>
                          
                          <p style="margin: 16px 0; color: #4a4a4a;">If you have any questions or need assistance, simply reply to this email and our team will be happy to help.</p>
                          
                          <p style="margin: 16px 0; color: #4a4a4a;">Thank you for choosing SpreadChecker to power your team's success!</p>
                          
                          <p style="margin: 16px 0; color: #4a4a4a;">Best regards,<br>The SpreadChecker Team</p>
                        </td>
                      </tr>
                      <!-- Footer -->
                      <tr>
                        <td style="padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee;">
                          <p style="margin: 0;">SpreadChecker Ltd | London, UK<br>
                          © 2025 SpreadChecker. All rights reserved.</p>
                          <p style="margin-top: 10px; color: #888; font-size: 14px;">
                            ${subscriptionType === 'monthly' 
                              ? 'You can manage your subscription or cancel anytime from your account settings.' 
                              : 'Your annual subscription will renew automatically in 12 months.'}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
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