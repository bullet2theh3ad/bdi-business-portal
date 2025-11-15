#!/usr/bin/env python3
"""
OL-USA AccessHub API Troubleshooting Script
Tests both Sandbox and Production endpoints
"""

import os
import json
import requests
from dotenv import load_dotenv

# Load env vars
load_dotenv('.env.local')

print("=" * 80)
print("🔍 OL-USA AccessHub API Diagnostic Tool")
print("=" * 80)

# Sandbox configuration (working)
SANDBOX_URL = "https://accesshub.uat-olxhub.app/move/"
SANDBOX_KEY = "259e2642-2269-48d6-91f9-be580f5c6f13"

# Production configuration
PRODUCTION_URL = os.getenv('OL_USA_API_URL', 'https://api.olxhub.app/move')
PRODUCTION_KEY = os.getenv('OL_USA_API_KEY', '')

print("\n📋 CONFIGURATION STATUS:")
print("-" * 80)
print(f"✅ Sandbox URL: {SANDBOX_URL}")
print(f"✅ Sandbox Key: {SANDBOX_KEY[:20]}...{SANDBOX_KEY[-10:]}")
print(f"\n{'✅' if PRODUCTION_URL else '❌'} Production URL: {PRODUCTION_URL}")
print(f"{'✅' if PRODUCTION_KEY else '❌'} Production Key: {PRODUCTION_KEY[:20] + '...' + PRODUCTION_KEY[-10:] if PRODUCTION_KEY else 'NOT SET'}")

# Test query - ShipmentDetailsV2
test_query = """
query ShipmentDetailsV2 {
  shipmentDetailsV2(
    reference: "SHIP123"
    verbose: true
  ) {
    shipmentStatus
    reference
    unitId
  }
}
"""

def test_endpoint(name, url, api_key):
    """Test an OL-USA endpoint"""
    print(f"\n\n🧪 TESTING: {name}")
    print("-" * 80)
    
    if not api_key:
        print(f"❌ SKIPPED: No API key configured for {name}")
        return
    
    try:
        print(f"📡 Endpoint: {url}")
        print(f"🔑 API Key: {api_key[:20]}...{api_key[-10:]}")
        
        headers = {
            'Content-Type': 'application/json',
            'ApiKey': api_key
        }
        
        payload = {'query': test_query}
        
        print(f"\n📤 Sending request...")
        response = requests.post(url, headers=headers, json=payload, timeout=10)
        
        print(f"\n📥 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ SUCCESS!")
            data = response.json()
            print("\n📄 Response Data:")
            print(json.dumps(data, indent=2)[:500])
        elif response.status_code == 401:
            print("❌ AUTHENTICATION FAILED (401 Unauthorized)")
            print("   The API key is invalid or expired")
            print(f"\n   Response: {response.text[:500]}")
        elif response.status_code == 404:
            print("⚠️  ENDPOINT NOT FOUND (404)")
            print("   The URL might be incorrect")
            print(f"\n   Response: {response.text[:500]}")
        else:
            print(f"❌ ERROR: HTTP {response.status_code}")
            print(f"\n   Response: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print("❌ TIMEOUT: Request took too long")
    except requests.exceptions.ConnectionError as e:
        print(f"❌ CONNECTION ERROR: {e}")
    except Exception as e:
        print(f"❌ UNEXPECTED ERROR: {e}")

# Test Sandbox
test_endpoint("SANDBOX", SANDBOX_URL, SANDBOX_KEY)

# Test Production
test_endpoint("PRODUCTION", PRODUCTION_URL, PRODUCTION_KEY)

# Check for common issues
print("\n\n🔍 COMMON ISSUES TO CHECK:")
print("=" * 80)
print("\n1. API Key Format:")
print("   ✓ Should be a UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx")
print(f"   Production Key Format: {'✅ Valid UUID format' if PRODUCTION_KEY and len(PRODUCTION_KEY) == 36 and PRODUCTION_KEY.count('-') == 4 else '❌ Invalid format'}")

print("\n2. Environment Variables:")
print("   Check .env.local file for:")
print("   OL_USA_API_URL=https://api.olxhub.app/move")
print("   OL_USA_API_KEY=your-production-key-here")

print("\n3. URL Format:")
print("   ✓ Should end with /move or /move/")
print(f"   Production URL: {'✅ Correct' if PRODUCTION_URL.endswith('/move') or PRODUCTION_URL.endswith('/move/') else '⚠️  Check format'}")

print("\n4. Next Steps:")
if not PRODUCTION_KEY:
    print("   ❌ Production API key is NOT configured")
    print("   → Contact OL-USA to get production credentials")
    print("   → Add them to .env.local file")
elif SANDBOX_KEY == PRODUCTION_KEY:
    print("   ⚠️  WARNING: Production key same as Sandbox!")
    print("   → You might be using sandbox key for production")
else:
    print("   ✅ Production key is configured and different from sandbox")
    print("   → If test failed, contact OL-USA to verify the key is active")

print("\n" + "=" * 80)

