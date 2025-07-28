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

  // Authentication and authorization handler - elegant website integration
  defaultHandler: AuthHandler,

  // OAuth 2.1 endpoints - integrated with apple-rag-website
  authorizeEndpoint: "https://apple-rag.com/oauth/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",

  // Supported OAuth scopes
  scopesSupported: ["rag.read", "rag.write", "admin"],

  // Modern OAuth 2.1 settings - global optimal configuration
  allowImplicitFlow: false,
  disallowPublicClientRegistration: false,
});
