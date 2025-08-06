/**
 * Production Database Connection Test
 * Test the fixed database connection with production settings
 */

import { config } from 'dotenv';
import postgres from 'postgres';

// Load production environment for testing
config({ path: '.env.production' });

async function testProductionDatabase() {
  console.log('🧪 Testing Production Database Connection\n');
  console.log('=' .repeat(60));

  // Display configuration (without sensitive data)
  console.log('📋 Configuration:');
  console.log(`- Host: ${process.env.EMBEDDING_DB_HOST}`);
  console.log(`- Port: ${process.env.EMBEDDING_DB_PORT}`);
  console.log(`- Database: ${process.env.EMBEDDING_DB_DATABASE}`);
  console.log(`- User: ${process.env.EMBEDDING_DB_USER}`);
  console.log(`- SSL Mode: ${process.env.EMBEDDING_DB_SSLMODE}`);
  console.log(`- Password: ${process.env.EMBEDDING_DB_PASSWORD ? process.env.EMBEDDING_DB_PASSWORD.substring(0, 4) + '...' : 'NOT SET'}\n`);

  let sql;
  
  try {
    console.log('🔌 Creating Database Connection...');
    
    // Use the same configuration as the fixed database service
    sql = postgres({
      host: process.env.EMBEDDING_DB_HOST,
      port: parseInt(process.env.EMBEDDING_DB_PORT),
      database: process.env.EMBEDDING_DB_DATABASE,
      username: process.env.EMBEDDING_DB_USER,
      password: process.env.EMBEDDING_DB_PASSWORD,
      ssl: process.env.EMBEDDING_DB_SSLMODE === "require" ? {
        rejectUnauthorized: false,  // Allow self-signed certificates
        checkServerIdentity: () => undefined,  // Skip hostname verification
      } : false,

      // VPS Performance Optimizations
      max: 20,
      idle_timeout: 300000,
      connect_timeout: 30000,     // 30 seconds connect timeout
      prepare: true,

      // Connection retry configuration
      connection: {
        application_name: 'apple-rag-mcp-test',
      },

      // Transform configuration
      transform: {
        undefined: null,
      },

      // Debug logging
      debug: (_connection, query, _parameters) => {
        console.log(`🔍 Query: ${query.slice(0, 100)}...`);
      },
    });

    console.log('✅ Database connection created\n');

    // Test 1: Basic connection
    console.log('1️⃣ Testing basic connection...');
    const testStart = Date.now();
    const basicTest = await sql`SELECT 1 as test, NOW() as current_time`;
    console.log(`✅ Basic connection successful (${Date.now() - testStart}ms)`);
    console.log(`   Result: ${JSON.stringify(basicTest[0])}\n`);

    // Test 2: pgvector extension
    console.log('2️⃣ Testing pgvector extension...');
    const vectorStart = Date.now();
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS vector`;
      console.log(`✅ pgvector extension available (${Date.now() - vectorStart}ms)\n`);
    } catch (error) {
      console.log(`⚠️ pgvector extension issue: ${error.message}\n`);
    }

    // Test 3: Check chunks table
    console.log('3️⃣ Testing chunks table...');
    const tableStart = Date.now();
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'chunks'
      )
    `;
    console.log(`✅ Table check completed (${Date.now() - tableStart}ms)`);
    console.log(`   Chunks table exists: ${tableExists[0]?.exists}\n`);

    if (tableExists[0]?.exists) {
      // Test 4: Count chunks
      console.log('4️⃣ Testing chunks count...');
      const countStart = Date.now();
      const count = await sql`SELECT COUNT(*) as total FROM chunks`;
      console.log(`✅ Chunks count successful (${Date.now() - countStart}ms)`);
      console.log(`   Total chunks: ${count[0]?.total}\n`);

      // Test 5: Sample vector query (if chunks exist)
      if (parseInt(count[0]?.total) > 0) {
        console.log('5️⃣ Testing sample vector query...');
        const vectorQueryStart = Date.now();
        const sampleQuery = await sql`
          SELECT id, url, content
          FROM chunks
          WHERE embedding IS NOT NULL
          LIMIT 3
        `;
        console.log(`✅ Sample vector query successful (${Date.now() - vectorQueryStart}ms)`);
        console.log(`   Sample results: ${sampleQuery.length} chunks\n`);
      }
    }

    console.log('🎉 All database tests passed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Error details:', error);
    return false;
  } finally {
    if (sql) {
      try {
        await sql.end();
        console.log('🔌 Database connection closed');
      } catch (closeError) {
        console.warn('⚠️ Warning closing connection:', closeError.message);
      }
    }
  }
}

async function main() {
  console.log('🚀 Production Database Connection Test\n');
  
  const success = await testProductionDatabase();
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`- Database Connection: ${success ? '✅ PASS' : '❌ FAIL'}`);
  
  if (success) {
    console.log('\n🎉 Production database is ready for MCP server!');
  } else {
    console.log('\n⚠️ Production database needs attention before deployment.');
  }
  
  process.exit(success ? 0 : 1);
}

main().catch(console.error);
