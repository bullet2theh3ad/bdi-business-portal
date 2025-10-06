#!/bin/bash

# Test curl command for Compal (CBN) to upload production file via API
# API Key: bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14
# File: Production Data Template R2 (Sep 12 2025).xlsx

echo "🏭 Testing CBN Production File Upload via API..."
echo "📁 File: Production Data Template R2 (Sep 12 2025).xlsx"
echo "🔑 API Key: bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14"
echo "🌐 Endpoint: /api/v1/production-files"
echo ""

# Production server URL
PROD_URL="https://bdibusinessportal.com"
# Local testing URL
LOCAL_URL="http://localhost:3000"

# Use production URL (change to LOCAL_URL for local testing)
BASE_URL="$PROD_URL"

# CBN API Key
API_KEY="bdi_cbn_529b84058b3db4bb38f37b1e4b92c1027dfc5b160edc214e85da74ee10b6df14"

# File path
FILE_PATH="public/Production Data Template R2 (Sep 12 2025).xlsx"

echo "📤 Uploading to: $BASE_URL/api/v1/production-files"
echo ""

curl -X POST "$BASE_URL/api/v1/production-files" \
  -H "Authorization: Bearer $API_KEY" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@$FILE_PATH" \
  -F "shipmentNumber=CBN-TEST-$(date +%Y%m%d)" \
  -F "description=Test production file upload from CBN via API" \
  -F "fileType=PRODUCTION_FILE" \
  -F "deviceType=Cable Modem" \
  -F "manufacturingDate=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  -F "tags=[\"test\", \"api-upload\", \"cbn\", \"production\"]" \
  -v

echo ""
echo "✅ Upload test completed!"
echo ""
echo "Expected response:"
echo "{"
echo "  \"success\": true,"
echo "  \"data\": {"
echo "    \"id\": \"uuid\","
echo "    \"fileName\": \"Production Data Template R2 (Sep 12 2025).xlsx\","
echo "    \"fileSize\": [file_size],"
echo "    \"shipmentNumber\": \"CBN-TEST-[timestamp]\","
echo "    \"organizationCode\": \"CBN\","
echo "    \"uploadUrl\": \"/api/v1/production-files/[uuid]\""
echo "  }"
echo "}"
