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

    // Log play/pause request that bot.js will pick up
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
