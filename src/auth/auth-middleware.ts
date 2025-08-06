/**
 * MCP Authorization Middleware
 * MCP 2025-06-18 Authorization compliant implementation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { TokenValidator, CloudflareD1Config } from './token-validator.js';
import { OAuthMetadataService } from './oauth-metadata.js';
import { logger } from '../logger.js';

export interface AuthContext {
  isAuthenticated: boolean;
  subject?: string;
  scopes?: string[];
  clientId?: string;
  tokenClaims?: any;
}

export class AuthMiddleware {
  private tokenValidator: TokenValidator;
  private metadataService: OAuthMetadataService;

  constructor(baseUrl: string, d1Config: CloudflareD1Config) {
    this.tokenValidator = new TokenValidator(baseUrl, d1Config);
    this.metadataService = new OAuthMetadataService(baseUrl);
  }

  /**
   * Extract Bearer token from Authorization header
   */
  private extractBearerToken(authHeader?: string): string | null {
    if (!authHeader) return null;
    
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match ? match[1] : null;
  }

  /**
   * Optional authentication middleware
   * Validates token if present, allows access without token
   */
  async optionalAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthContext> {
    const authHeader = request.headers.authorization as string;
    const token = this.extractBearerToken(authHeader);

    // No token provided - allow access with no authentication
    if (!token) {
      logger.debug('No authentication token provided - allowing unauthenticated access');
      return {
        isAuthenticated: false
      };
    }

    // Token provided - validate it
    const validation = await this.tokenValidator.validateToken(token, request.url);
    
    if (!validation.valid) {
      // Security: Enhanced audit logging for failed authentication
      logger.warn('Authentication failed', {
        error: validation.error,
        tokenPrefix: token.substring(0, 8) + '...',
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        url: request.url
      });

      // Return 401 with WWW-Authenticate header
      reply.code(401)
        .header('WWW-Authenticate', this.metadataService.getWWWAuthenticateHeader())
        .send({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized',
            data: {
              error: validation.error,
              error_description: 'The provided access token is invalid or expired'
            }
          }
        });

      throw new Error('Authentication failed');
    }

    // Security: Enhanced audit logging for successful authentication
    logger.info('Authentication successful', {
      subject: validation.claims?.sub,
      scopes: validation.scopes,
      clientId: validation.claims?.client_id,
      tokenId: validation.claims?.jti,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    });

    return {
      isAuthenticated: true,
      subject: validation.claims?.sub,
      scopes: validation.scopes,
      clientId: validation.claims?.client_id,
      tokenClaims: validation.claims
    };
  }

  /**
   * Required authentication middleware
   * Requires valid token for access
   */
  async requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<AuthContext> {
    const authHeader = request.headers.authorization as string;
    const token = this.extractBearerToken(authHeader);

    if (!token) {
      logger.warn('Authentication required but no token provided');
      
      reply.code(401)
        .header('WWW-Authenticate', this.metadataService.getWWWAuthenticateHeader())
        .send({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized',
            data: {
              error: 'missing_token',
              error_description: 'Access token is required for this resource'
            }
          }
        });
      
      throw new Error('Authentication required');
    }

    const validation = await this.tokenValidator.validateToken(token, request.url);
    
    if (!validation.valid) {
      logger.warn('Authentication failed', { error: validation.error });
      
      reply.code(401)
        .header('WWW-Authenticate', this.metadataService.getWWWAuthenticateHeader())
        .send({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized',
            data: {
              error: validation.error,
              error_description: 'The provided access token is invalid or expired'
            }
          }
        });
      
      throw new Error('Authentication failed');
    }

    return {
      isAuthenticated: true,
      subject: validation.claims?.sub,
      scopes: validation.scopes,
      clientId: validation.claims?.client_id,
      tokenClaims: validation.claims
    };
  }

  /**
   * Check if authenticated user has required scope
   */
  requireScope(authContext: AuthContext, requiredScope: string, reply: FastifyReply): boolean {
    if (!authContext.isAuthenticated) {
      reply.code(401)
        .header('WWW-Authenticate', this.metadataService.getWWWAuthenticateHeader())
        .send({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Unauthorized',
            data: {
              error: 'authentication_required',
              error_description: 'Authentication is required for this operation'
            }
          }
        });
      return false;
    }

    const hasScope = this.tokenValidator.hasScope(authContext.scopes || [], requiredScope);
    
    if (!hasScope) {
      logger.warn('Insufficient scope', {
        required: requiredScope,
        available: authContext.scopes,
        subject: authContext.subject
      });
      
      reply.code(403).send({
        jsonrpc: '2.0',
        error: {
          code: -32002,
          message: 'Forbidden',
          data: {
            error: 'insufficient_scope',
            error_description: `The access token does not have the required scope: ${requiredScope}`
          }
        }
      });
      return false;
    }

    return true;
  }

  /**
   * Get OAuth metadata service
   */
  getMetadataService(): OAuthMetadataService {
    return this.metadataService;
  }

  /**
   * Get token validator
   */
  getTokenValidator(): TokenValidator {
    return this.tokenValidator;
  }
}
