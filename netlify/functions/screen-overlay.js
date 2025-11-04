// GET /api/screen-overlay - Get current screen overlay status
// POST /api/screen-overlay - Control screen overlays (BRB, tech difficulties, etc)
import { query, queryOne, successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    if (event.httpMethod === 'GET') {
      const overlay = await queryOne(
        'SELECT * FROM screen_overlay WHERE id = 1'
      );
      return successResponse(overlay || {
        overlay_type: null,
        is_active: false,
        duration_minutes: null,
        start_time: null,
        custom_message: null
      });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { type, isActive, durationMinutes, customMessage } = body;

      // Valid overlay types
      const validTypes = ['brb', 'tech_difficulties', 'starting_soon', 'ending', null];
      if (type && !validTypes.includes(type)) {
        return errorResponse('Invalid overlay type', 400);
      }

      // If activating, require type and duration
      if (isActive && !type) {
        return errorResponse('Overlay type required when activating', 400);
      }

      // Update overlay state
      await query(
        `UPDATE screen_overlay
         SET overlay_type = $1,
             is_active = $2,
             duration_minutes = $3,
             start_time = CASE WHEN $2 = true THEN NOW() ELSE start_time END,
             custom_message = $4,
             updated_at = NOW()
         WHERE id = 1`,
        [type, isActive, durationMinutes, customMessage]
      );

      // Log activity
      await logActivity('screen_overlay_change', null, {
        type,
        isActive,
        durationMinutes,
        customMessage
      });

      const updated = await queryOne(
        'SELECT * FROM screen_overlay WHERE id = 1'
      );

      return successResponse({
        success: true,
        overlay: updated
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error with screen overlay:', error);
    return errorResponse('Failed to process screen overlay request');
  }
}
