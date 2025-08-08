/**
 * Modern response formatter for MCP RAG results
 * Optimized for readability and user experience
 */
import { RAGQueryResponse } from "../types/rag";

/**
 * Format RAG query response for MCP client display
 */
export function formatRAGResponse(
  result: RAGQueryResponse,
  userInfo: string,
  isAnonymous: boolean
): string {
  if (!result.success) {
    return createErrorResponse(
      result.query,
      userInfo,
      isAnonymous,
      result.error,
      result.suggestion
    );
  }

  const header = `🔍 Apple Developer Documentation Search

**Query:** "${result.query}"
**User:** ${userInfo}
**Results:** ${result.count} documents found
**Processing Time:** ${result.processing_time_ms}ms
${isAnonymous ? "\n⚠️ *Anonymous access - consider getting a token for unlimited queries*" : ""}

`;

  const results = result.results
    .map((doc, index) => {
      const similarity = `${(doc.similarity * 100).toFixed(1)}%`;
      const preview =
        doc.content.length > 200
          ? doc.content.substring(0, 200) + "..."
          : doc.content;

      return `**${index + 1}. Document**
• **Relevance:** ${similarity}
• **Source:** ${doc.url}
• **Content:** ${preview}
${doc.metadata?.title ? `• **Title:** ${doc.metadata.title}` : ""}
${doc.metadata?.section ? `• **Section:** ${doc.metadata.section}` : ""}
`;
    })
    .join("\n");

  const footer = `
✅ Search completed successfully!

💡 **Tip:** Use more specific keywords for better results.`;

  return header + results + footer;
}

/**
 * Create error response for failed queries
 */
function createErrorResponse(
  query: string,
  userInfo: string,
  isAnonymous: boolean,
  error?: string,
  suggestion?: string
): string {
  return `🔍 Apple Developer Documentation Search

**Query:** "${query}"
**User:** ${userInfo}
**Status:** Search Failed
${isAnonymous ? "\n⚠️ *Anonymous access - consider getting a token for priority access*" : ""}

❌ **Error**

${error || "An unexpected error occurred during the search."}

${
  suggestion
    ? `💡 **Suggestion**

${suggestion}`
    : ""
}

**For developers:**
This demonstrates the importance of proper error handling in RAG systems. The MCP server is functioning correctly, but the search operation encountered an issue.

⚠️ Search failed - please try again with a different query.

💡 **Tip:** Try using more general terms or check your query for typos.`;
}
