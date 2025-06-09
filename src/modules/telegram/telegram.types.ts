import { Context, SessionFlavor } from 'grammy';

/**
 * Bot session data
 */
export interface BotSessionData {
  // Active sessions counter
  activeSessions: number;
  
  // Total processed links counter
  totalProcessed: number;
  
  // Last time the bot was used
  lastUsed: Date;
}

/**
 * Bot context with session
 */
export type BotContext = Context & SessionFlavor<BotSessionData>; 