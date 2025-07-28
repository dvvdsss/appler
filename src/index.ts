/**
 * Apple RAG MCP Server - Modern OAuth 2.1 + MCP Implementation
 * Global optimal solution with elegant, modern, and minimal code
 */

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { AppleRAGMCPServer } from "./mcp-server";
import { AuthHandler } from "./auth-handler";

export default new OAuthProvider({
  // MCP API endpoint - requires OAuth authentication
  apiRoute: "/mcp",
  apiHandler: AppleRAGMCPServer,

  // Authentication and authorization handler - unified backend architecture
  defaultHandler: AuthHandler,

  // OAuth 2.1 endpoints - optimal architecture
  authorizeEndpoint: "https://apple-rag.com/oauth/authorize", // Frontend for UI
  tokenEndpoint: "https://api.apple-rag.com/oauth/token", // Backend for tokens
  clientRegistrationEndpoint: "https://api.apple-rag.com/oauth/register",

  // Supported OAuth scopes
  scopesSupported: ["rag.read", "rag.write", "admin"],

  // Modern OAuth 2.1 settings - global optimal configuration
  allowImplicitFlow: false,
  disallowPublicClientRegistration: false,
});
