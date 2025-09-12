'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';
import { useState } from 'react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const FILE_TYPES = [
  { value: 'PRODUCTION_FILE', label: 'Production File', icon: 'analytics', active: true },
  { value: 'MAC_ADDRESS_LIST', label: 'MAC Address List', icon: 'connect', active: false },
  { value: 'SERIAL_NUMBER_LIST', label: 'Serial Number List', icon: 'inventory_items', active: false },
  { value: 'PRODUCTION_REPORT', label: 'Production Report', icon: 'analytics', active: false },
  { value: 'TEST_RESULTS', label: 'Test Results', icon: 'analytics', active: false },
  { value: 'CALIBRATION_DATA', label: 'Calibration Data', icon: 'settings', active: false },
  { value: 'FIRMWARE_VERSION', label: 'Firmware Version', icon: 'settings', active: false },
  { value: 'QUALITY_CONTROL', label: 'Quality Control', icon: 'check', active: false },
  { value: 'PACKAGING_LIST', label: 'Packaging List', icon: 'orders', active: false }
];

const getFileTypeDescription = (fileType: string): string => {
  const descriptions = {
    'PRODUCTION_FILE': 'Latest Production Data Template R2 (Sep 12 2025) - Comprehensive Excel template with updated format for all production data including MAC addresses, serial numbers, and manufacturing details',
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

export default function ProductionFileTemplatesPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  // Template upload state
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const handleDownloadSample = async (fileType: string) => {
    try {
      if (fileType === 'PRODUCTION_FILE') {
        // Download the latest Excel template from Supabase storage
        console.log('📥 Fetching latest production template from Supabase...');
        
        const response = await fetch('/api/inventory/production-files/templates');
        if (!response.ok) {
          // Fallback to public folder template if Supabase fails
          console.log('⚠️ Supabase template not found, using fallback...');
          const link = document.createElement('a');
          link.href = '/Production Data Template R2 (Sep 12 2025).xlsx';
          link.download = 'Production Data Template R2 (Sep 12 2025).xlsx';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          return;
        }
        
        const data = await response.json();
        if (data.downloadUrl) {
          console.log(`📥 Downloading: ${data.fileName}`);
          const link = document.createElement('a');
          link.href = data.downloadUrl;
          link.download = data.fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          throw new Error('No download URL received');
        }
        return;
      }

      // For other file types, create sample CSV content
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

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="help" size={32} className="text-green-600" />
            <div>
              <h1 className="text-3xl font-bold">{tc('productionFileTemplates', 'Production File Templates')}</h1>
              <p className="text-muted-foreground">
                <DynamicTranslation userLanguage={userLocale} context="technical">
                  Download sample files to understand the format and structure for each production file type
                </DynamicTranslation>
              </p>
            </div>
          </div>
          <Button 
            onClick={() => window.location.href = '/inventory/production-files'} 
            variant="outline"
            className="border-green-200 text-green-700 hover:bg-green-50"
          >
            <SemanticBDIIcon semantic="analytics" size={16} className="mr-2" />
            {tc('backToFiles', 'Back to Files')}
          </Button>
        </div>
      </div>

      {/* Super Admin Template Upload */}
      {user?.role === 'super_admin' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="upload" size={20} />
              Upload New Template (Super Admin)
            </CardTitle>
            <CardDescription>
              Upload the latest production file template to Supabase storage - will be available for all users to download
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setTemplateFile(file);
                }}
                className="hidden"
                id="template-upload"
              />
              <label htmlFor="template-upload" className="cursor-pointer">
                <SemanticBDIIcon semantic="upload" size={24} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload latest production template • Recommended: "Production Data Template R2"
                </p>
              </label>
            </div>

            {templateFile && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{templateFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setTemplateFile(null)}>✕</Button>
                </div>
              </div>
            )}

            <Button
              onClick={async () => {
                if (!templateFile) return;
                setUploadingTemplate(true);
                try {
                  const formData = new FormData();
                  formData.append('file', templateFile);
                  const response = await fetch('/api/admin/template-upload', {
                    method: 'POST',
                    body: formData,
                  });
                  const result = await response.json();
                  if (result.success) {
                    alert('Template uploaded successfully! Users can now download the latest version.');
                    setTemplateFile(null);
                  } else {
                    alert(`Upload failed: ${result.error}`);
                  }
                } catch (error) {
                  alert(`Upload error: ${error}`);
                } finally {
                  setUploadingTemplate(false);
                }
              }}
              disabled={!templateFile || uploadingTemplate}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {uploadingTemplate ? 'Uploading to Supabase...' : 'Upload Template'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="help" size={20} className="text-blue-600" />
            <span>{tc('howToUseTemplates', 'How to Use Production File Templates')}</span>
          </CardTitle>
          <CardDescription>
            <DynamicTranslation userLanguage={userLocale} context="technical">
              Follow these steps to create properly formatted production files
            </DynamicTranslation>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-blue-800">📋 {tc('stepByStepProcess', 'Step-by-Step Process')}</h4>
              <ul className="space-y-2 text-sm text-blue-700">
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">1</span>
                  <span>
                    <DynamicTranslation userLanguage={userLocale} context="technical">
                      Download the template that matches your production file type
                    </DynamicTranslation>
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">2</span>
                  <span>
                    <DynamicTranslation userLanguage={userLocale} context="technical">
                      Open the CSV file in Excel or your preferred spreadsheet application
                    </DynamicTranslation>
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">3</span>
                  <span>
                    <DynamicTranslation userLanguage={userLocale} context="technical">
                      Keep the same column headers and format structure
                    </DynamicTranslation>
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">4</span>
                  <span>
                    <DynamicTranslation userLanguage={userLocale} context="technical">
                      Replace sample data with your actual production data
                    </DynamicTranslation>
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold">5</span>
                  <span>
                    <DynamicTranslation userLanguage={userLocale} context="technical">
                      Save as CSV and upload via the Production Files page
                    </DynamicTranslation>
                  </span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-green-800">✅ {tc('bestPractices', 'Best Practices')}</h4>
              <ul className="space-y-2 text-sm text-green-700">
                <li>• <DynamicTranslation userLanguage={userLocale} context="technical">Use consistent date formats (YYYY-MM-DD)</DynamicTranslation></li>
                <li>• <DynamicTranslation userLanguage={userLocale} context="technical">Include all required columns from the template</DynamicTranslation></li>
                <li>• <DynamicTranslation userLanguage={userLocale} context="technical">Validate MAC addresses follow standard format</DynamicTranslation></li>
                <li>• <DynamicTranslation userLanguage={userLocale} context="technical">Ensure serial numbers are unique per device</DynamicTranslation></li>
                <li>• <DynamicTranslation userLanguage={userLocale} context="technical">Associate files with specific forecasts/shipments</DynamicTranslation></li>
                <li>• <DynamicTranslation userLanguage={userLocale} context="technical">Add meaningful descriptions for file identification</DynamicTranslation></li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Downloads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="analytics" size={20} className="text-green-600" />
            <span>{tc('availableTemplates', 'Available Templates')}</span>
          </CardTitle>
          <CardDescription>
            <DynamicTranslation userLanguage={userLocale} context="technical">
              Click any template below to download a properly formatted sample file
            </DynamicTranslation>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FILE_TYPES.map((fileType) => (
              <div 
                key={fileType.value} 
                className={`border rounded-lg p-4 transition-colors ${
                  fileType.active 
                    ? 'hover:bg-green-50 border-green-200' 
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <SemanticBDIIcon 
                    semantic={fileType.icon as any} 
                    size={24} 
                    className={`mt-1 ${fileType.active ? 'text-green-600' : 'text-gray-400'}`}
                  />
                  <div className="flex-1">
                    <h4 className={`font-semibold text-sm mb-1 ${fileType.active ? 'text-gray-900' : 'text-gray-500'}`}>
                      <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                        {fileType.label}
                      </DynamicTranslation>
                      {!fileType.active ? ` (${tc('comingSoon', 'Coming Soon')})` : ''}
                    </h4>
                    <p className="text-xs text-gray-600 mb-3">
                      <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                        {getFileTypeDescription(fileType.value)}
                      </DynamicTranslation>
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`w-full ${
                        fileType.active 
                          ? 'text-green-600 border-green-200 hover:bg-green-50' 
                          : 'text-gray-400 border-gray-200 cursor-not-allowed'
                      }`}
                      onClick={() => fileType.active && handleDownloadSample(fileType.value)}
                      disabled={!fileType.active}
                    >
                      <SemanticBDIIcon semantic="download" size={14} className="mr-2" />
                      {fileType.active ? tc('downloadTemplate', 'Download Template') : tc('comingSoon', 'Coming Soon')}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sample Data Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="inventory_items" size={20} className="text-purple-600" />
            <span>Sample Data Preview</span>
          </CardTitle>
          <CardDescription>
            Examples of the data format included in each template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-800">MAC Address List Example</h4>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-xs">
                <div className="text-gray-600 mb-2">CSV Format:</div>
                <div>Device_ID,MAC_Address,Device_Type,Production_Date</div>
                <div>DEV001,00:1A:2B:3C:4D:5E,Router,2025-01-15</div>
                <div>DEV002,00:1A:2B:3C:4D:5F,Router,2025-01-15</div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-purple-800">Production Report Example</h4>
              <div className="bg-gray-50 p-4 rounded-lg font-mono text-xs">
                <div className="text-gray-600 mb-2">CSV Format:</div>
                <div>Production_Date,Batch_Number,Units_Produced,Defects,Pass_Rate</div>
                <div>2025-01-15,BATCH-2025-001,1000,5,99.5%</div>
                <div>2025-01-16,BATCH-2025-002,950,3,99.7%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integration Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="connect" size={20} className="text-orange-600" />
            <span>Integration with BDI Portal</span>
          </CardTitle>
          <CardDescription>
            How production files integrate with the broader supply chain system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <SemanticBDIIcon semantic="forecasts" size={32} className="mx-auto mb-3 text-blue-600" />
              <h4 className="font-semibold text-blue-800 mb-2">Link to Forecasts</h4>
              <p className="text-sm text-blue-700">
                Associate production files with specific sales forecasts to track manufacturing against demand
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <SemanticBDIIcon semantic="shipping" size={32} className="mx-auto mb-3 text-purple-600" />
              <h4 className="font-semibold text-purple-800 mb-2">BDI Shipment Numbers</h4>
              <p className="text-sm text-purple-700">
                Files are automatically assigned BDI shipment numbers (BDI-25-0001) for tracking through logistics
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <SemanticBDIIcon semantic="collaboration" size={32} className="mx-auto mb-3 text-orange-600" />
              <h4 className="font-semibold text-orange-800 mb-2">Organization Access</h4>
              <p className="text-sm text-orange-700">
                Files are visible only to your organization unless specifically shared with BDI or other partners
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
