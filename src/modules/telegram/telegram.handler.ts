import { Context } from 'grammy';
import { InputFile, InputMediaPhoto, InputMediaVideo } from 'grammy/types';
import { Logger } from '../../utils/logger';
import { MediaItem, MediaType } from '../instagram/instagram.models';
import { DownloaderService } from '../download';
import { config } from '../config';

/**
 * Maximum media items in a group (Telegram limit)
 */
const MAX_MEDIA_GROUP_SIZE = 10;

/**
 * Telegram handler for sending media
 */
export class TelegramHandler {
  private logger: Logger;
  private downloader: DownloaderService;

  constructor() {
    this.logger = new Logger('TelegramHandler');
    this.downloader = new DownloaderService();
    
    // Schedule temp file cleanup every hour
    setInterval(() => {
      this.downloader.cleanupTempFiles();
    }, 60 * 60 * 1000);
  }

  /**
   * Send a single media item to a user
   */
  async sendMediaItem(ctx: Context, item: MediaItem, caption?: string): Promise<boolean> {
    try {
      // Download the file first
      const filePath = await this.downloader.downloadMediaItem(item);
      
      // Create input file
      const file = new InputFile(filePath);
      
      if (item.type === MediaType.VIDEO) {
        this.logger.info('Sending video to user');
        await ctx.replyWithVideo(file);
      } else if (item.type === MediaType.IMAGE) {
        this.logger.info('Sending photo to user');
        await ctx.replyWithPhoto(file);
      } else {
        this.logger.warn(`Unknown media type: ${item.type}`);
        await ctx.reply(`Unsupported media type: ${item.type}`);
        
        // Clean up the downloaded file
        this.downloader.cleanupFile(filePath);
        return false;
      }
      
      // Clean up the downloaded file
      this.downloader.cleanupFile(filePath);
      return true;
    } catch (error) {
      this.logger.error(`Error sending media: ${item.type}`, error);
      
      // Fallback to URL if downloading fails
      this.logger.info('Falling back to direct URL method');
      try {
        if (item.type === MediaType.VIDEO) {
          await ctx.replyWithVideo(item.url);
        } else if (item.type === MediaType.IMAGE) {
          await ctx.replyWithPhoto(item.url);
        } else {
          await ctx.reply(`Failed to send ${item.type}. Unsupported media type.`);
          return false;
        }
        return true;
      } catch (fallbackError) {
        this.logger.error('Fallback method failed too:', fallbackError);
        await ctx.reply(`Failed to send ${item.type}. The file might be too large or unavailable.`);
        return false;
      }
    }
  }

  /**
   * Send media items as a media group (album)
   * Maximum 10 items per group
   */
  async sendMediaGroup(ctx: Context, items: MediaItem[], caption?: string): Promise<boolean> {
    if (!items.length) return false;
    
    try {
      // Download all files first
      const downloads = await Promise.all(
        items.map(item => this.downloader.downloadMediaItem(item))
      );
      
      // Prepare media group
      const mediaGroup = downloads.map((filePath, index) => {
        const file = new InputFile(filePath);
        
        if (items[index].type === MediaType.VIDEO) {
          return {
            type: 'video' as const,
            media: file
          } as InputMediaVideo;
        } else {
          return {
            type: 'photo' as const,
            media: file
          } as InputMediaPhoto;
        }
      });
      
      this.logger.info(`Sending media group with ${mediaGroup.length} items`);
      
      // Send media group
      await ctx.replyWithMediaGroup(mediaGroup);
      
      // Clean up downloaded files
      downloads.forEach(filePath => {
        this.downloader.cleanupFile(filePath);
      });
      
      return true;
    } catch (error) {
      this.logger.error('Error sending media group:', error);
      
      // If media group fails, try sending individually
      this.logger.info('Falling back to individual messages');
      let sentCount = 0;
      
      for (let i = 0; i < items.length; i++) {
        try {
          const success = await this.sendMediaItem(ctx, items[i]);
          if (success) sentCount++;
          
          // Add delay between messages
          if (i < items.length - 1) {
            await new Promise(resolve => setTimeout(resolve, config.mediaDelay));
          }
        } catch (e) {
          this.logger.error(`Error sending item ${i}:`, e);
        }
      }
      
      return sentCount > 0;
    }
  }

  /**
   * Split items into groups of maximum size
   */
  private splitIntoGroups(items: MediaItem[]): MediaItem[][] {
    const groups: MediaItem[][] = [];
    
    for (let i = 0; i < items.length; i += MAX_MEDIA_GROUP_SIZE) {
      groups.push(items.slice(i, i + MAX_MEDIA_GROUP_SIZE));
    }
    
    return groups;
  }

  /**
   * Send multiple media items to a user
   */
  async sendMediaItems(ctx: Context, items: MediaItem[], originalMessageId?: number): Promise<number> {
    if (items.length === 0) {
      return 0;
    }

    let successCount = 0;
    
    try {
      // If there's only one item, send it directly
      if (items.length === 1) {
        const success = await this.sendMediaItem(ctx, items[0]);
        successCount = success ? 1 : 0;
      } else {
        // If multiple items, process silently without progress updates
        // Check if we should use media groups or individual messages
        if (config.useMediaGroups) {
          // Split items into groups of maximum size (10 for Telegram)
          const groups = this.splitIntoGroups(items);
          this.logger.debug(`Split ${items.length} items into ${groups.length} groups`);
          
          // Send each group
          for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            
            try {
              const success = await this.sendMediaGroup(ctx, group);
              if (success) successCount += group.length;
              
              // Add delay between groups
              if (i < groups.length - 1) {
                await new Promise(resolve => setTimeout(resolve, config.mediaDelay * 2));
              }
            } catch (error) {
              this.logger.error(`Error sending group ${i+1}:`, error);
            }
          }
        } else {
          // Send each item individually
          for (let i = 0; i < items.length; i++) {
            try {
              const success = await this.sendMediaItem(ctx, items[i]);
              
              if (success) {
                successCount++;
              }
              
              // Add a small delay between sending items to avoid rate limiting
              if (i < items.length - 1) {
                await new Promise(resolve => setTimeout(resolve, config.mediaDelay));
              }
            } catch (error) {
              this.logger.error(`Error sending item ${i+1}:`, error);
            }
          }
        }
      }
    } finally {
      // Delete the original message with the Instagram link if provided
      if (originalMessageId && ctx.chat) {
        try {
          await this.deleteMessage(ctx, originalMessageId);
          this.logger.debug(`Deleted original message ${originalMessageId}`);
        } catch (error) {
          this.logger.error(`Failed to delete original message ${originalMessageId}:`, error);
        }
      }
    }

    return successCount;
  }

  /**
   * Send error message to user
   */
  async sendError(ctx: Context, message: string): Promise<void> {
    await ctx.reply(`❌ ${message}`);
  }

  /**
   * Send processing message and return message ID for later update
   */
  async sendProcessingMessage(ctx: Context): Promise<number> {
    const msg = await ctx.reply('Processing your Instagram link...');
    return msg.message_id;
  }

  /**
   * Update processing message with error
   */
  async updateProcessingMessage(ctx: Context, messageId: number, message: string, isError = false): Promise<void> {
    try {
      if (!ctx.chat) return;
      
      await ctx.api.editMessageText(
        ctx.chat.id, 
        messageId, 
        isError ? `❌ ${message}` : message
      );
    } catch (error) {
      this.logger.error('Failed to update processing message:', error);
      // If edit fails, send a new message
      await ctx.reply(isError ? `❌ ${message}` : message);
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(ctx: Context, messageId: number): Promise<boolean> {
    try {
      if (!ctx.chat) return false;
      
      await ctx.api.deleteMessage(ctx.chat.id, messageId);
      return true;
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
      return false;
    }
  }
} 