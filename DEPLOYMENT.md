# Deploy Twitch Bot to the Cloud (Run 24/7 Without Your Computer)

This bot needs to run 24/7 to monitor Twitch chat and Spotify. Here are the best free options to deploy it.

---

## 🚀 Option 1: Railway.app (RECOMMENDED - Easiest)

### Why Railway?
- ✅ Free $5/month credit (enough for this bot)
- ✅ No credit card needed for trial
- ✅ One-click GitHub deployment
- ✅ Automatic HTTPS and domain
- ✅ Built-in logging

### Steps to Deploy:

1. **Push your code to GitHub** (if not already done)
   ```bash
   git push origin main
   ```

2. **Sign up for Railway**
   - Go to https://railway.app
   - Click "Login with GitHub"
   - Authorize Railway

3. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `tattoostwitch` repository

4. **Add Environment Variables**
   - Click on your service
   - Go to "Variables" tab
   - Add all these variables (from your `.env` file):

   ```
   TWITCH_BOT_USERNAME=LowLifesofGB
   TWITCH_CHANNEL=thetattooedlowlife
   TWITCH_OAUTH_TOKEN=oauth:c9kou7msk6shev38vka531jo31pnwy
   TWITCH_CLIENT_ID=a72ut58m36q5r4tq8iyhizzkoq8dfo
   TWITCH_CLIENT_SECRET=xlid9b61nwhvreo4wz2zp6lnfyef33
   SPOTIFY_CLIENT_ID=c3ea29bafb8a41adabfb51053cb56438
   SPOTIFY_CLIENT_SECRET=f855d5da449543cba4baaef06270a19a
   SPOTIFY_REFRESH_TOKEN=AQAPmu6nMrydsvWbC7BUz7DMhb06ieDSgsiM40cNTSGxGUIb2ZdQDEVBER_KXNnhzZcCDCkdqMfnKJ4DtgMUU3NwORW8s_Y5FZ8BeA9XFm6U1uzb1NaL57ot0DOpEnvV5Jg
   PORT=8787
   PROMO_MINUTES=15
   SPECIAL_USERS=ChanTheMan814,Coil666
   DECAPI_TOKEN=YAML3wvJgORxy2rMavoNzeIB5bBYVRQv6Es96lyA
   DATABASE_URL=postgresql://neondb_owner:npg_kj1Mt8sgBQoF@ep-hidden-truth-ae0refrh-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

5. **Deploy!**
   - Railway will automatically detect it's a Node.js app
   - It will run `npm install` and then `node bot.js`
   - Check the "Logs" tab to see if it connected successfully

6. **✅ Done!** Your bot is now running 24/7 in the cloud

### Getting the Public URL:
- In Railway, click "Settings" > "Generate Domain"
- This gives you a public URL for the bot's Express server (port 8787)
- You can use this URL for ngrok replacement if needed

### Viewing Logs:
- Click on your service in Railway
- Click "Logs" tab
- You'll see real-time output from your bot

---

## 🎨 Option 2: Render.com (Good Alternative)

### Why Render?
- ✅ True free tier (no credit card)
- ⚠️ Free tier sleeps after 15 min inactivity
- ✅ Easy GitHub deployment

### Steps to Deploy:

1. **Sign up for Render**
   - Go to https://render.com
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub repo

3. **Configure Service**
   - **Name:** `twitch-bot`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
   - **Plan:** Free

4. **Add Environment Variables**
   - Go to "Environment" tab
   - Add all variables from your `.env` file (same as Railway above)

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment
   - Check logs for connection success

### Keep It Awake (Optional):
Free tier sleeps after 15 min. To keep it awake:
- Use a service like UptimeRobot to ping your bot URL every 14 minutes
- Or upgrade to paid plan ($7/month) for always-on

---

## 🐳 Option 3: Fly.io (Advanced)

### Why Fly.io?
- ✅ Free tier doesn't sleep
- ✅ Always-on
- ⚠️ Requires Docker/CLI setup

### Quick Deploy:
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
flyctl launch

# Set secrets
flyctl secrets set TWITCH_BOT_USERNAME=LowLifesofGB
flyctl secrets set TWITCH_OAUTH_TOKEN=oauth:c9kou7msk6shev38vka531jo31pnwy
# ... (add all other env vars)

# Deploy
flyctl deploy
```

---

## 🔧 Troubleshooting

### Bot not connecting to Twitch?
- Check your OAuth token is still valid
- Regenerate at https://twitchapps.com/tmi/

### Bot not connecting to Spotify?
- Your refresh token might have expired
- Regenerate Spotify tokens

### Database connection issues?
- Verify DATABASE_URL is correct
- Check if Neon database is active

### Check Logs:
- **Railway:** Dashboard > Logs tab
- **Render:** Dashboard > Logs
- **Fly.io:** `flyctl logs`

---

## 💰 Cost Comparison

| Service | Free Tier | Always On? | Easy Deploy? |
|---------|-----------|------------|--------------|
| **Railway** | $5 credit/mo | ✅ Yes | ⭐⭐⭐⭐⭐ |
| **Render** | Yes (sleeps) | ⚠️ No | ⭐⭐⭐⭐ |
| **Fly.io** | Yes | ✅ Yes | ⭐⭐⭐ |

**Recommendation:** Start with **Railway** - it's the easiest and most reliable for this use case.

---

## 📝 After Deployment

Once deployed, you can:
1. **Turn off your computer** - bot runs in the cloud
2. **View logs** in real-time from the cloud dashboard
3. **Make changes** - push to GitHub and it auto-deploys
4. **Monitor uptime** - check dashboard for any issues

Your Twitch bot will now run 24/7 without your computer! 🎉
