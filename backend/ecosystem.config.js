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
        PORT: 5000
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
      name: 'job-workers',
      script: 'dist/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        REDIS_HOST: 'localhost',
        REDIS_PORT: '6379'
      },
      error_file: '/var/log/pm2/job-workers-error.log',
      out_file: '/var/log/pm2/job-workers-out.log',
      log_file: '/var/log/pm2/job-workers-combined.log',
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
  ]
};
