import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Mail, Clock, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function EmailPreview() {
  const [expandedEmail, setExpandedEmail] = useState<string | null>('welcome');

  const emailTemplates = {
    welcome: {
      title: '🎉 Welcome Email (Subscription Activated)',
      icon: <CheckCircle className="h-5 w-5 text-green-500" />,
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

              <div style="text-align: center;">
                <a href="https://spreadchecker.co.uk/admin" class="button">Go to Dashboard</a>
              </div>
              
              <p>Best regards,<br>The SpreadChecker Team</p>
            </div>
            <div class="footer">
              <p>© 2024 SpreadChecker. All rights reserved.</p>
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
              <p>Hi John,</p>
              
              <p>You're halfway through your SpreadChecker trial! We hope you and your team are finding value in:</p>
              
              <ul>
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
              <p>© 2024 SpreadChecker. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    },
    sevenDay: {
      title: '7-Day Reminder (Urgent)',
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
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
              <p>Hi John,</p>
              
              <div class="warning">
                <strong>⚠️ Important:</strong> Your SpreadChecker trial ends on November 15, 2024
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
    },
    oneDay: {
      title: '🚨 1-Day Final Warning',
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
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
              <p>Hi John,</p>
              
              <div class="urgent">
                <h3 style="color: #dc3545; margin-top: 0;">⚠️ Your account will be locked tomorrow</h3>
                <p style="margin-bottom: 0;"><strong>Trial ends: November 15, 2024</strong></p>
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
              
              <p>Best regards,<br>The SpreadChecker Team</p>
            </div>
            <div class="footer">
              <p>© 2024 SpreadChecker. All rights reserved.</p>
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
                <strong className="text-white">1-Day Final Warning:</strong> Sent on the last day of trial
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}