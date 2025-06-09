import { Logger } from './utils/logger';
import { config, validateConfig } from './modules/config';
import { BotService } from './modules/telegram';

// Initialize logger
const logger = new Logger('App');

// Set environment
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

// Print startup message
logger.info('Starting Instagram Reels Downloader Bot...');
logger.info(`Environment: ${config.isDevelopment ? 'development' : 'production'}`);

async function startBot() {
  try {
    // Validate environment variables
    validateConfig();
    
    // Create and start the bot
    const bot = new BotService();
    await bot.start();
  } catch (error) {
    logger.error('Error starting bot:', error);
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// Start the bot
startBot(); 