/**
 * Test MCP Authentication with Real Token
 */

// Use require for TypeScript files
const { TokenValidator } = require('./dist/src/auth/token-validator.js');
const { config } = require('./dist/src/config.js');

async function testAuthentication() {
  console.log('🔐 Testing MCP Authentication...\n');

  // Get a real token from the API
  console.log('1. Getting real token from API...');
  try {
    // Login first
    const loginResponse = await fetch('http://localhost:8787/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-debug@example.com',
        password: 'password123'
      })
    });
    
    const loginData = await loginResponse.json();
    if (!loginData.success) {
      console.error('❌ Login failed:', loginData);
      return;
    }
    
    const authToken = loginData.data.token;
    console.log('✅ Login successful');
    
    // Get existing MCP tokens
    const mcpListResponse = await fetch('http://localhost:8787/api/v1/mcp-tokens', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const mcpListData = await mcpListResponse.json();
    if (!mcpListData.success || !mcpListData.data || mcpListData.data.length === 0) {
      console.log('No existing tokens, creating one...');
      
      // Create MCP token
      const mcpResponse = await fetch('http://localhost:8787/api/v1/mcp-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          name: 'MCP Test Token for Auth',
          permissions: ['rag.read']
        })
      });
      
      const mcpData = await mcpResponse.json();
      if (!mcpData.success) {
        console.error('❌ MCP token creation failed:', mcpData);
        return;
      }
      
      console.log('✅ MCP token created');
      var testToken = mcpData.data.token;
    } else {
      var testToken = mcpListData.data[0].token;
      console.log('✅ Using existing token');
    }
    
    console.log(`Token: ${testToken.substring(0, 20)}...`);
    
    // Test authentication
    console.log('\n2. Testing token validation...');
    const validator = new TokenValidator(config);
    
    try {
      const user = await validator.validateToken(testToken);
      console.log('✅ Token validation successful!');
      console.log('User data:', {
        id: user.id,
        email: user.email,
        name: user.name,
        tier: user.tier
      });
      
      return true;
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      console.error('Error details:', error);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 MCP Authentication Test\n');
  console.log('=' .repeat(50));

  const success = await testAuthentication();

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`- Authentication: ${success ? '✅ PASS' : '❌ FAIL'}`);

  if (success) {
    console.log('\n🎉 MCP authentication is working!');
  } else {
    console.log('\n⚠️ MCP authentication failed. Please check configuration.');
  }
}

main().catch(console.error);
