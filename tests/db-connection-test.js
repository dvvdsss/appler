/**
 * Test MCP Database Connection and Token Validation
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

async function testCloudflareD1Connection() {
  console.log('🔍 Testing Cloudflare D1 Connection...\n');

  const config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
    databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID
  };

  console.log('Configuration:');
  console.log(`- Account ID: ${config.accountId}`);
  console.log(`- Database ID: ${config.databaseId}`);
  console.log(`- API Token: ${config.apiToken ? config.apiToken.substring(0, 8) + '...' : 'NOT SET'}\n`);

  if (!config.accountId || !config.apiToken || !config.databaseId) {
    console.error('❌ Missing required Cloudflare D1 configuration');
    return false;
  }

  try {
    // Test basic D1 connection
    console.log('1. Testing basic D1 connection...');
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: "SELECT 1 as test"
        })
      }
    );

    if (!response.ok) {
      console.error(`❌ D1 connection failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ D1 connection successful');
    console.log('Response:', JSON.stringify(data, null, 2));

    // Test table existence
    console.log('\n2. Testing table existence...');
    const tablesResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        })
      }
    );

    if (tablesResponse.ok) {
      const tablesData = await tablesResponse.json();
      const tables = tablesData.result?.[0]?.results || [];
      console.log('✅ Tables found:', tables.map(t => t.name));

      // Check for required tables
      const requiredTables = ['users', 'mcp_tokens'];
      const existingTables = tables.map(t => t.name);
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));

      if (missingTables.length > 0) {
        console.warn('⚠️ Missing required tables:', missingTables);
      } else {
        console.log('✅ All required tables exist');
      }
    }

    // Test users table structure
    console.log('\n3. Testing users table structure...');
    const usersStructureResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sql: "PRAGMA table_info(users)"
        })
      }
    );

    if (usersStructureResponse.ok) {
      const usersData = await usersStructureResponse.json();
      const columns = usersData.result?.[0]?.results || [];
      console.log('✅ Users table columns:', columns.map(c => c.name));

      // Check if tier column exists
      const hasTier = columns.some(c => c.name === 'tier');
      const hasPlanId = columns.some(c => c.name === 'plan_id');
      console.log(`- Has 'tier' column: ${hasTier}`);
      console.log(`- Has 'plan_id' column: ${hasPlanId}`);

      // Test appropriate query based on available columns
      console.log('\n4. Testing token query structure...');
      const tierField = hasTier ? 'u.tier' : hasPlanId ? 'u.plan_id' : "'free'";

      const tokenTestResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database/${config.databaseId}/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sql: `
              SELECT
                u.id as user_id,
                u.email,
                u.name,
                COALESCE(${tierField}, 'free') as tier
              FROM mcp_tokens t
              JOIN users u ON t.user_id = u.id
              WHERE t.token = ?
              LIMIT 1
            `,
            params: ['test_token_that_does_not_exist']
          })
        }
      );

      if (tokenTestResponse.ok) {
        const tokenData = await tokenTestResponse.json();
        console.log('✅ Token query structure is valid');
        console.log('Query result:', JSON.stringify(tokenData, null, 2));
      } else {
        console.error('❌ Token query failed:', tokenTestResponse.status);
        const errorText = await tokenTestResponse.text();
        console.error('Error details:', errorText);
      }
    } else {
      console.error('❌ Users table structure check failed:', usersStructureResponse.status);
    }

    return true;
  } catch (error) {
    console.error('❌ D1 test failed:', error.message);
    return false;
  }
}

async function testPostgreSQLConnection() {
  console.log('\n🐘 Testing PostgreSQL Connection...\n');

  const config = {
    host: process.env.EMBEDDING_DB_HOST,
    port: process.env.EMBEDDING_DB_PORT,
    database: process.env.EMBEDDING_DB_DATABASE,
    user: process.env.EMBEDDING_DB_USER,
    password: process.env.EMBEDDING_DB_PASSWORD
  };

  console.log('Configuration:');
  console.log(`- Host: ${config.host}`);
  console.log(`- Port: ${config.port}`);
  console.log(`- Database: ${config.database}`);
  console.log(`- User: ${config.user}`);
  console.log(`- Password: ${config.password ? config.password.substring(0, 4) + '...' : 'NOT SET'}\n`);

  try {
    // Dynamic import for postgres
    const postgres = (await import('postgres')).default;
    
    const sql = postgres({
      host: config.host,
      port: parseInt(config.port),
      database: config.database,
      username: config.user,
      password: config.password,
      ssl: false,
      max: 1,
      connect_timeout: 10
    });

    console.log('1. Testing PostgreSQL connection...');
    const result = await sql`SELECT 1 as test`;
    console.log('✅ PostgreSQL connection successful');
    console.log('Result:', result);

    console.log('\n2. Testing pgvector extension...');
    const vectorTest = await sql`SELECT 1 as test WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')`;
    if (vectorTest.length > 0) {
      console.log('✅ pgvector extension is available');
    } else {
      console.warn('⚠️ pgvector extension not found');
    }

    console.log('\n3. Testing chunks table...');
    const chunksTest = await sql`SELECT COUNT(*) as count FROM chunks LIMIT 1`;
    console.log('✅ Chunks table accessible, count:', chunksTest[0].count);

    await sql.end();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🧪 MCP Database Connection Test\n');
  console.log('=' .repeat(50));

  const d1Success = await testCloudflareD1Connection();
  const pgSuccess = await testPostgreSQLConnection();

  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Summary:');
  console.log(`- Cloudflare D1: ${d1Success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`- PostgreSQL: ${pgSuccess ? '✅ PASS' : '❌ FAIL'}`);

  if (d1Success && pgSuccess) {
    console.log('\n🎉 All database connections are working!');
  } else {
    console.log('\n⚠️ Some database connections failed. Please check configuration.');
  }
}

main().catch(console.error);
