module.exports = {
  apps: [{
    name: 'twitch-bot',
    script: './bot.js',
    watch: true,
    ignore_watch: [
      'node_modules',
      'netlify',
      '*.html',
      '*.md',
      '.git',
      'nul'
    ],
    max_memory_restart: '200M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    env: {
      NODE_ENV: 'production'
    },
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
