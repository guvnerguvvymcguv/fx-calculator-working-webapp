// Email Sending Logic
// Sends monthly reports via Resend API

import { encode as encodeBase64 } from "https://deno.land/std@0.177.0/encoding/base64.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;

interface EmailData {
  to: string;
  adminName: string;
  companyName: string;
  monthName: string;
  summary: {
    totalClients: number;
    totalCalculations: number;
    combinedMonthlySavings: number;
  };
  pdfBuffer: Uint8Array;
}

export async function sendEmail(data: EmailData): Promise<void> {
  // Convert PDF buffer to base64 using Deno's native encoder
  const base64PDF = encodeBase64(data.pdfBuffer);

  const emailPayload = {
    from: 'SpreadChecker <reports@spreadchecker.co.uk>',
    to: data.to,
    subject: `SpreadChecker - Client Data Report (${data.monthName})`,
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
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: white;">Client Data Report</h1>
                    <table cellpadding="0" cellspacing="0" align="center" style="margin-top: 12px;">
                      <tr>
                        <td style="background: white; color: #667eea; padding: 6px 18px; border-radius: 20px; font-size: 14px; font-weight: 600;">${data.monthName}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 16px 0; color: #4a4a4a;">Hi ${data.adminName},</p>

                    <p style="margin: 16px 0; color: #4a4a4a;">Your monthly client data report for <strong>${data.monthName}</strong> is attached.</p>

                    <!-- Stats Table -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9fc; border-radius: 8px; padding: 20px; margin: 24px 0;">
                      <tr>
                        <td style="padding: 20px;">
                          <h3 style="margin-top: 0; color: #667eea;">This Month's Activity</h3>
                          <table style="width: 100%;">
                            <tr>
                              <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 60%;">Active Clients</td>
                              <td style="padding: 10px 0; color: #4a4a4a; text-align: right;">${data.summary.totalClients}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 60%;">Total Calculations</td>
                              <td style="padding: 10px 0; color: #4a4a4a; text-align: right;">${data.summary.totalCalculations}</td>
                            </tr>
                            <tr>
                              <td style="padding: 10px 0; font-weight: 600; color: #2d2d2d; width: 60%;">Combined Monthly Savings</td>
                              <td style="padding: 10px 0; color: #667eea; font-weight: bold; text-align: right;">£${data.summary.combinedMonthlySavings.toLocaleString('en-GB', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 16px 0; color: #4a4a4a;">Review the detailed PDF breakdown to see:</p>

                    <!-- Feature List -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
                      <tr>
                        <td style="background: #f8f9fc; padding: 16px 20px; border-radius: 6px; border-left: 3px solid #667eea;">
                          <ul style="margin: 0; padding-left: 20px; color: #4a4a4a;">
                            <li>Currency pair usage per client</li>
                            <li>Average trade values and frequency</li>
                            <li>Savings performance metrics</li>
                            <li>Complete calculation details</li>
                          </ul>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 16px 0; color: #4a4a4a;">Best regards,<br>The SpreadChecker Team</p>

                    <p style="margin: 24px 0 0 0; padding-top: 16px; border-top: 1px solid #eee; color: #888; font-size: 14px;">This is an automated monthly report from <a href="https://spreadchecker.co.uk" style="color: #667eea; text-decoration: none;">SpreadChecker</a></p>

                    <p style="margin: 8px 0 0 0; color: #888; font-size: 14px;">To modify your report settings, visit your <a href="https://spreadchecker.co.uk/admin" style="color: #667eea; text-decoration: none;">admin dashboard</a></p>
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
    `,
    attachments: [
      {
        filename: `SpreadChecker-ClientReport-${data.monthName.replace(/\s+/g, '-')}.pdf`,
        content: base64PDF,
      },
    ],
  };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  const result = await response.json();
  console.log('Email sent successfully:', result);
}
