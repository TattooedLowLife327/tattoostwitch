import 'dotenv/config';
import tmi from 'tmi.js';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import SpotifyWebApi from 'spotify-web-api-node';

const {
  TWITCH_BOT_USERNAME,
  TWITCH_CHANNEL,
  TWITCH_OAUTH_TOKEN,
  TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
  PORT = 8787,
  PROMO_MINUTES = 15
} = process.env;

if (!TWITCH_CHANNEL || !TWITCH_BOT_USERNAME || !TWITCH_OAUTH_TOKEN) {
  console.error('Missing Twitch IRC env vars. Fill TWITCH_CHANNEL, TWITCH_BOT_USERNAME, TWITCH_OAUTH_TOKEN.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// ====== Spotify client ======
const spotify = new SpotifyWebApi({
  clientId: SPOTIFY_CLIENT_ID,
  clientSecret: SPOTIFY_CLIENT_SECRET
});
if (SPOTIFY_REFRESH_TOKEN) spotify.setRefreshToken(SPOTIFY_REFRESH_TOKEN);

async function ensureSpotifyToken() {
  const data = await spotify.refreshAccessToken();
  spotify.setAccessToken(data.body['access_token']);
}

// ====== Twitch Helix app access token (for viewer_count) ======
let helixAppToken = null;
let helixTokenExp = 0;
async function getAppAccessToken() {
  const now = Math.floor(Date.now()/1000);
  if (helixAppToken && now < helixTokenExp - 60) return helixAppToken;

  const res = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${TWITCH_CLIENT_ID}&client_secret=${TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, { method:'POST' });
  const data = await res.json();
  helixAppToken = data.access_token;
  helixTokenExp = now + (data.expires_in || 3600);
  return helixAppToken;
}

async function getViewerCount(login) {
  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return null;
  const token = await getAppAccessToken();
  const r = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${token}` }
  });
  const j = await r.json();
  return (j.data && j.data[0] && j.data[0].viewer_count) ? j.data[0].viewer_count : null;
}

async function getChatters(login) {
  const r = await fetch(`http://tmi.twitch.tv/group/user/${encodeURIComponent(login)}/chatters`);
  if (!r.ok) return [];
  const j = await r.json();
  const sets = j?.chatters || {};
  return Object.values(sets).flat();
}

// ====== Song queue state ======
let nowPlaying = null; // { title, artist, requester }
let approvedQueue = []; // [{ title, artist, spotifyId, requester }]
let pending = []; // [{ id, query, requester }], id is incremental index for approve/deny

let nextPendingId = 1;

// ====== Twitch IRC (bot) ======
const client = new tmi.Client({
  identity: { username: TWITCH_BOT_USERNAME, password: TWITCH_OAUTH_TOKEN },
  channels: [ TWITCH_CHANNEL ]
});

client.connect().catch(console.error);

function say(msg) {
  client.say(`#${TWITCH_CHANNEL}`, msg).catch(()=>{});
}

// helpers
function isPrivileged(tags){
  const badges = tags.badges || {};
  return !!(badges.broadcaster || badges.moderator);
}

client.on('message', async (channel, tags, message, self) => {
  if (self) return;
  const text = message.trim();
  const uname = (tags['display-name'] || tags.username || '').toString();

  // !sr query
  if (text.toLowerCase().startsWith('!sr ')) {
    const q = text.slice(4).trim();
    if (!q) return;
    const item = { id: nextPendingId++, query: q, requester: uname };
    pending.push(item);
    say(`Request queued for review (#${item.id}): "${q}" — requested by ${uname}`);
    return;
  }

  // approvals (broadcaster/mods only)
  if (text.toLowerCase().startsWith('!approve ')) {
    if (!isPrivileged(tags)) return;
    const n = parseInt(text.split(' ')[1], 10);
    const idx = pending.findIndex(p => p.id === n);
    if (idx === -1) { say(`No pending item #${n}.`); return; }
    const item = pending.splice(idx, 1)[0];
    try {
      await ensureSpotifyToken();
      const s = await spotify.searchTracks(item.query, { limit: 1 });
      const track = s.body.tracks.items[0];
      if (!track) { say(`No Spotify match for "${item.query}".`); return; }

      // Queue on Spotify (Note: requires Premium + active device)
      await spotify.addToQueue(track.uri);

      const approved = {
        title: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        spotifyId: track.id,
        requester: item.requester
      };

      // rotate now/queue
      if (!nowPlaying) nowPlaying = approved;
      else approvedQueue.push(approved);

      say(`Approved #${n}: ${approved.title} — ${approved.artist} (requested by ${approved.requester}). Queued on Spotify.`);
    } catch (e) {
      say(`Failed to approve #${n}: ${e?.body?.error?.message || e.message}`);
    }
    return;
  }

  if (text.toLowerCase().startsWith('!deny ')) {
    if (!isPrivileged(tags)) return;
    const n = parseInt(text.split(' ')[1], 10);
    const idx = pending.findIndex(p => p.id === n);
    if (idx === -1) { say(`No pending item #${n}.`); return; }
    const item = pending.splice(idx, 1)[0];
    say(`Denied #${n}: "${item.query}".`);
    return;
  }

  if (text.toLowerCase() === '!queue') {
    const next = approvedQueue.slice(0, 5).map((t, i)=>`${i+1}. ${t.title} — ${t.artist} (${t.requester||'?'})`).join(' | ');
    say(`Now: ${nowPlaying ? `${nowPlaying.title} — ${nowPlaying.artist}` : '—'} | Up Next: ${next || '—'}`);
    return;
  }

  if (text.toLowerCase() === '!pending') {
    const list = pending.slice(0,5).map(p=>`#${p.id} "${p.query}" (${p.requester})`).join(' | ');
    say(`Pending: ${list || '—'}`);
    return;
  }

  if (text.toLowerCase() === '!skip') {
    if (!isPrivileged(tags)) return;
    if (!nowPlaying) { say('Nothing is playing.'); return; }
    const skipped = nowPlaying;
    nowPlaying = approvedQueue.shift() || null;
    say(`Skipped: ${skipped.title} — ${skipped.artist}. Now: ${nowPlaying ? `${nowPlaying.title} — ${nowPlaying.artist}` : '—'}`);
    return;
  }
});

// ====== Periodic promo + lurker announce ======
async function announceLurkersAndPromo(){
  try {
    const total = await getViewerCount(TWITCH_CHANNEL);
    const chatters = await getChatters(TWITCH_CHANNEL);
    if (total != null) {
      const lurkers = Math.max(0, total - (chatters?.length || 0));
      say(`Heads up: ~${lurkers} folks watching not logged in. Say hi, you gremlins 🤘`);
    }
  } catch (_) {}

  // promo
  say(`LowLife App + socials: lowlifesofgranboard.com • FB: LLoGB • Twitch: twitch.tv/${TWITCH_CHANNEL}`);
}
setInterval(announceLurkersAndPromo, Math.max(1, parseInt(PROMO_MINUTES, 10)) * 60 * 1000);

// ====== REST for overlays ======
app.get('/queue', (_req, res) => {
  res.json({
    now: nowPlaying,
    queue: approvedQueue,
    pending: pending.map(p => ({ id:p.id, query:p.query, requester:p.requester }))
  });
});

// starter
app.listen(PORT, () => {
  console.log(`Overlay API on http://localhost:${PORT}`);
  console.log(`Channel: #${TWITCH_CHANNEL}`);
});
