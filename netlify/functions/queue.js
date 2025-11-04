// GET /api/queue - Get current playing track and queue
import { query, successResponse, errorResponse, handleOptions, corsHeaders } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Get current track
    const currentTrack = await query(
      'SELECT * FROM current_track WHERE id = 1'
    );

    // Get approved queue (not yet playing)
    const approvedQueue = await query(
      `SELECT id, spotify_id, title, artist, album_art, requester, uri, created_at
       FROM song_requests
       WHERE status = 'approved'
       ORDER BY created_at ASC
       LIMIT 10`
    );

    // Get pending requests
    const pendingRequests = await query(
      `SELECT id, spotify_id, title, artist, album_art, requester, uri, created_at
       FROM song_requests
       WHERE status = 'pending'
       ORDER BY created_at ASC`
    );

    // Transform snake_case to camelCase for frontend
    const transformSong = (song) => ({
      id: song.id,
      spotifyId: song.spotify_id,
      title: song.title,
      artist: song.artist,
      albumArt: song.album_art,
      requester: song.requester,
      uri: song.uri,
      created_at: song.created_at
    });

    return successResponse({
      now: currentTrack[0] || null,
      queue: (approvedQueue || []).map(transformSong),
      pending: (pendingRequests || []).map(transformSong)
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    return errorResponse('Failed to fetch queue');
  }
}
