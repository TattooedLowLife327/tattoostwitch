# Viewer Count Widget Setup

## Overview

The viewer count widget displays real-time viewer counts for Twitch, Facebook, and TikTok streams. It automatically hides platforms with 0 viewers.

## Files

- `viewer-count.html` - Standalone widget for OBS
- `bot.js` - API endpoint `/viewer-counts` that fetches platform data

## Setup

### 1. Twitch (Already Working)

Twitch viewer count uses your existing `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` from .env

### 2. Facebook Live API

To enable Facebook viewer counts:

1. Go to https://developers.facebook.com/apps/
2. Create a new app or use existing
3. Add "Facebook Login" product
4. Get your Page Access Token:
   - Go to Graph API Explorer
   - Select your app
   - Add permissions: `pages_show_list`, `pages_read_engagement`
   - Generate token
5. Get your Facebook Page ID:
   - Go to your Facebook page
   - Click "About"
   - Scroll down to find Page ID
   - Or use Graph API: https://graph.facebook.com/me/accounts?access_token=YOUR_TOKEN

6. Add to your `.env` file:
```
FACEBOOK_ACCESS_TOKEN=your_page_access_token
FACEBOOK_PAGE_ID=your_page_id
```

### 3. TikTok Live API

To enable TikTok viewer counts:

1. Go to https://developers.tiktok.com/
2. Register as a developer
3. Create a new app
4. Request access to "Live" API (requires approval)
5. Get OAuth access token with `live.room.info` scope
6. Add to your `.env` file:
```
TIKTOK_ACCESS_TOKEN=your_access_token
TIKTOK_USERNAME=your_tiktok_username
```

Note: TikTok API access requires business verification and may take several days to approve.

## Using the Widget in OBS

1. Make sure your bot is running: `node bot.js`
2. In OBS, add a new Browser Source
3. Set URL to: `http://localhost:<PORT>/viewer-count.html`
4. Set width/height as needed (e.g., 200x150)
5. Widget updates every 30 seconds automatically

## Customization

Edit `viewer-count.html` to customize:
- Platform icons (change image URLs)
- Font size (modify `.viewer-count` CSS)
- Colors (modify CSS variables)
- Update interval (change `setInterval` value from 30000ms)
- Show/hide logic (modify `updatePlatform` function)

## Testing

Test the API endpoint directly:
```bash
curl http://localhost:<PORT>/viewer-counts
```

Response example:
```json
{
  "twitch": 42,
  "facebook": 0,
  "tiktok": 15
}
```

## Troubleshooting

- If Twitch shows 0: Make sure you're live on Twitch
- If Facebook shows 0: Check access token hasn't expired (tokens expire after 60 days)
- If TikTok shows 0: Verify API access is approved and you're live
- Check browser console in OBS for error messages
- Check bot console logs for API errors
