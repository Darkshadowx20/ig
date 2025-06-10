import { Bot, session, GrammyError, HttpError, Context, SessionFlavor } from 'grammy';
import { InstagramHandler } from '../modules/instagram';
import { Logger } from './logger';
import { config } from '../modules/config';

// Define session type
interface SessionData {
  // Add any session data properties here if needed
}

// Create context type with session
type BotContext = Context & SessionFlavor<SessionData>;

export class TelegramBot {
  private bot: Bot<BotContext>;
  private instagramHandler: InstagramHandler;
  private logger: Logger;

  constructor() {
    // Initialize logger
    this.logger = new Logger('Bot');
    
    // Initialize bot with token
    this.bot = new Bot<BotContext>(config.botToken);
    
    // Initialize handlers
    this.instagramHandler = new InstagramHandler();
    
    // Set up middleware
    this.setupMiddleware();
    
    // Set up command handlers
    this.setupCommands();
    
    // Set up message handlers
    this.setupMessageHandlers();
    
    // Set up error handling
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Add session middleware
    this.bot.use(session({ initial: (): SessionData => ({}) }));
  }

  private setupCommands(): void {
    // Start command
    this.bot.command('start', (ctx) => {
      this.logger.debug('Start command received');
      ctx.reply(
        'Welcome to Instagram Reels Downloader Bot! 👋\n\n' +
        'Send me an Instagram post or reel URL, and I\'ll download it for you.\n\n' +
        'I can download:\n' +
        '• Single photos\n' +
        '• Videos and reels\n' +
        '• Carousel posts (multiple photos/videos)\n\n' +
        'Example: https://www.instagram.com/reel/ABCDEFG/'
      );
    });

    // Help command
    this.bot.command('help', (ctx) => {
      this.logger.debug('Help command received');
      ctx.reply(
        'How to use this bot:\n\n' +
        '1. Find an Instagram post or reel you want to download\n' +
        '2. Copy the link\n' +
        '3. Send the link to this bot\n' +
        '4. Wait for the download to complete\n\n' +
        'Supported content types:\n' +
        '• Single photos\n' +
        '• Videos and reels\n' +
        '• Carousel posts (multiple photos/videos)\n\n' +
        'If you encounter any issues, please try again later.'
      );
    });
  }

  private setupMessageHandlers(): void {
    // Handle text messages that contain Instagram URLs
    this.bot.on('message:text', (ctx) => {
      const messageText = ctx.message.text;
      this.logger.debug('Text message received');
      
      // Only respond to Instagram links
      if (this.instagramHandler.isInstagramUrl(messageText)) {
        this.logger.info('Instagram URL detected');
        this.processInstagramUrl(ctx, messageText);
      }
      // Don't respond to non-Instagram messages at all
    });
  }
  
  /**
   * Process Instagram URL
   */
  private async processInstagramUrl(ctx: Context, url: string): Promise<void> {
    this.logger.info(`Processing Instagram URL: ${url}`);
    
    try {
      // Extract the shortcode
      const shortcode = this.instagramHandler.extractShortcode(url);
      if (!shortcode) {
        await ctx.reply('Invalid Instagram URL. Could not extract post ID.');
        return;
      }
      
      await ctx.reply(`Processing Instagram URL with shortcode: ${shortcode}...`);
      
      // Fetch media items
      const mediaItems = await this.instagramHandler.getMediaItems(shortcode);
      
      if (!mediaItems || mediaItems.length === 0) {
        await ctx.reply('No media found or the post might be private/unavailable.');
        return;
      }
      
      await ctx.reply(`Found ${mediaItems.length} media items. Sending URLs...`);
      
      // Just send the URLs for now
      for (const item of mediaItems) {
        await ctx.reply(`${item.type}: ${item.url}`);
      }
    } catch (error) {
      this.logger.error('Error processing Instagram URL:', error);
      await ctx.reply('Failed to process Instagram URL. Please try again later.');
    }
  }

  private setupErrorHandling(): void {
    // Error handler
    this.bot.catch((err) => {
      const ctx = err.ctx;
      this.logger.error(`Error while handling update ${ctx.update.update_id}:`);
      
      if (err.error instanceof GrammyError) {
        this.logger.error('Error in request:', err.error.description);
      } else if (err.error instanceof HttpError) {
        this.logger.error('Could not contact Telegram:', err.error);
      } else {
        this.logger.error('Unknown error:', err.error);
      }
    });
  }

  public start(): void {
    // Start the bot
    this.bot.start({
      onStart: (botInfo) => {
        this.logger.info(`Bot @${botInfo.username} started successfully!`);
      },
    });

    // Handle graceful shutdown
    const gracefulShutdown = (): void => {
      this.logger.info('Shutting down bot gracefully...');
      this.bot.stop();
      process.exit(0);
    };

    process.once('SIGINT', gracefulShutdown);
    process.once('SIGTERM', gracefulShutdown);
  }
} 