module.exports = {
  apps: [
    {
      name: 'ai-stock-risk-check',
      script: 'main.js',
      args: '--risk',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '0 * * * *', // Every hour
      log_file: './logs/risk-check.log',
      error_file: './logs/risk-check-error.log',
      out_file: './logs/risk-check-out.log',
      time: true
    },
    {
      name: 'ai-stock-opportunity-check',
      script: 'main.js',
      args: '--opportunity',
      instances: 1,
      autorestart: false,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      cron_restart: '10 6 * * *', // 6:10 AM daily
      log_file: './logs/opportunity-check.log',
      error_file: './logs/opportunity-check-error.log',
      out_file: './logs/opportunity-check-out.log',
      time: true
    }
  ]
};