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
  isAuthenticated: boolean,
  wasAdjusted: boolean = false
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
    response += `\n\n${"─".repeat(60)}\n\n`;
    response += `Additional Related Documentation:\n`;
    response += `The following ${ragResult.additionalUrls.length} URLs contain supplementary information that may provide additional context or related topics. This includes both Apple developer documentation and video content from WWDC sessions and tutorials. Use the \`fetch\` tool to retrieve their complete, cleaned content:\n\n`;

    ragResult.additionalUrls.forEach((item) => {
      response += `${item.url}\n`;

      // Show title for YouTube URLs
      if (item.title && item.url.startsWith("https://www.youtube.com")) {
        response += `  └─ ${item.title}\n`;
      }

      response += `  └─ ${item.characterCount} characters\n\n`;
    });
  }

  // Footer message for anonymous users
  if (!isAuthenticated) {
    response += `\n\n${APP_CONSTANTS.ANONYMOUS_ACCESS_MESSAGE}`;
  }

  // Parameter range reminder for AI agents (only when parameter was adjusted)
  if (wasAdjusted) {
    response += `\n\nNote: The result_count parameter accepts values between 1 and 10. Values outside this range are automatically adjusted to the nearest valid limit.`;
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
