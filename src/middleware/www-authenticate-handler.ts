/**
 * RFC 9728 WWW-Authenticate Header Handler
 * Simplified version for MCP Server
 */

export interface AuthErrorDetails {
  error: string;
  error_description?: string;
  error_uri?: string;
  scope?: string;
}

/**
 * WWW-Authenticate Header Builder
 * Compliant with RFC 9728 OAuth 2.0 Protected Resource Metadata
 */
export class WWWAuthenticateHandler {
  private readonly resourceMetadataUrl: string;
  private readonly realm?: string;

  constructor(resourceMetadataUrl: string, realm?: string) {
    this.resourceMetadataUrl = resourceMetadataUrl;
    this.realm = realm;
  }

  /**
   * Create WWW-Authenticate header for 401 Unauthorized responses
   */
  createUnauthorizedHeader(error: AuthErrorDetails): string {
    const params = new Map<string, string>();
    
    // Add realm if specified
    if (this.realm) {
      params.set('realm', `"${this.realm}"`);
    }

    // Add error details
    params.set('error', `"${error.error}"`);
    
    if (error.error_description) {
      params.set('error_description', `"${error.error_description}"`);
    }

    if (error.error_uri) {
      params.set('error_uri', `"${error.error_uri}"`);
    }

    if (error.scope) {
      params.set('scope', `"${error.scope}"`);
    }

    // RFC 9728: Include resource metadata URL
    params.set('resource_metadata', `"${this.resourceMetadataUrl}"`);

    // Build header value
    const paramString = Array.from(params.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');

    return `Bearer ${paramString}`;
  }

  /**
   * Create complete error response with proper headers
   */
  createErrorResponse(
    status: 401 | 403,
    error: AuthErrorDetails,
    additionalHeaders?: Record<string, string>
  ): Response {
    const wwwAuthHeader = this.createUnauthorizedHeader(error);

    const headers = {
      'WWW-Authenticate': wwwAuthHeader,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'WWW-Authenticate',
      ...additionalHeaders,
    };

    const body = {
      error: error.error,
      error_description: error.error_description,
      error_uri: error.error_uri,
    };

    return new Response(JSON.stringify(body, null, 2), {
      status,
      headers,
    });
  }

  /**
   * Handle missing token error
   */
  handleMissingToken(): Response {
    return this.createErrorResponse(401, {
      error: 'invalid_request',
      error_description: 'Missing Authorization header with Bearer token',
    });
  }

  /**
   * Handle invalid token error
   */
  handleInvalidToken(description?: string): Response {
    return this.createErrorResponse(401, {
      error: 'invalid_token',
      error_description: description || 'The access token provided is expired, revoked, malformed, or invalid',
    });
  }

  /**
   * Handle insufficient scope error
   */
  handleInsufficientScope(requiredScope?: string): Response {
    return this.createErrorResponse(403, {
      error: 'insufficient_scope',
      error_description: 'The request requires higher privileges than provided by the access token',
      scope: requiredScope,
    });
  }

  /**
   * Handle audience mismatch error (RFC 8707)
   */
  handleAudienceMismatch(expectedResource: string, tokenResource?: string): Response {
    return this.createErrorResponse(401, {
      error: 'invalid_token',
      error_description: `Token audience mismatch: expected '${expectedResource}'${tokenResource ? `, got '${tokenResource}'` : ''}`,
    });
  }
}

/**
 * Default WWW-Authenticate handler for MCP server
 */
export const mcpWWWAuthenticateHandler = new WWWAuthenticateHandler(
  'https://mcp.apple-rag.com/.well-known/oauth-protected-resource',
  'Apple RAG MCP Server'
);

/**
 * Common authentication error responses
 */
export const AuthErrors = {
  missingToken: () => mcpWWWAuthenticateHandler.handleMissingToken(),
  invalidToken: (description?: string) => mcpWWWAuthenticateHandler.handleInvalidToken(description),
  insufficientScope: (scope?: string) => mcpWWWAuthenticateHandler.handleInsufficientScope(scope),
  audienceMismatch: (expected: string, actual?: string) => 
    mcpWWWAuthenticateHandler.handleAudienceMismatch(expected, actual),
} as const;

/**
 * Extract resource from request for audience validation
 */
export function extractResourceFromRequest(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

/**
 * Validate Bearer token format
 */
export function validateBearerTokenFormat(authHeader?: string): { valid: boolean; token?: string; error?: string } {
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Authorization header must use Bearer scheme' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { valid: false, error: 'Bearer token is empty' };
  }

  return { valid: true, token };
}
