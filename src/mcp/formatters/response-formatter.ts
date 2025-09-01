/**
 * Response Formatting Utilities
 * Professional response formatting for MCP protocol
 */

import type { MCPResponse, RAGResult } from "../../types/index.js";
import { APP_CONSTANTS } from "../protocol-handler.js";

/**
 * Format RAG response with professional layout
 */
export function formatRAGResponse(
  ragResult: RAGResult,
  isAuthenticated: boolean
): string {
  if (
    !ragResult ||
    !ragResult.success ||
    !ragResult.results ||
    ragResult.results.length === 0
  ) {
    return APP_CONSTANTS.NO_RESULTS_MESSAGE;
  }

  const results = ragResult.results;
  let response = "";

  // Format each result with professional styling
  results.forEach((result, index) => {
    response += `[${index + 1}] ${result.title || "Untitled"}\n`;
    response += `Source: ${result.url}\n\n`;
    response += `${result.content}\n`;

    // Separator between results
    if (index < results.length - 1) {
      response += `\n${"─".repeat(80)}\n\n`;
    }
  });

  // Additional URLs section
  if (ragResult.additionalUrls && ragResult.additionalUrls.length > 0) {
    response += `\n\n${"─".repeat(80)}\n\n`;
    response += `Additional Related Documentation:\n`;
    response += `The following ${ragResult.additionalUrls.length} URLs contain supplementary information with lower relevance scores. These may provide additional context or related topics. Use the \`fetch\` tool to retrieve their complete, cleaned content:\n\n`;

    ragResult.additionalUrls.forEach((url) => {
      response += `${url}\n\n`;
    });
  }

  // Footer message for anonymous users
  if (!isAuthenticated) {
    response += `\n\n${APP_CONSTANTS.ANONYMOUS_ACCESS_MESSAGE}`;
  }

  return response;
}

/**
 * Format fetch response with professional styling
 */
export function formatFetchResponse(
  result: { success?: boolean; title?: string; content?: string },
  isAuthenticated: boolean
): string {
  if (!result || !result.success) {
    return "Failed to retrieve content from the specified URL.";
  }

  let response = "";

  if (result.title) {
    response += `${result.title}\n\n`;
  }

  if (result.content) {
    response += result.content;
  }

  // Footer message for anonymous users
  if (!isAuthenticated) {
    response += `\n\n${APP_CONSTANTS.ANONYMOUS_ACCESS_MESSAGE}`;
  }

  return response;
}

/**
 * Create success response
 */
export function createSuccessResponse(
  requestId: string | number,
  content: string
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id: requestId,
    result: {
      content: [
        {
          type: "text",
          text: content,
        },
      ],
    },
  };
}

/**
 * Create error response
 */
export function createErrorResponse(
  requestId: string | number,
  code: number,
  message: string
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id: requestId,
    error: {
      code,
      message,
    },
  };
}
