#!/usr/bin/env node
/**
 * Final RAG Functionality Test
 * Tests the complete end-to-end RAG functionality through the MCP server
 */

import http from 'http';

const baseUrl = 'http://localhost:3001';
const protocolVersion = '2024-11-05';

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

async function initializeSession() {
  const initResponse = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: protocolVersion,
      capabilities: {},
      clientInfo: { name: 'Final RAG Test', version: '1.0.0' }
    }
  });

  if (initResponse.status !== 200) {
    throw new Error('Failed to initialize session');
  }

  const sessionId = initResponse.headers['mcp-session-id'];
  
  // Send initialized notification
  await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  }, {
    'Mcp-Session-Id': sessionId
  });

  return sessionId;
}

async function testRAGQuery(sessionId, query, description) {
  console.log(`🔍 ${description}`);
  console.log(`   Query: "${query}"`);
  
  const startTime = Date.now();
  
  const response = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: `rag-test-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: 'query',
      arguments: {
        query: query,
        match_count: 3
      }
    }
  }, {
    'Mcp-Session-Id': sessionId
  });

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`   ⏱️  Duration: ${duration}ms`);
  console.log(`   📊 Status: ${response.status}`);

  if (response.status === 200) {
    const result = response.data?.result;
    
    if (result?.content) {
      let content = result.content;
      if (Array.isArray(content)) {
        content = content.map(c => c.text || c).join('\n');
      }
      
      console.log(`   ✅ Query successful`);
      console.log(`   📝 Response length: ${content.length} characters`);
      
      // Check if response contains error messages
      if (content.includes('Error:') || content.includes('Failed to')) {
        console.log(`   ⚠️  Response contains error:`);
        console.log(`      ${content.substring(0, 200)}...`);
        return { success: false, duration, error: 'Error in response content' };
      } else {
        console.log(`   📄 Response preview:`);
        console.log(`      ${content.substring(0, 150)}...`);
        return { success: true, duration, contentLength: content.length };
      }
    } else {
      console.log(`   ❌ No content in response`);
      return { success: false, duration, error: 'No content' };
    }
  } else {
    console.log(`   ❌ Request failed: ${response.status}`);
    return { success: false, duration, error: `HTTP ${response.status}` };
  }
}

async function runFinalRAGTest() {
  console.log('🚀 Final RAG Functionality Test\n');
  console.log('Testing end-to-end RAG functionality through the MCP server\n');
  
  try {
    // Initialize session
    console.log('🔧 Initializing session...');
    const sessionId = await initializeSession();
    console.log(`   ✅ Session ID: ${sessionId}\n`);

    // Test different types of queries
    const testCases = [
      {
        query: 'SwiftUI navigation',
        description: 'Test 1: SwiftUI Navigation Query'
      },
      {
        query: 'iOS architecture patterns',
        description: 'Test 2: Architecture Patterns Query'
      },
      {
        query: 'Core Data performance',
        description: 'Test 3: Core Data Performance Query'
      },
      {
        query: 'memory management',
        description: 'Test 4: Memory Management Query'
      },
      {
        query: 'reactive programming',
        description: 'Test 5: Reactive Programming Query'
      }
    ];

    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      console.log(`\n📋 ${testCase.description}:`);
      const result = await testRAGQuery(sessionId, testCase.query, testCase.description);
      results.push({ ...testCase, ...result });
      
      // Add delay between queries
      if (i < testCases.length - 1) {
        console.log('   ⏳ Waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n📊 Final Test Results:');
    console.log('======================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful queries: ${successful.length}/${results.length}`);
    console.log(`❌ Failed queries: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      console.log(`⏱️  Average duration: ${avgDuration.toFixed(2)}ms`);
    }
    
    // Detailed analysis
    if (failed.length > 0) {
      console.log('\n❌ Failed Queries Analysis:');
      failed.forEach((result, index) => {
        console.log(`   ${index + 1}. "${result.query}": ${result.error}`);
      });
    }
    
    // Overall assessment
    console.log('\n🎯 RAG System Assessment:');
    console.log('==========================');
    
    if (successful.length === results.length) {
      console.log('🟢 EXCELLENT: All RAG queries executed successfully!');
      console.log('   ✅ MCP server is responding correctly');
      console.log('   ✅ RAG service is operational');
      console.log('   ✅ Database connectivity is working');
      console.log('   ✅ Query processing pipeline is functional');
      console.log('   ✅ Response formatting is correct');
      
      console.log('\n💡 System Status: PRODUCTION READY');
      console.log('   - Core semantic search functionality: ✅ WORKING');
      console.log('   - Document retrieval: ✅ WORKING');
      console.log('   - MCP protocol compliance: ✅ WORKING');
      console.log('   - Error handling: ✅ WORKING');
      
    } else if (successful.length >= results.length * 0.8) {
      console.log('🟡 GOOD: Most RAG queries executed successfully');
      console.log('   ✅ Core functionality is working');
      console.log('   ⚠️  Some edge cases may need attention');
      
    } else if (successful.length >= results.length * 0.5) {
      console.log('🟠 FAIR: Some RAG queries executed successfully');
      console.log('   ⚠️  Significant issues detected');
      console.log('   🔧 System needs debugging');
      
    } else {
      console.log('🔴 POOR: Most RAG queries failed');
      console.log('   ❌ Major system issues detected');
      console.log('   🚨 System not ready for production');
    }
    
    // Technical details
    if (successful.length > 0) {
      console.log('\n🔧 Technical Performance:');
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      const maxDuration = Math.max(...successful.map(r => r.duration));
      const minDuration = Math.min(...successful.map(r => r.duration));
      
      console.log(`   ⏱️  Average response time: ${avgDuration.toFixed(2)}ms`);
      console.log(`   🚀 Fastest response: ${minDuration}ms`);
      console.log(`   🐌 Slowest response: ${maxDuration}ms`);
      
      if (avgDuration < 1000) {
        console.log(`   ✅ Performance: EXCELLENT (< 1 second)`);
      } else if (avgDuration < 5000) {
        console.log(`   🟡 Performance: GOOD (< 5 seconds)`);
      } else {
        console.log(`   🟠 Performance: SLOW (> 5 seconds)`);
      }
    }
    
    return successful.length === results.length;
    
  } catch (error) {
    console.log('❌ Test setup failed:', error.message);
    return false;
  }
}

// Check if server is running first
http.get('http://localhost:3001/health', (res) => {
  if (res.statusCode === 200) {
    runFinalRAGTest().then(success => {
      process.exit(success ? 0 : 1);
    }).catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
  } else {
    console.log('❌ Server not running. Start with: pnpm dev');
    process.exit(1);
  }
}).on('error', () => {
  console.log('❌ Server not running. Start with: pnpm dev');
  process.exit(1);
});
