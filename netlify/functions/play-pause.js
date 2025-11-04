// POST /api/play-pause - Play or pause Spotify (bot.js will handle actual Spotify call)
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
    const body = JSON.parse(event.body);
    const { action } = body; // 'play' or 'pause'

    if (!action || !['play', 'pause'].includes(action)) {
      return errorResponse('action must be "play" or "pause"', 400);
    }

    // Create a play/pause request in the database that bot.js will pick up
    await query(
      `INSERT INTO activity_log (event_type, details)
       VALUES ($1, $2)`,
      [action === 'play' ? 'play_requested' : 'pause_requested', JSON.stringify({ timestamp: new Date().toISOString() })]
    );

    // Log activity
    await logActivity(`${action}_requested`, null, { timestamp: new Date().toISOString() });

    return successResponse({
      success: true,
      message: `${action} request sent to bot`
    });
  } catch (error) {
    console.error('Error requesting play/pause:', error);
    return errorResponse('Failed to request play/pause');
  }
}
