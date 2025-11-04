@echo off
echo Starting Twitch Bot...
cd /d "%~dp0"
start /min cmd /c "npm start"
echo Bot started in background!
timeout /t 3
