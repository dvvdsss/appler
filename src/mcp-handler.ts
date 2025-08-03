/**
 * Modern MCP Protocol Handler
 * High-performance request processing for VPS deployment
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AppConfig } from './types/env.js';
import { RAGService } from './services/rag-service.js';
import { SessionService } from './services/session-service.js';
import { logger } from './logger.js';

interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

interface UserContext {
  userId: string;
  username: string;
  tier: string;
  created_at: string;
  is_active: boolean;
}

export class MCPHandler {
  private ragService: RAGService;
  private sessionService: SessionService;

  constructor(config: AppConfig) {
    this.ragService = new RAGService(config);
    this.sessionService = new SessionService(config);
  }

  /**
   * Handle MCP requests
   */
  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Parse request body
      const body = request.body as MCPMessage;
      
      // Validate MCP protocol
      if (!body || body.jsonrpc !== '2.0') {
        return this.sendError(reply, 'Invalid JSON-RPC 2.0 request', -32600, startTime);
      }

      // Handle different MCP methods
      switch (body.method) {
        case 'initialize':
          return this.handleInitialize(body, reply, startTime);
        
        case 'tools/list':
          return this.handleToolsList(body, reply, startTime);
        
        case 'tools/call':
          return this.handleToolsCall(body, reply, request, startTime);
        
        default:
          return this.sendError(reply, `Unknown method: ${body.method}`, -32601, startTime);
      }
    } catch (error) {
      logger.error('MCP Handler Error:', { error: error instanceof Error ? error.message : String(error) });
      return this.sendError(reply, 'Internal server error', -32603, startTime);
    }
  }

  /**
   * Handle initialize method
   */
  private async handleInitialize(body: MCPMessage, reply: FastifyReply, startTime: number): Promise<void> {
    const response = {
      jsonrpc: '2.0' as const,
      id: body.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'Apple RAG MCP Server',
          version: '2.0.0'
        }
      }
    };

    logger.info('MCP Initialize', { 
      processingTime: Date.now() - startTime,
      protocolVersion: response.result.protocolVersion 
    });

    reply.code(200).send(response);
  }

  /**
   * Handle tools/list method
   */
  private async handleToolsList(body: MCPMessage, reply: FastifyReply, startTime: number): Promise<void> {
    const response = {
      jsonrpc: '2.0' as const,
      id: body.id,
      result: {
        tools: [
          {
            name: 'query',
            description: 'Search Apple Developer Documentation using advanced RAG technology',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for Apple Developer Documentation'
                },
                match_count: {
                  type: 'number',
                  description: 'Number of results to return (1-20)',
                  minimum: 1,
                  maximum: 20,
                  default: 5
                }
              },
              required: ['query']
            }
          }
        ]
      }
    };

    logger.info('MCP Tools List', { processingTime: Date.now() - startTime });
    reply.code(200).send(response);
  }

  /**
   * Handle tools/call method
   */
  private async handleToolsCall(body: MCPMessage, reply: FastifyReply, request: FastifyRequest, startTime: number): Promise<void> {
    try {
      // Extract tool name and arguments
      const { name, arguments: args } = body.params || {};
      
      if (name !== 'query') {
        return this.sendError(reply, `Unknown tool: ${name}`, -32602, startTime);
      }

      // Get or create session
      const session = await this.getOrCreateSession(request);
      
      // Execute RAG query
      const ragResult = await this.ragService.query({
        query: args.query,
        match_count: args.match_count || 5
      });

      // Format response
      const response = {
        jsonrpc: '2.0' as const,
        id: body.id,
        result: {
          content: [
            {
              type: 'text',
              text: this.formatRAGResponse(ragResult)
            }
          ]
        }
      };

      logger.info('MCP Tools Call Success', {
        tool: name,
        query: args.query,
        resultCount: ragResult.count,
        processingTime: Date.now() - startTime,
        sessionId: session.id
      });

      reply.code(200).send(response);
    } catch (error) {
      logger.error('Tools Call Error:', { error: error instanceof Error ? error.message : String(error) });
      return this.sendError(reply, 'Query execution failed', -32603, startTime);
    }
  }

  /**
   * Get or create user session
   */
  private async getOrCreateSession(_request: FastifyRequest): Promise<any> {
    // For demo purposes, create a default user
    const defaultUser: UserContext = {
      userId: 'demo-user',
      username: 'Demo User',
      tier: 'premium',
      created_at: new Date().toISOString(),
      is_active: true
    };

    return this.sessionService.createSession(defaultUser);
  }

  /**
   * Format RAG response for MCP
   */
  private formatRAGResponse(ragResult: any): string {
    if (!ragResult.success) {
      return `❌ Search failed: ${ragResult.error || 'Unknown error'}`;
    }

    if (ragResult.results.length === 0) {
      return '🔍 No results found for your query. Try using different keywords or broader terms.';
    }

    let response = `🔍 Apple Developer Documentation Search\n\n`;
    response += `**Query:** "${ragResult.query}"\n`;
    response += `**Results:** ${ragResult.count} found\n`;
    response += `**Search Mode:** ${ragResult.search_mode}\n\n`;

    ragResult.results.forEach((result: any, index: number) => {
      response += `### ${index + 1}. ${result.title || 'Documentation'}\n`;
      response += `**URL:** ${result.url}\n`;
      response += `**Relevance:** ${(result.similarity * 100).toFixed(1)}%\n\n`;
      response += `${result.content.substring(0, 300)}...\n\n`;
      response += `---\n\n`;
    });

    response += `⚡ *Processed in ${ragResult.processing_time_ms}ms*`;
    
    return response;
  }

  /**
   * Send error response
   */
  private sendError(reply: FastifyReply, message: string, code: number, startTime: number): void {
    const response = {
      jsonrpc: '2.0' as const,
      error: {
        code,
        message,
        data: {
          processingTime: Date.now() - startTime
        }
      }
    };

    logger.error('MCP Error Response', { code, message, processingTime: Date.now() - startTime });
    reply.code(400).send(response);
  }
}
