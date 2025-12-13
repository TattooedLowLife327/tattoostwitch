// GET /api/mode - Get current mode
// POST /api/mode - Set mode
import { query, queryOne, successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    if (event.httpMethod === 'GET') {
      const config = await queryOne(
        'SELECT current_mode FROM stream_config WHERE id = 1'
      );
      return successResponse({ mode: config?.current_mode || 'tourney' });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { mode } = body;

      // Validate mode
      const validModes = ['tourney', 'lobby', 'cash', 'league', 'dubs'];
      if (!validModes.includes(mode)) {
        return errorResponse('Invalid mode. Valid options: tourney, lobby, cash', 400);
      }

      // Update mode
      await query(
        `UPDATE stream_config
         SET current_mode = $1, updated_at = NOW()
         WHERE id = 1`,
        [mode]
      );

      // Log activity
      await logActivity('mode_change', null, { mode });

      return successResponse({ success: true, mode });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error with mode:', error);
    return errorResponse('Failed to process mode request');
  }
}
