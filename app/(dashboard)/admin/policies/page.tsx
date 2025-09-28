'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { User } from '@/lib/db/schema';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

interface PolicyDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: string;
  description?: string;
  category?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Policy category configurations with colors and icons
const policyCategories = {
  database: {
    name: 'Database & Backup',
    color: 'bg-purple-100 border-purple-200 text-purple-800',
    iconColor: 'text-purple-600',
    icon: 'analytics' as const,
    badgeColor: 'bg-purple-100 text-purple-800'
  },
  security: {
    name: 'Security & Access',
    color: 'bg-red-100 border-red-200 text-red-800',
    iconColor: 'text-red-600',
    icon: 'lock' as const,
    badgeColor: 'bg-red-100 text-red-800'
  },
  operations: {
    name: 'Operations & Procedures',
    color: 'bg-blue-100 border-blue-200 text-blue-800',
    iconColor: 'text-blue-600',
    icon: 'settings' as const,
    badgeColor: 'bg-blue-100 text-blue-800'
  },
  compliance: {
    name: 'Compliance & Legal',
    color: 'bg-yellow-100 border-yellow-200 text-yellow-800',
    iconColor: 'text-yellow-600',
    icon: 'legal' as const,
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  hr: {
    name: 'Human Resources',
    color: 'bg-green-100 border-green-200 text-green-800',
    iconColor: 'text-green-600',
    icon: 'users' as const,
    badgeColor: 'bg-green-100 text-green-800'
  },
  finance: {
    name: 'Finance & Accounting',
    color: 'bg-emerald-100 border-emerald-200 text-emerald-800',
    iconColor: 'text-emerald-600',
    icon: 'currency' as const,
    badgeColor: 'bg-emerald-100 text-emerald-800'
  },
  it: {
    name: 'IT & Technology',
    color: 'bg-indigo-100 border-indigo-200 text-indigo-800',
    iconColor: 'text-indigo-600',
    icon: 'tech' as const,
    badgeColor: 'bg-indigo-100 text-indigo-800'
  },
  other: {
    name: 'Other',
    color: 'bg-gray-100 border-gray-200 text-gray-800',
    iconColor: 'text-gray-600',
    icon: 'document' as const,
    badgeColor: 'bg-gray-100 text-gray-800'
  }
};

// Get category configuration
const getCategoryConfig = (category: string) => {
  return policyCategories[category as keyof typeof policyCategories] || policyCategories.other;
};

export default function PoliciesPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  const { data: policies, mutate: mutatePolicies } = useSWR<PolicyDocument[]>('/api/admin/policies', fetcher);

  // State management
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Default to grid as requested
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPolicy, setPreviewPolicy] = useState<PolicyDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Handle document preview
  const handlePreview = async (policy: PolicyDocument) => {
    try {
      // Generate signed URL for preview
      const response = await fetch('/api/admin/policies/preview-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: policy.filePath })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewPolicy(policy);
        setPreviewUrl(data.url);
        setShowPreviewModal(true);
      } else {
        alert('Failed to generate preview');
      }
    } catch (error) {
      console.error('Preview error:', error);
      alert('Error generating preview');
    }
  };

  // Handle document download
  const handleDownload = async (policy: PolicyDocument) => {
    try {
      const response = await fetch('/api/admin/policies/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: policy.filePath })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = policy.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        alert('Failed to download document');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading document');
    }
  };

  // Handle document deletion
  const handleDelete = async (policy: PolicyDocument) => {
    if (confirm(`Are you sure you want to delete "${policy.fileName}"? This action cannot be undone.`)) {
      try {
        const response = await fetch('/api/admin/policies/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: policy.filePath })
        });

        if (response.ok) {
          alert('✅ Policy document deleted successfully');
          mutatePolicies();
        } else {
          alert('❌ Failed to delete document');
        }
      } catch (error) {
        console.error('Delete error:', error);
        alert('❌ Error deleting document');
      }
    }
  };

  // Access control - only BDI users can access policies
  if (!user?.organization || user.organization.code !== 'BDI') {
    return (
      <div className="flex-1 p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <SemanticBDIIcon semantic="lock" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
              <p className="text-muted-foreground">Policy management is only available to BDI internal users.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // File upload handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    setSelectedFiles(files);
    setShowUploadModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      setShowUploadModal(true);
    }
  };

  const handleUpload = async (formData: FormData) => {
    setIsUploading(true);
    try {
      const response = await fetch('/api/admin/policies', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        alert('✅ Policy document uploaded successfully!');
        mutatePolicies(); // Refresh the list
        setShowUploadModal(false);
        setSelectedFiles([]);
      } else {
        const errorData = await response.json();
        alert(`❌ Upload failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('❌ Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Filter policies based on search
  const filteredPolicies = (policies || []).filter(policy =>
    policy.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (policy.description && policy.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="document" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Business Policies</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Manage BDI business policy documents</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              onClick={() => mutatePolicies()}
              className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white w-full sm:w-auto"
            >
              <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
              Refresh
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" 
              onClick={() => setShowUploadModal(true)}
            >
              <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
              Upload Policy Document
            </Button>
          </div>
        </div>
      </div>

      {/* Search and View Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search policy documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <SemanticBDIIcon semantic="grid" size={16} className="mr-2" />
            Grid
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <SemanticBDIIcon semantic="list" size={16} className="mr-2" />
            List
          </Button>
        </div>
      </div>

      {/* Policy Documents Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="document" size={20} />
            <span>Policy Documents ({filteredPolicies.length})</span>
          </CardTitle>
          <CardDescription>
            Business policy documents that define BDI portal operations and procedures
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPolicies.length === 0 ? (
            <div 
              className={`border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-blue-400 bg-blue-50' : 'hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
            >
              <SemanticBDIIcon semantic="document" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Policy Documents</h3>
              <p className="text-muted-foreground mb-4">Upload your first policy document to start building the policy library</p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => mutatePolicies()}
                  className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white"
                >
                  <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
                  Refresh
                </Button>
                <Button onClick={() => setShowUploadModal(true)}>
                  <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                  Upload First Policy Document
                </Button>
              </div>
              <div className="mt-4 text-sm text-gray-500">
                Or drag and drop files here
              </div>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 
              'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6' : 
              'space-y-3'
            }>
              {filteredPolicies.map((policy) => {
                const categoryConfig = getCategoryConfig(policy.category || 'other');
                const uploadDate = new Date(policy.uploadedAt);
                
                return (
                  <div 
                    key={policy.id} 
                    className={`${categoryConfig.color} rounded-lg p-4 sm:p-6 transition-all duration-200 hover:shadow-lg transform hover:scale-105 ${
                      viewMode === 'list' ? 'flex items-center justify-between' : ''
                    }`}
                  >
                    <div className={viewMode === 'grid' ? 'space-y-4' : 'flex-1 flex items-center space-x-4'}>
                      {/* Category Icon & Badge */}
                      <div className={`flex items-center ${viewMode === 'grid' ? 'justify-between' : 'space-x-3'}`}>
                        <div className="flex items-center space-x-3">
                          <div className={`p-3 rounded-full bg-white/50 ${viewMode === 'grid' ? '' : 'flex-shrink-0'}`}>
                            <SemanticBDIIcon 
                              semantic={categoryConfig.icon} 
                              size={viewMode === 'grid' ? 24 : 20} 
                              className={categoryConfig.iconColor} 
                            />
                          </div>
                          {viewMode === 'list' && (
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base truncate">{policy.fileName}</h3>
                              {policy.description && (
                                <p className="text-xs sm:text-sm opacity-75 mt-1 truncate">{policy.description}</p>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge className={`${categoryConfig.badgeColor} text-xs font-medium ${viewMode === 'list' ? 'flex-shrink-0' : ''}`}>
                          {categoryConfig.name}
                        </Badge>
                      </div>

                      {/* Document Details (Grid View) */}
                      {viewMode === 'grid' && (
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-sm sm:text-base line-clamp-2">{policy.fileName}</h3>
                            {policy.description && (
                              <p className="text-xs sm:text-sm opacity-75 mt-1 line-clamp-2">{policy.description}</p>
                            )}
                          </div>
                          
                          {/* Digital Fingerprint */}
                          <div className="space-y-2 text-xs sm:text-sm opacity-75">
                            <div className="flex items-center justify-between">
                              <span>📁 Size:</span>
                              <span className="font-mono">{(policy.fileSize / 1024).toFixed(1)} KB</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>📅 Uploaded:</span>
                              <span className="font-mono">{uploadDate.toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>🕒 Time:</span>
                              <span className="font-mono">{uploadDate.toLocaleTimeString()}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>👤 By:</span>
                              <span className="font-mono text-xs">{policy.uploadedBy}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Digital Fingerprint (List View) */}
                      {viewMode === 'list' && (
                        <div className="flex-shrink-0 text-right text-xs sm:text-sm opacity-75 space-y-1">
                          <div>{(policy.fileSize / 1024).toFixed(1)} KB</div>
                          <div className="font-mono">{uploadDate.toLocaleDateString()}</div>
                          <div className="font-mono">{uploadDate.toLocaleTimeString()}</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    {viewMode === 'list' && (
                      <div className="flex space-x-2 ml-4 flex-shrink-0">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(policy);
                          }}
                          className="bg-white/50 hover:bg-white text-blue-600 border-blue-300"
                        >
                          <SemanticBDIIcon semantic="view" size={14} className="mr-1" />
                          Preview
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(policy);
                          }}
                          className="bg-white/50 hover:bg-white text-green-600 border-green-300"
                        >
                          <SemanticBDIIcon semantic="download" size={14} className="mr-1" />
                          Download
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(policy);
                          }}
                          className="bg-white/50 hover:bg-white text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50"
                        >
                          <SemanticBDIIcon semantic="delete" size={14} />
                        </Button>
                      </div>
                    )}
                    
                    {/* Grid View Action Buttons */}
                    {viewMode === 'grid' && (
                      <div className="mt-4 pt-3 border-t border-white/30">
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 bg-white/50 hover:bg-white text-blue-600 border-blue-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(policy);
                            }}
                          >
                            <SemanticBDIIcon semantic="view" size={14} className="mr-1" />
                            Preview
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 bg-white/50 hover:bg-white text-green-600 border-green-300"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(policy);
                            }}
                          >
                            <SemanticBDIIcon semantic="download" size={14} className="mr-1" />
                            Download
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="bg-white/50 hover:bg-white text-red-600 hover:text-red-700 border-red-300 hover:border-red-400 hover:bg-red-50 px-3"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(policy);
                            }}
                          >
                            <SemanticBDIIcon semantic="delete" size={14} />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[800px] h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <SemanticBDIIcon semantic="plus" size={20} className="mr-2" />
              Upload Policy Document
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            
            // Add selected files
            selectedFiles.forEach((file, index) => {
              formData.append(`file${index}`, file);
            });
            formData.append('fileCount', selectedFiles.length.toString());
            
            handleUpload(formData);
          }} className="space-y-6 p-4">
            
            {/* File Selection */}
            <div className="space-y-4">
              <Label className="text-lg font-medium">Select Policy Documents</Label>
              
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
              >
                <SemanticBDIIcon semantic="upload" size={32} className="mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">
                  Drag and drop policy documents here, or click to select
                </p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.md,.html"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="policy-file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('policy-file-input')?.click()}
                >
                  Select Files
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: PDF, DOC, DOCX, TXT, MD, HTML
                </p>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Selected Files:</Label>
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                      <div className="flex items-center space-x-2">
                        <SemanticBDIIcon semantic="document" size={16} className="text-blue-600" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Document Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">Policy Category</Label>
                <select
                  id="category"
                  name="category"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                >
                  <option value="">Select Category</option>
                  <option value="database">Database & Backup</option>
                  <option value="security">Security & Access</option>
                  <option value="operations">Operations & Procedures</option>
                  <option value="compliance">Compliance & Legal</option>
                  <option value="hr">Human Resources</option>
                  <option value="finance">Finance & Accounting</option>
                  <option value="it">IT & Technology</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Brief description of this policy"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFiles([]);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isUploading || selectedFiles.length === 0}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isUploading ? (
                  <>
                    <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                    Upload {selectedFiles.length} Document{selectedFiles.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Document Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="w-[95vw] h-[90vh] p-0" style={{ maxWidth: 'none' }}>
          <DialogHeader className="p-4 border-b">
            <DialogTitle className="flex items-center">
              <SemanticBDIIcon semantic="view" size={20} className="mr-2" />
              Preview: {previewPolicy?.fileName}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden">
            {previewPolicy && previewUrl && (
              <div className="h-full">
                {/* PDF Preview */}
                {previewPolicy.contentType === 'application/pdf' || previewPolicy.fileName.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title={`Preview: ${previewPolicy.fileName}`}
                  />
                ) : 
                /* Document Preview for DOC/DOCX */
                previewPolicy.fileName.toLowerCase().endsWith('.doc') || previewPolicy.fileName.toLowerCase().endsWith('.docx') ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50">
                    <SemanticBDIIcon semantic="document" size={64} className="text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Document Preview</h3>
                    <p className="text-gray-600 mb-4 text-center">
                      Word documents cannot be previewed directly in the browser.
                    </p>
                    <div className="flex space-x-3">
                      <Button
                        onClick={() => handleDownload(previewPolicy)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <SemanticBDIIcon semantic="download" size={16} className="mr-2" />
                        Download to View
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          // Try to open with Office Online
                          window.open(`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`, '_blank');
                        }}
                      >
                        <SemanticBDIIcon semantic="view" size={16} className="mr-2" />
                        Open in Office Online
                      </Button>
                    </div>
                  </div>
                ) :
                /* Text/Markdown/HTML Preview */
                previewPolicy.fileName.toLowerCase().endsWith('.txt') || 
                previewPolicy.fileName.toLowerCase().endsWith('.md') || 
                previewPolicy.fileName.toLowerCase().endsWith('.html') ? (
                  <div className="h-full overflow-y-auto p-6 bg-white">
                    <div className="max-w-4xl mx-auto">
                      <iframe
                        src={previewUrl}
                        className="w-full min-h-[600px] border border-gray-300 rounded"
                        title={`Preview: ${previewPolicy.fileName}`}
                      />
                    </div>
                  </div>
                ) : (
                  /* Fallback for other file types */
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-gray-50">
                    <SemanticBDIIcon semantic="document" size={64} className="text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Preview Not Available</h3>
                    <p className="text-gray-600 mb-4 text-center">
                      This file type cannot be previewed directly. Please download to view.
                    </p>
                    <Button
                      onClick={() => handleDownload(previewPolicy)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <SemanticBDIIcon semantic="download" size={16} className="mr-2" />
                      Download File
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="border-t p-4 flex justify-between items-center">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              {previewPolicy && (
                <>
                  <span>📁 {(previewPolicy.fileSize / 1024).toFixed(1)} KB</span>
                  <span>📅 {new Date(previewPolicy.uploadedAt).toLocaleDateString()}</span>
                  <span>👤 {previewPolicy.uploadedBy}</span>
                </>
              )}
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
              {previewPolicy && (
                <Button
                  onClick={() => handleDownload(previewPolicy)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <SemanticBDIIcon semantic="download" size={16} className="mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
