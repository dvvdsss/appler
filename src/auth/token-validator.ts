/**
 * Production MCP Token Validator - Extreme Simplicity
 * MCP 2025-06-18 Authorization compliant implementation
 * Pure Cloudflare D1 with optimal two-table design
 */

import { logger } from '../logger.js';

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

export interface CloudflareD1Config {
  accountId: string;
  apiToken: string;
  databaseId: string;
}

export class TokenValidator {
  private baseUrl: string;
  private d1Config: CloudflareD1Config;
  private tokenCache = new Map<string, { data: UserTokenData; expiry: number }>();
  private cacheTimeout = 300; // 5 minutes cache

  constructor(baseUrl: string, d1Config: CloudflareD1Config) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.d1Config = d1Config;

    // DEBUG: Log the D1 configuration being used
    console.log('🔍 TokenValidator initialized with D1 config:', {
      accountId: d1Config.accountId?.substring(0, 8) + '...',
      databaseId: d1Config.databaseId?.substring(0, 8) + '...',
      hasApiToken: !!d1Config.apiToken
    });

    // Start cache cleanup timer
    setInterval(() => this.cleanupExpiredCache(), 60000);
  }

  /**
   * Validate MCP token via single D1 query - Maximum simplicity
   */
  async validateToken(token: string, _requiredResource?: string): Promise<TokenValidationResult> {
    try {
      // Check cache first
      const cached = this.tokenCache.get(token);
      if (cached && Date.now() < cached.expiry) {
        logger.debug('Token validation from cache', { userId: cached.data.userId });
        const claims = this.convertUserDataToClaims(cached.data);
        const scopes = this.getScopesForTier(cached.data.tier);
        return { valid: true, claims, scopes };
      }

      // Validate token format (at_[32 hex chars] = 35 total)
      if (!token.startsWith('at_') || token.length !== 35) {
        return { valid: false, error: 'Invalid token format' };
      }

      // Single D1 query to get all user data
      const userData = await this.getUserDataFromD1(token);
      if (!userData) {
        return { valid: false, error: 'Token not found' };
      }

      // Async update last_used_at (non-blocking)
      this.updateTokenLastUsedAsync(token);

      // Cache the validated token
      this.tokenCache.set(token, {
        data: userData,
        expiry: Date.now() + (this.cacheTimeout * 1000)
      });

      // Convert to OAuth 2.1 claims and get scopes
      const claims = this.convertUserDataToClaims(userData);
      const scopes = this.getScopesForTier(userData.tier);

      logger.info('Token validation successful', {
        userId: userData.userId,
        email: userData.email,
        tier: userData.tier,
        scopes
      });

      return { valid: true, claims, scopes };
    } catch (error) {
      logger.error('Token validation error:', {
        error: error instanceof Error ? error.message : String(error),
        tokenPrefix: token.substring(0, 8) + '...'
      });
      return { valid: false, error: 'Token validation failed' };
    }
  }

  /**
   * Get user data from D1 with single optimized query
   */
  private async getUserDataFromD1(token: string): Promise<UserTokenData | null> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.d1Config.accountId}/d1/database/${this.d1Config.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.d1Config.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sql: `
              SELECT
                u.id as user_id,
                u.email,
                u.name,
                'free' as tier
              FROM mcp_tokens t
              JOIN users u ON t.user_id = u.id
              WHERE t.token = ?
            `,
            params: [token]
          })
        }
      );

      if (!response.ok) {
        throw new Error(`D1 query failed: ${response.status}`);
      }

      const data = await response.json() as any;
      const results = data.result?.[0]?.results;

      if (!results || results.length === 0) {
        return null;
      }

      const row = results[0];
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
   * Update token last_used_at asynchronously (non-blocking)
   */
  private updateTokenLastUsedAsync(token: string): void {
    // Fire and forget - don't block the validation response
    fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.d1Config.accountId}/d1/database/${this.d1Config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.d1Config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: "UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE token = ?",
          params: [token]
        })
      }
    ).catch(error => {
      logger.warn('Failed to update token last_used_at', {
        error: error instanceof Error ? error.message : String(error)
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
      // Delete token from D1 (simple deletion, no soft delete)
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.d1Config.accountId}/d1/database/${this.d1Config.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.d1Config.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sql: "DELETE FROM mcp_tokens WHERE token = ?",
            params: [token]
          })
        }
      );

      if (response.ok) {
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
}
