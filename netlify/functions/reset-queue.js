// POST /api/reset-queue - Clear all pending and approved songs
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
    // Count before deleting
    const beforeCounts = await query(
      `SELECT status, COUNT(*) as count
       FROM song_requests
       WHERE status IN ('pending', 'approved', 'playing')
       GROUP BY status`
    );

    // Delete all pending, approved, and playing songs
    await query(
      `DELETE FROM song_requests
       WHERE status IN ('pending', 'approved', 'playing')`
    );

    const counts = {
      pending: 0,
      approved: 0,
      playing: 0
    };

    beforeCounts.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });

    // Log activity
    await logActivity('queue_reset', null, counts);

    return successResponse({
      success: true,
      message: 'Queue reset',
      cleared: counts
    });
  } catch (error) {
    console.error('Error resetting queue:', error);
    return errorResponse('Failed to reset queue');
  }
}
