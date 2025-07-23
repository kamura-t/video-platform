module.exports = {
  apps: [
    {
      name: 'gva-video-platform',
      script: 'npm',
      args: 'start',
      cwd: process.cwd(),
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/gva/error.log',
      out_file: '/var/log/gva/out.log',
      log_file: '/var/log/gva/combined.log',
      time: true,
      max_memory_restart: '1G',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'scheduled-publisher',
      script: 'scripts/publish-scheduled-videos.ts',
      interpreter: 'tsx',
      cron_restart: '*/5 * * * *', // 5分毎に実行
      watch: false,
      autorestart: false,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/gva/scheduled-error.log',
      out_file: '/var/log/gva/scheduled-out.log',
      log_file: '/var/log/gva/scheduled.log',
      time: true
    }
  ]
}; 