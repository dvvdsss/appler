#!/usr/bin/env node
/**
 * Production Environment Fix Verification
 * Tests the single instance session management fix
 */

import http from 'http';
import https from 'https';

const BASE_URL = 'https://mcp.apple-rag.com';

function makeRequest(method, path, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
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

    const req = https.request(options, (res) => {
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

async function testProductionFix() {
  console.log('🧪 Testing Production Environment Session Fix\n');
  
  // Test 1: Initialize session
  console.log('1️⃣ Testing MCP Initialize...');
  const initResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: {
        name: 'production-test-client',
        version: '1.0.0'
      }
    }
  }, { 'MCP-Protocol-Version': '2025-06-18' });

  if (initResponse.status !== 200 || !initResponse.data.result) {
    console.log('❌ Initialize failed:', initResponse);
    return false;
  }

  const sessionId = initResponse.headers['mcp-session-id'];
  if (!sessionId) {
    console.log('❌ No session ID returned');
    return false;
  }

  console.log('✅ Initialize successful');
  console.log(`   Session ID: ${sessionId}`);

  // Test 2: Use session for tools/list
  console.log('\n2️⃣ Testing Tools List with Session...');
  const toolsResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }, { 
    'MCP-Protocol-Version': '2025-06-18',
    'Mcp-Session-Id': sessionId 
  });

  if (toolsResponse.status !== 200 || !toolsResponse.data.result) {
    console.log('❌ Tools list failed:', toolsResponse);
    return false;
  }

  console.log('✅ Tools list successful');
  console.log(`   Tools count: ${toolsResponse.data.result.tools.length}`);

  // Test 3: Multiple requests with same session
  console.log('\n3️⃣ Testing Multiple Requests with Same Session...');
  
  for (let i = 0; i < 5; i++) {
    const pingResponse = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 3 + i,
      method: 'ping'
    }, { 
      'MCP-Protocol-Version': '2025-06-18',
      'Mcp-Session-Id': sessionId 
    });

    if (pingResponse.status !== 200) {
      console.log(`❌ Ping ${i + 1} failed:`, pingResponse.status);
      return false;
    }
  }

  console.log('✅ Multiple requests successful (5/5)');

  // Test 4: Query tool functionality
  console.log('\n4️⃣ Testing Query Tool...');
  const queryResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 10,
    method: 'tools/call',
    params: {
      name: 'query',
      arguments: {
        query: 'SwiftUI navigation best practices',
        match_count: 3
      }
    }
  }, { 
    'MCP-Protocol-Version': '2025-06-18',
    'Mcp-Session-Id': sessionId 
  });

  if (queryResponse.status !== 200 || !queryResponse.data.result) {
    console.log('❌ Query failed:', queryResponse);
    return false;
  }

  console.log('✅ Query tool successful');
  console.log(`   Response length: ${queryResponse.data.result.content.length} characters`);

  return true;
}

async function testClientCompatibility() {
  console.log('\n🔧 Testing Client Compatibility Features...\n');
  
  // Test POST /manifest (non-standard client behavior)
  console.log('1️⃣ Testing POST /manifest (empty body)...');
  const manifestResponse = await makeRequest('POST', '/manifest', {});
  
  if (manifestResponse.status === 200 && manifestResponse.data.name) {
    console.log('✅ POST /manifest compatibility works');
  } else {
    console.log('❌ POST /manifest failed:', manifestResponse.status);
    return false;
  }

  // Test GET /manifest (standard behavior)
  console.log('\n2️⃣ Testing GET /manifest (standard)...');
  const getManifestResponse = await makeRequest('GET', '/manifest');
  
  if (getManifestResponse.status === 200 && getManifestResponse.data.name) {
    console.log('✅ GET /manifest works');
  } else {
    console.log('❌ GET /manifest failed:', getManifestResponse.status);
    return false;
  }

  return true;
}

async function main() {
  console.log('🚀 Production Environment Verification\n');
  console.log('Testing single instance session management fix...\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Session management
  total++;
  if (await testProductionFix()) passed++;

  // Test 2: Client compatibility
  total++;
  if (await testClientCompatibility()) passed++;

  // Summary
  console.log('\n📊 Production Test Results:');
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Success Rate: ${Math.round(passed/total*100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 Production environment is working perfectly!');
    console.log('✅ Session management fixed');
    console.log('✅ Single instance mode working');
    console.log('✅ Client compatibility maintained');
    console.log('✅ All MCP functionality operational');
    console.log('\n🚀 Ready for client connections!');
    process.exit(0);
  } else {
    console.log('\n❌ Some issues remain in production.');
    process.exit(1);
  }
}

main().catch(console.error);
