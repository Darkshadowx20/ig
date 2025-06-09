# Instagram Reels Downloader Bot

A Telegram bot built with GrammY and TypeScript that downloads Instagram reels and posts.

## Features

- Download Instagram reels and videos
- Download Instagram photos
- User-friendly interface
- Error handling

## Setup

1. Clone this repository
   ```bash
   git clone https://github.com/Darkshadowx20/ig.git
   cd ig
   ```

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Create a `.env` file in the root directory and add your Telegram bot token:
   ```
   BOT_TOKEN=your_telegram_bot_token_here
   ADMIN_IDS=1234567890,123456
   USE_MEDIA_GROUPS=true
   ```
   (You can get a bot token from [@BotFather](https://t.me/BotFather) on Telegram)

4. Build the project
   ```bash
   pnpm build
   ```

5. Start the bot
   ```bash
   pnpm start
   ```

## Development

To run in development mode with auto-reload:

```bash
pnpm dev
```

## Project Structure

```
.
├── src/
│   ├── config/        # Configuration files
│   ├── services/      # Service classes for external APIs
│   ├── handlers/      # Message and command handlers
│   ├── utils/         # Utility functions and classes
│   └── index.ts       # Entry point
├── .env               # Environment variables (not in repository)
├── .env.example       # Example environment file
├── package.json       # Project dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## License

MIT 