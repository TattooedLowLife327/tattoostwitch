import 'dotenv/config';
import tmi from 'tmi.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import SpotifyWebApi from 'spotify-web-api-node';
import { neon } from '@neondatabase/serverless';

// ====== ENV VARIABLES ======
const {
  TWITCH_BOT_USERNAME,
  TWITCH_CHANNEL,
  TWITCH_OAUTH_TOKEN,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
  DATABASE_URL,
  NETLIFY_URL,
  SPECIAL_USERS
} = process.env;

const PORT = process.env.PORT || 8787;
const specialUsersList = SPECIAL_USERS ? SPECIAL_USERS.toLowerCase().split(',').map(u => u.trim()) : [];

console.log('=== LIGHTWEIGHT BOT STARTING ===');
console.log('TWITCH_CHANNEL:', TWITCH_CHANNEL);
console.log('DATABASE_URL:', DATABASE_URL ? 'Set' : 'Missing');
console.log('NETLIFY_URL:', NETLIFY_URL || 'Not set (will use relative paths)');
console.log('================================');

if (!TWITCH_CHANNEL || !SPOTIFY_CLIENT_ID || !DATABASE_URL) {
  console.error('Missing required environment variables');
  process.exit(1);
}

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
  clientSecret: SPOTIFY_CLIENT_SECRET
});
if (SPOTIFY_REFRESH_TOKEN) spotify.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

async function ensureSpotifyToken() {
  try {
    const data = await spotify.refreshAccessToken();
    spotify.setAccessToken(data.body['access_token']);
  } catch (err) {
    console.error('Spotify token refresh failed:', err?.body?.error || err?.message);
  }
}

// ====== SPOTIFY PLAYBACK MONITORING ======
let previousTrackId = null;

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

        // Check if this track is from our queue
        const queuedSong = await query(
          'SELECT * FROM song_requests WHERE spotify_id = $1 AND status = $2 LIMIT 1',
          [trackId, 'approved']
        );

        let requester = null;
        if (queuedSong && queuedSong[0]) {
          requester = queuedSong[0].requester;
          // Mark as playing
          await query(
            'UPDATE song_requests SET status = $1, updated_at = NOW() WHERE spotify_id = $2',
            ['playing', trackId]
          );
        }

        // Get context (playlist/album) only when track changes
        if (!requester && data.body.context) {
          const contextUri = data.body.context.uri;
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
          } catch (err) {
            console.error('[SPOTIFY] Failed to get context:', err.message);
          }
        }

        if (!playlistName) {
          playlistName = track.album.name;
        }

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

  if (self) return;

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
    broadcastChatMessage(uname, text, tags.emotes, tags.color);
  }

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

      // All song requests go to pending for PWA approval
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
  if (text.toLowerCase().startsWith('!approve ') && isPrivileged(tags)) {
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
  if (text.toLowerCase().startsWith('!deny ') && isPrivileged(tags)) {
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
  if (text.toLowerCase() === '!skip' && isPrivileged(tags)) {
    try {
      await ensureSpotifyToken();
      await spotify.skipToNext();
      say('Song skipped.');
    } catch (e) {
      say(`Failed to skip: ${e?.body?.error?.message || e.message}`);
    }
    return;
  }

  // !cancelsr
  if (text.toLowerCase().startsWith('!cancelsr')) {
    try {
      const result = await query(
        'DELETE FROM song_requests WHERE requester = $1 AND status = $2 RETURNING id',
        [uname, 'pending']
      );
      if (result && result.length > 0) {
        const ids = result.map(r => `#${r.id}`).join(', ');
        say(`${uname}, cancelled: ${ids}`);
      } else {
        say(`${uname}, you have no pending requests.`);
      }
    } catch (e) {
      console.error('[!cancelsr error]:', e);
    }
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

// Poll for promo triggers from DB
async function checkPromoTriggers() {
  // Implementation for promo triggers if needed
}
setInterval(checkPromoTriggers, 5000);

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`[BOT] Lightweight bot running on port ${PORT}`);
  console.log('[BOT] Twitch IRC: Enabled');
  console.log('[BOT] Spotify monitoring: Every 5s');
  console.log('[BOT] Queue processor: Every 10s');
  console.log('[BOT] SSE endpoints: /chat-stream, /promo-events');
});
