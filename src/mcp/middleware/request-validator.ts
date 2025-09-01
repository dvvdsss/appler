/**
 * Request Validation Middleware
 * Validates MCP protocol requests and parameters
 */

import type { MCPNotification, MCPRequest } from "../../types/index.js";
import {
  MCP_ERROR_CODES,
  SUPPORTED_MCP_VERSIONS,
} from "../protocol-handler.js";

/**
 * Validate MCP request structure
 */
export function isValidMCPRequest(body: unknown): body is MCPRequest {
  return (
    body != null &&
    typeof body === "object" &&
    "jsonrpc" in body &&
    (body as Record<string, unknown>).jsonrpc === "2.0" &&
    "id" in body &&
    "method" in body &&
    typeof (body as Record<string, unknown>).method === "string"
  );
}

/**
 * Validate MCP notification structure
 */
export function isValidMCPNotification(body: unknown): body is MCPNotification {
  return (
    body != null &&
    typeof body === "object" &&
    "jsonrpc" in body &&
    (body as Record<string, unknown>).jsonrpc === "2.0" &&
    "method" in body &&
    typeof (body as Record<string, unknown>).method === "string" &&
    !("id" in body)
  );
}

/**
 * Validate protocol version
 */
export function validateProtocolVersion(version?: string): {
  isValid: boolean;
  error?: { code: number; message: string };
} {
  if (
    version &&
    !SUPPORTED_MCP_VERSIONS.includes(
      version as (typeof SUPPORTED_MCP_VERSIONS)[number]
    )
  ) {
    return {
      isValid: false,
      error: {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: `Unsupported protocol version: ${version}. Supported versions: ${SUPPORTED_MCP_VERSIONS.join(", ")}`,
      },
    };
  }

  return { isValid: true };
}

/**
 * Validate initialize parameters
 */
export function validateInitializeParams(params: unknown): {
  isValid: boolean;
  error?: { code: number; message: string };
} {
  // Basic validation - can be extended
  if (params && typeof params !== "object") {
    return {
      isValid: false,
      error: {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: "Initialize parameters must be an object",
      },
    };
  }

  return { isValid: true };
}

/**
 * Validate tool call parameters
 */
export function validateToolCallParams(params: unknown): {
  isValid: boolean;
  toolCall?: { name: string; arguments?: Record<string, unknown> };
  error?: { code: number; message: string };
} {
  if (!params || typeof params !== "object") {
    return {
      isValid: false,
      error: {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: "Tool call parameters are required",
      },
    };
  }

  const p = params as Record<string, unknown>;

  if (!p.name || typeof p.name !== "string") {
    return {
      isValid: false,
      error: {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: "Tool name is required and must be a string",
      },
    };
  }

  if (!p.arguments || typeof p.arguments !== "object") {
    return {
      isValid: false,
      error: {
        code: MCP_ERROR_CODES.INVALID_PARAMS,
        message: "Tool arguments are required and must be an object",
      },
    };
  }

  return {
    isValid: true,
    toolCall: {
      name: p.name,
      arguments: p.arguments as Record<string, unknown>,
    },
  };
}
