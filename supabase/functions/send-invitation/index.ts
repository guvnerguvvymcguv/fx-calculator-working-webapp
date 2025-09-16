// supabase/functions/send-invitation/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, token, companyName, inviterEmail, role, inviteUrl } = await req.json()
    
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'SpreadChecker <noreply@spreadchecker.co.uk>',
        to: [email],
        subject: `You're invited to join ${companyName} on SpreadChecker`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; }
              .wrapper { background-color: #f5f5f5; padding: 40px 20px; }
              .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
              .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
              .content { padding: 40px 30px; }
              .content p { margin: 16px 0; color: #4a4a4a; }
              .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 24px 0; }
              .info-box { background: #f8f9fc; border-left: 3px solid #667eea; padding: 16px 20px; margin: 24px 0; border-radius: 4px; }
              .footer { padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee; }
              .link-text { color: #667eea; word-break: break-all; font-size: 13px; }
            </style>
          </head>
          <body>
            <div class="wrapper">
              <div class="container">
                <div class="header">
                  <h1>You've been invited to SpreadChecker!</h1>
                </div>
                <div class="content">
                  <p>Hi there,</p>
                  
                  <p><strong>${inviterEmail}</strong> has invited you to join <strong>${companyName}</strong> as a <strong>${role}</strong>.</p>
                  
                  <div class="info-box">
                    <p style="margin: 0;"><strong>What is SpreadChecker?</strong></p>
                    <p style="margin: 8px 0 0 0;">SpreadChecker helps FX brokers calculate competitive rates and close more deals with real-time spread calculations, team activity tracking, and Salesforce integration.</p>
                  </div>
                  
                  <p>Click the button below to accept your invitation and get started:</p>
                  
                  <div style="text-align: center;">
                    <a href="${inviteUrl}" class="button" style="color: white !important;">Accept Invitation</a>
                  </div>
                  
                  <p style="color: #888; font-size: 14px;">Or copy and paste this link into your browser:</p>
                  <p class="link-text">${inviteUrl}</p>
                  
                  <p style="color: #888; font-size: 14px; margin-top: 24px;">This invitation will expire in 7 days. If you have any questions, please contact ${inviterEmail}.</p>
                  
                  <p>Best regards,<br>The SpreadChecker Team</p>
                </div>
                <div class="footer">
                  <p>SpreadChecker Ltd | London, UK<br>
                  © 2024 SpreadChecker. All rights reserved.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    })

    const data = await res.json()
    
    if (!res.ok) {
      throw new Error(data.message || 'Failed to send email')
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})