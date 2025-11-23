# Backend Changes Needed

## FIXED: Owner Check-In/Out Announcements

**Status:** RESOLVED
**Changes Made:**
- Added role check in check-in announcement ([bot.js:1246](bot.js#L1246))
- Added role check in checkout announcement ([bot.js:1276](bot.js#L1276))
- Owner check-ins/checkouts are now silent (no chat announcements)
- Only 'admin' role triggers announcements

---

## FIXED: Special Users Management Enhancement

**Status:** RESOLVED
**Changes Made:**

Backend (bot.js):
- Removed 'coil666' from specialUserMessages ([bot.js:420](bot.js#L420))
- Updated GET /special-users endpoint to return users with custom messages and default messages ([bot.js:978](bot.js#L978))
- Updated POST /special-users endpoint to accept custom message parameter ([bot.js:987](bot.js#L987))
- Custom messages now stored per-user in specialUserMessages object

Frontend (index.html):
- Enhanced Settings tab Special Users section ([index.html:292-306](index.html#L292-L306))
- Added input field for custom announcement message (#new-special-user-message)
- Added display area for default random messages (#default-messages-list)
- Improved UI layout with background container

Frontend (settings.js):
- Updated loadSettings() to fetch special users from bot API with messages
- Updated renderSpecialUsers() to display custom message or "Uses random default"
- Added renderDefaultMessages() to display list of default random messages
- Updated addSpecialUser() to read and send custom message to bot API
- Updated removeSpecialUser() to use bot API
- Removed specialUsers from saveSettings() (now managed via bot API)
- Updated cache version to v=20

---

## Bot Duplicate Announcements Issue (NEEDS INVESTIGATION)

**Problem:** The bot is repeating confirmations and promos 2x in Twitch chat

**Likely Cause:**
- Multiple bot instances may be running simultaneously
- Check Render dashboard for duplicate deployments
- Check if bot is running locally AND on Render at the same time

**How to Check:**
1. Check Render logs - look for duplicate "[BOT] Lightweight bot running on port..." messages
2. Stop any local bot instances
3. Ensure only ONE Render service is running the bot

**Code Review:**
- No duplicate event listeners found in code
- No duplicate say() calls found for confirmations/promos
- The issue is likely environmental (multiple processes), not code-based

---

## Summary

1. FIXED: Owner check-in/out announcements suppressed
2. FIXED: Admin check-in/out announcements working (only 'admin' role announces)
3. FIXED: Special users management with custom messages in PWA Settings tab
4. FIXED: Removed 'coil666' from special users list
5. TODO: Check for multiple bot instances causing duplicate messages
