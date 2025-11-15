#!/usr/bin/env node
/**
 * OL-USA API Test Script
 * Test both Sandbox and Production API endpoints
 */

require('dotenv').config({ path: '.env.local' });

// Configuration
const SANDBOX_URL = 'https://accesshub.uat-olxhub.app/move/';
const SANDBOX_KEY = '259e2642-2269-48d6-91f9-be580f5c6f13';

const PRODUCTION_URL = process.env.OL_USA_API_URL || 'https://api.olxhub.app/move';
const PRODUCTION_KEY = process.env.OL_USA_API_KEY || '';

console.log('=' .repeat(80));
console.log('🚢 OL-USA API DIAGNOSTIC TEST');
console.log('=' .repeat(80));

console.log('\n📋 CONFIGURATION:');
console.log('─'.repeat(80));
console.log('Sandbox URL:', SANDBOX_URL);
console.log('Sandbox Key:', SANDBOX_KEY.substring(0, 8) + '...');
console.log('Production URL:', PRODUCTION_URL);
console.log('Production Key:', PRODUCTION_KEY ? (PRODUCTION_KEY.substring(0, 8) + '...') : '❌ MISSING');

// Test query for fullTransportDetails
const TEST_REFERENCE = 'TEST123'; // You can change this

const fullTransportQuery = `
  query {
    fullTransportDetails(reference: "${TEST_REFERENCE}") {
      reference
      shipmentStatus
      containers {
        unitId
        containerSizeClass
      }
    }
  }
`;

async function testAPI(environment, url, apiKey) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TESTING ${environment.toUpperCase()} ENVIRONMENT`);
  console.log('─'.repeat(80));
  console.log(`URL: ${url}`);
  console.log(`API Key: ${apiKey ? (apiKey.substring(0, 12) + '...') : '❌ MISSING'}`);
  
  if (!apiKey) {
    console.log('❌ ERROR: API key is missing for', environment);
    return false;
  }
  
  try {
    console.log('\n📤 Sending request...');
    console.log('Query:', fullTransportQuery.substring(0, 100) + '...');
    
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ApiKey': apiKey,
      },
      body: JSON.stringify({ 
        query: fullTransportQuery 
      }),
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`\n📥 Response received (${duration}ms)`);
    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('\n❌ ERROR RESPONSE:');
      console.log(errorText);
      
      if (response.status === 401) {
        console.log('\n💡 DIAGNOSIS: Authentication failed (401 Unauthorized)');
        console.log('   Possible causes:');
        console.log('   1. API key is invalid or expired');
        console.log('   2. API key is for wrong environment (sandbox key used for prod, or vice versa)');
        console.log('   3. API key does not have proper permissions');
        console.log('\n   ✅ SOLUTION: Contact OL-USA to verify/regenerate API key');
      } else if (response.status === 404) {
        console.log('\n💡 DIAGNOSIS: Endpoint not found (404)');
        console.log('   Possible causes:');
        console.log('   1. URL is incorrect (check trailing slash)');
        console.log('   2. API endpoint path has changed');
        console.log('\n   ✅ SOLUTION: Verify correct URL with OL-USA');
      } else if (response.status === 400) {
        console.log('\n💡 DIAGNOSIS: Bad Request (400)');
        console.log('   Possible causes:');
        console.log('   1. GraphQL query syntax error');
        console.log('   2. Missing required parameters');
      }
      
      return false;
    }
    
    const data = await response.json();
    
    console.log('\n✅ SUCCESS RESPONSE:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check for GraphQL errors
    if (data.errors) {
      console.log('\n⚠️  GraphQL ERRORS:');
      console.log(JSON.stringify(data.errors, null, 2));
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.log('\n❌ REQUEST FAILED:');
    console.log('Error:', error.message);
    console.log('\n💡 DIAGNOSIS: Network or connection error');
    console.log('   Possible causes:');
    console.log('   1. DNS resolution failure');
    console.log('   2. SSL/TLS certificate issue');
    console.log('   3. Firewall blocking request');
    console.log('   4. URL format issue');
    return false;
  }
}

async function main() {
  // Test Sandbox
  const sandboxSuccess = await testAPI('sandbox', SANDBOX_URL, SANDBOX_KEY);
  
  // Test Production
  const productionSuccess = await testAPI('production', PRODUCTION_URL, PRODUCTION_KEY);
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Sandbox:    ${sandboxSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Production: ${productionSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (sandboxSuccess && !productionSuccess) {
    console.log('\n🔍 ANALYSIS:');
    console.log('   Sandbox works but Production fails.');
    console.log('\n   Most likely causes:');
    console.log('   1. ❌ Production API key is invalid/expired');
    console.log('   2. ❌ Production URL is incorrect');
    console.log('   3. ❌ Production API key does not have access to this environment');
    console.log('\n   Recommended actions:');
    console.log('   ✅ Verify production URL with OL-USA: Should it be https://api.olxhub.app/move ?');
    console.log('   ✅ Request new production API key from OL-USA');
    console.log('   ✅ Confirm API key permissions with OL-USA');
  }
  
  console.log('\n' + '='.repeat(80));
}

main().catch(console.error);

