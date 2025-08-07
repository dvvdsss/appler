/**
 * Production MCP Token Validator - Extreme Simplicity
 * MCP 2025-06-18 Authorization compliant implementation
 * Pure Cloudflare D1 with optimal two-table design
 */

import { logger } from '../logger.js';
import { D1Connector, CloudflareD1Config } from '../services/d1-connector.js';

export interface TokenClaims {
  sub: string;
  aud: string | string[];
  iss: string;
  iat: number;
  exp?: number;
  scope?: string;
  client_id?: string;
  resource?: string;
  jti?: string;
}

export interface TokenValidationResult {
  valid: boolean;
  claims?: TokenClaims;
  error?: string;
  scopes?: string[];
}

export interface UserTokenData {
  userId: string;
  email: string;
  name: string;
  tier: string;
}



interface CacheEntry {
  readonly data: UserTokenData;
  readonly expiry: number;
}

export class TokenValidator {
  private readonly baseUrl: string;
  private readonly d1Connector: D1Connector;
  private readonly tokenCache = new Map<string, CacheEntry>();
  private readonly cacheTimeout = 300_000; // 5 minutes in milliseconds
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(baseUrl: string, d1Config: CloudflareD1Config) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.d1Connector = new D1Connector(d1Config);

    // Start cache cleanup with proper cleanup on destruction
    this.cleanupInterval = setInterval(() => this.cleanupExpiredCache(), 60_000);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.tokenCache.clear();
  }

  /**
   * Validate MCP token with modern async/await and type safety
   */
  async validateToken(token: string, _requiredResource?: string): Promise<TokenValidationResult> {
    try {
      // Fast cache lookup
      const cached = this.getCachedToken(token);
      if (cached) {
        return this.createSuccessResult(cached);
      }

      // Validate token format with modern regex
      if (!this.isValidTokenFormat(token)) {
        return { valid: false, error: 'Invalid token format' };
      }

      // Single optimized D1 query
      const userData = await this.getUserDataFromD1(token);
      if (!userData) {
        return { valid: false, error: 'Token not found' };
      }

      // Non-blocking async operations
      this.updateTokenLastUsedAsync(token);
      this.cacheToken(token, userData);

      return this.createSuccessResult(userData);
    } catch (error) {
      logger.error('Token validation failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenPrefix: token.substring(0, 8) + '...'
      });
      return { valid: false, error: 'Validation failed' };
    }
  }

  /**
   * Modern token format validation
   */
  private isValidTokenFormat(token: string): boolean {
    return /^at_[a-f0-9]{32}$/.test(token);
  }

  /**
   * Get cached token with expiry check
   */
  private getCachedToken(token: string): UserTokenData | null {
    const cached = this.tokenCache.get(token);
    if (cached && Date.now() < cached.expiry) {
      logger.debug('Token validation from cache', { userId: cached.data.userId });
      return cached.data;
    }
    return null;
  }

  /**
   * Cache token with expiry
   */
  private cacheToken(token: string, userData: UserTokenData): void {
    this.tokenCache.set(token, {
      data: userData,
      expiry: Date.now() + this.cacheTimeout
    });
  }

  /**
   * Create success result with claims and scopes
   */
  private createSuccessResult(userData: UserTokenData): TokenValidationResult {
    const claims = this.convertUserDataToClaims(userData);
    const scopes = this.getScopesForTier(userData.tier);
    return { valid: true, claims, scopes };
  }

  /**
   * Get user data from D1 with environment-aware connection
   */
  private async getUserDataFromD1(token: string): Promise<UserTokenData | null> {
    try {
      const result = await this.d1Connector.query(
        `SELECT
           u.id as user_id,
           u.email,
           u.name,
           'free' as tier
         FROM mcp_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.mcp_token = ?`,
        [token]
      );

      if (!result.success || !result.results || result.results.length === 0) {
        return null;
      }

      const row = result.results[0];
      return {
        userId: row.user_id,
        email: row.email || 'unknown',
        name: row.name || 'unknown',
        tier: row.tier || 'free'
      };
    } catch (error) {
      logger.warn('D1 user data lookup failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }



  /**
   * Non-blocking token usage update
   */
  private updateTokenLastUsedAsync(token: string): void {
    // Fire and forget - don't block validation response
    this.d1Connector.query(
      "UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE mcp_token = ?",
      [token]
    ).catch(error => {
      logger.warn('Failed to update token last_used_at', {
        error: error instanceof Error ? error.message : String(error),
        tokenPrefix: token.substring(0, 8) + '...'
      });
    });
  }

  /**
   * Convert user data to OAuth 2.1 claims
   */
  private convertUserDataToClaims(userData: UserTokenData): TokenClaims {
    const now = Math.floor(Date.now() / 1000);

    return {
      sub: userData.userId,
      aud: [this.baseUrl],
      iss: `${this.baseUrl}/oauth`,
      iat: now,
      scope: this.getScopesForTier(userData.tier).join(' '),
      client_id: 'apple-rag-mcp',
      resource: this.baseUrl,
      jti: `mcp-${userData.userId}-${now}`
    };
  }

  /**
   * Get scopes based on user tier
   */
  private getScopesForTier(tier: string): string[] {
    switch (tier) {
      case 'premium':
      case 'enterprise':
        return ['mcp:read', 'mcp:write', 'mcp:admin'];
      case 'pro':
        return ['mcp:read', 'mcp:write'];
      case 'free':
      default:
        return ['mcp:read'];
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, cached] of this.tokenCache.entries()) {
      if (now >= cached.expiry) {
        this.tokenCache.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('Cleaned up expired token cache entries', { count: cleaned });
    }
  }

  /**
   * Check if token has required scope
   */
  hasScope(scopes: string[], requiredScope: string): boolean {
    return scopes.includes(requiredScope) || scopes.includes('mcp:admin');
  }

  /**
   * Revoke token (delete from D1)
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const result = await this.d1Connector.query(
        "DELETE FROM mcp_tokens WHERE mcp_token = ?",
        [token]
      );

      if (result.success) {
        // Remove from cache
        this.tokenCache.delete(token);

        logger.info('Token revoked', { token: token.substring(0, 8) + '...' });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Token revocation error:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }



  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.tokenCache.size
    };
  }

  /**
   * Clear all cached tokens (for testing/maintenance)
   */
  clearCache(): void {
    this.tokenCache.clear();
    logger.info('Token cache cleared');
  }

  /**
   * Get user token data by user ID
   */
  async getUserTokenData(userId: string): Promise<UserTokenData> {
    try {
      const result = await this.d1Connector.query(
        'SELECT id, email, name, tier FROM users WHERE id = ?',
        [userId]
      );

      if (!result.success || !result.results || result.results.length === 0) {
        throw new Error('User not found');
      }

      const user = result.results[0];

      return {
        userId: user.id,
        email: user.email,
        name: user.name || user.email.split('@')[0],
        tier: user.tier || 'free'
      };
    } catch (error) {
      logger.error('Failed to get user token data', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
