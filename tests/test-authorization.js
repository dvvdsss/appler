#!/usr/bin/env node
/**
 * MCP Authorization Compliance Test
 * Tests the server against MCP 2025-06-18 Authorization specification
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

async function testProtectedResourceMetadata() {
  console.log('🧪 Testing Protected Resource Metadata (RFC9728)...');
  
  try {
    const response = await makeRequest('GET', '/.well-known/oauth-protected-resource');

    if (response.status === 200 && response.data.resource) {
      console.log('✅ Protected Resource Metadata available');
      console.log(`   Resource: ${response.data.resource}`);
      console.log(`   Auth Servers: ${response.data.authorization_servers?.join(', ')}`);
      return true;
    } else {
      console.log('❌ Protected Resource Metadata failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Protected Resource Metadata error:', error.message);
    return false;
  }
}

async function testAuthorizationServerMetadata() {
  console.log('🧪 Testing Authorization Server Metadata (RFC8414)...');
  
  try {
    const response = await makeRequest('GET', '/.well-known/oauth-authorization-server');

    if (response.status === 200 && response.data.issuer) {
      console.log('✅ Authorization Server Metadata available');
      console.log(`   Issuer: ${response.data.issuer}`);
      console.log(`   PKCE: ${response.data.code_challenge_methods_supported?.includes('S256') ? 'Supported' : 'Not supported'}`);
      return true;
    } else {
      console.log('❌ Authorization Server Metadata failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Authorization Server Metadata error:', error.message);
    return false;
  }
}

async function testUnauthenticatedAccess() {
  console.log('🧪 Testing unauthenticated access...');
  
  try {
    // Test initialize without token
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Auth Test', version: '1.0.0' }
      }
    });

    if (initResponse.status !== 200) {
      console.log('❌ Unauthenticated initialize failed:', initResponse.status);
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

    // Test tools/list without token
    const toolsResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    }, {
      'Mcp-Session-Id': sessionId
    });

    if (toolsResponse.status === 200) {
      console.log('✅ Unauthenticated access works');
      console.log(`   Tools available: ${toolsResponse.data.result.tools.length}`);
      return { sessionId, toolCount: toolsResponse.data.result.tools.length };
    } else {
      console.log('❌ Unauthenticated tools/list failed:', toolsResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Unauthenticated access error:', error.message);
    return false;
  }
}

async function testInvalidToken() {
  console.log('🧪 Testing invalid token handling...');
  
  try {
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Auth Test', version: '1.0.0' }
      }
    }, {
      'Authorization': 'Bearer invalid-token-12345'
    });

    if (response.status === 401 && response.headers['www-authenticate']) {
      console.log('✅ Invalid token correctly rejected (401)');
      console.log(`   WWW-Authenticate: ${response.headers['www-authenticate']}`);
      return true;
    } else {
      console.log('❌ Invalid token handling failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid token test error:', error.message);
    return false;
  }
}

async function testValidTokenAccess() {
  console.log('🧪 Testing valid token access...');
  
  try {
    // Generate demo token
    const tokenResponse = await makeRequest('POST', '/demo/generate-token', {
      subject: 'test@example.com',
      scopes: ['mcp:read', 'mcp:write']
    });

    if (tokenResponse.status !== 200) {
      console.log('❌ Demo token generation failed:', tokenResponse.status);
      return false;
    }

    const token = tokenResponse.data.access_token;

    // Test initialize with valid token
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Auth Test', version: '1.0.0' }
      }
    }, {
      'Authorization': `Bearer ${token}`
    });

    if (initResponse.status !== 200) {
      console.log('❌ Valid token initialize failed:', initResponse.status, initResponse.data);
      return false;
    }

    const sessionId = initResponse.headers['mcp-session-id'];

    // Send initialized notification
    await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Authorization': `Bearer ${token}`,
      'Mcp-Session-Id': sessionId
    });

    console.log('✅ Valid token access works');
    console.log(`   Instructions include auth info: ${initResponse.data.result.instructions.includes('Authenticated')}`);
    return { token, sessionId };
  } catch (error) {
    console.log('❌ Valid token test error:', error.message);
    return false;
  }
}

async function testAdminAccess() {
  console.log('🧪 Testing admin access...');
  
  try {
    // Generate admin token
    const tokenResponse = await makeRequest('POST', '/demo/generate-token', {
      subject: 'admin@example.com',
      scopes: ['mcp:admin']
    });

    const token = tokenResponse.data.access_token;
    
    // Initialize with admin token
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Auth Test', version: '1.0.0' }
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

    // Test tools/list to see admin tools
    const toolsResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    }, {
      'Authorization': `Bearer ${token}`,
      'Mcp-Session-Id': sessionId
    });

    // Test admin_stats tool
    const statsResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'admin_stats',
        arguments: {}
      }
    }, {
      'Authorization': `Bearer ${token}`,
      'Mcp-Session-Id': sessionId
    });

    if (statsResponse.status === 200) {
      console.log('✅ Admin access works');
      console.log(`   Admin tools available: ${toolsResponse.data.result.tools.length}`);
      return true;
    } else {
      console.log('❌ Admin access failed:', statsResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Admin access test error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting MCP Authorization Compliance Tests\n');
  
  const tests = [
    { name: 'Protected Resource Metadata', test: testProtectedResourceMetadata },
    { name: 'Authorization Server Metadata', test: testAuthorizationServerMetadata },
    { name: 'Unauthenticated Access', test: testUnauthenticatedAccess },
    { name: 'Invalid Token Handling', test: testInvalidToken },
    { name: 'Valid Token Access', test: testValidTokenAccess },
    { name: 'Admin Access', test: testAdminAccess }
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

  console.log('📊 Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All Authorization tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed.');
    process.exit(1);
  }
}

// Check if server is running first
http.get('http://localhost:3001/health', (res) => {
  if (res.statusCode === 200) {
    runTests().catch(console.error);
  } else {
    console.log('❌ Server not running. Start with: pnpm dev');
    process.exit(1);
  }
}).on('error', () => {
  console.log('❌ Server not running. Start with: pnpm dev');
  process.exit(1);
});
