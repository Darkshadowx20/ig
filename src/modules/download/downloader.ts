import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from '../../utils/logger';
import { MediaItem, MediaType } from '../instagram/instagram.models';
import { config } from '../config';
import { createHash } from 'crypto';

/**
 * Downloader service for handling media downloads
 */
export class DownloaderService {
  private logger: Logger;
  private tempDir: string;
  
  constructor() {
    this.logger = new Logger('Downloader');
    this.tempDir = config.tempDirectory;
    
    // Create temp directory if it doesn't exist
    this.ensureTempDirectory();
    
    // Set up periodic cleanup
    this.cleanupTempFiles(true);
    setInterval(() => this.cleanupTempFiles(true), 15 * 60 * 1000); // Every 15 minutes
  }
  
  /**
   * Ensure temporary directory exists
   */
  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
        this.logger.debug(`Created temp directory: ${this.tempDir}`);
      } catch (error) {
        this.logger.error('Failed to create temp directory:', error);
        throw new Error('Failed to create temp directory');
      }
    }
  }
  
  /**
   * Clean up temporary files periodically
   * Files older than 1 hour will be deleted
   */
  public cleanupTempFiles(olderFilesOnly: boolean = false): void {
    try {
      if (!fs.existsSync(this.tempDir)) {
        return;
      }
      
      const files = fs.readdirSync(this.tempDir);
      let deletedCount = 0;
      
      const now = Date.now();
      const olderThan = config.debugFileTTL; // Use same TTL as debug files
      
      for (const file of files) {
        try {
          const filePath = path.join(this.tempDir, file);
          
          // Skip non-files
          const stats = fs.statSync(filePath);
          if (!stats.isFile()) continue;
          
          // If olderFilesOnly is true, only delete files older than TTL
          if (olderFilesOnly) {
            const fileAge = now - stats.mtimeMs;
            if (fileAge <= olderThan) continue;
          }
          
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          // Ignore individual file errors
          this.logger.debug(`Error deleting file during cleanup: ${error}`);
        }
      }
      
      if (deletedCount > 0) {
        if (olderFilesOnly) {
          this.logger.debug(`Cleaned up ${deletedCount} temporary files older than ${olderThan / 60000} minutes`);
        } else {
          this.logger.debug(`Cleaned up ${deletedCount} temporary files`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to clean up temporary files:', error);
    }
  }
  
  /**
   * Generate a random filename with the given extension
   */
  private generateFilename(extension: string): string {
    const randomString = crypto.randomBytes(8).toString('hex');
    return `instagram_${randomString}${extension}`;
  }
  
  /**
   * Get file extension from URL or content type
   */
  private getFileExtension(url: string, contentType?: string): string {
    // Try to get extension from URL
    const urlExtension = path.extname(url).toLowerCase();
    if (urlExtension && ['.jpg', '.jpeg', '.png', '.mp4', '.mov'].includes(urlExtension)) {
      return urlExtension;
    }
    
    // If URL doesn't have a valid extension, use content type
    if (contentType) {
      switch (contentType) {
        case 'image/jpeg':
          return '.jpg';
        case 'image/png':
          return '.png';
        case 'video/mp4':
          return '.mp4';
        case 'video/quicktime':
          return '.mov';
        default:
          return '';
      }
    }
    
    // Default extensions based on media type
    return '.jpg';
  }
  
  /**
   * Download a file from URL to local temp directory
   */
  public async downloadFile(url: string, mediaType: MediaType): Promise<string> {
    try {
      this.logger.debug(`Downloading ${mediaType} from: ${url}`);
      
      // First make a HEAD request to get content type and size
      const headResponse = await axios.head(url, { 
        timeout: config.instagramApiTimeout,
        headers: {
          'User-Agent': config.instagramUserAgent
        }
      });
      
      const contentType = headResponse.headers['content-type'];
      const contentLength = parseInt(headResponse.headers['content-length'] || '0', 10);
      
      // Check if file is too large
      const maxFileSizeBytes = config.maxFileSize * 1024 * 1024;
      if (contentLength > maxFileSizeBytes) {
        throw new Error(`File is too large: ${(contentLength / (1024 * 1024)).toFixed(2)}MB. Maximum allowed size is ${config.maxFileSize}MB.`);
      }
      
      // Generate filename with appropriate extension
      const extension = this.getFileExtension(url, contentType);
      const filename = this.generateFilename(extension);
      const filePath = path.join(this.tempDir, filename);
      
      // Download the file
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        timeout: config.downloadTimeout,
        headers: {
          'User-Agent': config.instagramUserAgent
        }
      });
      
      // Create write stream
      const writer = fs.createWriteStream(filePath);
      
      // Pipe response to file
      response.data.pipe(writer);
      
      // Return promise that resolves when download is complete
      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          this.logger.debug(`Download complete: ${filePath}`);
          resolve(filePath);
        });
        writer.on('error', (error) => {
          this.logger.error(`Error writing file: ${filePath}`, error);
          reject(error);
        });
      });
    } catch (error) {
      this.logger.error(`Error downloading file from ${url}:`, error);
      throw error;
    }
  }
  
  /**
   * Download a media item to local temp directory
   */
  public async downloadMediaItem(item: MediaItem): Promise<string> {
    return this.downloadFile(item.url, item.type);
  }
  
  /**
   * Clean up a specific temporary file
   */
  public cleanupFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.logger.debug(`Deleted file: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(`Error deleting file ${filePath}:`, error);
    }
  }
} 