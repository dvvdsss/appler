#!/usr/bin/env node
/**
 * MCP Ping Compliance Test
 * Tests the server against MCP Ping specification (2025-06-18)
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

async function testBasicPing() {
  console.log('🧪 Testing Basic Ping Support...');
  
  try {
    const startTime = Date.now();
    
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'ping-test-1',
      method: 'ping'
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    if (response.status === 200 && 
        response.data?.jsonrpc === '2.0' && 
        response.data?.id === 'ping-test-1' &&
        response.data?.result !== undefined &&
        Object.keys(response.data.result).length === 0) {
      
      console.log('✅ Basic ping successful');
      console.log(`   Latency: ${latency}ms`);
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      console.log('❌ Basic ping failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Basic ping error:', error.message);
    return false;
  }
}

async function testPingWithSession() {
  console.log('🧪 Testing Ping with Session...');
  
  try {
    // Initialize session first
    const initResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {},
        clientInfo: { name: 'Ping Test', version: '1.0.0' }
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

    // Send ping with session
    const startTime = Date.now();
    
    const pingResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'ping-session-test',
      method: 'ping'
    }, {
      'Mcp-Session-Id': sessionId
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    if (pingResponse.status === 200 && 
        pingResponse.data?.result !== undefined &&
        Object.keys(pingResponse.data.result).length === 0) {
      
      console.log('✅ Session ping successful');
      console.log(`   Session ID: ${sessionId}`);
      console.log(`   Latency: ${latency}ms`);
      return true;
    } else {
      console.log('❌ Session ping failed:', pingResponse.status, pingResponse.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Session ping error:', error.message);
    return false;
  }
}

async function testPingLatency() {
  console.log('🧪 Testing Ping Latency...');
  
  try {
    const latencies = [];
    const pingCount = 5;

    for (let i = 0; i < pingCount; i++) {
      const startTime = Date.now();
      
      const response = await makeRequest('POST', '/', {
        jsonrpc: '2.0',
        id: `ping-latency-${i}`,
        method: 'ping'
      });

      const endTime = Date.now();
      const latency = endTime - startTime;

      if (response.status === 200) {
        latencies.push(latency);
      } else {
        console.log(`❌ Ping ${i + 1} failed:`, response.status);
        return false;
      }
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);

    console.log('✅ Ping latency test successful');
    console.log(`   Pings sent: ${pingCount}`);
    console.log(`   Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`   Min latency: ${minLatency}ms`);
    console.log(`   Max latency: ${maxLatency}ms`);
    
    return true;
  } catch (error) {
    console.log('❌ Ping latency test error:', error.message);
    return false;
  }
}

async function testPingWithAuthentication() {
  console.log('🧪 Testing Ping with Authentication...');
  
  try {
    const token = process.env.TEST_ADMIN_TOKEN || 'test-token';
    
    const startTime = Date.now();
    
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 'ping-auth-test',
      method: 'ping'
    }, {
      'Authorization': `Bearer ${token}`
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    if (response.status === 200 && 
        response.data?.result !== undefined &&
        Object.keys(response.data.result).length === 0) {
      
      console.log('✅ Authenticated ping successful');
      console.log(`   Latency: ${latency}ms`);
      return true;
    } else {
      console.log('❌ Authenticated ping failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Authenticated ping error:', error.message);
    return false;
  }
}

async function testPingResponseFormat() {
  console.log('🧪 Testing Ping Response Format Compliance...');
  
  try {
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 42,
      method: 'ping'
    });

    // Verify exact response format according to MCP specification
    const expectedFormat = {
      jsonrpc: '2.0',
      id: 42,
      result: {}
    };

    if (response.status === 200 &&
        response.data?.jsonrpc === expectedFormat.jsonrpc &&
        response.data?.id === expectedFormat.id &&
        response.data?.result !== undefined &&
        typeof response.data.result === 'object' &&
        Object.keys(response.data.result).length === 0 &&
        !response.data.error) {
      
      console.log('✅ Ping response format compliant');
      console.log(`   Response: ${JSON.stringify(response.data)}`);
      return true;
    } else {
      console.log('❌ Ping response format non-compliant:', response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Ping response format test error:', error.message);
    return false;
  }
}

async function runPingTests() {
  console.log('🚀 Starting MCP Ping Compliance Tests\n');
  
  const tests = [
    { name: 'Basic Ping Support', test: testBasicPing },
    { name: 'Ping with Session', test: testPingWithSession },
    { name: 'Ping Latency', test: testPingLatency },
    { name: 'Ping with Authentication', test: testPingWithAuthentication },
    { name: 'Ping Response Format Compliance', test: testPingResponseFormat }
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

  console.log('📊 Ping Test Results:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n🎉 All ping tests passed! Server is MCP Ping compliant.');
  } else {
    console.log('\n⚠️  Some ping tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Check if server is running first
http.get('http://localhost:3001/health', (res) => {
  if (res.statusCode === 200) {
    runPingTests().catch(console.error);
  } else {
    console.log('❌ Server not running. Start with: pnpm dev');
    process.exit(1);
  }
}).on('error', () => {
  console.log('❌ Server not running. Start with: pnpm dev');
  process.exit(1);
});
