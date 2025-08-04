/**
 * MCP Protocol Handler - Compliant with MCP 2025-06-18
 * Implements complete lifecycle management, capability negotiation, and Authorization
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { AppConfig } from './types/env.js';
import { RAGService } from './services/rag-service.js';
import { SessionService } from './services/session-service.js';
import { AuthMiddleware, AuthContext } from './auth/auth-middleware.js';
import { logger } from './logger.js';

interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

interface InitializeParams {
  protocolVersion: string;
  capabilities: {
    roots?: { listChanged?: boolean };
    sampling?: {};
    elicitation?: {};
    experimental?: Record<string, any>;
  };
  clientInfo: {
    name: string;
    title?: string;
    version: string;
  };
}

interface UserContext {
  userId: string;
  username: string;
  tier: string;
  created_at: string;
  is_active: boolean;
}

interface SessionState {
  initialized: boolean;
  userId?: string;
  createdAt: number;
  lastActivity: number;
  connectionHealth: ConnectionHealth;
}

interface RequestState {
  id: string | number;
  method: string;
  startTime: number;
  abortController: AbortController;
  sessionId?: string;
  userId?: string;
  isCompleted: boolean;
}

interface ConnectionHealth {
  isAlive: boolean;
  lastPingTime: number;
  lastPongTime: number;
  pingCount: number;
  failedPings: number;
  averageLatency: number;
}

interface PingConfig {
  enabled: boolean;
  interval: number; // milliseconds
  timeout: number; // milliseconds
  maxFailures: number;
  enableActiveProbing: boolean;
}

interface ProgressState {
  token: string | number;
  requestId: string | number;
  sessionId?: string;
  userId?: string;
  progress: number;
  total?: number;
  message?: string;
  startTime: number;
  lastUpdate: number;
  isCompleted: boolean;
}

interface ProgressPhase {
  progress: number;
  message: string;
}

interface ProgressTemplate {
  phases: ProgressPhase[];
  total: number;
}

interface ProgressConfig {
  enabled: boolean;
  maxUpdatesPerSecond: number;
  minUpdateInterval: number; // milliseconds
  autoCleanupDelay: number; // milliseconds
  templates: Record<string, ProgressTemplate>;
}

export class MCPHandler {
  private ragService: RAGService;
  private sessionService: SessionService;
  private authMiddleware: AuthMiddleware;
  private isInitialized = false;
  private supportedProtocolVersion = '2025-06-18';
  private sessions = new Map<string, SessionState>(); // Secure session tracking with user binding
  private activeRequests = new Map<string | number, RequestState>(); // Request cancellation tracking
  private pingConfig: PingConfig;
  private pingTimers = new Map<string, NodeJS.Timeout>(); // Active ping timers per session
  private progressStates = new Map<string | number, ProgressState>(); // Progress tracking
  private progressConfig: ProgressConfig;

  constructor(config: AppConfig, baseUrl: string) {
    this.ragService = new RAGService(config);
    this.sessionService = new SessionService(config);
    this.authMiddleware = new AuthMiddleware(baseUrl);

    // Initialize ping configuration
    this.pingConfig = {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      maxFailures: 3,
      enableActiveProbing: true
    };

    // Initialize progress configuration with templates
    this.progressConfig = {
      enabled: true,
      maxUpdatesPerSecond: 10,
      minUpdateInterval: 100, // 100ms minimum between updates
      autoCleanupDelay: 30000, // 30 seconds after completion
      templates: {
        rag_query: {
          total: 100,
          phases: [
            { progress: 0, message: 'Initializing query...' },
            { progress: 10, message: 'Validating query...' },
            { progress: 20, message: 'Connecting to database...' },
            { progress: 30, message: 'Executing vector search...' },
            { progress: 80, message: 'Processing results...' },
            { progress: 100, message: 'Formatting response...' }
          ]
        },
        admin_stats: {
          total: 100,
          phases: [
            { progress: 0, message: 'Gathering server statistics...' },
            { progress: 25, message: 'Collecting server metrics...' },
            { progress: 50, message: 'Analyzing sessions...' },
            { progress: 75, message: 'Analyzing requests...' },
            { progress: 90, message: 'Analyzing progress tracking...' },
            { progress: 100, message: 'Finalizing statistics...' }
          ]
        }
      }
    };

    // Start cleanup and health check timers
    setInterval(() => this.cleanupExpiredSessions(), 300000); // 5 minutes
    setInterval(() => this.cleanupCompletedRequests(), 60000); // 1 minute
    setInterval(() => this.performHealthChecks(), 60000); // 1 minute
    setInterval(() => this.cleanupCompletedProgress(), 60000); // 1 minute
  }

  /**
   * Handle MCP requests and notifications - Streamable HTTP + Authorization compliant
   */
  async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate protocol version header
      const protocolVersion = request.headers['mcp-protocol-version'] as string;
      if (protocolVersion && protocolVersion !== this.supportedProtocolVersion) {
        return this.sendError(reply, `Unsupported protocol version: ${protocolVersion}`, -32602, startTime, {
          supported: [this.supportedProtocolVersion],
          requested: protocolVersion
        });
      }

      // Handle session management - Security: validate session exists and is not expired
      const sessionId = request.headers['mcp-session-id'] as string;
      if (sessionId) {
        const sessionState = this.sessions.get(sessionId);
        if (!sessionState || this.isSessionExpired(sessionState)) {
          if (sessionState) this.sessions.delete(sessionId); // Cleanup expired session
          return this.sendError(reply, 'Session not found or expired', -32002, startTime, {}, 404);
        }
        // Update session activity
        sessionState.lastActivity = Date.now();
      }

      // Optional authentication - validates token if present, allows access without token
      let authContext: AuthContext;
      try {
        authContext = await this.authMiddleware.optionalAuth(request, reply);
      } catch (error) {
        // Authentication failed - error response already sent by middleware
        return;
      }

      // Handle GET requests (for server info or SSE streams)
      if (request.method === 'GET') {
        const acceptHeader = request.headers.accept || '';

        // If client wants SSE, we don't support it
        if (acceptHeader.includes('text/event-stream')) {
          reply.code(405).header('Allow', 'POST, OPTIONS').send({
            error: 'SSE not supported. Use POST with application/json.'
          });
          return;
        }

        // For regular GET requests, return server information (like manifest)
        const serverInfo = {
          name: 'Apple RAG MCP Server',
          title: 'Apple Developer Documentation RAG Search',
          version: '2.0.0',
          description: 'A production-ready MCP server providing intelligent search capabilities for Apple Developer Documentation using advanced RAG technology.',
          protocolVersion: this.supportedProtocolVersion,
          capabilities: {
            tools: {
              listChanged: true
            },
            logging: {},
            experimental: {}
          },
          serverInfo: {
            name: 'Apple RAG MCP Server',
            title: 'Apple Developer Documentation RAG Search',
            version: '2.0.0'
          },
          endpoints: {
            mcp: '/',
            manifest: '/manifest',
            health: '/health',
            oauth: {
              authorize: '/oauth/authorize',
              token: '/oauth/token',
              introspect: '/oauth/introspect',
              jwks: '/oauth/jwks'
            },
            wellKnown: {
              oauthProtectedResource: '/.well-known/oauth-protected-resource',
              oauthAuthorizationServer: '/.well-known/oauth-authorization-server'
            }
          },
          transport: {
            type: 'http',
            methods: ['GET', 'POST', 'DELETE'],
            headers: {
              required: ['Content-Type'],
              optional: ['Authorization', 'MCP-Protocol-Version', 'Mcp-Session-Id']
            }
          },
          authorization: {
            enabled: true,
            type: 'oauth2.1',
            optional: true,
            scopes: ['mcp:read', 'mcp:write', 'mcp:admin']
          }
        };

        reply.code(200).send(serverInfo);
        return;
      }

      // Handle DELETE requests (session termination)
      if (request.method === 'DELETE') {
        if (!sessionId) {
          return this.sendError(reply, 'Session ID required for DELETE', -32602, startTime);
        }
        return this.handleSessionTermination(sessionId, reply, startTime);
      }

      // Handle POST requests
      if (request.method !== 'POST') {
        reply.code(405).header('Allow', 'GET, POST, DELETE, OPTIONS').send({
          error: 'Method not allowed'
        });
        return;
      }

      // Validate Accept header for POST requests
      const acceptHeader = request.headers.accept || '';
      if (!acceptHeader.includes('application/json') && !acceptHeader.includes('text/event-stream') && acceptHeader !== '*/*') {
        return this.sendError(reply, 'Accept header must include application/json or text/event-stream', -32600, startTime);
      }

      const body = request.body as MCPRequest | MCPNotification;

      // Validate JSON-RPC 2.0 format
      if (!body || body.jsonrpc !== '2.0' || !body.method) {
        return this.sendError(reply, 'Invalid JSON-RPC 2.0 request', -32600, startTime);
      }

      // Handle notifications (no response required)
      if (!('id' in body)) {
        return this.handleNotification(body as MCPNotification, reply, startTime, sessionId, authContext);
      }

      // Handle requests (response required)
      const mcpRequest = body as MCPRequest;

      // Track request for cancellation and progress support (except initialize which cannot be cancelled)
      if (mcpRequest.method !== 'initialize' && mcpRequest.id !== undefined) {
        this.trackRequest(mcpRequest, sessionId, authContext);

        // Track progress token if provided
        const progressToken = mcpRequest.params?._meta?.progressToken;
        if (progressToken && this.progressConfig.enabled) {
          this.trackProgressToken(progressToken, mcpRequest.id, sessionId, authContext);
        }
      }

      switch (mcpRequest.method) {
        case 'initialize':
          return this.handleInitialize(mcpRequest, reply, startTime, authContext);

        case 'ping':
          return this.handlePing(mcpRequest, reply, startTime, sessionId, authContext);

        case 'tools/list':
          if (!this.isSessionInitialized(sessionId, authContext)) {
            return this.sendError(reply, 'Server not initialized', -32002, startTime);
          }
          return this.handleToolsList(mcpRequest, reply, startTime, authContext);

        case 'tools/call':
          if (!this.isSessionInitialized(sessionId, authContext)) {
            return this.sendError(reply, 'Server not initialized', -32002, startTime);
          }
          return this.handleToolsCall(mcpRequest, reply, request, startTime, authContext);

        default:
          return this.sendError(reply, `Method not found: ${mcpRequest.method}`, -32601, startTime);
      }
    } catch (error) {
      logger.error('MCP Handler Error:', { error: error instanceof Error ? error.message : String(error) });
      return this.sendError(reply, 'Internal server error', -32603, startTime);
    }
  }

  /**
   * Handle notifications (no response required) - Security compliant
   */
  private async handleNotification(notification: MCPNotification, reply: FastifyReply, startTime: number, sessionId?: string, authContext?: AuthContext): Promise<void> {
    switch (notification.method) {
      case 'notifications/initialized':
        if (sessionId) {
          const sessionState = this.sessions.get(sessionId);
          if (sessionState) {
            sessionState.initialized = true;
            sessionState.lastActivity = Date.now();
            // Security: bind session to authenticated user if available
            if (authContext?.isAuthenticated) {
              sessionState.userId = authContext.subject;
            }
          }
        } else {
          this.isInitialized = true;
        }
        logger.info('MCP Client Initialized', {
          sessionId,
          userId: authContext?.subject,
          authenticated: authContext?.isAuthenticated,
          processingTime: Date.now() - startTime
        });
        break;

      case 'notifications/cancelled':
        this.handleRequestCancellation(notification.params, sessionId, authContext, startTime);
        break;

      case 'notifications/progress':
        // Progress notifications are sent by server, not received
        logger.debug('Progress notification received (unexpected)', {
          params: notification.params,
          sessionId,
          userId: authContext?.subject
        });
        break;

      default:
        logger.warn('Unknown notification', {
          method: notification.method,
          sessionId,
          userId: authContext?.subject
        });
    }

    // Notifications return 202 Accepted as per Streamable HTTP spec
    reply.code(202).send();
  }

  /**
   * Handle initialize method with session management and authorization - MCP 2025-06-18 compliant
   */
  private async handleInitialize(request: MCPRequest, reply: FastifyReply, startTime: number, authContext: AuthContext): Promise<void> {
    const params = request.params as InitializeParams;

    // Validate protocol version
    if (params.protocolVersion !== this.supportedProtocolVersion) {
      return this.sendError(reply, 'Unsupported protocol version', -32602, startTime, {
        supported: [this.supportedProtocolVersion],
        requested: params.protocolVersion
      });
    }

    // Generate secure session ID for Streamable HTTP
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    // Security: create session state with user binding and connection health
    const sessionState: SessionState = {
      initialized: true, // Set to true after successful initialization
      userId: authContext.isAuthenticated ? authContext.subject : undefined,
      createdAt: now,
      lastActivity: now,
      connectionHealth: {
        isAlive: true,
        lastPingTime: 0,
        lastPongTime: now,
        pingCount: 0,
        failedPings: 0,
        averageLatency: 0
      }
    };

    this.sessions.set(sessionId, sessionState);

    // Start active ping monitoring if enabled
    if (this.pingConfig.enabled && this.pingConfig.enableActiveProbing) {
      this.startPingMonitoring(sessionId);
    }

    const response: MCPResponse = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: this.supportedProtocolVersion,
        capabilities: {
          tools: {
            listChanged: true
          },
          logging: {},
          experimental: {}
        },
        serverInfo: {
          name: 'Apple RAG MCP Server',
          title: 'Apple Developer Documentation RAG Search',
          version: '2.0.0'
        },
        instructions: authContext.isAuthenticated
          ? `Authenticated as ${authContext.subject}. Use the "query" tool to search Apple Developer Documentation with advanced RAG technology.`
          : 'Use the "query" tool to search Apple Developer Documentation with advanced RAG technology. Authentication is optional but provides enhanced features.'
      }
    };

    logger.info('MCP Initialize', {
      clientInfo: params.clientInfo,
      protocolVersion: params.protocolVersion,
      sessionId,
      authenticated: authContext.isAuthenticated,
      subject: authContext.subject,
      scopes: authContext.scopes,
      processingTime: Date.now() - startTime
    });

    // Set session ID header as per Streamable HTTP spec
    reply.header('Mcp-Session-Id', sessionId);
    reply.code(200).send(response);
  }

  /**
   * Handle tools/list method with authorization context and cancellation support
   */
  private async handleToolsList(request: MCPRequest, reply: FastifyReply, startTime: number, authContext: AuthContext): Promise<void> {
    try {
      // Check if request was cancelled before processing
      if (request.id !== undefined && this.isRequestCancelled(request.id)) {
        logger.debug('Request cancelled before tools/list processing', { requestId: request.id });
        return; // Don't send response for cancelled requests
      }

      const tools: any[] = [
        {
          name: 'query',
          description: 'Search Apple Developer Documentation using advanced RAG technology with semantic understanding',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query for Apple Developer Documentation. Use natural language for best results.'
              },
              match_count: {
                type: 'number',
                description: 'Number of results to return (1-20)',
                minimum: 1,
                maximum: 20,
                default: 5
              }
            },
            required: ['query'],
            additionalProperties: false
          }
        }
      ];

      // Add admin-only tools for authenticated users with admin scope
      if (authContext.isAuthenticated && authContext.scopes?.includes('mcp:admin')) {
        tools.push({
          name: 'admin_stats',
          description: 'Get server statistics and usage metrics (admin only)',
          inputSchema: {
            type: 'object',
            properties: {
              detailed: {
                type: 'boolean',
                description: 'Include detailed statistics',
                default: false
              }
            },
            additionalProperties: false
          }
        });
      }

      // Final cancellation check before sending response
      if (request.id !== undefined && this.isRequestCancelled(request.id)) {
        logger.debug('Request cancelled before tools/list response', { requestId: request.id });
        return;
      }

      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools }
      };

      logger.info('MCP Tools List', {
        toolCount: tools.length,
        authenticated: authContext.isAuthenticated,
        subject: authContext.subject,
        processingTime: Date.now() - startTime
      });

      reply.code(200).send(response);

      // Mark request as completed
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
    } catch (error) {
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
      throw error;
    }
  }

  /**
   * Handle tools/call method with authorization context
   */
  private async handleToolsCall(request: MCPRequest, reply: FastifyReply, httpRequest: FastifyRequest, startTime: number, authContext: AuthContext): Promise<void> {
    try {
      const { name, arguments: args } = request.params || {};

      // Handle different tools based on authentication and authorization
      switch (name) {
        case 'query':
          return this.handleQueryTool(request, reply, httpRequest, startTime, authContext, args);

        case 'admin_stats':
          // Admin-only tool - require authentication and admin scope
          if (!authContext.isAuthenticated) {
            return this.sendError(reply, 'Authentication required for admin tools', -32001, startTime);
          }
          if (!this.authMiddleware.requireScope(authContext, 'mcp:admin', reply)) {
            return; // Error response already sent by requireScope
          }
          return this.handleAdminStatsTool(request, reply, startTime, authContext);

        default:
          return this.sendError(reply, `Unknown tool: ${name}`, -32602, startTime);
      }
    } catch (error) {
      logger.error('Tools Call Error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      return this.sendError(reply, 'Tool execution failed', -32603, startTime);
    }
  }

  /**
   * Handle query tool - available to all users with cancellation support
   */
  private async handleQueryTool(request: MCPRequest, reply: FastifyReply, httpRequest: FastifyRequest, startTime: number, authContext: AuthContext, args: any): Promise<void> {
    try {
      // Validate arguments
      if (!args || typeof args.query !== 'string' || args.query.trim().length === 0) {
        return this.sendError(reply, 'Invalid query parameter', -32602, startTime);
      }

      // Check if request was cancelled before processing
      if (request.id !== undefined && this.isRequestCancelled(request.id)) {
        logger.debug('Request cancelled before query processing', { requestId: request.id });
        return;
      }

      const matchCount = Math.min(Math.max(args.match_count || 5, 1), 20);

      // Get or create session
      const session = await this.getOrCreateSession(httpRequest);

      // Get abort signal for cancellation support
      const abortSignal = request.id !== undefined ? this.getRequestAbortSignal(request.id) : undefined;

      // Check for progress token
      const progressToken = request.params?._meta?.progressToken;

      // Execute RAG query with progress tracking, timeout and cancellation support
      const ragResult = await Promise.race([
        this.executeWithProgress('rag_query', progressToken, async () => {
          return this.ragService.query({
            query: args.query.trim(),
            match_count: matchCount
          });
        }),
        new Promise((_, reject) => {
          const timeout = setTimeout(() => reject(new Error('Query timeout')), 30000);

          // Handle cancellation
          if (abortSignal) {
            abortSignal.addEventListener('abort', () => {
              clearTimeout(timeout);
              reject(new Error('Query cancelled'));
            });
          }
        })
      ]) as any;

      // Final cancellation check before sending response
      if (request.id !== undefined && this.isRequestCancelled(request.id)) {
        logger.debug('Request cancelled before query response', { requestId: request.id });
        return;
      }

      // Enhanced response for authenticated users
      const responseText = authContext.isAuthenticated
        ? `[Authenticated as ${authContext.subject}]\n\n${this.formatRAGResponse(ragResult)}`
        : this.formatRAGResponse(ragResult);

      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: responseText
            }
          ]
        }
      };

      logger.info('Query Tool Success', {
        query: args.query,
        resultCount: ragResult?.count || 0,
        authenticated: authContext.isAuthenticated,
        subject: authContext.subject,
        processingTime: Date.now() - startTime,
        sessionId: session.id
      });

      reply.code(200).send(response);

      // Mark request as completed
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
    } catch (error) {
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }

      // Handle cancellation gracefully
      if (error instanceof Error && error.message === 'Query cancelled') {
        logger.info('Query cancelled by user', {
          requestId: request.id,
          query: args?.query,
          processingTime: Date.now() - startTime
        });
        return; // Don't send error response for cancelled requests
      }

      throw error;
    }
  }

  /**
   * Handle admin stats tool - admin only with cancellation support
   */
  private async handleAdminStatsTool(request: MCPRequest, reply: FastifyReply, startTime: number, authContext: AuthContext): Promise<void> {
    try {
      // Check if request was cancelled before processing
      if (request.id !== undefined && this.isRequestCancelled(request.id)) {
        logger.debug('Request cancelled before admin stats processing', { requestId: request.id });
        return;
      }

      // Check for progress token
      const progressToken = request.params?._meta?.progressToken;

      // Execute admin stats with progress tracking
      const stats = await this.executeWithProgress('admin_stats', progressToken, async () => {
        // Collect all statistics
        const serverStats = {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: '2.0.0',
          protocol: this.supportedProtocolVersion
        };

        const sessionStats = {
          total: this.sessions.size,
          active: Array.from(this.sessions.values()).filter(s => s.initialized).length
        };

        const requestStats = {
          active: this.activeRequests.size,
          tracked: Array.from(this.activeRequests.values()).filter(r => !r.isCompleted).length
        };

        const progressStats = {
          active: this.progressStates.size,
          completed: Array.from(this.progressStates.values()).filter(p => p.isCompleted).length
        };

        return {
          server: serverStats,
          sessions: sessionStats,
          requests: requestStats,
          progress: progressStats,
          authentication: {
            enabled: true,
            currentUser: authContext.subject,
            scopes: authContext.scopes
          }
        };
      });

      // Final cancellation check before sending response
      if (request.id !== undefined && this.isRequestCancelled(request.id)) {
        logger.debug('Request cancelled before admin stats response', { requestId: request.id });
        return;
      }

      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Server Statistics:\n\n${JSON.stringify(stats, null, 2)}`
            }
          ]
        }
      };

      logger.info('Admin Stats Tool Success', {
        admin: authContext.subject,
        processingTime: Date.now() - startTime
      });

      reply.code(200).send(response);

      // Mark request as completed
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
    } catch (error) {
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
      throw error;
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
   * Handle ping request - MCP Ping specification compliant
   */
  private async handlePing(request: MCPRequest, reply: FastifyReply, startTime: number, sessionId?: string, authContext?: AuthContext): Promise<void> {
    try {
      // Update connection health if session exists
      if (sessionId) {
        const sessionState = this.sessions.get(sessionId);
        if (sessionState) {
          const now = Date.now();
          const latency = now - startTime;

          // Update connection health metrics
          sessionState.connectionHealth.lastPongTime = now;
          sessionState.connectionHealth.pingCount++;
          sessionState.connectionHealth.isAlive = true;
          sessionState.lastActivity = now;

          // Update average latency (exponential moving average)
          if (sessionState.connectionHealth.averageLatency === 0) {
            sessionState.connectionHealth.averageLatency = latency;
          } else {
            sessionState.connectionHealth.averageLatency =
              (sessionState.connectionHealth.averageLatency * 0.8) + (latency * 0.2);
          }

          // Reset failed ping count on successful response
          sessionState.connectionHealth.failedPings = 0;
        }
      }

      // MCP Ping specification: respond with empty result
      const response: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: {}
      };

      logger.debug('Ping request handled', {
        requestId: request.id,
        sessionId,
        userId: authContext?.subject,
        latency: Date.now() - startTime,
        processingTime: Date.now() - startTime
      });

      reply.code(200).send(response);

      // Mark request as completed
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
    } catch (error) {
      if (request.id !== undefined) {
        this.completeRequest(request.id);
      }
      throw error;
    }
  }

  /**
   * Handle session termination - Security compliant
   */
  private async handleSessionTermination(sessionId: string, reply: FastifyReply, startTime: number): Promise<void> {
    const sessionState = this.sessions.get(sessionId);

    if (sessionState) {
      // Stop ping monitoring
      this.stopPingMonitoring(sessionId);

      this.sessions.delete(sessionId);
      logger.info('Session terminated', {
        sessionId,
        userId: sessionState.userId,
        connectionHealth: sessionState.connectionHealth,
        processingTime: Date.now() - startTime
      });
      reply.code(200).send({ message: 'Session terminated successfully' });
    } else {
      return this.sendError(reply, 'Session not found', -32002, startTime, {}, 404);
    }
  }

  /**
   * Check if session is initialized - Security: validate user binding
   */
  private isSessionInitialized(sessionId?: string, authContext?: AuthContext): boolean {
    if (sessionId) {
      const sessionState = this.sessions.get(sessionId);
      if (!sessionState || this.isSessionExpired(sessionState)) {
        return false;
      }

      // Security: if session has user binding, verify it matches current auth context
      if (sessionState.userId && authContext?.isAuthenticated) {
        if (sessionState.userId !== authContext.subject) {
          logger.warn('Session user mismatch detected', {
            sessionId,
            sessionUser: sessionState.userId,
            authUser: authContext.subject
          });
          return false;
        }
      }

      return sessionState.initialized;
    }
    return this.isInitialized;
  }

  /**
   * Check if session is expired
   */
  private isSessionExpired(sessionState: SessionState): boolean {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const maxInactivity = 2 * 60 * 60 * 1000; // 2 hours

    return (now - sessionState.createdAt > maxAge) ||
           (now - sessionState.lastActivity > maxInactivity);
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    let cleanedCount = 0;

    for (const [sessionId, sessionState] of this.sessions.entries()) {
      if (this.isSessionExpired(sessionState)) {
        // Stop ping monitoring before deleting session
        this.stopPingMonitoring(sessionId);
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired sessions', {
        cleanedCount,
        remainingSessions: this.sessions.size,
        activePingMonitors: this.pingTimers.size
      });
    }
  }

  /**
   * Track request for cancellation support
   */
  private trackRequest(request: MCPRequest, sessionId?: string, authContext?: AuthContext): void {
    if (request.id === undefined) return;

    const requestState: RequestState = {
      id: request.id,
      method: request.method,
      startTime: Date.now(),
      abortController: new AbortController(),
      sessionId,
      userId: authContext?.subject,
      isCompleted: false
    };

    this.activeRequests.set(request.id, requestState);

    logger.debug('Request tracked for cancellation', {
      requestId: request.id,
      method: request.method,
      sessionId,
      userId: authContext?.subject
    });
  }

  /**
   * Handle request cancellation notification
   */
  private handleRequestCancellation(params: any, sessionId?: string, authContext?: AuthContext, startTime?: number): void {
    const requestId = params?.requestId;
    const reason = params?.reason;

    if (!requestId) {
      logger.warn('Cancellation notification missing requestId', { sessionId, userId: authContext?.subject });
      return;
    }

    const requestState = this.activeRequests.get(requestId);

    if (!requestState) {
      // Request not found - may have already completed or never existed
      logger.debug('Cancellation for unknown/completed request', {
        requestId,
        reason,
        sessionId,
        userId: authContext?.subject
      });
      return;
    }

    // Security: Verify cancellation is from the same session/user
    if (sessionId && requestState.sessionId && requestState.sessionId !== sessionId) {
      logger.warn('Cancellation attempt from different session', {
        requestId,
        requestSession: requestState.sessionId,
        cancelSession: sessionId,
        userId: authContext?.subject
      });
      return;
    }

    if (authContext?.subject && requestState.userId && requestState.userId !== authContext.subject) {
      logger.warn('Cancellation attempt from different user', {
        requestId,
        requestUser: requestState.userId,
        cancelUser: authContext.subject,
        sessionId
      });
      return;
    }

    // Perform actual cancellation
    requestState.abortController.abort();
    requestState.isCompleted = true;

    logger.info('Request cancelled successfully', {
      requestId,
      method: requestState.method,
      reason,
      sessionId,
      userId: authContext?.subject,
      requestAge: Date.now() - requestState.startTime,
      processingTime: startTime ? Date.now() - startTime : undefined
    });

    // Clean up immediately
    this.activeRequests.delete(requestId);
  }

  /**
   * Mark request as completed (prevents cancellation)
   */
  private completeRequest(requestId: string | number): void {
    const requestState = this.activeRequests.get(requestId);
    if (requestState) {
      requestState.isCompleted = true;
      // Keep for a short time to handle race conditions
      setTimeout(() => {
        this.activeRequests.delete(requestId);
      }, 5000); // 5 seconds grace period
    }
  }

  /**
   * Check if request was cancelled
   */
  private isRequestCancelled(requestId: string | number): boolean {
    const requestState = this.activeRequests.get(requestId);
    return requestState?.abortController.signal.aborted || false;
  }

  /**
   * Get abort signal for request
   */
  private getRequestAbortSignal(requestId: string | number): AbortSignal | undefined {
    return this.activeRequests.get(requestId)?.abortController.signal;
  }

  /**
   * Cleanup completed requests
   */
  private cleanupCompletedRequests(): void {
    let cleanedCount = 0;
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [requestId, requestState] of this.activeRequests.entries()) {
      if (requestState.isCompleted || (now - requestState.startTime > maxAge)) {
        this.activeRequests.delete(requestId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up completed/expired requests', { cleanedCount });
    }
  }

  /**
   * Start ping monitoring for a session
   */
  private startPingMonitoring(sessionId: string): void {
    if (this.pingTimers.has(sessionId)) {
      return; // Already monitoring
    }

    const timer = setInterval(() => {
      this.sendPingToSession(sessionId);
    }, this.pingConfig.interval);

    this.pingTimers.set(sessionId, timer);

    logger.debug('Started ping monitoring', {
      sessionId,
      interval: this.pingConfig.interval
    });
  }

  /**
   * Stop ping monitoring for a session
   */
  private stopPingMonitoring(sessionId: string): void {
    const timer = this.pingTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.pingTimers.delete(sessionId);

      logger.debug('Stopped ping monitoring', { sessionId });
    }
  }

  /**
   * Send ping to a specific session (server-initiated)
   */
  private async sendPingToSession(sessionId: string): Promise<void> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      this.stopPingMonitoring(sessionId);
      return;
    }

    const now = Date.now();
    sessionState.connectionHealth.lastPingTime = now;

    // Note: In a real implementation, this would send a ping request to the client
    // For HTTP-based MCP, this is conceptual as the server doesn't initiate requests
    // This method serves as a placeholder for WebSocket or other bidirectional transports

    logger.debug('Ping monitoring check', {
      sessionId,
      connectionHealth: sessionState.connectionHealth,
      timeSinceLastActivity: now - sessionState.lastActivity
    });

    // Check if session has been inactive for too long
    const inactiveTime = now - sessionState.lastActivity;
    if (inactiveTime > this.pingConfig.timeout * 3) {
      sessionState.connectionHealth.isAlive = false;
      sessionState.connectionHealth.failedPings++;

      logger.warn('Session appears inactive', {
        sessionId,
        inactiveTime,
        failedPings: sessionState.connectionHealth.failedPings
      });

      // Terminate session if too many failures
      if (sessionState.connectionHealth.failedPings >= this.pingConfig.maxFailures) {
        logger.info('Terminating inactive session', {
          sessionId,
          failedPings: sessionState.connectionHealth.failedPings
        });

        this.stopPingMonitoring(sessionId);
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Perform health checks on all sessions
   */
  private performHealthChecks(): void {
    const now = Date.now();
    let healthySessions = 0;
    let unhealthySessions = 0;

    for (const [sessionId, sessionState] of this.sessions.entries()) {
      const timeSinceLastActivity = now - sessionState.lastActivity;
      const isHealthy = sessionState.connectionHealth.isAlive &&
                       timeSinceLastActivity < (this.pingConfig.timeout * 2);

      if (isHealthy) {
        healthySessions++;
      } else {
        unhealthySessions++;

        // Mark as unhealthy
        sessionState.connectionHealth.isAlive = false;

        logger.debug('Unhealthy session detected', {
          sessionId,
          timeSinceLastActivity,
          connectionHealth: sessionState.connectionHealth
        });
      }
    }

    if (healthySessions > 0 || unhealthySessions > 0) {
      logger.debug('Health check completed', {
        totalSessions: this.sessions.size,
        healthySessions,
        unhealthySessions,
        activePingMonitors: this.pingTimers.size
      });
    }
  }

  /**
   * Get ping configuration
   */
  public getPingConfig(): PingConfig {
    return { ...this.pingConfig };
  }

  /**
   * Update ping configuration
   */
  public updatePingConfig(config: Partial<PingConfig>): void {
    this.pingConfig = { ...this.pingConfig, ...config };

    logger.info('Ping configuration updated', {
      newConfig: this.pingConfig
    });
  }

  /**
   * Track progress token for a request
   */
  private trackProgressToken(token: string | number, requestId: string | number, sessionId?: string, authContext?: AuthContext): void {
    if (this.progressStates.has(token)) {
      logger.warn('Progress token already exists', { token, requestId });
      return;
    }

    const now = Date.now();
    const progressState: ProgressState = {
      token,
      requestId,
      sessionId,
      userId: authContext?.subject,
      progress: 0,
      startTime: now,
      lastUpdate: now,
      isCompleted: false
    };

    this.progressStates.set(token, progressState);

    logger.debug('Progress token tracked', {
      token,
      requestId,
      sessionId,
      userId: authContext?.subject
    });
  }

  /**
   * Send progress notification
   */
  private async sendProgressNotification(token: string | number, progress: number, total?: number, message?: string): Promise<void> {
    const progressState = this.progressStates.get(token);
    if (!progressState) {
      logger.warn('Progress notification for unknown token', { token });
      return;
    }

    const now = Date.now();

    // Rate limiting: check minimum interval
    if (now - progressState.lastUpdate < this.progressConfig.minUpdateInterval) {
      return; // Skip this update due to rate limiting
    }

    // Validate progress value (must be monotonically increasing)
    if (progress < progressState.progress) {
      logger.warn('Progress value decreased, ignoring', {
        token,
        currentProgress: progressState.progress,
        newProgress: progress
      });
      return;
    }

    // Update progress state
    progressState.progress = progress;
    progressState.total = total;
    progressState.message = message;
    progressState.lastUpdate = now;

    logger.debug('Progress notification sent', {
      token,
      progress,
      total,
      message,
      sessionId: progressState.sessionId,
      notification: {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: {
          progressToken: token,
          progress,
          ...(total !== undefined && { total }),
          ...(message && { message })
        }
      }
    });

    // Note: In HTTP-based MCP, progress notifications would be sent via SSE or WebSocket
    // For this implementation, we log the notification that would be sent
    // In a real bidirectional transport, this would actually send the notification
  }

  /**
   * Execute operation with template-based progress tracking
   */
  private async executeWithProgress<T>(
    templateName: string,
    progressToken: string | number | undefined,
    operation: (phaseIndex: number) => Promise<T>
  ): Promise<T> {
    if (!progressToken || !this.progressConfig.enabled) {
      return operation(-1); // Execute without progress tracking
    }

    const template = this.progressConfig.templates[templateName];
    if (!template) {
      logger.warn('Progress template not found', { templateName });
      return operation(-1);
    }

    try {
      let result: T;

      for (let i = 0; i < template.phases.length; i++) {
        const phase = template.phases[i];

        // Send progress notification
        await this.sendProgressNotification(
          progressToken,
          phase.progress,
          template.total,
          phase.message
        );

        // Execute operation at this phase
        if (i === template.phases.length - 1) {
          // Last phase - execute the main operation
          result = await operation(i);
        } else if (i === 0) {
          // First phase - just initialize
          continue;
        } else {
          // Intermediate phases - add small delay for realistic progress
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Complete progress tracking
      this.completeProgress(progressToken);
      return result!;

    } catch (error) {
      // Complete progress on error
      this.completeProgress(progressToken);
      throw error;
    }
  }

  /**
   * Complete progress tracking
   */
  private completeProgress(token: string | number): void {
    const progressState = this.progressStates.get(token);
    if (progressState) {
      progressState.isCompleted = true;

      // Send final progress notification if total was known
      if (progressState.total !== undefined) {
        this.sendProgressNotification(token, progressState.total, progressState.total, 'Completed');
      }

      // Schedule cleanup
      setTimeout(() => {
        this.progressStates.delete(token);
      }, this.progressConfig.autoCleanupDelay);

      logger.debug('Progress completed', {
        token,
        finalProgress: progressState.progress,
        total: progressState.total
      });
    }
  }



  /**
   * Cleanup completed progress states
   */
  private cleanupCompletedProgress(): void {
    let cleanedCount = 0;
    const now = Date.now();
    const maxAge = 300000; // 5 minutes

    for (const [token, progressState] of this.progressStates.entries()) {
      if (progressState.isCompleted || (now - progressState.startTime > maxAge)) {
        this.progressStates.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up completed/expired progress states', { cleanedCount });
    }
  }

  /**
   * Get progress configuration
   */
  public getProgressConfig(): ProgressConfig {
    return { ...this.progressConfig };
  }

  /**
   * Update progress configuration
   */
  public updateProgressConfig(config: Partial<ProgressConfig>): void {
    // Deep merge templates if provided
    if (config.templates) {
      this.progressConfig.templates = { ...this.progressConfig.templates, ...config.templates };
      delete config.templates; // Remove from shallow merge
    }

    this.progressConfig = { ...this.progressConfig, ...config };

    logger.info('Progress configuration updated', {
      templateCount: Object.keys(this.progressConfig.templates).length,
      enabled: this.progressConfig.enabled
    });
  }

  /**
   * Add or update a progress template
   */
  public setProgressTemplate(name: string, template: ProgressTemplate): void {
    this.progressConfig.templates[name] = template;

    logger.debug('Progress template updated', {
      templateName: name,
      phaseCount: template.phases.length,
      total: template.total
    });
  }

  /**
   * Send error response according to MCP specification
   */
  private sendError(reply: FastifyReply, message: string, code: number, startTime: number, data?: any, httpStatus?: number): void {
    const response: MCPResponse = {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        data: {
          processingTime: Date.now() - startTime,
          ...data
        }
      }
    };

    // Use provided HTTP status or map from error code
    const status = httpStatus || this.getHttpStatusFromErrorCode(code);

    logger.error('MCP Error Response', {
      code,
      message,
      httpStatus: status,
      processingTime: Date.now() - startTime,
      data
    });

    reply.code(status).send(response);
  }

  /**
   * Get auth middleware for OAuth endpoints
   */
  getAuthMiddleware(): AuthMiddleware {
    return this.authMiddleware;
  }

  /**
   * Map JSON-RPC error codes to HTTP status codes
   */
  private getHttpStatusFromErrorCode(code: number): number {
    switch (code) {
      case -32600: // Invalid Request
      case -32601: // Method not found
      case -32602: // Invalid params
        return 400;
      case -32603: // Internal error
        return 500;
      case -32002: // Server not initialized
        return 503;
      default:
        return 400;
    }
  }
}
