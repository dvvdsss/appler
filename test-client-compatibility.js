#!/usr/bin/env node
/**
 * Client Compatibility Test Suite
 * Tests all client behavior patterns including non-standard ones
 */

import http from 'http';

const BASE_URL = 'http://localhost:3001';

function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    if (data && method !== 'GET') {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', reject);

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testStandardBehavior() {
  console.log('🔍 Testing Standard Client Behavior...\n');
  
  // Standard GET /manifest
  const manifestResponse = await makeRequest('GET', '/manifest');
  if (manifestResponse.status === 200 && manifestResponse.data.name) {
    console.log('✅ GET /manifest - Standard behavior works');
  } else {
    console.log('❌ GET /manifest failed:', manifestResponse.status);
    return false;
  }

  // Standard MCP initialize
  const initResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    }
  }, { 'MCP-Protocol-Version': '2025-06-18' });

  if (initResponse.status === 200 && initResponse.data.result) {
    console.log('✅ POST / initialize - Standard MCP works');
    return initResponse.headers['mcp-session-id'];
  } else {
    console.log('❌ MCP initialize failed:', initResponse.status);
    return false;
  }
}

async function testNonStandardBehavior() {
  console.log('\n🔧 Testing Non-Standard Client Behavior...\n');
  
  // Non-standard: POST /manifest with empty body
  const emptyPostResponse = await makeRequest('POST', '/manifest', null);
  if (emptyPostResponse.status === 200 && emptyPostResponse.data.name) {
    console.log('✅ POST /manifest (empty) - Returns manifest data');
  } else {
    console.log('❌ POST /manifest (empty) failed:', emptyPostResponse.status);
    return false;
  }

  // Non-standard: POST /manifest with MCP request
  const mcpToManifestResponse = await makeRequest('POST', '/manifest', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {} }
  });

  if (mcpToManifestResponse.status === 307) {
    console.log('✅ POST /manifest (MCP) - Correctly redirects to /');
  } else {
    console.log('❌ POST /manifest (MCP) failed:', mcpToManifestResponse.status);
    return false;
  }

  // Non-standard: POST /manifest with invalid data
  const invalidPostResponse = await makeRequest('POST', '/manifest', {
    invalid: 'data'
  });

  if (invalidPostResponse.status === 400 && invalidPostResponse.data.error) {
    console.log('✅ POST /manifest (invalid) - Returns helpful error');
  } else {
    console.log('❌ POST /manifest (invalid) failed:', invalidPostResponse.status);
    return false;
  }

  return true;
}

async function testEdgeCases() {
  console.log('\n🎯 Testing Edge Cases...\n');
  
  // GET / (root endpoint)
  const getRootResponse = await makeRequest('GET', '/');
  if (getRootResponse.status === 200 && getRootResponse.data.name) {
    console.log('✅ GET / - Returns server info');
  } else {
    console.log('❌ GET / failed:', getRootResponse.status);
    return false;
  }

  // SSE request rejection
  const sseResponse = await makeRequest('GET', '/', null, {
    'Accept': 'text/event-stream'
  });
  if (sseResponse.status === 405) {
    console.log('✅ GET / (SSE) - Correctly rejects SSE requests');
  } else {
    console.log('❌ SSE rejection failed:', sseResponse.status);
    return false;
  }

  return true;
}

async function runCompatibilityTests() {
  console.log('🧪 Client Compatibility Test Suite\n');
  console.log('Testing both standard and non-standard client behaviors...\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Standard behavior
  total++;
  const sessionId = await testStandardBehavior();
  if (sessionId) passed++;

  // Test 2: Non-standard behavior
  total++;
  if (await testNonStandardBehavior()) passed++;

  // Test 3: Edge cases
  total++;
  if (await testEdgeCases()) passed++;

  // Summary
  console.log('\n📊 Compatibility Test Results:');
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Success Rate: ${Math.round(passed/total*100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 All compatibility tests passed!');
    console.log('✅ Standard MCP clients will work');
    console.log('✅ Non-standard clients will be handled gracefully');
    console.log('✅ Edge cases are properly managed');
    console.log('\n🚀 Your server is now compatible with all client types!');
    process.exit(0);
  } else {
    console.log('\n❌ Some compatibility issues remain.');
    process.exit(1);
  }
}

// Check server availability
async function checkServer() {
  try {
    await makeRequest('GET', '/health');
    console.log('✅ Server is running\n');
    return true;
  } catch (error) {
    console.log('❌ Server not running. Start with: pnpm dev');
    return false;
  }
}

async function main() {
  if (await checkServer()) {
    await runCompatibilityTests();
  }
}

main().catch(console.error);
