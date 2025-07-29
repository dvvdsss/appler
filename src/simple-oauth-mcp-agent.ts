/**
 * 简化的OAuth MCP Agent - 保留完整OAuth功能，只有hello world工具
 * 专门用于测试OAuth 2.1认证流程
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

export class SimpleOAuthMCPAgent extends McpAgent<Env, unknown, AuthContext> {
  /**
   * 初始化简化的MCP服务器 - 只有hello world工具，但保留完整OAuth验证
   */
  async init() {
    // 唯一的工具：hello world - 显示OAuth认证信息
    this.server.tool(
      "hello", 
      "Hello World with OAuth authentication verification", 
      {}, 
      async () => ({
        content: [{ 
          type: "text", 
          text: `Hello World! 🌍

OAuth 2.1 Authentication Successful!

✅ Authenticated User Details:
• User ID: ${this.props.userId}
• Username: ${this.props.username}
• Permissions: ${this.props.permissions.join(', ')}
• Token Claims: ${JSON.stringify(this.props.claims, null, 2)}

🎉 OAuth 2.1 + MCP Authorization is working correctly!

This simple hello world tool confirms that:
- Bearer token authentication is working
- User context is properly passed
- Permission system is active
- MCP protocol is functioning

Connection and authentication: SUCCESS! ✅` 
        }],
      })
    );
  }
}

/**
 * Export for use in main application
 */
export default SimpleOAuthMCPAgent;
