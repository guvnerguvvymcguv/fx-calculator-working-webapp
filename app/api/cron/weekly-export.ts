import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Verify this is from Vercel Cron
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    const res = await fetch(
      `${supabaseUrl}/functions/v1/weekly-export`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!res.ok) {
      throw new Error('Failed to trigger weekly export');
    }

    return response.status(200).json({ 
      success: true, 
      message: 'Weekly export triggered successfully' 
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return response.status(500).json({ 
      error: 'Failed to trigger weekly export',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}