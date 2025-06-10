module.exports = {
  apps: [{
    name: "ig",
    script: "./dist/index.js",
    watch: false,
    env: {
      NODE_ENV: "production",
    },
    max_memory_restart: "300M"
  }]
} 