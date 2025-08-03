#!/usr/bin/env node
/**
 * Semantic Search Quality Test
 * Tests the quality and relevance of semantic search results
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
      clientInfo: { name: 'Semantic Search Test', version: '1.0.0' }
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

async function testSemanticQuery(sessionId, query, expectedTopics) {
  console.log(`🔍 Testing: "${query}"`);
  
  const response = await makeRequest('POST', '/', {
    jsonrpc: '2.0',
    id: `semantic-test-${Date.now()}`,
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

  if (response.status === 200 && response.data?.result?.content) {
    let content = response.data.result.content;
    if (Array.isArray(content)) {
      content = content.map(c => c.text || c).join('\n');
    }
    
    // Extract document titles/topics from the response
    const foundTopics = [];
    expectedTopics.forEach(topic => {
      if (content.toLowerCase().includes(topic.toLowerCase())) {
        foundTopics.push(topic);
      }
    });
    
    const relevanceScore = foundTopics.length / expectedTopics.length;
    
    console.log(`   📊 Relevance: ${(relevanceScore * 100).toFixed(1)}% (${foundTopics.length}/${expectedTopics.length})`);
    console.log(`   🎯 Found topics: ${foundTopics.join(', ') || 'None'}`);
    
    // Extract first result preview
    const lines = content.split('\n');
    const contentStart = lines.findIndex(line => line.includes('**Content:**'));
    if (contentStart !== -1 && lines[contentStart + 1]) {
      console.log(`   📄 First result: ${lines[contentStart + 1].substring(0, 80)}...`);
    }
    
    return {
      success: true,
      relevanceScore,
      foundTopics,
      content: content.substring(0, 200)
    };
  } else {
    console.log(`   ❌ Query failed`);
    return { success: false, relevanceScore: 0, foundTopics: [] };
  }
}

async function runSemanticSearchTests() {
  console.log('🧠 Semantic Search Quality Test\n');
  console.log('Testing the quality and relevance of semantic search results\n');
  
  try {
    // Initialize session
    const sessionId = await initializeSession();
    console.log(`✅ Session initialized: ${sessionId}\n`);

    // Test cases with expected relevant topics
    const testCases = [
      {
        query: 'SwiftUI navigation',
        expectedTopics: ['SwiftUI', 'Navigation'],
        description: 'UI Framework Navigation'
      },
      {
        query: 'iOS app architecture',
        expectedTopics: ['Architecture', 'iOS', 'Patterns'],
        description: 'Application Architecture'
      },
      {
        query: 'Core Data performance',
        expectedTopics: ['Core Data', 'Performance'],
        description: 'Database Performance'
      },
      {
        query: 'memory management ARC',
        expectedTopics: ['Memory Management', 'ARC'],
        description: 'Memory Management'
      },
      {
        query: 'reactive programming Combine',
        expectedTopics: ['Combine', 'Reactive'],
        description: 'Reactive Programming'
      },
      {
        query: 'UIKit vs SwiftUI',
        expectedTopics: ['UIKit', 'SwiftUI', 'Frameworks'],
        description: 'Framework Comparison'
      }
    ];

    const results = [];
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      console.log(`📋 Test ${i + 1}/6: ${testCase.description}`);
      const result = await testSemanticQuery(sessionId, testCase.query, testCase.expectedTopics);
      results.push({ ...testCase, ...result });
      console.log('');
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Analysis
    console.log('📊 Semantic Search Quality Analysis:');
    console.log('====================================');
    
    const successful = results.filter(r => r.success);
    const avgRelevance = successful.reduce((sum, r) => sum + r.relevanceScore, 0) / successful.length;
    
    console.log(`✅ Successful queries: ${successful.length}/${results.length}`);
    console.log(`🎯 Average relevance: ${(avgRelevance * 100).toFixed(1)}%`);
    
    // Quality assessment
    if (avgRelevance >= 0.8) {
      console.log('🟢 EXCELLENT: High semantic relevance');
    } else if (avgRelevance >= 0.6) {
      console.log('🟡 GOOD: Moderate semantic relevance');
    } else if (avgRelevance >= 0.4) {
      console.log('🟠 FAIR: Some semantic relevance');
    } else {
      console.log('🔴 POOR: Low semantic relevance');
    }
    
    // Detailed results
    console.log('\n📋 Detailed Results:');
    results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const relevance = result.success ? `${(result.relevanceScore * 100).toFixed(1)}%` : 'N/A';
      console.log(`   ${index + 1}. ${status} ${result.description}: ${relevance} relevance`);
      if (result.foundTopics.length > 0) {
        console.log(`      Topics: ${result.foundTopics.join(', ')}`);
      }
    });
    
    // Performance metrics
    console.log('\n⚡ Performance Summary:');
    console.log(`   🔍 Total queries tested: ${results.length}`);
    console.log(`   ✅ Successful responses: ${successful.length}`);
    console.log(`   🎯 Semantic accuracy: ${(avgRelevance * 100).toFixed(1)}%`);
    
    // Final assessment
    console.log('\n🎉 Semantic Search Assessment:');
    if (successful.length === results.length && avgRelevance >= 0.7) {
      console.log('🟢 PRODUCTION READY: Excellent semantic search quality');
      console.log('   - All queries return relevant results');
      console.log('   - High semantic understanding');
      console.log('   - Suitable for production use');
    } else if (successful.length >= results.length * 0.8 && avgRelevance >= 0.5) {
      console.log('🟡 GOOD QUALITY: Acceptable semantic search');
      console.log('   - Most queries return relevant results');
      console.log('   - Reasonable semantic understanding');
      console.log('   - May need fine-tuning');
    } else {
      console.log('🟠 NEEDS IMPROVEMENT: Semantic search quality issues');
      console.log('   - Some queries may not return relevant results');
      console.log('   - Consider improving embeddings or data quality');
    }
    
    return successful.length === results.length && avgRelevance >= 0.7;
    
  } catch (error) {
    console.error('❌ Semantic search test failed:', error.message);
    return false;
  }
}

// Check if server is running first
http.get('http://localhost:3001/health', (res) => {
  if (res.statusCode === 200) {
    runSemanticSearchTests().then(success => {
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
