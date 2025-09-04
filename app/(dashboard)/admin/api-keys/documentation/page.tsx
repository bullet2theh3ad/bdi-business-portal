'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Separator } from '@/components/ui/separator';

export default function ApiDocumentationPage() {
  return (
    <div className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <SemanticBDIIcon semantic="reports" size={32} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">BDI Business Portal API Documentation</h1>
            <p className="text-muted-foreground text-sm sm:text-base">REST API documentation for external partner integration</p>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="connect" size={20} className="mr-2" />
            Quick Start Guide
          </CardTitle>
          <CardDescription>Get started with the BDI Business Portal API</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">1. Authentication</h3>
              <p className="text-sm text-gray-600 mb-2">All API requests require authentication using your API key:</p>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                Authorization: Bearer YOUR_API_KEY_HERE
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">2. Base URL</h3>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                https://www.bdibusinessportal.com/api/v1
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">3. Response Format</h3>
              <p className="text-sm text-gray-600 mb-2">All responses follow a consistent JSON format:</p>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                {`{
  "success": true,
  "data": [...],
  "pagination": {...},
  "meta": {...}
}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production Files API */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="analytics" size={20} className="mr-2" />
            Production Files API
          </CardTitle>
          <CardDescription>Access production files and device data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* List Production Files */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-blue-600">GET</Badge>
                <code className="text-sm">/production-files</code>
              </div>
              <p className="text-sm text-gray-600 mb-3">Retrieve a list of production files you have access to</p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Query Parameters:</h4>
                  <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                    <div><code>limit</code> - Number of files to return (default: 100, max: 1000)</div>
                    <div><code>offset</code> - Number of files to skip for pagination (default: 0)</div>
                    <div><code>organization</code> - Filter by organization code (e.g., "MTN")</div>
                    <div><code>shipment_id</code> - Filter by BDI shipment number</div>
                    <div><code>file_type</code> - Filter by file type ("production", "testing", etc.)</div>
                    <div><code>from_date</code> - Filter files created after this date (ISO format)</div>
                    <div><code>to_date</code> - Filter files created before this date (ISO format)</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Example Request:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                    {`curl -H "Authorization: Bearer bdi_gpn_abc123..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files?limit=50&organization=MTN"`}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Example Response:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs overflow-x-auto">
                    {`{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "fileName": "MTN_Production_Q1_2025.xlsx",
      "fileSize": 2048000,
      "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "shipmentNumber": "BDI-2025-001234",
      "deviceCount": 5000,
      "fileType": "production",
      "organizationCode": "MTN",
      "organizationName": "Mountain Networks",
      "description": "Q1 2025 production run data",
      "tags": ["Q1", "2025", "routers"],
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z",
      "downloadUrl": "/api/v1/production-files/550e8400-e29b-41d4-a716-446655440000/download"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "meta": {
    "organization": "GPN",
    "permissions": ["production_files_read", "production_files_download"],
    "rateLimitRemaining": 995
  }
}`}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Upload Production File */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-orange-600">POST</Badge>
                <code className="text-sm">/production-files</code>
              </div>
              <p className="text-sm text-gray-600 mb-3">Upload a production file from your factory systems</p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Request Format (multipart/form-data):</h4>
                  <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
                    <div><code>file</code> - The production file (Excel, CSV, TXT, JSON)</div>
                    <div><code>shipmentNumber</code> - BDI shipment number (optional, auto-generated if not provided)</div>
                    <div><code>description</code> - File description (optional)</div>
                    <div><code>tags</code> - JSON array of tags or comma-separated string (optional)</div>
                    <div><code>manufacturingDate</code> - Manufacturing date in ISO format (optional)</div>
                    <div><code>deviceType</code> - Type of devices in this production run (optional)</div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Example Request:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                    {`curl -X POST \\
     -H "Authorization: Bearer bdi_mtn_abc123..." \\
     -F "file=@production_data_Q1_2025.xlsx" \\
     -F "description=Q1 2025 production run - Routers" \\
     -F "deviceType=Router" \\
     -F "manufacturingDate=2025-01-15T00:00:00Z" \\
     -F "tags=[\\"Q1\\",\\"2025\\",\\"routers\\"]" \\
     "https://www.bdibusinessportal.com/api/v1/production-files"`}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Example Response:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs overflow-x-auto">
                    {`{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "fileName": "production_data_Q1_2025.xlsx",
    "fileSize": 2048000,
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "shipmentNumber": "BDI-2025-574919",
    "deviceCount": 5000,
    "organizationCode": "MTN",
    "organizationName": "Mountain Networks",
    "description": "Q1 2025 production run - Routers",
    "tags": ["Q1", "2025", "routers"],
    "createdAt": "2025-01-15T10:30:00Z",
    "uploadUrl": "/api/v1/production-files/550e8400-e29b-41d4-a716-446655440000"
  },
  "meta": {
    "organization": "MTN",
    "uploadedBy": "admin@mtn.com",
    "uploadedAt": "2025-01-15T10:30:00Z",
    "apiKeyUsed": "MTN Factory Integration"
  }
}`}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Download Production File */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-green-600">GET</Badge>
                <code className="text-sm">/production-files/{'{id}'}/download</code>
              </div>
              <p className="text-sm text-gray-600 mb-3">Download a specific production file</p>
              
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Example Request:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                    {`curl -H "Authorization: Bearer bdi_gpn_abc123..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files/550e8400-e29b-41d4-a716-446655440000/download"`}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Example Response:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                    {`{
  "success": true,
  "data": {
    "downloadUrl": "https://supabase-signed-url...",
    "fileName": "MTN_Production_Q1_2025.xlsx",
    "fileSize": 2048000,
    "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "expiresAt": "2025-01-15T11:30:00Z"
  },
  "meta": {
    "organization": "GPN",
    "fileId": "550e8400-e29b-41d4-a716-446655440000"
  }
}`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Authentication */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="security" size={20} className="mr-2" />
            Authentication & Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">API Key Authentication</h3>
              <p className="text-sm text-gray-600 mb-2">Include your API key in the Authorization header of every request:</p>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-sm">
                Authorization: Bearer bdi_gpn_1234567890abcdef...
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Rate Limiting</h3>
              <p className="text-sm text-gray-600 mb-2">API keys have rate limits to ensure system stability:</p>
              <ul className="text-sm text-gray-600 space-y-1 ml-4">
                <li>• Default: 1,000 requests per hour</li>
                <li>• Rate limit status included in response headers</li>
                <li>• Contact BDI for higher limits if needed</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Error Handling</h3>
              <p className="text-sm text-gray-600 mb-2">All errors return consistent JSON format:</p>
              <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                {`{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}`}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <strong>Common Error Codes:</strong> AUTHENTICATION_FAILED, INSUFFICIENT_PERMISSIONS, RATE_LIMIT_EXCEEDED, FILE_NOT_FOUND, ACCESS_DENIED
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SDK Examples */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="collaboration" size={20} className="mr-2" />
            Integration Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Python Example */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center">
                🐍 Python Example
              </h3>
              <div className="bg-gray-100 p-4 rounded-md font-mono text-sm overflow-x-auto">
                {`import requests
import json

# Configuration
API_KEY = "bdi_gpn_1234567890abcdef..."
BASE_URL = "https://www.bdibusinessportal.com/api/v1"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Upload a production file (for ODM partners like MTN)
def upload_production_file(file_path, description=None):
    files = {'file': open(file_path, 'rb')}
    data = {
        'description': description or f"Production file from {file_path}",
        'deviceType': 'Router',
        'manufacturingDate': '2025-01-15T00:00:00Z',
        'tags': '["Q1", "2025", "production"]'
    }
    
    response = requests.post(f"{BASE_URL}/production-files", 
                           headers=headers, files=files, data=data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ Uploaded: {result['data']['fileName']}")
        print(f"   Shipment: {result['data']['shipmentNumber']}")
        print(f"   Devices: {result['data']['deviceCount']}")
        return result['data']['id']
    else:
        print(f"❌ Upload failed: {response.json()['error']}")
        return None

# Upload production files
file_id = upload_production_file("production_data_Q1_2025.xlsx", 
                                "Q1 2025 Router Production Run")

# Get production files
response = requests.get(f"{BASE_URL}/production-files", headers=headers)
data = response.json()

if data["success"]:
    print(f"Found {len(data['data'])} files")
    for file in data["data"]:
        print(f"- {file['fileName']} ({file['organizationCode']})")
        
        # Download file
        download_response = requests.get(
            f"{BASE_URL}/production-files/{file['id']}/download", 
            headers=headers
        )
        download_data = download_response.json()
        
        if download_data["success"]:
            file_url = download_data["data"]["downloadUrl"]
            # Download the actual file
            file_response = requests.get(file_url)
            with open(f"downloaded_{file['fileName']}", "wb") as f:
                f.write(file_response.content)
            print(f"Downloaded: {file['fileName']}")
else:
    print(f"Error: {data['error']}")
`}
              </div>
            </div>

            <Separator />

            {/* JavaScript/Node.js Example */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center">
                🟨 JavaScript/Node.js Example
              </h3>
              <div className="bg-gray-100 p-4 rounded-md font-mono text-sm overflow-x-auto">
                {`const axios = require('axios');
const fs = require('fs');

// Configuration
const API_KEY = 'bdi_gpn_1234567890abcdef...';
const BASE_URL = 'https://www.bdibusinessportal.com/api/v1';

const headers = {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json'
};

// Get production files
async function getProductionFiles() {
    try {
        const response = await axios.get(\`\${BASE_URL}/production-files\`, { headers });
        
        if (response.data.success) {
            console.log(\`Found \${response.data.data.length} files\`);
            
            for (const file of response.data.data) {
                console.log(\`- \${file.fileName} (\${file.organizationCode})\`);
                
                // Download file
                const downloadResponse = await axios.get(
                    \`\${BASE_URL}/production-files/\${file.id}/download\`,
                    { headers }
                );
                
                if (downloadResponse.data.success) {
                    const fileUrl = downloadResponse.data.data.downloadUrl;
                    
                    // Download the actual file
                    const fileResponse = await axios.get(fileUrl, { 
                        responseType: 'stream' 
                    });
                    
                    const writer = fs.createWriteStream(file.fileName);
                    fileResponse.data.pipe(writer);
                    
                    console.log(\`Downloaded: \${file.fileName}\`);
                }
            }
        } else {
            console.error('Error:', response.data.error);
        }
    } catch (error) {
        console.error('Request failed:', error.message);
    }
}

getProductionFiles();
`}
              </div>
            </div>

            <Separator />

            {/* cURL Example */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center">
                🔧 cURL Examples
              </h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">List Production Files:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                    {`curl -H "Authorization: Bearer bdi_gpn_1234567890abcdef..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files?limit=10&organization=MTN"`}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm">Download File:</h4>
                  <div className="bg-gray-100 p-3 rounded-md font-mono text-xs">
                    {`curl -H "Authorization: Bearer bdi_gpn_1234567890abcdef..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files/FILE_ID/download"`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Reference */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="reports" size={20} className="mr-2" />
            API Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Endpoints Table */}
            <div>
              <h3 className="font-semibold mb-3">Available Endpoints</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-300 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-3 py-2 text-left">Method</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Endpoint</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Permission Required</th>
                      <th className="border border-gray-300 px-3 py-2 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2"><Badge className="bg-blue-600">GET</Badge></td>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">/production-files</td>
                      <td className="border border-gray-300 px-3 py-2">production_files_read</td>
                      <td className="border border-gray-300 px-3 py-2">List production files</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2"><Badge className="bg-orange-600">POST</Badge></td>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">/production-files</td>
                      <td className="border border-gray-300 px-3 py-2">production_files_upload</td>
                      <td className="border border-gray-300 px-3 py-2">Upload production files</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2"><Badge className="bg-green-600">GET</Badge></td>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">/production-files/{'{id}'}/download</td>
                      <td className="border border-gray-300 px-3 py-2">production_files_download</td>
                      <td className="border border-gray-300 px-3 py-2">Download production file</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2"><Badge className="bg-blue-600">GET</Badge></td>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">/forecasts</td>
                      <td className="border border-gray-300 px-3 py-2">forecasts_read</td>
                      <td className="border border-gray-300 px-3 py-2">List sales forecasts (Coming Soon)</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-3 py-2"><Badge className="bg-blue-600">GET</Badge></td>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">/invoices</td>
                      <td className="border border-gray-300 px-3 py-2">invoices_read</td>
                      <td className="border border-gray-300 px-3 py-2">List invoices (Coming Soon)</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-300 px-3 py-2"><Badge className="bg-blue-600">GET</Badge></td>
                      <td className="border border-gray-300 px-3 py-2 font-mono text-xs">/shipments</td>
                      <td className="border border-gray-300 px-3 py-2">shipments_read</td>
                      <td className="border border-gray-300 px-3 py-2">List shipments (Coming Soon)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="collaboration" size={20} className="mr-2" />
            Support & Contact
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium">Technical Support</h4>
              <p className="text-sm text-gray-600">For API integration support, technical questions, or issues:</p>
              <p className="text-sm"><strong>Email:</strong> <a href="mailto:api-support@boundlessdevices.com" className="text-blue-600">api-support@boundlessdevices.com</a></p>
            </div>
            
            <div>
              <h4 className="font-medium">Business Development</h4>
              <p className="text-sm text-gray-600">For partnership opportunities, additional permissions, or business inquiries:</p>
              <p className="text-sm"><strong>Email:</strong> <a href="mailto:partnerships@boundlessdevices.com" className="text-blue-600">partnerships@boundlessdevices.com</a></p>
            </div>
            
            <div>
              <h4 className="font-medium">Status Page</h4>
              <p className="text-sm text-gray-600">Check API uptime and service status:</p>
              <p className="text-sm"><strong>URL:</strong> <a href="#" className="text-blue-600">status.boundlessdevices.com</a></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
