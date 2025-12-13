// GET /api/viewer-counts - Get viewer counts from all platforms
import { successResponse, errorResponse, handleOptions } from './utils/db.js';
import fetch from 'node-fetch';

const CACHE_DURATION = 30000; // 30 seconds
let cachedCounts = null;
let cacheTime = 0;

async function getTwitchViewerCount(login, clientId, clientSecret) {
  try {
    // Get app access token
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
      })
    });
    const tokenData = await tokenRes.json();

    // Get stream info
    const streamRes = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
      {
        headers: {
          'Client-ID': clientId,
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );
    const streamData = await streamRes.json();
    return streamData.data?.[0]?.viewer_count || 0;
  } catch (error) {
    console.error('Twitch viewer count error:', error.message);
    return 0;
  }
}

async function getFacebookViewerCount(accessToken, pageId) {
  if (!accessToken || !pageId) return 0;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/live_videos?fields=live_views,status&access_token=${accessToken}`
    );
    const data = await res.json();
    const liveVideo = data.data?.find(video => video.status === 'LIVE');
    return liveVideo?.live_views || 0;
  } catch (error) {
    console.error('Facebook viewer count error:', error.message);
    return 0;
  }
}

async function getTikTokViewerCount(accessToken, username) {
  if (!accessToken || !username) return 0;

  try {
    const res = await fetch(
      `https://open.tiktokapis.com/v2/live/info/?username=${encodeURIComponent(username)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const data = await res.json();

    if (data.data?.room_info?.status === 2) {
      return data.data.room_info.user_count || 0;
    }
    return 0;
  } catch (error) {
    console.error('TikTok viewer count error:', error.message);
    return 0;
  }
}

export async function handler(event) {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    // Return cached counts if still fresh
    const now = Date.now();
    if (cachedCounts && (now - cacheTime) < CACHE_DURATION) {
      return successResponse(cachedCounts);
    }

    // Fetch counts from all platforms in parallel
    const [twitchCount, facebookCount, tiktokCount] = await Promise.all([
      getTwitchViewerCount(
        process.env.TWITCH_CHANNEL,
        process.env.TWITCH_CLIENT_ID,
        process.env.TWITCH_CLIENT_SECRET
      ),
      getFacebookViewerCount(
        process.env.FACEBOOK_ACCESS_TOKEN,
        process.env.FACEBOOK_PAGE_ID
      ),
      getTikTokViewerCount(
        process.env.TIKTOK_ACCESS_TOKEN,
        process.env.TIKTOK_USERNAME
      )
    ]);

    const counts = {
      twitch: twitchCount,
      facebook: facebookCount,
      tiktok: tiktokCount
    };

    // Update cache
    cachedCounts = counts;
    cacheTime = now;

    return successResponse(counts);
  } catch (error) {
    console.error('Error fetching viewer counts:', error);
    return errorResponse('Failed to fetch viewer counts');
  }
}
