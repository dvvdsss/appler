/**
 * API Gateway Client - Modern HTTP client for proxying requests to api.apple-rag.com
 */

export interface RAGQueryRequest {
  query: string;
  match_count?: number;
}

export interface RAGQueryResponse {
  success: boolean;
  query: string;
  search_mode: "vector" | "hybrid";
  reranking_applied: boolean;
  results: Array<{
    url: string;
    content: string;
    similarity: number;
    rerank_score?: number;
    metadata?: {
      title?: string;
      section?: string;
      last_updated?: string;
    };
  }>;
  count: number;
  processing_time_ms?: number;
  error?: string;
  suggestion?: string;
}

export class ApiGatewayClient {
  private baseUrl: string;

  constructor(baseUrl: string = "https://api.apple-rag.com") {
    this.baseUrl = baseUrl;
  }

  /**
   * Get appropriate error suggestion based on status code and error code
   */
  private getErrorSuggestion(statusCode: number, errorCode?: string): string {
    switch (errorCode) {
      case "INVALID_API_KEY":
      case "MISSING_API_KEY":
        return "Please provide a valid API key to access the Apple RAG service.";
      case "QUOTA_EXCEEDED":
        return "Your monthly quota has been exceeded. Please upgrade your plan or wait for the next billing cycle.";
      case "RATE_LIMIT_EXCEEDED":
        return "You are making requests too quickly. Please slow down and try again.";
      default:
        switch (statusCode) {
          case 401:
            return "Please check your API key and ensure it's valid.";
          case 403:
            return "Your API key doesn't have permission to access this resource.";
          case 429:
            return "You have exceeded your usage limits. Please try again later.";
          case 500:
            return "The service is experiencing issues. Please try again in a few moments.";
          default:
            return "Please check your request and try again.";
        }
    }
  }

  /**
   * Perform RAG query through API Gateway
   * Endpoint: POST /mcp/query
   */
  async performRAGQuery(
    request: RAGQueryRequest,
    apiKey?: string
  ): Promise<RAGQueryResponse> {
    const url = `${this.baseUrl}/mcp/query`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Apple-RAG-MCP/1.0.0",
    };

    // Add API Key if provided
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: request.query,
          match_count: request.match_count || 5,
        }),
      });

      if (!response.ok) {
        // Handle HTTP errors
        const errorText = await response.text();
        let errorData: any;

        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        return {
          success: false,
          query: request.query,
          search_mode: "vector",
          reranking_applied: false,
          results: [],
          count: 0,
          error:
            errorData.error?.message ||
            errorData.error ||
            `HTTP ${response.status}: ${response.statusText}`,
          suggestion: this.getErrorSuggestion(
            response.status,
            errorData.error?.code
          ),
        };
      }

      const data = (await response.json()) as any;

      // Return the response from API Gateway
      return data.success ? data.data : data;
    } catch (error) {
      return {
        success: false,
        query: request.query,
        search_mode: "vector",
        reranking_applied: false,
        results: [],
        count: 0,
        error:
          error instanceof Error ? error.message : "Network error occurred",
        suggestion: "Please check your internet connection and try again.",
      };
    }
  }
}
