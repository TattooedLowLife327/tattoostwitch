# Stream Control PWA Setup

## Deployment to Netlify

1. **Create PWA icons:**
   - Create icon-192.png (192x192 purple icon)
   - Create icon-512.png (512x512 purple icon)
   - You can use any image editor or online tool like https://www.favicon-generator.org/

2. **Upload these files to your tattoostwitch.netlify.app site:**
   - index.html
   - manifest.json
   - sw.js
   - netlify.toml
   - icon-192.png
   - icon-512.png

3. **Expose your local bot to the internet using ngrok:**
   ```bash
   # Install ngrok from ngrok.com
   ngrok http 8787
   ```

4. **Update the API URL:**
   - Open the deployed admin site
   - Open browser console and run:
   ```javascript
   localStorage.setItem('apiUrl', 'https://YOUR-NGROK-URL.ngrok.io');
   ```
   - Refresh the page

5. **Change the PIN:**
   - Edit `index.html` line 284
   - Change `const CORRECT_PIN = '1337';` to your desired PIN

## Install as PWA

### iPhone/iPad:
1. Open Safari, go to tattoostwitch.netlify.app
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Tap "Add"

### Android:
1. Open Chrome, go to tattoostwitch.netlify.app
2. Tap the menu (three dots)
3. Tap "Add to Home screen"
4. Tap "Add"

## Features

- Approve/Deny song requests
- Control scoreboard
- Skip songs
- Trigger promos
- Works offline once installed
- PIN protected

## PM2 Setup (Keep bot running)

```bash
npm install -g pm2
pm2 start bot.js --name twitch-bot
pm2 save
pm2 startup
```

Then just run ngrok and you're good to go!
