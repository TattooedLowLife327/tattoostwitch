export default {
  apps: [{
    name: 'twitch-bot',
    script: './bot.js',
    watch: false,
    max_memory_restart: '200M',
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
