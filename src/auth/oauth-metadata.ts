/**
 * OAuth 2.1 Protected Resource Metadata (RFC9728)
 * MCP 2025-06-18 Authorization compliant implementation
 */

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  jwks_uri?: string;
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  resource_policy_uri?: string;
  resource_tos_uri?: string;
  op_policy_uri?: string;
  op_tos_uri?: string;
  revocation_endpoint?: string;
  revocation_endpoint_auth_methods_supported?: string[];
  introspection_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: string[];
  code_challenge_methods_supported?: string[];
}

export interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported: string[];
  response_modes_supported?: string[];
  grant_types_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  revocation_endpoint?: string;
  introspection_endpoint?: string;
  code_challenge_methods_supported: string[];
  resource_parameter_supported?: boolean;
}

export class OAuthMetadataService {
  private baseUrl: string;
  private resourceMetadata: ProtectedResourceMetadata;
  private authServerMetadata: AuthorizationServerMetadata;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    
    this.resourceMetadata = {
      resource: this.baseUrl,
      authorization_servers: [`${this.baseUrl}/oauth`],
      bearer_methods_supported: ['header'],
      resource_documentation: `${this.baseUrl}/docs`,
      jwks_uri: `${this.baseUrl}/oauth/jwks`,
      revocation_endpoint: `${this.baseUrl}/oauth/revoke`,
      introspection_endpoint: `${this.baseUrl}/oauth/introspect`,
      code_challenge_methods_supported: ['S256']
    };

    this.authServerMetadata = {
      issuer: `${this.baseUrl}/oauth`,
      authorization_endpoint: `${this.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.baseUrl}/oauth/token`,
      jwks_uri: `${this.baseUrl}/oauth/jwks`,
      registration_endpoint: `${this.baseUrl}/oauth/register`,
      scopes_supported: ['mcp:read', 'mcp:write', 'mcp:admin'],
      response_types_supported: ['code'],
      response_modes_supported: ['query', 'fragment'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      revocation_endpoint: `${this.baseUrl}/oauth/revoke`,
      introspection_endpoint: `${this.baseUrl}/oauth/introspect`,
      code_challenge_methods_supported: ['S256'],
      resource_parameter_supported: true
    };
  }

  getProtectedResourceMetadata(): ProtectedResourceMetadata {
    return this.resourceMetadata;
  }

  getAuthorizationServerMetadata(): AuthorizationServerMetadata {
    return this.authServerMetadata;
  }

  getWWWAuthenticateHeader(): string {
    return `Bearer realm="mcp", resource_metadata="${this.baseUrl}/.well-known/oauth-protected-resource"`;
  }

  updateBaseUrl(newBaseUrl: string): void {
    this.baseUrl = newBaseUrl.replace(/\/$/, '');
    
    // Update all URLs in metadata
    this.resourceMetadata.resource = this.baseUrl;
    this.resourceMetadata.authorization_servers = [`${this.baseUrl}/oauth`];
    this.resourceMetadata.jwks_uri = `${this.baseUrl}/oauth/jwks`;
    this.resourceMetadata.revocation_endpoint = `${this.baseUrl}/oauth/revoke`;
    this.resourceMetadata.introspection_endpoint = `${this.baseUrl}/oauth/introspect`;
    
    this.authServerMetadata.issuer = `${this.baseUrl}/oauth`;
    this.authServerMetadata.authorization_endpoint = `${this.baseUrl}/oauth/authorize`;
    this.authServerMetadata.token_endpoint = `${this.baseUrl}/oauth/token`;
    this.authServerMetadata.jwks_uri = `${this.baseUrl}/oauth/jwks`;
    this.authServerMetadata.registration_endpoint = `${this.baseUrl}/oauth/register`;
    this.authServerMetadata.revocation_endpoint = `${this.baseUrl}/oauth/revoke`;
    this.authServerMetadata.introspection_endpoint = `${this.baseUrl}/oauth/introspect`;
  }
}
