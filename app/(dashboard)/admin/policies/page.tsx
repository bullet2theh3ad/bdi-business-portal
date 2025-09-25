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
              'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 
              'space-y-4'
            }>
              {filteredPolicies.map((policy) => (
                <div key={policy.id} className={viewMode === 'grid' ? 
                  'border rounded-lg p-4 hover:bg-gray-50 transition-colors' :
                  'border rounded-lg p-4 hover:bg-gray-50 transition-colors flex items-center justify-between'
                }>
                  <div className={viewMode === 'grid' ? 'space-y-3' : 'flex-1'}>
                    <div className="flex items-start space-x-3">
                      <SemanticBDIIcon semantic="document" size={20} className="text-blue-600 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm truncate">{policy.fileName}</h3>
                        {policy.description && (
                          <p className="text-xs text-gray-600 mt-1">{policy.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{(policy.fileSize / 1024).toFixed(1)} KB</span>
                      <span>{new Date(policy.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    
                    {policy.category && (
                      <Badge variant="secondary" className="text-xs">
                        {policy.category}
                      </Badge>
                    )}
                  </div>
                  
                  {viewMode === 'list' && (
                    <div className="flex space-x-2 ml-4">
                      <Button variant="outline" size="sm">
                        <SemanticBDIIcon semantic="download" size={14} className="mr-1" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <SemanticBDIIcon semantic="delete" size={14} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  )}
                  
                  {viewMode === 'grid' && (
                    <div className="flex space-x-2 mt-3">
                      <Button variant="outline" size="sm" className="flex-1">
                        <SemanticBDIIcon semantic="download" size={14} className="mr-1" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                        <SemanticBDIIcon semantic="delete" size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
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
                  accept=".pdf,.doc,.docx,.txt,.md"
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
                  Supported formats: PDF, DOC, DOCX, TXT, MD
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
    </div>
  );
}
