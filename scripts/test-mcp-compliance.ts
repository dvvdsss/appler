#!/usr/bin/env tsx
/**
 * MCP Protocol Compliance Test
 * Tests the server against MCP 2025-06-18 specification
 */

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

class MCPComplianceTest {
  private baseUrl: string;
  private protocolVersion = "2025-06-18";

  constructor(baseUrl = "http://localhost:3001") {
    this.baseUrl = baseUrl;
  }

  private async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": this.protocolVersion,
      },
      body: JSON.stringify(request),
    });

    // Don't throw on error status codes, return the response for error testing
    return response.json();
  }

  private async sendNotification(method: string, params?: any): Promise<void> {
    await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": this.protocolVersion,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method,
        params,
      }),
    });
  }

  async testInitialization(): Promise<boolean> {
    console.log("🧪 Testing MCP Initialization...");

    try {
      const response = await this.sendRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: this.protocolVersion,
          capabilities: {
            roots: { listChanged: true },
            sampling: {},
          },
          clientInfo: {
            name: "MCP Compliance Test",
            version: "1.0.0",
          },
        },
      });

      // Validate response structure
      if (response.jsonrpc !== "2.0" || !response.result) {
        console.error("❌ Invalid initialize response format");
        return false;
      }

      const { protocolVersion, capabilities, serverInfo } = response.result;

      if (protocolVersion !== this.protocolVersion) {
        console.error(
          `❌ Protocol version mismatch: expected ${this.protocolVersion}, got ${protocolVersion}`
        );
        return false;
      }

      if (!capabilities || !serverInfo) {
        console.error("❌ Missing capabilities or serverInfo");
        return false;
      }

      console.log("✅ Initialize request successful");
      console.log(`   Server: ${serverInfo.name} v${serverInfo.version}`);
      console.log(`   Protocol: ${protocolVersion}`);

      return true;
    } catch (error) {
      console.error("❌ Initialize failed:", error);
      return false;
    }
  }

  async testInitializedNotification(): Promise<boolean> {
    console.log("🧪 Testing initialized notification...");

    try {
      await this.sendNotification("notifications/initialized");
      console.log("✅ Initialized notification sent");
      return true;
    } catch (error) {
      console.error("❌ Initialized notification failed:", error);
      return false;
    }
  }

  async testToolsList(): Promise<boolean> {
    console.log("🧪 Testing tools/list...");

    try {
      const response = await this.sendRequest({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });

      if (!response.result?.tools || !Array.isArray(response.result.tools)) {
        console.error("❌ Invalid tools list response");
        return false;
      }

      const tools = response.result.tools;
      console.log(`✅ Tools list successful (${tools.length} tools)`);

      for (const tool of tools) {
        if (!tool.name || !tool.description || !tool.inputSchema) {
          console.error("❌ Invalid tool definition:", tool);
          return false;
        }
        console.log(`   - ${tool.name}: ${tool.description}`);
      }

      return true;
    } catch (error) {
      console.error("❌ Tools list failed:", error);
      return false;
    }
  }

  async testToolsCall(): Promise<boolean> {
    console.log("🧪 Testing tools/call...");

    try {
      const response = await this.sendRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "query",
          arguments: {
            query: "Swift programming basics",
            match_count: 2,
          },
        },
      });

      if (
        !response.result?.content ||
        !Array.isArray(response.result.content)
      ) {
        console.error("❌ Invalid tools call response");
        return false;
      }

      console.log("✅ Tools call successful");
      console.log(`   Content items: ${response.result.content.length}`);

      return true;
    } catch (error) {
      console.error("❌ Tools call failed:", error);
      return false;
    }
  }

  async testErrorHandling(): Promise<boolean> {
    console.log("🧪 Testing error handling...");

    try {
      const response = await this.sendRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "nonexistent/method",
      });

      if (!response.error || response.error.code !== -32601) {
        console.error("❌ Expected method not found error");
        return false;
      }

      console.log("✅ Error handling correct");
      return true;
    } catch (error) {
      console.error("❌ Error handling test failed:", error);
      return false;
    }
  }

  async runAllTests(): Promise<void> {
    console.log("🚀 Starting MCP 2025-06-18 Compliance Tests\n");

    const tests = [
      { name: "Initialization", test: () => this.testInitialization() },
      {
        name: "Initialized Notification",
        test: () => this.testInitializedNotification(),
      },
      { name: "Tools List", test: () => this.testToolsList() },
      { name: "Tools Call", test: () => this.testToolsCall() },
      { name: "Error Handling", test: () => this.testErrorHandling() },
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
      try {
        const result = await test();
        if (result) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`❌ ${name} test crashed:`, error);
        failed++;
      }
      console.log(""); // Empty line for readability
    }

    console.log("📊 Test Results:");
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📋 Total: ${passed + failed}`);

    if (failed === 0) {
      console.log("\n🎉 All tests passed! Server is MCP 2025-06-18 compliant.");
    } else {
      console.log("\n⚠️  Some tests failed. Please review the implementation.");
      process.exit(1);
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPComplianceTest();
  tester.runAllTests().catch(console.error);
}

export { MCPComplianceTest };
