/**
 * Media types for Instagram content
 */
export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO'
}

/**
 * Media item model for Instagram content
 */
export interface MediaItem {
  type: MediaType;
  url: string;
  width: number;
  height: number;
}

/**
 * Instagram post model
 */
export interface InstagramPost {
  id: string;
  shortcode: string;
  caption?: string;
  mediaCount: number;
  mediaItems: MediaItem[];
}

/**
 * Legacy Instagram media model for compatibility
 */
export interface InstagramMedia {
  is_video: boolean;
  video_url?: string;
  display_url: string;
  is_carousel?: boolean;
  carousel_media?: {
    is_video: boolean;
    video_url?: string;
    display_url: string;
  }[];
} 