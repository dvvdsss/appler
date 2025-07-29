/**
 * Apple RAG MCP Agent - Cloudflare Workers OAuth Provider compliant
 * Implements McpAgent interface for proper authentication context handling
 */

import { McpAgent } from "@cloudflare/workers-oauth-provider";

interface AuthContext {
  userId: string;
  username: string;
  permissions: string[];
  claims: Record<string, any>;
}

interface Env {
  DB: D1Database;
  OAUTH_PROVIDER: any;
}

export class AppleRAGMCPAgent extends McpAgent<Env, unknown, AuthContext> {
  /**
   * Initialize MCP server with tools and permission-based access control
   */
  async init() {
    // Basic user information tool - available to all authenticated users
    this.server.tool("userInfo", "Get current user information", {}, async () => ({
      content: [{ 
        type: "text", 
        text: `Hello, ${this.props.claims.name || this.props.username || "user"}! User ID: ${this.props.userId}` 
      }],
    }));

    // RAG search tool with read permission requirement
    this.server.tool(
      "ragSearch",
      "Search Apple Developer Documentation using RAG",
      {
        query: { type: "string", description: "Search query for Apple documentation" },
        limit: { type: "number", description: "Maximum number of results", default: 10 },
        includeCode: { type: "boolean", description: "Include code examples", default: true }
      },
      this.requirePermission("rag.read", async (params) => {
        const { query, limit = 10, includeCode = true } = params;
        
        try {
          // Perform RAG search using the authenticated user's context
          const results = await this.performRAGSearch(query, limit, includeCode);
          
          return {
            content: [{
              type: "text",
              text: `Found ${results.length} results for "${query}":\n\n${results.map(r => 
                `• ${r.title}\n  ${r.summary}\n  Source: ${r.url}`
              ).join('\n\n')}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Search failed: ${error.message}`
            }],
            isError: true
          };
        }
      })
    );

    // Document update tool - requires write permission
    if (this.props.permissions?.includes("rag.write")) {
      this.server.tool(
        "updateDocumentation",
        "Update or add documentation content",
        {
          title: { type: "string", description: "Document title" },
          content: { type: "string", description: "Document content in markdown" },
          category: { type: "string", description: "Document category" }
        },
        async (params) => {
          const { title, content, category } = params;
          
          try {
            await this.updateDocumentation(title, content, category);
            
            return {
              content: [{
                type: "text",
                text: `Documentation "${title}" updated successfully in category "${category}"`
              }]
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Update failed: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );
    }

    // Admin tools - only for users with admin permission
    if (this.props.permissions?.includes("admin")) {
      this.server.tool(
        "adminStats",
        "Get server statistics and usage metrics",
        {},
        async () => {
          try {
            const stats = await this.getServerStats();
            
            return {
              content: [{
                type: "text",
                text: `Server Statistics:
• Active Users: ${stats.activeUsers}
• Total Searches: ${stats.totalSearches}
• Documents: ${stats.documentCount}
• API Calls Today: ${stats.apiCallsToday}
• System Health: ${stats.systemHealth}`
              }]
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Failed to retrieve stats: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );

      this.server.tool(
        "manageUsers",
        "Manage user permissions and access",
        {
          action: { type: "string", description: "Action: list, grant, revoke" },
          userId: { type: "string", description: "Target user ID", optional: true },
          permission: { type: "string", description: "Permission to grant/revoke", optional: true }
        },
        async (params) => {
          const { action, userId, permission } = params;
          
          try {
            const result = await this.manageUserPermissions(action, userId, permission);
            
            return {
              content: [{
                type: "text",
                text: result.message
              }]
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `User management failed: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );
    }

    // Special feature tools - conditionally registered based on permissions
    if (this.props.permissions?.includes("image_generation")) {
      this.server.tool(
        "generateDiagram",
        "Generate technical diagrams and visualizations",
        {
          type: { type: "string", description: "Diagram type: flowchart, sequence, class" },
          description: { type: "string", description: "Diagram description" }
        },
        async (params) => {
          const { type, description } = params;
          
          try {
            const diagramUrl = await this.generateDiagram(type, description);
            
            return {
              content: [{
                type: "image",
                data: diagramUrl,
                mimeType: "image/png"
              }, {
                type: "text",
                text: `Generated ${type} diagram: ${description}`
              }]
            };
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Diagram generation failed: ${error.message}`
              }],
              isError: true
            };
          }
        }
      );
    }
  }

  /**
   * Permission wrapper function for tool access control
   */
  private requirePermission(permission: string, handler: Function) {
    return async (request: any, context?: any) => {
      // Check if user has the required permission
      const userPermissions = this.props.permissions || [];
      if (!userPermissions.includes(permission)) {
        return {
          content: [{ 
            type: "text", 
            text: `Permission denied: This action requires '${permission}' permission. Your permissions: ${userPermissions.join(', ')}` 
          }],
          isError: true
        };
      }

      // If permission check passes, execute the handler
      return handler(request, context);
    };
  }

  /**
   * Perform RAG search with user context
   */
  private async performRAGSearch(query: string, limit: number, includeCode: boolean) {
    // Implementation would connect to vector database and perform semantic search
    // Using user context for personalization and access control
    
    // Mock implementation for now
    return [
      {
        title: "SwiftUI View Lifecycle",
        summary: "Understanding how SwiftUI views are created, updated, and destroyed",
        url: "https://developer.apple.com/documentation/swiftui/view-lifecycle",
        relevance: 0.95
      },
      {
        title: "Core Data with SwiftUI",
        summary: "Integrating Core Data with SwiftUI applications",
        url: "https://developer.apple.com/documentation/coredata/swiftui",
        relevance: 0.87
      }
    ].slice(0, limit);
  }

  /**
   * Update documentation with user tracking
   */
  private async updateDocumentation(title: string, content: string, category: string) {
    // Implementation would update the documentation database
    // Track the user who made the update for audit purposes
    
    const updateRecord = {
      title,
      content,
      category,
      updatedBy: this.props.userId,
      updatedAt: new Date().toISOString()
    };

    // Mock implementation - would use this.env.DB in real implementation
    console.log('Documentation update:', updateRecord);
  }

  /**
   * Get server statistics (admin only)
   */
  private async getServerStats() {
    // Mock implementation - would query actual database
    return {
      activeUsers: 42,
      totalSearches: 1337,
      documentCount: 2500,
      apiCallsToday: 156,
      systemHealth: "Healthy"
    };
  }

  /**
   * Manage user permissions (admin only)
   */
  private async manageUserPermissions(action: string, userId?: string, permission?: string) {
    // Mock implementation - would interact with user management system
    switch (action) {
      case 'list':
        return { message: "Active users: alice, bob, charlie" };
      case 'grant':
        return { message: `Granted '${permission}' to user '${userId}'` };
      case 'revoke':
        return { message: `Revoked '${permission}' from user '${userId}'` };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  /**
   * Generate technical diagrams (special permission)
   */
  private async generateDiagram(type: string, description: string) {
    // Mock implementation - would use image generation service
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  }
}
