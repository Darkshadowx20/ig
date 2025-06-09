import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config();

/**
 * Log level enum
 */
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

/**
 * Configuration options for the application
 */
interface AppConfig {
  // Environment
  isDevelopment: boolean;
  isProduction: boolean;
  
  // Bot settings
  botToken: string;
  
  // Instagram settings
  instagramUserAgent: string;
  instagramApiTimeout: number;
  
  // Download settings
  downloadTimeout: number;
  maxFileSize: number; // in MB
  tempDirectory: string;
  
  // Telegram settings
  mediaDelay: number; // in ms
  useMediaGroups: boolean; // Send multiple media in one message
  
  // Debug settings
  debugFileTTL: number; // in milliseconds
  
  // Logging settings
  logLevel: LogLevel;
  enableFileLogging: boolean;
  logDirectory: string;
}

/**
 * Get the log level from environment variable or default
 */
function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toUpperCase();
  switch (level) {
    case 'NONE': return LogLevel.NONE;
    case 'ERROR': return LogLevel.ERROR;
    case 'WARN': return LogLevel.WARN;
    case 'INFO': return LogLevel.INFO;
    case 'DEBUG': return LogLevel.DEBUG;
    default: 
      // Default to NONE as requested
      return LogLevel.NONE;
  }
}

/**
 * Application configuration
 */
export const config: AppConfig = {
  // Environment
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Bot settings
  botToken: process.env.BOT_TOKEN || '',
  
  // Instagram settings
  instagramUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  instagramApiTimeout: 10000,
  
  // Download settings
  downloadTimeout: 30000,
  maxFileSize: 50, // 50 MB
  tempDirectory: path.join(process.cwd(), 'temp'),
  
  // Telegram settings
  mediaDelay: 1500,
  useMediaGroups: true, // Always enabled by default
  
  // Debug settings
  debugFileTTL: 30 * 60 * 1000, // 30 minutes in milliseconds
  
  // Logging settings
  logLevel: getLogLevel(),
  enableFileLogging: process.env.ENABLE_FILE_LOGGING === 'true',
  logDirectory: path.join(process.cwd(), 'logs')
};

/**
 * Validate required configuration
 */
export function validateConfig(): void {
  const missingVars: string[] = [];
  
  if (!config.botToken) {
    missingVars.push('BOT_TOKEN');
  }
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
} 