#!/usr/bin/env node
/**
 * Complete MCP Client Test for Local Development
 * Tests all MCP functionality against localhost:3001
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

async function testServerInfo() {
  console.log('🔍 Testing GET / (Server Info)...');
  try {
    const response = await makeRequest('GET', '/');
    if (response.status === 200 && response.data.name) {
      console.log('✅ GET / successful');
      console.log(`   Server: ${response.data.name}`);
      console.log(`   Protocol: ${response.data.protocolVersion}`);
      return true;
    } else {
      console.log('❌ GET / failed:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ GET / error:', error.message);
    return false;
  }
}

async function testManifest() {
  console.log('🔍 Testing GET /manifest...');
  try {
    const response = await makeRequest('GET', '/manifest');
    if (response.status === 200 && response.data.name) {
      console.log('✅ GET /manifest successful');
      console.log(`   Server: ${response.data.name}`);
      console.log(`   Protocol: ${response.data.protocolVersion}`);
      return true;
    } else {
      console.log('❌ GET /manifest failed:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ GET /manifest error:', error.message);
    return false;
  }
}

async function testInitialize() {
  console.log('🔍 Testing MCP Initialize...');
  try {
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'Local Test Client',
          version: '1.0.0'
        }
      }
    });

    if (response.status === 200 && response.data.result) {
      console.log('✅ Initialize successful');
      console.log(`   Protocol: ${response.data.result.protocolVersion}`);
      console.log(`   Server: ${response.data.result.serverInfo.name}`);
      
      // Extract session ID from response headers
      const sessionId = response.headers['mcp-session-id'];
      if (sessionId) {
        console.log(`   Session ID: ${sessionId}`);
        return sessionId;
      } else {
        console.log('⚠️  No session ID returned');
        return null;
      }
    } else {
      console.log('❌ Initialize failed:', response);
      return null;
    }
  } catch (error) {
    console.log('❌ Initialize error:', error.message);
    return null;
  }
}

async function testToolsList(sessionId) {
  console.log('🔍 Testing Tools List...');
  try {
    const headers = sessionId ? { 'Mcp-Session-Id': sessionId } : {};
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    }, headers);

    if (response.status === 200 && response.data.result) {
      console.log('✅ Tools list successful');
      console.log(`   Tools count: ${response.data.result.tools.length}`);
      response.data.result.tools.forEach(tool => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });
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

async function testPing(sessionId) {
  console.log('🔍 Testing Ping...');
  try {
    const headers = sessionId ? { 'Mcp-Session-Id': sessionId } : {};
    const response = await makeRequest('POST', '/', {
      jsonrpc: '2.0',
      id: 3,
      method: 'ping'
    }, headers);

    if (response.status === 200 && response.data.result !== undefined) {
      console.log('✅ Ping successful');
      return true;
    } else {
      console.log('❌ Ping failed:', response);
      return false;
    }
  } catch (error) {
    console.log('❌ Ping error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Complete MCP Test Suite for localhost:3001\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Server Info
  total++;
  if (await testServerInfo()) passed++;
  console.log('');

  // Test 2: Manifest
  total++;
  if (await testManifest()) passed++;
  console.log('');

  // Test 3: Initialize
  total++;
  const sessionId = await testInitialize();
  if (sessionId) passed++;
  console.log('');

  // Test 4: Tools List
  total++;
  if (await testToolsList(sessionId)) passed++;
  console.log('');

  // Test 5: Ping
  total++;
  if (await testPing(sessionId)) passed++;
  console.log('');

  // Summary
  console.log('📊 Test Results:');
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Success Rate: ${Math.round(passed/total*100)}%`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! MCP server is working perfectly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check the output above.');
    process.exit(1);
  }
}

runAllTests().catch(console.error);
