/**
 * Modern Session Management Service
 * High-performance in-memory session storage for VPS deployment
 */

import { AppConfig } from '../types/env.js';
import { logger } from '../logger.js';

interface UserContext {
  userId: string;
  username: string;
  tier: string;
  created_at: string;
  is_active: boolean;
}

interface Session {
  id: string;
  user: UserContext;
  created: number;
  lastActivity: number;
}

export class SessionService {
  private sessions = new Map<string, Session>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: AppConfig) {
    // Start cleanup timer
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Cleanup every minute
  }

  /**
   * Create a new session
   */
  async createSession(user: UserContext): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      user,
      created: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(session.id, session);
    
    logger.debug('Session created', {
      sessionId: session.id,
      userId: user.userId,
      username: user.username
    });

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (this.isSessionExpired(session)) {
      this.sessions.delete(sessionId);
      logger.debug('Session expired and removed', { sessionId });
      return null;
    }

    // Update last activity
    session.lastActivity = Date.now();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Update session activity
   */
  async updateActivity(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug('Session deleted', { sessionId });
    }
  }

  /**
   * Get session statistics
   */
  getStats(): { total: number; active: number } {
    let active = 0;

    for (const session of this.sessions.values()) {
      if (!this.isSessionExpired(session)) {
        active++;
      }
    }

    return {
      total: this.sessions.size,
      active
    };
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(session: Session): boolean {
    const now = Date.now();
    const sessionAge = now - session.lastActivity;
    return sessionAge > (this.config.SESSION_TIMEOUT * 1000);
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up expired sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size
      });
    }
  }

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    logger.info('Session service destroyed');
  }
}
