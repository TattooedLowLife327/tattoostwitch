// GET /api/queue - Get current playing track and queue
import { query, successResponse, errorResponse, handleOptions, corsHeaders } from './utils/db.js';

const BOT_API_BASE = (process.env.BOT_API_BASE || 'https://tattoostwitch327.onrender.com').replace(/\/$/, '');

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

    // Get approved and playing queue
    let approvedQueue = await query(
      `SELECT id, spotify_id, title, artist, album_art, requester, uri, created_at
       FROM song_requests
       WHERE status IN ('approved', 'playing')
       ORDER BY created_at ASC
       LIMIT 10`
    );

    // If no song requests, fetch from Spotify's actual queue
    if (!approvedQueue || approvedQueue.length === 0) {
      try {
        const spotifyResponse = await fetch(`${BOT_API_BASE}/api/spotify-queue`);
        if (spotifyResponse.ok) {
          const spotifyQueue = await spotifyResponse.json();
          approvedQueue = spotifyQueue.slice(0, 3); // Next 3 songs
        }
      } catch (err) {
        console.error('Failed to fetch Spotify queue:', err);
      }
    }

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

    // Transform current track to camelCase
    const transformCurrentTrack = (track) => {
      if (!track) return null;
      return {
        spotifyId: track.spotify_id,
        title: track.title,
        artist: track.artist,
        album: track.album,
        albumArt: track.album_art,
        requester: track.requester,
        playlistName: track.playlist_name,
        progress: track.progress_ms,
        duration: track.duration_ms,
        isPlaying: track.is_playing
      };
    };

    return successResponse({
      now: transformCurrentTrack(currentTrack[0]),
      queue: (approvedQueue || []).map(transformSong),
      pending: (pendingRequests || []).map(transformSong)
    });
  } catch (error) {
    console.error('Error fetching queue:', error);
    return errorResponse('Failed to fetch queue');
  }
}
