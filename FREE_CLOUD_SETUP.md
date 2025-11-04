# 100% Free Cloud Setup (No CPU Usage on Your PC)

Run your bot in the cloud for **FREE** and only during streams - best of both worlds!

---

## 🎯 The Problem:
- Running bot locally = uses CPU/RAM during streams
- Running 24/7 cloud = costs money when not streaming
- **Solution:** Free cloud hosting + manual start/stop

---

## 🚀 Best Solution: Railway.app (Free Tier + Manual Control)

### Why This Works:
- ✅ **100% Free** ($5 credit/month, bot uses ~$0.10/hour)
- ✅ **No CPU usage** on your computer
- ✅ **Only runs when streaming** (manually start/stop)
- ✅ **Super easy** to start/stop from dashboard

### Math:
- $5 free credit per month
- Bot costs ~$0.10/hour when running
- Stream 4 hours/day, 20 days/month = 80 hours
- Cost: 80 hours × $0.10 = **$8/month**
- **Wait, that's over $5!** 🤔

Actually, you're right - even with manual control, if you stream a lot, you might exceed the free tier.

---

## 💡 ACTUALLY Free Options:

### **Option 1: Render.com Free Tier** (RECOMMENDED)

Render has a **truly free tier** that never charges:

**Pros:**
- ✅ 100% free forever
- ✅ No credit card needed
- ✅ Easy dashboard start/stop

**Cons:**
- ⚠️ Spins down after 15 min of inactivity
- ⚠️ Takes 30-60 seconds to wake up on first request

**How to use:**
1. Deploy to Render (see DEPLOYMENT.md)
2. Bot automatically spins down 15 min after stream ends
3. First !sr command or overlay load wakes it up (takes 30 sec)
4. Completely free, no limits

**This is probably your best bet!**

---

### **Option 2: Fly.io Free Tier**

Fly.io has generous free tier:

**Free includes:**
- Up to 3 shared-cpu-1x VMs
- 3GB persistent storage
- 160GB outbound data transfer

**Your bot will easily fit in this.**

**Setup:**
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Deploy
flyctl launch
flyctl deploy

# STOP when not streaming
flyctl scale count 0

# START when streaming
flyctl scale count 1
```

**To start/stop from Windows:**
Create `fly-start.bat`:
```batch
@echo off
cd /d "%~dp0"
flyctl scale count 1
echo Bot started!
timeout /t 3
```

Create `fly-stop.bat`:
```batch
@echo off
cd /d "%~dp0"
flyctl scale count 0
echo Bot stopped!
timeout /t 3
```

---

### **Option 3: Oracle Cloud (Always Free Tier)**

Oracle has a **forever free** tier with actual VMs:

**Free includes:**
- 2 AMD VMs (1/8 OCPU, 1 GB RAM each)
- Or 4 Arm VMs (Ampere A1, 3,000 OCPU hours, 18,000 GB hours per month)
- 10 GB block storage

**This is enough to run your bot 24/7 forever, completely free.**

**Pros:**
- ✅ Actually free forever (not a trial)
- ✅ Can run 24/7 if you want
- ✅ No CPU usage on your PC

**Cons:**
- ⚠️ More complex setup (need to configure Linux VM)
- ⚠️ Need to know basic Linux commands

**Setup (advanced):**
1. Sign up at oracle.com/cloud/free
2. Create Ampere A1 VM (free tier)
3. SSH into VM
4. Install Node.js and PM2
5. Clone your repo, add .env, run bot
6. Bot runs forever for free

---

## 🎖️ My Recommendation:

### **For Simplicity: Render.com**
- Deploy once
- Runs when needed
- Auto-stops when idle
- 100% free
- No management needed

### **For Full Control: Fly.io**
- Double-click batch file to start before stream
- Double-click batch file to stop after stream
- 100% free (within limits)
- Fast startup

### **For Advanced Users: Oracle Cloud**
- Set it and forget it
- Run 24/7 forever for free
- Requires Linux knowledge

---

## 📊 Comparison:

| Option | Free? | CPU on PC? | Auto-stop? | Ease |
|--------|-------|------------|------------|------|
| **Local (npm start)** | ✅ Yes | ❌ Uses CPU | Manual | ⭐⭐⭐⭐⭐ |
| **Render.com** | ✅ Yes | ✅ No | ✅ Auto | ⭐⭐⭐⭐⭐ |
| **Fly.io** | ✅ Yes | ✅ No | Manual | ⭐⭐⭐⭐ |
| **Oracle Cloud** | ✅ Yes | ✅ No | 24/7 | ⭐⭐ |
| **Railway** | ⚠️ $5 credit | ✅ No | Manual | ⭐⭐⭐⭐⭐ |

---

## 🎯 Quick Start: Deploy to Render (Recommended)

1. **Sign up:** https://render.com (free, no card needed)

2. **Create New Web Service:**
   - Connect GitHub repo
   - Choose `tattoostwitch`

3. **Configure:**
   - Name: `twitch-bot`
   - Build: `npm install`
   - Start: `node bot.js`
   - Plan: **Free**

4. **Add Environment Variables:**
   - Click "Environment" tab
   - Add all variables from your `.env` file

5. **Deploy:**
   - Render auto-deploys
   - Bot starts automatically
   - Auto-stops 15 min after no activity

6. **Done!**
   - Bot wakes up when someone uses !sr
   - Takes 30-60 sec to wake (first request is slow)
   - Completely free forever

---

## 💡 Pro Tip:

If you go with **Render**, add this to your stream starting routine:

**Before going live:**
- Open your OBS overlay in browser
- Overlay makes request to bot
- Bot wakes up (takes 30 sec)
- Go live

This ensures the bot is awake before viewers start requesting songs!

---

## ❓ Questions?

**"Won't the 30 sec wake-up annoy viewers?"**
- Only happens on first request after 15 min idle
- After that, instant responses
- If you keep streaming, it stays awake

**"Can I keep it awake 24/7 on Render?"**
- No, free tier always spins down after 15 min
- Use Oracle Cloud for true 24/7 free

**"Which should I choose?"**
- **Casual streamer (few hours/week):** Render
- **Regular streamer (daily):** Fly.io
- **Tech-savvy / want 24/7:** Oracle Cloud

---

All options are 100% free and get the bot off your computer's CPU! 🎉
