import * as fs from 'fs';
import * as path from 'path';
import { config, LogLevel } from '../modules/config';

/**
 * Simple logger utility with different log levels
 */
export class Logger {
  private prefix: string;
  private logFilePath: string | null = null;

  constructor(prefix: string = '') {
    this.prefix = prefix ? `[${prefix}]` : '';
    
    // Set up file logging if enabled
    if (config.enableFileLogging) {
      this.setupFileLogging();
    }
  }

  /**
   * Set up file logging
   */
  private setupFileLogging(): void {
    try {
      // Create logs directory if it doesn't exist
      if (!fs.existsSync(config.logDirectory)) {
        fs.mkdirSync(config.logDirectory, { recursive: true });
      }
      
      // Create log file with timestamp
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      this.logFilePath = path.join(config.logDirectory, `${dateStr}.log`);
      
      // Add header to log file if it's new
      if (!fs.existsSync(this.logFilePath)) {
        fs.writeFileSync(this.logFilePath, `=== Log started at ${date.toISOString()} ===\n`);
      }
    } catch (error) {
      console.error('Failed to set up file logging:', error);
      this.logFilePath = null;
    }
  }

  /**
   * Format message with timestamp and prefix
   */
  private formatMessage(level: string, message: string, args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 
      ? args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ')
      : '';
    
    return `${timestamp} ${this.prefix}[${level}] ${message} ${formattedArgs}`.trim();
  }

  /**
   * Write message to log file
   */
  private writeToFile(message: string): void {
    if (!this.logFilePath) return;
    
    try {
      fs.appendFileSync(this.logFilePath, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Log an informational message
   */
  info(message: string, ...args: any[]): void {
    if (config.logLevel >= LogLevel.INFO) {
      const formattedMessage = this.formatMessage('INFO', message, args);
      console.log(formattedMessage);
      
      if (this.logFilePath) {
        this.writeToFile(formattedMessage);
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: any[]): void {
    if (config.logLevel >= LogLevel.WARN) {
      const formattedMessage = this.formatMessage('WARN', message, args);
      console.warn(formattedMessage);
      
      if (this.logFilePath) {
        this.writeToFile(formattedMessage);
      }
    }
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: any[]): void {
    if (config.logLevel >= LogLevel.ERROR) {
      const formattedMessage = this.formatMessage('ERROR', message, args);
      console.error(formattedMessage);
      
      if (this.logFilePath) {
        this.writeToFile(formattedMessage);
      }
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: any[]): void {
    if (config.logLevel >= LogLevel.DEBUG) {
      const formattedMessage = this.formatMessage('DEBUG', message, args);
      console.debug(formattedMessage);
      
      if (this.logFilePath) {
        this.writeToFile(formattedMessage);
      }
    }
  }
} 