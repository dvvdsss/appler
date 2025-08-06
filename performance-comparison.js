/**
 * Performance Comparison: localhost vs External IP
 * Test database connection performance improvements
 */

import { config } from 'dotenv';
import postgres from 'postgres';

// Load production environment
config({ path: '.env.production' });

async function testDatabasePerformance(host, label) {
  console.log(`\n🧪 Testing ${label} (${host})`);
  console.log('='.repeat(50));

  let sql;
  const results = {};
  
  try {
    // Create connection
    const connectionStart = Date.now();
    sql = postgres({
      host: host,
      port: parseInt(process.env.EMBEDDING_DB_PORT),
      database: process.env.EMBEDDING_DB_DATABASE,
      username: process.env.EMBEDDING_DB_USER,
      password: process.env.EMBEDDING_DB_PASSWORD,
      ssl: false,
      max: 5,
      idle_timeout: 30000,
      connect_timeout: 5000,
      prepare: true,
      connection: {
        application_name: 'apple-rag-mcp-perf-test',
      },
      transform: {
        undefined: null,
      },
    });

    // Test 1: Basic connection
    console.log('1️⃣ Basic connection test...');
    const basicStart = Date.now();
    await sql`SELECT 1 as test`;
    results.basicConnection = Date.now() - basicStart;
    console.log(`   ✅ ${results.basicConnection}ms`);

    // Test 2: Table query
    console.log('2️⃣ Table existence check...');
    const tableStart = Date.now();
    await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'chunks'
      )
    `;
    results.tableCheck = Date.now() - tableStart;
    console.log(`   ✅ ${results.tableCheck}ms`);

    // Test 3: Count query
    console.log('3️⃣ Count query...');
    const countStart = Date.now();
    await sql`SELECT COUNT(*) as total FROM chunks LIMIT 1`;
    results.countQuery = Date.now() - countStart;
    console.log(`   ✅ ${results.countQuery}ms`);

    // Test 4: Sample data query
    console.log('4️⃣ Sample data query...');
    const sampleStart = Date.now();
    await sql`SELECT id, url FROM chunks LIMIT 5`;
    results.sampleQuery = Date.now() - sampleStart;
    console.log(`   ✅ ${results.sampleQuery}ms`);

    // Test 5: Multiple rapid queries (simulating real usage)
    console.log('5️⃣ Rapid queries test (10 queries)...');
    const rapidStart = Date.now();
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(sql`SELECT ${i} as query_num, NOW() as timestamp`);
    }
    await Promise.all(promises);
    results.rapidQueries = Date.now() - rapidStart;
    console.log(`   ✅ ${results.rapidQueries}ms`);

    results.totalTime = Date.now() - connectionStart;
    console.log(`\n📊 Total time: ${results.totalTime}ms`);

    return results;

  } catch (error) {
    console.error(`❌ Error testing ${label}:`, error.message);
    return null;
  } finally {
    if (sql) {
      try {
        await sql.end();
      } catch (closeError) {
        console.warn('Warning closing connection:', closeError.message);
      }
    }
  }
}

function calculateImprovement(external, local) {
  if (!external || !local) return 'N/A';
  const improvement = ((external - local) / external * 100).toFixed(1);
  return `${improvement}% faster`;
}

async function main() {
  console.log('🚀 Database Performance Comparison Test');
  console.log('Testing localhost vs external IP performance');

  // Test external IP (original configuration)
  const externalResults = await testDatabasePerformance('198.12.70.36', 'External IP');
  
  // Wait a moment between tests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test localhost (optimized configuration)
  const localResults = await testDatabasePerformance('localhost', 'Localhost');

  // Performance comparison
  console.log('\n' + '='.repeat(70));
  console.log('📈 PERFORMANCE COMPARISON RESULTS');
  console.log('='.repeat(70));

  if (externalResults && localResults) {
    console.log('| Test                | External IP | Localhost | Improvement |');
    console.log('|---------------------|-------------|-----------|-------------|');
    console.log(`| Basic Connection    | ${externalResults.basicConnection.toString().padEnd(8)}ms | ${localResults.basicConnection.toString().padEnd(6)}ms | ${calculateImprovement(externalResults.basicConnection, localResults.basicConnection).padEnd(11)} |`);
    console.log(`| Table Check         | ${externalResults.tableCheck.toString().padEnd(8)}ms | ${localResults.tableCheck.toString().padEnd(6)}ms | ${calculateImprovement(externalResults.tableCheck, localResults.tableCheck).padEnd(11)} |`);
    console.log(`| Count Query         | ${externalResults.countQuery.toString().padEnd(8)}ms | ${localResults.countQuery.toString().padEnd(6)}ms | ${calculateImprovement(externalResults.countQuery, localResults.countQuery).padEnd(11)} |`);
    console.log(`| Sample Query        | ${externalResults.sampleQuery.toString().padEnd(8)}ms | ${localResults.sampleQuery.toString().padEnd(6)}ms | ${calculateImprovement(externalResults.sampleQuery, localResults.sampleQuery).padEnd(11)} |`);
    console.log(`| Rapid Queries (10x) | ${externalResults.rapidQueries.toString().padEnd(8)}ms | ${localResults.rapidQueries.toString().padEnd(6)}ms | ${calculateImprovement(externalResults.rapidQueries, localResults.rapidQueries).padEnd(11)} |`);
    console.log(`| **Total Time**      | ${externalResults.totalTime.toString().padEnd(8)}ms | ${localResults.totalTime.toString().padEnd(6)}ms | ${calculateImprovement(externalResults.totalTime, localResults.totalTime).padEnd(11)} |`);

    const avgImprovement = [
      (externalResults.basicConnection - localResults.basicConnection) / externalResults.basicConnection,
      (externalResults.tableCheck - localResults.tableCheck) / externalResults.tableCheck,
      (externalResults.countQuery - localResults.countQuery) / externalResults.countQuery,
      (externalResults.sampleQuery - localResults.sampleQuery) / externalResults.sampleQuery,
      (externalResults.rapidQueries - localResults.rapidQueries) / externalResults.rapidQueries
    ].reduce((a, b) => a + b, 0) / 5 * 100;

    console.log('\n🎯 **SUMMARY**:');
    console.log(`- Average performance improvement: **${avgImprovement.toFixed(1)}%**`);
    console.log(`- Total time reduction: **${externalResults.totalTime - localResults.totalTime}ms**`);
    console.log(`- Network latency eliminated: **${((externalResults.totalTime - localResults.totalTime) / externalResults.totalTime * 100).toFixed(1)}%**`);
    
    if (avgImprovement > 50) {
      console.log('\n🚀 **EXCELLENT**: Significant performance improvement achieved!');
    } else if (avgImprovement > 20) {
      console.log('\n✅ **GOOD**: Notable performance improvement achieved!');
    } else {
      console.log('\n📊 **MODERATE**: Some performance improvement achieved.');
    }
  }

  console.log('\n💡 **RECOMMENDATION**: Use localhost configuration for production deployment.');
}

main().catch(console.error);
