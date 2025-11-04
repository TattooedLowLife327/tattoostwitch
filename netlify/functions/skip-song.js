// POST /api/skip-song - Skip current song (bot.js will handle actual Spotify skip)
import { query, successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Create a skip request in the database that bot.js will pick up
    await query(
      `INSERT INTO activity_log (event_type, details)
       VALUES ('skip_requested', '{"timestamp": "' || NOW() || '"}')`
    );

    // Log activity
    await logActivity('skip_requested', null, { timestamp: new Date().toISOString() });

    return successResponse({
      success: true,
      message: 'Skip request sent to bot'
    });
  } catch (error) {
    console.error('Error requesting skip:', error);
    return errorResponse('Failed to request skip');
  }
}
