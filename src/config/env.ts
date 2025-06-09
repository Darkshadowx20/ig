import * as dotenv from 'dotenv';

dotenv.config();

// Simple environment variable validation
export const env = {
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  
  // Validate environment variables
  validate(): void {
    if (!this.BOT_TOKEN) {
      throw new Error('BOT_TOKEN environment variable is required');
    }
  }
}; 