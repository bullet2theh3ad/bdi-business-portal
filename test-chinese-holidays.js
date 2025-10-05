/**
 * Test script for Chinese Holidays functionality
 * 
 * This script tests the Chinese holidays service without impacting existing functionality.
 * Run with: node test-chinese-holidays.js
 */

const API_BASE = 'http://localhost:3000/api/holidays/chinese';

async function testChineseHolidays() {
  console.log('🎊 Testing Chinese Holidays Service...\n');

  try {
    // Test 1: Get current statistics
    console.log('📊 Test 1: Getting holiday statistics...');
    const statsResponse = await fetch(`${API_BASE}?stats=true`);
    const statsData = await statsResponse.json();
    console.log('Stats:', JSON.stringify(statsData, null, 2));
    console.log('✅ Stats test completed\n');

    // Test 2: Fetch holidays for 2024
    console.log('📅 Test 2: Fetching holidays for 2024...');
    const fetch2024Response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2024 })
    });
    const fetch2024Data = await fetch2024Response.json();
    console.log('2024 Fetch Result:', JSON.stringify(fetch2024Data, null, 2));
    console.log('✅ 2024 fetch test completed\n');

    // Test 3: Fetch holidays for 2025
    console.log('📅 Test 3: Fetching holidays for 2025...');
    const fetch2025Response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 2025 })
    });
    const fetch2025Data = await fetch2025Response.json();
    console.log('2025 Fetch Result:', JSON.stringify(fetch2025Data, null, 2));
    console.log('✅ 2025 fetch test completed\n');

    // Test 4: Get stored holidays for 2024
    console.log('📋 Test 4: Getting stored holidays for 2024...');
    const get2024Response = await fetch(`${API_BASE}?year=2024`);
    const get2024Data = await get2024Response.json();
    console.log('2024 Stored Holidays:', JSON.stringify(get2024Data, null, 2));
    console.log('✅ 2024 get test completed\n');

    // Test 5: Get stored holidays for 2025
    console.log('📋 Test 5: Getting stored holidays for 2025...');
    const get2025Response = await fetch(`${API_BASE}?year=2025`);
    const get2025Data = await get2025Response.json();
    console.log('2025 Stored Holidays:', JSON.stringify(get2025Data, null, 2));
    console.log('✅ 2025 get test completed\n');

    // Test 6: Final statistics
    console.log('📊 Test 6: Final statistics after all operations...');
    const finalStatsResponse = await fetch(`${API_BASE}?stats=true`);
    const finalStatsData = await finalStatsResponse.json();
    console.log('Final Stats:', JSON.stringify(finalStatsData, null, 2));
    console.log('✅ Final stats test completed\n');

    console.log('🎉 All tests completed successfully!');
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`- Total holidays stored: ${finalStatsData.stats?.totalHolidays || 0}`);
    console.log(`- Years covered: ${finalStatsData.stats?.yearsCovered?.join(', ') || 'None'}`);
    console.log(`- Last fetch: ${finalStatsData.stats?.lastFetch || 'Never'}`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testChineseHolidays();
}

module.exports = { testChineseHolidays };
