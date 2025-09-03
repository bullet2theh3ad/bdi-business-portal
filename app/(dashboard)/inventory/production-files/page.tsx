'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User, ProductionFile } from '@/lib/db/schema';
import { useDropzone } from 'react-dropzone';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const getFileTypeDescription = (fileType: string): string => {
  const descriptions = {
    'MAC_ADDRESS_LIST': 'CSV file with device MAC addresses, one per line',
    'SERIAL_NUMBER_LIST': 'List of device serial numbers for tracking and warranty',
    'PRODUCTION_REPORT': 'Manufacturing summary with quantities, dates, and batch info',
    'TEST_RESULTS': 'Quality assurance test results and performance metrics',
    'CALIBRATION_DATA': 'Device calibration settings and measurement data',
    'FIRMWARE_VERSION': 'Firmware versions and update information per device',
    'QUALITY_CONTROL': 'QC inspection results and compliance certifications',
    'PACKAGING_LIST': 'Packaging details, box counts, and shipping preparation'
  };
  return descriptions[fileType as keyof typeof descriptions] || 'Production file template';
};

const FILE_TYPES = [
  { value: 'MAC_ADDRESS_LIST', label: 'MAC Address List', icon: 'connect' },
  { value: 'SERIAL_NUMBER_LIST', label: 'Serial Number List', icon: 'inventory_items' },
  { value: 'PRODUCTION_REPORT', label: 'Production Report', icon: 'analytics' },
  { value: 'TEST_RESULTS', label: 'Test Results', icon: 'analytics' },
  { value: 'CALIBRATION_DATA', label: 'Calibration Data', icon: 'settings' },
  { value: 'FIRMWARE_VERSION', label: 'Firmware Version', icon: 'settings' },
  { value: 'QUALITY_CONTROL', label: 'Quality Control', icon: 'check' },
  { value: 'PACKAGING_LIST', label: 'Packaging List', icon: 'orders' },
  { value: 'OTHER', label: 'Other', icon: 'files' }
];

export default function ProductionFilesPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: productionFiles, error: filesError, mutate: mutateFiles } = useSWR<ProductionFile[]>('/api/inventory/production-files', fetcher);
  const { data: forecasts } = useSWR<any[]>('/api/cpfr/forecasts', fetcher);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadFormData, setUploadFormData] = useState({
    fileType: 'MAC_ADDRESS_LIST',
    description: '',
    forecastId: '',
    bdiShipmentNumber: '',
    cmMacAddresses: '',
    macAddresses: '',
    serialNumbers: '',
    productionBatch: '',
    manufacturingDate: '',
    tags: ''
  });
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterShipment, setFilterShipment] = useState('all');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/json': ['.json']
    },
    multiple: true
  });

  // Debug logging
  if (filesError) {
    console.error('Production files API error:', filesError);
  }
  if (productionFiles && !Array.isArray(productionFiles)) {
    console.error('Production files is not an array:', productionFiles);
  }

  // Loading state
  if (!user) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (filesError) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2 text-red-600">Error Loading Production Files</h2>
            <p className="text-muted-foreground mb-4">
              {filesError.message || 'Failed to load production files. The database table may need to be created.'}
            </p>
            <Button onClick={() => mutateFiles()} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Access control
  if (!['super_admin', 'admin', 'operations', 'sales', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Production file access requires appropriate permissions.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', uploadFormData.fileType);
        formData.append('description', uploadFormData.description);
        formData.append('forecastId', uploadFormData.forecastId);
        formData.append('bdiShipmentNumber', uploadFormData.bdiShipmentNumber);
        formData.append('tags', uploadFormData.tags);

        // Device metadata
        const deviceMetadata = {
          cmMacAddresses: uploadFormData.cmMacAddresses ? uploadFormData.cmMacAddresses.split(',').map(s => s.trim()) : [],
          macAddresses: uploadFormData.macAddresses ? uploadFormData.macAddresses.split(',').map(s => s.trim()) : [],
          serialNumbers: uploadFormData.serialNumbers ? uploadFormData.serialNumbers.split(',').map(s => s.trim()) : [],
          deviceCount: 0,
          productionBatch: uploadFormData.productionBatch || null,
          manufacturingDate: uploadFormData.manufacturingDate || null
        };
        
        // Calculate device count from the metadata
        deviceMetadata.deviceCount = Math.max(
          deviceMetadata.cmMacAddresses.length,
          deviceMetadata.macAddresses.length,
          deviceMetadata.serialNumbers.length
        );

        formData.append('deviceMetadata', JSON.stringify(deviceMetadata));

        const response = await fetch('/api/inventory/production-files', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Upload response error:', errorData);
          throw new Error(`Failed to upload ${file.name}: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('File uploaded successfully:', result);
      }

      // Reset form and close modal
      setSelectedFiles([]);
      setUploadFormData({
        fileType: 'MAC_ADDRESS_LIST',
        description: '',
        forecastId: '',
        bdiShipmentNumber: '',
        cmMacAddresses: '',
        macAddresses: '',
        serialNumbers: '',
        productionBatch: '',
        manufacturingDate: '',
        tags: ''
      });
      setShowUploadModal(false);
      mutateFiles(); // Refresh the files list
      alert(`Successfully uploaded ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'}!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Please try again'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file: ProductionFile) => {
    try {
      const response = await fetch(`/api/inventory/production-files/${file.id}/download`);
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file');
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/inventory/production-files/${fileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');
      
      mutateFiles(); // Refresh the files list
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete file');
    }
  };

  const handleDownloadSample = async (fileType: string) => {
    try {
      // For now, we'll create a simple CSV template based on the file type
      let csvContent = '';
      let fileName = '';

      switch (fileType) {
        case 'MAC_ADDRESS_LIST':
          csvContent = 'Device_ID,MAC_Address,Device_Type,Production_Date\n' +
                      'DEV001,00:1A:2B:3C:4D:5E,Router,2025-01-15\n' +
                      'DEV002,00:1A:2B:3C:4D:5F,Router,2025-01-15\n' +
                      'DEV003,00:1A:2B:3C:4D:60,Router,2025-01-15';
          fileName = 'sample_mac_addresses.csv';
          break;
        case 'SERIAL_NUMBER_LIST':
          csvContent = 'Serial_Number,Device_Model,Production_Batch,Manufacture_Date\n' +
                      'MNQ1525001,MNQ1525-30W-U,BATCH-2025-001,2025-01-15\n' +
                      'MNQ1525002,MNQ1525-30W-U,BATCH-2025-001,2025-01-15\n' +
                      'MNQ1525003,MNQ1525-30W-U,BATCH-2025-001,2025-01-15';
          fileName = 'sample_serial_numbers.csv';
          break;
        case 'PRODUCTION_REPORT':
          csvContent = 'Production_Date,Batch_Number,Units_Produced,Defects,Pass_Rate,Operator\n' +
                      '2025-01-15,BATCH-2025-001,1000,5,99.5%,John Smith\n' +
                      '2025-01-16,BATCH-2025-002,950,3,99.7%,Jane Doe\n' +
                      '2025-01-17,BATCH-2025-003,1100,8,99.3%,Mike Johnson';
          fileName = 'sample_production_report.csv';
          break;
        case 'TEST_RESULTS':
          csvContent = 'Device_ID,Test_Type,Result,Value,Unit,Pass_Fail,Test_Date\n' +
                      'DEV001,Signal Strength,-45,dBm,PASS,2025-01-15\n' +
                      'DEV001,Power Consumption,12.5,Watts,PASS,2025-01-15\n' +
                      'DEV002,Signal Strength,-42,dBm,PASS,2025-01-15';
          fileName = 'sample_test_results.csv';
          break;
        case 'CALIBRATION_DATA':
          csvContent = 'Device_ID,Calibration_Type,Setting_Name,Value,Unit,Calibrated_By,Date\n' +
                      'DEV001,RF Calibration,TX Power,20,dBm,Tech1,2025-01-15\n' +
                      'DEV001,RF Calibration,RX Sensitivity,-85,dBm,Tech1,2025-01-15\n' +
                      'DEV002,RF Calibration,TX Power,19.8,dBm,Tech2,2025-01-15';
          fileName = 'sample_calibration_data.csv';
          break;
        case 'FIRMWARE_VERSION':
          csvContent = 'Device_ID,Firmware_Version,Boot_Version,Update_Date,Status\n' +
                      'DEV001,v2.1.5,v1.0.3,2025-01-15,Current\n' +
                      'DEV002,v2.1.5,v1.0.3,2025-01-15,Current\n' +
                      'DEV003,v2.1.4,v1.0.3,2025-01-10,Needs Update';
          fileName = 'sample_firmware_versions.csv';
          break;
        case 'QUALITY_CONTROL':
          csvContent = 'Device_ID,Inspection_Type,Inspector,Result,Issues,Certification,Date\n' +
                      'DEV001,Final QC,QC-Team-A,PASS,None,FCC-ID-12345,2025-01-15\n' +
                      'DEV002,Final QC,QC-Team-A,PASS,None,FCC-ID-12346,2025-01-15\n' +
                      'DEV003,Final QC,QC-Team-B,FAIL,Label Missing,Pending,2025-01-15';
          fileName = 'sample_quality_control.csv';
          break;
        case 'PACKAGING_LIST':
          csvContent = 'Box_ID,Device_Count,Device_Models,Package_Type,Pallet_ID,Ship_Date\n' +
                      'BOX001,10,MNQ1525-30W-U,Retail Box,PLT001,2025-01-20\n' +
                      'BOX002,10,MNQ1525-30W-U,Retail Box,PLT001,2025-01-20\n' +
                      'BOX003,10,MNQ1525-30W-U,Retail Box,PLT002,2025-01-20';
          fileName = 'sample_packaging_list.csv';
          break;
        default:
          csvContent = 'Column1,Column2,Column3\nSample,Data,Here';
          fileName = 'sample_template.csv';
      }

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Sample download error:', error);
      alert('Failed to download sample file');
    }
  };

  // Filter files - ensure productionFiles is an array
  const filteredFiles = (Array.isArray(productionFiles) ? productionFiles : []).filter(file => {
    const matchesSearch = file.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         file.bdiShipmentNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = filterType === 'all' || file.fileType === filterType;
    
    const matchesShipment = filterShipment === 'all' || 
                           (filterShipment === 'with_shipment' && file.bdiShipmentNumber) ||
                           (filterShipment === 'no_shipment' && !file.bdiShipmentNumber);

    return matchesSearch && matchesType && matchesShipment;
  });

  // Get unique BDI shipment numbers for stats - ensure productionFiles is an array
  const productionFilesArray = Array.isArray(productionFiles) ? productionFiles : [];
  const uniqueShipments = new Set(productionFilesArray.map(f => f.bdiShipmentNumber).filter(Boolean)).size;
  const totalDevices = productionFilesArray.reduce((sum, file) => {
    return sum + ((file.deviceMetadata as any)?.deviceCount || 0);
  }, 0);

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="analytics" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Production Files</h1>
              <p className="text-muted-foreground">
                Manufacturing files for device MAC addresses, serial numbers, and production data
              </p>
            </div>
          </div>
          <Button onClick={() => setShowUploadModal(true)} className="bg-purple-600 hover:bg-purple-700">
            <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="analytics" size={20} className="text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Total Files</p>
                <p className="text-2xl font-bold text-purple-600">{filteredFiles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="shipping" size={20} className="text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">BDI Shipments</p>
                <p className="text-2xl font-bold text-blue-600">{uniqueShipments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="inventory_items" size={20} className="text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Total Devices</p>
                <p className="text-2xl font-bold text-green-600">{totalDevices.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="collaboration" size={20} className="text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Organization</p>
                <p className="text-2xl font-bold text-orange-600">{user?.organization?.code || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search files by name, description, or shipment number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="type-filter">Type:</Label>
            <select
              id="type-filter"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Types</option>
              {FILE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="shipment-filter">Shipment:</Label>
            <select
              id="shipment-filter"
              value={filterShipment}
              onChange={(e) => setFilterShipment(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Files</option>
              <option value="with_shipment">With Shipment</option>
              <option value="no_shipment">No Shipment</option>
            </select>
          </div>
        </div>
      </div>

      {/* Production File Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="help" size={20} className="text-green-600" />
            <span>Production File Templates</span>
          </CardTitle>
          <CardDescription>
            Download sample files to understand the format and structure for each production file type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FILE_TYPES.slice(0, -1).map((fileType) => (
              <div key={fileType.value} className="border rounded-lg p-4 hover:bg-green-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <SemanticBDIIcon 
                    semantic={fileType.icon as any} 
                    size={24} 
                    className="text-green-600 mt-1" 
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm mb-1">{fileType.label}</h4>
                    <p className="text-xs text-gray-600 mb-3">
                      {getFileTypeDescription(fileType.value)}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleDownloadSample(fileType.value)}
                    >
                      <SemanticBDIIcon semantic="download" size={14} className="mr-2" />
                      Download Sample
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <SemanticBDIIcon semantic="help" size={20} className="text-blue-600 mt-1" />
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">How to Use Sample Files</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Download the sample that matches your production file type</li>
                  <li>• Use the same format and column headers in your actual files</li>
                  <li>• Replace the sample data with your real production data</li>
                  <li>• Upload your completed files using the "Upload Files" button above</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="analytics" size={20} />
            <span>Production Files ({filteredFiles.length})</span>
          </CardTitle>
          <CardDescription>
            Manufacturing and production files associated with device shipments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Production Files</h3>
              <p className="text-muted-foreground mb-4">
                Upload production files to track device manufacturing data
              </p>
              <Button onClick={() => setShowUploadModal(true)} className="bg-purple-600 hover:bg-purple-700">
                <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                Upload First File
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFiles.map((file) => {
                const fileTypeInfo = FILE_TYPES.find(t => t.value === file.fileType) || FILE_TYPES.find(t => t.value === 'OTHER')!;
                const deviceMetadata = file.deviceMetadata as any;
                
                return (
                  <div key={file.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <SemanticBDIIcon semantic={fileTypeInfo.icon as any} size={20} className="text-purple-600" />
                          <h3 className="font-semibold text-lg">{file.fileName}</h3>
                          <Badge className="bg-purple-100 text-purple-800">
                            {fileTypeInfo.label}
                          </Badge>
                          {file.bdiShipmentNumber && (
                            <Badge className="bg-blue-100 text-blue-800">
                              {file.bdiShipmentNumber}
                            </Badge>
                          )}
                        </div>
                        
                        {file.description && (
                          <p className="text-gray-600 mb-2">{file.description}</p>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">File Size:</span>
                            <p className="font-medium">{(file.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Device Count:</span>
                            <p className="font-medium">{deviceMetadata?.deviceCount || 0} devices</p>
                          </div>
                          <div>
                            <span className="text-gray-600">Uploaded:</span>
                            <p className="font-medium">{new Date(file.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {(deviceMetadata?.macAddresses?.length > 0 || deviceMetadata?.serialNumbers?.length > 0) && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {deviceMetadata.macAddresses?.length > 0 && (
                                <div>
                                  <span className="text-gray-600">MAC Addresses:</span>
                                  <p className="font-mono text-xs">{deviceMetadata.macAddresses.slice(0, 3).join(', ')}{deviceMetadata.macAddresses.length > 3 ? '...' : ''}</p>
                                </div>
                              )}
                              {deviceMetadata.serialNumbers?.length > 0 && (
                                <div>
                                  <span className="text-gray-600">Serial Numbers:</span>
                                  <p className="font-mono text-xs">{deviceMetadata.serialNumbers.slice(0, 3).join(', ')}{deviceMetadata.serialNumbers.length > 3 ? '...' : ''}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDownload(file)}
                        >
                          <SemanticBDIIcon semantic="download" size={14} className="mr-1" />
                          Download
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDelete(file.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <SemanticBDIIcon semantic="delete" size={14} className="mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Upload Production Files</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-6">
            {/* File Drop Zone */}
            <div className="space-y-4">
              <Label>Select Files</Label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400'
                }`}
              >
                <input {...getInputProps()} />
                <SemanticBDIIcon semantic="upload" size={48} className="mx-auto mb-4 text-gray-400" />
                {isDragActive ? (
                  <p className="text-purple-600">Drop the files here...</p>
                ) : (
                  <div>
                    <p className="text-gray-600">Drag & drop files here, or click to select</p>
                    <p className="text-sm text-gray-500 mt-2">Supports CSV, Excel, TXT, PDF, JSON files</p>
                  </div>
                )}
              </div>
              
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Files ({selectedFiles.length})</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedFiles.map((file, index) => {
                      const getFileIcon = (fileName: string) => {
                        const ext = fileName.toLowerCase().split('.').pop();
                        switch (ext) {
                          case 'csv': return { icon: 'analytics', color: 'text-green-600' };
                          case 'xlsx':
                          case 'xls': return { icon: 'reports', color: 'text-blue-600' };
                          case 'pdf': return { icon: 'orders', color: 'text-red-600' };
                          case 'txt': return { icon: 'inventory_items', color: 'text-gray-600' };
                          case 'json': return { icon: 'settings', color: 'text-purple-600' };
                          default: return { icon: 'analytics', color: 'text-gray-600' };
                        }
                      };
                      
                      const fileIconInfo = getFileIcon(file.name);
                      
                      return (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
                          <SemanticBDIIcon 
                            semantic={fileIconInfo.icon as any} 
                            size={20} 
                            className={fileIconInfo.color} 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {(file.size / 1024).toFixed(1)} KB • {file.type || 'Unknown type'}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <SemanticBDIIcon semantic="delete" size={16} />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* File Metadata Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fileType">File Type</Label>
                <select
                  id="fileType"
                  value={uploadFormData.fileType}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, fileType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {FILE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="forecastId">Associated Forecast (Optional)</Label>
                <select
                  id="forecastId"
                  value={uploadFormData.forecastId}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, forecastId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No associated forecast</option>
                  {forecasts?.map(forecast => (
                    <option key={forecast.id} value={forecast.id}>
                      {forecast.sku?.sku} - {forecast.deliveryWeek} ({forecast.quantity} units)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bdiShipmentNumber">BDI Shipment Number (Optional)</Label>
                <Input
                  id="bdiShipmentNumber"
                  value={uploadFormData.bdiShipmentNumber}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, bdiShipmentNumber: e.target.value }))}
                  placeholder="e.g., BDI-25-0001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productionBatch">Production Batch (Optional)</Label>
                <Input
                  id="productionBatch"
                  value={uploadFormData.productionBatch}
                  onChange={(e) => setUploadFormData(prev => ({ ...prev, productionBatch: e.target.value }))}
                  placeholder="e.g., BATCH-2025-001"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={uploadFormData.description}
                onChange={(e) => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the contents and purpose of these files..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={3}
              />
            </div>

            {/* Device Information */}
            <div className="space-y-4">
              <Label className="text-lg font-semibold">Device Information (Optional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cmMacAddresses">CM-MAC Addresses</Label>
                  <textarea
                    id="cmMacAddresses"
                    value={uploadFormData.cmMacAddresses}
                    onChange={(e) => setUploadFormData(prev => ({ ...prev, cmMacAddresses: e.target.value }))}
                    placeholder="Enter MAC addresses separated by commas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="macAddresses">MAC Addresses</Label>
                  <textarea
                    id="macAddresses"
                    value={uploadFormData.macAddresses}
                    onChange={(e) => setUploadFormData(prev => ({ ...prev, macAddresses: e.target.value }))}
                    placeholder="Enter MAC addresses separated by commas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serialNumbers">Serial Numbers</Label>
                  <textarea
                    id="serialNumbers"
                    value={uploadFormData.serialNumbers}
                    onChange={(e) => setUploadFormData(prev => ({ ...prev, serialNumbers: e.target.value }))}
                    placeholder="Enter serial numbers separated by commas"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manufacturingDate">Manufacturing Date</Label>
                  <Input
                    id="manufacturingDate"
                    type="date"
                    value={uploadFormData.manufacturingDate}
                    onChange={(e) => setUploadFormData(prev => ({ ...prev, manufacturingDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Optional)</Label>
              <Input
                id="tags"
                value={uploadFormData.tags}
                onChange={(e) => setUploadFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Enter tags separated by commas (e.g., production, testing, qa)"
              />
            </div>

            {/* Upload Actions */}
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowUploadModal(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={selectedFiles.length === 0 || uploading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
