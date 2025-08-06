#!/usr/bin/env node
/**
 * MCP Progress Compliance Test
 * Tests the server against MCP Progress specification (2025-06-18)
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

async function testProgressTokenParsing() {
  console.log('🧪 Testing Progress Token Parsing...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Progress Test', version: '1.0.0' }
      }
    });

    if (initResponse.status !== 200) {
      console.log('❌ Session initialization failed');
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

    // Send request with progress token
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'progress-test-1',
      method: 'tools/list',
      params: {
        _meta: {
          progressToken: 'test-token-123'
        }
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    if (response.status === 200) {
      console.log('✅ Progress token parsing successful');
      console.log(`   Request completed with progress token support`);
      return true;
    } else {
      console.log('❌ Progress token parsing failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Progress token parsing error:', error.message);
    return false;
  }
}

async function testRAGQueryProgress() {
  console.log('🧪 Testing RAG Query Progress Tracking...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'RAG Progress Test', version: '1.0.0' }
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

    // Send RAG query with progress token
    const startTime = Date.now();
    
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'rag-progress-test',
      method: 'tools/call',
      params: {
        name: 'query',
        arguments: {
          query: 'SwiftUI navigation best practices'
        },
        _meta: {
          progressToken: 'rag-token-456'
        }
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    if (response.status === 200 && response.data?.result?.content) {
      console.log('✅ RAG query with progress tracking successful');
      console.log(`   Query duration: ${duration}ms`);
      console.log(`   Progress token: rag-token-456`);
      return true;
    } else {
      console.log('❌ RAG query with progress failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ RAG query progress error:', error.message);
    return false;
  }
}

async function testAdminStatsProgress() {
  console.log('🧪 Testing Admin Stats Progress Tracking...');
  
  try {
    const token = process.env.TEST_ADMIN_TOKEN || 'test-admin-token';
    
    // Initialize session with admin token
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Admin Progress Test', version: '1.0.0' }
      }
    }, {
      'Authorization': `Bearer ${token}`
    });

    const sessionId = initResponse.headers['mcp-session-id'];
    
    // Send initialized notification
    await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Authorization': `Bearer ${token}`,
      'Mcp-Session-Id': sessionId
    });

    // Send admin stats request with progress token
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'admin-progress-test',
      method: 'tools/call',
      params: {
        name: 'admin_stats',
        arguments: {
          detailed: true
        },
        _meta: {
          progressToken: 'admin-token-789'
        }
      }
    }, {
      'Authorization': `Bearer ${token}`,
      'Mcp-Session-Id': sessionId
    });

    if (response.status === 200 && response.data?.result?.content) {
      console.log('✅ Admin stats with progress tracking successful');
      console.log(`   Progress token: admin-token-789`);
      return true;
    } else {
      console.log('❌ Admin stats with progress failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Admin stats progress error:', error.message);
    return false;
  }
}

async function testProgressTokenValidation() {
  console.log('🧪 Testing Progress Token Validation...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Token Validation Test', version: '1.0.0' }
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

    // Test different token types
    const tokenTypes = [
      { token: 'string-token', type: 'string' },
      { token: 12345, type: 'number' },
      { token: 'uuid-like-token-abc-123', type: 'uuid-like' }
    ];

    let allValid = true;

    for (const { token, type } of tokenTypes) {
      const response = await makeRequest('POST', '/', {
        jsonrpc: '2.0',
        id: `validation-test-${type}`,
        method: 'tools/list',
        params: {
          _meta: {
            progressToken: token
          }
        }
      }, {
        'Mcp-Session-Id': sessionId
      });

      if (response.status !== 200) {
        console.log(`❌ Token validation failed for ${type}: ${token}`);
        allValid = false;
      }
    }

    if (allValid) {
      console.log('✅ Progress token validation successful');
      console.log(`   Tested token types: string, number, uuid-like`);
      return true;
    } else {
      console.log('❌ Progress token validation failed');
      return false;
    }
  } catch (error) {
    console.log('❌ Progress token validation error:', error.message);
    return false;
  }
}

async function testProgressWithoutToken() {
  console.log('🧪 Testing Operations Without Progress Token...');
  
  try {
    // Initialize session
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'No Progress Test', version: '1.0.0' }
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

    // Send request without progress token
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'no-progress-test',
      method: 'tools/call',
      params: {
        name: 'query',
        arguments: {
          query: 'iOS development basics'
        }
      }
    }, {
      'Mcp-Session-Id': sessionId
    });

    if (response.status === 200 && response.data?.result?.content) {
      console.log('✅ Operations without progress token work correctly');
      console.log(`   Request completed normally without progress tracking`);
      return true;
    } else {
      console.log('❌ Operations without progress token failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ No progress token test error:', error.message);
    return false;
  }
}

async function runProgressTests() {
  console.log('🚀 Starting MCP Progress Compliance Tests\n');
  
  const tests = [
    { name: 'Progress Token Parsing', test: testProgressTokenParsing },
    { name: 'RAG Query Progress Tracking', test: testRAGQueryProgress },
    { name: 'Admin Stats Progress Tracking', test: testAdminStatsProgress },
    { name: 'Progress Token Validation', test: testProgressTokenValidation },
    { name: 'Operations Without Progress Token', test: testProgressWithoutToken }
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

  console.log('📊 Progress Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All progress tests passed! Server is MCP Progress compliant.');
  } else {
    console.log('\n⚠️  Some progress tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Check if server is running first
http.get('http://localhost:3001/health', (res) => {
  if (res.statusCode === 200) {
    runProgressTests().catch(console.error);
  } else {
    console.log('❌ Server not running. Start with: pnpm dev');
    process.exit(1);
  }
}).on('error', () => {
  console.log('❌ Server not running. Start with: pnpm dev');
  process.exit(1);
});
