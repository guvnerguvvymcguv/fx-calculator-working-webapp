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
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>30 Days Left in Your Free Trial</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${admin.full_name || 'there'},</p>
                      
                      <p>You're halfway through your SpreadChecker trial! We hope you and your team are finding value in:</p>
                      
                      <ul>
                        <li>Instant spread calculations for better client deals</li>
                        <li>Team activity tracking and performance insights</li>
                        <li>Automated Salesforce exports</li>
                        <li>Comprehensive comparison analytics</li>
                      </ul>
                      
                      <p><strong>Your trial ends on ${new Date(company.trial_ends_at).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric' 
                      })}</strong></p>
                      
                      <p>Ready to keep your team's productivity gains going? Start your subscription now and ensure uninterrupted access:</p>
                      
                      <div style="text-align: center;">
                        <a href="https://spreadchecker.co.uk/checkout" class="button">Start Your Subscription</a>
                      </div>
                      
                      <p>Questions? Reply to this email and we'll be happy to help.</p>
                      
                      <p>Best regards,<br>The SpreadChecker Team</p>
                    </div>
                    <div class="footer">
                      <p>© 2024 SpreadChecker. All rights reserved.</p>
                    </div>
                  </div>
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
              subject: '⏰ Only 7 Days Left in Your SpreadChecker Trial',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>⏰ Your Trial Ends in 7 Days</h1>
                    </div>
                    <div class="content">
                      <p>Hi ${admin.full_name || 'there'},</p>
                      
                      <div class="warning">
                        <strong>⚠️ Important:</strong> Your SpreadChecker trial ends on ${new Date(company.trial_ends_at).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                      
                      <p>Don't lose access to:</p>
                      <ul>
                        <li>Your team's saved calculations and comparison history</li>
                        <li>Automated weekly Salesforce exports</li>
                        <li>Team performance tracking</li>
                        <li>All your configured settings and preferences</li>
                      </ul>
                      
                      <p><strong>Start your subscription today to ensure uninterrupted service for your team.</strong></p>
                      
                      <div style="text-align: center;">
                        <a href="https://spreadchecker.co.uk/checkout" class="button">Upgrade Now - Don't Lose Access</a>
                      </div>
                      
                      <p>Need help choosing the right plan? Reply to this email.</p>
                      
                      <p>Best regards,<br>The SpreadChecker Team</p>
                    </div>
                    <div class="footer">
                      <p>© 2024 SpreadChecker. All rights reserved.</p>
                    </div>
                  </div>
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
              subject: '🚨 FINAL NOTICE: Your SpreadChecker Trial Ends Tomorrow',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 15px 40px; background: #eb3349; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 18px; font-weight: bold; }
                    .urgent { background: #f8d7da; border: 2px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px; }
                    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <h1>🚨 FINAL NOTICE</h1>
                      <h2>Your Trial Ends Tomorrow</h2>
                    </div>
                    <div class="content">
                      <p>Hi ${admin.full_name || 'there'},</p>
                      
                      <div class="urgent">
                        <h3 style="color: #dc3545; margin-top: 0;">⚠️ Your account will be locked tomorrow</h3>
                        <p style="margin-bottom: 0;"><strong>Trial ends: ${new Date(company.trial_ends_at).toLocaleDateString('en-GB', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}</strong></p>
                      </div>
                      
                      <p><strong>What happens when your trial ends:</strong></p>
                      <ul>
                        <li>❌ Your team will lose access to the calculator</li>
                        <li>❌ All saved comparisons will be inaccessible</li>
                        <li>❌ Automated exports will stop</li>
                        <li>❌ Team activity tracking will cease</li>
                      </ul>
                      
                      <p><strong>This is your last chance to maintain uninterrupted access for your team.</strong></p>
                      
                      <div style="text-align: center;">
                        <a href="https://spreadchecker.co.uk/checkout" class="button">ACTIVATE SUBSCRIPTION NOW</a>
                      </div>
                      
                      <p style="text-align: center; color: #666;">
                        <em>Don't let your team lose their productivity tools tomorrow.</em>
                      </p>
                      
                      <p>If you have any questions or need assistance, please reply immediately.</p>
                      
                      <p>Best regards,<br>The SpreadChecker Team</p>
                    </div>
                    <div class="footer">
                      <p>© 2024 SpreadChecker. All rights reserved.</p>
                    </div>
                  </div>
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