import { Logger } from '../../utils/logger';
import { MediaItem } from './instagram.models';
import { InstagramService } from './instagram.service';

/**
 * Handler for Instagram URL processing
 */
export class InstagramHandler {
  private logger: Logger;
  private instagramService: InstagramService;
  
  // Instagram URL regex pattern
  private static readonly INSTAGRAM_URL_REGEX = /instagram\.com\/(p|reel|tv)\/([^/?]+)/i;

  constructor() {
    this.logger = new Logger('InstagramHandler');
    this.instagramService = new InstagramService();
  }

  /**
   * Check if URL is a valid Instagram post URL
   */
  public isInstagramUrl(url: string): boolean {
    return InstagramHandler.INSTAGRAM_URL_REGEX.test(url);
  }

  /**
   * Extract shortcode from Instagram URL
   */
  public extractShortcode(url: string): string | null {
    this.logger.debug(`Extracting shortcode from URL: ${url}`);
    
    const match = url.match(InstagramHandler.INSTAGRAM_URL_REGEX);
    if (match && match[2]) {
      return match[2];
    }
    
    return null;
  }

  /**
   * Get media items from Instagram post
   */
  public async getMediaItems(shortcode: string): Promise<MediaItem[]> {
    this.logger.info(`Fetching media items for shortcode: ${shortcode}`);
    
    try {
      return await this.instagramService.getMediaItems(shortcode);
    } catch (error) {
      this.logger.error(`Error fetching media for shortcode ${shortcode}:`, error);
      throw error;
    }
  }
} 