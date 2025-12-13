// POST /api/approve-song - Approve a pending song request
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
    const { spotifyId } = body;

    if (!spotifyId) {
      return errorResponse('spotifyId is required', 400);
    }

    // Find the song
    const song = await queryOne(
      'SELECT * FROM song_requests WHERE spotify_id = $1 AND status = $2',
      [spotifyId, 'pending']
    );

    if (!song) {
      return errorResponse('Song not found in pending queue', 404);
    }

    // Update status to approved
    await query(
      `UPDATE song_requests
       SET status = 'approved', updated_at = NOW()
       WHERE spotify_id = $1 AND status = 'pending'`,
      [spotifyId]
    );

    // Log activity
    await logActivity('song_approved', song.requester, {
      title: song.title,
      artist: song.artist,
      spotifyId
    });

    return successResponse({
      success: true,
      message: 'Song approved',
      song: {
        ...song,
        status: 'approved'
      }
    });
  } catch (error) {
    console.error('Error approving song:', error);
    return errorResponse('Failed to approve song');
  }
}
