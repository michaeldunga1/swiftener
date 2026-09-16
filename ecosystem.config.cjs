/** PM2 — main site at https://swiftener.com (nginx → port 3000) */
module.exports = {
  apps: [
    {
      name: 'swiftener',
      script: 'app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
        HOST: '0.0.0.0',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '0.0.0.0',
      },
    },
  ],
};
