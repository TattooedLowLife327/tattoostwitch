# 🎮 Streaming Control System - Template

A complete plug-and-play streaming control system for Twitch streamers with Spotify integration, OBS overlays, and mobile PWA control.

## 🚀 Quick Start for New Streamer

### 1. Edit Configuration (2 minutes)
```bash
# Edit config.js with streamer's info
nano config.js
```

### 2. Run Setup Script (30 seconds)
```bash
node setup-streamer.js
```

### 3. Deploy (20 minutes)
- Create Neon database
- Deploy to Netlify
- Deploy to Render
- Set environment variables

**Full guide:** See `STREAMER-SETUP-GUIDE.md`

---

## 📦 What's Included

### Frontend (Netlify)
- Progressive Web App for mobile control
- OBS overlays (queue, scoreboard, chat, viewer count)
- Admin portal
- Serverless API endpoints

### Backend (Render)
- Twitch chat bot
- Spotify integration
- SSE chat relay
- Multi-platform viewer tracking

### Database (Neon)
- PostgreSQL with 8 tables
- Song requests, scoreboard, settings, activity log

---

## 🛠️ Configuration System

All customization happens in **one file**: `config.js`

```javascript
const STREAMER_CONFIG = {
  streamer: {
    name: "StreamerName",        // Display name
    channel: "twitch_username",  // Twitch channel
    brandName: "BRAND",          // Short name for overlays
    pin: "12345"                 // PWA access PIN
  },
  scoreboard: {
    player1Name: "PLAYER1",
    player2Name: "PLAYER2"
  },
  specialUsers: {
    "username": "Custom message"
  }
};
```

Run `node setup-streamer.js` to apply changes to all files.

---

## 📁 File Structure

```
├── config.js                    # ⭐ Edit this for each streamer
├── setup-streamer.js            # ⭐ Run this to apply config
│
├── index.html                   # Main PWA control panel
├── admin/index.html             # Alternative admin portal
│
├── spotify-queue.html           # OBS: Now playing + queue
├── scoreboard.html              # OBS: Game scoreboard
├── mode-display.html            # OBS: Game mode
├── chat-overlay.html            # OBS: Chat messages
├── viewer-count.html            # OBS: Multi-platform viewers
├── transition-brb.html          # OBS: BRB screen
│
├── bot.js                       # Twitch bot + Spotify polling
├── netlify/functions/           # API endpoints
├── database-schema.sql          # Database setup
│
└── STREAMER-SETUP-GUIDE.md      # Full deployment guide
```

---

## ⚡ Automated Setup Script

The `setup-streamer.js` script automatically updates:

✅ All HTML page titles
✅ PWA and admin PINs
✅ Default player names
✅ Special user messages
✅ Database defaults
✅ Environment variable templates

**What you still need to do manually:**
- Get API credentials (Twitch, Spotify)
- Deploy to Netlify and Render
- Set environment variables
- Run database schema

---

## 💰 Cost

**$0/month** using free tiers:
- Netlify (hosting + API)
- Render (bot hosting)
- Neon (PostgreSQL database)
- GitHub (code hosting)

---

## 🎯 Features

### Song Requests
- Twitch chat: `!sr Song Name`
- Auto-search Spotify
- Approve/deny from PWA
- Auto-add to queue
- OBS overlay shows queue

### Game Scoreboard
- Control from PWA
- Live OBS overlay
- Custom player names
- Reset functionality

### Stream Modes
- Tournament mode
- Lobby mode
- Cash game mode
- Live OBS display

### Chat Overlay
- Real-time chat messages
- SSE streaming
- Configurable display

### Viewer Tracking
- Twitch viewers
- Facebook live viewers
- TikTok live viewers
- Combined count overlay

### Mobile Control
- Install as PWA
- Works offline
- PIN protected
- Touch-optimized UI

---

## 🔧 Environment Variables

### Netlify
```
DATABASE_URL
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
SPOTIFY_REFRESH_TOKEN
```

### Render (all of above plus:)
```
TWITCH_BOT_USERNAME
TWITCH_CHANNEL
TWITCH_OAUTH_TOKEN
NETLIFY_URL
SPECIAL_USERS
```

Templates created automatically by setup script:
- `.env.netlify.template`
- `.env.render.template`

---

## 📱 OBS Browser Sources

After deploying to Netlify, add these browser sources:

| Overlay | URL Pattern | Size |
|---------|-------------|------|
| Queue | `https://[netlify-url]/spotify-queue.html` | 400x600 |
| Scoreboard | `https://[netlify-url]/scoreboard.html` | 500x200 |
| Mode | `https://[netlify-url]/mode-display.html` | 300x100 |
| Chat | `https://[render-url]/chat-stream` | 400x600 |
| Viewers | `https://[netlify-url]/viewer-count.html` | 200x100 |
| BRB | `https://[netlify-url]/transition-brb.html` | 1920x1080 |

---

## 🎓 Setup Time

| Experience Level | Time Required |
|-----------------|---------------|
| First time | 60-90 minutes |
| With practice | 20-30 minutes |
| Experienced | 10-15 minutes |

---

## 📞 Support

**For setup help:**
1. Read `STREAMER-SETUP-GUIDE.md`
2. Check service logs (Render, Netlify, Neon)
3. Verify environment variables
4. Test database connection

**Common issues:**
- Bot not connecting → Check Twitch OAuth token
- Spotify not working → Verify refresh token + active playback
- Overlays blank → Check browser source URLs
- Database errors → Verify schema was run

---

## 🔄 Update Process

To update an existing streamer's config:

1. Edit `config.js`
2. Run `node setup-streamer.js`
3. Commit and push changes
4. Netlify/Render auto-deploy

---

## 🎨 Customization

Beyond basic config, you can customize:
- CSS colors/styling
- Background images
- Overlay layouts
- Chat commands
- API endpoints

See individual files for inline comments.

---

## 📊 Multi-Streamer Usage

### Option A: Separate Deployments (Recommended)
- Each streamer gets their own repo fork
- Independent deployments
- Isolated databases
- Easy to customize per streamer

### Option B: Multi-Tenant (Advanced)
- One deployment serves multiple streamers
- Requires code modifications
- Add user accounts and authentication
- Database tenant separation

---

## 🤝 Contributing

Improvements welcome! Common enhancements:
- Additional overlay layouts
- More chat commands
- Enhanced PWA features
- Better error handling
- UI/UX improvements

---

## 📄 License

MIT - Use freely for commercial or personal projects

---

## 🙏 Credits

Built for streamers who want professional-grade controls without the cost.

**Tech Stack:**
- Node.js + Express
- Vanilla JavaScript (no frameworks!)
- PostgreSQL (Neon)
- Twitch API
- Spotify Web API
- Server-Sent Events (SSE)

---

**Questions?** Open an issue or check the full setup guide.

**Ready to deploy?** Start with `config.js` → `setup-streamer.js` → `STREAMER-SETUP-GUIDE.md`

🚀 Happy streaming!
