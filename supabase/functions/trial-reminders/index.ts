// supabase/functions/trial-reminders/index.ts
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

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    console.log('Checking for trial reminders...')

    // 30-day reminder (1 month into trial, 1 month left)
    const { data: thirtyDayCompanies, error: thirtyError } = await supabase
      .from('companies')
      .select(`
        *,
        user_profiles!inner(
          email,
          full_name,
          role_type
        )
      `)
      .gte('trial_ends_at', thirtyDaysFromNow.toISOString().split('T')[0])
      .lt('trial_ends_at', new Date(thirtyDaysFromNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .eq('trial_reminder_sent', false)
      .eq('subscription_active', false)

    if (thirtyError) {
      console.error('Error fetching 30-day companies:', thirtyError)
    }

    // 7-day reminder
    const { data: sevenDayCompanies, error: sevenError } = await supabase
      .from('companies')
      .select(`
        *,
        user_profiles!inner(
          email,
          full_name,
          role_type
        )
      `)
      .gte('trial_ends_at', sevenDaysFromNow.toISOString().split('T')[0])
      .lt('trial_ends_at', new Date(sevenDaysFromNow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .eq('final_reminder_sent', false)
      .eq('subscription_active', false)

    if (sevenError) {
      console.error('Error fetching 7-day companies:', sevenError)
    }

    // 1-day reminder (last day)
    const { data: oneDayCompanies, error: oneError } = await supabase
      .from('companies')
      .select(`
        *,
        user_profiles!inner(
          email,
          full_name,
          role_type
        )
      `)
      .gte('trial_ends_at', tomorrow.toISOString().split('T')[0])
      .lt('trial_ends_at', new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .eq('last_day_reminder_sent', false)
      .eq('subscription_active', false)

    if (oneError) {
      console.error('Error fetching 1-day companies:', oneError)
    }

    let emailsSent = 0

    // Send 30-day reminders
    if (thirtyDayCompanies && thirtyDayCompanies.length > 0) {
      for (const company of thirtyDayCompanies) {
        // Get all admin emails for this company
        const admins = company.user_profiles.filter((u: any) => u.role_type === 'admin')
        
        for (const admin of admins) {
          try {
            await resend.emails.send({
              from: 'SpreadChecker <noreply@spreadchecker.co.uk>',
              to: admin.email,
              subject: '30 Days Left in Your SpreadChecker Trial',
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
                              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: white;">30 Days Left in Your Free Trial</h1>
                            </td>
                          </tr>
                          <!-- Content -->
                          <tr>
                            <td style="padding: 40px 30px;">
                              <p style="margin: 16px 0; color: #4a4a4a;">Hi ${admin.full_name || 'there'},</p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">You're halfway through your SpreadChecker trial. We hope you and your team are finding value in:</p>
                              
                              <ul style="color: #4a4a4a;">
                                <li>Instant spread calculations for better client deals</li>
                                <li>Team activity tracking and performance insights</li>
                                <li>Automated Salesforce exports</li>
                                <li>Comprehensive comparison analytics</li>
                              </ul>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;"><strong>Your trial ends on ${new Date(company.trial_ends_at).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}</strong></p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Ready to keep your team's productivity gains going? Start your subscription now and ensure uninterrupted access:</p>
                              
                              <!-- Button -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" style="padding: 24px 0;">
                                    <a href="https://spreadchecker.co.uk/checkout" style="display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Start Your Subscription</a>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Questions? Reply to this email and we'll be happy to help.</p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Best regards,<br>The SpreadChecker Team</p>
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee;">
                              <p style="margin: 0;">SpreadChecker Ltd | London, UK<br>
                              © 2024 SpreadChecker. All rights reserved.</p>
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
          } catch (emailError) {
            console.error(`Failed to send 30-day reminder to ${admin.email}:`, emailError)
          }
        }

        // Mark as sent
        await supabase
          .from('companies')
          .update({ trial_reminder_sent: true })
          .eq('id', company.id)
      }
    }

    // Send 7-day reminders
    if (sevenDayCompanies && sevenDayCompanies.length > 0) {
      for (const company of sevenDayCompanies) {
        const admins = company.user_profiles.filter((u: any) => u.role_type === 'admin')
        
        for (const admin of admins) {
          try {
            await resend.emails.send({
              from: 'SpreadChecker <noreply@spreadchecker.co.uk>',
              to: admin.email,
              subject: 'Your SpreadChecker Trial - 7 Days Remaining',
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
                              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: white;">7 Days Remaining in Your Trial</h1>
                            </td>
                          </tr>
                          <!-- Content -->
                          <tr>
                            <td style="padding: 40px 30px;">
                              <p style="margin: 16px 0; color: #4a4a4a;">Hi ${admin.full_name || 'there'},</p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Your SpreadChecker trial period will end in 7 days on <strong>${new Date(company.trial_ends_at).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}</strong>.</p>
                              
                              <!-- Info Box -->
                              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                <tr>
                                  <td style="background: #f8f9fc; border-left: 3px solid #667eea; padding: 16px 20px; border-radius: 4px;">
                                    <strong style="color: #2d2d2d;">Keep your team's momentum going:</strong>
                                    <ul style="margin: 10px 0; padding-left: 20px; color: #4a4a4a;">
                                      <li>Continue using the live rate calculator</li>
                                      <li>Maintain access to all saved comparisons</li>
                                      <li>Keep your Salesforce exports running</li>
                                      <li>Preserve your team's activity data</li>
                                    </ul>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">We'd love to continue supporting your team's success. Start your subscription today to ensure uninterrupted service.</p>
                              
                              <!-- Button -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" style="padding: 24px 0;">
                                    <a href="https://spreadchecker.co.uk/checkout" style="display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Continue to Subscription</a>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">If you have any questions about plans or pricing, simply reply to this email.</p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Best regards,<br>The SpreadChecker Team</p>
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee;">
                              <p style="margin: 0;">SpreadChecker Ltd | London, UK<br>
                              © 2024 SpreadChecker. All rights reserved.</p>
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
          } catch (emailError) {
            console.error(`Failed to send 7-day reminder to ${admin.email}:`, emailError)
          }
        }

        // Mark as sent
        await supabase
          .from('companies')
          .update({ final_reminder_sent: true })
          .eq('id', company.id)
      }
    }

    // Send 1-day reminders (final warning)
    if (oneDayCompanies && oneDayCompanies.length > 0) {
      for (const company of oneDayCompanies) {
        const admins = company.user_profiles.filter((u: any) => u.role_type === 'admin')
        
        for (const admin of admins) {
          try {
            await resend.emails.send({
              from: 'SpreadChecker <noreply@spreadchecker.co.uk>',
              to: admin.email,
              subject: 'Your SpreadChecker Trial Ends Tomorrow',
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
                              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: white;">Final Day of Your Trial</h1>
                            </td>
                          </tr>
                          <!-- Content -->
                          <tr>
                            <td style="padding: 40px 30px;">
                              <p style="margin: 16px 0; color: #4a4a4a;">Hi ${admin.full_name || 'there'},</p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">This is a friendly reminder that your SpreadChecker trial ends tomorrow, <strong>${new Date(company.trial_ends_at).toLocaleDateString('en-GB', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                              })}</strong>.</p>
                              
                              <!-- Notice Box -->
                              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
                                <tr>
                                  <td style="background: #fef8f4; border: 1px solid #f4d4b4; padding: 20px; border-radius: 6px;">
                                    <p style="margin-top: 0; color: #4a4a4a;"><strong>What happens when your trial ends:</strong></p>
                                    <p style="margin-bottom: 0; color: #4a4a4a;">Your team's access to SpreadChecker will be paused until you activate a subscription. All your data, settings, and comparisons will be safely stored and ready when you return.</p>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">To maintain continuous access for your team, you can start your subscription today:</p>
                              
                              <!-- Button -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td align="center" style="padding: 24px 0;">
                                    <a href="https://spreadchecker.co.uk/checkout" style="display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Activate Subscription</a>
                                  </td>
                                </tr>
                              </table>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Thank you for trying SpreadChecker. If you need assistance or have questions, please don't hesitate to reach out.</p>
                              
                              <p style="margin: 16px 0; color: #4a4a4a;">Best regards,<br>The SpreadChecker Team</p>
                            </td>
                          </tr>
                          <!-- Footer -->
                          <tr>
                            <td style="padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee;">
                              <p style="margin: 0;">SpreadChecker Ltd | London, UK<br>
                              © 2025 SpreadChecker. All rights reserved.</p>
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
          } catch (emailError) {
            console.error(`Failed to send 1-day reminder to ${admin.email}:`, emailError)
          }
        }

        // Mark as sent
        await supabase
          .from('companies')
          .update({ last_day_reminder_sent: true })
          .eq('id', company.id)
      }
    }

    console.log(`Trial reminders sent: ${emailsSent} emails`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailsSent,
        details: {
          thirtyDay: thirtyDayCompanies?.length || 0,
          sevenDay: sevenDayCompanies?.length || 0,
          oneDay: oneDayCompanies?.length || 0
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Trial reminders error:', error)
    
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