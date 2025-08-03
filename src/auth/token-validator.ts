/**
 * OAuth 2.1 Access Token Validator
 * MCP 2025-06-18 Authorization compliant implementation
 */

import { logger } from '../logger.js';

export interface TokenClaims {
  sub: string;
  aud: string | string[];
  iss: string;
  exp: number;
  iat: number;
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

export class TokenValidator {
  private baseUrl: string;
  private validTokens = new Map<string, TokenClaims>(); // In-memory store for demo
  private revokedTokens = new Set<string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    
    // Initialize with some demo tokens for testing
    this.initializeDemoTokens();
  }

  /**
   * Validate Bearer access token
   */
  async validateToken(token: string, _requiredResource?: string): Promise<TokenValidationResult> {
    try {
      // Check if token is revoked
      if (this.revokedTokens.has(token)) {
        return {
          valid: false,
          error: 'Token has been revoked'
        };
      }

      // For demo: check in-memory store
      // In production: verify JWT signature, check with introspection endpoint, etc.
      const claims = this.validTokens.get(token);
      
      if (!claims) {
        return {
          valid: false,
          error: 'Invalid or expired token'
        };
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        this.validTokens.delete(token); // Clean up expired token
        return {
          valid: false,
          error: 'Token has expired'
        };
      }

      // Security: Strict audience validation to prevent token passthrough
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      const validAudiences = [this.baseUrl];

      // Check if token has at least one valid audience for this MCP server
      const hasValidAudience = audiences.some(aud => validAudiences.includes(aud));
      if (!hasValidAudience) {
        return {
          valid: false,
          error: 'Token not issued for this MCP server'
        };
      }

      // Security: Strict issuer validation
      const expectedIssuer = `${this.baseUrl}/oauth`;
      if (claims.iss !== expectedIssuer) {
        return {
          valid: false,
          error: 'Token issuer mismatch'
        };
      }

      // Security: Resource parameter validation (RFC8707)
      if (claims.resource && claims.resource !== this.baseUrl) {
        return {
          valid: false,
          error: 'Token resource parameter mismatch'
        };
      }

      // Parse scopes
      const scopes = claims.scope ? claims.scope.split(' ') : [];

      // Security: Additional validation for suspicious patterns
      if (this.isSuspiciousToken(claims)) {
        logger.warn('Suspicious token detected', {
          subject: claims.sub,
          client: claims.client_id,
          issuer: claims.iss,
          audience: claims.aud
        });
        return {
          valid: false,
          error: 'Token validation failed due to security policy'
        };
      }

      logger.info('Token validation successful', {
        subject: claims.sub,
        client: claims.client_id,
        scopes,
        resource: claims.resource,
        issuer: claims.iss
      });

      return {
        valid: true,
        claims,
        scopes
      };
    } catch (error) {
      logger.error('Token validation error:', { error: error instanceof Error ? error.message : String(error) });
      return {
        valid: false,
        error: 'Token validation failed'
      };
    }
  }

  /**
   * Check if token has required scope
   */
  hasScope(scopes: string[], requiredScope: string): boolean {
    return scopes.includes(requiredScope) || scopes.includes('mcp:admin');
  }

  /**
   * Revoke token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      this.revokedTokens.add(token);
      this.validTokens.delete(token);
      
      logger.info('Token revoked', { token: token.substring(0, 8) + '...' });
      return true;
    } catch (error) {
      logger.error('Token revocation error:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  /**
   * Introspect token (RFC7662)
   */
  async introspectToken(token: string): Promise<any> {
    const result = await this.validateToken(token);
    
    if (!result.valid) {
      return { active: false };
    }

    return {
      active: true,
      scope: result.claims?.scope,
      client_id: result.claims?.client_id,
      username: result.claims?.sub,
      exp: result.claims?.exp,
      iat: result.claims?.iat,
      sub: result.claims?.sub,
      aud: result.claims?.aud,
      iss: result.claims?.iss,
      jti: result.claims?.jti
    };
  }

  /**
   * Initialize demo tokens for testing - Security compliant
   */
  private initializeDemoTokens(): void {
    const now = Math.floor(Date.now() / 1000);
    const oneHour = 3600;

    // Security: Demo tokens with strict audience and resource binding
    this.validTokens.set('demo-admin-token-12345', {
      sub: 'admin@example.com',
      aud: [this.baseUrl], // Only this MCP server
      iss: `${this.baseUrl}/oauth`,
      exp: now + oneHour,
      iat: now,
      scope: 'mcp:admin mcp:read mcp:write',
      client_id: 'demo-client',
      resource: this.baseUrl, // Strict resource binding
      jti: 'admin-token-id'
    });

    this.validTokens.set('demo-readonly-token-67890', {
      sub: 'user@example.com',
      aud: [this.baseUrl], // Only this MCP server
      iss: `${this.baseUrl}/oauth`,
      exp: now + oneHour,
      iat: now,
      scope: 'mcp:read',
      client_id: 'demo-client',
      resource: this.baseUrl, // Strict resource binding
      jti: 'readonly-token-id'
    });

    logger.info('Security-compliant demo tokens initialized', {
      adminToken: 'demo-admin-token-12345',
      readonlyToken: 'demo-readonly-token-67890',
      audience: this.baseUrl,
      issuer: `${this.baseUrl}/oauth`
    });
  }

  /**
   * Check for suspicious token patterns
   */
  private isSuspiciousToken(claims: TokenClaims): boolean {
    // Check for overly broad audiences
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (audiences.includes('*') || audiences.length > 3) {
      return true;
    }

    // Check for suspicious scopes
    const scopes = claims.scope ? claims.scope.split(' ') : [];
    const suspiciousScopes = ['admin', 'root', 'superuser', '*'];
    if (scopes.some(scope => suspiciousScopes.includes(scope))) {
      return true;
    }

    // Check for token age (prevent replay of old tokens)
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - claims.iat;
    if (tokenAge > 86400) { // 24 hours
      return true;
    }

    return false;
  }

  /**
   * Generate demo token (for testing only) - Security compliant
   */
  generateDemoToken(subject: string, scopes: string[], clientId: string = 'demo-client'): string {
    const now = Math.floor(Date.now() / 1000);
    const token = `demo-${subject}-${Date.now()}`;

    // Security: Generate tokens with strict audience and resource binding
    const claims: TokenClaims = {
      sub: subject,
      aud: [this.baseUrl], // Only this MCP server
      iss: `${this.baseUrl}/oauth`,
      exp: now + 3600, // 1 hour
      iat: now,
      scope: scopes.join(' '),
      client_id: clientId,
      resource: this.baseUrl, // Strict resource binding
      jti: `token-${Date.now()}`
    };

    this.validTokens.set(token, claims);

    logger.info('Demo token generated', {
      subject,
      scopes,
      clientId,
      audience: claims.aud,
      resource: claims.resource
    });

    return token;
  }
}
