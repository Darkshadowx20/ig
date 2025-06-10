import { Bot, GrammyError, session } from 'grammy';
import { Logger } from '../../utils/logger';
import { InstagramHandler } from '../instagram';
import { TelegramHandler } from './telegram.handler';
import { config, LogLevel } from '../config';
import { BotContext, BotSessionData } from './telegram.types';

/**
 * Admin user IDs who can use admin commands
 */
const ADMIN_IDS: number[] = process.env.ADMIN_IDS ? 
  process.env.ADMIN_IDS.split(',').map(id => parseInt(id.trim())) : [];

/**
 * Bot service for handling Telegram interactions
 */
export class BotService {
  private bot: Bot<BotContext>;
  private logger: Logger;
  private instagramHandler: InstagramHandler;
  private telegramHandler: TelegramHandler;

  constructor() {
    this.logger = new Logger('Bot');
    this.bot = new Bot<BotContext>(config.botToken);
    this.instagramHandler = new InstagramHandler();
    this.telegramHandler = new TelegramHandler();

    // Set up middleware
    this.setupMiddleware();
    
    // Set up command handlers
    this.setupCommandHandlers();
    
    // Set up message handlers
    this.setupMessageHandlers();
    
    // Set up error handling
    this.setupErrorHandling();
  }

  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // Session management
    this.bot.use(session({
      initial(): BotSessionData {
        return {
          activeSessions: 0,
          totalProcessed: 0,
          lastUsed: new Date()
        };
      }
    }));
  }

  /**
   * Set up command handlers
   */
  private setupCommandHandlers(): void {
    // Start command
    this.bot.command('start', async (ctx) => {
      this.logger.debug('Start command received');
      await ctx.reply(
        'Welcome to Instagram Reels Downloader Bot! 🎬\n\n' +
        'Send me an Instagram link to a reel, video, or carousel post, and I will download it for you.\n\n' +
        'Just paste the link and I\'ll do the rest!'
      );
    });

    // Help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(
        'How to use this bot:\n\n' +
        '1. Copy an Instagram link (post, reel, video, or carousel)\n' +
        '2. Paste it here\n' +
        '3. Wait for the download to complete\n\n' +
        'If you have any issues, contact the administrator.'
      );
    });

    // Stats command (admin only)
    this.bot.command('stats', async (ctx) => {
      // Check if user is admin
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('This command is only available to administrators.');
        return;
      }

      const stats = {
        activeSessions: ctx.session.activeSessions,
        totalProcessed: ctx.session.totalProcessed,
        lastUsed: ctx.session.lastUsed,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeEnv: process.env.NODE_ENV,
        logLevel: this.getLogLevelName(config.logLevel),
        useMediaGroups: config.useMediaGroups
      };

      await ctx.reply(
        'Bot Statistics:\n\n' +
        `Active Sessions: ${stats.activeSessions}\n` +
        `Total Processed: ${stats.totalProcessed}\n` +
        `Last Used: ${stats.lastUsed.toISOString()}\n` +
        `Uptime: ${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m\n` +
        `Memory: ${Math.round(stats.memoryUsage.rss / 1024 / 1024)} MB\n` +
        `Environment: ${stats.nodeEnv}\n` +
        `Log Level: ${stats.logLevel}\n` +
        `Media Groups: ${stats.useMediaGroups ? 'Enabled' : 'Disabled'}`
      );
    });

    // Log level commands (admin only)
    this.setupLogCommands();
    
    // Media group commands (admin only)
    this.setupMediaGroupCommands();
  }

  /**
   * Set up log level commands
   */
  private setupLogCommands(): void {
    // Log level commands
    this.bot.command('loglevel', async (ctx) => {
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('This command is only available to administrators.');
        return;
      }
      
      await ctx.reply(
        'Current log level: ' + this.getLogLevelName(config.logLevel) + '\n\n' +
        'Available commands:\n' +
        '/loglevel_none - Disable all logging\n' +
        '/loglevel_error - Show only errors\n' +
        '/loglevel_warn - Show warnings and errors\n' +
        '/loglevel_info - Show info, warnings, and errors\n' +
        '/loglevel_debug - Show all logs including debug'
      );
    });
    
    this.bot.command('loglevel_none', (ctx) => this.setLogLevel(ctx, LogLevel.NONE));
    this.bot.command('loglevel_error', (ctx) => this.setLogLevel(ctx, LogLevel.ERROR));
    this.bot.command('loglevel_warn', (ctx) => this.setLogLevel(ctx, LogLevel.WARN));
    this.bot.command('loglevel_info', (ctx) => this.setLogLevel(ctx, LogLevel.INFO));
    this.bot.command('loglevel_debug', (ctx) => this.setLogLevel(ctx, LogLevel.DEBUG));
  }
  
  /**
   * Set up media group commands
   */
  private setupMediaGroupCommands(): void {
    this.bot.command('mediagroups', async (ctx) => {
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('This command is only available to administrators.');
        return;
      }
      
      await ctx.reply(
        'Media Groups: ' + (config.useMediaGroups ? 'Enabled' : 'Disabled') + '\n\n' +
        'Available commands:\n' +
        '/mediagroups_on - Enable media groups\n' +
        '/mediagroups_off - Disable media groups'
      );
    });
    
    this.bot.command('mediagroups_on', async (ctx) => {
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('This command is only available to administrators.');
        return;
      }
      
      // This is a temporary change that will reset on app restart
      // To make it permanent, it should be saved to environment or database
      (config as any).useMediaGroups = true;
      await ctx.reply('Media groups enabled. Multiple images/videos will be sent as albums.');
    });
    
    this.bot.command('mediagroups_off', async (ctx) => {
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('This command is only available to administrators.');
        return;
      }
      
      // This is a temporary change that will reset on app restart
      // To make it permanent, it should be saved to environment or database
      (config as any).useMediaGroups = false;
      await ctx.reply('Media groups disabled. Images/videos will be sent individually.');
    });
  }
  
  /**
   * Set log level
   */
  private async setLogLevel(ctx: BotContext, level: LogLevel): Promise<void> {
    if (!this.isAdmin(ctx.from?.id)) {
      await ctx.reply('This command is only available to administrators.');
      return;
    }
    
    // This is a temporary change that will reset on app restart
    // To make it permanent, it should be saved to environment or database
    (config as any).logLevel = level;
    
    await ctx.reply(`Log level set to: ${this.getLogLevelName(level)}`);
    this.logger.info(`Log level changed to ${this.getLogLevelName(level)}`);
  }
  
  /**
   * Get log level name from enum value
   */
  private getLogLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.NONE: return 'NONE';
      case LogLevel.ERROR: return 'ERROR';
      case LogLevel.WARN: return 'WARN';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.DEBUG: return 'DEBUG';
      default: return 'UNKNOWN';
    }
  }
  
  /**
   * Check if user is an admin
   */
  private isAdmin(userId?: number): boolean {
    if (!userId) return false;
    return ADMIN_IDS.includes(userId);
  }

  /**
   * Set up message handlers
   */
  private setupMessageHandlers(): void {
    // Handle Instagram links
    this.bot.on('message:text', async (ctx) => {
      const messageText = ctx.message.text;
      this.logger.debug('Text message received');
      
      // Track session
      ctx.session.activeSessions++;
      ctx.session.lastUsed = new Date();
      
      try {
        // Only respond to Instagram links
        if (this.instagramHandler.isInstagramUrl(messageText)) {
          this.logger.info('Instagram URL detected');
          
          // Process Instagram URL - await to ensure it completes before handling next message
          await this.processInstagramUrl(ctx, messageText);
          
          // Update session
          ctx.session.totalProcessed++;
        }
        // Don't respond to non-Instagram messages at all
      } catch (error) {
        this.logger.error('Error handling message:', error);
      } finally {
        // Always decrement active sessions counter
        ctx.session.activeSessions--;
      }
    });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.bot.catch((err) => {
      const error = err.error;
      this.logger.error('Bot encountered an error:', error);
      
      if (error instanceof GrammyError) {
        this.logger.error(`Error in request: ${error.description}`);
      } else {
        this.logger.error(`Unknown error:`, error);
      }
    });
  }

  /**
   * Process Instagram URL
   */
  private async processInstagramUrl(ctx: BotContext, url: string): Promise<void> {
    this.logger.info(`Processing Instagram URL: ${url}`);
    
    // Store the original message ID to delete it later
    const originalMessageId = ctx.message?.message_id;
    
    // Send processing message
    const processingMessageId = await this.telegramHandler.sendProcessingMessage(ctx);
    
    try {
      // Extract the shortcode
      const shortcode = this.instagramHandler.extractShortcode(url);
      if (!shortcode) {
        await this.telegramHandler.updateProcessingMessage(
          ctx, 
          processingMessageId, 
          'Invalid Instagram URL. Could not extract post ID.',
          true
        );
        return;
      }
      
      this.logger.debug(`Extracted shortcode: ${shortcode}`);
      await this.telegramHandler.updateProcessingMessage(
        ctx, 
        processingMessageId, 
        'Fetching media from Instagram...'
      );
      
      // Fetch media items
      this.logger.info(`Fetching media items for shortcode: ${shortcode}`);
      const mediaItems = await this.instagramHandler.getMediaItems(shortcode);
      
      if (!mediaItems || mediaItems.length === 0) {
        await this.telegramHandler.updateProcessingMessage(
          ctx, 
          processingMessageId, 
          'No media found or the post might be private/unavailable.',
          true
        );
        return;
      }
      
      // Delete the processing message before sending media
      await this.telegramHandler.deleteMessage(ctx, processingMessageId);
      
      // Send media items and delete original message
      // Make sure to await this operation so it completes before handling the next message
      const sentCount = await this.telegramHandler.sendMediaItems(ctx, mediaItems, originalMessageId);
      
      this.logger.debug(`Sent ${sentCount} media items for shortcode ${shortcode}`);
      
    } catch (error) {
      this.logger.error('Error processing Instagram URL:', error);
      try {
        await this.telegramHandler.updateProcessingMessage(
          ctx, 
          processingMessageId, 
          'Failed to process Instagram URL. Please try again later.',
          true
        );
      } catch (msgError) {
        this.logger.error('Error updating processing message:', msgError);
      }
    }
  }

  /**
   * Start the bot
   */
  public async start(): Promise<void> {
    // Force enable media groups at startup
    (config as any).useMediaGroups = true;
    this.logger.info(`Media groups enabled by default`);
    
    // Initialize and start the bot
    await this.bot.init();
    this.bot.start();
    this.logger.info('Bot @' + this.bot.botInfo.username + ' started successfully!');
  }
} 