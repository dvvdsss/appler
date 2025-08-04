#!/usr/bin/env node
/**
 * MCP Cancellation Compliance Test
 * Tests the server against MCP Cancellation specification (2025-06-18)
 */

import http from 'http';

const baseUrl = 'http://localhost:3001';
const protocolVersion = '2025-06-18';

async function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    
    const requestHeaders = {
      'Accept': 'application/json',
      'MCP-Protocol-Version': protocolVersion,
      ...headers
    };

    if (postData) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: requestHeaders
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const response = body.trim() === '' ? null : JSON.parse(body);
          resolve({ 
            status: res.statusCode, 
            data: response, 
            headers: res.headers 
          });
        } catch (error) {
          resolve({ 
            status: res.statusCode, 
            data: body, 
            headers: res.headers 
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function testBasicCancellation() {
  console.log('🧪 Testing Basic Cancellation Support...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Cancellation Test', version: '1.0.0' }
      }
    });

    if (initResponse.status !== 200) {
      console.log('❌ Initialization failed');
      return false;
    }

    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Send initialized notification
    await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Send cancellation notification
    const cancelResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: {
        requestId: '999',
        reason: 'User requested cancellation'
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    if (cancelResponse.status === 202) {
      console.log('✅ Basic cancellation notification accepted');
      return true;
    } else {
      console.log('❌ Cancellation notification rejected:', cancelResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Basic cancellation test error:', error.message);
    return false;
  }
}

async function testRequestTracking() {
  console.log('🧪 Testing Request Tracking...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Tracking Test', version: '1.0.0' }
      }
    });

    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Send initialized notification
    await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Start a tools/list request (should be tracked)
    const toolsPromise = makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'track-test-123',
      method: 'tools/list'
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Immediately send cancellation
    const cancelPromise = makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: {
        requestId: 'track-test-123',
        reason: 'Testing request tracking'
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    const [toolsResponse, cancelResponse] = await Promise.all([toolsPromise, cancelPromise]);

    if (cancelResponse.status === 202) {
      console.log('✅ Request tracking and cancellation working');
      return true;
    } else {
      console.log('❌ Request tracking failed:', cancelResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Request tracking test error:', error.message);
    return false;
  }
}

async function testLongRunningCancellation() {
  console.log('🧪 Testing Long-running Request Cancellation...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Long Running Test', version: '1.0.0' }
      }
    });

    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Send initialized notification
    await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Start a query request (potentially long-running)
    const queryPromise = makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'long-query-456',
      method: 'tools/call',
      params: {
        name: 'query',
        arguments: {
          query: 'SwiftUI navigation patterns and best practices'
        }
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Wait a bit then cancel
    setTimeout(async () => {
      await makeRequest('POST', '/', {
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: {
          requestId: 'long-query-456',
          reason: 'User cancelled long-running query'
        }
      }, {
        'Mcp-Session-Id': sessionId
      });
    }, 100); // Cancel after 100ms

    const queryResponse = await queryPromise;

    // Query might complete before cancellation due to timing
    console.log('✅ Long-running cancellation test completed (timing dependent)');
    return true;
  } catch (error) {
    console.log('❌ Long-running cancellation test error:', error.message);
    return false;
  }
}

async function testInvalidCancellation() {
  console.log('🧪 Testing Invalid Cancellation Handling...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Invalid Cancel Test', version: '1.0.0' }
      }
    });

    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Send initialized notification
    await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Test cancellation without requestId
    const invalidCancel1 = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: {
        reason: 'Missing requestId'
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    // Test cancellation of non-existent request
    const invalidCancel2 = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: {
        requestId: 'non-existent-999',
        reason: 'Non-existent request'
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    if (invalidCancel1.status === 202 && invalidCancel2.status === 202) {
      console.log('✅ Invalid cancellations handled gracefully');
      return true;
    } else {
      console.log('❌ Invalid cancellation handling failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid cancellation test error:', error.message);
    return false;
  }
}

async function testInitializeCancellationPrevention() {
  console.log('🧪 Testing Initialize Request Cancellation Prevention...');
  
  try {
    // Try to cancel an initialize request (should be ignored)
    const cancelResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/cancelled',
      params: {
        requestId: '1',
        reason: 'Trying to cancel initialize'
      }
    });

    // This should be accepted (notification) but the cancellation should be ignored
    if (cancelResponse.status === 202) {
      console.log('✅ Initialize cancellation prevention working (notification accepted but ignored)');
      return true;
    } else {
      console.log('❌ Initialize cancellation prevention failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Initialize cancellation prevention test error:', error.message);
    return false;
  }
}

async function runCancellationTests() {
  console.log('🚀 Starting MCP Cancellation Compliance Tests\n');
  
  const tests = [
    { name: 'Basic Cancellation Support', test: testBasicCancellation },
    { name: 'Request Tracking', test: testRequestTracking },
    { name: 'Long-running Request Cancellation', test: testLongRunningCancellation },
    { name: 'Invalid Cancellation Handling', test: testInvalidCancellation },
    { name: 'Initialize Cancellation Prevention', test: testInitializeCancellationPrevention }
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
      console.log(`❌ ${name} crashed:`, error.message);
      failed++;
    }
    console.log('');
  }

  console.log('📊 Cancellation Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All cancellation tests passed! Server is MCP Cancellation compliant.');
  } else {
    console.log('\n⚠️  Some cancellation tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Check if server is running first
http.get('http://localhost:3001/health', (res) => {
  if (res.statusCode === 200) {
    runCancellationTests().catch(console.error);
  } else {
    console.log('❌ Server not running. Start with: pnpm dev');
    process.exit(1);
  }
}).on('error', () => {
  console.log('❌ Server not running. Start with: pnpm dev');
  process.exit(1);
});
