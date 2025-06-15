module.exports = {
  apps: [{
    name: "ig",
    script: "./dist/index.js",
    watch: false,
    env: {
      NODE_ENV: "production",
    },
    max_memory_restart: "300M",
    // Added PM2 optimizations
    exec_mode: "cluster",
    instances: 1,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 5000,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/error.log",
    out_file: "logs/out.log"
  }]
}