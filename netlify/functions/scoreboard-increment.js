// POST /api/scoreboard-increment - Increment/decrement player scores
import { query, queryOne, successResponse, errorResponse, handleOptions, logActivity } from './utils/db.js';

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
    const { action } = body;

    // Valid actions: p1_up, p1_down, p2_up, p2_down, reset
    const validActions = ['p1_up', 'p1_down', 'p2_up', 'p2_down', 'reset'];
    if (!validActions.includes(action)) {
      return errorResponse('Invalid action. Valid: p1_up, p1_down, p2_up, p2_down, reset', 400);
    }

    let updateQuery;
    if (action === 'p1_up') {
      updateQuery = 'UPDATE scoreboard_state SET player1_score = player1_score + 1, updated_at = NOW() WHERE id = 1';
    } else if (action === 'p1_down') {
      updateQuery = 'UPDATE scoreboard_state SET player1_score = GREATEST(0, player1_score - 1), updated_at = NOW() WHERE id = 1';
    } else if (action === 'p2_up') {
      updateQuery = 'UPDATE scoreboard_state SET player2_score = player2_score + 1, updated_at = NOW() WHERE id = 1';
    } else if (action === 'p2_down') {
      updateQuery = 'UPDATE scoreboard_state SET player2_score = GREATEST(0, player2_score - 1), updated_at = NOW() WHERE id = 1';
    } else if (action === 'reset') {
      updateQuery = 'UPDATE scoreboard_state SET player1_score = 0, player2_score = 0, updated_at = NOW() WHERE id = 1';
    }

    await query(updateQuery);

    // Get updated scores
    const updated = await queryOne('SELECT * FROM scoreboard_state WHERE id = 1');

    // Log activity
    await logActivity('scoreboard_increment', null, {
      action,
      player1: updated.player1_score,
      player2: updated.player2_score
    });

    return successResponse({
      success: true,
      action,
      player1: updated.player1_score,
      player2: updated.player2_score
    });
  } catch (error) {
    console.error('Error incrementing scoreboard:', error);
    return errorResponse('Failed to update scoreboard');
  }
}
