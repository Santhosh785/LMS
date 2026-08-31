/**
 * PM2 process definition for the Growth Scholar API + SPA.
 *
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 save && pm2 startup        # survive a reboot
 *
 * `.cjs` because both packages are `"type": "module"` and PM2 reads this file
 * with require().
 *
 * Deliberately `fork` with a single instance rather than cluster mode. The
 * express-rate-limit counters (login, password reset, checkout) live in process
 * memory, so N workers would mean N independent buckets and N times the allowed
 * attempts. Moving to cluster mode requires a shared store first.
 */
module.exports = {
  apps: [
    {
      name: 'growth-scholar',
      cwd: __dirname,
      script: 'server/src/index.js',
      exec_mode: 'fork',
      instances: 1,

      // Restart on crash, but stop flapping if it is crashing at boot — a
      // process that dies on a bad MONGO_URI should stay dead and visible in
      // `pm2 list` rather than spinning forever.
      autorestart: true,
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 2000,
      max_memory_restart: '400M',

      // Logs go to files that survive a restart, with timestamps — see task 19.
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      merge_logs: true,
      time: true,

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        // Everything else — MONGO_URI, JWT_SECRET, RESEND_API_KEY,
        // BUNNY_SECURITY_KEY, Razorpay keys — comes from server/.env, which is
        // gitignored and never passes through this file.
        PORT: 5000,
        TRUST_PROXY: 1, // nginx is the single hop in front
      },
    },
  ],
}
