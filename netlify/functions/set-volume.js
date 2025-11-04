// POST /api/set-volume - Set Spotify volume
import { successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

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
    const { volume } = body; // 0-100

    if (typeof volume !== 'number' || volume < 0 || volume > 100) {
      return errorResponse('volume must be a number between 0 and 100', 400);
    }

    // Log volume change request that bot.js will pick up
    await logActivity('volume_requested', null, { volume, timestamp: new Date().toISOString() });

    return successResponse({
      success: true,
      message: `Volume change to ${volume}% sent to bot`
    });
  } catch (error) {
    console.error('Error requesting volume change:', error);
    return errorResponse('Failed to request volume change');
  }
}
