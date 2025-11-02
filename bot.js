import 'dotenv/config';
import tmi from 'tmi.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import SpotifyWebApi from 'spotify-web-api-node';

// ====== ENV VARIABLES ======
const {
  TWITCH_BOT_USERNAME,
  TWITCH_CHANNEL,
  TWITCH_OAUTH_TOKEN,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
  PROMO_MINUTES,
  SPECIAL_USERS,
  DECAPI_TOKEN,
  FACEBOOK_ACCESS_TOKEN,
  FACEBOOK_PAGE_ID,
  TIKTOK_ACCESS_TOKEN,
  TIKTOK_USERNAME
} = process.env;

const PORT = process.env.PORT || 8787;

// Parse special users from env (comma-separated list)
const specialUsersList = SPECIAL_USERS ? SPECIAL_USERS.toLowerCase().split(',').map(u => u.trim()) : [];

console.log('=== ENV DEBUG ===');
console.log('TWITCH_CHANNEL:', TWITCH_CHANNEL);
console.log('TWITCH_BOT_USERNAME:', TWITCH_BOT_USERNAME);
console.log('SPECIAL_USERS:', specialUsersList.length > 0 ? specialUsersList.join(', ') : 'none configured');
console.log('================');

if (!TWITCH_CHANNEL || !TWITCH_CLIENT_ID || !SPOTIFY_CLIENT_ID) {
  console.error('Missing required environment variables. Check Netlify settings.');
  process.exit(1);
}

// ====== EXPRESS SETUP ======
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// ====== SPOTIFY ======
const spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET
});
if (SPOTIFY_REFRESH_TOKEN) spotify.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

async function ensureSpotifyToken() {
  try {
    const data = await spotify.refreshAccessToken();
    spotify.setAccessToken(data.body['access_token']);
  } catch (err) {
    console.error('Spotify token refresh failed:', err?.body?.error || err?.message || err);
  }
}

// ====== TWITCH HELIX TOKEN ======
let helixAppToken = null;
let helixTokenExp = 0;
async function getAppAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (helixAppToken && now < helixTokenExp - 60) return helixAppToken;

  const res = await fetch(`https://id.twitch.tv/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    })
  });
  const data = await res.json();
  helixAppToken = data.access_token;
  helixTokenExp = now + (data.expires_in || 3600);
  return helixAppToken;
}

async function getViewerCount(login) {
  const token = await getAppAccessToken();
  const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, Authorization: `Bearer ${token}` }
  });
  const j = await r.json();
  return j.data?.[0]?.viewer_count ?? null;
}

async function getFacebookViewerCount() {
  if (!FACEBOOK_ACCESS_TOKEN || !FACEBOOK_PAGE_ID) return null;

  try {
    // Get current live videos for the page
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${FACEBOOK_PAGE_ID}/live_videos?fields=live_views,status&access_token=${FACEBOOK_ACCESS_TOKEN}`
    );
    const data = await res.json();

    // Find the currently live video
    const liveVideo = data.data?.find(video => video.status === 'LIVE');
    return liveVideo?.live_views ?? null;
  } catch (err) {
    console.error('[FACEBOOK] Failed to get viewer count:', err.message);
    return null;
  }
}

async function getTikTokViewerCount() {
  if (!TIKTOK_ACCESS_TOKEN || !TIKTOK_USERNAME) return null;

  try {
    // TikTok API endpoint for live room info
    const res = await fetch(
      `https://open.tiktokapis.com/v2/live/info/?username=${encodeURIComponent(TIKTOK_USERNAME)}`,
      {
        headers: {
          'Authorization': `Bearer ${TIKTOK_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const data = await res.json();

    // Check if live and return viewer count
    if (data.data?.room_info?.status === 2) {
      return data.data.room_info.user_count ?? null;
    }
    return null;
  } catch (err) {
    console.error('[TIKTOK] Failed to get viewer count:', err.message);
    return null;
  }
}

// ====== QUEUE STATE ======
let nowPlaying = null;
let approvedQueue = [];
let pending = [];
let nextPendingId = 1;

// ====== SPOTIFY PLAYBACK POLLING ======
async function updateCurrentPlayback() {
  try {
    await ensureSpotifyToken();
    const data = await spotify.getMyCurrentPlayingTrack();

    if (data.body && data.body.item) {
      const track = data.body.item;
      const progress = data.body.progress_ms || 0;
      const duration = track.duration_ms || 0;
      const isPlaying = data.body.is_playing || false;

      // Find requester from our approved queue if it exists
      const queueItem = approvedQueue.find(q => q.spotifyId === track.id);
      let requester = queueItem ? queueItem.requester : null;

      // If not in queue but we have the same track in nowPlaying, preserve its requester
      if (!requester && nowPlaying && nowPlaying.spotifyId === track.id) {
        requester = nowPlaying.requester;
      }

      nowPlaying = {
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumArt: track.album.images[0]?.url || null,
        spotifyId: track.id,
        progress: progress,
        duration: duration,
        isPlaying: isPlaying,
        requester: requester
      };

      // Remove from approved queue if it was there
      if (queueItem) {
        const idx = approvedQueue.indexOf(queueItem);
        if (idx !== -1) approvedQueue.splice(idx, 1);
      }
    } else {
      // Nothing playing
      if (nowPlaying) {
        console.log('[SPOTIFY] Playback stopped or paused');
      }
      nowPlaying = null;
    }
  } catch (err) {
    // Don't spam errors, just log once
    if (!updateCurrentPlayback.lastError || Date.now() - updateCurrentPlayback.lastError > 60000) {
      console.error('[SPOTIFY] Failed to get current playback:', err.message);
      updateCurrentPlayback.lastError = Date.now();
    }
  }
}

// Poll Spotify every 2 seconds for current playback
setInterval(updateCurrentPlayback, 2000);
updateCurrentPlayback(); // Initial call

// ====== SPECIAL USER TRACKING ======
const seenUsers = new Set();
const lastSeenMap = new Map(); // Track last activity timestamp for each user
const specialUserMessages = {
  // Custom messages per user (case-insensitive)
  'chantheman814': 'TheMan has arrived.',
  'coil666': 'HI KEVIN!!',

  // Default messages for users without custom message
  default: [
    'has entered the chat!',
    'just rolled in!',
    'is here! Everyone act natural.',
    'has joined the party!',
    'just showed up!',
    'is lurking in the shadows...'
  ]
};

// ====== TWITCH BOT ======
const client = new tmi.Client({
  options: { debug: true },
  identity: { username: TWITCH_BOT_USERNAME, password: TWITCH_OAUTH_TOKEN },
  channels: [TWITCH_CHANNEL]
});

client.on('connected', (addr, port) => {
  console.log(`Connected to Twitch chat at ${addr}:${port}`);
  console.log(`Joined channel: #${TWITCH_CHANNEL}`);
});

client.on('disconnected', (reason) => {
  console.log(`Disconnected from Twitch: ${reason}`);
});

client.connect().catch(err => {
  console.error('Failed to connect to Twitch:', err);
});

function say(msg) {
  if (!TWITCH_CHANNEL) return;
  client.say(`#${TWITCH_CHANNEL}`, msg).catch(() => {});
}

function isPrivileged(tags) {
  const badges = tags.badges || {};
  return !!(badges.broadcaster || badges.moderator);
}

// ====== CHAT COMMANDS ======
client.on('message', async (channel, tags, message, self) => {
  const text = message.trim();
  const uname = tags['display-name'] || tags.username || '';

  // Debug logging
  console.log(`[MSG] ${uname}: ${text} | self=${self}`);

  if (self) return;

  // Track last seen timestamp for all users
  lastSeenMap.set(uname.toLowerCase(), Date.now());

  // Check for special user on first message
  checkSpecialUser(uname);

  // Broadcast messages to overlay (filter out commands starting with !)
  // Include emotes data and user color from tags
  if (!text.startsWith('!')) {
    broadcastChatMessage(uname, text, tags.emotes, tags.color);
  }

  if (text.toLowerCase().startsWith('!sr ')) {
    const q = text.slice(4).trim();
    if (!q) return;

    // Auto-approve for broadcaster and mods
    if (isPrivileged(tags)) {
      try {
        await ensureSpotifyToken();
        const s = await spotify.searchTracks(q, { limit: 1 });
        const track = s.body.tracks.items[0];
        if (!track) {
          say(`${uname}, couldn't find "${q}" on Spotify.`);
          return;
        }

        await spotify.addToQueue(track.uri);

        const approved = {
          title: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          spotifyId: track.id,
          albumArt: track.album.images[0]?.url || '',
          requester: uname
        };

        if (!nowPlaying) nowPlaying = approved;
        else approvedQueue.push(approved);

        say(`Added to queue: ${approved.title} by ${approved.artist}`);
        console.log(`[AUTO-APPROVE] ${approved.title} — ${approved.artist} (${uname}) added to queue`);
      } catch (e) {
        say(`${uname}, failed to add song: ${e?.body?.error?.message || e.message}`);
        console.log(`[AUTO-APPROVE] Failed: ${e?.body?.error?.message || e.message}`);
      }
    } else {
      // Regular users need approval
      const item = { id: nextPendingId++, query: q, requester: uname };
      pending.push(item);
      say(`Queued #${item.id}: "${q}" — requested by ${uname}`);
    }
    return;
  }

  if (text.toLowerCase().startsWith('!approve ')) {
    if (!isPrivileged(tags)) return;
    const n = parseInt(text.split(' ')[1], 10);
    const idx = pending.findIndex(p => p.id === n);
    if (idx === -1) {
      console.log(`[APPROVE] No pending item #${n}`);
      return;
    }

    const item = pending.splice(idx, 1)[0];
    try {
      await ensureSpotifyToken();
      const s = await spotify.searchTracks(item.query, { limit: 1 });
      const track = s.body.tracks.items[0];
      if (!track) {
        console.log(`[APPROVE] No Spotify match for "${item.query}"`);
        return;
      }

      await spotify.addToQueue(track.uri);

      const approved = {
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        spotifyId: track.id,
        albumArt: track.album.images[0]?.url || '',
        requester: item.requester
      };

      if (!nowPlaying) nowPlaying = approved;
      else approvedQueue.push(approved);

      console.log(`[APPROVE] #${n}: ${approved.title} — ${approved.artist} (${approved.requester}) added to queue`);
    } catch (e) {
      console.log(`[APPROVE] Failed to approve #${n}: ${e?.body?.error?.message || e.message}`);
    }
    return;
  }

  if (text.toLowerCase().startsWith('!deny ')) {
    if (!isPrivileged(tags)) return;
    const n = parseInt(text.split(' ')[1], 10);
    const idx = pending.findIndex(p => p.id === n);
    if (idx === -1) {
      console.log(`[DENY] No pending item #${n}`);
      return;
    }
    pending.splice(idx, 1);
    console.log(`[DENY] Denied #${n}`);
    return;
  }

  if (text.toLowerCase().startsWith('!cancelsr')) {
    // Allow users to cancel their own pending song requests
    const userPending = pending.filter(p => p.requester.toLowerCase() === uname.toLowerCase());
    if (userPending.length === 0) {
      return say(`${uname}, you have no pending song requests.`);
    }

    // Remove all pending requests from this user
    const removed = pending.filter(p => p.requester.toLowerCase() === uname.toLowerCase());
    pending = pending.filter(p => p.requester.toLowerCase() !== uname.toLowerCase());

    const removedIds = removed.map(r => `#${r.id}`).join(', ');
    say(`${uname}, cancelled your request(s): ${removedIds}`);
    console.log(`[CANCELSR] ${uname} cancelled: ${removedIds}`);
    return;
  }

  if (text.toLowerCase() === '!queue') {
    const next = approvedQueue.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} — ${t.artist}`).join(' | ');
    say(`Now: ${nowPlaying ? `${nowPlaying.title} — ${nowPlaying.artist}` : '—'} | Next: ${next || '—'}`);
    return;
  }

  if (text.toLowerCase() === '!dcd') {
    triggerPromo(0); // Trigger Dead Center Darts promo (index 0)
    console.log(`[DCD] Promo triggered by ${uname}`);
    return;
  }

  if (text.toLowerCase() === '!skip') {
    if (!isPrivileged(tags)) return;
    if (!nowPlaying) return say('Nothing playing.');
    const skipped = nowPlaying;
    nowPlaying = approvedQueue.shift() || null;
    say(`Skipped ${skipped.title}. Now playing ${nowPlaying ? nowPlaying.title : '—'}.`);
    return;
  }

  if (text.toLowerCase().startsWith('!lastseen ')) {
    const targetUser = text.slice(10).trim().toLowerCase();
    if (!targetUser) return say('Usage: !lastseen <username>');

    const lastSeen = lastSeenMap.get(targetUser);
    if (!lastSeen) {
      return say(`No activity during this live, but StreamElements might have more from other lives.`);
    }

    const timeAgo = formatTimeAgo(Date.now() - lastSeen);
    say(`${targetUser} was last seen ${timeAgo} ago.`);
    return;
  }

  if (text.toLowerCase().startsWith('!followage')) {
    if (!DECAPI_TOKEN) {
      return say('Followage requires authentication. Broadcaster: visit https://decapi.me/auth/twitch?redirect=followage&scopes=moderator:read:followers');
    }

    const parts = text.split(' ');
    const targetUser = parts.length > 1 ? parts[1].trim() : uname;

    try {
      const url = `https://decapi.me/twitch/followage/${TWITCH_CHANNEL}/${encodeURIComponent(targetUser)}?token=${encodeURIComponent(DECAPI_TOKEN)}`;
      const res = await fetch(url);
      const data = await res.text();

      if (data.includes('does not follow') || data.includes('not found')) {
        say(`${targetUser} is not following ${TWITCH_CHANNEL}.`);
      } else {
        say(`${targetUser} has been following for ${data}.`);
      }
    } catch (e) {
      say(`Failed to check followage: ${e.message}`);
    }
    return;
  }

});

// ====== HELPER FUNCTIONS ======
function formatTimeAgo(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

// ====== SPECIAL USER DETECTION ======
function checkSpecialUser(username) {
  const lowerUsername = username.toLowerCase();

  // Track all users
  if (!seenUsers.has(lowerUsername)) {
    seenUsers.add(lowerUsername);

    // Check if this is a special user
    if (specialUsersList.includes(lowerUsername)) {
      let message;

      // Check if user has a custom message
      if (specialUserMessages[lowerUsername]) {
        message = specialUserMessages[lowerUsername];
      } else {
        // Use random default message
        const messages = specialUserMessages.default;
        message = `${username} ${messages[Math.floor(Math.random() * messages.length)]}`;
      }

      say(message);
      console.log(`[SPECIAL USER] ${username} detected!`);
    }
  }
}

// Also detect special users when they join (not just on first message)
client.on('join', (channel, username, self) => {
  if (self) return;
  console.log(`[JOIN] ${username} joined the channel`);

  // Track last seen timestamp
  const lowerUsername = username.toLowerCase();
  lastSeenMap.set(lowerUsername, Date.now());

  // Announce special users every time they join
  if (specialUsersList.includes(lowerUsername)) {
    let message;

    // Check if user has a custom message
    if (specialUserMessages[lowerUsername]) {
      message = specialUserMessages[lowerUsername];
    } else {
      // Use random default message
      const messages = specialUserMessages.default;
      message = `${username} ${messages[Math.floor(Math.random() * messages.length)]}`;
    }

    say(message);
    console.log(`[SPECIAL USER] ${username} detected on join!`);
  }
});

// ====== PROMO ======
async function announcePromo() {
  say(`LowLife App + socials: lowlifesofgranboard.com • twitch.tv/${TWITCH_CHANNEL}`);
}

setInterval(announcePromo, Math.max(1, parseInt(PROMO_MINUTES, 10)) * 60 * 1000);

// ====== CHAT RELAY FOR OVERLAY ======
const chatClients = [];
app.get('/chat-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  chatClients.push(res);
  console.log(`[SSE] New client connected. Total clients: ${chatClients.length}`);

  // Send initial connection message
  res.write(`:connected\n\n`);

  req.on('close', () => {
    const idx = chatClients.indexOf(res);
    if (idx !== -1) chatClients.splice(idx, 1);
    console.log(`[SSE] Client disconnected. Total clients: ${chatClients.length}`);
  });
});

function broadcastChatMessage(user, message, emotes, color, platform = 'twitch') {
  const data = JSON.stringify({ user, message, emotes, color, platform, timestamp: Date.now() });
  console.log(`[SSE] Broadcasting to ${chatClients.length} clients:`, data);
  chatClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[SSE] Failed to write to client:', err.message);
    }
  });
}

// ====== PROMO TRIGGER FOR OVERLAY ======
const promoClients = [];
app.get('/promo-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  promoClients.push(res);
  console.log(`[PROMO] New client connected. Total clients: ${promoClients.length}`);

  res.write(`:connected\n\n`);

  req.on('close', () => {
    const idx = promoClients.indexOf(res);
    if (idx !== -1) promoClients.splice(idx, 1);
    console.log(`[PROMO] Client disconnected. Total clients: ${promoClients.length}`);
  });
});

function triggerPromo(promoIndex = 0) {
  const data = JSON.stringify({ index: promoIndex, timestamp: Date.now() });
  console.log(`[PROMO] Triggering promo ${promoIndex} for ${promoClients.length} clients`);
  promoClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[PROMO] Failed to write to client:', err.message);
    }
  });
}

// ====== SCOREBOARD STATE ======
let scoreboard = {
  player1: {
    name: 'TATTOO',
    score: 0
  },
  player2: {
    name: 'OPEN',
    score: 0
  }
};

// ====== ENDPOINTS ======
app.get('/queue', (_req, res) => {
  res.json({ now: nowPlaying, queue: approvedQueue, pending });
});

app.get('/scoreboard', (_req, res) => {
  res.json(scoreboard);
});

app.post('/scoreboard', (req, res) => {
  scoreboard = { ...scoreboard, ...req.body };
  res.json({ success: true, scoreboard });
});

// Approve song from admin panel
app.post('/approve', async (req, res) => {
  const { spotifyId } = req.body;
  const idx = pending.findIndex(p => p.spotifyId === spotifyId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Song not found in pending queue' });
  }

  const item = pending[idx];
  pending.splice(idx, 1);

  try {
    await ensureSpotifyToken();
    await spotify.addToQueue(item.uri);
    approvedQueue.push(item);
    console.log(`[API APPROVE] ${item.title} by ${item.artist}`);
    res.json({ success: true, song: item });
  } catch (e) {
    console.error(`[API APPROVE ERROR]`, e);
    res.status(500).json({ error: 'Failed to add to Spotify queue' });
  }
});

// Deny song from admin panel
app.post('/deny', (req, res) => {
  const { spotifyId } = req.body;
  const idx = pending.findIndex(p => p.spotifyId === spotifyId);

  if (idx === -1) {
    return res.status(404).json({ error: 'Song not found in pending queue' });
  }

  const item = pending[idx];
  pending.splice(idx, 1);
  console.log(`[API DENY] ${item.title} by ${item.artist}`);
  res.json({ success: true, song: item });
});

// Skip current song
app.post('/skip', async (req, res) => {
  if (!nowPlaying) {
    return res.status(400).json({ error: 'Nothing currently playing' });
  }

  const skipped = nowPlaying;
  nowPlaying = approvedQueue.shift() || null;

  try {
    await ensureSpotifyToken();
    await spotify.skipToNext();
    console.log(`[API SKIP] Skipped ${skipped.title}`);
    res.json({ success: true, skipped, nowPlaying });
  } catch (e) {
    console.error(`[API SKIP ERROR]`, e);
    res.status(500).json({ error: 'Failed to skip song' });
  }
});

// Play current song
app.post('/play', async (req, res) => {
  try {
    await ensureSpotifyToken();
    await spotify.play();
    console.log(`[API PLAY] Resumed playback`);
    res.json({ success: true });
  } catch (e) {
    console.error(`[API PLAY ERROR]`, e);
    res.status(500).json({ error: 'Failed to play' });
  }
});

// Pause current song
app.post('/pause', async (req, res) => {
  try {
    await ensureSpotifyToken();
    await spotify.pause();
    console.log(`[API PAUSE] Paused playback`);
    res.json({ success: true });
  } catch (e) {
    console.error(`[API PAUSE ERROR]`, e);
    res.status(500).json({ error: 'Failed to pause' });
  }
});

// Trigger promo from admin panel
app.post('/trigger-promo', (req, res) => {
  const { index } = req.body;
  triggerPromo(index || 0);
  console.log(`[API] Promo triggered (index: ${index})`);
  res.json({ success: true });
});

// Reset bot queues
app.post('/reset-bot', (req, res) => {
  const oldPending = pending.length;
  const oldApproved = approvedQueue.length;

  // Clear all queues
  pending = [];
  approvedQueue = [];
  nowPlaying = null;
  nextPendingId = 1;

  console.log(`[API RESET] Cleared ${oldPending} pending and ${oldApproved} approved songs`);
  res.json({
    success: true,
    cleared: {
      pending: oldPending,
      approved: oldApproved
    }
  });
});

// Get viewer counts for all platforms
app.get('/viewer-counts', async (req, res) => {
  try {
    const counts = {};

    // Fetch all platform counts in parallel
    const [twitchCount, facebookCount, tiktokCount] = await Promise.all([
      TWITCH_CHANNEL ? getViewerCount(TWITCH_CHANNEL) : Promise.resolve(null),
      getFacebookViewerCount(),
      getTikTokViewerCount()
    ]);

    counts.twitch = twitchCount || 0;
    counts.facebook = facebookCount || 0;
    counts.tiktok = tiktokCount || 0;

    res.json(counts);
  } catch (err) {
    console.error('[VIEWER COUNTS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch viewer counts' });
  }
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`Overlay API live on port ${PORT}`);
});
