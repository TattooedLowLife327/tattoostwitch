// POST /api/set-volume - Set Spotify volume
import { errorResponse, handleOptions } from './utils/db.js';

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Volume control disabled (Spotify device not managed via bot anymore)
    return errorResponse('Volume control has been disabled', 410);
  } catch (error) {
    console.error('Error handling volume request:', error);
    return errorResponse('Failed to process request');
  }
}
