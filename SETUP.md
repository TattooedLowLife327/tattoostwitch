# Stream Overlay System - Setup Guide

## Architecture Overview

This system uses:
- **Neon DB (PostgreSQL)**: Central database for all state
- **Netlify Functions**: Serverless API endpoints
- **Render**: Hosts simplified bot.js (Twitch IRC + Spotify polling only)
- **Netlify Static Hosting**: PWA and overlay HTML files

## Prerequisites

1. Neon Database account (free tier is fine)
2. Netlify account (connected to GitHub repo)
3. Render account (for bot.js)
4. Twitch Developer App
5. Spotify Developer App

## Step 1: Set Up Neon Database

1. Go to https://neon.tech and create a new project
2. Name it something like "stream-overlays"
3. Copy your connection string (looks like: `postgresql://username:password@host/database`)
4. In the Neon SQL Editor, run the entire `database-schema.sql` file
5. Verify tables were created (you should see 8 tables)

## Step 2: Set Up Netlify

### Deploy the Site

1. Push this repo to GitHub
2. In Netlify, click "New site from Git"
3. Connect your GitHub repo
4. Build settings:
   - Build command: (leave empty)
   - Publish directory: `.`
   - Functions directory: `netlify/functions`

### Add Environment Variables

In Netlify Dashboard > Site settings > Environment variables, add:

```
DATABASE_URL=your_neon_connection_string
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
FACEBOOK_ACCESS_TOKEN=your_facebook_token (optional)
FACEBOOK_PAGE_ID=your_facebook_page_id (optional)
TIKTOK_ACCESS_TOKEN=your_tiktok_token (optional)
TIKTOK_USERNAME=your_tiktok_username (optional)
```

### Deploy

Click "Deploy site" - Netlify will build and deploy everything.

## Step 3: Set Up Render (for bot.js)

1. Go to https://render.com
2. Create a new "Web Service"
3. Connect your GitHub repo
4. Settings:
   - Name: `stream-bot`
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `node bot.js`
   - Instance type: Free

### Add Environment Variables in Render

Add the same environment variables as Netlify, PLUS:

```
NETLIFY_URL=https://your-site.netlify.app
TWITCH_BOT_USERNAME=your_bot_username
TWITCH_CHANNEL=your_channel_name
TWITCH_OAUTH_TOKEN=oauth:your_oauth_token
TWITCH_CHANNEL_ID=your_channel_numeric_id
TWITCH_CHANNEL_OAUTH_TOKEN=oauth:main_account_token_with_channel_read_redemptions
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token
DECAPI_TOKEN=your_decapi_token (optional)
PROMO_MINUTES=15
SPECIAL_USERS=user1,user2,user3
```

### Generate the correct Twitch credentials

1. **Bot OAuth (TWITCH_OAUTH_TOKEN)** – Log into Twitch as your bot account (`TWITCH_BOT_USERNAME`) and generate a chat token with the `chat:read chat:edit` scopes. Since twitchapps.com/tmi was retired, either:
   - Use the first-party OAuth authorize URL for your Twitch application (e.g. `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&scope=chat:read+chat:edit`) while logged into the bot account, then copy the `access_token` from the redirect, or
   - Use a trusted replacement such as https://twitchtokengenerator.com/ (swiftspiffy) to mint a token for the bot account.
2. **Channel ID (TWITCH_CHANNEL_ID)** – While logged into your main channel account, grab the numeric ID via https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/ or `helix/users?login=yourchannel`.
3. **Channel OAuth (TWITCH_CHANNEL_OAUTH_TOKEN)** – Generate an OAuth token for your main account (`TWITCH_CHANNEL`) using the same Twitch application that owns `TWITCH_CLIENT_ID`. The authorization URL should request at least the `channel:read:redemptions` scope (e.g. `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost&scope=channel:read:redemptions`). Use the `access_token` returned in the redirect and store it with the `oauth:` prefix.

EventSub will only come online when `TWITCH_CLIENT_ID`, `TWITCH_CHANNEL_ID`, and `TWITCH_CHANNEL_OAUTH_TOKEN` are all set and the token actually belongs to the channel owner. If any of the three are missing or mismatched, channel point alerts will never fire.

## Step 4: Update OBS Browser Sources

Replace all localhost URLs with your Netlify URL:

- Spotify Queue: `https://your-site.netlify.app/spotify-queue.html`
- Chat Overlay: `https://your-bot.onrender.com/chat-stream` (SSE must stay on Render)
- Scoreboard: `https://your-site.netlify.app/scoreboard.html`
- Mode Display: `https://your-site.netlify.app/mode-display.html`
- Viewer Count: `https://your-site.netlify.app/viewer-count.html`
- BRB Screen: `https://your-site.netlify.app/transition-brb.html`

## Step 5: Access Your PWA

1. On your phone, go to: `https://your-site.netlify.app/index.html`
2. Login with PIN: `92522`
3. Add to home screen (iOS Safari: Share > Add to Home Screen)
4. Done! Control your stream from anywhere

## Testing

### Test Netlify Functions

```bash
curl https://your-site.netlify.app/api/mode
curl https://your-site.netlify.app/api/scoreboard
curl https://your-site.netlify.app/api/queue
```

### Test Bot Commands

In Twitch chat, try:
- `!sr Bohemian Rhapsody` - Request a song
- `!queue` - See current queue
- `!approve 1` - Approve pending request (mod only)

### Test PWA

1. Open PWA on phone
2. Change scoreboard scores - verify they show in OBS
3. Switch mode - verify mode-display overlay updates
4. Approve a song - verify it appears in Spotify

## Troubleshooting

### "Connection Failed" in PWA
- Check that Netlify Functions are deployed
- Check Netlify function logs for errors
- Verify DATABASE_URL is set correctly

### Bot not responding to chat
- Check Render logs
- Verify Twitch OAuth token is valid
- Check TWITCH_CHANNEL is set correctly

### Overlays showing old data
- Hard refresh in OBS (right-click browser source > Refresh)
- Check browser cache settings
- Verify polling intervals in HTML files

### Song requests not working
- Check Spotify tokens are valid
- Verify bot.js has SPOTIFY_REFRESH_TOKEN
- Check Render logs for Spotify API errors

## Maintenance

### View Activity Logs
- Open PWA > Activity Log section
- See recent song requests, approvals, score changes

### Update Settings
- Open PWA > Settings section
- Modify promo interval, special users, etc.
- No need to restart bot or redeploy

### Clean Old Data
- Logs auto-delete after 30 days
- Completed song requests can be manually cleaned:
  ```sql
  DELETE FROM song_requests WHERE status = 'completed' AND created_at < NOW() - INTERVAL '7 days';
  ```

## Resource Usage

**Expected usage (Neon free tier):**
- Database size: < 100MB
- Compute hours: ~50/month (well under 100 hour limit)

**Expected usage (Render free tier):**
- RAM: ~100MB (well under 512MB limit)
- CPU: < 10% average

**Expected usage (Netlify free tier):**
- Functions: ~100K invocations/month (well under 125K limit)
- Bandwidth: < 10GB/month (well under 100GB limit)

Everything fits comfortably in free tiers!
