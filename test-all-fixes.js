#!/usr/bin/env node
/**
 * Comprehensive Test for All MCP Fixes
 * Tests GET requests, session management, and timeout behavior
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
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'MCP-Protocol-Version': '2025-06-18',
        ...headers
      }
    };

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

    if (data) {
      const jsonData = JSON.stringify(data);
      req.write(jsonData);
    }
    req.end();
  });
}

async function testGetRequests() {
  console.log('🔍 Testing GET Requests...');
  
  // Test GET /
  try {
    const response = await makeRequest('GET', '/');
    if (response.status === 200 && response.data.name) {
      console.log('✅ GET / returns server info (not 405)');
      console.log(`   Server: ${response.data.name}`);
    } else {
      console.log('❌ GET / failed:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ GET / error:', error.message);
    return false;
  }

  // Test GET /manifest
  try {
    const response = await makeRequest('GET', '/manifest');
    if (response.status === 200 && response.data.name) {
      console.log('✅ GET /manifest works correctly');
    } else {
      console.log('❌ GET /manifest failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ GET /manifest error:', error.message);
    return false;
  }

  return true;
}

async function testSessionManagement() {
  console.log('🔍 Testing Session Management...');
  
  // Initialize session
  const initResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'Session Test Client',
        version: '1.0.0'
      }
    }
  });

  if (initResponse.status !== 200 || !initResponse.data.result) {
    console.log('❌ Initialize failed:', initResponse);
    return false;
  }

  const sessionId = initResponse.headers['mcp-session-id'];
  if (!sessionId) {
    console.log('❌ No session ID returned');
    return false;
  }

  console.log('✅ Session initialized:', sessionId);

  // Test tools/list with session
  const toolsResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }, { 'Mcp-Session-Id': sessionId });

  if (toolsResponse.status === 200 && toolsResponse.data.result) {
    console.log('✅ Tools list works with session');
    console.log(`   Tools: ${toolsResponse.data.result.tools.length}`);
  } else {
    console.log('❌ Tools list failed:', toolsResponse);
    return false;
  }

  // Test ping
  const pingResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 3,
    method: 'ping'
  }, { 'Mcp-Session-Id': sessionId });

  if (pingResponse.status === 200 && pingResponse.data.result !== undefined) {
    console.log('✅ Ping works with session');
  } else {
    console.log('❌ Ping failed:', pingResponse);
    return false;
  }

  return { sessionId, success: true };
}

async function testSessionPersistence(sessionId) {
  console.log('🔍 Testing Session Persistence...');
  
  // Wait 2 minutes to test if session survives
  console.log('⏳ Waiting 2 minutes to test session persistence...');
  await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes

  // Test if session is still alive
  const testResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/list'
  }, { 'Mcp-Session-Id': sessionId });

  if (testResponse.status === 200 && testResponse.data.result) {
    console.log('✅ Session survived 2 minutes - timeout fix successful!');
    return true;
  } else {
    console.log('❌ Session expired after 2 minutes:', testResponse);
    return false;
  }
}

async function testQueryTool(sessionId) {
  console.log('🔍 Testing Query Tool...');
  
  const queryResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 5,
    method: 'tools/call',
    params: {
      name: 'query',
      arguments: {
        query: 'SwiftUI navigation',
        match_count: 3
      }
    }
  }, { 'Mcp-Session-Id': sessionId });

  if (queryResponse.status === 200 && queryResponse.data.result) {
    console.log('✅ Query tool works correctly');
    console.log(`   Results: ${queryResponse.data.result.content.length} characters`);
    return true;
  } else {
    console.log('❌ Query tool failed:', queryResponse);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive MCP Fix Verification\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: GET Requests
  total++;
  if (await testGetRequests()) passed++;
  console.log('');

  // Test 2: Session Management
  total++;
  const sessionResult = await testSessionManagement();
  if (sessionResult.success) passed++;
  console.log('');

  if (!sessionResult.success) {
    console.log('❌ Cannot continue without working session');
    process.exit(1);
  }

  // Test 3: Query Tool
  total++;
  if (await testQueryTool(sessionResult.sessionId)) passed++;
  console.log('');

  // Test 4: Session Persistence (long test)
  console.log('⚠️  Starting 2-minute session persistence test...');
  console.log('   This will test if sessions survive longer than before');
  total++;
  if (await testSessionPersistence(sessionResult.sessionId)) passed++;
  console.log('');

  // Summary
  console.log('📊 Final Test Results:');
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Success Rate: ${Math.round(passed/total*100)}%`);
  
  if (passed === total) {
    console.log('🎉 All fixes verified! MCP server is working perfectly.');
    console.log('✅ GET requests fixed');
    console.log('✅ Session management fixed');
    console.log('✅ Timeout issues resolved');
    console.log('✅ All MCP clients should now work correctly');
    process.exit(0);
  } else {
    console.log('❌ Some issues remain. Check the output above.');
    process.exit(1);
  }
}

// Check if server is running first
async function checkServer() {
  try {
    await makeRequest('GET', '/health');
    console.log('✅ Server is running, starting tests...\n');
    return true;
  } catch (error) {
    console.log('❌ Server not running. Please start with: pnpm dev');
    console.log('   Error:', error.message);
    return false;
  }
}

async function main() {
  if (await checkServer()) {
    await runAllTests();
  }
}

main().catch(console.error);
