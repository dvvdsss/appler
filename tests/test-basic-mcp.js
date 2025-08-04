#!/usr/bin/env node
/**
 * Basic MCP Protocol Test
 * Simple test to verify MCP 2025-06-18 compliance
 */

import http from 'http';

const baseUrl = 'http://localhost:3001';
const protocolVersion = '2025-06-18';

async function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'MCP-Protocol-Version': protocolVersion,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          // Handle empty responses (like 204 No Content)
          if (body.trim() === '') {
            resolve({ status: res.statusCode, data: null });
          } else {
            const response = JSON.parse(body);
            resolve({ status: res.statusCode, data: response });
          }
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${body}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function testInitialize() {
  console.log('🧪 Testing initialize...');
  
  try {
    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: protocolVersion,
        capabilities: {
          roots: { listChanged: true }
        },
        clientInfo: {
          name: 'Basic MCP Test',
          version: '1.0.0'
        }
      }
    });

    if (response.status === 200 && response.data.result) {
      console.log('✅ Initialize successful');
      console.log(`   Protocol: ${response.data.result.protocolVersion}`);
      console.log(`   Server: ${response.data.result.serverInfo.name}`);
      return true;
    } else {
      console.log('❌ Initialize failed:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Initialize error:', error.message);
    return false;
  }
}

async function testInitializedNotification() {
  console.log('🧪 Testing initialized notification...');
  
  try {
    const response = await makeRequest({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
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

async function testToolsList() {
  console.log('🧪 Testing tools/list...');
  
  try {
    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    });

    if (response.status === 200 && response.data.result && response.data.result.tools) {
      console.log('✅ Tools list successful');
      console.log(`   Tools: ${response.data.result.tools.length}`);
      return true;
    } else {
      console.log('❌ Tools list failed:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Tools list error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Basic MCP Tests\n');
  
  const tests = [
    { name: 'Initialize', test: testInitialize },
    { name: 'Initialized Notification', test: testInitializedNotification },
    { name: 'Tools List', test: testToolsList }
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
    console.log('\n🎉 All basic tests passed!');
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
