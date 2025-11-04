// GET /api/scoreboard - Get scoreboard
// POST /api/scoreboard - Update scoreboard
import { query, queryOne, successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  try {
    if (event.httpMethod === 'GET') {
      const data = await queryOne(
        'SELECT * FROM scoreboard_state WHERE id = 1'
      );

      // Transform DB format to expected format
      const scoreboard = {
        player1: {
          name: data?.player1_name || 'TATTOO',
          score: data?.player1_score || 0
        },
        player2: {
          name: data?.player2_name || 'OPEN',
          score: data?.player2_score || 0
        }
      };

      return successResponse(scoreboard);
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { player1, player2 } = body;

      // Update scoreboard
      await query(
        `UPDATE scoreboard_state
         SET player1_score = COALESCE($1, player1_score),
             player2_score = COALESCE($2, player2_score),
             updated_at = NOW()
         WHERE id = 1`,
        [player1, player2]
      );

      // Log activity
      await logActivity('scoreboard_update', null, { player1, player2 });

      const updated = await queryOne(
        'SELECT * FROM scoreboard_state WHERE id = 1'
      );

      return successResponse({ success: true, scoreboard: updated });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error) {
    console.error('Error with scoreboard:', error);
    return errorResponse('Failed to process scoreboard request');
  }
}
