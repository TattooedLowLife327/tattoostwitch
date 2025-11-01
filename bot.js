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
  PROMO_MINUTES
} = process.env;

const PORT = process.env.PORT || 8787;

if (!TWITCH_CHANNEL || !TWITCH_CLIENT_ID || !SPOTIFY_CLIENT_ID) {
  console.error('❌ Missing required environment variables. Check Netlify settings.');
  process.exit(1);
}

// ====== EXPRESS SETUP ======
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
    console.error('Spotify token refresh failed:', err.message);
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

async function getChatters(login) {
  const r = await fetch(`http://tmi.twitch.tv/group/user/${encodeURIComponent(login)}/chatters`);
  if (!r.ok) return [];
  const j = await r.json();
  const sets = j?.chatters || {};
  return Object.values(sets).flat();
}

// ====== QUEUE STATE ======
let nowPlaying = null;
let approvedQueue = [];
let pending = [];
let nextPendingId = 1;

// ====== TWITCH BOT ======
const client = new tmi.Client({
  identity: { username: TWITCH_BOT_USERNAME, password: TWITCH_OAUTH_TOKEN },
  channels: [TWITCH_CHANNEL]
});

client.connect().catch(console.error);

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
  if (self) return;
  const text = message.trim();
  const uname = tags['display-name'] || tags.username || '';

  if (text.toLowerCase().startsWith('!sr ')) {
    const q = text.slice(4).trim();
    if (!q) return;
    const item = { id: nextPendingId++, query: q, requester: uname };
    pending.push(item);
    say(`Queued #${item.id}: "${q}" — requested by ${uname}`);
    return;
  }

  if (text.toLowerCase().startsWith('!approve ')) {
    if (!isPrivileged(tags)) return;
    const n = parseInt(text.split(' ')[1], 10);
    const idx = pending.findIndex(p => p.id === n);
    if (idx === -1) return say(`No pending item #${n}.`);

    const item = pending.splice(idx, 1)[0];
    try {
      await ensureSpotifyToken();
      const s = await spotify.searchTracks(item.query, { limit: 1 });
      const track = s.body.tracks.items[0];
      if (!track) return say(`No Spotify match for "${item.query}".`);

      await spotify.addToQueue(track.uri);

      const approved = {
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        spotifyId: track.id,
        requester: item.requester
      };

      if (!nowPlaying) nowPlaying = approved;
      else approvedQueue.push(approved);

      say(`Approved #${n}: ${approved.title} — ${approved.artist} (${approved.requester}) added to queue.`);
    } catch (e) {
      say(`Failed to approve #${n}: ${e?.body?.error?.message || e.message}`);
    }
    return;
  }

  if (text.toLowerCase().startsWith('!deny ')) {
    if (!isPrivileged(tags)) return;
    const n = parseInt(text.split(' ')[1], 10);
    const idx = pending.findIndex(p => p.id === n);
    if (idx === -1) return say(`No pending item #${n}.`);
    pending.splice(idx, 1);
    say(`Denied #${n}.`);
    return;
  }

  if (text.toLowerCase() === '!queue') {
    const next = approvedQueue.slice(0, 5).map((t, i) => `${i + 1}. ${t.title} — ${t.artist}`).join(' | ');
    say(`Now: ${nowPlaying ? `${nowPlaying.title} — ${nowPlaying.artist}` : '—'} | Next: ${next || '—'}`);
    return;
  }

  if (text.toLowerCase() === '!skip') {
    if (!isPrivileged(tags)) return;
    if (!nowPlaying) return say('Nothing playing.');
    const skipped = nowPlaying;
    nowPlaying = approvedQueue.shift() || null;
    say(`Skipped ${skipped.title}. Now playing ${nowPlaying ? nowPlaying.title : '—'}.`);
  }
});

// ====== PROMO / LURKERS ======
async function announceLurkersAndPromo() {
  try {
    const total = await getViewerCount(TWITCH_CHANNEL);
    const chatters = await getChatters(TWITCH_CHANNEL);
    if (total != null) {
      const lurkers = Math.max(0, total - (chatters?.length || 0));
      say(`Heads up: ~${lurkers} folks watching quietly 🤘`);
    }
  } catch (_) {}
  say(`LowLife App + socials: lowlifesofgranboard.com • twitch.tv/${TWITCH_CHANNEL}`);
}

setInterval(announceLurkersAndPromo, Math.max(1, parseInt(PROMO_MINUTES, 10)) * 60 * 1000);

// ====== ENDPOINT ======
app.get('/queue', (_req, res) => {
  res.json({ now: nowPlaying, queue: approvedQueue, pending });
});

// ====== START SERVER ======
app.listen(PORT, () => {
  console.log(`✅ Overlay API live on port ${PORT}`);
});
