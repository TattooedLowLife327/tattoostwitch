import 'dotenv/config';
import tmi from 'tmi.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import SpotifyWebApi from 'spotify-web-api-node';
import { neon } from '@neondatabase/serverless';
import { StaticAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { ApiClient } from '@twurple/api';

// ====== ENV VARIABLES ======
const {
  TWITCH_BOT_USERNAME,
  TWITCH_CHANNEL,
  TWITCH_OAUTH_TOKEN,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  TWITCH_CHANNEL_ID,
  TWITCH_CHANNEL_OAUTH_TOKEN, // Channel owner's token for PubSub
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
  DATABASE_URL,
  NETLIFY_URL,
  SPECIAL_USERS,
  ADMIN_PIN
} = process.env;

const PORT = process.env.PORT || 8787;
const ALLOWED_PINS = ['92522', '8317', '5196'];
const specialUsersList = SPECIAL_USERS ? SPECIAL_USERS.toLowerCase().split(',').map(u => u.trim()) : [];

console.log('=== LIGHTWEIGHT BOT STARTING ===');
console.log('TWITCH_CHANNEL:', TWITCH_CHANNEL);
console.log('DATABASE_URL:', DATABASE_URL ? 'Set' : 'Missing');
console.log('TWITCH_CLIENT_SECRET:', TWITCH_CLIENT_SECRET ? 'Set' : 'Missing');
console.log('NETLIFY_URL:', NETLIFY_URL || 'Not set (will use relative paths)');
console.log('================================');

if (!TWITCH_CHANNEL || !SPOTIFY_CLIENT_ID || !DATABASE_URL || !TWITCH_CLIENT_SECRET) {
  console.error('Missing required environment variables');
  process.exit(1);
}

function stripOauthPrefix(token = '') {
  return token.startsWith('oauth:') ? token.slice(6) : token;
}

async function validateTwitchToken(rawToken, label, {
  expectedLogin,
  expectedClientId,
  requiredScopes = []
} = {}) {
  if (!rawToken) {
    console.warn(`[ENV CHECK] ${label} is not set.`);
    return null;
  }

  const token = stripOauthPrefix(rawToken);

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/validate', {
      headers: { Authorization: `OAuth ${token}` }
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload) {
      console.error(`[ENV CHECK] ${label} failed validation (HTTP ${response.status}).`);
      if (payload?.message) {
        console.error(`[ENV CHECK] ${label} details: ${payload.message}`);
      }
      return null;
    }

    const foundLogin = payload.login || '';
    const foundClientId = payload.client_id || '';
    const scopes = payload.scopes || [];
    console.log(`[ENV CHECK] ${label} → login=${foundLogin}, client_id=${foundClientId}, scopes=${scopes.join(' ') || 'none'}`);

    if (expectedLogin && foundLogin.toLowerCase() !== expectedLogin.toLowerCase()) {
      console.error(`[ENV CHECK] ${label} login mismatch: token belongs to "${foundLogin}" but TWITCH_BOT/CHANNEL expects "${expectedLogin}".`);
    }

    if (expectedClientId && foundClientId && foundClientId !== expectedClientId) {
      console.error(`[ENV CHECK] ${label} client_id mismatch: token was issued under "${foundClientId}" but TWITCH_CLIENT_ID is "${expectedClientId}". Render EventSub will reject this.`);
    }

    if (requiredScopes.length > 0) {
      const missingScopes = requiredScopes.filter(scope => !scopes.includes(scope));
      if (missingScopes.length > 0) {
        console.error(`[ENV CHECK] ${label} missing required scopes: ${missingScopes.join(', ')}`);
      }
    }

    return payload;
  } catch (error) {
    console.error(`[ENV CHECK] ${label} validation errored:`, error.message);
    return null;
  }
}

await validateTwitchToken(TWITCH_OAUTH_TOKEN, 'TWITCH_OAUTH_TOKEN (bot)', {
  expectedLogin: TWITCH_BOT_USERNAME,
  requiredScopes: ['chat:read', 'chat:edit']
});

await validateTwitchToken(TWITCH_CHANNEL_OAUTH_TOKEN, 'TWITCH_CHANNEL_OAUTH_TOKEN (channel)', {
  expectedLogin: TWITCH_CHANNEL,
  expectedClientId: TWITCH_CLIENT_ID,
  requiredScopes: ['channel:read:redemptions']
});

// ====== DATABASE ======
const db = neon(DATABASE_URL);

async function query(sql, params = []) {
  try {
    return await db(sql, params);
  } catch (error) {
    console.error('Database error:', error);
    throw error;
  }
}

// ====== EXPRESS (SSE ONLY) ======
const app = express();
app.use(cors());
app.use(express.json());

// ====== SPOTIFY ======
const spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET,
  redirectUri: 'http://localhost:8787/spotify-callback'
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

// ====== SPOTIFY PLAYBACK MONITORING ======
let previousTrackId = null;
let cachedContextUri = null;
let cachedPlaylistName = null;

async function updateCurrentPlayback() {
  try {
    await ensureSpotifyToken();
    const data = await spotify.getMyCurrentPlayingTrack();

    if (data.body && data.body.item) {
      const track = data.body.item;
      const progress = data.body.progress_ms || 0;
      const duration = track.duration_ms || 0;
      const isPlaying = data.body.is_playing || false;
      const trackId = track.id;

      // Only fetch playlist info if track changed
      let playlistName = null;
      if (trackId !== previousTrackId) {
        console.log('[SPOTIFY] Track changed:', track.name);

        // Mark previous track as completed (if it was from our queue)
        if (previousTrackId) {
          await query(
            'UPDATE song_requests SET status = $1, updated_at = NOW() WHERE spotify_id = $2 AND status = $3',
            ['completed', previousTrackId, 'playing']
          );
        }

        // Check if this track is from our queue (check both approved and playing status)
        const queuedSong = await query(
          'SELECT * FROM song_requests WHERE spotify_id = $1 AND status IN ($2, $3) LIMIT 1',
          [trackId, 'approved', 'playing']
        );

        let requester = null;
        if (queuedSong && queuedSong[0]) {
          requester = queuedSong[0].requester;
          // Mark as playing if not already
          if (queuedSong[0].status === 'approved') {
            await query(
              'UPDATE song_requests SET status = $1, updated_at = NOW() WHERE spotify_id = $2',
              ['playing', trackId]
            );
          }
        }

        // Get context (playlist/album) only when track changes
        if (!requester && data.body.context) {
          const contextUri = data.body.context.uri;

          // Check cache first to avoid rate limiting
          if (contextUri === cachedContextUri && cachedPlaylistName) {
            playlistName = cachedPlaylistName;
          } else {
            try {
              if (contextUri.startsWith('spotify:playlist:')) {
                const playlistId = contextUri.split(':')[2];
                const playlistInfo = await spotify.getPlaylist(playlistId);
                playlistName = playlistInfo.body.name;
              } else if (contextUri.startsWith('spotify:album:')) {
                const albumId = contextUri.split(':')[2];
                const albumInfo = await spotify.getAlbum(albumId);
                playlistName = `${albumInfo.body.name} (Album)`;
              } else if (contextUri.startsWith('spotify:artist:')) {
                const artistId = contextUri.split(':')[2];
                const artistInfo = await spotify.getArtist(artistId);
                playlistName = `${artistInfo.body.name} Radio`;
              }
              // Cache the result
              cachedContextUri = contextUri;
              cachedPlaylistName = playlistName;
            } catch (err) {
              const errorMsg = err.body?.error?.message || err.message || 'Unknown error';
              const errorDetails = err.statusCode === 429 ? 'Rate limited - using cache' : errorMsg;
              console.error('[SPOTIFY] Failed to get context. Status:', err.statusCode, 'Message:', errorDetails);
              // Try to use cached value even if it's from a different context (better than nothing)
              if (cachedPlaylistName) {
                playlistName = cachedPlaylistName;
              }
              // Otherwise leave as null - don't show wrong info
            }
          }
        }

        // Don't fall back to album name - leave it null if we can't determine the actual playlist

        // Update current_track in database
        await query(
          `UPDATE current_track
           SET spotify_id = $1, title = $2, artist = $3, album = $4,
               album_art = $5, requester = $6, playlist_name = $7,
               progress_ms = $8, duration_ms = $9, is_playing = $10,
               updated_at = NOW()
           WHERE id = 1`,
          [
            trackId,
            track.name,
            track.artists.map(a => a.name).join(', '),
            track.album.name,
            track.album.images[0]?.url || null,
            requester,
            playlistName,
            progress,
            duration,
            isPlaying
          ]
        );

        previousTrackId = trackId;
      } else {
        // Same track, just update progress
        await query(
          `UPDATE current_track
           SET progress_ms = $1, is_playing = $2, updated_at = NOW()
           WHERE id = 1`,
          [progress, isPlaying]
        );
      }
    } else {
      // Nothing playing
      if (previousTrackId) {
        console.log('[SPOTIFY] Playback stopped');
        previousTrackId = null;
        await query(
          'UPDATE current_track SET spotify_id = NULL, is_playing = false, updated_at = NOW() WHERE id = 1'
        );
      }
    }
  } catch (err) {
    if (!updateCurrentPlayback.lastError || Date.now() - updateCurrentPlayback.lastError > 60000) {
      console.error('[SPOTIFY] Playback update error:', err.message);
      updateCurrentPlayback.lastError = Date.now();
    }
  }
}

// Poll Spotify every 5 seconds (optimized from 2s)
setInterval(updateCurrentPlayback, 5000);
updateCurrentPlayback();

// ====== APPROVED SONG QUEUE PROCESSOR ======
async function processApprovedSongs() {
  try {
    // Get all approved songs
    const approved = await query(
      'SELECT * FROM song_requests WHERE status = $1 ORDER BY created_at ASC LIMIT 10',
      ['approved']
    );

    if (approved && approved.length > 0) {
      for (const song of approved) {
        try {
          await ensureSpotifyToken();
          await spotify.addToQueue(song.uri);
          console.log(`[QUEUE] Added to Spotify: ${song.title} by ${song.artist}`);

          // Mark as playing so it stays visible in queue but doesn't get re-added
          await query(
            'UPDATE song_requests SET status = $1, updated_at = NOW() WHERE id = $2',
            ['playing', song.id]
          );
        } catch (err) {
          console.error(`[QUEUE] Failed to add ${song.title}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error('[QUEUE] Process error:', err.message);
  }
}

// Process queue every 10 seconds
setInterval(processApprovedSongs, 10000);

// ====== CHECK FOR ACTION REQUESTS ======
let lastActionCheck = Date.now();

async function checkActionRequests() {
  try {
    const requests = await query(
      `SELECT * FROM activity_log
       WHERE event_type IN ('skip_requested', 'play_requested', 'pause_requested', 'promo_requested', 'volume_requested')
       AND created_at > $1
       ORDER BY created_at DESC`,
      [new Date(lastActionCheck)]
    );

    if (requests && requests.length > 0) {
      await ensureSpotifyToken();

      for (const req of requests) {
        try {
          if (req.event_type === 'skip_requested') {
            console.log('[ACTION] Skip requested, executing...');
            await spotify.skipToNext();
          } else if (req.event_type === 'play_requested') {
            console.log('[ACTION] Play requested, executing...');
            await spotify.play();
          } else if (req.event_type === 'pause_requested') {
            console.log('[ACTION] Pause requested, executing...');
            await spotify.pause();
          } else if (req.event_type === 'promo_requested') {
            console.log('[ACTION] Promo requested, executing...');
            // TODO: Add promo message logic if needed
          } else if (req.event_type === 'volume_requested') {
            const volume = req.details?.volume || 50;
            console.log(`[ACTION] Volume change to ${volume}% requested, executing...`);
            await spotify.setVolume(volume);
          }

          // Delete processed request so it doesn't execute again
          await query('DELETE FROM activity_log WHERE id = $1', [req.id]);
        } catch (err) {
          console.error(`[ACTION] Failed to execute ${req.event_type}:`, err.message);
        }
      }

      lastActionCheck = Date.now();
    }
  } catch (err) {
    console.error('[ACTION] Check error:', err.message);
  }
}

setInterval(checkActionRequests, 3000);

// ====== TWITCH BOT ======
const seenUsers = new Set(); // Session-only tracking
const lastSeenMap = new Map();

const specialUserMessages = {
  'chantheman814': 'TheMan has arrived.',
  'coil666': 'HI KEVIN!!',
  default: [
    'has entered the chat!',
    'just rolled in!',
    'is here! Everyone act natural.',
    'has joined the party!',
    'just showed up!',
    'is lurking in the shadows...'
  ]
};

const client = new tmi.Client({
  options: {
    debug: true,
    reconnect: true,
    maxReconnectAttempts: Infinity,
    maxReconnectInterval: 30000,
    reconnectDecay: 1.5,
    reconnectInterval: 1000
  },
  identity: { username: TWITCH_BOT_USERNAME, password: TWITCH_OAUTH_TOKEN },
  channels: [TWITCH_CHANNEL]
});

client.on('connected', (addr, port) => {
  console.log(`[TWITCH] Connected to ${addr}:${port}`);
});

client.on('disconnected', (reason) => {
  console.log(`[TWITCH] Disconnected: ${reason}`);
});

client.connect().catch(err => {
  console.error('[TWITCH] Connection failed:', err);
});

async function say(msg) {
  if (!TWITCH_CHANNEL_ID || !botUserId || !TWITCH_OAUTH_TOKEN) {
    console.warn('[SAY] Missing channel ID, bot user ID, or bot OAuth token');
    return;
  }

  try {
    const botToken = stripOauthPrefix(TWITCH_OAUTH_TOKEN);
    const response = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Client-Id': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        broadcaster_id: TWITCH_CHANNEL_ID,
        sender_id: botUserId,
        message: msg
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[SAY] API error:', response.status, error);
    }
  } catch (err) {
    console.error('[SAY] Failed to send message:', err.message);
  }
}

function isPrivileged(tags) {
  const badges = tags.badges || {};
  return !!(badges.broadcaster || badges.moderator);
}

// ====== CHAT MESSAGE HANDLER (EventSub) ======
async function handleChatMessage(event) {
  const text = event.messageText.trim();
  const uname = event.chatterUserName;
  const userId = event.chatterUserId;
  const badges = event.badges || {};
  const color = event.color;

  // Skip bot's own messages
  if (userId === TWITCH_CHANNEL_ID) return;

  // Track last seen
  lastSeenMap.set(uname.toLowerCase(), Date.now());

  // Update user activity in DB (async, don't wait)
  query('SELECT update_user_activity($1)', [uname]).catch(() => {});

  // Check special users
  checkSpecialUser(uname);

  // Chat relay (for overlay)
  const botNames = ['streamelements', 'nightbot', 'soundalerts', 'streamlabs', 'moobot', 'streamstickers', 'fossabot'];
  const lowerUname = uname.toLowerCase();
  const isBot = botNames.includes(lowerUname);
  let shouldBroadcast = !text.startsWith('!') && !isBot;

  if (lowerUname === 'lowlifesofgb') {
    shouldBroadcast = specialUsersList.some(u => text.toLowerCase().includes(u));
  }

  if (shouldBroadcast) {
    broadcastChatMessage(uname, text, event.emotes, color);
  }

  // Check if user is privileged
  const isPrivileged = !!(badges.broadcaster || badges.moderator);

  // !sr command
  if (text.toLowerCase().startsWith('!sr ')) {
    const q = text.slice(4).trim();
    if (!q) return;

    try {
      await ensureSpotifyToken();
      const s = await spotify.searchTracks(q, { limit: 1 });
      const track = s.body.tracks.items[0];
      if (!track) {
        say(`${uname}, couldn't find "${q}" on Spotify.`);
        return;
      }

      const result = await query(
        `INSERT INTO song_requests (spotify_id, title, artist, album_art, requester, status, uri)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          track.id,
          track.name,
          track.artists.map(a => a.name).join(', '),
          track.album.images[0]?.url || '',
          uname,
          'pending',
          track.uri
        ]
      );
      const id = result[0].id;
      say(`Song request #${id}: "${track.name}" by ${track.artists[0].name} - requested by ${uname}`);
    } catch (e) {
      say(`${uname}, failed: ${e?.body?.error?.message || e.message}`);
    }
    return;
  }

  // !queue command
  if (text.toLowerCase() === '!queue') {
    try {
      const current = await query('SELECT * FROM current_track WHERE id = 1');
      const queue = await query(
        'SELECT * FROM song_requests WHERE status IN ($1, $2) ORDER BY created_at ASC LIMIT 5',
        ['approved', 'completed']
      );

      const nowText = current[0]?.title ? `${current[0].title} - ${current[0].artist}` : '—';
      const queueText = queue.length > 0
        ? queue.map((t, i) => `${i + 1}. ${t.title} - ${t.artist}`).join(' | ')
        : '—';

      say(`Now: ${nowText} | Next: ${queueText}`);
    } catch (e) {
      console.error('[!queue error]:', e);
    }
    return;
  }

  // !approve (mods only)
  if (text.toLowerCase().startsWith('!approve ') && isPrivileged) {
    const id = parseInt(text.split(' ')[1], 10);
    try {
      const result = await query(
        'UPDATE song_requests SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3 RETURNING *',
        ['approved', id, 'pending']
      );
      if (result && result.length > 0) {
        say(`Approved #${id}: ${result[0].title}`);
      }
    } catch (e) {
      console.error('[!approve error]:', e);
    }
    return;
  }

  // !deny (mods only)
  if (text.toLowerCase().startsWith('!deny ') && isPrivileged) {
    const id = parseInt(text.split(' ')[1], 10);
    try {
      const result = await query(
        'UPDATE song_requests SET status = $1, updated_at = NOW() WHERE id = $2 AND status = $3 RETURNING *',
        ['denied', id, 'pending']
      );
      if (result && result.length > 0) {
        say(`Denied #${id}`);
      }
    } catch (e) {
      console.error('[!deny error]:', e);
    }
    return;
  }

  // !skip (mods only)
  if (text.toLowerCase() === '!skip' && isPrivileged) {
    try {
      await ensureSpotifyToken();

      const nextSong = await query(
        'SELECT * FROM song_requests WHERE status = $1 ORDER BY created_at ASC LIMIT 1',
        ['approved']
      );

      if (nextSong && nextSong.length > 0) {
        try {
          await spotify.addToQueue(nextSong[0].uri);
          console.log(`[SKIP] Added next SR to queue: ${nextSong[0].title}`);
        } catch (err) {
          console.error('[SKIP] Failed to add to queue:', err.message);
        }
      }

      await spotify.skipToNext();
      say('Song skipped.');
    } catch (e) {
      say(`Failed to skip: ${e?.body?.error?.message || e.message}`);
    }
    return;
  }

  // !cancel or !cancelsr
  if (text.toLowerCase().startsWith('!cancel')) {
    try {
      const result = await query(
        'DELETE FROM song_requests WHERE requester = $1 AND status IN ($2, $3) RETURNING id, title',
        [uname, 'pending', 'approved']
      );
      if (result && result.length > 0) {
        const titles = result.map(r => `"${r.title}"`).join(', ');
        say(`${uname}, cancelled: ${titles}`);
      } else {
        say(`${uname}, you have no pending or approved requests to cancel.`);
      }
    } catch (e) {
      console.error('[!cancel error]:', e);
    }
    return;
  }

  // !dcd (Dead Center Darts promo)
  if (text.toLowerCase() === '!dcd') {
    say('Dead Center Darts - www.deadcenterdarts.com');
    triggerPromo(0);
    console.log(`[DCD] Promo triggered by ${uname}`);
    return;
  }

  // !lastseen
  if (text.toLowerCase().startsWith('!lastseen ')) {
    const targetUser = text.slice(10).trim().toLowerCase();
    if (!targetUser) return say('Usage: !lastseen <username>');

    const lastSeen = lastSeenMap.get(targetUser);
    if (!lastSeen) {
      return say(`No activity during this stream.`);
    }

    const timeAgo = formatTimeAgo(Date.now() - lastSeen);
    say(`${targetUser} was last seen ${timeAgo} ago.`);
    return;
  }

  // !lurkers - show anonymous viewer count
  if (text.toLowerCase() === '!lurkers') {
    try {
      const streamRes = await fetch(`https://api.twitch.tv/helix/streams?user_login=${TWITCH_CHANNEL}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${stripOauthPrefix(TWITCH_CHANNEL_OAUTH_TOKEN)}`
        }
      });
      const streamData = await streamRes.json();

      if (!streamData.data || streamData.data.length === 0) {
        return say('Stream is not currently live.');
      }

      const totalViewers = streamData.data[0].viewer_count || 0;
      const chattersCount = lastSeenMap.size;
      const anonymous = Math.max(0, totalViewers - chattersCount);

      say(`We have ${anonymous} anonymous viewers! Don't be shy, log in - Tattoo loves giving out subs to the fan club so they can hate and watch ads!`);
    } catch (e) {
      console.error('[!lurkers error]:', e);
      say('Failed to get lurker count.');
    }
    return;
  }
}

// ====== IRC CHAT COMMANDS (for reading messages) ======
client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  // Convert IRC message to EventSub-like format and pass to handler
  const event = {
    messageText: message.trim(),
    chatterUserName: tags['display-name'] || tags.username || '',
    chatterUserId: tags['user-id'] || '',
    badges: tags.badges || {},
    color: tags.color || '#FFFFFF',
    emotes: tags.emotes
  };

  handleChatMessage(event);
});

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

function checkSpecialUser(username) {
  const lowerUsername = username.toLowerCase();
  if (!seenUsers.has(lowerUsername)) {
    seenUsers.add(lowerUsername);
    if (specialUsersList.includes(lowerUsername)) {
      let message;
      if (specialUserMessages[lowerUsername]) {
        message = specialUserMessages[lowerUsername];
      } else {
        const messages = specialUserMessages.default;
        message = `${username} ${messages[Math.floor(Math.random() * messages.length)]}`;
      }
      say(message);
      console.log(`[SPECIAL USER] ${username}`);
    }
  }
}

client.on('join', (channel, username, self) => {
  if (self) return;
  const lowerUsername = username.toLowerCase();
  lastSeenMap.set(lowerUsername, Date.now());
  if (specialUsersList.includes(lowerUsername)) {
    let message;
    if (specialUserMessages[lowerUsername]) {
      message = specialUserMessages[lowerUsername];
    } else {
      const messages = specialUserMessages.default;
      message = `${username} ${messages[Math.floor(Math.random() * messages.length)]}`;
    }
    say(message);
  }
});

// ====== RAID EVENTS ======
client.on('raided', (channel, username, viewers) => {
  console.log(`[RAID] ${username} raided with ${viewers} viewers!`);
  say(`Thank you ${username} for the raid with ${viewers} viewers! Welcome to the skeleton crew!`);
  triggerRaidAlert(username, viewers);
});

// ====== APP ACCESS TOKEN & BOT USER ID ======
let appAccessToken = null;
let botUserId = null;

async function getBotUserId() {
  try {
    const response = await fetch(`https://api.twitch.tv/helix/users?login=${TWITCH_BOT_USERNAME}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${appAccessToken}`
      }
    });
    const data = await response.json();
    if (data.data && data.data[0]) {
      botUserId = data.data[0].id;
      console.log(`[AUTH] Bot user ID: ${botUserId} (${TWITCH_BOT_USERNAME})`);
    }
  } catch (err) {
    console.error('[AUTH] Failed to get bot user ID:', err.message);
  }
}

async function getAppAccessToken() {
  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials&scope=channel:bot user:write:chat user:bot`
    });
    const data = await response.json();
    appAccessToken = data.access_token;
    console.log('[AUTH] App access token obtained');

    // Get bot user ID
    await getBotUserId();

    // Refresh before expiry (cap at 1 hour to avoid setTimeout overflow)
    const refreshDelay = Math.min((data.expires_in - 300) * 1000, 3600000);
    setTimeout(getAppAccessToken, refreshDelay);
    return appAccessToken;
  } catch (err) {
    console.error('[AUTH] Failed to get app access token:', err.message);
    return null;
  }
}

// ====== CHANNEL POINTS & CHAT (EventSub) ======
let eventSubListener = null;
let apiClient = null;

async function setupEventSub() {
  if (TWITCH_CLIENT_ID && TWITCH_CHANNEL_ID && TWITCH_CHANNEL_OAUTH_TOKEN) {
    try {
      console.log('[EVENTSUB] Setting up EventSub for channel:', TWITCH_CHANNEL_ID);

      // Get app access token for sending messages
      await getAppAccessToken();

      // Use CHANNEL owner's user token for EventSub
      const cleanToken = stripOauthPrefix(TWITCH_CHANNEL_OAUTH_TOKEN);
      const authProvider = new StaticAuthProvider(TWITCH_CLIENT_ID, cleanToken);
      apiClient = new ApiClient({ authProvider });

      eventSubListener = new EventSubWsListener({ apiClient });
      await eventSubListener.start();

      // Channel Points
      await eventSubListener.onChannelRedemptionAdd(TWITCH_CHANNEL_ID, (event) => {
        const username = event.userName;
        const rewardName = event.rewardTitle;
        console.log(`[CHANNEL POINTS] *** ${username} redeemed: ${rewardName} ***`);
        triggerChannelPointsAlert(username, rewardName);
      });

      // NOTE: Using IRC for chat instead of EventSub - avoids needing user:read:chat scope
      // Still get Chat Bot badge because we send via API with app access token

      console.log('[EVENTSUB] EventSub listener ACTIVE (channel points)');
    } catch (err) {
      console.error('[EVENTSUB] Setup failed:', err.message);
    }
  } else {
    console.log('[EVENTSUB] Missing env vars - CLIENT_ID:', !!TWITCH_CLIENT_ID, 'CHANNEL_ID:', !!TWITCH_CHANNEL_ID, 'CHANNEL_OAUTH_TOKEN:', !!TWITCH_CHANNEL_OAUTH_TOKEN);
  }
}

setupEventSub();

// ====== SPOTIFY AUTH ENDPOINTS ======
app.get('/spotify-auth', (req, res) => {
  const scopes = ['user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing'];
  const authorizeURL = spotify.createAuthorizeURL(scopes);
  res.redirect(authorizeURL);
});

app.get('/spotify-callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.send('<h1>Error: No authorization code received</h1>');
  }

  try {
    const data = await spotify.authorizationCodeGrant(code);
    const accessToken = data.body['access_token'];
    const refreshToken = data.body['refresh_token'];

    res.send(`
      <html>
        <head><title>Spotify Authorization Success</title></head>
        <body style="font-family: monospace; padding: 40px; background: #111; color: #fff;">
          <h1 style="color: #1DB954;">Spotify Authorization Successful!</h1>
          <h2>Refresh Token (add this to your .env file):</h2>
          <pre style="background: #222; padding: 20px; border-radius: 8px; overflow-wrap: break-word;">SPOTIFY_REFRESH_TOKEN=${refreshToken}</pre>
          <p>Copy the line above and paste it into your .env file, then restart the bot.</p>
        </body>
      </html>
    `);
  } catch (err) {
    res.send(`<h1>Error</h1><pre>${JSON.stringify(err, null, 2)}</pre>`);
  }
});

// ====== API ENDPOINTS ======
app.get('/api/spotify-queue', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    await ensureSpotifyToken();
    const queueData = await spotify.getMyCurrentPlaybackState();

    if (!queueData.body || !queueData.body.item) {
      return res.json([]);
    }

    // Get Spotify's queue
    const queueResponse = await fetch('https://api.spotify.com/v1/me/player/queue', {
      headers: {
        'Authorization': `Bearer ${spotify.getAccessToken()}`
      }
    });

    if (!queueResponse.ok) {
      return res.json([]);
    }

    const queue = await queueResponse.json();

    // Return next 3 tracks
    const tracks = (queue.queue || []).slice(0, 3).map(track => ({
      spotifyId: track.id,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      albumArt: track.album.images[0]?.url || null,
      requester: null,
      uri: track.uri
    }));

    res.json(tracks);
  } catch (error) {
    console.error('[API] Spotify queue error:', error.message);
    res.json([]);
  }
});

app.post('/restart-bot', (req, res) => {
  const providedPin = (req.body?.pin || '').trim();

  if (!providedPin) {
    return res.status(400).json({ error: 'Missing PIN' });
  }

  if (!ALLOWED_PINS.includes(providedPin)) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  console.log('[ADMIN] Restart requested via /restart-bot endpoint. Exiting in 2s.');
  res.json({ message: 'Bot restart scheduled. Service will be back online in ~10 seconds.' });

  setTimeout(() => {
    process.exit(0);
  }, 2000);
});

// ====== SPECIAL USERS MANAGEMENT ======
app.get('/special-users', (req, res) => {
  res.json({ users: specialUsersList });
});

app.post('/special-users', (req, res) => {
  const { username, action } = req.body || {};

  if (!username || !action) {
    return res.status(400).json({ error: 'Missing username or action' });
  }

  const user = username.toLowerCase().trim();

  if (action === 'add') {
    if (!specialUsersList.includes(user)) {
      specialUsersList.push(user);
      console.log(`[ADMIN] Added special user: ${user}`);
    }
    res.json({ success: true, users: specialUsersList });
  } else if (action === 'remove') {
    const index = specialUsersList.indexOf(user);
    if (index > -1) {
      specialUsersList.splice(index, 1);
      console.log(`[ADMIN] Removed special user: ${user}`);
    }
    res.json({ success: true, users: specialUsersList });
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

// ====== FOLLOWER COUNT ======
app.get('/followers', async (req, res) => {
  try {
    const response = await fetch(`https://api.twitch.tv/helix/channels/followers?broadcaster_id=${TWITCH_CHANNEL_ID}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${stripOauthPrefix(TWITCH_CHANNEL_OAUTH_TOKEN)}`
      }
    });

    const data = await response.json();
    res.json({ total: data.total || 0 });
  } catch (e) {
    console.error('[FOLLOWERS] Error fetching follower count:', e);
    res.status(500).json({ error: 'Failed to fetch followers', total: 0 });
  }
});

// ====== BRB / SCREEN OVERLAY STATE ======
let screenOverlayState = {
  type: null, // 'brb', 'tech_difficulties', 'starting_soon'
  isActive: false,
  endTime: null,
  durationMinutes: 0
};

app.get('/api/screen-overlay', (req, res) => {
  const now = Date.now();
  if (screenOverlayState.isActive && screenOverlayState.endTime && now >= screenOverlayState.endTime) {
    // Timer expired
    screenOverlayState.isActive = false;
    screenOverlayState.type = null;
    screenOverlayState.endTime = null;
  }

  res.json({
    ...screenOverlayState,
    timeRemaining: screenOverlayState.endTime ? Math.max(0, screenOverlayState.endTime - now) : 0
  });
});

app.post('/api/screen-overlay', (req, res) => {
  const { type, isActive, durationMinutes } = req.body || {};

  if (!type && !isActive) {
    // Deactivate
    screenOverlayState = {
      type: null,
      isActive: false,
      endTime: null,
      durationMinutes: 0
    };
    console.log('[SCREEN] Overlay deactivated');
    return res.json({ success: true, state: screenOverlayState });
  }

  if (type && isActive && durationMinutes) {
    screenOverlayState = {
      type,
      isActive: true,
      endTime: Date.now() + (durationMinutes * 60 * 1000),
      durationMinutes
    };
    console.log(`[SCREEN] ${type} overlay activated for ${durationMinutes} minutes`);
  }

  res.json({ success: true, state: screenOverlayState });
});

// ====== CHAT SSE (for overlay) ======
const chatClients = [];
app.get('/chat-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  chatClients.push(res);
  console.log(`[SSE] Chat client connected. Total: ${chatClients.length}`);
  res.write(':connected\n\n');

  req.on('close', () => {
    const idx = chatClients.indexOf(res);
    if (idx !== -1) chatClients.splice(idx, 1);
    console.log(`[SSE] Chat client disconnected. Total: ${chatClients.length}`);
  });
});

function broadcastChatMessage(user, message, emotes, color) {
  const data = JSON.stringify({ user, message, emotes, color, platform: 'twitch', timestamp: Date.now() });
  chatClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[SSE] Failed to write:', err.message);
    }
  });
}

// ====== PROMO SSE (for overlay) ======
const promoClients = [];
app.get('/promo-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  promoClients.push(res);
  console.log(`[SSE] Promo client connected. Total: ${promoClients.length}`);
  res.write(':connected\n\n');

  req.on('close', () => {
    const idx = promoClients.indexOf(res);
    if (idx !== -1) promoClients.splice(idx, 1);
    console.log(`[SSE] Promo client disconnected. Total: ${promoClients.length}`);
  });
});

// Trigger a promo message to connected overlay clients
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

// ====== RAID SSE (for overlay) ======
const raidClients = [];
app.get('/raid-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  raidClients.push(res);
  console.log(`[SSE] Raid client connected. Total: ${raidClients.length}`);
  res.write(':connected\n\n');

  req.on('close', () => {
    const idx = raidClients.indexOf(res);
    if (idx !== -1) raidClients.splice(idx, 1);
    console.log(`[SSE] Raid client disconnected. Total: ${raidClients.length}`);
  });
});

// Trigger raid alert to connected overlay clients
function triggerRaidAlert(username, viewers) {
  const data = JSON.stringify({ username, viewers, timestamp: Date.now() });
  console.log(`[RAID] ${username} raided with ${viewers} viewers! Notifying ${raidClients.length} clients`);
  raidClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[RAID] Failed to write to client:', err.message);
    }
  });
}

// ====== CHANNEL POINTS SSE (for overlay) ======
const channelPointsClients = [];
app.get('/channel-points-events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  channelPointsClients.push(res);
  console.log(`[SSE] Channel Points client connected. Total: ${channelPointsClients.length}`);
  res.write(':connected\n\n');

  req.on('close', () => {
    const idx = channelPointsClients.indexOf(res);
    if (idx !== -1) channelPointsClients.splice(idx, 1);
    console.log(`[SSE] Channel Points client disconnected. Total: ${channelPointsClients.length}`);
  });
});

// Trigger channel points alert to connected overlay clients
function triggerChannelPointsAlert(username, reward) {
  const data = JSON.stringify({ username, reward, timestamp: Date.now() });
  console.log(`[CHANNEL POINTS] ${username} redeemed "${reward}"! Notifying ${channelPointsClients.length} clients`);
  channelPointsClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('[CHANNEL POINTS] Failed to write to client:', err.message);
    }
  });
}

// Poll for promo triggers from DB
async function checkPromoTriggers() {
  // Implementation for promo triggers if needed
}
setInterval(checkPromoTriggers, 5000);

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`[BOT] Lightweight bot running on port ${PORT}`);
  console.log('[BOT] Twitch IRC: Enabled');
  console.log(`[BOT] Twitch EventSub: ${eventSubListener ? 'Enabled' : 'Disabled'}`);
  console.log('[BOT] Spotify monitoring: Every 5s');
  console.log('[BOT] Queue processor: Every 10s');
  console.log('[BOT] SSE endpoints: /chat-stream, /promo-events, /raid-events, /channel-points-events');
});
