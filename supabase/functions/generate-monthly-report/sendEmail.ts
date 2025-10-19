// Email Sending Logic
// Sends monthly reports via Resend API

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
  // Convert PDF buffer to base64
  const base64PDF = btoa(String.fromCharCode(...data.pdfBuffer));

  const emailPayload = {
    from: 'Spread Checker <reports@spreadchecker.co.uk>',
    to: data.to,
    subject: `Spread Checker - Client Data Report (${data.monthName})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #9333ea 0%, #7e22ce 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
            }
            .summary-box {
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 20px;
              margin: 20px 0;
            }
            .summary-item {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #f3f4f6;
            }
            .summary-item:last-child {
              border-bottom: none;
            }
            .summary-label {
              color: #6b7280;
              font-weight: 500;
            }
            .summary-value {
              color: #111827;
              font-weight: 600;
            }
            .summary-value.highlight {
              color: #10b981;
              font-size: 18px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
            }
            a {
              color: #9333ea;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Client Data Report</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${data.monthName}</p>
          </div>
          
          <div class="content">
            <p>Hi ${data.adminName},</p>
            
            <p>Your monthly client data report for <strong>${data.monthName}</strong> is attached.</p>
            
            <div class="summary-box">
              <h3 style="margin-top: 0; color: #111827;">This Month's Activity</h3>
              
              <div class="summary-item">
                <span class="summary-label">Active Clients</span>
                <span class="summary-value">${data.summary.totalClients}</span>
              </div>
              
              <div class="summary-item">
                <span class="summary-label">Total Calculations</span>
                <span class="summary-value">${data.summary.totalCalculations}</span>
              </div>
              
              <div class="summary-item">
                <span class="summary-label">Combined Monthly Savings</span>
                <span class="summary-value highlight">£${data.summary.combinedMonthlySavings.toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}</span>
              </div>
            </div>
            
            <p>Review the detailed PDF breakdown to see:</p>
            <ul style="color: #4b5563;">
              <li>Currency pair usage per client</li>
              <li>Average trade values and frequency</li>
              <li>Savings performance metrics</li>
              <li>Complete calculation details</li>
            </ul>
            
            <p style="margin-top: 25px;">Best regards,<br><strong>The Spread Checker Team</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated monthly report from <a href="https://spreadchecker.co.uk">Spread Checker</a></p>
            <p>To modify your report settings, visit your <a href="https://spreadchecker.co.uk/admin">admin dashboard</a></p>
          </div>
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
