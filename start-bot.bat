@echo off
echo Stopping any existing bot instances...
pm2 delete twitch-bot 2>nul

echo Starting bot with PM2...
pm2 start ecosystem.config.js

echo Saving PM2 process list...
pm2 save

echo Setting up PM2 to start on system boot...
pm2 startup

echo.
echo Bot is now running as a background service!
echo It will auto-restart on crashes and file changes.
echo.
echo Useful commands:
echo   pm2 logs twitch-bot  - View live logs
echo   pm2 restart twitch-bot - Restart manually
echo   pm2 stop twitch-bot - Stop the bot
echo   pm2 start twitch-bot - Start the bot
echo.
pause
