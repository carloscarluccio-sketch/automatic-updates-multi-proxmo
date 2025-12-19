module.exports = {
  apps: [
    {
      name: 'multpanel-api',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/pm2/multpanel-api-error.log',
      out_file: '/var/log/pm2/multpanel-api-out.log',
      log_file: '/var/log/pm2/multpanel-api-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'email-processor',
      script: 'dist/scripts/emailProcessorCron.js',
      cron_restart: '*/1 * * * *',
      watch: false,
      autorestart: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/email-processor-error.log',
      out_file: '/var/log/pm2/email-processor-out.log',
      log_file: '/var/log/pm2/email-processor-combined.log',
      time: true
    }
    ,{
      name: 'subscription-charges',
      script: 'dist/scripts/subscriptionChargeCron.js',
      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 2 * * *',
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/pm2/subscription-charges-error.log',
      out_file: '/var/log/pm2/subscription-charges-out.log',
      log_file: '/var/log/pm2/subscription-charges-combined.log',
      time: true
    }

  ]

};