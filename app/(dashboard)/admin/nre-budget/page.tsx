'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Download, Trash2, Edit, Upload, FileText, Check, DollarSign, Clock, FileDown, BarChart3 } from 'lucide-react';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';
import { SemanticBDIIcon } from '@/components/BDIIcon';

// NRE Categories matching our database schema
const NRE_CATEGORIES = [
  { value: 'NRE_GENERAL', label: 'NRE (General)' },
  { value: 'NRE_DESIGN', label: 'NRE Design' },
  { value: 'TOOLING', label: 'Tooling' },
  { value: 'SAMPLES', label: 'Samples (EVT/DVT/PVT)' },
  { value: 'CERTIFICATIONS', label: 'Certifications' },
  { value: 'FIELD_TESTING', label: 'Field Testing' },
  { value: 'ODM_SETUP', label: 'ODM Setup' },
  { value: 'FIRMWARE', label: 'Firmware' },
  { value: 'APPLICATION_SOFTWARE', label: 'Application Software' },
  { value: 'LOGISTICS_SAMPLES', label: 'Logistics Samples' },
  { value: 'WARRANTY_RELIABILITY', label: 'Warranty / Reliability' },
  { value: 'DEVOPS', label: 'DevOps' },
  { value: 'NRE_FW', label: 'NRE (FW)' },
  { value: 'NRE_SPECIAL_PROJECT', label: 'NRE (Special Project)' },
  { value: 'NRE_WEEKLY', label: 'NRE (Weekly)' },
  { value: 'NRE_IOS_ANDROID', label: 'NRE (iOS/Android)' },
  { value: 'NRE_QA_TEST', label: 'NRE (QA Test)' },
  { value: 'NRE_PROJECT_MGT', label: 'NRE (Project Mgt)' },
  { value: 'OTHERS', label: 'Others' },
  { value: 'CUSTOM', label: 'Custom (Enter Below)' },
];

const PAYMENT_STATUS = [
  { value: 'not_paid', label: 'Not Paid' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
];

interface NRELineItem {
  id?: string;
  lineItemNumber: number;
  description: string;
  category: string;
  customCategory?: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes?: string;
}

interface PaymentLineItem {
  id?: string;
  paymentNumber: number;
  paymentDate: string;
  amount: number;
  notes?: string;
  isPaid?: boolean; // Track if payment has been made
}

interface NREBudget {
  id: string;
  nreReferenceNumber: string;
  vendorName: string;
  projectName?: string;
  skuCode?: string;
  skuName?: string;
  quoteNumber?: string;
  quoteDate?: string;
  paymentTerms?: string;
  paymentStatus: string;
  paymentDate?: string;
  totalAmount: number;
  documents?: string[];
  lineItems: NRELineItem[];
  paymentLineItems?: PaymentLineItem[];
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface SKU {
  id: string;
  sku_code: string;
  sku_name: string;
}

export default function NREBudgetPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: skus = [] } = useSWR<SKU[]>('/api/skus', fetcher);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<NREBudget | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'project' | 'sku' | 'category' | 'vendor'>('project');
  
  // Filter states
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all');
  
  // Form state
  const [vendorName, setVendorName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [skuName, setSkuName] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteDate, setQuoteDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('not_paid');
  const [paymentDate, setPaymentDate] = useState('');
  const [lineItems, setLineItems] = useState<NRELineItem[]>([]);
  const [paymentLineItems, setPaymentLineItems] = useState<PaymentLineItem[]>([]);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [existingDocs, setExistingDocs] = useState<Array<{ fileName: string; filePath: string }>>([]);
  
  // NRE Number Builder States (similar to PO Builder)
  const [useNREBuilder, setUseNREBuilder] = useState(true);
  const [currentRandomCode, setCurrentRandomCode] = useState('');
  const [nreBuilder, setNREBuilder] = useState({
    vendorOrg: '',
    date: new Date().toISOString().split('T')[0],
    randomCode: ''
  });
  
  // Fetch NRE budgets
  const { data: nreBudgets, mutate: mutateNREBudgets } = useSWR<NREBudget[]>(
    '/api/admin/nre-budget',
    fetcher,
    { refreshInterval: 30000 }
  );

  // Fetch organizations for vendor dropdown
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=false', fetcher);

  // Initialize NRE Builder when modal opens
  useEffect(() => {
    if (showCreateDialog && useNREBuilder) {
      const initialRandomCode = generateRandom4Digit();
      setCurrentRandomCode(initialRandomCode);
      setNREBuilder(prev => ({
        ...prev,
        date: new Date().toISOString().split('T')[0],
        randomCode: initialRandomCode
      }));
    }
  }, [showCreateDialog, useNREBuilder]);

  // Calculate days since Jan 1, 2025 (epoch for NRE numbers)
  const calculateEpochDays = (date: Date = new Date()) => {
    const epoch = new Date('2025-01-01');
    const diffTime = date.getTime() - epoch.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Organization code mapping (2-digit codes for NRE generation)
  const getOrgCode2Digit = (orgCode: string): string => {
    const orgCodes: Record<string, string> = {
      'MTN': '10',
      'CBN': '20',
      'ASK': '30',
      'ATL': '40',
      'GPN': '70',
      'CAT': '80',
      'BDI': '90'
    };
    return orgCodes[orgCode] || '99';
  };

  // Generate 4-digit random number (0000-9999)
  const generateRandom4Digit = (): string => {
    return Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  };

  // Generate NRE Number from builder selections
  // Format: NRE-[2-digit Org][4-digit Epoch][4-digit Random]
  // Example: NRE-1002711234 = MTN(10) + Sept28,2025(0271) + Random(1234)
  const generateNRENumber = () => {
    const { vendorOrg, date } = nreBuilder;
    
    if (!vendorOrg || !date) {
      return 'NRE-Select options above';
    }
    
    const orgCode2Digit = getOrgCode2Digit(vendorOrg);
    const epochDays = calculateEpochDays(new Date(date)).toString().padStart(4, '0');
    
    return `NRE-${orgCode2Digit}${epochDays}${currentRandomCode}`;
  };

  // Update NRE Builder
  const updateNREBuilder = (field: string, value: string) => {
    setNREBuilder(prev => ({ ...prev, [field]: value }));
    
    // Update vendorName when org is selected
    if (field === 'vendorOrg') {
      const org = organizations?.find((o: any) => o.code === value);
      if (org) {
        setVendorName(org.name);
      }
    }
  };

  const addLineItem = () => {
    const newItem: NRELineItem = {
      lineItemNumber: lineItems.length + 1,
      description: '',
      category: 'OTHERS',
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      notes: '',
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: keyof NRELineItem, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate total
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].totalAmount = updated[index].quantity * updated[index].unitPrice;
    }
    
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Payment Line Item Management
  const addPaymentLineItem = () => {
    const newPayment: PaymentLineItem = {
      paymentNumber: paymentLineItems.length + 1,
      paymentDate: '',
      amount: 0,
      notes: '',
      isPaid: false, // Default to not paid
    };
    setPaymentLineItems([...paymentLineItems, newPayment]);
  };

  const updatePaymentLineItem = (index: number, field: keyof PaymentLineItem, value: any) => {
    const updated = [...paymentLineItems];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentLineItems(updated);
  };

  const removePaymentLineItem = (index: number) => {
    setPaymentLineItems(paymentLineItems.filter((_, i) => i !== index));
  };

  const calculateTotalPaid = () => {
    return paymentLineItems.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const calculateGrandTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
  };

  // Determine payment card background color based on status and date
  const getPaymentCardBackground = (payment: PaymentLineItem) => {
    if (payment.isPaid) {
      return 'bg-white'; // Normal/paid - no special color
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison
    const paymentDate = new Date(payment.paymentDate);
    paymentDate.setHours(0, 0, 0, 0);
    
    if (paymentDate < today) {
      return 'bg-red-100 border-red-300'; // Overdue - payment date has passed
    } else {
      return 'bg-yellow-100 border-yellow-300'; // Upcoming - not paid yet but date is in future
    }
  };

  // Get payment status label
  const getPaymentStatus = (payment: PaymentLineItem) => {
    if (payment.isPaid) {
      return 'PAID';
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const paymentDate = new Date(payment.paymentDate);
    paymentDate.setHours(0, 0, 0, 0);
    
    if (paymentDate < today) {
      return 'OVERDUE';
    } else {
      return 'PENDING';
    }
  };

  // Generate and download CSV report
  const handleDownloadCSV = () => {
    if (!nreBudgets) return;

    // CSV Header
    const headers = ['NRE Number', 'Vendor', 'Project', 'Payment #', 'Payment Date', 'Amount', 'Status', 'Notes'];
    const rows = [headers];

    // Add data rows
    nreBudgets.forEach((budget) => {
      if (budget.paymentLineItems && budget.paymentLineItems.length > 0) {
        budget.paymentLineItems.forEach((payment) => {
          rows.push([
            budget.nreReferenceNumber,
            budget.vendorName,
            budget.projectName || '',
            payment.paymentNumber.toString(),
            new Date(payment.paymentDate).toLocaleDateString(),
            payment.amount.toFixed(2),
            getPaymentStatus(payment),
            payment.notes || ''
          ]);
        });

        // Add total row for this NRE
        const total = budget.paymentLineItems.reduce((sum, p) => sum + p.amount, 0);
        rows.push([
          budget.nreReferenceNumber,
          'TOTAL',
          '',
          '',
          '',
          total.toFixed(2),
          '',
          ''
        ]);
        
        // Add empty row for spacing
        rows.push(['', '', '', '', '', '', '', '']);
      }
    });

    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `NRE_Payment_Schedule_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateBudget = async () => {
    // Validate required fields
    const missingFields: string[] = [];
    
    if (!vendorName.trim()) {
      missingFields.push('Vendor Name');
    }
    
    if (!skuCode.trim()) {
      missingFields.push('SKU Code (select from dropdown or enter manually)');
    }
    
    if (!quoteNumber.trim()) {
      missingFields.push('Quote Number');
    }
    
    if (lineItems.length === 0) {
      missingFields.push('At least one Line Item');
    }
    
    // Validate each line item
    lineItems.forEach((item, index) => {
      if (!item.description.trim()) {
        missingFields.push(`Line Item #${item.lineItemNumber}: Description`);
      }
      if (!item.category || item.category === '') {
        missingFields.push(`Line Item #${item.lineItemNumber}: Category`);
      }
      if (item.unitPrice <= 0) {
        missingFields.push(`Line Item #${item.lineItemNumber}: Unit Price (must be greater than 0)`);
      }
    });
    
    // Validate payment line items if any exist
    paymentLineItems.forEach((payment, index) => {
      if (!payment.paymentDate) {
        missingFields.push(`Payment #${payment.paymentNumber}: Payment Date`);
      }
      if (payment.amount <= 0) {
        missingFields.push(`Payment #${payment.paymentNumber}: Amount (must be greater than 0)`);
      }
    });
    
    if (missingFields.length > 0) {
      alert(`⚠️ Please fill in the following required fields:\n\n${missingFields.map(f => '• ' + f).join('\n')}`);
      return;
    }
    
    if (editingBudget) {
      // Edit mode

      const budgetData = {
        vendorName,
        projectName,
        skuCode,
        skuName,
        quoteNumber,
        quoteDate,
        paymentTerms,
        paymentStatus,
        paymentDate,
        totalAmount: calculateGrandTotal(),
        lineItems: lineItems.map(item => ({
          ...item,
          category: item.category === 'CUSTOM' && item.customCategory ? item.customCategory : item.category,
        })),
        paymentLineItems,
      };

      try {
        // Use FormData to support file uploads during edit
        const formData = new FormData();
        formData.append('budgetData', JSON.stringify(budgetData));
        
        // Add any new uploaded files
        uploadedDocs.forEach((file, index) => {
          formData.append(`file-${index}`, file);
        });

        const response = await fetch(`/api/admin/nre-budget/${editingBudget.id}`, {
          method: 'PUT',
          body: formData, // Send as FormData, not JSON
        });

        if (!response.ok) throw new Error('Failed to update NRE budget');

        alert(`NRE Budget ${editingBudget.nreReferenceNumber} updated successfully!`);

        setShowCreateDialog(false);
        resetForm();
        mutateNREBudgets();
      } catch (error) {
        alert('Failed to update NRE budget');
      }
    } else {
      // Create mode
      const nreNumber = generateNRENumber();
      
      // Additional validation for create mode
      if (!nreBuilder.vendorOrg) {
        alert('⚠️ Please select Vendor Organization in the NRE Reference Number Builder.');
        return;
      }
      
      if (nreNumber.includes('Select options')) {
        alert('⚠️ Please complete all NRE Number Builder fields.');
        return;
      }
      
      const budgetData = {
        nreReferenceNumber: nreNumber,
        vendorName,
        projectName,
        skuCode,
        skuName,
        quoteNumber,
        quoteDate,
        paymentTerms,
        paymentStatus,
        paymentDate,
        totalAmount: calculateGrandTotal(),
        lineItems: lineItems.map(item => ({
          ...item,
          category: item.category === 'CUSTOM' && item.customCategory ? item.customCategory : item.category,
        })),
        paymentLineItems,
      };

      try {
        // Use FormData to support file uploads
        const formData = new FormData();
        formData.append('budgetData', JSON.stringify(budgetData));
        
        console.log('📤 Creating budget with', uploadedDocs.length, 'files');
        
        // Add uploaded files
        uploadedDocs.forEach((file, index) => {
          console.log(`📎 Adding file-${index}:`, file.name, file.size, 'bytes');
          formData.append(`file-${index}`, file);
        });

        console.log('📤 Sending FormData to API...');
        const response = await fetch('/api/admin/nre-budget', {
          method: 'POST',
          body: formData, // Send as FormData, not JSON
        });
        
        console.log('📥 Response status:', response.status);

        if (!response.ok) throw new Error('Failed to create NRE budget');

        alert(`NRE Budget ${nreNumber} created successfully!`);

        setShowCreateDialog(false);
        resetForm();
        mutateNREBudgets();
      } catch (error) {
        alert('Failed to create NRE budget');
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      console.log('📁 Files selected:', newFiles.length, newFiles.map(f => f.name));
      setUploadedDocs([...uploadedDocs, ...newFiles]);
      console.log('📁 Total uploadedDocs after adding:', uploadedDocs.length + newFiles.length);
    }
  };

  const removeFile = (index: number) => {
    setUploadedDocs(uploadedDocs.filter((_, i) => i !== index));
  };

  const handleDownloadDocument = async (filePath: string, fileName: string) => {
    try {
      const response = await fetch(`/api/admin/nre-budget/${editingBudget?.id}/documents/download?filePath=${encodeURIComponent(filePath)}`);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert('Failed to download document');
    }
  };

  const handleDeleteDocument = async (filePath: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
      const response = await fetch(`/api/admin/nre-budget/${editingBudget?.id}/documents/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      });
      
      if (!response.ok) throw new Error('Delete failed');
      
      setExistingDocs(existingDocs.filter(doc => doc.filePath !== filePath));
      alert('Document deleted successfully');
    } catch (error) {
      alert('Failed to delete document');
    }
  };

  const resetForm = () => {
    setVendorName('');
    setProjectName('');
    setSkuCode('');
    setSkuName('');
    setQuoteNumber('');
    setQuoteDate('');
    setPaymentTerms('');
    setPaymentStatus('not_paid');
    setPaymentDate('');
    setLineItems([]);
    setPaymentLineItems([]);
    setUploadedDocs([]);
    setExistingDocs([]);
    setEditingBudget(null);
  };

  const handleEdit = (budget: NREBudget) => {
    setEditingBudget(budget);
    setVendorName(budget.vendorName);
    setProjectName(budget.projectName || '');
    setSkuCode(budget.skuCode || '');
    setSkuName(budget.skuName || '');
    setQuoteNumber(budget.quoteNumber || '');
    setQuoteDate(budget.quoteDate || '');
    setPaymentTerms(budget.paymentTerms || '');
    setPaymentStatus(budget.paymentStatus);
    setPaymentDate(budget.paymentDate || '');
    setLineItems(budget.lineItems);
    setPaymentLineItems(budget.paymentLineItems || []);
    setUploadedDocs([]);
    
    // Load existing documents
    if (budget.documents && budget.documents.length > 0) {
      const docs = budget.documents.map((filePath: string) => ({
        fileName: filePath.split('/').pop() || filePath,
        filePath: filePath,
      }));
      setExistingDocs(docs);
    } else {
      setExistingDocs([]);
    }
    
    setShowCreateDialog(true);
  };

  // PDF Preview and Download (same as PO page)
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewBudget, setPdfPreviewBudget] = useState<NREBudget | null>(null);

  const generateNREBudgetPDF = async (budget: NREBudget) => {
    console.log('📄 Starting NRE Budget PDF generation...', budget.nreReferenceNumber);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const budgetElement = document.querySelector('.nre-preview-for-pdf') as HTMLElement;
      if (!budgetElement) {
        throw new Error('NRE Budget preview element not found');
      }

      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(budgetElement, {
        scale: 1.5,
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        logging: false,
        removeContainer: false,
        foreignObjectRendering: false,
        imageTimeout: 15000,
        onclone: (clonedDoc, element) => {
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            const computedStyle = window.getComputedStyle(el as Element);
            
            if (computedStyle.color && computedStyle.color.includes('oklch')) {
              htmlEl.style.color = '#000000';
            }
            if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('oklch')) {
              htmlEl.style.backgroundColor = '#ffffff';
            }
            if (computedStyle.borderColor && computedStyle.borderColor.includes('oklch')) {
              htmlEl.style.borderColor = '#cccccc';
            }
            
            htmlEl.style.fontFamily = 'Arial, Helvetica, sans-serif';
            
            const classList = htmlEl.classList;
            if (classList.contains('text-blue-600')) htmlEl.style.color = '#2563eb';
            if (classList.contains('text-green-600')) htmlEl.style.color = '#16a34a';
            if (classList.contains('text-gray-800')) htmlEl.style.color = '#1f2937';
            if (classList.contains('text-gray-600')) htmlEl.style.color = '#4b5563';
            if (classList.contains('bg-gray-50')) htmlEl.style.backgroundColor = '#f9fafb';
            if (classList.contains('bg-green-100')) htmlEl.style.backgroundColor = '#dcfce7';
            
            if (htmlEl.tagName === 'TABLE' || htmlEl.tagName === 'TH' || htmlEl.tagName === 'TD') {
              htmlEl.style.border = '1px solid #9ca3af';
              htmlEl.style.borderCollapse = 'collapse';
            }
          });
        }
      });

      const jsPDF = (await import('jspdf')).default;
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      
      const maxWidth = pdfWidth - (margin * 2);
      const maxHeight = pdfHeight - (margin * 2);
      
      const imgAspectRatio = canvas.width / canvas.height;
      let finalWidth = maxWidth;
      let finalHeight = finalWidth / imgAspectRatio;
      
      if (finalHeight > maxHeight) {
        finalHeight = maxHeight;
        finalWidth = finalHeight * imgAspectRatio;
      }
      
      const x = (pdfWidth - finalWidth) / 2;
      const y = margin;
      
      pdf.addImage(imgData, 'JPEG', x, y, finalWidth, finalHeight);

      return pdf;
      
    } catch (error) {
      console.error('❌ PDF generation error:', error);
      throw error;
    }
  };

  const handlePdfPreview = async (budget: NREBudget) => {
    setPdfPreviewBudget(budget);
    setShowPdfPreview(true);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async (budget: NREBudget) => {
    try {
      alert('Generating PDF preview...');
      await handlePdfPreview(budget);
    } catch (error) {
      alert('Failed to generate PDF preview');
    }
  };

  const handlePdfDownload = async (budget: NREBudget) => {
    setIsGeneratingPdf(true);
    try {
      const pdf = await generateNREBudgetPDF(budget);
      pdf.save(`${budget.nreReferenceNumber}.pdf`);
      alert(`PDF downloaded: ${budget.nreReferenceNumber}.pdf`);
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('Failed to download PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this NRE budget?')) return;

    try {
      const response = await fetch(`/api/admin/nre-budget/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      alert('NRE budget deleted successfully');

      mutateNREBudgets();
    } catch (error) {
      alert('Failed to delete NRE budget');
    }
  };

  // Access control - only BDI super_admin, admin_cfo, and admin_nre can access
  const hasAccess = () => {
    if (!user) return false;
    
    // Check if user is from BDI organization
    if ((user as any).organization?.code !== 'BDI') return false;
    
    // Check system role
    if (['super_admin', 'admin_cfo', 'admin_nre'].includes(user.role)) return true;
    
    // Check organization membership roles
    if ((user as any).organizations && Array.isArray((user as any).organizations)) {
      const orgRoles = (user as any).organizations.map((org: any) => org.membershipRole);
      return ['super_admin', 'admin_cfo', 'admin_nre'].some(role => orgRoles.includes(role));
    }
    
    return false;
  };

  if (!hasAccess()) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="security" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only BDI Super Admins, CFOs, and NRE Managers can access NRE Budget management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">NRE Spend Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Track Non-Recurring Engineering costs and payments</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button variant="outline" onClick={() => setShowAnalyticsModal(true)} className="w-full sm:w-auto bg-purple-50 hover:bg-purple-100 border-purple-300">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics Dashboard
          </Button>
          <Button variant="outline" onClick={() => setShowReportModal(true)} className="w-full sm:w-auto">
            <FileDown className="h-4 w-4 mr-2" />
            Payment Report
          </Button>
          <Button onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Create NRE Budget
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter NRE Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Vendor Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
              <select
                value={filterVendor}
                onChange={(e) => setFilterVendor(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Vendors</option>
                {Array.from(new Set(nreBudgets?.map(b => b.vendorName) || [])).sort().map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>

            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project</label>
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Projects</option>
                {Array.from(new Set(nreBudgets?.filter(b => b.projectName).map(b => b.projectName!) || [])).sort().map(project => (
                  <option key={project} value={project}>{project}</option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="PAID">Fully Paid</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="NOT_PAID">Not Paid</option>
                <option value="OVERDUE">Overdue</option>
              </select>
            </div>
          </div>
          
          {/* Clear Filters Button */}
          {(filterVendor !== 'all' || filterProject !== 'all' || filterPaymentStatus !== 'all') && (
            <div className="mt-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setFilterVendor('all');
                  setFilterProject('all');
                  setFilterPaymentStatus('all');
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* NRE Budget List */}
      <div className="grid gap-4">
        {nreBudgets?.filter(budget => {
          // Vendor filter
          if (filterVendor !== 'all' && budget.vendorName !== filterVendor) return false;
          
          // Project filter
          if (filterProject !== 'all' && budget.projectName !== filterProject) return false;
          
          // Payment Status filter
          if (filterPaymentStatus !== 'all') {
            const payments = budget.paymentLineItems || [];
            const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
            const paidAmount = payments.filter(p => p.isPaid).reduce((sum, p) => sum + p.amount, 0);
            const today = new Date();
            const hasOverdue = payments.some(p => !p.isPaid && new Date(p.paymentDate) < today);
            
            if (filterPaymentStatus === 'PAID' && (paidAmount < totalAmount || totalAmount === 0)) return false;
            if (filterPaymentStatus === 'PARTIAL' && (paidAmount === 0 || paidAmount >= totalAmount)) return false;
            if (filterPaymentStatus === 'NOT_PAID' && paidAmount > 0) return false;
            if (filterPaymentStatus === 'OVERDUE' && !hasOverdue) return false;
          }
          
          return true;
        }).map((budget) => (
          <Card key={budget.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{budget.nreReferenceNumber}</CardTitle>
                  <CardDescription className="mt-1">
                    Vendor: {budget.vendorName}
                    {budget.projectName && ` • Project: ${budget.projectName}`}
                    {budget.quoteNumber && ` • Quote: ${budget.quoteNumber}`}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Badge variant={
                    budget.paymentStatus === 'paid' ? 'default' :
                    budget.paymentStatus === 'partially_paid' ? 'secondary' : 'outline'
                  }>
                    {budget.paymentStatus.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Line Items Summary */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">NRE Line Items ({budget.lineItems.length})</h4>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2">
                    {budget.lineItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs border-b pb-1">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate block">{item.description}</span>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 mt-0.5">
                            {NRE_CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                          </Badge>
                        </div>
                        <span className="font-semibold text-xs ml-2 whitespace-nowrap">
                          ${item.totalAmount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Schedule Summary */}
                {budget.paymentLineItems && budget.paymentLineItems.length > 0 && (
                  <div className="bg-green-50 p-3 rounded-lg border-2 border-green-200">
                    <h4 className="text-sm font-semibold mb-2 text-green-800">Payment Schedule ({budget.paymentLineItems.length})</h4>
                    <div className="space-y-1 max-h-[200px] overflow-y-auto pr-2">
                      {budget.paymentLineItems.map((payment, idx) => {
                        const bgColor = getPaymentCardBackground(payment);
                        const isOverdue = bgColor.includes('red');
                        const isPending = bgColor.includes('yellow');
                        
                        return (
                          <div key={idx} className={`flex justify-between text-xs border-b pb-1 px-2 py-1 rounded ${bgColor}`}>
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Badge variant="secondary" className="text-[10px] h-4 px-1 bg-green-200 text-green-800 whitespace-nowrap">
                                #{payment.paymentNumber}
                              </Badge>
                              <span className="text-gray-600 text-[11px] whitespace-nowrap">
                                {new Date(payment.paymentDate).toLocaleDateString()}
                              </span>
                              {payment.isPaid && (
                                <Check className="h-3 w-3 text-green-600" />
                              )}
                              {isOverdue && !payment.isPaid && (
                                <span className="text-[9px] text-red-600 font-semibold">OVERDUE</span>
                              )}
                              {isPending && !payment.isPaid && (
                                <span className="text-[9px] text-yellow-700 font-semibold">PENDING</span>
                              )}
                              {payment.notes && (
                                <span className="text-[10px] text-gray-500 italic truncate">• {payment.notes}</span>
                              )}
                            </div>
                            <span className="font-bold text-green-600 text-xs ml-2 whitespace-nowrap">
                              ${payment.amount.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between pt-2 mt-2 border-t-2 border-green-300">
                      <span className="text-xs font-semibold text-green-800">Total Payments:</span>
                      <span className="font-bold text-green-600 text-sm">
                        ${budget.paymentLineItems.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Total and Actions */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t">
                  <div className="text-lg font-bold">
                    Total: ${budget.totalAmount.toLocaleString()}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(budget)} className="w-full sm:w-auto">
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDownloadPDF(budget)} className="w-full sm:w-auto">
                      <Download className="h-4 w-4 mr-1" />
                      PDF
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(budget.id)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm(); // Reset form when dialog closes
      }}>
        <DialogContent className="!max-w-[95vw] !w-[95vw] max-h-[95vh] overflow-y-auto p-4 sm:p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {editingBudget ? 'Edit NRE Budget' : 'Create NRE Budget'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* NRE Number Builder Section - Only show when creating */}
            {!editingBudget && (
              <Card className="p-6 bg-blue-50 border-2 border-blue-200">
                <h3 className="text-xl font-bold mb-4 text-blue-900">NRE Reference Number Builder</h3>
              
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div>
                  <Label className="text-sm font-semibold">Vendor Organization *</Label>
                  <select
                    value={nreBuilder.vendorOrg}
                    onChange={(e) => updateNREBuilder('vendorOrg', e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-base"
                  >
                    <option value="">Select Vendor</option>
                    {Array.isArray(organizations) && organizations.map((org: any) => (
                      <option key={org.id} value={org.code}>
                        {org.code} - {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Quote Date *</Label>
                  <Input
                    type="date"
                    value={nreBuilder.date}
                    onChange={(e) => updateNREBuilder('date', e.target.value)}
                    className="text-base"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold">Random Code</Label>
                  <div className="px-3 py-2 bg-gray-100 rounded-md font-mono text-base">
                    {currentRandomCode || '----'}
                  </div>
                </div>
              </div>

              {/* Generated NRE Number Display */}
              <div className="p-4 bg-white rounded-lg border-2 border-blue-300">
                <Label className="text-sm font-semibold text-gray-600">Generated NRE Reference Number:</Label>
                <div className="text-3xl font-bold text-blue-600 mt-2 font-mono">
                  {generateNRENumber()}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Format: NRE-[Org Code][Days Since Jan 1, 2025][Random Code]
                </p>
              </div>
              </Card>
            )}

            {/* Show NRE Reference Number when editing */}
            {editingBudget && (
              <Card className="p-6 bg-gray-50 border-2">
                <Label className="text-sm font-semibold text-gray-600">NRE Reference Number:</Label>
                <div className="text-2xl font-bold text-blue-600 mt-2 font-mono">
                  {editingBudget.nreReferenceNumber}
                </div>
              </Card>
            )}

            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Vendor Name *</Label>
                <Input
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder={editingBudget ? "Vendor name" : "Select vendor organization above"}
                  readOnly={!editingBudget}
                  className={!editingBudget ? "bg-gray-50" : ""}
                />
              </div>
              <div>
                <Label>Project Name</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., MNQ15 DVT"
                />
              </div>
              <div>
                <Label>Select SKU *</Label>
                <select
                  value={skuCode}
                  onChange={(e) => {
                    const selectedSkuCode = e.target.value;
                    const selectedSku = skus?.find(sku => sku.sku_code === selectedSkuCode);
                    if (selectedSku) {
                      setSkuCode(selectedSku.sku_code);
                      setSkuName(selectedSku.sku_name);
                      // Auto-fill Project Name with first 7 characters of SKU code
                      const projectNameAuto = selectedSku.sku_code.substring(0, 7);
                      setProjectName(projectNameAuto);
                    } else if (selectedSkuCode === 'MANUAL') {
                      // Manual entry option
                      setSkuCode('');
                      setSkuName('');
                      setProjectName('');
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-md text-base"
                >
                  <option value="">-- Select a SKU --</option>
                  {skus?.map((sku) => (
                    <option key={sku.id} value={sku.sku_code}>
                      {sku.sku_code} - {sku.sku_name}
                    </option>
                  ))}
                  <option value="MANUAL">-- Enter Manually Below --</option>
                </select>
              </div>
              <div>
                <Label>SKU Code *</Label>
                <Input
                  value={skuCode}
                  onChange={(e) => {
                    const manualSku = e.target.value;
                    setSkuCode(manualSku);
                    // If manual entry, entire SKU becomes project name
                    setProjectName(manualSku);
                  }}
                  placeholder="Manual SKU entry (if selected above)"
                  className="text-base"
                />
              </div>
              <div>
                <Label>Quote Number *</Label>
                <Input
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  placeholder="Enter quote number"
                />
              </div>
              <div>
                <Label>Quote Date</Label>
                <Input
                  type="date"
                  value={quoteDate}
                  onChange={(e) => setQuoteDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g., 50% Deposit, Rest Before 1st Lot"
                />
              </div>
              <div>
                <Label>Payment Status</Label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  {PAYMENT_STATUS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>

            {/* Payment Line Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Payment Schedule</h3>
                <Button onClick={addPaymentLineItem} size="sm" variant="secondary">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Payment
                </Button>
              </div>

              <div className="space-y-4">
                {paymentLineItems.map((payment, index) => (
                  <Card key={index} className={`p-4 border-2 ${getPaymentCardBackground(payment)}`}>
                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-1">
                        <Label className="text-sm font-semibold">Payment #</Label>
                        <Input
                          type="number"
                          value={payment.paymentNumber}
                          onChange={(e) => updatePaymentLineItem(index, 'paymentNumber', parseInt(e.target.value))}
                          className="text-center font-bold"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-sm font-semibold">Payment Date *</Label>
                        <Input
                          type="date"
                          value={payment.paymentDate}
                          onChange={(e) => updatePaymentLineItem(index, 'paymentDate', e.target.value)}
                          className="text-base"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-sm font-semibold">Amount ($) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={payment.amount}
                          onChange={(e) => updatePaymentLineItem(index, 'amount', parseFloat(e.target.value) || 0)}
                          className="text-base font-bold text-green-600"
                        />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-sm font-semibold">Notes</Label>
                        <Input
                          value={payment.notes || ''}
                          onChange={(e) => updatePaymentLineItem(index, 'notes', e.target.value)}
                          placeholder="Payment notes"
                          className="text-base"
                        />
                      </div>
                      <div className="col-span-2 flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                        <Button
                          variant={payment.isPaid ? "default" : "outline"}
                          size="sm"
                          onClick={() => updatePaymentLineItem(index, 'isPaid', !payment.isPaid)}
                          className={`flex-1 sm:flex-initial ${payment.isPaid ? "bg-green-600 hover:bg-green-700 text-white" : "border-yellow-500 text-yellow-700 hover:bg-yellow-50"}`}
                          title={payment.isPaid ? "Mark as Not Paid" : "Mark as Paid"}
                        >
                          {payment.isPaid ? (
                            <>
                              <Check className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Paid</span>
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">To Pay</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removePaymentLineItem(index)}
                          className="flex-1 sm:flex-initial"
                        >
                          <Trash2 className="h-4 w-4 sm:mr-0" />
                          <span className="sm:hidden ml-1">Delete</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {/* Add Payment button after last item */}
                {paymentLineItems.length > 0 && (
                  <div className="flex justify-center mt-4">
                    <Button onClick={addPaymentLineItem} size="lg" variant="outline" className="border-2 border-dashed border-green-400 hover:border-green-600 hover:bg-green-50">
                      <Plus className="h-5 w-5 mr-2" />
                      Add Another Payment
                    </Button>
                  </div>
                )}
              </div>

              {/* Total Paid Summary */}
              {paymentLineItems.length > 0 && (
                <div className="mt-4 p-4 bg-green-100 rounded-lg border-2 border-green-300">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Paid:</span>
                    <span className="text-2xl font-bold text-green-600">
                      ${calculateTotalPaid().toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* NRE Line Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">NRE Line Items</h3>
                <Button onClick={addLineItem} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line Item
                </Button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <Card key={index} className="p-6 border-2">
                    <div className="space-y-4">
                      {/* Row 1: Line #, Description, Category */}
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-1">
                          <Label className="text-sm font-semibold">Line #</Label>
                          <Input
                            type="number"
                            value={item.lineItemNumber}
                            onChange={(e) => updateLineItem(index, 'lineItemNumber', parseInt(e.target.value))}
                            className="text-center font-bold"
                          />
                        </div>
                        <div className="col-span-6">
                          <Label className="text-sm font-semibold">Description *</Label>
                          <Input
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            placeholder="Enter item description"
                            className="text-base"
                          />
                        </div>
                        <div className="col-span-5">
                          <Label className="text-sm font-semibold">Category *</Label>
                          <select
                            value={item.category}
                            onChange={(e) => updateLineItem(index, 'category', e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-base"
                          >
                            {NRE_CATEGORIES.map((cat) => (
                              <option key={cat.value} value={cat.value}>
                                {cat.label}
                              </option>
                            ))}
                          </select>
                          {item.category === 'CUSTOM' && (
                            <Input
                              value={item.customCategory || ''}
                              onChange={(e) => updateLineItem(index, 'customCategory', e.target.value)}
                              placeholder="Enter custom category name"
                              className="mt-2 text-base border-blue-300"
                            />
                          )}
                        </div>
                      </div>

                      {/* Row 2: Quantity, Unit Price, Total, Delete */}
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-2">
                          <Label className="text-sm font-semibold">Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 0)}
                            className="text-base"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-sm font-semibold">Unit Price ($) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="text-base"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-sm font-semibold">Line Total</Label>
                          <div className="px-3 py-2 bg-gray-100 rounded-md font-bold text-lg text-blue-600">
                            ${item.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        <div className="col-span-4 flex items-end justify-end">
                          <Button
                            variant="destructive"
                            size="lg"
                            onClick={() => removeLineItem(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      </div>

                      {/* Row 3: Notes */}
                      <div>
                        <Label className="text-sm font-semibold">Notes (Optional)</Label>
                        <Input
                          value={item.notes || ''}
                          onChange={(e) => updateLineItem(index, 'notes', e.target.value)}
                          placeholder="Add any additional notes or details"
                          className="text-base"
                        />
                      </div>
                    </div>
                  </Card>
                ))}
                
                {/* Add Line Item button after last item */}
                {lineItems.length > 0 && (
                  <div className="flex justify-center mt-4">
                    <Button onClick={addLineItem} size="lg" variant="outline" className="border-2 border-dashed border-blue-400 hover:border-blue-600 hover:bg-blue-50">
                      <Plus className="h-5 w-5 mr-2" />
                      Add Another Line Item
                    </Button>
                  </div>
                )}
              </div>

            {/* Grand Total */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Grand Total:</span>
                <span className="text-2xl font-bold text-blue-600">
                  ${calculateGrandTotal().toLocaleString()}
                </span>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-4 flex items-center">
                <Upload className="h-4 w-4 mr-2" />
                Documents & Attachments
              </h4>
              
              {/* Existing Documents */}
              {existingDocs.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium text-green-800 mb-2">Existing Documents:</h5>
                  <div className="space-y-2">
                    {existingDocs.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between bg-white p-3 rounded border border-green-200">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">{doc.fileName}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc.filePath, doc.fileName)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.filePath)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-white">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="nre-file-upload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
                <label htmlFor="nre-file-upload" className="cursor-pointer">
                  <div className="text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    <p className="text-green-700 font-medium">Click to upload {existingDocs.length > 0 ? 'more ' : ''}documents</p>
                    <p className="text-sm text-green-600">PDF, DOC, XLS, Images supported • Multiple files allowed</p>
                  </div>
                </label>
                
                {uploadedDocs.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="font-medium text-green-800">New Files to Upload:</h5>
                    {uploadedDocs.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-100 p-3 rounded border border-green-200">
                        <div className="flex items-center space-x-2">
                          <Upload className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">{file.name}</span>
                          <span className="text-xs text-green-600">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBudget}>
                {editingBudget ? 'Save NRE Budget' : 'Create NRE Budget'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Preview Dialog - Full Page on Desktop */}
      <Dialog open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[98vh] overflow-y-auto p-8 sm:!max-w-[95vw] sm:!w-[95vw]">
          {pdfPreviewBudget && (
            <div>
              <DialogHeader>
                <DialogTitle>NRE Budget PDF Preview</DialogTitle>
              </DialogHeader>

              {/* Hidden element for PDF generation */}
              <div className="nre-preview-for-pdf bg-white p-8 mb-6" style={{ width: '794px' }}>
                <div className="mb-6 text-center border-b-2 border-blue-600 pb-4">
                  <h1 className="text-2xl font-bold text-gray-800">NRE BUDGET</h1>
                  <p className="text-lg font-mono text-blue-600 mt-2">{pdfPreviewBudget.nreReferenceNumber}</p>
                </div>

                {/* Budget Details */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <p className="font-semibold text-gray-700">Vendor:</p>
                    <p className="text-gray-900">{pdfPreviewBudget.vendorName}</p>
                  </div>
                  {pdfPreviewBudget.quoteNumber && (
                    <div>
                      <p className="font-semibold text-gray-700">Quote Number:</p>
                      <p className="text-gray-900">{pdfPreviewBudget.quoteNumber}</p>
                    </div>
                  )}
                  {pdfPreviewBudget.quoteDate && (
                    <div>
                      <p className="font-semibold text-gray-700">Quote Date:</p>
                      <p className="text-gray-900">{new Date(pdfPreviewBudget.quoteDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  {pdfPreviewBudget.paymentTerms && (
                    <div>
                      <p className="font-semibold text-gray-700">Payment Terms:</p>
                      <p className="text-gray-900">{pdfPreviewBudget.paymentTerms}</p>
                    </div>
                  )}
                </div>

                {/* NRE Line Items Table */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-2 text-gray-800">NRE Line Items</h3>
                  <table className="w-full border-collapse border border-gray-300 text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border border-gray-300 px-2 py-1 text-left">#</th>
                        <th className="border border-gray-300 px-2 py-1 text-left">Description</th>
                        <th className="border border-gray-300 px-2 py-1 text-left">Category</th>
                        <th className="border border-gray-300 px-2 py-1 text-right">Qty</th>
                        <th className="border border-gray-300 px-2 py-1 text-right">Unit Price</th>
                        <th className="border border-gray-300 px-2 py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfPreviewBudget.lineItems.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-2 py-1">{item.lineItemNumber}</td>
                          <td className="border border-gray-300 px-2 py-1">{item.description}</td>
                          <td className="border border-gray-300 px-2 py-1">{NRE_CATEGORIES.find(c => c.value === item.category)?.label || item.category}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right">{item.quantity}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right">${item.unitPrice.toLocaleString()}</td>
                          <td className="border border-gray-300 px-2 py-1 text-right font-semibold">${item.totalAmount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Payment Schedule Table */}
                {pdfPreviewBudget.paymentLineItems && pdfPreviewBudget.paymentLineItems.length > 0 && (
                  <div className="mb-6 bg-green-50 p-4 rounded">
                    <h3 className="text-sm font-semibold mb-2 text-green-800">Payment Schedule</h3>
                    <table className="w-full border-collapse border border-green-300 text-xs">
                      <thead className="bg-green-100">
                        <tr>
                          <th className="border border-green-300 px-2 py-1 text-left">Payment #</th>
                          <th className="border border-green-300 px-2 py-1 text-left">Date</th>
                          <th className="border border-green-300 px-2 py-1 text-left">Notes</th>
                          <th className="border border-green-300 px-2 py-1 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pdfPreviewBudget.paymentLineItems.map((payment, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-green-50'}>
                            <td className="border border-green-300 px-2 py-1">{payment.paymentNumber}</td>
                            <td className="border border-green-300 px-2 py-1">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                            <td className="border border-green-300 px-2 py-1">{payment.notes || '-'}</td>
                            <td className="border border-green-300 px-2 py-1 text-right font-semibold text-green-600">${payment.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-green-100 font-bold">
                          <td colSpan={3} className="border border-green-300 px-2 py-1 text-right">Total Paid:</td>
                          <td className="border border-green-300 px-2 py-1 text-right text-green-600">
                            ${pdfPreviewBudget.paymentLineItems.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Total Section */}
                <div className="flex justify-end mb-4">
                  <div className="w-48">
                    <div className="border-t-2 border-gray-300 pt-2">
                      <div className="flex justify-between items-center text-sm font-bold">
                        <span>Grand Total:</span>
                        <span className="text-blue-600">${pdfPreviewBudget.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-300 pt-2 mt-4 text-center text-xs text-gray-600">
                  <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
                  <p className="mt-1">Boundless Devices, Inc. • 343 S Highway 101, Ste 200 • Solana Beach, CA 92075</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowPdfPreview(false)}>
                  Close Preview
                </Button>
                <Button 
                  onClick={async () => {
                    if (pdfPreviewBudget) {
                      await handlePdfDownload(pdfPreviewBudget);
                      setShowPdfPreview(false);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={isGeneratingPdf}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isGeneratingPdf ? 'Generating PDF...' : 'Download PDF'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Schedule Report Modal */}
      <Dialog open={showReportModal} onOpenChange={setShowReportModal}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[98vh] overflow-y-auto p-3 sm:p-4 md:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span>NRE Payment Schedule Report</span>
              <Button onClick={handleDownloadCSV} variant="default" className="bg-green-600 hover:bg-green-700 w-full sm:w-auto text-sm">
                <FileDown className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {nreBudgets && nreBudgets.length > 0 ? (
              nreBudgets.map((budget) => (
                budget.paymentLineItems && budget.paymentLineItems.length > 0 && (
                  <Card key={budget.id} className="border-2">
                    <CardHeader className="bg-blue-50 border-b-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold text-blue-900">{budget.nreReferenceNumber}</h3>
                          <p className="text-sm text-gray-600">
                            Vendor: {budget.vendorName}
                            {budget.projectName && ` • Project: ${budget.projectName}`}
                            {budget.quoteNumber && ` • Quote: ${budget.quoteNumber}`}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-sm">
                          {budget.paymentLineItems.length} Payment{budget.paymentLineItems.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-4">
                      <div className="overflow-x-auto -mx-2 sm:mx-0">
                        <table className="w-full border-collapse min-w-[600px]">
                          <thead>
                            <tr className="bg-gray-100 border-b-2">
                              <th className="text-left px-2 sm:px-3 py-2 font-semibold text-xs sm:text-sm">Payment #</th>
                              <th className="text-left px-2 sm:px-3 py-2 font-semibold text-xs sm:text-sm">Date</th>
                              <th className="text-right px-2 sm:px-3 py-2 font-semibold text-xs sm:text-sm">Amount</th>
                              <th className="text-center px-2 sm:px-3 py-2 font-semibold text-xs sm:text-sm">Status</th>
                              <th className="text-left px-2 sm:px-3 py-2 font-semibold text-xs sm:text-sm">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {budget.paymentLineItems.map((payment, idx) => {
                              const status = getPaymentStatus(payment);
                              const bgColor = getPaymentCardBackground(payment);
                              
                              return (
                                <tr key={idx} className={`border-b ${bgColor}`}>
                                  <td className="px-2 sm:px-3 py-2">
                                    <Badge variant="secondary" className="font-mono text-xs">
                                      #{payment.paymentNumber}
                                    </Badge>
                                  </td>
                                  <td className="px-2 sm:px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                                    {new Date(payment.paymentDate).toLocaleDateString()}
                                  </td>
                                  <td className="px-2 sm:px-3 py-2 text-right font-semibold text-green-600 text-xs sm:text-sm whitespace-nowrap">
                                    ${payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-2 sm:px-3 py-2 text-center">
                                    <Badge 
                                      variant={status === 'PAID' ? 'default' : status === 'OVERDUE' ? 'destructive' : 'secondary'}
                                      className={`text-xs ${status === 'PAID' ? 'bg-green-600' : status === 'PENDING' ? 'bg-yellow-500' : ''}`}
                                    >
                                      {status}
                                    </Badge>
                                  </td>
                                  <td className="px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-600">
                                    {payment.notes || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-blue-50 border-t-2 font-bold">
                              <td colSpan={2} className="px-2 sm:px-3 py-2 sm:py-3 text-right text-xs sm:text-sm">
                                TOTAL FOR {budget.nreReferenceNumber}:
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 text-right text-blue-600 text-sm sm:text-base md:text-lg whitespace-nowrap">
                                ${budget.paymentLineItems.reduce((sum, p) => sum + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              ))
            ) : (
              <div className="text-center py-12 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No NRE budgets with payment schedules found.</p>
              </div>
            )}

            {/* Grand Total Summary */}
            {nreBudgets && nreBudgets.length > 0 && (
              <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-none">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold">Grand Total - All NRE Budgets</h3>
                      <p className="text-blue-100 text-xs sm:text-sm">
                        {nreBudgets.filter(b => b.paymentLineItems && b.paymentLineItems.length > 0).length} Budget(s) • {' '}
                        {nreBudgets.reduce((sum, b) => sum + (b.paymentLineItems?.length || 0), 0)} Total Payments
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-2xl sm:text-3xl font-bold">
                        ${nreBudgets.reduce((sum, b) => 
                          sum + (b.paymentLineItems?.reduce((pSum, p) => pSum + p.amount, 0) || 0), 0
                        ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowReportModal(false)} className="w-full sm:w-auto">
              Close
            </Button>
            <Button onClick={handleDownloadCSV} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
              <FileDown className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Analytics Dashboard Modal */}
      <Dialog open={showAnalyticsModal} onOpenChange={setShowAnalyticsModal}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[98vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-purple-600" />
              NRE Spend Analytics Dashboard
            </DialogTitle>
          </DialogHeader>

          {/* Group By Selector */}
          <div className="flex gap-4 items-center p-4 bg-purple-50 rounded-lg border-2 border-purple-200 mt-4">
            <Label className="font-semibold text-purple-900">Group By:</Label>
            <div className="flex gap-2">
              <Button
                variant={analyticsGroupBy === 'project' ? 'default' : 'outline'}
                onClick={() => setAnalyticsGroupBy('project')}
                className={analyticsGroupBy === 'project' ? 'bg-purple-600' : ''}
              >
                Project
              </Button>
              <Button
                variant={analyticsGroupBy === 'sku' ? 'default' : 'outline'}
                onClick={() => setAnalyticsGroupBy('sku')}
                className={analyticsGroupBy === 'sku' ? 'bg-purple-600' : ''}
              >
                SKU
              </Button>
              <Button
                variant={analyticsGroupBy === 'category' ? 'default' : 'outline'}
                onClick={() => setAnalyticsGroupBy('category')}
                className={analyticsGroupBy === 'category' ? 'bg-purple-600' : ''}
              >
                Category
              </Button>
              <Button
                variant={analyticsGroupBy === 'vendor' ? 'default' : 'outline'}
                onClick={() => setAnalyticsGroupBy('vendor')}
                className={analyticsGroupBy === 'vendor' ? 'bg-purple-600' : ''}
              >
                Vendor
              </Button>
            </div>
          </div>

          <div className="mt-6">
            {/* Group by Project */}
            {analyticsGroupBy === 'project' && (() => {
              const projectTotals = new Map<string, { total: number; count: number; budgets: NREBudget[] }>();
              nreBudgets?.forEach(budget => {
                const projectKey = budget.projectName || 'Unassigned';
                const existing = projectTotals.get(projectKey) || { total: 0, count: 0, budgets: [] };
                projectTotals.set(projectKey, {
                  total: existing.total + budget.totalAmount,
                  count: existing.count + 1,
                  budgets: [...existing.budgets, budget]
                });
              });

              const sortedProjects = Array.from(projectTotals.entries()).sort((a, b) => b[1].total - a[1].total);
              const grandTotal = Array.from(projectTotals.values()).reduce((sum, p) => sum + p.total, 0);

              return (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Total NRE Spend by Project</h3>
                    <p className="text-3xl font-bold">${grandTotal.toLocaleString()}</p>
                    <p className="text-purple-100 text-sm mt-1">{sortedProjects.length} Projects • {nreBudgets?.length || 0} Total Budgets</p>
                  </div>

                  {sortedProjects.map(([project, data]) => (
                    <Card key={project} className="border-2 hover:shadow-lg transition-shadow">
                      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{project}</CardTitle>
                            <CardDescription>{data.count} Budget{data.count !== 1 ? 's' : ''}</CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600">
                              ${data.total.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {((data.total / grandTotal) * 100).toFixed(1)}% of total
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          {data.budgets.map(budget => (
                            <div key={budget.id} className="grid grid-cols-3 items-center text-sm border-b pb-2">
                              <span className="font-mono text-xs">{budget.nreReferenceNumber}</span>
                              <span className="text-gray-600 text-center">{budget.vendorName}</span>
                              <span className="font-semibold text-green-600 text-right">${budget.totalAmount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}

            {/* Group by SKU */}
            {analyticsGroupBy === 'sku' && (() => {
              const skuTotals = new Map<string, { total: number; count: number; budgets: NREBudget[] }>();
              nreBudgets?.forEach(budget => {
                const skuKey = budget.skuCode || 'No SKU';
                const existing = skuTotals.get(skuKey) || { total: 0, count: 0, budgets: [] };
                skuTotals.set(skuKey, {
                  total: existing.total + budget.totalAmount,
                  count: existing.count + 1,
                  budgets: [...existing.budgets, budget]
                });
              });

              const sortedSkus = Array.from(skuTotals.entries()).sort((a, b) => b[1].total - a[1].total);
              const grandTotal = Array.from(skuTotals.values()).reduce((sum, s) => sum + s.total, 0);

              return (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Total NRE Spend by SKU</h3>
                    <p className="text-3xl font-bold">${grandTotal.toLocaleString()}</p>
                    <p className="text-purple-100 text-sm mt-1">{sortedSkus.length} SKUs • {nreBudgets?.length || 0} Total Budgets</p>
                  </div>

                  {sortedSkus.map(([sku, data]) => {
                    const skuInfo = skus.find(s => s.sku_code === sku);
                    return (
                      <Card key={sku} className="border-2 hover:shadow-lg transition-shadow">
                        <CardHeader className="bg-gradient-to-r from-green-50 to-purple-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg font-mono">{sku}</CardTitle>
                              <CardDescription>
                                {skuInfo?.sku_name || `${data.count} Budget${data.count !== 1 ? 's' : ''}`}
                              </CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-purple-600">
                                ${data.total.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-500">
                                {((data.total / grandTotal) * 100).toFixed(1)}% of total
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            {data.budgets.map(budget => (
                              <div key={budget.id} className="grid grid-cols-3 items-center text-sm border-b pb-2">
                                <span className="font-mono text-xs">{budget.nreReferenceNumber}</span>
                                <span className="text-gray-600 text-center">{budget.projectName || 'No Project'}</span>
                                <span className="font-semibold text-green-600 text-right">${budget.totalAmount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}

            {/* Group by Category */}
            {analyticsGroupBy === 'category' && (() => {
              const categoryTotals = new Map<string, { total: number; count: number; lineItems: Array<{ budget: NREBudget; item: NRELineItem }> }>();
              nreBudgets?.forEach(budget => {
                budget.lineItems.forEach(item => {
                  const categoryKey = item.category;
                  const existing = categoryTotals.get(categoryKey) || { total: 0, count: 0, lineItems: [] };
                  categoryTotals.set(categoryKey, {
                    total: existing.total + item.totalAmount,
                    count: existing.count + 1,
                    lineItems: [...existing.lineItems, { budget, item }]
                  });
                });
              });

              const sortedCategories = Array.from(categoryTotals.entries()).sort((a, b) => b[1].total - a[1].total);
              const grandTotal = Array.from(categoryTotals.values()).reduce((sum, c) => sum + c.total, 0);

              return (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Total NRE Spend by Category</h3>
                    <p className="text-3xl font-bold">${grandTotal.toLocaleString()}</p>
                    <p className="text-purple-100 text-sm mt-1">{sortedCategories.length} Categories • {Array.from(categoryTotals.values()).reduce((sum, c) => sum + c.count, 0)} Line Items</p>
                  </div>

                  {sortedCategories.map(([category, data]) => {
                    const categoryLabel = NRE_CATEGORIES.find(c => c.value === category)?.label || category;
                    return (
                      <Card key={category} className="border-2 hover:shadow-lg transition-shadow">
                        <CardHeader className="bg-gradient-to-r from-orange-50 to-purple-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">{categoryLabel}</CardTitle>
                              <CardDescription>{data.count} Line Item{data.count !== 1 ? 's' : ''}</CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-purple-600">
                                ${data.total.toLocaleString()}
                              </div>
                              <div className="text-sm text-gray-500">
                                {((data.total / grandTotal) * 100).toFixed(1)}% of total
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {data.lineItems.slice(0, 10).map(({ budget, item }, idx) => (
                              <div key={`${budget.id}-${idx}`} className="flex justify-between items-center text-sm border-b pb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-mono text-xs text-gray-500">{budget.nreReferenceNumber}</div>
                                  <div className="text-xs text-gray-600 truncate">{item.description}</div>
                                </div>
                                <span className="font-semibold text-green-600 ml-2">${item.totalAmount.toLocaleString()}</span>
                              </div>
                            ))}
                            {data.lineItems.length > 10 && (
                              <div className="text-center text-sm text-gray-500 py-2">
                                +{data.lineItems.length - 10} more items
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}

            {/* Group by Vendor */}
            {analyticsGroupBy === 'vendor' && (() => {
              const vendorTotals = new Map<string, { total: number; count: number; budgets: NREBudget[] }>();
              nreBudgets?.forEach(budget => {
                const vendorKey = budget.vendorName || 'Unknown Vendor';
                const existing = vendorTotals.get(vendorKey) || { total: 0, count: 0, budgets: [] };
                vendorTotals.set(vendorKey, {
                  total: existing.total + budget.totalAmount,
                  count: existing.count + 1,
                  budgets: [...existing.budgets, budget]
                });
              });

              const sortedVendors = Array.from(vendorTotals.entries()).sort((a, b) => b[1].total - a[1].total);
              const grandTotal = Array.from(vendorTotals.values()).reduce((sum, v) => sum + v.total, 0);

              return (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-lg">
                    <h3 className="text-xl font-bold mb-2">Total NRE Spend by Vendor</h3>
                    <p className="text-3xl font-bold">${grandTotal.toLocaleString()}</p>
                    <p className="text-purple-100 text-sm mt-1">{sortedVendors.length} Vendors • {nreBudgets?.length || 0} Total Budgets</p>
                  </div>

                  {sortedVendors.map(([vendor, data]) => (
                    <Card key={vendor} className="border-2 hover:shadow-lg transition-shadow">
                      <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{vendor}</CardTitle>
                            <CardDescription>{data.count} Budget{data.count !== 1 ? 's' : ''}</CardDescription>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600">
                              ${data.total.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-500">
                              {((data.total / grandTotal) * 100).toFixed(1)}% of total
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="space-y-2">
                          {data.budgets.map(budget => (
                            <div key={budget.id} className="grid grid-cols-3 items-center text-sm border-b pb-2">
                              <span className="font-mono text-xs">{budget.nreReferenceNumber}</span>
                              <span className="text-gray-600 text-center">{budget.projectName || 'No Project'}</span>
                              <span className="font-semibold text-green-600 text-right">${budget.totalAmount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <Button 
              onClick={() => {
                if (!nreBudgets) return;

                // CSV Header - One row per LINE ITEM for pivoting by Category
                const headers = ['NRE Number', 'Vendor', 'Project', 'Line Item #', 'Description', 'Amount', 'Payment Date', 'Payment Status', 'Category'];
                const rows = [headers];

                // Add data rows - one row per line item
                nreBudgets.forEach((budget) => {
                  // Calculate overall payment status for the budget
                  const payments = budget.paymentLineItems || [];
                  const totalPaid = payments.filter(p => p.isPaid).reduce((sum, p) => sum + p.amount, 0);
                  const totalBudget = budget.totalAmount;
                  let overallStatus = 'Not Paid';
                  if (totalPaid >= totalBudget) {
                    overallStatus = 'Paid';
                  } else if (totalPaid > 0) {
                    overallStatus = 'Partially Paid';
                  }

                  // Get the first payment date for this NRE budget (applies to all line items)
                  const firstPayment = payments.find(p => p.paymentDate);
                  const paymentDate = firstPayment?.paymentDate 
                    ? new Date(firstPayment.paymentDate).toLocaleDateString() 
                    : '';

                  // One row per line item (each has its own category)
                  budget.lineItems.forEach((item) => {
                    const cat = item.category === 'CUSTOM' && item.customCategory ? item.customCategory : item.category;
                    const categoryLabel = NRE_CATEGORIES.find(c => c.value === cat)?.label || cat;

                    rows.push([
                      budget.nreReferenceNumber,
                      budget.vendorName,
                      budget.projectName || '',
                      item.lineItemNumber.toString(),
                      item.description || '',
                      item.totalAmount.toFixed(2),
                      paymentDate,
                      overallStatus,
                      categoryLabel
                    ]);
                  });
                });

                // Convert to CSV string
                const csvContent = rows.map(row => 
                  row.map(cell => `"${cell}"`).join(',')
                ).join('\n');

                // Download
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `NRE_Analytics_Export_${new Date().toISOString().split('T')[0]}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => setShowAnalyticsModal(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
