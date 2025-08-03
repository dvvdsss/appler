#!/usr/bin/env node
/**
 * Streamable HTTP Transport Compliance Test
 * Tests the server against MCP 2025-06-18 Streamable HTTP specification
 */

import http from 'http';

const baseUrl = 'http://localhost:3001';
const protocolVersion = '2024-11-05';

async function makeRequest(method, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    
    const requestHeaders = {
      'Accept': 'application/json, text/event-stream',
      'MCP-Protocol-Version': protocolVersion,
      ...headers
    };

    // Only add Content-Type and Content-Length for requests with body
    if (postData) {
      requestHeaders['Content-Type'] = 'application/json';
      requestHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/',
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

async function testInitializeWithSession() {
  console.log('🧪 Testing initialize with session management...');
  
  try {
    const response = await makeRequest('POST', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {
          roots: { listChanged: true }
        },
        clientInfo: {
          name: 'Streamable HTTP Test',
          version: '1.0.0'
        }
      }
    });

    if (response.status === 200 && response.data.result && response.headers['mcp-session-id']) {
      console.log('✅ Initialize with session successful');
      console.log(`   Session ID: ${response.headers['mcp-session-id']}`);
      console.log(`   Protocol: ${response.data.result.protocolVersion}`);
      return response.headers['mcp-session-id'];
    } else {
      console.log('❌ Initialize failed:', response);
      return null;
    }
  } catch (error) {
    console.log('❌ Initialize error:', error.message);
    return null;
  }
}

async function testInitializedNotification(sessionId) {
  console.log('🧪 Testing initialized notification with session...');
  
  try {
    const response = await makeRequest('POST', {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, {
      'Mcp-Session-Id': sessionId
    });

    if (response.status === 202) {
      console.log('✅ Initialized notification successful (202 Accepted)');
      return true;
    } else {
      console.log('❌ Initialized notification failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Initialized notification error:', error.message);
    return false;
  }
}

async function testGetEndpoint() {
  console.log('🧪 Testing GET endpoint (SSE request)...');
  
  try {
    const response = await makeRequest('GET', null, {
      'Accept': 'text/event-stream'
    });

    if (response.status === 405) {
      console.log('✅ GET endpoint correctly returns 405 (SSE not supported)');
      return true;
    } else {
      console.log('❌ GET endpoint unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ GET endpoint error:', error.message);
    return false;
  }
}

async function testInvalidGetRequest() {
  console.log('🧪 Testing invalid GET request (without SSE accept)...');
  
  try {
    const response = await makeRequest('GET', null, {
      'Accept': 'application/json'
    });

    if (response.status === 400) {
      console.log('✅ Invalid GET request correctly rejected');
      return true;
    } else {
      console.log('❌ Invalid GET request unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid GET request error:', error.message);
    return false;
  }
}

async function testSessionTermination(sessionId) {
  console.log('🧪 Testing session termination...');

  try {
    const response = await makeRequest('DELETE', null, {
      'Mcp-Session-Id': sessionId,
      'Accept': '*/*'  // Add Accept header for DELETE request
    });

    if (response.status === 200) {
      console.log('✅ Session termination successful');
      return true;
    } else {
      console.log('❌ Session termination failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Session termination error:', error.message);
    return false;
  }
}

async function testInvalidSession() {
  console.log('🧪 Testing invalid session ID...');
  
  try {
    const response = await makeRequest('POST', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    }, {
      'Mcp-Session-Id': 'invalid-session-id'
    });

    if (response.status === 404) {
      console.log('✅ Invalid session correctly rejected (404)');
      return true;
    } else {
      console.log('❌ Invalid session unexpected response:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Invalid session error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Streamable HTTP Compliance Tests\n');
  
  const tests = [
    { name: 'Initialize with Session', test: testInitializeWithSession },
    { name: 'GET Endpoint (SSE)', test: testGetEndpoint },
    { name: 'Invalid GET Request', test: testInvalidGetRequest },
    { name: 'Invalid Session', test: testInvalidSession }
  ];

  let passed = 0;
  let failed = 0;
  let sessionId = null;

  for (const { name, test } of tests) {
    try {
      const result = await test();
      if (name === 'Initialize with Session' && result) {
        sessionId = result;
        passed++;
      } else if (result === true) {
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

  // Test session-dependent features
  if (sessionId) {
    console.log('🧪 Testing session-dependent features...\n');
    
    const sessionTests = [
      { name: 'Initialized Notification', test: () => testInitializedNotification(sessionId) },
      { name: 'Session Termination', test: () => testSessionTermination(sessionId) }
    ];

    for (const { name, test } of sessionTests) {
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
  }

  console.log('📊 Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All Streamable HTTP tests passed!');
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
