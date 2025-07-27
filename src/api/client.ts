/**
 * API Gateway Client
 * Simple HTTP client for communicating with Apple RAG API Gateway
 */

export interface RAGQueryParams {
  query: string;
  match_count?: number;
}

export interface RAGQueryResult {
  success: boolean;
  query: string;
  count: number;
  results: Array<{
    id: string;
    title: string;
    content: string;
    url: string;
    score: number;
    metadata?: Record<string, any>;
  }>;
  quota?: {
    current_usage: number;
    limit: number;
    remaining: number;
  };
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export class ApiGatewayClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    // Use hardcoded API Gateway URL for reliability
    this.baseUrl = baseUrl || "https://api.apple-rag.com";
  }

  /**
   * Perform RAG query against Apple Developer Documentation
   */
  async performRAGQuery(
    params: RAGQueryParams,
    apiKey: string
  ): Promise<RAGQueryResult> {
    const url = `${this.baseUrl}/api/v1/rag/query`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "User-Agent": "Apple-RAG-MCP/1.0.0",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        query: params.query,
        match_count: params.match_count || 5,
      }),
    });

    return this.handleResponse(response);
  }

  /**
   * Check API Gateway health
   */
  async healthCheck(): Promise<any> {
    const url = `${this.baseUrl}/health`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Apple-RAG-MCP/1.0.0",
        "Accept": "application/json",
      },
    });

    return this.handleResponse(response);
  }

  /**
   * Handle HTTP response and errors
   */
  private async handleResponse(response: Response): Promise<any> {
    let responseData: any;
    
    try {
      responseData = await response.json();
    } catch (error) {
      throw new Error(
        `Invalid JSON response from API Gateway (${response.status}): ${response.statusText}`
      );
    }

    if (!response.ok) {
      // Handle different error formats
      const errorMessage = this.extractErrorMessage(responseData, response);
      throw new Error(errorMessage);
    }

    return responseData;
  }

  /**
   * Extract error message from different response formats
   */
  private extractErrorMessage(data: any, response: Response): string {
    // Try different error message formats
    if (data?.error?.message) {
      return `API Gateway error (${response.status}): ${data.error.message}`;
    }
    
    if (data?.error && typeof data.error === 'string') {
      return `API Gateway error (${response.status}): ${data.error}`;
    }
    
    if (data?.message) {
      return `API Gateway error (${response.status}): ${data.message}`;
    }

    // Fallback to status text
    return `API Gateway error (${response.status}): ${response.statusText}`;
  }

  /**
   * Get base URL for debugging
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }
}
