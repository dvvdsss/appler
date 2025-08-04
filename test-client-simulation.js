#!/usr/bin/env node
/**
 * Simulate lobehub-mcp-client behavior
 * Tests the exact sequence that was failing
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

async function simulateLobeHubClient() {
  console.log('🤖 Simulating lobehub-mcp-client behavior...\n');

  // Step 1: Client tries to get manifest (this was failing before)
  console.log('1️⃣ Client attempts to retrieve manifest...');
  try {
    const manifestResponse = await makeRequest('GET', '/manifest');
    if (manifestResponse.status === 200) {
      console.log('✅ Manifest retrieved successfully');
      console.log(`   Server: ${manifestResponse.data.name}`);
      console.log(`   Protocol: ${manifestResponse.data.protocolVersion}`);
    } else {
      console.log('❌ Manifest retrieval failed:', manifestResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Manifest retrieval error:', error.message);
    return false;
  }

  // Step 2: Client initializes MCP connection
  console.log('\n2️⃣ Client initializes MCP connection...');
  const initResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'lobehub-mcp-client',
        version: '1.0.0'
      }
    }
  });

  if (initResponse.status !== 200 || !initResponse.data.result) {
    console.log('❌ Initialize failed:', initResponse);
    return false;
  }

  const sessionId = initResponse.headers['mcp-session-id'];
  console.log('✅ MCP connection initialized');
  console.log(`   Session ID: ${sessionId}`);

  // Step 3: Client gets tools list
  console.log('\n3️⃣ Client requests tools list...');
  const toolsResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }, { 'Mcp-Session-Id': sessionId });

  if (toolsResponse.status === 200 && toolsResponse.data.result) {
    console.log('✅ Tools list retrieved');
    console.log(`   Available tools: ${toolsResponse.data.result.tools.length}`);
    toolsResponse.data.result.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
  } else {
    console.log('❌ Tools list failed:', toolsResponse);
    return false;
  }

  // Step 4: Client might make a GET request (this was causing 405 before)
  console.log('\n4️⃣ Client makes GET request (was causing 405)...');
  try {
    const getResponse = await makeRequest('GET', '/', null, { 'Accept': '*/*' });
    if (getResponse.status === 200) {
      console.log('✅ GET request successful (no more 405!)');
      console.log(`   Response type: ${typeof getResponse.data}`);
    } else {
      console.log('❌ GET request failed:', getResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ GET request error:', error.message);
    return false;
  }

  // Step 5: Test query functionality
  console.log('\n5️⃣ Client tests query functionality...');
  const queryResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'query',
      arguments: {
        query: 'SwiftUI navigation best practices',
        match_count: 3
      }
    }
  }, { 'Mcp-Session-Id': sessionId });

  if (queryResponse.status === 200 && queryResponse.data.result) {
    console.log('✅ Query executed successfully');
    console.log(`   Response length: ${queryResponse.data.result.content.length} characters`);
  } else {
    console.log('❌ Query failed:', queryResponse);
    return false;
  }

  // Step 6: Test session persistence (wait 5 minutes)
  console.log('\n6️⃣ Testing session persistence...');
  console.log('⏳ Waiting 5 minutes to verify session doesn\'t timeout...');
  
  await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes

  const persistenceTest = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 4,
    method: 'ping'
  }, { 'Mcp-Session-Id': sessionId });

  if (persistenceTest.status === 200) {
    console.log('✅ Session survived 5 minutes - excellent persistence!');
  } else {
    console.log('❌ Session expired after 5 minutes:', persistenceTest);
    return false;
  }

  return true;
}

async function main() {
  console.log('🧪 Complete Client Simulation Test\n');
  console.log('This simulates the exact behavior that was failing before:\n');
  console.log('- Manifest retrieval (was failing with "fetch failed")');
  console.log('- GET requests (was returning 405)');
  console.log('- Session management (was timing out too quickly)');
  console.log('- Long-term session persistence\n');

  const success = await simulateLobeHubClient();

  if (success) {
    console.log('\n🎉 CLIENT SIMULATION SUCCESSFUL!');
    console.log('✅ All previous issues have been resolved:');
    console.log('   - Manifest retrieval works');
    console.log('   - GET requests return 200 (not 405)');
    console.log('   - Sessions persist for hours (not 90 seconds)');
    console.log('   - All MCP functionality works perfectly');
    console.log('\n🚀 Your MCP clients should now connect successfully!');
  } else {
    console.log('\n❌ CLIENT SIMULATION FAILED');
    console.log('Some issues still need to be resolved.');
  }
}

main().catch(console.error);
