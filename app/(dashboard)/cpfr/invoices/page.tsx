'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User, ProductSku, InvoiceDocument } from '@/lib/db/schema';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createClient } from '@supabase/supabase-js';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  requestedDeliveryWeek: string;
  status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered' | 'submitted' | 'approved' | 'rejected' | 'submitted_to_finance' | 'approved_by_finance' | 'rejected_by_finance';
  terms: string; // NET30, NET60, etc.
  incoterms: string; // FOB, CIF, DDP, etc.
  incotermsLocation: string; // Shanghai Port, Los Angeles, etc.
  totalValue: number;
  documents?: string[]; // Array of document URLs/paths
  notes?: string;
  createdBy: string;
  createdAt: string;
  // NEW FIELDS: Addresses and shipping
  customerAddress?: string;
  shipToAddress?: string;
  shipDate?: string;
  // NEW FIELDS: Bank information
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankSwiftCode?: string;
  bankIban?: string;
  bankAddress?: string;
  bankCountry?: string;
  bankCurrency?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function InvoicesPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ); // For signed URL generation
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: invoices, mutate: mutateInvoices } = useSWR<Invoice[]>('/api/cpfr/invoices', fetcher);
  const { data: purchaseOrders } = useSWR<any[]>('/api/cpfr/purchase-orders', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=true', fetcher);

  // Simple PDF Generation Function
  const generateInvoicePDF = async (includeCFOSignature = false, cfoName = '') => {
    console.log('📄 Starting PDF generation...', includeCFOSignature ? 'with CFO signature' : 'sales only');
    
    const invoiceElement = document.querySelector('.invoice-preview-for-pdf');
    if (!invoiceElement) {
      throw new Error('Invoice preview element not found');
    }

    const canvas = await html2canvas(invoiceElement as HTMLElement, {
      scale: 2, // Back to 2 for crisp text quality
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      logging: false,
      onclone: (clonedDoc) => {
        // Fix oklch colors AND replace custom fonts with system fonts
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach(el => {
          const computedStyle = window.getComputedStyle(el as Element);
          
          // Fix oklch colors
          if (computedStyle.color && computedStyle.color.includes('oklch')) {
            (el as HTMLElement).style.color = '#000';
          }
          if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('oklch')) {
            (el as HTMLElement).style.backgroundColor = '#fff';
          }
          if (computedStyle.borderColor && computedStyle.borderColor.includes('oklch')) {
            (el as HTMLElement).style.borderColor = '#ccc';
          }
          
          // Replace custom fonts with system fonts to reduce PDF size
          const fontFamily = computedStyle.fontFamily;
          if (fontFamily && (fontFamily.includes('Manrope') || fontFamily.includes('JetBrains') || fontFamily.includes('Share Tech'))) {
            (el as HTMLElement).style.fontFamily = 'Arial, Helvetica, sans-serif';
            console.log('🔤 Replaced custom font with system font for PDF');
          }
        });
        
        // Fix input fields for PDF - replace with their values
        const inputs = clonedDoc.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
          const inputEl = input as HTMLInputElement;
          const span = clonedDoc.createElement('span');
          span.textContent = inputEl.value || inputEl.placeholder || '';
          span.className = inputEl.className;
          span.style.cssText = inputEl.style.cssText;
          inputEl.parentNode?.replaceChild(span, inputEl);
        });
      }
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    
    // Test JPEG with high quality for smaller file size
    const imgData = canvas.toDataURL('image/jpeg', 0.95); // 95% quality for better text
    console.log('📊 Canvas size:', canvas.width, 'x', canvas.height);
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    // Use JPEG with high quality
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    
    // CFO signature removed - handled via email workflow instead
    
    const pdfDataUrl = pdf.output('dataurlstring');
    
    // Calculate and log file size
    const base64Data = pdfDataUrl.split(',')[1];
    const fileSizeBytes = Math.round((base64Data.length * 3) / 4);
    const fileSizeMB = (fileSizeBytes / (1024 * 1024)).toFixed(2);
    console.log('📄 PDF Size:', fileSizeBytes, 'bytes (', fileSizeMB, 'MB)');
    
    return pdfDataUrl;
  };

  // Function to send invoice PDF via email
  const sendInvoiceEmail = async (invoiceData: any, pdfUrl: string, recipients: string, ccRecipients: string) => {
    console.log('📧 Sending invoice email to recipients');
    
    try {
      const response = await fetch('/api/cpfr/invoices/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoiceData.id,
          invoiceNumber: invoiceData.invoice_number || invoiceData.invoiceNumber || 'N/A',
          pdfUrl: pdfUrl,
          recipients: recipients,
          ccRecipients: ccRecipients,
          customerName: invoiceData.customer_name || invoiceData.customerName || 'N/A',
          totalValue: invoiceData.total_value || invoiceData.totalValue || '0'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send email');
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending invoice email:', error);
      throw error;
    }
  };

  // Fetch line items for all invoices when invoices are loaded
  useEffect(() => {
    if (invoices && invoices.length > 0) {
      const fetchAllLineItems = async () => {
        const lineItemsData: Record<string, Array<{
          skuCode: string;
          skuName: string;
          quantity: number;
        }>> = {};

        for (const invoice of invoices) {
          try {
            const response = await fetch(`/api/cpfr/invoices/${invoice.id}/line-items`);
            if (response.ok) {
              const lineItems = await response.json();
              lineItemsData[invoice.id] = lineItems.map((item: any) => ({
                skuCode: item.skuCode,
                skuName: item.skuName,
                quantity: item.quantity
              }));
            }
          } catch (error) {
            console.error(`Error fetching line items for invoice ${invoice.id}:`, error);
            lineItemsData[invoice.id] = [];
          }
        }

        setInvoiceLineItems(lineItemsData);
      };

      fetchAllLineItems();
    }
  }, [invoices]);

  // Helper function to aggregate SKU quantities for display
  const getSkuSummary = (invoiceId: string) => {
    const lineItems = invoiceLineItems[invoiceId] || [];
    if (lineItems.length === 0) return (
      <DynamicTranslation userLanguage={userLocale} context="business">
        No items
      </DynamicTranslation>
    );

    // Aggregate quantities by SKU
    const skuTotals: Record<string, { name: string; quantity: number }> = {};
    
    lineItems.forEach(item => {
      if (skuTotals[item.skuCode]) {
        skuTotals[item.skuCode].quantity += item.quantity;
      } else {
        skuTotals[item.skuCode] = {
          name: item.skuName,
          quantity: item.quantity
        };
      }
    });

    // Format for display with commas
    const skuEntries = Object.entries(skuTotals);
    if (skuEntries.length === 0) return (
      <DynamicTranslation userLanguage={userLocale} context="business">
        No items
      </DynamicTranslation>
    );

    return skuEntries.map(([sku, data]) => 
      `${sku}: ${data.quantity.toLocaleString()}`
    ).join(' • ');
  };
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Generate Invoice modal states
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [generatedInvoice, setGeneratedInvoice] = useState<any>({
    invoiceNumber: '',
    customerName: '',
    invoiceDate: '',
    requestedDeliveryWeek: '',
    status: 'draft',
    terms: '',
    incoterms: '',
    incotermsLocation: '',
    totalValue: '',
    notes: '',
    poReference: '',
    lineItems: [],
    bankName: '',
    bankAccountNumber: '',
    bankRoutingNumber: '',
    bankSwiftCode: '',
    bankIban: '',
    bankAddress: '',
    bankCountry: '',
    bankCurrency: 'USD',
    customerAddress: '',
    shipToAddress: '',
    shipDate: ''
  });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [customPaymentTerms, setCustomPaymentTerms] = useState('');
  const [showCustomPaymentTerms, setShowCustomPaymentTerms] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState<'draft' | 'submitted' | 'submitted_to_finance'>('draft');
  const [customerAddress, setCustomerAddress] = useState('');
  const [shipToAddress, setShipToAddress] = useState('');
  const [shipDate, setShipDate] = useState('');
  const [bankInfo, setBankInfo] = useState({
    bankName: 'California Bank and Trust',
    accountNumber: '',
    routing: '',
    swift: '',
    iban: '',
    bankAddress: '',
    bankCountry: 'United States',
    currency: 'USD'
  });
  const [loadingLineItems, setLoadingLineItems] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  
  // New Simple CFO Modal States
  const [showNewCFOModal, setShowNewCFOModal] = useState(false);
  const [cfoInvoicePDFUrl, setCfoInvoicePDFUrl] = useState<string>('');
  const [cfoInvoiceData, setCfoInvoiceData] = useState<any>(null);
  const [emailRecipients, setEmailRecipients] = useState<string>('boundless_devices_inc+sales@assist.intuit.com');
  const [emailCCRecipients, setEmailCCRecipients] = useState<string>('invoices@boundlessdevices.com, dzand@boundlessdevices.com, scistulli@boundlessdevices.com');
  const [showRejectForm, setShowRejectForm] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  // Approved Invoice View Modal States
  const [showApprovedInvoiceModal, setShowApprovedInvoiceModal] = useState(false);
  const [approvedInvoiceData, setApprovedInvoiceData] = useState<any>(null);
  const [approvedInvoicePDFUrl, setApprovedInvoicePDFUrl] = useState<string>('');
  
  
  // CFO Approval states
  const [showCFOApprovalModal, setShowCFOApprovalModal] = useState(false);
  const [selectedInvoiceForApproval, setSelectedInvoiceForApproval] = useState<any>(null);
  const [approvalEmail, setApprovalEmail] = useState('');
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'rejected'>('approved');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customTerms, setCustomTerms] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [lineItems, setLineItems] = useState<Array<{
    id: string;
    skuId: string;
    sku: string;
    skuName: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>>([]);
  const [editUploadedDocs, setEditUploadedDocs] = useState<File[]>([]);
  const [existingDocs, setExistingDocs] = useState<InvoiceDocument[]>([]);
  const [editLineItems, setEditLineItems] = useState<Array<{
    id: string;
    skuId: string;
    sku: string;
    skuName: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>>([]);
  const [invoiceLineItems, setInvoiceLineItems] = useState<Record<string, Array<{
    skuCode: string;
    skuName: string;
    quantity: number;
  }>>>({});

  // Helper functions for line items
  const addLineItem = () => {
    const newItem = {
      id: Date.now().toString(),
      skuId: '',
      sku: '',
      skuName: '',
      quantity: 1,
      unitCost: 0,
      lineTotal: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: string, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // If SKU is selected, populate SKU code and name
        if (field === 'skuId' && value) {
          const selectedSku = skus?.find(sku => sku.id === value);
          if (selectedSku) {
            updatedItem.sku = selectedSku.sku;
            updatedItem.skuName = selectedSku.name;
          }
        }
        
        // Calculate line total
        updatedItem.lineTotal = updatedItem.quantity * updatedItem.unitCost;
        return updatedItem;
      }
      return item;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  };

        // Access control - Sales team and admins can manage Invoices
  if (!user || !['super_admin', 'admin', 'sales', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Sales team access required for purchase order management.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateInvoice = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cpfr/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNumber: formData.get('poNumber'),
          supplierName: formData.get('supplierName'),
          orderDate: formData.get('orderDate'),
          requestedDeliveryWeek: formData.get('requestedDeliveryWeek'),
          terms: formData.get('terms'),
          incoterms: formData.get('incoterms'),
          incotermsLocation: formData.get('incotermsLocation'),
          totalValue: calculateTotal(),
          notes: formData.get('notes'),
          lineItems: lineItems, // ✅ ADD LINE ITEMS TO CREATE REQUEST
        }),
      });

      if (response.ok) {
        mutateInvoices();
        setShowCreateModal(false);
        // Clear form state after successful creation
        setLineItems([]);
        setUploadedDocs([]);
        setCustomTerms(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to create PO: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      alert('Failed to create PO');
    }
    setIsLoading(false);
  };

  const invoicesArray = Array.isArray(invoices) ? invoices : [];
  const filteredInvoices = invoicesArray.filter(invoice => {
    const matchesSearch = !searchTerm || 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800',
      'sent': 'bg-blue-100 text-blue-800',
      'confirmed': 'bg-green-100 text-green-800',
      'shipped': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-emerald-100 text-emerald-800',
      'submitted': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="orders" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{tc('invoicesTitle', 'Invoices')} ({filteredInvoices.length})</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{tc('invoicesDescription', 'Manage customer invoices and billing')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
              // Clear all form state for a fresh invoice
              setLineItems([]);
              setUploadedDocs([]);
              setCustomTerms(false);
              setShowCreateModal(true);
            }}>
              <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
              {tc('enterInvoiceButton', 'Enter Invoice')}
            </Button>
            
            <Button 
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 hover:text-blue-800"
              onClick={() => {
                // Clear all states for NEW invoice generation
                setSelectedPO(null);
                setGeneratedInvoice(null);
                setEditingInvoiceId(null); // CRITICAL: Clear editing mode
                setCustomerAddress('');
                setShipToAddress('');
                setShipDate('');
                setBankInfo({
                  bankName: 'California Bank and Trust',
                  accountNumber: '',
                  routing: '',
                  swift: '',
                  iban: '',
                  bankAddress: '',
                  bankCountry: 'United States',
                  currency: 'USD'
                });
                setShowBankDetails(false);
                setShowGenerateModal(true);
              }}
            >
              <SemanticBDIIcon semantic="magic" size={16} className="mr-2 text-blue-700" />
              {tc('generateInvoiceButton', 'Generate Invoice')}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={tc('searchInvoicePlaceholder', 'Search by Invoice number or customer name...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="status-filter">{tc('status', 'Status')}:</Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">{tc('allStatus', 'All Status')}</option>
            <option value="draft">{tc('statusDraft', 'Draft')}</option>
            <option value="sent">{tc('statusSent', 'Sent')}</option>
            <option value="confirmed">{tc('statusConfirmed', 'Confirmed')}</option>
            <option value="shipped">{tc('statusShipped', 'Shipped')}</option>
            <option value="delivered">{tc('statusDelivered', 'Delivered')}</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="orders" size={20} className="mr-2" />
            {tc('invoicesTitle', 'Invoices')} ({filteredInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Invoices</h3>
              <p className="text-muted-foreground mb-4">Enter your first Invoice to start managing customer orders</p>
              <Button onClick={() => {
                // Clear all form state for a fresh invoice
                setLineItems([]);
                setUploadedDocs([]);
                setCustomTerms(false);
                setShowCreateModal(true);
              }}>
                <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                Enter First Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="font-semibold text-lg">
                          <DynamicTranslation userLanguage={userLocale} context="business">
                            Invoice #{invoice.invoiceNumber}
                          </DynamicTranslation>
                        </h3>
                        <Badge className={getStatusColor(invoice.status)}>
                          {tc(`status${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}`, invoice.status)}
                        </Badge>
                      </div>
                      
                      {/* Action Buttons - Right under invoice number */}
                      <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        {(() => {
                          // Check if this is a GENERATED invoice (has poReference) or ENTERED invoice
                          const isGeneratedInvoice = invoice.notes && invoice.notes.includes('Generated from PO:');
                          
                          return (
                            <>
                              <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={async () => {
                          
                          // Check if invoice is approved - use view-only modal
                          if (invoice.status === 'approved_by_finance') {
                            console.log('👁️ Viewing APPROVED invoice - opening view-only modal with resend option');
                            console.log('🔍 DEBUGGING: Full invoice data received:', invoice);
                            
                            // Get the PDF URL from the individual invoice API
                            console.log('🔍 FETCHING PDF URL from individual invoice API...');
                            try {
                              const response = await fetch(`/api/cpfr/invoices/${invoice.id}`);
                              if (response.ok) {
                                const fullInvoiceData = await response.json();
                                console.log('📄 PDF URL from API:', fullInvoiceData.approvedPdfUrl);
                                
                                if (fullInvoiceData.approvedPdfUrl) {
                                  // Use the PDF download API route instead of direct file access
                                  const pdfUrl = `/api/cpfr/invoices/pdf-download?filePath=${encodeURIComponent(fullInvoiceData.approvedPdfUrl)}`;
                                  console.log('🔗 Using PDF download API route:', pdfUrl);
                                  
                                  setApprovedInvoiceData(invoice);
                                  setApprovedInvoicePDFUrl(pdfUrl);
                                  setShowApprovedInvoiceModal(true);
                                } else {
                                  console.log('❌ No PDF URL found in API response');
                                  alert('❌ PDF not available for this approved invoice.');
                                }
                              } else {
                                console.log('❌ API call failed');
                                alert('❌ Could not load invoice data.');
                              }
                            } catch (error) {
                              console.error('❌ Error fetching invoice data:', error);
                              alert('❌ Error loading invoice data.');
                            }
                            return;
                            
                            // Use the stored PDF URL from when the invoice was approved
                            console.log('🔗 Loading stored PDF URL for approved invoice');
                            
                            const storedPdfUrl = (invoice as any).approved_pdf_url || (invoice as any).approvedPdfUrl;
                            
                            if (storedPdfUrl) {
                              console.log('✅ Found stored PDF URL:', storedPdfUrl);
                              setApprovedInvoiceData(invoice);
                              setApprovedInvoicePDFUrl(storedPdfUrl);
                              setShowApprovedInvoiceModal(true);
                            } else {
                              console.log('❌ No stored PDF URL found for approved invoice');
                              alert('❌ PDF not available for this approved invoice. Please contact support.');
                            }
                            return;
                          }
                          
                          if (invoice.status === 'rejected_by_finance' || invoice.status === 'submitted_to_finance') {
                            // REJECTED OR SUBMITTED INVOICE - Route to Generate Invoice modal for comprehensive editing
                            console.log('🔄 Editing REJECTED/SUBMITTED invoice - routing to Generate Invoice modal for full revision');
                            
                            // Extract PO reference from notes (handle rejection notes format)
                            let poReference = invoice.notes?.match(/Generated from PO: (.+?)(?:\n|$)/)?.[1];
                            
                            // If not found, try to extract from invoice number pattern
                            if (!poReference && invoice.invoiceNumber) {
                              // Try to extract from invoice number format like "INV-MT-EY20250710A-2025-1709"
                              const invoiceMatch = invoice.invoiceNumber.match(/INV-(.+?)-\d{4}-\d+/);
                              if (invoiceMatch) {
                                poReference = invoiceMatch[1];
                              }
                            }
                            
                            if (poReference) {
                              // Find the original PO
                              const originalPO = purchaseOrders?.find(po => po.purchaseOrderNumber === poReference);
                              if (originalPO) {
                                setSelectedPO(originalPO);
                                setEditingInvoiceId(invoice.id); // Set editing mode
                                
                                // Load existing invoice data for revision
                                fetch(`/api/cpfr/invoices/${invoice.id}/line-items`)
                                  .then(res => res.json())
                                  .then(existingLineItems => {
                                    console.log('📋 Loaded rejected invoice data for revision:', existingLineItems);
                                    
                                    // Populate Generate Invoice modal with existing invoice data
                                    setGeneratedInvoice({
                                      invoiceNumber: invoice.invoiceNumber,
                                      customerName: invoice.customerName,
                                      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                      requestedDeliveryWeek: invoice.requestedDeliveryWeek,
                                      status: 'draft', // Reset to draft for revision
                                      terms: invoice.terms,
                                      incoterms: invoice.incoterms,
                                      incotermsLocation: invoice.incotermsLocation,
                                      totalValue: invoice.totalValue,
                                      notes: invoice.notes,
                                      poReference: poReference,
                                      lineItems: existingLineItems.map((item: any) => ({
                                        id: item.id,
                                        skuId: item.skuId,
                                        sku: item.skuCode,
                                        skuCode: item.skuCode,
                                        skuName: item.skuName,
                                        description: item.description,
                                        quantity: item.quantity,
                                        unitCost: parseFloat(item.unitCost),
                                        unitPrice: parseFloat(item.unitCost),
                                        lineTotal: parseFloat(item.lineTotal),
                                        totalCost: parseFloat(item.lineTotal)
                                      }))
                                    });
                                    
                                    // Load bank info if available
                                    setBankInfo({
                                      bankName: invoice.bankName || 'California Bank and Trust',
                                      accountNumber: invoice.bankAccountNumber || '',
                                      routing: invoice.bankRoutingNumber || '',
                                      swift: invoice.bankSwiftCode || '',
                                      iban: invoice.bankIban || '',
                                      bankAddress: invoice.bankAddress || '',
                                      bankCountry: invoice.bankCountry || 'United States',
                                      currency: invoice.bankCurrency || 'USD'
                                    });
                                    
                                    setCustomerAddress(invoice.customerAddress || '');
                                    setShipToAddress(invoice.shipToAddress || '');
                                    setShipDate(invoice.shipDate || '');
                                    
                                    // Set invoice status to draft for editing
                                    setInvoiceStatus('draft');
                                    
                                    setShowGenerateModal(true);
                                  })
                                  .catch(error => {
                                    console.error('Error loading rejected invoice data:', error);
                                    alert('❌ Error loading invoice data for editing.');
                                  });
                              } else {
                                alert('❌ Cannot find original Purchase Order for this rejected invoice.');
                              }
                            } else {
                              alert('❌ Cannot find PO reference for this rejected invoice.');
                            }
                            return;
                          }
                          
                          if (isGeneratedInvoice) {
                            // GENERATED INVOICE - Route to Generate Invoice modal with PO context
                            console.log('🔄 Editing GENERATED invoice - routing to Generate Invoice modal');
                            
                            // Extract PO reference from notes (handle rejection notes format)
                            let poReference = invoice.notes?.match(/Generated from PO: (.+?)(?:\n|$)/)?.[1];
                            
                            // If not found, try to extract from invoice number pattern
                            if (!poReference && invoice.invoiceNumber) {
                              // Try to extract from invoice number format like "INV-MT-EY20250710A-2025-1709"
                              const invoiceMatch = invoice.invoiceNumber.match(/INV-(.+?)-\d{4}-\d+/);
                              if (invoiceMatch) {
                                poReference = invoiceMatch[1];
                              }
                            }
                            
                            if (poReference) {
                              // Find the original PO
                              const originalPO = purchaseOrders?.find(po => po.purchaseOrderNumber === poReference);
                              if (originalPO) {
                                setSelectedPO(originalPO);
                                setEditingInvoiceId(invoice.id); // Set editing mode
                                
                                // Load existing invoice line items and all data
                                fetch(`/api/cpfr/invoices/${invoice.id}/line-items`)
                                  .then(res => res.json())
                                  .then(existingLineItems => {
                                    console.log('📋 Loaded existing invoice line items:', existingLineItems);
                                    
                                    // Populate Generate Invoice modal with existing invoice data
                                    setGeneratedInvoice({
                                      invoiceNumber: invoice.invoiceNumber,
                                      customerName: invoice.customerName,
                                      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                      requestedDeliveryWeek: invoice.requestedDeliveryWeek,
                                      status: invoice.status,
                                      terms: invoice.terms,
                                      incoterms: invoice.incoterms,
                                      incotermsLocation: invoice.incotermsLocation,
                                      totalValue: invoice.totalValue,
                                      notes: invoice.notes,
                                      poReference: poReference,
                                      lineItems: existingLineItems || []
                                    });
                                    
                                    // Load saved address and bank data
                                    setCustomerAddress(invoice.customerAddress || '');
                                    setShipToAddress(invoice.shipToAddress || '');
                                    setShipDate(invoice.shipDate || '');
                                    setBankInfo({
                                      bankName: invoice.bankName || 'California Bank and Trust',
                                      accountNumber: invoice.bankAccountNumber || '',
                                      routing: invoice.bankRoutingNumber || '',
                                      swift: invoice.bankSwiftCode || '',
                                      iban: invoice.bankIban || '',
                                      bankAddress: invoice.bankAddress || '',
                                      bankCountry: invoice.bankCountry || 'United States',
                                      currency: invoice.bankCurrency || 'USD'
                                    });
                                  })
                                  .catch(error => {
                                    console.error('Error loading existing invoice line items:', error);
                                    // Still populate basic invoice data even if line items fail
                                    setGeneratedInvoice({
                                      invoiceNumber: invoice.invoiceNumber,
                                      customerName: invoice.customerName,
                                      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                      requestedDeliveryWeek: invoice.requestedDeliveryWeek,
                                      status: invoice.status,
                                      terms: invoice.terms,
                                      incoterms: invoice.incoterms,
                                      incotermsLocation: invoice.incotermsLocation,
                                      totalValue: invoice.totalValue,
                                      notes: invoice.notes,
                                      poReference: poReference,
                                      lineItems: []
                                    });
                                  });
                                
                                // Set status for editing
                                setInvoiceStatus(invoice.status === 'submitted' ? 'submitted' : 'draft');
                                
                                // Set custom payment terms if needed
                                const standardTerms = ['NET30', 'NET60', 'NET90', 'COD', 'PREPAID'];
                                if (!standardTerms.includes(invoice.terms)) {
                                  setShowCustomPaymentTerms(true);
                                  setCustomPaymentTerms(invoice.terms);
                                }
                                
                                setShowGenerateModal(true);
                              } else {
                                alert('❌ Original Purchase Order not found for this generated invoice.');
                              }
                            } else {
                              alert('❌ Cannot find PO reference for this generated invoice.');
                            }
                          } else {
                            // ENTERED INVOICE (Draft/Manual) - Use Generate Invoice modal for consistency
                            console.log('📝 Editing ENTERED invoice - using Generate Invoice modal for consistency');
                            
                            // For manually entered invoices, we don't have a PO, so create a minimal context
                            setSelectedPO(null); // No PO for manually entered invoices
                            setEditingInvoiceId(invoice.id); // Set editing mode
                            
                            // Load existing invoice line items and populate the Generate Invoice modal
                            fetch(`/api/cpfr/invoices/${invoice.id}/line-items`)
                              .then(res => res.json())
                              .then(existingLineItems => {
                                console.log('📋 Loaded entered invoice data for editing:', existingLineItems);
                                
                                // Populate Generate Invoice modal with existing invoice data
                                setGeneratedInvoice({
                                  invoiceNumber: invoice.invoiceNumber || '',
                                  customerName: invoice.customerName || '',
                                  invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                  requestedDeliveryWeek: invoice.requestedDeliveryWeek || '',
                                  status: invoice.status || 'draft',
                                  terms: invoice.terms || '',
                                  incoterms: invoice.incoterms || '',
                                  incotermsLocation: invoice.incotermsLocation || '',
                                  totalValue: invoice.totalValue || '',
                                  notes: invoice.notes || '',
                                  poReference: '', // No PO reference for manually entered
                                  lineItems: existingLineItems.map((item: any) => ({
                                    id: item.id,
                                    skuId: item.skuId,
                                    sku: item.skuCode || '',
                                    skuCode: item.skuCode || '',
                                    skuName: item.skuName || '',
                                    description: item.description || '',
                                    quantity: item.quantity || 0,
                                    unitCost: parseFloat(item.unitCost || 0),
                                    unitPrice: parseFloat(item.unitCost || 0),
                                    lineTotal: parseFloat(item.lineTotal || 0),
                                    totalCost: parseFloat(item.lineTotal || 0),
                                  })),
                                  // Bank details
                                  bankName: invoice.bankName || '',
                                  bankAccountNumber: invoice.bankAccountNumber || '',
                                  bankRoutingNumber: invoice.bankRoutingNumber || '',
                                  bankSwiftCode: invoice.bankSwiftCode || '',
                                  bankIban: invoice.bankIban || '',
                                  bankAddress: invoice.bankAddress || '',
                                  bankCountry: invoice.bankCountry || '',
                                  bankCurrency: invoice.bankCurrency || 'USD',
                                  // Address details
                                  customerAddress: invoice.customerAddress || '',
                                  shipToAddress: invoice.shipToAddress || '',
                                  shipDate: invoice.shipDate || '',
                                });
                                
                                setShowGenerateModal(true);
                              })
                              .catch(error => {
                                console.error('Error loading entered invoice data:', error);
                                alert('❌ Error loading invoice data for editing.');
                              });
                          }
                              }}>
                                <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                {tc('editButton', 
                                  invoice.status === 'rejected_by_finance' ? 'Revise Rejected' :
                                  invoice.status === 'submitted_to_finance' ? 'Edit Submitted' :
                                  isGeneratedInvoice ? 'Edit Generated' : 'Edit'
                                )}
                              </Button>
                              
                              {/* CFO Approval Button - Only show for submitted invoices and super_admin */}
                              {invoice.status === 'submitted' && user?.role === 'super_admin' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full sm:w-auto text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => {
                              setSelectedInvoiceForApproval(invoice);
                              setApprovalEmail('');
                              setApprovalStatus('approved');
                              setShowCFOApprovalModal(true);
                            }}
                          >
                            <SemanticBDIIcon semantic="check" size={14} className="mr-1" />
                            CFO Review
                          </Button>
                        )}
                        
                        {/* NEW: Approve Button for CFO/Super Admin */}
                        {(user?.role === 'super_admin' || user?.role === 'admin_cfo') && 
                         (invoice.status === 'submitted_to_finance' || invoice.status === 'rejected_by_finance') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                            onClick={async () => {
                              try {
                                console.log('🎯 CFO APPROVE: Opening CFO modal for invoice:', invoice.id);
                                
                                // Get the stored PDF file path from the database
                                const response = await fetch(`/api/cpfr/invoices/${invoice.id}`);
                                if (response.ok) {
                                  const invoiceData = await response.json();
                                  console.log('📄 Invoice data from API:', invoiceData);
                                  
                                  if (invoiceData.approvedPdfUrl) {
                                    console.log('✅ Found stored PDF file path:', invoiceData.approvedPdfUrl);
                                    
                                    // Use the PDF download API to get the PDF
                                    const pdfUrl = `/api/cpfr/invoices/pdf-download?filePath=${encodeURIComponent(invoiceData.approvedPdfUrl)}`;
                                    console.log('🔗 Using PDF download API route:', pdfUrl);
                                    
                                    setCfoInvoiceData(invoice);
                                    setCfoInvoicePDFUrl(pdfUrl);
                                    setShowNewCFOModal(true);
                                    
                                    console.log('✅ CFO Modal opened with PDF preview');
                                  } else {
                                    console.log('⚠️ No PDF file path in database - trying standard path for existing invoices');
                                    
                                    // For existing invoices, try the standard PDF path
                                    const expectedFilePath = `invoices/${invoice.id}/invoice-${invoice.id}-cfo-approval.pdf`;
                                    const pdfUrl = `/api/cpfr/invoices/pdf-download?filePath=${encodeURIComponent(expectedFilePath)}`;
                                    console.log('🔗 Trying expected PDF path:', expectedFilePath);
                                    
                                    setCfoInvoiceData(invoice);
                                    setCfoInvoicePDFUrl(pdfUrl);
                                    setShowNewCFOModal(true);
                                    
                                    console.log('✅ CFO Modal opened with expected PDF path');
                                  }
                                } else {
                                  console.error('❌ Failed to fetch invoice data');
                                  // Open without PDF if API call fails
                                  setCfoInvoiceData(invoice);
                                  setCfoInvoicePDFUrl('');
                                  setShowNewCFOModal(true);
                                }
                              } catch (error) {
                                console.error('❌ Error opening CFO modal:', error);
                                // Open without PDF if anything fails
                                setCfoInvoiceData(invoice);
                                setCfoInvoicePDFUrl('');
                                setShowNewCFOModal(true);
                              }
                            }}
                          >
                            <span className="mr-1 text-sm">✅</span>
                            Approve
                          </Button>
                        )}
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50"
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?\n\nThis action cannot be undone and will delete:\n• The invoice\n• All line items\n• All documents\n• All related data`)) {
                              try {
                                const response = await fetch(`/api/cpfr/invoices/${invoice.id}`, {
                                  method: 'DELETE'
                                });

                                if (response.ok) {
                                  const result = await response.json();
                                  alert(`✅ ${result.message}`);
                                  mutateInvoices(); // Refresh the invoice list
                                } else {
                                  const errorData = await response.json();
                                  alert(`❌ Failed to delete invoice: ${errorData.error || 'Unknown error'}`);
                                }
                              } catch (error) {
                                console.error('Error deleting invoice:', error);
                                alert('❌ Failed to delete invoice');
                              }
                            }
                          }}
                        >
                          <span className="mr-1 text-sm">🗑️</span>
                          {tc('deleteButton', 'Delete')}
                        </Button>
                            </>
                          );
                        })()}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Supplier:</span>
                          <p className="font-medium">
                            <DynamicTranslation userLanguage={userLocale} context="business">
                              {invoice.customerName}
                            </DynamicTranslation>
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Invoice Date:</span>
                          <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Delivery Week:</span>
                          <p className="font-medium">{invoice.shipDate ? new Date(invoice.shipDate).toLocaleDateString() : invoice.requestedDeliveryWeek || 'Not set'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Terms:</span>
                          <p className="font-medium">{invoice.terms}</p>
                        </div>
                      </div>
                      
                      {/* SKU Summary */}
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <SemanticBDIIcon semantic="inventory" size={14} className="text-blue-600" />
                          <span className="text-blue-800 font-medium text-sm">Line Items Summary:</span>
                        </div>
                        <p className="text-sm text-blue-700 font-mono">
                          {getSkuSummary(invoice.id)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div>
                          <span className="text-gray-500">Total Value:</span>
                          <span className="font-bold text-green-600">${Number(invoice.totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      {/* Status History & Notes Display */}
                      {invoice.notes && (
                        <div className="mt-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                            <SemanticBDIIcon semantic="notes" size={16} className="mr-2 text-blue-600" />
                            Status History & Notes
                          </h4>
                          <div className="bg-white p-3 rounded border">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                              {invoice.notes}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enter Invoice Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="orders" size={20} className="mr-2" />
                Create Invoice
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-6 lg:space-y-12 p-4 sm:p-6 lg:p-8" onSubmit={(e) => {
              e.preventDefault();
              handleCreateInvoice(new FormData(e.currentTarget));
            }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
                <div>
                  <Label htmlFor="poNumber">{tc('formLabels.invoiceNumber', 'Invoice Number')} *</Label>
                  <Input
                    id="poNumber"
                    name="poNumber"
                    placeholder="e.g., INV-2025-001"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="supplierName">{tc('formLabels.organization', 'Organization')} *</Label>
                  <select
                    id="supplierName"
                    name="supplierName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  >
                    <option value="">Select MFG Organization</option>
                    {organizations?.map((org: any) => (
                      <option key={org.id} value={org.code}>
                        {org.code} - {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-600 mt-1">
                    Select the Manufacturing/ODM organization (Factory) for CPFR signaling
                  </div>
                </div>
                <div>
                  <Label htmlFor="customCustomerName">Custom Customer Name</Label>
                  <Input
                    id="customCustomerName"
                    name="customCustomerName"
                    placeholder="Optional: Additional customer details"
                    className="mt-1"
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    Optional: Additional customer information beyond MFG code
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                <div>
                  <Label htmlFor="orderDate">Invoice Date *</Label>
                  <Input
                    id="orderDate"
                    name="orderDate"
                    type="date"
                    required
                    className="mt-1"
                  />
                </div>
                                  <div>
                    <Label htmlFor="requestedDeliveryWeek">Requested Delivery Week *</Label>
                    <Input
                      id="requestedDeliveryWeek"
                      name="requestedDeliveryWeek"
                      type="date"
                      required
                      className="mt-1"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      📅 Target delivery date
                    </div>
                  </div>
              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                  <div>
                    <Label htmlFor="terms">Payment Terms *</Label>
                  {!customTerms ? (
                    <div>
                      <select
                        id="terms"
                        name="terms"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                        onChange={(e) => {
                          if (e.target.value === 'CUSTOM') {
                            setCustomTerms(true);
                          }
                        }}
                      >
                        <option value="">Select Terms</option>
                        <option value="NET15">NET 15 - Payment due in 15 days</option>
                        <option value="NET30">NET 30 - Payment due in 30 days</option>
                        <option value="NET60">NET 60 - Payment due in 60 days</option>
                        <option value="NET90">NET 90 - Payment due in 90 days</option>
                        <option value="COD">COD - Cash on Delivery</option>
                        <option value="PREPAID">Prepaid - Payment in advance</option>
                        <option value="CUSTOM">📝 Enter Custom Terms</option>
                      </select>
                      <div className="mt-1 text-xs text-gray-600">
                        Standard payment terms or select custom
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex space-x-2">
                        <Input
                          id="terms"
                          name="terms"
                          placeholder="e.g., NET45, 2/10 Net 30, Letter of Credit"
                          required
                          className="flex-1 mt-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCustomTerms(false)}
                          className="mt-1"
                        >
                          Presets
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-blue-600">
                        💡 Enter custom payment terms (e.g., "2/10 Net 30" for 2% discount if paid in 10 days)
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="incoterms">IncoTerms 2020 *</Label>
                  <select
                    id="incoterms"
                    name="incoterms"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  >
                    <option value="">Select IncoTerms</option>
                    <optgroup label="🌍 Any Mode of Transport">
                      <option value="EXW">EXW - Ex Works (buyer arranges all transport)</option>
                      <option value="FCA">FCA - Free Carrier (seller to carrier)</option>
                      <option value="CPT">CPT - Carriage Paid To (seller pays freight)</option>
                      <option value="CIP">CIP - Carriage & Insurance Paid To (seller pays freight + insurance)</option>
                      <option value="DAP">DAP - Delivered at Place (seller delivers, buyer handles duties)</option>
                      <option value="DPU">DPU - Delivered at Place Unloaded (seller delivers & unloads)</option>
                      <option value="DDP">DDP - Delivered Duty Paid (seller handles everything)</option>
                    </optgroup>
                    <optgroup label="🚢 Sea & Inland Waterway Only">
                      <option value="FAS">FAS - Free Alongside Ship (seller delivers to port)</option>
                      <option value="FOB">FOB - Free on Board (seller loads vessel)</option>
                      <option value="CFR">CFR - Cost and Freight (seller pays shipping)</option>
                      <option value="CIF">CIF - Cost, Insurance & Freight (seller pays shipping + insurance)</option>
                    </optgroup>
                  </select>
                  <div className="mt-1 text-xs text-blue-600">
                    💡 IncoTerms 2020 - International trade delivery terms
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="incotermsLocation">IncoTerms Location *</Label>
                  <Input
                    id="incotermsLocation"
                    name="incotermsLocation"
                    placeholder="e.g., Shanghai Port, Los Angeles, Factory Gate"
                    required
                    className="mt-1"
                  />
                  <div className="mt-1 text-xs text-gray-600">
                    <DynamicTranslation userLanguage={userLocale} context="business">
                      Named place where IncoTerms apply (e.g., "FOB Shanghai")
                    </DynamicTranslation>
                  </div>
                </div>
              </div>



              {/* Line Items Section */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-blue-800 flex items-center">
                    <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                    Line Items
                  </h4>
                  <Button
                    type="button"
                    onClick={addLineItem}
                    variant="outline"
                    size="sm"
                    className="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                  >
                    <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {lineItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No line items added yet</p>
                    <p className="text-xs">
                      <DynamicTranslation userLanguage={userLocale} context="business">
                        Click "Add Item" to start building your PO
                      </DynamicTranslation>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 items-end">
                          <div>
                            <Label className="text-xs">SKU *</Label>
                            <select
                              value={item.skuId}
                              onChange={(e) => updateLineItem(item.id, 'skuId', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              required
                            >
                              <option value="">Select SKU</option>
                              {skus?.map((sku) => (
                                <option key={sku.id} value={sku.id}>
                                  {sku.sku} - {sku.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">{tc('formLabels.quantity', 'Quantity')} *</Label>
                            <Input
                              type="number"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                              min="1"
                              placeholder="0"
                              className="text-sm"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Cost *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitCost === 0 ? '' : item.unitCost}
                              onChange={(e) => updateLineItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                              min="0"
                              className="text-sm"
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Line Total</Label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono">
                              ${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <Button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Value Display */}
                    <div className="bg-blue-100 p-4 rounded border border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-800">Total Invoice Value:</span>
                        <span className="font-bold text-2xl text-blue-900">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Upload Section */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Supporting Documents
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                  <div>
                    <Label htmlFor="documents">Upload Documents</Label>
                    <input
                      type="file"
                      id="documents"
                      name="documents"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        setUploadedDocs(prev => [...prev, ...files]);
                        
                        // TODO: Implement real-time upload to Supabase
                        // For now, just add to local state for preview
                        // Files selected for upload
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      PDF, Word, Excel, Images - Max 10MB per file
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-3">Selected Documents ({uploadedDocs.length})</Label>
                    <div className="min-h-[150px] max-h-[200px] overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                      {uploadedDocs.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                          <SemanticBDIIcon semantic="upload" size={24} className="mx-auto mb-2 opacity-50" />
                          No documents selected yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {uploadedDocs.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 flex items-center justify-center">
                                  {file.type.includes('pdf') ? (
                                    <span className="text-red-600 text-sm font-bold">📄</span>
                                  ) : file.type.includes('word') || file.type.includes('document') ? (
                                    <span className="text-blue-600 text-sm font-bold">📝</span>
                                  ) : file.type.includes('sheet') || file.type.includes('excel') ? (
                                    <span className="text-green-600 text-sm font-bold">📊</span>
                                  ) : file.type.includes('image') ? (
                                    <span className="text-purple-600 text-sm font-bold">🖼️</span>
                                  ) : (
                                    <span className="text-gray-600 text-sm font-bold">📎</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block" title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {(file.size / 1024).toFixed(1)}KB
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setUploadedDocs(prev => prev.filter((_, i) => i !== index))}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Remove file"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  name="notes"
                  placeholder="Special instructions, delivery requirements, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isLoading}
                >
                  {tc('cancelButton', 'Cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="orders" size={16} className="mr-2 brightness-0 invert" />
                      {tc('enterInvoiceButton', 'Enter Invoice')}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Invoice Modal */}
      {selectedInvoice && !showCreateModal && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                Edit Invoice: {selectedInvoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription>
                Modify invoice details, line items, and upload supporting documents. Changes will be saved when you submit the form.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-8 p-8" onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              
              const formData = new FormData(e.currentTarget);
              
              try {
                // Calculate new total from line items
                const newTotal = editLineItems.reduce((sum, item) => sum + item.lineTotal, 0);

                const response = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    editCustomerName: formData.get('editCustomerName'),
                    editStatus: formData.get('editStatus'),
                    editTerms: formData.get('editTerms'),
                    editIncoterms: formData.get('editIncoterms'),
                    editIncotermsLocation: formData.get('editIncotermsLocation'),
                    editNotes: formData.get('editNotes'),
                    editTotalValue: newTotal.toString(),
                  }),
                });

                if (response.ok) {
                  const result = await response.json();
                  // Invoice updated successfully

                  // Update line items
                  if (editLineItems.length > 0) {
                    // Updating line items
                    try {
                      const lineItemsResponse = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}/line-items`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lineItems: editLineItems })
                      });

                      if (lineItemsResponse.ok) {
                        const lineItemsResult = await lineItemsResponse.json();
                        // Line items updated successfully
                      } else {
                        console.error('Failed to update line items');
                      }
                    } catch (lineItemsError) {
                      console.error('Line items update error:', lineItemsError);
                    }
                  }
                  
                  // Upload new documents if any
                  if (editUploadedDocs.length > 0) {
                    // Uploading new documents
                    try {
                      const uploadFormData = new FormData();
                      editUploadedDocs.forEach(file => uploadFormData.append('files', file));
                      
                      const uploadResponse = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}/documents`, {
                        method: 'POST',
                        body: uploadFormData
                      });
                      
                      if (uploadResponse.ok) {
                        const uploadResult = await uploadResponse.json();
                        // New files uploaded successfully
                        alert(`Invoice updated with ${uploadResult.uploaded} new documents uploaded!`);
                      } else {
                        alert('Invoice updated but new file upload failed');
                      }
                    } catch (uploadError) {
                      console.error('Upload error:', uploadError);
                      alert('Invoice updated but new file upload failed');
                    }
                  } else {
                    alert('Invoice updated successfully!');
                  }
                  
                  mutateInvoices(); // Refresh invoice list
                  setSelectedInvoice(null); // Close modal
                  setEditUploadedDocs([]); // Clear new files
                } else {
                  const errorData = await response.json();
                  alert(`Failed to update invoice: ${errorData.error || 'Unknown error'}`);
                }
              } catch (error) {
                console.error('Error updating invoice:', error);
                alert('Failed to update invoice');
              }
              
              setIsLoading(false);
            }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                <div>
                  <Label htmlFor="editInvoiceNumber">{tc('formLabels.invoiceNumber', 'Invoice Number')}</Label>
                  <Input
                    id="editInvoiceNumber"
                    defaultValue={selectedInvoice.invoiceNumber}
                    className="font-mono bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="editCustomerName">MFG/Customer Organization *</Label>
                  <select
                    id="editCustomerName"
                    name="editCustomerName"
                    defaultValue={selectedInvoice.customerName}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select MFG Organization</option>
                    {organizations?.map((org: any) => (
                      <option key={org.id} value={org.code}>
                        {org.code} - {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-600 mt-1">
                    Manufacturing/ODM organization for CPFR signaling
                  </div>
                </div>
                <div>
                  <Label htmlFor="editStatus">Status</Label>
                  <select
                    id="editStatus"
                    name="editStatus"
                    defaultValue={selectedInvoice.status}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="editTerms">Payment Terms</Label>
                  <Input
                    id="editTerms"
                    name="editTerms"
                    defaultValue={selectedInvoice.terms || ''}
                    placeholder="NET30"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-blue-800 flex items-center">
                    <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                    Line Items
                  </h4>
                  <Button
                    type="button"
                    onClick={() => {
                      const newItem = {
                        id: Date.now().toString(),
                        skuId: '',
                        sku: '',
                        skuName: '',
                        quantity: 0,
                        unitCost: 0,
                        lineTotal: 0
                      };
                      setEditLineItems([...editLineItems, newItem]);
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                  >
                    <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {editLineItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No line items found</p>
                    <p className="text-xs">Click "Add Item" to add line items</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editLineItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 items-end">
                          <div>
                            <Label className="text-xs">SKU *</Label>
                            <select
                              value={item.skuId}
                              onChange={(e) => {
                                const selectedSku = skus?.find(sku => sku.id === e.target.value);
                                if (selectedSku) {
                                  const updatedItems = [...editLineItems];
                                  updatedItems[index] = {
                                    ...item,
                                    skuId: selectedSku.id,
                                    sku: selectedSku.sku,
                                    skuName: selectedSku.name,
                                    lineTotal: item.quantity * item.unitCost
                                  };
                                  setEditLineItems(updatedItems);
                                }
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              required
                            >
                              <option value="">Select SKU</option>
                              {skus?.map((sku) => (
                                <option key={sku.id} value={sku.id}>
                                  {sku.sku} - {sku.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">{tc('formLabels.quantity', 'Quantity')} *</Label>
                            <Input
                              type="number"
                              value={item.quantity === 0 ? '' : item.quantity}
                              onChange={(e) => {
                                const quantity = parseInt(e.target.value) || 0;
                                const updatedItems = [...editLineItems];
                                updatedItems[index] = {
                                  ...item,
                                  quantity,
                                  lineTotal: quantity * item.unitCost
                                };
                                setEditLineItems(updatedItems);
                              }}
                              min="1"
                              placeholder="0"
                              className="text-sm"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Cost *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitCost === 0 ? '' : item.unitCost}
                              onChange={(e) => {
                                const unitCost = parseFloat(e.target.value) || 0;
                                const updatedItems = [...editLineItems];
                                updatedItems[index] = {
                                  ...item,
                                  unitCost,
                                  lineTotal: item.quantity * unitCost
                                };
                                setEditLineItems(updatedItems);
                              }}
                              min="0"
                              className="text-sm"
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Line Total</Label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono">
                              ${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <Button
                              type="button"
                              onClick={() => {
                                setEditLineItems(editLineItems.filter((_, i) => i !== index));
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Updated Total Value Display */}
                    <div className="bg-blue-100 p-4 rounded border border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-800">Updated Invoice Total:</span>
                        <span className="font-bold text-2xl text-blue-900">
                          ${editLineItems.reduce((sum, item) => sum + item.lineTotal, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* File Management Section */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Document Management
                </h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                  {/* Existing Documents */}
                  <div>
                    <Label className="block mb-3">Existing Documents ({existingDocs.length})</Label>
                    <div className="min-h-[150px] max-h-[200px] overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                      {existingDocs.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                          <SemanticBDIIcon semantic="upload" size={24} className="mx-auto mb-2 opacity-50" />
                          No documents uploaded yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {existingDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 flex items-center justify-center">
                                  {doc.fileType.includes('pdf') ? (
                                    <span className="text-red-600 text-sm font-bold">📄</span>
                                  ) : doc.fileType.includes('word') || doc.fileType.includes('document') ? (
                                    <span className="text-blue-600 text-sm font-bold">📝</span>
                                  ) : doc.fileType.includes('sheet') || doc.fileType.includes('excel') ? (
                                    <span className="text-green-600 text-sm font-bold">📊</span>
                                  ) : doc.fileType.includes('image') ? (
                                    <span className="text-purple-600 text-sm font-bold">🖼️</span>
                                  ) : (
                                    <span className="text-gray-600 text-sm font-bold">📎</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block" title={doc.fileName}>
                                    {doc.fileName}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {(doc.fileSize / 1024).toFixed(1)}KB • {new Date(doc.uploadedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // TODO: Implement file download
                                    alert(`Download ${doc.fileName} - Coming soon!`);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                  title="Download file"
                                >
                                  ⬇️
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Delete ${doc.fileName}?`)) {
                                      try {
                                        const deleteResponse = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}/documents/${doc.id}`, {
                                          method: 'DELETE'
                                        });
                                        if (deleteResponse.ok) {
                                          setExistingDocs(existingDocs.filter(d => d.id !== doc.id));
                                          alert('File deleted successfully!');
                                        } else {
                                          alert('Failed to delete file');
                                        }
                                      } catch (error) {
                                        alert('Failed to delete file');
                                      }
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                  title="Delete file"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload New Documents */}
                  <div>
                    <Label htmlFor="editDocuments">Upload New Documents</Label>
                    <input
                      type="file"
                      id="editDocuments"
                      name="editDocuments"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setEditUploadedDocs(prev => [...prev, ...files]);
                        // New files selected for upload
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      PDF, Word, Excel, Images - Max 10MB per file
                    </div>
                    
                    {/* Preview New Files */}
                    {editUploadedDocs.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                        <div className="text-sm font-medium text-green-800 mb-2">
                          New Files to Upload ({editUploadedDocs.length})
                        </div>
                        <div className="space-y-2">
                          {editUploadedDocs.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {file.type.includes('pdf') ? (
                                    <span className="text-red-600 text-xs font-bold">📄</span>
                                  ) : file.type.includes('word') || file.type.includes('document') ? (
                                    <span className="text-blue-600 text-xs font-bold">📝</span>
                                  ) : file.type.includes('sheet') || file.type.includes('excel') ? (
                                    <span className="text-green-600 text-xs font-bold">📊</span>
                                  ) : file.type.includes('image') ? (
                                    <span className="text-purple-600 text-xs font-bold">🖼️</span>
                                  ) : (
                                    <span className="text-gray-600 text-xs font-bold">📎</span>
                                  )}
                                </div>
                                <span className="text-sm truncate max-w-[200px]" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({(file.size / 1024).toFixed(1)}KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditUploadedDocs(prev => prev.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <textarea
                  id="editNotes"
                  name="editNotes"
                  defaultValue={selectedInvoice.notes || ''}
                  placeholder="Special instructions, delivery requirements, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  rows={3}
                />
              </div>

              <div className="bg-blue-100 p-4 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-800">Total Value:</span>
                  <span className="font-bold text-2xl text-blue-900">${Number(selectedInvoice.totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setSelectedInvoice(null)}>
                  {tc('cancelButton', 'Cancel')}
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {tc('updateInvoiceButton', 'Update Invoice')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Generate Invoice Modal - Full Screen with Real-time Preview */}
      {showGenerateModal && (
        <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
          <DialogContent className="w-[100vw] h-[100vh] sm:w-[98vw] sm:h-[95vh] p-0" style={{ maxWidth: 'none' }}>
            <div className="flex flex-col lg:flex-row h-full">
              {/* Left Panel - Invoice Form (Mobile: Full width, Desktop: Left 40%) */}
              <div className="w-full lg:w-2/5 border-r border-gray-200 flex flex-col">
                <div className="flex-1 overflow-y-auto p-3 sm:p-4" style={{ maxHeight: 'calc(100vh - 140px)' }}>
                  <DialogHeader className="mb-6">
                    <DialogTitle className="flex items-center text-2xl">
                      <SemanticBDIIcon semantic="magic" size={24} className="mr-3 text-blue-600" />
                      {tc('generateInvoiceTitle', 'Generate Invoice')}
                    </DialogTitle>
                    <DialogDescription>
                      {tc('generateInvoiceDescription', 'Select a Purchase Order and generate a professional invoice with real-time preview')}
                    </DialogDescription>
                  </DialogHeader>

                  <form className="space-y-6 pb-8">
                    {/* Step 1: Select Purchase Order */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-3">Step 1: Select Purchase Order</h3>
                      {/* Debug Info */}
                      {purchaseOrders && (
                        <div className="text-xs text-blue-600 mb-2">
                          Available POs: {purchaseOrders.length} total, {purchaseOrders.filter(po => po.status === 'approved' || po.status === 'confirmed' || po.status === 'draft' || po.status === 'sent').length} eligible
                          {purchaseOrders.length > 0 && (
                            <div>Statuses: {[...new Set(purchaseOrders.map(po => po.status))].join(', ')}</div>
                          )}
                        </div>
                      )}
                      
                      <select 
                        className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedPO?.id || ''}
                        onChange={(e) => {
                          const po = purchaseOrders?.find(p => p.id === e.target.value);
                          setSelectedPO(po);
                          // Reset custom payment terms when selecting new PO
                          setCustomPaymentTerms('');
                          setShowCustomPaymentTerms(false);
                          // Auto-populate invoice data from PO
                          if (po) {
                            // Check if invoice already exists for this PO
                            const existingInvoice = invoices?.find(inv => 
                              inv.notes && inv.notes.includes(`Generated from PO: ${po.purchaseOrderNumber}`)
                            );
                            
                            if (existingInvoice && !editingInvoiceId) {
                              // Invoice already exists - switch to edit mode
                              console.log('📋 Invoice already exists for this PO - switching to edit mode');
                              setEditingInvoiceId(existingInvoice.id);
                              
                              // Load existing invoice data (ensure no null values)
                              setGeneratedInvoice({
                                invoiceNumber: existingInvoice.invoiceNumber || '',
                                customerName: existingInvoice.customerName || '',
                                invoiceDate: existingInvoice.invoiceDate ? new Date(existingInvoice.invoiceDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                                requestedDeliveryWeek: existingInvoice.requestedDeliveryWeek || '',
                                status: existingInvoice.status || 'draft',
                                terms: existingInvoice.terms || '',
                                incoterms: existingInvoice.incoterms || '',
                                incotermsLocation: existingInvoice.incotermsLocation || '',
                                totalValue: existingInvoice.totalValue || '',
                                notes: existingInvoice.notes || '',
                                poReference: po.purchaseOrderNumber,
                                lineItems: []
                              });
                              
                              // Load existing addresses and bank info (ensure no null values)
                              setCustomerAddress(existingInvoice.customerAddress || '');
                              setShipToAddress(existingInvoice.shipToAddress || '');
                              setShipDate(existingInvoice.shipDate || '');
                              setBankInfo({
                                bankName: existingInvoice.bankName || 'California Bank and Trust',
                                accountNumber: existingInvoice.bankAccountNumber || '',
                                routing: existingInvoice.bankRoutingNumber || '',
                                swift: existingInvoice.bankSwiftCode || '',
                                iban: existingInvoice.bankIban || '',
                                bankAddress: existingInvoice.bankAddress || '',
                                bankCountry: existingInvoice.bankCountry || 'United States',
                                currency: existingInvoice.bankCurrency || 'USD'
                              });
                              
                              // Load existing line items
                              fetch(`/api/cpfr/invoices/${existingInvoice.id}/line-items`)
                                .then(res => res.json())
                                .then(lineItems => {
                                  console.log('📋 Loaded existing line items for edit mode:', lineItems);
                                  setGeneratedInvoice((prev: any) => ({...prev, lineItems: lineItems || []}));
                                });
                              
                              return; // Don't fetch PO line items, use existing invoice
                            }
                            
                            // Fetch PO line items with enhanced debugging
                            console.log(`🔍 Fetching line items for PO ID: ${po.id}`);
                            setLoadingLineItems(true);
                            
                            fetch(`/api/cpfr/purchase-orders/${po.id}/line-items`)
                              .then(res => {
                                console.log(`📡 Line items API response status: ${res.status}`);
                                return res.json();
                              })
                              .then(lineItems => {
                                console.log('📦 Loaded PO line items:', lineItems);
                                console.log(`📊 Line items count: ${Array.isArray(lineItems) ? lineItems.length : 'Not an array'}`);
                                if (Array.isArray(lineItems) && lineItems.length > 0) {
                                  console.log('📋 First line item structure:', lineItems[0]);
                                }
                                
                                // Calculate total from line items
                                const calculatedTotal = Array.isArray(lineItems) ? 
                                  lineItems.reduce((sum, item) => sum + (item.totalCost || item.total_cost || (item.quantity * item.unitCost) || 0), 0) : 
                                  po.totalValue || 0;
                                
                                console.log('💰 Calculated total from line items:', calculatedTotal);
                                
                                // Map line items to correct field names
                                const mappedLineItems = Array.isArray(lineItems) ? lineItems.map(item => ({
                                  id: item.id,
                                  skuId: item.skuId || item.sku_id,
                                  skuCode: item.skuCode || item.sku_code || item.sku,
                                  skuName: item.skuName || item.sku_name || item.name,
                                  description: item.description,
                                  quantity: item.quantity,
                                  unitCost: item.unitCost || item.unit_cost,
                                  unitPrice: item.unitPrice || item.unit_cost,
                                  totalCost: item.totalCost || item.total_cost
                                })) : [];
                                
                                console.log('🔄 Mapped line items:', mappedLineItems);
                                
                                setGeneratedInvoice({
                                  invoiceNumber: `INV-${po.purchaseOrderNumber}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
                                  customerName: po.customerName || po.organization?.name || po.supplierName || 'Customer Name Required',
                                  invoiceDate: new Date().toISOString().split('T')[0],
                                  requestedDeliveryWeek: po.requestedDeliveryWeek || '',
                                  status: 'draft',
                                  terms: 'NET30',
                                  incoterms: po.incoterms || 'FOB',
                                  incotermsLocation: po.incotermsLocation || 'Shanghai Port',
                                  totalValue: calculatedTotal,
                                  notes: `Generated from PO: ${po.purchaseOrderNumber}`,
                                  poReference: po.purchaseOrderNumber,
                                  lineItems: mappedLineItems
                                });
                                setLoadingLineItems(false);
                              })
                              .catch(error => {
                                console.error('❌ Error loading PO line items:', error);
                                setGeneratedInvoice({
                                  invoiceNumber: `INV-${po.purchaseOrderNumber}-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
                                  customerName: po.customerName || po.organization?.name || po.supplierName || 'Customer Name Required',
                                  invoiceDate: new Date().toISOString().split('T')[0],
                                  requestedDeliveryWeek: po.requestedDeliveryWeek || '',
                                  status: 'draft',
                                  terms: 'NET30',
                                  incoterms: po.incoterms || 'FOB',
                                  incotermsLocation: po.incotermsLocation || 'Shanghai Port',
                                  totalValue: po.totalValue || 0,
                                  notes: `Generated from PO: ${po.purchaseOrderNumber}`,
                                  poReference: po.purchaseOrderNumber,
                                  lineItems: []
                                });
                                setLoadingLineItems(false);
                              });
                          }
                        }}
                      >
                        <option value="">Select a Purchase Order...</option>
                        {purchaseOrders?.filter(po => po.status === 'approved' || po.status === 'confirmed' || po.status === 'draft' || po.status === 'sent')?.map(po => (
                          <option key={po.id} value={po.id}>
                            PO: {po.purchaseOrderNumber} - {po.customerName || po.organization?.name} - ${po.totalValue?.toLocaleString()}
                          </option>
                        ))}
                      </select>
                      {selectedPO && (
                        <div className="mt-3 p-3 bg-white rounded border">
                          <div className="flex justify-between items-start">
                            <p className="text-sm text-gray-600 flex-1">
                              <strong>PO #{selectedPO.purchaseOrderNumber}</strong><br />
                              Customer: {selectedPO.customerName || selectedPO.organization?.name}<br />
                              Value: ${selectedPO.totalValue?.toLocaleString()}<br />
                              Delivery: Week {selectedPO.requestedDeliveryWeek}
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Reload PO line items
                                console.log(`🔄 Reloading line items for PO: ${selectedPO.id}`);
                                setLoadingLineItems(true);
                                
                                fetch(`/api/cpfr/purchase-orders/${selectedPO.id}/line-items`)
                                  .then(res => res.json())
                                  .then(lineItems => {
                                    console.log('🔄 Reloaded PO line items:', lineItems);
                                    const mappedLineItems = Array.isArray(lineItems) ? lineItems.map(item => ({
                                      id: item.id,
                                      skuId: item.skuId || item.sku_id,
                                      skuCode: item.skuCode || item.sku_code || item.sku,
                                      skuName: item.skuName || item.sku_name || item.name,
                                      description: item.description || `PO ${selectedPO.purchaseOrderNumber}`,
                                      quantity: item.quantity,
                                      unitCost: item.unitCost || item.unit_cost,
                                      unitPrice: item.unitPrice || item.unit_cost,
                                      totalCost: item.totalCost || item.total_cost
                                    })) : [];
                                    
                                    setGeneratedInvoice((prev: any) => ({
                                      ...prev,
                                      lineItems: mappedLineItems
                                    }));
                                    setLoadingLineItems(false);
                                  })
                                  .catch(error => {
                                    console.error('❌ Error reloading line items:', error);
                                    setLoadingLineItems(false);
                                  });
                              }}
                              className="ml-2 text-xs"
                              disabled={loadingLineItems}
                            >
                              {loadingLineItems ? (
                                <>
                                  <SemanticBDIIcon semantic="loading" size={12} className="mr-1 animate-spin" />
                                  Reloading...
                                </>
                              ) : (
                                <>
                                  <SemanticBDIIcon semantic="refresh" size={12} className="mr-1" />
                                  Reload Items
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {generatedInvoice && (
                      <>
                        {/* Step 2: Invoice Details */}
                        <div className="bg-green-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-green-900 mb-3">Step 2: Invoice Details</h3>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="genCustomerName">Customer Name *</Label>
                              <Input
                                id="genCustomerName"
                                value={generatedInvoice.customerName}
                                onChange={(e) => setGeneratedInvoice({...generatedInvoice, customerName: e.target.value})}
                                placeholder="Enter customer/company name"
                                className="mt-1"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="genCustomerAddress">Bill To Address</Label>
                              <textarea
                                id="genCustomerAddress"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                placeholder="Customer billing address (will be auto-scanned from PO documents if available)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label htmlFor="genShipToAddress">Ship To Address</Label>
                              <textarea
                                id="genShipToAddress"
                                value={shipToAddress}
                                onChange={(e) => setShipToAddress(e.target.value)}
                                placeholder="Shipping address (can be same as billing or different)"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                                rows={3}
                              />
                            </div>
                            <div>
                              <Label htmlFor="genShipDate">Ship Date</Label>
                              <Input
                                id="genShipDate"
                                type="date"
                                value={shipDate}
                                onChange={(e) => setShipDate(e.target.value)}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                <Label>Quick Address Actions</Label>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setShipToAddress(customerAddress)}
                                  className="text-xs w-full sm:w-auto"
                                >
                                  Copy Bill To → Ship To
                                </Button>
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="genInvoiceNumber">Invoice Number</Label>
                              <Input
                                id="genInvoiceNumber"
                                value={generatedInvoice.invoiceNumber}
                                onChange={(e) => setGeneratedInvoice({...generatedInvoice, invoiceNumber: e.target.value})}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="genInvoiceDate">Invoice Date</Label>
                              <Input
                                id="genInvoiceDate"
                                type="date"
                                value={generatedInvoice.invoiceDate}
                                onChange={(e) => setGeneratedInvoice({...generatedInvoice, invoiceDate: e.target.value})}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="genTerms">Payment Terms</Label>
                              <select 
                                id="genTerms"
                                value={showCustomPaymentTerms ? 'CUSTOM' : generatedInvoice.terms}
                                onChange={(e) => {
                                  if (e.target.value === 'CUSTOM') {
                                    setShowCustomPaymentTerms(true);
                                    setGeneratedInvoice({...generatedInvoice, terms: customPaymentTerms || 'Custom Terms'});
                                  } else {
                                    setShowCustomPaymentTerms(false);
                                    setGeneratedInvoice({...generatedInvoice, terms: e.target.value});
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                              >
                                <option value="NET30">NET 30</option>
                                <option value="NET60">NET 60</option>
                                <option value="NET90">NET 90</option>
                                <option value="COD">Cash on Delivery</option>
                                <option value="PREPAID">Prepaid</option>
                                <option value="CUSTOM">✏️ Custom Terms (Enter Manually)</option>
                              </select>
                              
                              {showCustomPaymentTerms && (
                                <div className="mt-2">
                                  <Input
                                    placeholder="Enter custom payment terms (e.g., NET 45, 2/10 NET 30, Upon Receipt, etc.)"
                                    value={customPaymentTerms}
                                    onChange={(e) => {
                                      setCustomPaymentTerms(e.target.value);
                                      setGeneratedInvoice({...generatedInvoice, terms: e.target.value});
                                    }}
                                    className="w-full"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Examples: "NET 45", "2/10 NET 30", "Upon Receipt", "50% Deposit, Balance NET 30"
                                  </p>
                                </div>
                              )}
                            </div>
                            <div>
                              <Label htmlFor="genIncoterms">Incoterms</Label>
                              <select 
                                id="genIncoterms"
                                value={generatedInvoice.incoterms}
                                onChange={(e) => setGeneratedInvoice({...generatedInvoice, incoterms: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                              >
                                <option value="FOB">FOB (Free on Board)</option>
                                <option value="CIF">CIF (Cost, Insurance, Freight)</option>
                                <option value="DDP">DDP (Delivered Duty Paid)</option>
                                <option value="EXW">EXW (Ex Works)</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-4">
                            <Label htmlFor="genIncotermsLocation">Incoterms Location</Label>
                            <Input
                              id="genIncotermsLocation"
                              value={generatedInvoice.incotermsLocation}
                              onChange={(e) => setGeneratedInvoice({...generatedInvoice, incotermsLocation: e.target.value})}
                              placeholder="e.g., Shanghai Port, Los Angeles"
                              className="mt-1"
                            />
                          </div>
                        </div>

                        {/* Bank Information Section - CFO/Super Admin Only */}
                        {(user?.role === 'super_admin' || user?.role === 'admin_cfo') && (
                          <div className="bg-purple-50 p-4 rounded-lg border-2 border-purple-200">
                            <div className="flex justify-between items-center mb-3">
                              <h3 className="font-semibold text-purple-900">🔒 Bank Information (CFO Access)</h3>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setShowBankDetails(!showBankDetails)}
                                className="text-xs"
                              >
                                <SemanticBDIIcon semantic={showBankDetails ? 'hide' : 'show'} size={12} className="mr-1" />
                                {showBankDetails ? 'Hide Details' : 'Show Details'}
                              </Button>
                            </div>
                            {showBankDetails ? (
                              // FULL BANK DETAILS - Visible when toggled
                              <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <Label htmlFor="bankName">Bank Name</Label>
                                    <Input
                                      id="bankName"
                                      value={bankInfo.bankName}
                                      onChange={(e) => setBankInfo({...bankInfo, bankName: e.target.value})}
                                      placeholder="e.g., California Bank and Trust"
                                      className="mt-1"
                                    />
                                  </div>
                            <div>
                              <Label htmlFor="bankCountry">Bank Country</Label>
                              <Input
                                id="bankCountry"
                                value={bankInfo.bankCountry}
                                onChange={(e) => setBankInfo({...bankInfo, bankCountry: e.target.value})}
                                placeholder="e.g., United States"
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                              <Label htmlFor="bankAccount">Account Number</Label>
                              <Input
                                id="bankAccount"
                                value={bankInfo.accountNumber}
                                onChange={(e) => setBankInfo({...bankInfo, accountNumber: e.target.value})}
                                placeholder="e.g., 5803261154"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="bankRouting">Routing Number</Label>
                              <Input
                                id="bankRouting"
                                value={bankInfo.routing}
                                onChange={(e) => setBankInfo({...bankInfo, routing: e.target.value})}
                                placeholder="e.g., 122232109"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="bankSwift">Swift Code</Label>
                              <Input
                                id="bankSwift"
                                value={bankInfo.swift}
                                onChange={(e) => setBankInfo({...bankInfo, swift: e.target.value})}
                                placeholder="e.g., ZFNBUS55"
                                className="mt-1"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="bankIban">IBAN (International)</Label>
                              <Input
                                id="bankIban"
                                value={bankInfo.iban}
                                onChange={(e) => setBankInfo({...bankInfo, iban: e.target.value})}
                                placeholder="e.g., GB29 NWBK 6016 1331 9268 19"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="bankCurrency">Currency</Label>
                              <select
                                id="bankCurrency"
                                value={bankInfo.currency}
                                onChange={(e) => setBankInfo({...bankInfo, currency: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1"
                              >
                                <option value="USD">USD - US Dollar</option>
                                <option value="EUR">EUR - Euro</option>
                                <option value="GBP">GBP - British Pound</option>
                                <option value="CNY">CNY - Chinese Yuan</option>
                                <option value="JPY">JPY - Japanese Yen</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-4">
                            <Label htmlFor="bankAddress">Bank Address</Label>
                            <textarea
                              id="bankAddress"
                              value={bankInfo.bankAddress}
                              onChange={(e) => setBankInfo({...bankInfo, bankAddress: e.target.value})}
                              placeholder="Bank physical address for international transfers"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 mt-1"
                              rows={2}
                            />
                          </div>
                                <p className="text-xs text-purple-600 mt-2">
                                  Comprehensive bank information for domestic and international wire transfers
                                </p>
                              </>
                            ) : (
                              // OBFUSCATED BANK DETAILS - Hidden by default
                              <div className="bg-gray-100 p-4 rounded text-center">
                                <p className="text-sm text-gray-600 mb-2">🔒 Bank Details Hidden</p>
                                <p className="text-xs text-gray-500">
                                  {bankInfo.bankName ? `Bank: ${bankInfo.bankName}` : 'No bank information entered'}
                                  <br />
                                  {bankInfo.accountNumber ? `Account: ****${bankInfo.accountNumber.slice(-4)}` : ''}
                                  {bankInfo.routing ? ` | Routing: ****${bankInfo.routing.slice(-4)}` : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Step 3: Notes & Status */}
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-yellow-900 mb-3">Step 3: Additional Notes & Status</h3>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="genNotes">Notes</Label>
                              <textarea
                                id="genNotes"
                                value={generatedInvoice.notes}
                                onChange={(e) => setGeneratedInvoice({...generatedInvoice, notes: e.target.value})}
                                placeholder="Special instructions, delivery requirements, etc."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 mt-1"
                                rows={3}
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="invoiceStatus">Invoice Status</Label>
                              <select 
                                id="invoiceStatus"
                                value={invoiceStatus}
                                onChange={(e) => setInvoiceStatus(e.target.value as 'draft' | 'submitted' | 'submitted_to_finance')}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 mt-1"
                              >
                                <option value="draft">📝 Save as Draft (Can edit later)</option>
                                <option value="submitted_to_finance">📤 Submit to Finance (CFO Approval)</option>
                              </select>
                              <p className="text-xs text-gray-600 mt-1">
                                {invoiceStatus === 'draft' 
                                  ? "Draft invoices can be edited and resubmitted anytime."
                                  : "Submitted invoices will be sent to CFO for approval and cannot be edited."
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                      </>
                    )}
                  </form>
                </div>
                
                {/* Action Buttons - Fixed at bottom of left panel */}
                {generatedInvoice && (
                  <div className="border-t bg-white p-3 flex-shrink-0 min-h-[80px]">
                    <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setShowGenerateModal(false);
                          setSelectedPO(null);
                          setGeneratedInvoice(null);
                          setCustomPaymentTerms('');
                          setShowCustomPaymentTerms(false);
                          setEditingInvoiceId(null); // Clear editing mode
                        }}
                        className="flex-1"
                      >
                        {tc('cancelButton', 'Cancel')}
                      </Button>
                      <Button 
                        type="button"
                        className="bg-blue-600 hover:bg-blue-700 flex-1"
                        onClick={async () => {
                          try {
                            setIsGeneratingPDF(true);
                            console.log('📄 Exporting invoice PDF preview...');
                            
                            // Generate PDF from current invoice preview
                            const pdfDataUrl = await generateInvoicePDF(false); // No CFO signature for preview
                            
                            // Create download link
                            const link = document.createElement('a');
                            link.href = pdfDataUrl;
                            link.download = `invoice-preview-${generatedInvoice?.invoiceNumber || 'draft'}-${new Date().toISOString().split('T')[0]}.pdf`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            console.log('✅ Invoice PDF exported successfully');
                          } catch (error) {
                            console.error('❌ Error exporting PDF:', error);
                            alert('Failed to export PDF. Please try again.');
                          } finally {
                            setIsGeneratingPDF(false);
                          }
                        }}
                        disabled={isGeneratingPDF || !generatedInvoice}
                      >
                        {isGeneratingPDF ? (
                          <>
                            <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin brightness-0 invert" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <SemanticBDIIcon semantic="download" size={16} className="mr-2 brightness-0 invert" />
                            Export Invoice PDF
                          </>
                        )}
                      </Button>
                      <Button 
                        type="button"
                        className={`flex-1 ${
                          invoiceStatus === 'draft' 
                            ? 'bg-gray-600 hover:bg-gray-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                        disabled={isLoading}
                        onClick={async () => {
                          try {
                            setIsLoading(true);
                            
                            // Validate required fields
                            if (!generatedInvoice.customerName || generatedInvoice.customerName.trim() === '' || generatedInvoice.customerName === 'Customer Name Required') {
                              alert('❌ Please enter a customer name before saving the invoice.');
                              setIsLoading(false);
                              return;
                            }
                            
                            // Prepare invoice data for saving with all new fields
                            const invoiceData = {
                              invoiceNumber: generatedInvoice.invoiceNumber,
                              customerName: generatedInvoice.customerName,
                              invoiceDate: generatedInvoice.invoiceDate,
                              requestedDeliveryWeek: generatedInvoice.requestedDeliveryWeek,
                              status: invoiceStatus, // 'draft' or 'submitted'
                              terms: generatedInvoice.terms,
                              incoterms: generatedInvoice.incoterms,
                              incotermsLocation: generatedInvoice.incotermsLocation,
                              totalValue: generatedInvoice.totalValue,
                              notes: generatedInvoice.notes,
                              poReference: generatedInvoice.poReference,
                              lineItems: generatedInvoice.lineItems || [],
                              // NEW FIELDS: Addresses and shipping
                              customerAddress: customerAddress,
                              shipToAddress: shipToAddress,
                              shipDate: shipDate,
                              // NEW FIELDS: Bank information
                              bankName: bankInfo.bankName,
                              bankAccountNumber: bankInfo.accountNumber,
                              bankRoutingNumber: bankInfo.routing,
                              bankSwiftCode: bankInfo.swift,
                              bankIban: bankInfo.iban,
                              bankAddress: bankInfo.bankAddress,
                              bankCountry: bankInfo.bankCountry,
                              bankCurrency: bankInfo.currency
                            };

                            console.log('Saving invoice:', invoiceData);
                            console.log('🗓️ Invoice Date being sent:', invoiceData.invoiceDate);
                            console.log('📅 Ship Date being sent:', invoiceData.shipDate);

                            // Determine if we're editing or creating
                            const isEditing = editingInvoiceId !== null;
                            const apiUrl = isEditing ? `/api/cpfr/invoices/${editingInvoiceId}` : '/api/cpfr/invoices';
                            const method = isEditing ? 'PUT' : 'POST';
                            
                            console.log(`${isEditing ? '✏️ UPDATING' : '➕ CREATING'} invoice with method: ${method}`);

                            const response = await fetch(apiUrl, {
                              method: method,
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(invoiceData),
                            });

                            if (response.ok) {
                              const result = await response.json();
                              
                              console.log('🔍 DEBUGGING INVOICE STATUS CHECK:');
                              console.log('📊 invoiceStatus value:', invoiceStatus);
                              console.log('📊 invoiceStatus type:', typeof invoiceStatus);
                              console.log('📊 Is submitted_to_finance?:', invoiceStatus === 'submitted_to_finance');
                              console.log('📊 Is NOT submitted_to_finance?:', invoiceStatus !== 'submitted_to_finance');
                              
                              if (invoiceStatus !== 'submitted_to_finance') {
                                // Draft save - show success and close
                                alert(`✅ Invoice saved as draft!\n\nInvoice ID: ${result.id}`);
                                
                                // Close the modal
                                setShowGenerateModal(false);
                                setSelectedPO(null);
                                setGeneratedInvoice(null);
                                setCustomPaymentTerms('');
                                setShowCustomPaymentTerms(false);
                                setEditingInvoiceId(null); // Clear editing mode
                              }
                              
                              // Always refresh the invoice list
                              mutateInvoices();
                              
                              // NEW FLOW: For submitted_to_finance, just generate PDF and return to list
                              if (invoiceStatus === 'submitted_to_finance') {
                                console.log('🎯 SUBMIT TO FINANCE: Starting PDF generation for CFO approval workflow');
                                
                                try {
                                  // Step 1: Generate PDF from invoice preview
                                  console.log('📄 Step 1: Generating PDF...');
                                  const pdfDataUrl = await generateInvoicePDF();
                                  console.log('✅ PDF generated successfully');
                                  
                                  // Step 2: Convert to blob and upload to Supabase
                                  console.log('☁️ Step 2: Uploading PDF to Supabase...');
                                  const response = await fetch(pdfDataUrl);
                                  const pdfBlob = await response.blob();
                                  
                                  const formData = new FormData();
                                  formData.append('file', pdfBlob, `invoice-${result.id}-cfo-approval.pdf`);
                                  formData.append('invoiceId', result.id);
                                  
                                  const uploadResponse = await fetch('/api/cpfr/invoices/pdf-upload', {
                                    method: 'POST',
                                    body: formData
                                  });
                                  
                                  if (uploadResponse.ok) {
                                    const uploadResult = await uploadResponse.json();
                                    console.log('✅ PDF uploaded to Supabase, file path:', uploadResult.filePath);
                                    
                                    // Store the PDF file path in the database for CFO approval
                                    if (uploadResult.filePath) {
                                      try {
                                        const updateResponse = await fetch(`/api/cpfr/invoices/${result.id}`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            status: 'submitted_to_finance', // Keep current status
                                            approvedPdfUrl: uploadResult.filePath
                                          }),
                                        });
                                        
                                        if (updateResponse.ok) {
                                          console.log('✅ PDF file path stored in database for CFO approval');
                                        } else {
                                          console.error('⚠️ Failed to store PDF file path in database');
                                        }
                                      } catch (error) {
                                        console.error('⚠️ Error storing PDF file path:', error);
                                      }
                                    }
                                    
                                    // NEW FLOW: Close modals and return to list - CFO will use Approve button
                                    setShowGenerateModal(false);
                                    setShowCreateModal(false);
                                    
                                    console.log('✅ Invoice submitted to finance - returning to list for CFO approval via Approve button');
                                    
                                    alert(`✅ Invoice ${result.invoiceNumber} has been submitted to finance!\n\nThe CFO will be notified and can approve it using the Approve button in the invoice list.`);
                                  } else {
                                    throw new Error('Failed to upload PDF');
                                  }
                                } catch (error) {
                                  console.error('❌ Error in PDF workflow:', error);
                                  alert('❌ Failed to generate PDF for CFO approval. Please try again.');
                                }
                                
                                return; // Exit early
                              }
                            } else {
                              const error = await response.text();
                              console.error('Failed to save invoice:', error);
                              alert(`❌ Failed to save invoice: ${error}`);
                            }
                          } catch (error) {
                            console.error('Error saving invoice:', error);
                            alert(`❌ Error saving invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          } finally {
                            setIsLoading(false);
                          }
                        }}
                      >
                        {isLoading ? (
                          <>
                            <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin brightness-0 invert" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <SemanticBDIIcon 
                              semantic={invoiceStatus === 'draft' ? 'save' : 'send'} 
                              size={16} 
                              className="mr-2 brightness-0 invert" 
                            />
                            {invoiceStatus === 'draft' ? 'Save as Draft' : 'Submit to Finance'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - Real-time Invoice Preview (Mobile: Bottom, Desktop: Right 60%) */}
              <div className="w-full lg:w-3/5 bg-gray-50 overflow-y-auto" style={{ maxHeight: '95vh' }}>
                <div className="p-2 sm:p-4">
                  <div className="bg-white shadow-lg rounded-lg p-3 sm:p-4 max-w-2xl mx-auto text-xs sm:text-sm invoice-preview-for-pdf">
                    {generatedInvoice ? (
                      /* Professional Invoice Template - Matching Exact Format */
                      <div className="bg-white">
                        {/* Header with Logo and Company Info - Fixed Layout */}
                        <div className="mb-4">
                          <div className="flex justify-between items-start">
                            {/* Left: INVOICE Title and Company Info */}
                            <div>
                              <div className="text-2xl font-bold text-blue-600 mb-2">INVOICE</div>
                              {/* Company Info - Under INVOICE title */}
                              <div className="flex gap-6 text-xs text-gray-700">
                                <div>
                                  <div className="font-semibold">Boundless Devices, Inc.</div>
                                  <div>17875 Von Karman Ave, STE 150</div>
                                  <div>Irvine, CA 92614</div>
                                </div>
                                <div>
                                  <div>invoices@boundlessdevices.com</div>
                                  <div>+1 (949) 994-7791</div>
                                  <div>www.boundlessdevices.com</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Right: Logo Only */}
                            <div>
                              <img 
                                src="/logos/PNG/Full Lockup Color.png" 
                                alt="Boundless Devices Inc" 
                                className="h-12"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Bill To and Ship To Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Bill to</h3>
                            <div className="text-gray-700">
                              <div className="font-semibold">{generatedInvoice.customerName}</div>
                              {customerAddress && (
                                <div className="mt-1 whitespace-pre-line text-sm">
                                  {customerAddress}
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Ship to</h3>
                            <div className="text-gray-700">
                              <div className="font-semibold">{generatedInvoice.customerName}</div>
                              {shipToAddress && (
                                <div className="mt-1 whitespace-pre-line text-sm">
                                  {shipToAddress}
                                </div>
                              )}
                              {!shipToAddress && customerAddress && (
                                <div className="mt-1 whitespace-pre-line text-sm">
                                  {customerAddress}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Shipping Info and Invoice Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Shipping info</h3>
                            <div className="text-xs text-gray-700">
                              <div><span className="font-medium">Ship date:</span> {shipDate ? new Date(shipDate).toLocaleDateString() : 'TBD'}</div>
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1 text-sm">Invoice details</h3>
                            <div className="text-xs text-gray-700">
                              <div><span className="font-medium">Invoice no.:</span> {generatedInvoice.invoiceNumber.replace('INV-', '')}</div>
                              <div><span className="font-medium">Terms:</span> {generatedInvoice.terms}</div>
                              <div><span className="font-medium">Invoice date:</span> {new Date(generatedInvoice.invoiceDate).toLocaleDateString()}</div>
                              <div><span className="font-medium">Due date:</span> {shipDate ? new Date(shipDate).toLocaleDateString() : 'Not set'}</div>
                            </div>
                          </div>
                        </div>

                        {/* Line Items Table - Compact Format */}
                        <div className="mb-4">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-xs">#</th>
                                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-xs">Product or service</th>
                                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-xs">SKU</th>
                                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-xs">Description</th>
                                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-xs">Qty</th>
                                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-xs">Rate</th>
                                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-xs">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {generatedInvoice.lineItems && generatedInvoice.lineItems.length > 0 ? (
                                generatedInvoice.lineItems.map((item: any, index: number) => (
                                  <tr key={index} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 px-2 py-2 text-xs">{index + 1}.</td>
                                    <td className="border border-gray-300 px-1 py-1 text-xs">
                                      <input
                                        type="text"
                                        value={item.skuName || item.sku || 'Product Name'}
                                        onChange={(e) => {
                                          const updatedLineItems = [...generatedInvoice.lineItems];
                                          updatedLineItems[index] = {...item, skuName: e.target.value};
                                          setGeneratedInvoice({...generatedInvoice, lineItems: updatedLineItems});
                                        }}
                                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1 font-medium"
                                        placeholder="Product name..."
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-1 py-1 text-xs">
                                      <input
                                        type="text"
                                        value={item.skuCode || item.sku}
                                        onChange={(e) => {
                                          const updatedLineItems = [...generatedInvoice.lineItems];
                                          updatedLineItems[index] = {...item, skuCode: e.target.value, sku: e.target.value};
                                          setGeneratedInvoice({...generatedInvoice, lineItems: updatedLineItems});
                                        }}
                                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1"
                                        placeholder="SKU code..."
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-1 py-1 text-xs">
                                      <input
                                        type="text"
                                        value={item.description || generatedInvoice.poReference || ''}
                                        onChange={(e) => {
                                          const updatedLineItems = [...generatedInvoice.lineItems];
                                          updatedLineItems[index] = {...item, description: e.target.value};
                                          setGeneratedInvoice({...generatedInvoice, lineItems: updatedLineItems});
                                        }}
                                        className="w-full text-xs border-0 bg-transparent focus:bg-white focus:border focus:border-blue-300 rounded px-1"
                                        placeholder="Enter description..."
                                      />
                                    </td>
                                    <td className="border border-gray-300 px-2 py-2 text-right text-xs">{(item.quantity || 0).toLocaleString()}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right text-xs">${(item.unitCost || item.unitPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td className="border border-gray-300 px-2 py-2 text-right text-xs font-semibold">${((item.quantity || 0) * (item.unitCost || item.unitPrice || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={7} className="border border-gray-300 px-2 py-4 text-center text-gray-500 text-xs">
                                    {loadingLineItems ? (
                                      <>
                                        <SemanticBDIIcon semantic="loading" size={12} className="mr-1 animate-spin inline" />
                                        Loading line items...
                                      </>
                                    ) : (
                                      'No line items found for this Purchase Order'
                                    )}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Total Section - Compact */}
                        <div className="flex justify-end mb-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">
                              ${Number(generatedInvoice.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm font-semibold text-gray-700">Total</div>
                          </div>
                        </div>

                        {/* Bank Information - Role-based Display */}
                        {(bankInfo.bankName || bankInfo.accountNumber || bankInfo.routing || bankInfo.swift) && (
                          <div className="border-t border-gray-200 pt-4 text-xs text-gray-700">
                            <div className="font-semibold mb-2">{bankInfo.bankName || 'Bank Information'}</div>
                            {(user?.role === 'super_admin' || user?.role === 'admin_cfo') ? (
                              // FULL DETAILS for CFO/Super Admin
                              <>
                                {bankInfo.accountNumber && <div>Account number: {showBankDetails ? bankInfo.accountNumber : `****${bankInfo.accountNumber.slice(-4)}`}</div>}
                                {bankInfo.routing && <div>Routing: {showBankDetails ? bankInfo.routing : `****${bankInfo.routing.slice(-4)}`}</div>}
                                {bankInfo.swift && <div>Swift (International Wires Only): {bankInfo.swift}</div>}
                                {bankInfo.iban && <div>IBAN: {showBankDetails ? bankInfo.iban : `****${bankInfo.iban.slice(-4)}`}</div>}
                                {bankInfo.bankAddress && <div>Bank Address: {bankInfo.bankAddress}</div>}
                                {bankInfo.bankCountry && <div>Country: {bankInfo.bankCountry}</div>}
                                {bankInfo.currency && <div>Currency: {bankInfo.currency}</div>}
                              </>
                            ) : (
                              // OBFUSCATED for other roles
                              <div className="text-gray-500 italic">
                                Bank details available to CFO and Super Admin only
                              </div>
                            )}
                          </div>
                        )}

                        {/* Signature Lines */}
                        <div className="border-t pt-4 mt-6">
                          <div className="flex justify-between items-start">
                            {/* Sales Signature */}
                            <div className="w-1/2 pr-4">
                              <div className="border-b border-gray-400 mb-2 pb-8"></div>
                              <div className="text-xs">
                                <p className="font-semibold">Sales: {user?.name || 'Sales Representative'}</p>
                                <p className="text-gray-600">Date: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                              </div>
                            </div>
                            
                            {/* Finance Signature - Removed (handled via email workflow) */}
                          </div>
                        </div>
                        
                        {/* Form Version - Lower Right Corner */}
                        <div className="flex justify-end mt-8">
                          <div className="text-xs text-gray-400">
                            Form Version: {process.env.NEXT_PUBLIC_APP_VERSION || 'v1.659.722e5064'}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Placeholder when no PO selected */
                      <div className="text-center py-16">
                        <SemanticBDIIcon semantic="magic" size={64} className="mx-auto text-gray-300 mb-4" />
                        <h3 className="text-xl font-semibold text-gray-600 mb-2">Real-time Invoice Preview</h3>
                        <p className="text-gray-500">Select a Purchase Order to see the invoice preview here</p>
                        <div className="mt-8 text-left bg-gray-50 p-6 rounded-lg max-w-md mx-auto">
                          <h4 className="font-semibold text-gray-700 mb-2">Features:</h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>✓ Real-time preview as you type</li>
                            <li>✓ Professional invoice template</li>
                            <li>✓ PDF export for sales teams</li>
                            <li>✓ Mobile optimized design</li>
                            <li>✓ Auto-populated from PO data</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* CFO Approval Modal */}
      {showCFOApprovalModal && selectedInvoiceForApproval && (
        <Dialog open={showCFOApprovalModal} onOpenChange={setShowCFOApprovalModal}>
          <DialogContent className="w-[90vw] max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center text-xl">
                <SemanticBDIIcon semantic="check" size={24} className="mr-3 text-blue-600" />
                CFO Invoice Approval
              </DialogTitle>
              <DialogDescription>
                Review and approve/reject Invoice #{selectedInvoiceForApproval.invoiceNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Invoice Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Invoice Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Invoice Number:</span> {selectedInvoiceForApproval.invoiceNumber}
                  </div>
                  <div>
                    <span className="font-medium">Customer:</span> {selectedInvoiceForApproval.customerName}
                  </div>
                  <div>
                    <span className="font-medium">Invoice Date:</span> {new Date(selectedInvoiceForApproval.invoiceDate).toLocaleDateString()}
                  </div>
                  <div>
                    <span className="font-medium">Total Value:</span> ${selectedInvoiceForApproval.totalValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div>
                    <span className="font-medium">Payment Terms:</span> {selectedInvoiceForApproval.terms}
                  </div>
                  <div>
                    <span className="font-medium">Incoterms:</span> {selectedInvoiceForApproval.incoterms}
                  </div>
                </div>
                {selectedInvoiceForApproval.notes && (
                  <div className="mt-3">
                    <span className="font-medium">Notes:</span> 
                    <p className="text-gray-700 mt-1">{selectedInvoiceForApproval.notes}</p>
                  </div>
                )}
              </div>

              {/* Approval Decision */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">CFO Decision</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="approvalStatus">Decision</Label>
                    <select 
                      id="approvalStatus"
                      value={approvalStatus}
                      onChange={(e) => setApprovalStatus(e.target.value as 'approved' | 'rejected')}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="approved">✅ Approve Invoice</option>
                      <option value="rejected">❌ Reject Invoice</option>
                    </select>
                  </div>

                  {approvalStatus === 'approved' && (
                    <div>
                      <Label htmlFor="approvalEmail">Send Approved Invoice To (Email)</Label>
                      <Input
                        id="approvalEmail"
                        type="email"
                        placeholder="customer@company.com"
                        value={approvalEmail}
                        onChange={(e) => setApprovalEmail(e.target.value)}
                        className="mt-1"
                        required
                      />
                      <p className="text-xs text-blue-600 mt-1">
                        The approved invoice PDF will be sent to this email address
                      </p>
                    </div>
                  )}

                  {approvalStatus === 'rejected' && (
                    <div>
                      <Label htmlFor="rejectionReason">Rejection Reason</Label>
                      <textarea
                        id="rejectionReason"
                        placeholder="Please provide reason for rejection..."
                        className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mt-1"
                        rows={3}
                      />
                      <p className="text-xs text-red-600 mt-1">
                        This reason will be sent to the invoice creator for revision
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCFOApprovalModal(false);
                    setSelectedInvoiceForApproval(null);
                    setApprovalEmail('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="button"
                  className={`flex-1 ${
                    approvalStatus === 'approved' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                  onClick={async () => {
                    if (approvalStatus === 'approved' && !approvalEmail.trim()) {
                      alert('Please enter an email address to send the approved invoice.');
                      return;
                    }
                    
                    if (approvalStatus === 'rejected') {
                      const rejectionReasonElement = document.getElementById('rejectionReason') as HTMLTextAreaElement;
                      if (!rejectionReasonElement?.value.trim()) {
                        alert('Please provide a rejection reason.');
                        return;
                      }
                    }
                    
                    try {
                      console.log('🎯 CFO APPROVAL: Processing', approvalStatus, 'for invoice:', selectedInvoiceForApproval?.id);
                      
                      const action = approvalStatus === 'approved' ? 'approved' : 'rejected';
                      const rejectionReasonElement = document.getElementById('rejectionReason') as HTMLTextAreaElement;
                      
                      const response = await fetch('/api/cpfr/invoices/cfo-approval', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          invoiceId: selectedInvoiceForApproval?.id,
                          action: action,
                          approvalEmail: approvalStatus === 'approved' ? approvalEmail : null,
                          rejectionReason: approvalStatus === 'rejected' ? rejectionReasonElement?.value : null,
                        }),
                      });
                      
                      if (response.ok) {
                        const result = await response.json();
                        
                        const message = approvalStatus === 'approved' 
                          ? `✅ Invoice ${selectedInvoiceForApproval.invoiceNumber} approved!\n\nPDF will be sent to: ${approvalEmail}`
                          : `❌ Invoice ${selectedInvoiceForApproval.invoiceNumber} rejected.\n\nRejection notification will be sent to invoice creator.`;
                        
                        alert(message);
                        
                        // Refresh invoice list
                        mutateInvoices();
                        
                        // Close modal
                        setShowCFOApprovalModal(false);
                        setSelectedInvoiceForApproval(null);
                        setApprovalEmail('');
                        setShowNewCFOModal(false);
                        setCfoInvoiceData(null);
                        setCfoInvoicePDFUrl('');
                        
                        console.log('✅ CFO approval processed successfully');
                      } else {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Failed to process approval');
                      }
                    } catch (error) {
                      console.error('❌ Error processing CFO approval:', error);
                      alert(`❌ Failed to ${approvalStatus === 'approved' ? 'approve' : 'reject'} invoice: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }}
                >
                  <SemanticBDIIcon 
                    semantic={approvalStatus === 'approved' ? 'check' : 'close'} 
                    size={16} 
                    className="mr-2 brightness-0 invert" 
                  />
                  {approvalStatus === 'approved' ? 'Approve & Send Email' : 'Reject Invoice'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Super Simple CFO Modal - PDF Viewer Only */}
      {showNewCFOModal && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          {/* Simple Header */}
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <h2 className="text-xl font-semibold">CFO Approval Required</h2>
            <button
              onClick={() => {
                setShowNewCFOModal(false);
                setCfoInvoicePDFUrl('');
                setCfoInvoiceData(null);
              }}
              className="text-2xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          {/* PDF Viewer and Controls */}
          <div className="flex-1 flex flex-col md:flex-row">
            {/* PDF Viewer - Mobile: Top 60%, Desktop: Left side */}
            <div className="flex-1 p-4 h-64 md:h-auto">
              {cfoInvoicePDFUrl ? (
                <iframe
                  src={cfoInvoicePDFUrl}
                  className="w-full h-full border rounded"
                  title="Invoice PDF"
                />
              ) : (
                <div className="w-full h-full border rounded bg-gray-100 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-4">📄</div>
                    <p className="text-sm text-gray-600">PDF Preview Not Available</p>
                    <p className="text-xs text-gray-500 mt-2">You can still approve or reject this invoice</p>
                  </div>
                </div>
              )}
            </div>

            {/* Simple Email Controls - Mobile: Bottom, Desktop: Right side */}
            <div className="w-full md:w-80 p-6 bg-gray-50 border-t md:border-t-0 md:border-l flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Send Invoice</h3>
              
              <div className="space-y-4 flex-1">
                {!showRejectForm ? (
                  <>
                    <p className="text-sm text-gray-600">
                      Review the invoice PDF and choose an action:
                    </p>
                    
                    {/* Email Recipients */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Recipients (Required)
                      </label>
                      <textarea
                        value={emailRecipients}
                        onChange={(e) => setEmailRecipients(e.target.value)}
                        placeholder="recipient1@company.com, recipient2@company.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        rows={2}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Separate multiple emails with commas
                      </p>
                    </div>

                    {/* CC Recipients */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        CC Recipients (Optional)
                      </label>
                      <textarea
                        value={emailCCRecipients}
                        onChange={(e) => setEmailCCRecipients(e.target.value)}
                        placeholder="cc1@company.com, cc2@company.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        rows={2}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      Please provide a reason for rejecting this invoice:
                    </p>
                    
                    {/* Rejection Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rejection Reason (Required)
                      </label>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Please specify why this invoice is being rejected..."
                        className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
                        rows={4}
                        required
                      />
                    </div>
                  </>
                )}
                
                {!showRejectForm ? (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowRejectForm(true);
                        setRejectionReason('');
                      }}
                      className="w-full text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Reject for Revisions
                    </Button>
                    
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowNewCFOModal(false);
                        setCfoInvoicePDFUrl('');
                        setCfoInvoiceData(null);
                        setEmailRecipients('boundless_devices_inc+sales@assist.intuit.com');
                        setEmailCCRecipients('invoices@boundlessdevices.com, dzand@boundlessdevices.com, scistulli@boundlessdevices.com');
                        setShowRejectForm(false);
                        setRejectionReason('');
                      }}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                    
                    <Button
                      onClick={async () => {
                        try {
                          if (!emailRecipients.trim()) {
                            alert('❌ Please enter at least one email recipient.');
                            return;
                          }

                          console.log('📧 SENDING INVOICE EMAIL');
                          
                          // Step 1: Update invoice status to approved and store PDF FILE PATH
                          // Extract file path from the current PDF URL
                          const urlParts = cfoInvoicePDFUrl.split('/');
                          const filePath = `invoices/${cfoInvoiceData.id}/${urlParts[urlParts.length - 1].split('?')[0]}`;
                          console.log('💾 Storing file path instead of signed URL:', filePath);
                          
                          const statusResponse = await fetch(`/api/cpfr/invoices/${cfoInvoiceData.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              status: 'approved_by_finance',
                              financeApproverName: user?.name,
                              financeApprovalDate: new Date().toISOString(),
                              approvedPdfUrl: filePath // Store FILE PATH, not signed URL
                            })
                          });

                          if (statusResponse.ok) {
                            // Step 2: Send email with PDF
                            console.log('📧 CFO Invoice Data being sent:', cfoInvoiceData);
                            await sendInvoiceEmail(cfoInvoiceData, cfoInvoicePDFUrl, emailRecipients, emailCCRecipients);
                            
                            console.log('✅ Invoice approved and email sent');
                            alert(`✅ Invoice approved and sent!\n\nRecipients: ${emailRecipients}\n${emailCCRecipients ? `CC: ${emailCCRecipients}` : ''}`);
                            
                            // Close modal and refresh
                            setShowNewCFOModal(false);
                            setCfoInvoicePDFUrl('');
                            setCfoInvoiceData(null);
                            setEmailRecipients('scistulli@boundlessdevices.com');
                            setEmailCCRecipients('');
                            setShowRejectForm(false);
                            setRejectionReason('');
                            mutateInvoices();
                          } else {
                            alert('❌ Failed to approve invoice.');
                          }
                        } catch (error) {
                          console.error('Error sending invoice:', error);
                          alert('❌ Error sending invoice email.');
                        }
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      Submit to Books (Send Email)
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectionReason('');
                      }}
                      className="w-full"
                    >
                      Back to Approval
                    </Button>
                    
                    <Button
                      onClick={async () => {
                        try {
                          if (!rejectionReason.trim()) {
                            alert('❌ Please enter a rejection reason.');
                            return;
                          }

                          console.log('❌ REJECTING INVOICE');
                          
                          // Update invoice status to rejected
                          const statusResponse = await fetch(`/api/cpfr/invoices/${cfoInvoiceData.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              status: 'rejected_by_finance',
                              rejectionReason: rejectionReason,
                              financeApproverName: user?.name
                            })
                          });

                          if (statusResponse.ok) {
                            console.log('✅ Invoice rejected with reason');
                            alert(`❌ Invoice rejected!\n\nReason: ${rejectionReason}\n\nThe invoice creator will be notified.`);
                            
                            // Close modal and refresh
                            setShowNewCFOModal(false);
                            setCfoInvoicePDFUrl('');
                            setCfoInvoiceData(null);
                            setEmailRecipients('scistulli@boundlessdevices.com');
                            setEmailCCRecipients('');
                            setShowRejectForm(false);
                            setRejectionReason('');
                            mutateInvoices();
                          } else {
                            alert('❌ Failed to reject invoice.');
                          }
                        } catch (error) {
                          console.error('Error rejecting invoice:', error);
                          alert('❌ Error rejecting invoice.');
                        }
                      }}
                      className="w-full bg-red-600 hover:bg-red-700 text-white"
                    >
                      Confirm Rejection
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
            
        </div>
      )}

      {/* Approved Invoice View-Only Modal */}
      {showApprovedInvoiceModal && approvedInvoicePDFUrl && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-white flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Approved Invoice - View Only</h2>
              <p className="text-sm text-gray-600">
                Invoice: {approvedInvoiceData?.invoice_number || approvedInvoiceData?.invoiceNumber} | 
                Status: Finance Approved ✅
              </p>
            </div>
            <button
              onClick={() => {
                setShowApprovedInvoiceModal(false);
                setApprovedInvoicePDFUrl('');
                setApprovedInvoiceData(null);
                setEmailRecipients('scistulli@boundlessdevices.com');
                setEmailCCRecipients('');
              }}
              className="text-2xl text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>

          {/* Content - PDF Viewer + Email Controls */}
          <div className="flex-1 flex flex-col md:flex-row">
            {/* PDF Viewer - Mobile: Top 60%, Desktop: Left side */}
            <div className="flex-1 p-4 h-64 md:h-auto">
              <iframe
                src={approvedInvoicePDFUrl}
                className="w-full h-full border rounded"
                title="Approved Invoice PDF"
              />
            </div>

            {/* Email Resend Controls - Mobile: Bottom, Desktop: Right side */}
            <div className="w-full md:w-80 p-6 bg-gray-50 border-t md:border-t-0 md:border-l flex flex-col">
              <h3 className="text-lg font-semibold mb-4">Resend Invoice</h3>
              
              <div className="space-y-4 flex-1">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-800 font-medium">✅ Finance Approved</p>
                  <p className="text-xs text-green-600">This invoice has been approved and cannot be edited.</p>
                </div>
                
                {/* Email Recipients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Recipients (Required)
                  </label>
                  <textarea
                    value={emailRecipients}
                    onChange={(e) => setEmailRecipients(e.target.value)}
                    placeholder="recipient1@company.com, recipient2@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Separate multiple emails with commas
                  </p>
                </div>

                {/* CC Recipients */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CC Recipients (Optional)
                  </label>
                  <textarea
                    value={emailCCRecipients}
                    onChange={(e) => setEmailCCRecipients(e.target.value)}
                    placeholder="cc1@company.com, cc2@company.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    rows={2}
                  />
                </div>
                
                <Button 
                  variant="outline"
                  onClick={() => {
                    setShowApprovedInvoiceModal(false);
                    setApprovedInvoicePDFUrl('');
                    setApprovedInvoiceData(null);
                    setEmailRecipients('scistulli@boundlessdevices.com');
                    setEmailCCRecipients('');
                  }}
                  className="w-full"
                >
                  Close
                </Button>
                
                <Button
                  onClick={async () => {
                    try {
                      if (!emailRecipients.trim()) {
                        alert('❌ Please enter at least one email recipient.');
                        return;
                      }

                      console.log('📧 RESENDING APPROVED INVOICE EMAIL');
                      
                      // Send email with PDF (no status update needed - already approved)
                      await sendInvoiceEmail(approvedInvoiceData, approvedInvoicePDFUrl, emailRecipients, emailCCRecipients);
                      
                      console.log('✅ Approved invoice resent successfully');
                      alert(`✅ Invoice resent successfully!\n\nRecipients: ${emailRecipients}\n${emailCCRecipients ? `CC: ${emailCCRecipients}` : ''}`);
                      
                      // Reset email fields but keep modal open
                      setEmailRecipients('scistulli@boundlessdevices.com');
                      setEmailCCRecipients('');
                    } catch (error) {
                      console.error('Error resending invoice:', error);
                      alert('❌ Error resending invoice email.');
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Resend Email
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
