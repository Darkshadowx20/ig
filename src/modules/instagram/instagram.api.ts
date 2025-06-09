import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../utils/logger';
import { config } from '../config';

// Instagram API headers
const INSTAGRAM_HEADERS = {
  'User-Agent': config.instagramUserAgent,
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'X-IG-App-ID': '936619743392459',
  'X-Requested-With': 'XMLHttpRequest',
  'Connection': 'keep-alive',
  'Referer': 'https://www.instagram.com/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin'
};

/**
 * Instagram API service
 * Responsible for making API calls to Instagram
 */
export class InstagramApiService {
  private logger: Logger;
  private debugDir: string;
  
  constructor() {
    this.logger = new Logger('InstagramApi');
    this.debugDir = path.join(process.cwd(), 'debug');
    
    // Create debug directory if in development mode
    if (config.isDevelopment && !fs.existsSync(this.debugDir)) {
      try {
        fs.mkdirSync(this.debugDir, { recursive: true });
        this.logger.debug(`Created debug directory: ${this.debugDir}`);
      } catch (error) {
        this.logger.error('Failed to create debug directory:', error);
      }
    }
    
    // Set up periodic debug file cleanup
    if (config.isDevelopment) {
      this.cleanupDebugFiles();
      // Schedule cleanup every 15 minutes
      setInterval(() => this.cleanupDebugFiles(), 15 * 60 * 1000);
    }
  }
  
  /**
   * Clean up old debug files
   */
  private cleanupDebugFiles(): void {
    try {
      if (!fs.existsSync(this.debugDir)) return;
      
      const now = Date.now();
      const files = fs.readdirSync(this.debugDir);
      let deletedCount = 0;
      
      for (const file of files) {
        try {
          const filePath = path.join(this.debugDir, file);
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtimeMs;
          
          // Delete files older than the configured TTL
          if (fileAge > config.debugFileTTL) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (error) {
          // Ignore individual file errors
          this.logger.debug(`Error processing file during cleanup: ${error}`);
        }
      }
      
      if (deletedCount > 0) {
        this.logger.info(`Cleaned up ${deletedCount} debug files older than ${config.debugFileTTL / 60000} minutes`);
      }
    } catch (error) {
      this.logger.error('Error cleaning up debug files:', error);
    }
  }
  
  /**
   * Save simplified media data for debugging
   */
  private saveSimplifiedDebugData(shortcode: string, data: any): void {
    if (!config.isDevelopment) return;
    
    try {
      // Extract only the essential media information from the response
      const mediaData = data?.data?.xdt_shortcode_media;
      if (!mediaData) return;
      
      // Create a simplified version with just the media data
      const simplifiedData = {
        mediaType: mediaData.__typename,
        shortcode: mediaData.shortcode,
        isVideo: mediaData.is_video,
        displayUrl: mediaData.display_url,
        videoUrl: mediaData.video_url,
        dimensions: mediaData.dimensions,
        // Extract carousel items if present
        carousel: mediaData.edge_sidecar_to_children?.edges?.map((edge: any) => ({
          type: edge.node.__typename,
          isVideo: edge.node.is_video,
          displayUrl: edge.node.display_url,
          videoUrl: edge.node.video_url,
          dimensions: edge.node.dimensions
        }))
      };
      
      // Save simplified data
      const filename = path.join(this.debugDir, `instagram_${shortcode}_${Date.now()}_simple.json`);
      fs.writeFileSync(filename, JSON.stringify(simplifiedData, null, 2));
      this.logger.debug(`Saved simplified debug data to ${filename}`);
      
      // Also save full response if needed
      const fullFilename = path.join(this.debugDir, `instagram_${shortcode}_${Date.now()}_full.json`);
      fs.writeFileSync(fullFilename, JSON.stringify(data, null, 2));
      this.logger.debug(`Saved full debug data to ${fullFilename}`);
    } catch (error) {
      this.logger.error('Failed to save debug data:', error);
    }
  }

  /**
   * Build the Instagram API URL for a post
   */
  private buildApiUrl(shortcode: string): string {
    return `https://www.instagram.com/graphql/query/?doc_id=8845758582119845&variables=${encodeURIComponent(JSON.stringify({
      shortcode,
      fetch_tagged_user_count: null,
      hoisted_comment_id: null,
      hoisted_reply_id: null
    }))}`;
  }
  
  /**
   * Fetch raw post data from Instagram
   */
  async fetchPostData(shortcode: string): Promise<any> {
    this.logger.debug(`Building Instagram API URL for shortcode: ${shortcode}`);
    const url = this.buildApiUrl(shortcode);

    try {
      this.logger.debug('Sending request to Instagram API');
      const response = await axios.get(url, {
        headers: INSTAGRAM_HEADERS,
        timeout: config.instagramApiTimeout
      });

      const mediaData = response.data?.data?.xdt_shortcode_media;
      
      // Save raw response for debugging
      this.saveSimplifiedDebugData(shortcode, response.data);
      
      if (!mediaData) {
        this.logger.error('Invalid response from Instagram API');
        throw new Error('Invalid response from Instagram');
      }

      this.logger.debug('Successfully fetched media data from Instagram');
      return mediaData;
    } catch (error) {
      this.logger.error('Error fetching Instagram media:', error);
      throw error;
    }
  }
} 