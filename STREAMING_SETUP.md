# Running the Bot Only When Streaming (100% Free)

Since you only need the bot running during streams, here's how to set it up to run on your computer only when you're live.

---

## 🎮 Quick Start: Manual Start/Stop

### When You Start Streaming:
```bash
npm start
```

### When You End Stream:
Just close the terminal window, or press `Ctrl+C`

---

## 🚀 Option 1: Quick Start Scripts (Windows)

### Use the Batch Files:

**To Start Bot:**
- Double-click `start-bot.bat` before you go live
- Bot runs in background

**To Stop Bot:**
- Double-click `stop-bot.bat` when stream ends
- Or just restart your computer

---

## 🤖 Option 2: Auto-Start with OBS (Advanced)

You can make OBS automatically start the bot when you open it:

### Windows:
1. Press `Win+R`, type `shell:startup`, press Enter
2. Right-click in the folder → New → Shortcut
3. Browse to your `start-bot.bat` file
4. Name it "Twitch Bot"
5. Now the bot starts automatically when Windows starts

**Better approach:** Create a script that only starts when OBS starts:
1. In OBS: Tools → Scripts
2. Add a Python/Lua script that runs `start-bot.bat`

---

## 📊 Option 3: PM2 (Recommended for Ease)

PM2 makes it super easy to start/stop the bot:

### Setup (one time):
```bash
npm install -g pm2
```

### Start Bot (when streaming):
```bash
pm2 start bot.js --name twitch-bot
```

### View Logs:
```bash
pm2 logs twitch-bot
```

### Stop Bot (after streaming):
```bash
pm2 stop twitch-bot
```

### Restart Bot:
```bash
pm2 restart twitch-bot
```

### Delete Bot:
```bash
pm2 delete twitch-bot
```

---

## 💡 Pro Tips

### Keep It Simple:
- Just run `npm start` in a terminal when you start streaming
- Press `Ctrl+C` or close terminal when done
- 100% free, no setup needed

### Monitor It:
When the bot is running, you'll see in the console:
```
[TWITCH] Connected to #thetattooedlowlife
[SPOTIFY] Monitoring playback...
[BOT] Ready for song requests!
```

### Troubleshooting:
- **Bot won't start?** Run `npm install` first
- **Twitch not connecting?** Check your OAuth token at https://twitchapps.com/tmi/
- **Spotify issues?** Refresh token might be expired

---

## ⚙️ Environment Setup

Make sure you have a `.env` file with your credentials:

```env
TWITCH_BOT_USERNAME=LowLifesofGB
TWITCH_CHANNEL=thetattooedlowlife
TWITCH_OAUTH_TOKEN=oauth:your_token_here
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REFRESH_TOKEN=your_refresh_token
DATABASE_URL=your_database_url
PORT=8787
```

**Don't commit `.env` to GitHub!** It's already in `.gitignore`.

---

## 🎯 Recommended Workflow

**Before Stream:**
1. Open terminal in project folder
2. Run: `npm start`
3. Wait for "Connected to Twitch" message
4. Start OBS and go live

**During Stream:**
- Bot responds to !sr commands
- Bot monitors Spotify playback
- Check terminal for any errors

**After Stream:**
1. End stream in OBS
2. Press `Ctrl+C` in terminal to stop bot
3. Close terminal

**Cost:** $0.00 💰

---

## 🌐 Still Want 24/7 Hosting?

If you change your mind and want the bot running even when you're offline:
- See `DEPLOYMENT.md` for cloud hosting options
- Railway.app has $5 free credit (covers ~2 months)
- Render.com has a free tier (sleeps after 15 min)

But for most streamers, running it only during streams is perfectly fine!
