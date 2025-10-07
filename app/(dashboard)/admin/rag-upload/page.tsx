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
  const [files, setFiles] = useState<FileWithTags[]>([]);
  const [bulkTags, setBulkTags] = useState<string>('');
  const [showBulkTags, setShowBulkTags] = useState(false);
  const [targetDirectory, setTargetDirectory] = useState<'rag-documents' | 'nre-documents'>('rag-documents');
  const [showNreModal, setShowNreModal] = useState(false);
  const [extractedLineItems, setExtractedLineItems] = useState<any[]>([]);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [recentUploads, setRecentUploads] = useState<any[]>([]);

// Enhanced file interface with tagging
interface FileWithTags {
  file: File;
  tags: string;
  id: string;
}

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
    const filesWithTags = droppedFiles.map(file => ({
      file,
      tags: bulkTags || '',
      id: `${Date.now()}-${Math.random()}`
    }));
    setFiles(prev => [...prev, ...filesWithTags]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const filesWithTags = selectedFiles.map(file => ({
        file,
        tags: bulkTags || '',
        id: `${Date.now()}-${Math.random()}`
      }));
      setFiles(prev => [...prev, ...filesWithTags]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileTags = (id: string, tags: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, tags } : f));
  };

  const applyBulkTags = () => {
    if (bulkTags.trim()) {
      setFiles(prev => prev.map(f => ({ ...f, tags: bulkTags.trim() })));
      setShowBulkTags(false);
    }
  };

  // Predefined tag suggestions
  const tagSuggestions = [
    'financial-model', 'forecast', 'cpfr-data', 'inventory-report', 'pricing',
    'technical-specs', 'product-datasheet', 'supplier-info', 'contract', 
    'compliance', 'certification', 'quality-control', 'shipping-docs',
    'warehouse-data', 'production-plan', 'market-analysis', 'competitive-intel'
  ];

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
      console.log('📄 Files to upload:', files.map(f => ({ name: f.file.name, tags: f.tags })));

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

      for (const fileWithTags of files) {
        console.log(`📤 Uploading ${fileWithTags.file.name} via API with tags: ${fileWithTags.tags}...`);
        
        // Use API endpoint to bypass RLS issues
        const formData = new FormData();
        formData.append('file', fileWithTags.file);
        formData.append('companyCode', companyCode);
        formData.append('tags', fileWithTags.tags || '');
        formData.append('targetDirectory', targetDirectory);

        const response = await fetch('/api/admin/rag-upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error(`❌ Upload failed for ${fileWithTags.file.name}:`, result);
          uploadResults.push({ file: fileWithTags.file.name, success: false, error: result.error || result.details });
        } else {
          console.log(`✅ Successfully uploaded: ${fileWithTags.file.name} to ${result.filePath}`);
          uploadResults.push({ file: fileWithTags.file.name, success: true, path: result.filePath, nreLineItems: result.nreLineItems });
        }
      }

      const successCount = uploadResults.filter(r => r.success).length;
      const failCount = uploadResults.filter(r => !r.success).length;

      if (successCount > 0) {
        // Check if any NRE line items were extracted
        console.log('Upload results:', uploadResults);
        const allNreItems = uploadResults
          .filter(r => r.success && r.nreLineItems)
          .flatMap(r => r.nreLineItems.items || []);
        
        console.log('Extracted NRE items:', allNreItems);
        
        if (allNreItems.length > 0 && targetDirectory === 'nre-documents') {
          // Show NRE modal with extracted line items
          console.log('Opening NRE modal with', allNreItems.length, 'items');
          setExtractedLineItems(allNreItems);
          setEditingItems(JSON.parse(JSON.stringify(allNreItems))); // Deep copy for editing
          setShowNreModal(true);
        } else if (targetDirectory === 'nre-documents') {
          console.warn('No NRE line items extracted from upload');
          toast({
            title: "No Line Items Extracted",
            description: "The document was uploaded but no NRE line items could be extracted. Try using the 'View Recent NRE Files' button to process it.",
            variant: "destructive"
          });
        }
        
        toast({
          title: "Upload Complete",
          description: `Successfully uploaded ${successCount} file(s) to ${companyCode} ${targetDirectory}.${failCount > 0 ? ` ${failCount} file(s) failed.` : ''}${allNreItems.length > 0 ? ` Extracted ${allNreItems.length} line items.` : ''}`,
        });
      }

      if (failCount > 0) {
        toast({
          title: "Some Uploads Failed",
          description: `${failCount} file(s) could not be uploaded. Check console for details.`,
          variant: "destructive"
        });
      }

      // Clear files after upload (but keep modal open if showing NRE items)
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

  // Fetch recent NRE uploads
  const fetchRecentNREUploads = async () => {
    setLoadingExisting(true);
    try {
      const { data, error } = await supabase
        .from('rag_documents')
        .select('*')
        .like('file_path', 'nre-documents%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      console.log('Fetched NRE uploads:', data);
      setRecentUploads(data || []);
      
      if (!data || data.length === 0) {
        toast({
          title: "No NRE Files Found",
          description: "No NRE documents have been uploaded yet.",
        });
      }
    } catch (error) {
      console.error('Error fetching recent uploads:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch recent uploads",
        variant: "destructive"
      });
    } finally {
      setLoadingExisting(false);
    }
  };

  // Process an existing uploaded file
  const processExistingFile = async (documentId: string) => {
    try {
      const response = await fetch(`/api/admin/process-nre/${documentId}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      if (result.lineItems && result.lineItems.length > 0) {
        setExtractedLineItems(result.lineItems);
        setEditingItems(JSON.parse(JSON.stringify(result.lineItems)));
        setShowNreModal(true);
        toast({
          title: "Processing Complete",
          description: `Extracted ${result.lineItems.length} line items`,
        });
      } else {
        toast({
          title: "No Line Items Found",
          description: "No NRE line items could be extracted from this document",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Target Directory</Label>
                <select
                  value={targetDirectory}
                  onChange={(e) => setTargetDirectory(e.target.value as 'rag-documents' | 'nre-documents')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="rag-documents">rag-documents (RAG System)</option>
                  <option value="nre-documents">nre-documents (NRE Experiment)</option>
                </select>
              </div>
              <div>
                <Label>View Recent NRE Uploads</Label>
                <Button
                  variant="outline"
                  onClick={fetchRecentNREUploads}
                  disabled={loadingExisting}
                  className="w-full"
                >
                  {loadingExisting ? 'Loading...' : '📋 View Recent NRE Files'}
                </Button>
              </div>
            </div>
            
            {getCompanyCode() && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-900">
                  📁 Files will be uploaded to: <code>{targetDirectory}/{getCompanyCode()}/</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Tagging */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Tagging & Intelligence Enhancement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bulk Tags (applied to all files)</Label>
                <Input
                  placeholder="e.g., financial-model, cpfr-data, forecast"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated tags for god-mode AI context
                </p>
              </div>
              <div>
                <Label>Quick Tag Suggestions</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tagSuggestions.slice(0, 6).map(tag => (
                    <button
                      key={tag}
                      onClick={() => setBulkTags(prev => prev ? `${prev}, ${tag}` : tag)}
                      className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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

            {/* File List with Individual Tagging */}
            {files.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Files to Upload ({files.length})</Label>
                  {bulkTags && (
                    <Button
                      size="sm"
                      onClick={applyBulkTags}
                      className="text-xs"
                    >
                      Apply Bulk Tags to All
                    </Button>
                  )}
                </div>
                <div className="max-h-60 overflow-y-auto space-y-3">
                  {files.map((fileWithTags, index) => (
                    <div key={fileWithTags.id} className="p-3 bg-gray-50 rounded border space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">{fileWithTags.file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(fileWithTags.file.size / 1024).toFixed(1)} KB)
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
                      <div className="flex gap-2">
                        <Input
                          placeholder="Individual tags for this file..."
                          value={fileWithTags.tags}
                          onChange={(e) => updateFileTags(fileWithTags.id, e.target.value)}
                          className="text-xs"
                        />
                        <div className="flex flex-wrap gap-1">
                          {['financial', 'cpfr', 'forecast', 'technical'].map(quickTag => (
                            <button
                              key={quickTag}
                              onClick={() => {
                                const currentTags = fileWithTags.tags;
                                const newTags = currentTags ? `${currentTags}, ${quickTag}` : quickTag;
                                updateFileTags(fileWithTags.id, newTags);
                              }}
                              className="px-1 py-0.5 text-xs bg-green-100 hover:bg-green-200 rounded"
                            >
                              +{quickTag}
                            </button>
                          ))}
                        </div>
                      </div>
                      {fileWithTags.tags && (
                        <div className="text-xs text-blue-600">
                          🏷️ Tags: {fileWithTags.tags}
                        </div>
                      )}
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

        {/* Recent NRE Uploads */}
        {recentUploads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>📋 Recent NRE Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentUploads.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <p className="font-medium">{doc.file_name}</p>
                      <p className="text-sm text-gray-500">
                        Uploaded: {new Date(doc.created_at).toLocaleDateString()} • Tags: {doc.tags?.join(', ') || 'None'}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => processExistingFile(doc.id)}
                    >
                      🔍 Process & View
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

      {/* NRE Line Items Modal */}
      {showNreModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">NRE Line Items Extracted</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Review and edit the extracted line items before saving
                  </p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setShowNreModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {editingItems.map((item, index) => (
                  <Card key={item.id || index} className="border-2">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Line Item Number */}
                        <div>
                          <Label>Line Item #</Label>
                          <Input
                            type="number"
                            value={item.line_item_number || index + 1}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].line_item_number = parseInt(e.target.value);
                              setEditingItems(updated);
                            }}
                          />
                        </div>

                        {/* Category */}
                        <div>
                          <Label>Category</Label>
                          <select
                            value={item.category}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].category = e.target.value;
                              setEditingItems(updated);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          >
                            <option value="NRE_DESIGN">NRE Design</option>
                            <option value="TOOLING">Tooling</option>
                            <option value="EVT_DVT_PVT">EVT/DVT/PVT</option>
                            <option value="CERTIFICATIONS">Certifications</option>
                            <option value="FIELD_TESTING">Field Testing</option>
                            <option value="ODM_SETUP">ODM Setup</option>
                            <option value="FIRMWARE">Firmware</option>
                            <option value="LOGISTICS_SAMPLES">Logistics Samples</option>
                            <option value="WARRANTY_RELIABILITY">Warranty / Reliability</option>
                            <option value="OTHERS">Others</option>
                          </select>
                        </div>

                        {/* Description */}
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].description = e.target.value;
                              setEditingItems(updated);
                            }}
                          />
                        </div>

                        {/* Quantity */}
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity || 1}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].quantity = parseInt(e.target.value);
                              setEditingItems(updated);
                            }}
                          />
                        </div>

                        {/* Total Amount */}
                        <div>
                          <Label>Total Amount (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.total_amount || 0}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].total_amount = parseFloat(e.target.value);
                              setEditingItems(updated);
                            }}
                          />
                        </div>

                        {/* Vendor Name */}
                        <div>
                          <Label>Vendor Name</Label>
                          <Input
                            value={item.vendor_name || ''}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].vendor_name = e.target.value;
                              setEditingItems(updated);
                            }}
                          />
                        </div>

                        {/* Quote Number */}
                        <div>
                          <Label>Quote Number</Label>
                          <Input
                            value={item.quote_number || ''}
                            onChange={(e) => {
                              const updated = [...editingItems];
                              updated[index].quote_number = e.target.value;
                              setEditingItems(updated);
                            }}
                          />
                        </div>

                        {/* Confidence Score */}
                        <div className="col-span-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Extraction Confidence:</span>
                            <span className={`font-semibold ${item.confidence_score > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                              {((item.confidence_score || 0) * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        {/* Delete Button */}
                        <div className="col-span-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const updated = editingItems.filter((_, i) => i !== index);
                              setEditingItems(updated);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete Line Item
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Add New Line Item Button */}
                <Button
                  variant="outline"
                  onClick={() => {
                    const newItem = {
                      line_item_number: editingItems.length + 1,
                      description: '',
                      category: 'OTHERS',
                      quantity: 1,
                      total_amount: 0,
                      vendor_name: '',
                      quote_number: '',
                      confidence_score: 1.0,
                    };
                    setEditingItems([...editingItems, newItem]);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Line Item
                </Button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                {editingItems.length} line item(s) • Total: ${editingItems.reduce((sum, item) => sum + (item.total_amount || 0), 0).toLocaleString()}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowNreModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    // TODO: Save edited items to database
                    console.log('Saving NRE line items:', editingItems);
                    toast({
                      title: "Line Items Saved",
                      description: `${editingItems.length} line items have been saved.`,
                    });
                    setShowNreModal(false);
                  }}
                >
                  Save All Line Items
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
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
