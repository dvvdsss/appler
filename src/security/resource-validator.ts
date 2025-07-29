/**
 * RFC 8707 Resource Indicators for OAuth 2.0 Implementation
 * Simplified version for MCP Server
 */

export interface ResourceValidationResult {
  valid: boolean;
  canonicalUri?: string;
  error?: string;
}

export interface TokenAudienceInfo {
  audience: string[];
  resource: string;
  isValid: boolean;
}

// Canonical Resource URI for this MCP server
const CANONICAL_RESOURCE_URI = "https://mcp.apple-rag.com";

/**
 * RFC 8707 Resource Parameter Validator
 * Ensures tokens are bound to their intended resources
 */
export class ResourceValidator {
  private readonly canonicalUri: string;

  constructor(canonicalUri: string = CANONICAL_RESOURCE_URI) {
    this.canonicalUri = this.normalizeResourceUri(canonicalUri);
  }

  /**
   * Validate resource parameter in authorization/token requests
   */
  validateResourceParameter(resource?: string): ResourceValidationResult {
    if (!resource) {
      return {
        valid: false,
        error: "Resource parameter is required (RFC 8707)",
      };
    }

    if (!this.isValidResourceUri(resource)) {
      return {
        valid: false,
        error: "Invalid resource parameter format",
      };
    }

    const normalizedResource = this.normalizeResourceUri(resource);
    
    // Verify resource matches this server's canonical URI
    if (normalizedResource !== this.canonicalUri) {
      return {
        valid: false,
        error: `Resource parameter '${resource}' does not match server resource '${this.canonicalUri}'`,
      };
    }

    return {
      valid: true,
      canonicalUri: this.canonicalUri,
    };
  }

  /**
   * Validate token audience against intended resource
   * Critical security function to prevent token reuse attacks
   */
  validateTokenAudience(token: any, intendedResource?: string): TokenAudienceInfo {
    const resource = intendedResource || this.canonicalUri;
    
    // Extract audience from token (JWT aud claim or similar)
    const audience = this.extractAudienceFromToken(token);
    
    const isValid = audience.includes(resource) || 
                   audience.includes(this.canonicalUri);

    return {
      audience,
      resource,
      isValid,
    };
  }

  /**
   * Get canonical resource URI for this server
   */
  getCanonicalResourceUri(): string {
    return this.canonicalUri;
  }

  /**
   * Normalize resource URI to canonical form
   */
  private normalizeResourceUri(uri: string): string {
    try {
      const url = new URL(uri);
      // Convert to lowercase scheme and host, remove trailing slash
      return `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}${url.pathname}${url.search}`;
    } catch {
      return uri;
    }
  }

  /**
   * Validate resource URI format
   */
  private isValidResourceUri(resource: string): boolean {
    try {
      const url = new URL(resource);
      // Must be absolute URI without fragment
      return !url.hash && (url.protocol === "https:" || 
        (url.protocol === "http:" && url.hostname === "localhost"));
    } catch {
      return false;
    }
  }

  /**
   * Extract audience from token
   */
  private extractAudienceFromToken(token: any): string[] {
    // Handle different token formats
    if (typeof token === 'string') {
      try {
        // Try to decode JWT
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          return Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
        }
      } catch {
        // Not a JWT, return empty audience
      }
      return [];
    }

    // Handle token object
    if (token?.aud) {
      return Array.isArray(token.aud) ? token.aud : [token.aud];
    }

    if (token?.resource) {
      return [token.resource];
    }

    return [];
  }
}

/**
 * Global resource validator instance
 */
export const resourceValidator = new ResourceValidator();

/**
 * Middleware helper for resource parameter validation
 */
export function validateResourceMiddleware(resource?: string): ResourceValidationResult {
  return resourceValidator.validateResourceParameter(resource);
}

/**
 * Security helper for token audience validation
 */
export function validateTokenAudienceMiddleware(token: any, resource?: string): TokenAudienceInfo {
  return resourceValidator.validateTokenAudience(token, resource);
}
