'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Building2, Plus, Shield } from 'lucide-react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabaseCLient';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Predefined company codes for RAG organization
const COMPANY_CODES = ['BDI', 'MTN', 'CBN', 'EMG', 'OLM'];

export default function RAGUploadPage() {
  const { data: user } = useSWR('/api/user', fetcher);
  const toast = ({ title, description, variant }: { title: string; description: string; variant?: 'destructive' }) => {
    alert(`${title}: ${description}`);
  };
  const [uploading, setUploading] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<string>('');
  const [newCompanyCode, setNewCompanyCode] = useState<string>('');
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Access control check
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <Shield className="w-12 h-12 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p>Only Super Admins can access the RAG Upload Center.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getCompanyCode = () => {
    if (showNewCompany && newCompanyCode) {
      return newCompanyCode.toUpperCase().substring(0, 3);
    }
    return selectedCompany;
  };

  const uploadFiles = async () => {
    if (!files.length || !getCompanyCode()) {
      toast({
        title: "Missing Information",
        description: "Please select a company and add files to upload.",
        variant: "destructive"
      });
      return;
    }

    console.log('🚀 Starting upload process...');
    console.log('📁 Company code:', getCompanyCode());
    console.log('📄 Files to upload:', files.map(f => f.name));

    setUploading(true);
    
    try {
      // Test Supabase connection
      console.log('🔌 Testing Supabase connection...');
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('❌ Supabase connection failed:', bucketsError);
        throw new Error(`Supabase connection failed: ${bucketsError.message}`);
      }
      console.log('✅ Supabase connected, found buckets:', buckets?.map(b => b.name));
      
      const companyCode = getCompanyCode();
      const uploadResults = [];

      for (const file of files) {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const filePath = `rag-documents/${companyCode}/${fileName}`;

        console.log(`📤 Uploading ${file.name} to ${filePath}...`);
        
        const { data, error } = await supabase.storage
          .from('organization-documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error(`❌ Upload failed for ${file.name}:`, error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          uploadResults.push({ file: file.name, success: false, error: error.message });
        } else {
          console.log(`✅ Successfully uploaded: ${file.name} to ${filePath}`);
          console.log('Upload data:', data);
          uploadResults.push({ file: file.name, success: true, path: filePath });
        }
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failCount = uploadResults.filter(r => !r.success).length;

      if (successCount > 0) {
        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${successCount} file(s) to ${companyCode} RAG directory.${failCount > 0 ? ` ${failCount} file(s) failed.` : ''}`,
        });
      }

      if (failCount > 0) {
        toast({
          title: "Some Uploads Failed",
          description: `${failCount} file(s) could not be uploaded. Check console for details.`,
          variant: "destructive"
        });
      }

      // Clear files after upload
      setFiles([]);
      setSelectedCompany('');
      setNewCompanyCode('');
      setShowNewCompany(false);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "An error occurred during upload. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  // Show loading state while fetching user data
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-6 w-6 text-red-600" />
          <h1 className="text-3xl font-bold">RAG Document Upload Center</h1>
        </div>
        <p className="text-muted-foreground">
          Super Admin only - Upload documents by company for enhanced AI analysis
        </p>
      </div>

      <div className="grid gap-6">
        {/* Company Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Selection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Existing Companies</Label>
                <select
                  value={showNewCompany ? '' : selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setShowNewCompany(false);
                    setNewCompanyCode('');
                  }}
                  disabled={showNewCompany}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select company...</option>
                  {COMPANY_CODES.map(code => (
                    <option key={code} value={code}>
                      {code} - {getCompanyName(code)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Or Create New Company</Label>
                <div className="flex gap-2">
                  <Button
                    variant={showNewCompany ? "default" : "outline"}
                    onClick={() => {
                      setShowNewCompany(!showNewCompany);
                      setSelectedCompany('');
                    }}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New
                  </Button>
                  {showNewCompany && (
                    <Input
                      placeholder="3-letter code"
                      value={newCompanyCode}
                      onChange={(e) => setNewCompanyCode(e.target.value.toUpperCase())}
                      maxLength={3}
                      className="w-32"
                    />
                  )}
                </div>
              </div>
            </div>
            
            {getCompanyCode() && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900">
                  📁 Files will be uploaded to: <code>rag-documents/{getCompanyCode()}/</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Document Upload Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Drop files here or click to select</h3>
              <p className="text-muted-foreground mb-4">
                Supports PDFs, Excel files, Word docs, images, and more
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
                accept=".pdf,.xlsx,.xls,.docx,.doc,.txt,.csv,.png,.jpg,.jpeg"
              />
              <Button
                onClick={() => document.getElementById('file-input')?.click()}
                variant="outline"
              >
                Select Files
              </Button>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="mt-6 space-y-2">
                <Label>Files to Upload ({files.length})</Label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm font-medium">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFile(index)}
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <div className="mt-6 flex justify-end">
              <Button
                onClick={uploadFiles}
                disabled={!files.length || !getCompanyCode() || uploading}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {uploading ? 'Uploading...' : `Upload to ${getCompanyCode() || 'Company'}`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>📚 Usage Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
              <p className="font-semibold text-yellow-900">🔒 Super Admin Only</p>
              <p className="text-yellow-800">This page is hidden and accessible only via direct URL for authorized administrators.</p>
            </div>
            
            <div>
              <p className="font-semibold">📁 File Organization:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Files uploaded to <code>rag-documents/[COMPANY]/</code></li>
                <li>Company codes: BDI, MTN, CBN, EMG, OLM, or create new 3-letter codes</li>
                <li>All file types supported: PDFs, Excel, Word, images, etc.</li>
              </ul>
            </div>

            <div>
              <p className="font-semibold">🧠 RAG Integration:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Documents automatically available in Ask BDI system</li>
                <li>AI can search and analyze content across all uploaded files</li>
                <li>Cross-references with database records for unified intelligence</li>
                <li>Supports company-specific document queries</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Helper function to get company display names
function getCompanyName(code: string): string {
  const names: Record<string, string> = {
    'BDI': 'Boundless Devices Inc',
    'MTN': 'MTN High-Technology',
    'CBN': 'Compal Broadband Networks',
    'EMG': 'EMG Warehouse',
    'OLM': 'OLM Logistics'
  };
  return names[code] || 'Unknown Company';
}
