import { Logger } from '../../utils/logger';
import { InstagramApiService } from './instagram.api';
import { MediaItem, MediaType, InstagramPost } from './instagram.models';

/**
 * Instagram service
 * Processes Instagram posts and extracts media
 */
export class InstagramService {
  private logger: Logger;
  private apiService: InstagramApiService;

  constructor() {
    this.logger = new Logger('InstagramService');
    this.apiService = new InstagramApiService();
  }

  /**
   * Extract the shortcode from an Instagram URL
   */
  extractShortcode(url: string): string | null {
    this.logger.debug(`Extracting shortcode from URL: ${url}`);
    const regex = /instagram\.com\/(?:p|reel)\/([^/?]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Get media items from Instagram post by shortcode
   */
  public async getMediaItems(shortcode: string): Promise<MediaItem[]> {
    try {
      // Fetch media data from API
      const mediaData = await this.apiService.fetchPostData(shortcode);
      
      if (!mediaData) {
        this.logger.error('Failed to fetch media data');
        return [];
      }
      
      // Extract media items
      return this.extractMediaItems(mediaData, shortcode);
    } catch (error) {
      this.logger.error(`Error fetching media items for ${shortcode}:`, error);
      throw error;
    }
  }

  /**
   * Extract media items from Instagram API response
   */
  private extractMediaItems(mediaData: any, shortcode: string): MediaItem[] {
    try {
      const mediaType = mediaData?.__typename || '';
      this.logger.debug(`Media type: ${mediaType}`);
      
      // For GraphSidecar (carousel posts), extract all media items
      if (mediaData?.edge_sidecar_to_children?.edges) {
        return this.extractCarouselMedia(mediaData);
      }
      
      // For single video
      if (mediaType === 'GraphVideo' || mediaData?.is_video) {
        return this.extractVideoMedia(mediaData);
      }
      
      // For single image
      return this.extractImageMedia(mediaData);
    } catch (error) {
      this.logger.error(`Error extracting media items from data:`, error);
      return [];
    }
  }

  /**
   * Extract media items from a carousel post
   */
  private extractCarouselMedia(mediaData: any): MediaItem[] {
    const items: MediaItem[] = [];
    const edges = mediaData?.edge_sidecar_to_children?.edges || [];
    
    if (!edges || !Array.isArray(edges) || edges.length === 0) {
      this.logger.error('Invalid carousel media data');
      return items;
    }
    
    for (const edge of edges) {
      const node = edge.node;
      
      if (node.is_video && node.video_url) {
        // Video in carousel
        items.push({
          type: MediaType.VIDEO,
          url: node.video_url,
          width: node.dimensions?.width || 0,
          height: node.dimensions?.height || 0
        });
      } else if (node.display_url) {
        // Image in carousel - use highest quality URL
        items.push({
          type: MediaType.IMAGE,
          url: node.display_url,
          width: node.dimensions?.width || 0,
          height: node.dimensions?.height || 0
        });
      }
    }
    
    this.logger.debug(`Processed carousel with ${items.length} media items`);
    return items;
  }

  /**
   * Extract media items from a video post
   */
  private extractVideoMedia(mediaData: any): MediaItem[] {
    // First try specific video_url path
    if (mediaData.video_url) {
      return [{
        type: MediaType.VIDEO,
        url: mediaData.video_url,
        width: mediaData.dimensions?.width || 0,
        height: mediaData.dimensions?.height || 0
      }];
    }
    
    // Try to find video URL in video_versions (sometimes present in mobile API)
    if (mediaData.video_versions && mediaData.video_versions.length > 0) {
      // Use highest quality video (usually first in the array)
      return [{
        type: MediaType.VIDEO,
        url: mediaData.video_versions[0].url,
        width: mediaData.video_versions[0].width || 0,
        height: mediaData.video_versions[0].height || 0
      }];
    }
    
    this.logger.error('Could not find valid video URL in media data');
    return [];
  }

  /**
   * Extract media items from an image post
   */
  private extractImageMedia(mediaData: any): MediaItem[] {
    // First try direct display_url which is usually highest quality
    if (mediaData.display_url) {
      return [{
        type: MediaType.IMAGE,
        url: mediaData.display_url,
        width: mediaData.dimensions?.width || 0,
        height: mediaData.dimensions?.height || 0
      }];
    }
    
    // Try to find image in candidates (sometimes present in mobile API)
    if (mediaData.image_versions2?.candidates && mediaData.image_versions2.candidates.length > 0) {
      // Use highest quality image (usually first in the array)
      const bestImage = mediaData.image_versions2.candidates[0];
      return [{
        type: MediaType.IMAGE,
        url: bestImage.url,
        width: bestImage.width || 0,
        height: bestImage.height || 0
      }];
    }
    
    this.logger.error('Could not find valid image URL in media data');
    return [];
  }
  
  /**
   * Get post metadata with media items
   */
  async fetchInstagramPost(shortcode: string): Promise<InstagramPost> {
    try {
      // Fetch data from API
      const mediaData = await this.apiService.fetchPostData(shortcode);
      
      if (!mediaData) {
        throw new Error('Failed to fetch Instagram post data');
      }
      
      // Get media items
      const mediaItems = this.extractMediaItems(mediaData, shortcode);
      
      // Extract caption
      let caption = '';
      if (mediaData.edge_media_to_caption?.edges?.[0]?.node?.text) {
        caption = mediaData.edge_media_to_caption.edges[0].node.text;
      } else if (mediaData.caption?.text) {
        caption = mediaData.caption.text;
      }
      
      // Create post object
      return {
        id: mediaData.id || '',
        shortcode,
        caption,
        mediaCount: mediaItems.length,
        mediaItems
      };
    } catch (error) {
      this.logger.error(`Error fetching Instagram post for ${shortcode}:`, error);
      throw error;
    }
  }
} 