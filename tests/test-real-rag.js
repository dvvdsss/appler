#!/usr/bin/env node
/**
 * Real RAG Functionality Test
 * Tests the core semantic search functionality with real queries
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
      clientInfo: { name: 'Real RAG Test', version: '1.0.0' }
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

async function testRealRAGQuery(sessionId, query, expectedKeywords = []) {
  console.log(`🔍 Testing RAG Query: "${query}"`);
  
  const startTime = Date.now();
  
  const response = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: `rag-test-${Date.now()}`,
    method: 'tools/call',
    params: {
      name: 'query',
      arguments: {
        query: query,
        match_count: 5
      }
    }
  }, {
    'Mcp-Session-Id': sessionId
  });

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`   ⏱️  Query Duration: ${duration}ms`);
  console.log(`   📊 Response Status: ${response.status}`);

  if (response.status === 200) {
    const result = response.data?.result;
    
    if (result?.content) {
      console.log(`   ✅ Query executed successfully`);
      
      // Parse the content to extract results
      let content = result.content;
      if (Array.isArray(content)) {
        content = content.map(c => c.text || c).join('\n');
      }
      
      console.log(`   📝 Content Length: ${content.length} characters`);
      
      // Check for expected keywords if provided
      if (expectedKeywords.length > 0) {
        const foundKeywords = expectedKeywords.filter(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
        
        console.log(`   🎯 Keywords Found: ${foundKeywords.length}/${expectedKeywords.length}`);
        if (foundKeywords.length > 0) {
          console.log(`      Found: ${foundKeywords.join(', ')}`);
        }
        
        return {
          success: true,
          duration,
          contentLength: content.length,
          keywordsFound: foundKeywords.length,
          totalKeywords: expectedKeywords.length,
          content: content.substring(0, 200) + '...'
        };
      }
      
      return {
        success: true,
        duration,
        contentLength: content.length,
        content: content.substring(0, 200) + '...'
      };
    } else {
      console.log(`   ⚠️  No content in response`);
      console.log(`   📋 Full Response:`, JSON.stringify(result, null, 2));
      
      return {
        success: false,
        duration,
        error: 'No content in response',
        fullResponse: result
      };
    }
  } else {
    console.log(`   ❌ Query failed with status ${response.status}`);
    console.log(`   📋 Error Response:`, JSON.stringify(response.data, null, 2));
    
    return {
      success: false,
      duration,
      error: `HTTP ${response.status}`,
      errorResponse: response.data
    };
  }
}

async function runRealRAGTests() {
  console.log('🚀 Starting Real RAG Functionality Tests\n');
  
  try {
    // Initialize session
    console.log('🔧 Initializing session...');
    const sessionId = await initializeSession();
    console.log(`   ✅ Session ID: ${sessionId}\n`);

    // Test queries with different complexity levels
    const testQueries = [
      {
        query: 'SwiftUI navigation best practices',
        keywords: ['SwiftUI', 'navigation', 'NavigationView', 'NavigationStack']
      },
      {
        query: 'iOS app architecture patterns',
        keywords: ['iOS', 'architecture', 'MVC', 'MVVM', 'pattern']
      },
      {
        query: 'Core Data performance optimization',
        keywords: ['Core Data', 'performance', 'optimization', 'NSManagedObject']
      },
      {
        query: 'UIKit vs SwiftUI comparison',
        keywords: ['UIKit', 'SwiftUI', 'comparison', 'framework']
      },
      {
        query: 'Combine framework reactive programming',
        keywords: ['Combine', 'reactive', 'programming', 'Publisher', 'Subscriber']
      }
    ];

    const results = [];
    
    for (let i = 0; i < testQueries.length; i++) {
      const { query, keywords } = testQueries[i];
      
      console.log(`\n📋 Test ${i + 1}/${testQueries.length}:`);
      const result = await testRealRAGQuery(sessionId, query, keywords);
      results.push({ query, ...result });
      
      // Add delay between queries to avoid overwhelming the system
      if (i < testQueries.length - 1) {
        console.log('   ⏳ Waiting 2 seconds before next query...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log('================');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`✅ Successful queries: ${successful.length}/${results.length}`);
    console.log(`❌ Failed queries: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
      const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
      const avgContentLength = successful.reduce((sum, r) => sum + (r.contentLength || 0), 0) / successful.length;
      
      console.log(`⏱️  Average query duration: ${avgDuration.toFixed(2)}ms`);
      console.log(`📝 Average content length: ${avgContentLength.toFixed(0)} characters`);
      
      // Keyword analysis
      const keywordResults = successful.filter(r => r.keywordsFound !== undefined);
      if (keywordResults.length > 0) {
        const avgKeywordMatch = keywordResults.reduce((sum, r) => sum + (r.keywordsFound / r.totalKeywords), 0) / keywordResults.length;
        console.log(`🎯 Average keyword match rate: ${(avgKeywordMatch * 100).toFixed(1)}%`);
      }
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Failed Queries:');
      failed.forEach((result, index) => {
        console.log(`   ${index + 1}. "${result.query}": ${result.error}`);
      });
    }
    
    // Detailed results for successful queries
    if (successful.length > 0) {
      console.log('\n📋 Sample Results:');
      successful.slice(0, 2).forEach((result, index) => {
        console.log(`\n${index + 1}. Query: "${result.query}"`);
        console.log(`   Duration: ${result.duration}ms`);
        console.log(`   Content: ${result.content}`);
      });
    }
    
    // Overall assessment
    console.log('\n🎯 RAG Functionality Assessment:');
    if (successful.length === results.length) {
      console.log('🟢 EXCELLENT: All queries executed successfully');
    } else if (successful.length >= results.length * 0.8) {
      console.log('🟡 GOOD: Most queries executed successfully');
    } else if (successful.length >= results.length * 0.5) {
      console.log('🟠 FAIR: Some queries executed successfully');
    } else {
      console.log('🔴 POOR: Most queries failed');
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
    runRealRAGTests().then(success => {
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
