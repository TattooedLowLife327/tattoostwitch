@echo off
echo Starting bot on Railway...
curl -X POST https://backboard.railway.app/graphql ^
  -H "Authorization: Bearer YOUR_RAILWAY_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"mutation { serviceInstanceUpdate(id: \\\"YOUR_SERVICE_ID\\\", input: {numReplicas: 1}) { id } }\"}"
echo.
echo Bot started! Check Railway dashboard.
timeout /t 5
