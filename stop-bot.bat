@echo off
echo Stopping Twitch Bot...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq npm start*" 2>nul
echo Bot stopped!
timeout /t 3
