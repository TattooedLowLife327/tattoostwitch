# 🎮 Streamer Setup Guide

This guide walks you through setting up the complete streaming control system for a new streamer.

**Time Required:** 30-60 minutes
**Cost:** $0 (all free tiers)

---

## 📋 What You're Building

A complete streaming control system with:
- ✅ Spotify song request queue with Twitch chat integration
- ✅ Progressive Web App (PWA) for phone/tablet control
- ✅ OBS overlays (queue, scoreboard, chat, viewer count, etc.)
- ✅ Multi-platform viewer tracking (Twitch, Facebook, TikTok)
- ✅ Game scoreboard and mode display

---

## 🛠️ Prerequisites

Before starting, have the streamer create these accounts (all free):

1. **GitHub** - https://github.com/signup
2. **Netlify** - https://netlify.com/signup
3. **Render** - https://render.com/signup
4. **Neon** - https://neon.tech/signup
5. **Twitch Developer** - https://dev.twitch.tv/console
6. **Spotify Developer** - https://developer.spotify.com/dashboard

---

## 📝 Step 1: Configure for New Streamer

### 1.1 Edit `config.js`

Open `config.js` and update these values:

```javascript
const STREAMER_CONFIG = {
  streamer: {
    name: "StreamerName",              // Their display name
    channel: "twitch_channel_name",    // Twitch channel (lowercase)
    brandName: "SHORT",                // Short brand name (3-5 chars)
    pin: "12345"                       // NEW UNIQUE PIN (change this!)
  },

  scoreboard: {
    player1Name: "PLAYER1",            // Default player 1 name
    player2Name: "PLAYER2"             // Default player 2 name
  },

  specialUsers: {
    "username1": "Custom entrance message!",
    "username2": "Another custom message!"
  },

  api: {
    netlifyUrl: "https://streamer-name.netlify.app",     // Update after deploy
    renderUrl: "https://streamer-bot.onrender.com"       // Update after deploy
  }
};
```

### 1.2 Run Setup Script

```bash
node setup-streamer.js
```

This automatically updates all HTML files, database schema, and creates env templates.

---

## 🗄️ Step 2: Database Setup (Neon)

### 2.1 Create Database

1. Go to https://console.neon.tech
2. Click **"New Project"**
3. Name it: `streamer-control` (or streamer's name)
4. Select region closest to streamer
5. Click **"Create Project"**

### 2.2 Get Connection String

1. In project dashboard, click **"Connection String"**
2. Copy the connection string (starts with `postgresql://`)
3. Save this for later (you'll use it in both Netlify and Render)

### 2.3 Run Database Schema

1. Click **"SQL Editor"** in Neon dashboard
2. Open `database-schema.sql` from this repo
3. Copy entire contents
4. Paste into SQL Editor
5. Click **"Run"**
6. Verify 8 tables were created

---

## 🎨 Step 3: Frontend Deployment (Netlify)

### 3.1 Deploy to Netlify

1. Go to https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect your GitHub account
4. Select this repository
5. Build settings (should auto-detect):
   - **Build command:** (leave empty)
   - **Publish directory:** `/`
6. Click **"Deploy site"**

### 3.2 Configure Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Click **"Add a variable"** for each of these:

Open `.env.netlify.template` and add these values to Netlify:

```
DATABASE_URL              → Your Neon connection string
TWITCH_CLIENT_ID          → (get in Step 4)
TWITCH_CLIENT_SECRET      → (get in Step 4)
SPOTIFY_CLIENT_ID         → (get in Step 5)
SPOTIFY_CLIENT_SECRET     → (get in Step 5)
SPOTIFY_REFRESH_TOKEN     → (get in Step 5)
```

### 3.3 Get Your Netlify URL

1. Copy your site URL (e.g., `https://streamer-name.netlify.app`)
2. Update `config.js` → `api.netlifyUrl` with this URL
3. **Important:** Redeploy after this change

---

## 🤖 Step 4: Twitch API Setup

### 4.1 Create Twitch Application

1. Go to https://dev.twitch.tv/console/apps
2. Click **"Register Your Application"**
3. Fill in:
   - **Name:** `StreamerName Bot`
   - **OAuth Redirect URL:** `http://localhost`
   - **Category:** `Chat Bot`
4. Click **"Create"**
5. Click **"Manage"** → Copy **Client ID** and **Client Secret**

### 4.2 Get Bot OAuth Token

1. Go to https://twitchapps.com/tmi/
2. Login with the **bot account** (or streamer account if using same)
3. Authorize
4. Copy the oauth token (starts with `oauth:`)

---

## 🎵 Step 5: Spotify API Setup

### 5.1 Create Spotify Application

1. Go to https://developer.spotify.com/dashboard
2. Click **"Create app"**
3. Fill in:
   - **App name:** `StreamerName Song Requests`
   - **App description:** `Twitch song request bot`
   - **Redirect URI:** `http://localhost:8888/callback`
4. Click **"Save"**
5. Copy **Client ID** and **Client Secret**

### 5.2 Get Refresh Token

Run this authorization script (requires Node.js):

```bash
# Install spotify-web-api-node
npm install spotify-web-api-node

# Create auth script
node get-spotify-token.js
```

**get-spotify-token.js:**
```javascript
const SpotifyWebApi = require('spotify-web-api-node');

const spotifyApi = new SpotifyWebApi({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  redirectUri: 'http://localhost:8888/callback'
});

const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
];

console.log('Visit this URL and authorize:');
console.log(spotifyApi.createAuthorizeURL(scopes));
console.log('\nAfter authorizing, paste the "code" from the redirect URL:');

// After getting code from URL, run:
// spotifyApi.authorizationCodeGrant('CODE_HERE').then(data => {
//   console.log('Refresh Token:', data.body.refresh_token);
// });
```

Alternatively, use this tool: https://github.com/bih/spotify-token-swap

---

## 🚀 Step 6: Bot Deployment (Render)

### 6.1 Deploy to Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository
4. Fill in:
   - **Name:** `streamer-bot` (or streamer's name)
   - **Region:** Same as database
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
   - **Instance Type:** `Free`
5. Click **"Create Web Service"**

### 6.2 Configure Environment Variables

Go to **Environment** tab and add these (use `.env.render.template`):

```
DATABASE_URL                    → Your Neon connection string
TWITCH_BOT_USERNAME            → Bot's Twitch username (lowercase)
TWITCH_CHANNEL                 → Streamer's channel name (lowercase)
TWITCH_OAUTH_TOKEN             → oauth:xxx from Step 4.2
TWITCH_CLIENT_ID               → From Step 4.1
TWITCH_CLIENT_SECRET           → From Step 4.1
SPOTIFY_CLIENT_ID              → From Step 5.1
SPOTIFY_CLIENT_SECRET          → From Step 5.1
SPOTIFY_REFRESH_TOKEN          → From Step 5.2
NETLIFY_URL                    → Your Netlify URL from Step 3.3
SPECIAL_USERS                  → Comma-separated usernames (optional)
```

### 6.3 Get Your Render URL

1. Copy your service URL (e.g., `https://streamer-bot.onrender.com`)
2. Update `config.js` → `api.renderUrl` with this URL

---

## 🎬 Step 7: OBS Setup

### 7.1 Add Browser Sources

For each overlay, add a **Browser Source** in OBS:

| Overlay | URL | Width | Height | FPS |
|---------|-----|-------|--------|-----|
| **Spotify Queue** | `https://streamer-name.netlify.app/spotify-queue.html` | 400 | 600 | 30 |
| **Scoreboard** | `https://streamer-name.netlify.app/scoreboard.html` | 500 | 200 | 30 |
| **Mode Display** | `https://streamer-name.netlify.app/mode-display.html` | 300 | 100 | 30 |
| **Chat** | `https://streamer-bot.onrender.com/chat-stream` | 400 | 600 | 30 |
| **Viewer Count** | `https://streamer-name.netlify.app/viewer-count.html` | 200 | 100 | 30 |
| **BRB Screen** | `https://streamer-name.netlify.app/transition-brb.html` | 1920 | 1080 | 30 |

**Note:** Chat overlay uses Render URL (SSE stream), all others use Netlify URL.

### 7.2 Browser Source Settings

For each source:
- ✅ Check "Shutdown source when not visible" (saves resources)
- ✅ Check "Refresh browser when scene becomes active"
- ⬜ Uncheck "Control audio via OBS" (unless needed)

---

## 📱 Step 8: PWA Setup

### 8.1 Install on Phone/Tablet

**iPhone/iPad:**
1. Open Safari
2. Go to `https://streamer-name.netlify.app`
3. Tap Share button → **"Add to Home Screen"**
4. Name it (e.g., "Stream Control")
5. Tap **"Add"**

**Android:**
1. Open Chrome
2. Go to `https://streamer-name.netlify.app`
3. Tap menu (⋮) → **"Install app"** or **"Add to Home Screen"**
4. Tap **"Install"**

### 8.2 Login

1. Open the installed app
2. Enter PIN from `config.js`
3. You're in!

---

## ✅ Step 9: Testing

### 9.1 Test Checklist

- [ ] Bot is running (check Render logs)
- [ ] PWA loads and accepts PIN
- [ ] Spotify queue overlay shows in OBS
- [ ] Send test song request in chat: `!sr Never Gonna Give You Up`
- [ ] Song appears in PWA as "Pending"
- [ ] Approve song in PWA
- [ ] Song adds to Spotify queue
- [ ] Current song shows in OBS overlay
- [ ] Test scoreboard controls
- [ ] Test mode switching (Tourney/Lobby/Cash)
- [ ] Test BRB screen
- [ ] Chat overlay shows messages

### 9.2 Common Issues

**Bot not connecting:**
- Check Render logs for errors
- Verify TWITCH_OAUTH_TOKEN starts with `oauth:`
- Verify TWITCH_CHANNEL is lowercase

**Spotify not working:**
- Make sure Spotify is **actively playing** (not paused)
- Verify refresh token is valid
- Check bot logs for Spotify API errors

**Overlays not loading:**
- Check browser source URLs are correct
- Right-click source → **"Interact"** to see errors in console
- Verify Netlify deployment succeeded

**Database errors:**
- Verify DATABASE_URL is set in both Netlify and Render
- Make sure database schema was run successfully

---

## 🎉 Step 10: Handoff

### 10.1 Give Streamer

**URLs:**
- PWA Control: `https://streamer-name.netlify.app`
- Admin Portal: `https://streamer-name.netlify.app/admin/`
- Bot Dashboard: `https://dashboard.render.com`

**Credentials:**
- PWA PIN: `(from config.js)`
- Render Login: (their account)
- Netlify Login: (their account)

**Chat Commands:**
- `!sr Song Name` - Request a song
- `!queue` - See current queue
- `!currentsong` - What's playing now
- `!lastseen @username` - When user was last seen

### 10.2 Quick Reference

**To approve songs:** Open PWA → Pending Songs → Tap ✅
**To update score:** PWA → Scoreboard section
**To change mode:** PWA → Stream Mode section
**To trigger BRB:** PWA → Screen Overlay → Select "Be Right Back"
**To restart bot:** Render dashboard → Manual Deploy → "Deploy latest commit"

---

## 💰 Pricing Reference

All services have generous free tiers:

| Service | Free Tier | Limits |
|---------|-----------|--------|
| Netlify | Free | 100GB bandwidth/month, 300 build minutes |
| Render | Free | 750 hours/month (1 service 24/7), sleeps after 15min inactive |
| Neon | Free | 10GB storage, 100 compute hours/month |
| GitHub | Free | Unlimited public repos |

**Note:** Render free tier sleeps after 15min of inactivity. First request after sleep takes ~30-60 seconds to wake up.

---

## 🆘 Support

**Issues?** Check these first:
1. Render logs (most errors show here)
2. Browser console in OBS (right-click source → Interact → F12)
3. Netlify function logs
4. Neon database connection

**Still stuck?** Open an issue on GitHub with:
- What you're trying to do
- What's happening instead
- Relevant error messages
- Screenshots if applicable

---

## 🎯 Quick Setup Checklist

Use this for rapid deployment:

- [ ] Edit `config.js` with streamer info
- [ ] Run `node setup-streamer.js`
- [ ] Create Neon database
- [ ] Run `database-schema.sql` in Neon
- [ ] Get Twitch Client ID/Secret
- [ ] Get Twitch OAuth token
- [ ] Get Spotify Client ID/Secret
- [ ] Get Spotify Refresh Token
- [ ] Deploy to Netlify
- [ ] Set Netlify environment variables
- [ ] Deploy to Render
- [ ] Set Render environment variables
- [ ] Update config.js with deployed URLs
- [ ] Test in OBS
- [ ] Install PWA on phone
- [ ] Test song requests
- [ ] Done! 🎉

---

**Estimated Setup Time by Experience:**
- First time: 60-90 minutes
- With practice: 20-30 minutes
- Automated: Could get down to 10-15 minutes

Good luck! 🚀
