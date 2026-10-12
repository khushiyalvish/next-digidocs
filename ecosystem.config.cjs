// Suite kit v7: copied from OnePortal ecosystem.config.cjs. Change it in the hub first, then copy it here.
/**
 * PM2 process configuration (suite kit: every suite application has this file, unchanged).
 *
 *   npm run pm2:start       build, then start
 *   npm run pm2:reload      build, then zero-downtime reload after a deploy
 *                           (--update-env: a bare `pm2 reload` keeps the old PORT)
 *   npm run pm2:logs        tail the logs
 *   npm run pm2:stop / npm run pm2:delete
 *
 * `next start` refuses to run without a production build, and PM2 does not build: always go
 * through the npm scripts, or run `npm run build` first.
 *
 * PM2 runs the process; it does not replace the reverse proxy. HTTPS, the public host name and
 * the per-IP rate limits stay at IIS / nginx (docs/ARCHITECTURE.md §11).
 *
 * ─── Before raising `instances` ──────────────────────────────────────────────────────────
 *
 * Sessions, codes and links are all in the database, so several workers need no sticky
 * sessions (ARCHITECTURE.md §11 #9). The one thing each worker has of its own is its
 * connection pool (src/lib/db.ts; mssql's default is 10 connections): total connections =
 * instances × pool size. Check that against what the SQL Server allows this login.
 */

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

// The process name is the package name, so this file is the same in every suite application.
const { name } = require("./package.json");

// Next.js reads its port from the real process environment, before it loads .env.local — the
// same reason the dev and start npm scripts go through dotenv-cli. So PORT is read here, when
// PM2 loads this file. Only PORT: the file is parsed, not loaded into this process, so the
// connection string and the other secrets never enter the environment PM2 stores and shows
// (`pm2 env`, `pm2 save`). Next.js reads them from .env.local itself.
const envFile = path.join(__dirname, ".env.local");
const fileSettings = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};

const PORT = process.env.PORT || fileSettings.PORT || "3000";

module.exports = {
  apps: [
    {
      name,

      // Next's binary through node, not through npm: one process, so PM2's signals reach the
      // server directly and restarts are clean — the same on Windows and Linux.
      script: path.join("node_modules", "next", "dist", "bin", "next"),
      // The port as an argument as well as in env, so it shows in `pm2 describe`.
      args: `start --port ${PORT}`,
      cwd: __dirname,

      // Cluster mode at one instance: reloads without downtime, and scaling out later is a
      // one-line change (see the note above).
      exec_mode: "cluster",
      instances: 1,

      env: {
        NODE_ENV: "production",
        PORT,
        // Every other setting comes from .env.local (or the server's environment), read by
        // Next.js. Anything set here wins over .env.local, and this file is committed: no
        // secrets here.
      },

      // --- Restart policy ---
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      // A process that dies inside 20 s counts as a failed start; after 10 of those PM2 stops
      // trying, instead of hiding a crash loop. A refused setting (src/lib/config.ts) ends up
      // here: the list of what is wrong is in the error log.
      min_uptime: "20s",
      max_restarts: 10,
      restart_delay: 2000,
      exp_backoff_restart_delay: 200,

      // --- Shutdown ---
      // Time for requests in flight to finish and the database connections to close, before
      // SIGKILL.
      kill_timeout: 8000,
      listen_timeout: 10000,

      // --- Logs ---
      out_file: path.join(__dirname, "logs", `${name}.out.log`),
      error_file: path.join(__dirname, "logs", `${name}.err.log`),
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
