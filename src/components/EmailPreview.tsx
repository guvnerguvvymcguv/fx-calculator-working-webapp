import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Mail, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function EmailPreview() {
  const [expandedEmail, setExpandedEmail] = useState<string | null>('welcome');

  const emailTemplates = {
    welcome: {
      title: 'Welcome Email (Subscription Activated)',
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
      subject: 'Welcome to SpreadChecker - Your Subscription is Active',
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
            .feature-box { background: #f8f9fc; padding: 16px 20px; margin: 16px 0; border-radius: 6px; border-left: 3px solid #667eea; }
            .details-table { width: 100%; background: #f8f9fc; border-radius: 8px; padding: 20px; margin: 24px 0; }
            .details-table td { padding: 10px 0; color: #4a4a4a; }
            .details-table .label { font-weight: 600; color: #2d2d2d; width: 40%; }
            .footer { padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee; }
            .success-badge { background: #667eea; color: white; padding: 6px 18px; border-radius: 20px; display: inline-block; margin-top: 12px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <h1>Welcome to SpreadChecker</h1>
                <div class="success-badge">Subscription Active</div>
              </div>
              <div class="content">
                <p>Hi John,</p>
                
                <p><strong>Congratulations!</strong> Your SpreadChecker subscription is now active. Your team can continue using all features without interruption.</p>
                
                <div class="details-table">
                  <h3 style="margin-top: 0; color: #667eea;">Your Subscription Details</h3>
                  <table style="width: 100%;">
                    <tr>
                      <td class="label">Plan Type:</td>
                      <td>Monthly</td>
                    </tr>
                    <tr>
                      <td class="label">Total Seats:</td>
                      <td>10 seats</td>
                    </tr>
                    <tr>
                      <td class="label">Admin Seats:</td>
                      <td>2</td>
                    </tr>
                    <tr>
                      <td class="label">Junior Broker Seats:</td>
                      <td>8</td>
                    </tr>
                    <tr>
                      <td class="label">Monthly Price:</td>
                      <td>£300/month (inc. VAT)</td>
                    </tr>
                  </table>
                </div>

                <h3 style="color: #667eea;">What's Available to Your Team:</h3>
                
                <div class="feature-box">
                  <strong>Live Rate Calculator</strong>
                  <p style="margin: 8px 0 0 0;">Instant spread calculations with real-time currency rates</p>
                </div>
                
                <div class="feature-box">
                  <strong>Team Management</strong>
                  <p style="margin: 8px 0 0 0;">Add team members, track activity, and manage permissions</p>
                </div>
                
                <div class="feature-box">
                  <strong>Performance Analytics</strong>
                  <p style="margin: 8px 0 0 0;">Track comparisons, client interactions, and team productivity</p>
                </div>
                
                <div class="feature-box">
                  <strong>Salesforce Integration</strong>
                  <p style="margin: 8px 0 0 0;">Automated weekly exports to keep your CRM updated</p>
                </div>

                <div style="text-align: center;">
                  <a href="https://spreadchecker.co.uk/admin" class="button">Go to Dashboard</a>
                </div>
                
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
      `
    },
    thirtyDay: {
      title: '30-Day Reminder (1 month left)',
      icon: <Clock className="h-5 w-5 text-blue-500" />,
      subject: '30 Days Left in Your SpreadChecker Trial',
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
            .footer { padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <h1>30 Days Left in Your Free Trial</h1>
              </div>
              <div class="content">
                <p>Hi John,</p>
                
                <p>You're halfway through your SpreadChecker trial. We hope you and your team are finding value in:</p>
                
                <ul style="color: #4a4a4a;">
                  <li>Instant spread calculations for better client deals</li>
                  <li>Team activity tracking and performance insights</li>
                  <li>Automated Salesforce exports</li>
                  <li>Comprehensive comparison analytics</li>
                </ul>
                
                <p><strong>Your trial ends on November 15, 2024</strong></p>
                
                <p>Ready to keep your team's productivity gains going? Start your subscription now and ensure uninterrupted access:</p>
                
                <div style="text-align: center;">
                  <a href="https://spreadchecker.co.uk/checkout" class="button">Start Your Subscription</a>
                </div>
                
                <p>Questions? Reply to this email and we'll be happy to help.</p>
                
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
      `
    },
    sevenDay: {
      title: '7-Day Reminder',
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      subject: 'Your SpreadChecker Trial - 7 Days Remaining',
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
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <h1>7 Days Remaining in Your Trial</h1>
              </div>
              <div class="content">
                <p>Hi John,</p>
                
                <p>Your SpreadChecker trial period will end in 7 days on <strong>November 15, 2024</strong>.</p>
                
                <div class="info-box">
                  <strong>Keep your team's momentum going:</strong>
                  <ul style="margin: 10px 0; padding-left: 20px; color: #4a4a4a;">
                    <li>Continue using the live rate calculator</li>
                    <li>Maintain access to all saved comparisons</li>
                    <li>Keep your Salesforce exports running</li>
                    <li>Preserve your team's activity data</li>
                  </ul>
                </div>
                
                <p>We'd love to continue supporting your team's success. Start your subscription today to ensure uninterrupted service.</p>
                
                <div style="text-align: center;">
                  <a href="https://spreadchecker.co.uk/checkout" class="button">Continue to Subscription</a>
                </div>
                
                <p>If you have any questions about plans or pricing, simply reply to this email.</p>
                
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
      `
    },
    oneDay: {
      title: '1-Day Reminder',
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      subject: 'Your SpreadChecker Trial Ends Tomorrow',
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
            .notice-box { background: #fef8f4; border: 1px solid #f4d4b4; padding: 20px; margin: 24px 0; border-radius: 6px; }
            .footer { padding: 30px; text-align: center; color: #888; font-size: 14px; border-top: 1px solid #eee; }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <h1>Final Day of Your Trial</h1>
              </div>
              <div class="content">
                <p>Hi John,</p>
                
                <p>This is a friendly reminder that your SpreadChecker trial ends tomorrow, <strong>November 15, 2024</strong>.</p>
                
                <div class="notice-box">
                  <p style="margin-top: 0;"><strong>What happens when your trial ends:</strong></p>
                  <p style="margin-bottom: 0;">Your team's access to SpreadChecker will be paused until you activate a subscription. All your data, settings, and comparisons will be safely stored and ready when you return.</p>
                </div>
                
                <p>To maintain continuous access for your team, you can start your subscription today:</p>
                
                <div style="text-align: center;">
                  <a href="https://spreadchecker.co.uk/checkout" class="button">Activate Subscription</a>
                </div>
                
                <p>Thank you for trying SpreadChecker. If you need assistance or have questions, please don't hesitate to reach out.</p>
                
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
      `
    }
  };

  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Email Templates Preview</h1>
        <p className="text-gray-400 mb-8">View all automated email templates sent to users</p>

        <div className="space-y-4">
          {Object.entries(emailTemplates).map(([key, template]) => (
            <Card key={key} className="bg-gray-900/50 border-gray-800">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-800/30 transition-colors"
                onClick={() => setExpandedEmail(expandedEmail === key ? null : key)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {template.icon}
                    <div>
                      <CardTitle className="text-white text-lg">{template.title}</CardTitle>
                      <p className="text-gray-400 text-sm mt-1">Subject: {template.subject}</p>
                    </div>
                  </div>
                  {expandedEmail === key ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </div>
              </CardHeader>
              
              {expandedEmail === key && (
                <CardContent>
                  <div className="bg-white rounded-lg overflow-hidden">
                    <iframe
                      srcDoc={template.html}
                      style={{
                        width: '100%',
                        height: '700px',
                        border: 'none'
                      }}
                      title={`${key} email preview`}
                    />
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      onClick={() => {
                        const blob = new Blob([template.html], { type: 'text/html' });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Open in New Tab
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-8 p-6 bg-gray-900/50 border border-gray-800 rounded-lg">
          <h3 className="text-white font-semibold mb-3">Email Trigger Schedule</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-gray-300">
                <strong className="text-white">Welcome Email:</strong> Sent immediately after successful payment
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-gray-300">
                <strong className="text-white">30-Day Reminder:</strong> Sent when 30 days remain in trial
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-gray-300">
                <strong className="text-white">7-Day Reminder:</strong> Sent when 7 days remain in trial
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-gray-300">
                <strong className="text-white">1-Day Reminder:</strong> Sent on the last day of trial
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}