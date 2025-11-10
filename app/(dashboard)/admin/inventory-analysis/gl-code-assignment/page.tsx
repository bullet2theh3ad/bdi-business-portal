'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calculator, RefreshCw, Save, Search, Download, Upload, ChevronDown, ChevronRight,
  DollarSign, TrendingUp, TrendingDown, FileText, AlertCircle, Check, X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  ACCOUNT_TYPE_MAPPINGS, 
  getCategoryForAccountType, 
  getAccountTypesByCategory,
  getCategoryDisplayName as getDisplayName
} from '@/lib/account-type-mappings';

// Types
interface Transaction {
  id: string;
  source: 'expense' | 'bill' | 'deposit' | 'payment' | 'bill_payment';
  sourceId: string;
  lineItemIndex: number | null;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  glCode: string;
  glCodeName: string;
  accountType?: string; // Detailed account type (Contract, Services, etc.)
  originalCategory: string; // Original QB category before override
  category: string; // High-level category (opex, nre, inventory, etc.)
  notes: string;
  bankTransactionNumber: string;
  hasOverride: boolean;
}

interface BankStatement {
  id: string;
  transaction_date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
  check_number: string | null;
  bank_transaction_number: string | null;
  reference_number: string | null; // Customer/Bank reference number
  account_type: string | null; // Detailed account type (Contract, Services, etc.)
  category: string; // High-level category (opex, nre, inventory, etc.)
  gl_code_assignment: string | null;
  high_level_category: string;
  notes: string | null;
  is_matched: boolean;
  matched_qb_transaction_type: string | null;
  matched_qb_transaction_id: string | null;
  upload_batch_id: string;
}

interface RampTransaction {
  id: string;
  transaction_date: string;
  ref_no: string | null;
  payee: string | null;
  memo: string | null;
  class: string | null;
  foreign_currency: string | null;
  charge_usd: number | null;
  payment_usd: number | null;
  reconciliation_status: string | null;
  balance_usd: number | null;
  type: string | null;
  account: string | null;
  store: string | null;
  exchange_rate: string | null;
  added_in_banking: string | null;
  category: string;
  account_type: string | null;
  notes: string | null;
  is_matched: boolean;
  matched_qb_transaction_id: string | null;
}

interface CategorySummary {
  nre: number;
  inventory: number;
  opex: number;
  marketing: number;
  labor: number;
  loans: number;
  loan_interest: number;
  investments: number;
  revenue: number;
  other: number;
  unassigned: number;
  [key: string]: number;
}

interface StatusBreakdown {
  paid: number;
  overdue: number;
  toBePaid: number;
}

interface CategoryBreakdown {
  nre: StatusBreakdown;
  inventory: StatusBreakdown;
}

interface ReconciliationStatus {
  internalDB: number;
  categorized: number;
  delta: number;
  isReconciled: boolean;
}

interface Reconciliation {
  nre: ReconciliationStatus;
  inventory: ReconciliationStatus;
  revenue: ReconciliationStatus;
  loans: ReconciliationStatus;
  loan_interest: ReconciliationStatus;
  labor: ReconciliationStatus;
  marketing: ReconciliationStatus;
  opex: ReconciliationStatus;
}

interface GLCodeGroup {
  glCode: string;
  glCodeName: string;
  transactions: Transaction[];
  total: number;
}

interface CategoryGroup {
  category: string;
  glCodes: GLCodeGroup[];
  total: number;
  transactionCount: number;
}

export default function GLTransactionManagementPage() {
  // Component state
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankStatements, setBankStatements] = useState<BankStatement[]>([]);
  const [rampTransactions, setRampTransactions] = useState<RampTransaction[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary>({
    nre: 0, inventory: 0, opex: 0, marketing: 0, labor: 0, loans: 0, loan_interest: 0,
    investments: 0, revenue: 0, other: 0, unassigned: 0
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown>({
    nre: { paid: 0, overdue: 0, toBePaid: 0 },
    inventory: { paid: 0, overdue: 0, toBePaid: 0 },
  });
  const [revenueBreakdown, setRevenueBreakdown] = useState({
    d2c: 0,
    b2b: 0,
    b2b_factored: 0,
  });
  const [laborBankBreakdown, setLaborBankBreakdown] = useState({
    payroll: 0,
    taxes: 0,
    overhead: 0,
  });
  const [laborManualBreakdown, setLaborManualBreakdown] = useState({
    payroll: 0,
    taxes: 0,
    overhead: 0,
  });
  const [reconciliation, setReconciliation] = useState<Reconciliation>({
    nre: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    inventory: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    revenue: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    loans: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    loan_interest: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    labor: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    marketing: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
    opex: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
  });
  
  // UI State
  const [viewMode, setViewMode] = useState<'transactions' | 'bank' | 'ramp'>('transactions');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [originalCategoryFilter, setOriginalCategoryFilter] = useState<string>('all'); // Filter by QB original categories
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // Filter by user-assigned categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [collapsedGLCodes, setCollapsedGLCodes] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  
  // Date range tracking
  const [qbDateRange, setQbDateRange] = useState<{ earliest: string; latest: string } | null>(null);
  const [bankDateRange, setBankDateRange] = useState<{ earliest: string; latest: string } | null>(null);
  const [rampDateRange, setRampDateRange] = useState<{ earliest: string; latest: string } | null>(null);

  // Load data on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Reload summary when filters change
  useEffect(() => {
    if (!isLoading) {
      loadSummary();
    }
  }, [startDate, endDate]);

  async function loadAllData() {
    try {
      setIsLoading(true);
      await Promise.all([
        loadTransactions(),
        loadBankStatements(),
        loadRampTransactions(),
        loadSummary(),
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTransactions() {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gl-management/transactions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      
      const data = await response.json();
      const txns = data.transactions || [];
      setTransactions(txns);
      
      // Calculate date range from actual data
      if (txns.length > 0) {
        const dates = txns.map((t: Transaction) => new Date(t.date)).filter((d: Date) => !isNaN(d.getTime()));
        if (dates.length > 0) {
          const earliest = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
          const latest = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
          setQbDateRange({
            earliest: earliest.toISOString().split('T')[0],
            latest: latest.toISOString().split('T')[0]
          });
        }
      } else {
        setQbDateRange(null);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  }

  async function loadBankStatements() {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gl-management/bank-statements?${params}`);
      if (!response.ok) throw new Error('Failed to fetch bank statements');
      
      const data = await response.json();
      const statements = data.statements || [];
      setBankStatements(statements);
      
      // Calculate date range from actual data
      if (statements.length > 0) {
        const dates = statements.map((s: BankStatement) => new Date(s.transaction_date)).filter((d: Date) => !isNaN(d.getTime()));
        if (dates.length > 0) {
          const earliest = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
          const latest = new Date(Math.max(...dates.map((d: Date) => d.getTime())));
          setBankDateRange({
            earliest: earliest.toISOString().split('T')[0],
            latest: latest.toISOString().split('T')[0]
          });
        }
      } else {
        setBankDateRange(null);
      }
    } catch (error) {
      console.error('Error loading bank statements:', error);
    }
  }

  async function loadRampTransactions() {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gl-management/ramp-transactions?${params}`);
      if (!response.ok) throw new Error('Failed to fetch Ramp transactions');
      
      const data = await response.json();
      setRampTransactions(data);
      
      // Calculate date range
      if (data.length > 0) {
        const dates = data.map((t: RampTransaction) => t.transaction_date).sort();
        setRampDateRange({ earliest: dates[0], latest: dates[dates.length - 1] });
      } else {
        setRampDateRange(null);
      }
      
      console.log(`✅ Loaded ${data.length} Ramp transactions`);
    } catch (error) {
      console.error('Error loading Ramp transactions:', error);
    }
  }

  async function loadSummary() {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gl-management/summary?${params}`);
      if (!response.ok) throw new Error('Failed to fetch summary');
      
      const data = await response.json();
      setCategorySummary(data.summary || {});
      setCategoryBreakdown(data.breakdown || { nre: { paid: 0, overdue: 0, toBePaid: 0 }, inventory: { paid: 0, overdue: 0, toBePaid: 0 } });
      setRevenueBreakdown(data.revenueBreakdown || { d2c: 0, b2b: 0, b2b_factored: 0 });
      setLaborBankBreakdown(data.laborBankBreakdown || { payroll: 0, taxes: 0, overhead: 0 });
      setLaborManualBreakdown(data.laborManualBreakdown || { payroll: 0, taxes: 0, overhead: 0 });
      setReconciliation(data.reconciliation || {
        nre: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
        inventory: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
        loan_interest: { internalDB: 0, categorized: 0, delta: 0, isReconciled: true },
      });
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  }

  // Filter bank statements based on search query
  const filteredBankStatements = (() => {
    let filtered = bankStatements;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        (s.description || '').toLowerCase().includes(query) ||
        (s.account_type || '').toLowerCase().includes(query) ||
        (s.category || '').toLowerCase().includes(query) ||
        (s.notes || '').toLowerCase().includes(query) ||
        (s.reference_number || '').toLowerCase().includes(query)
      );
    }

    return filtered;
  })();

  // Group transactions by category and GL code
  const groupedData: CategoryGroup[] = (() => {
    let filtered = transactions;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        (t.description || '').toLowerCase().includes(query) ||
        (t.vendor || '').toLowerCase().includes(query) ||
        (t.glCodeName || '').toLowerCase().includes(query) ||
        (t.notes || '').toLowerCase().includes(query)
      );
    }

    // Apply original category filter (QB categories before overrides)
    if (originalCategoryFilter && originalCategoryFilter !== 'all') {
      filtered = filtered.filter(t => t.originalCategory === originalCategoryFilter);
    }

    // Apply user-assigned category filter (your new categorizations)
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === categoryFilter);
    }

    // Group by category
    const categoryMap = new Map<string, Transaction[]>();
    filtered.forEach(t => {
      const cat = t.category || 'unassigned';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, []);
      }
      categoryMap.get(cat)!.push(t);
    });

    // For each category, group by GL code
    const result: CategoryGroup[] = [];
    categoryMap.forEach((txns, category) => {
      const glCodeMap = new Map<string, Transaction[]>();
      
      txns.forEach(t => {
        const key = `${t.glCode}:${t.glCodeName}`;
        if (!glCodeMap.has(key)) {
          glCodeMap.set(key, []);
        }
        glCodeMap.get(key)!.push(t);
      });

      const glCodes: GLCodeGroup[] = [];
      glCodeMap.forEach((glTxns, key) => {
        const [glCode, glCodeName] = key.split(':');
        const total = glTxns.reduce((sum, t) => sum + t.amount, 0);
        glCodes.push({
          glCode,
          glCodeName,
          transactions: glTxns.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
          total,
        });
      });

      // Sort GL codes by total amount (descending)
      glCodes.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

      const categoryTotal = txns.reduce((sum, t) => sum + t.amount, 0);
      result.push({
        category,
        glCodes,
        total: categoryTotal,
        transactionCount: txns.length,
      });
    });

    // Sort categories by total amount (descending)
    result.sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

    return result;
  })();

  // Toggle collapse functions
  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const toggleGLCode = (category: string, glCode: string) => {
    const key = `${category}:${glCode}`;
    setCollapsedGLCodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Update transaction
  const updateTransaction = async (transaction: Transaction, updates: Partial<Transaction>) => {
    try {
      const override = {
        transaction_source: transaction.source,
        transaction_id: transaction.sourceId,
        line_item_index: transaction.lineItemIndex,
        original_category: transaction.category,
        override_category: updates.category,
        override_account_type: updates.accountType, // CRITICAL: Save account type!
        original_gl_code: transaction.glCode,
        assigned_gl_code: updates.glCode,
        notes: updates.notes,
        bank_transaction_number: updates.bankTransactionNumber,
        original_description: transaction.description,
        override_description: updates.description,
      };

      console.log('💾 [Frontend] Saving override:', {
        key: `${override.transaction_source}:${override.transaction_id}:${override.line_item_index || ''}`,
        category: override.override_category,
        accountType: override.override_account_type, // Log account type
        amount: transaction.amount,
      });

      const response = await fetch('/api/gl-management/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides: override }),
      });

      if (!response.ok) throw new Error('Failed to save override');

      // Update local state
      setTransactions(prev => prev.map(t => 
        t.id === transaction.id ? { ...t, ...updates, hasOverride: true } : t
      ));

      // Reload summary
      await loadSummary();

      return true;
    } catch (error) {
      console.error('Error updating transaction:', error);
      return false;
    }
  };

  // Handle CSV upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      setUploadSuccess(null);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/gl-management/bank-statements/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error information
        let errorMsg = data.error || 'Upload failed';
        if (data.headers) {
          errorMsg += `\n\nFound columns: ${data.headers.join(', ')}`;
        }
        if (data.foundColumns) {
          errorMsg += `\n\nColumn mapping: ${JSON.stringify(data.foundColumns, null, 2)}`;
        }
        throw new Error(errorMsg);
      }

      // Show detailed success message with warnings if rows were skipped
      let successMsg = data.message || `Successfully imported ${data.imported} transactions`;
      if (data.skipped > 0) {
        successMsg += ` (${data.skipped} rows skipped)`;
      }
      if (data.totalErrors > 0) {
        successMsg += `\n\n⚠️ ${data.totalErrors} errors found`;
        if (data.errors && data.errors.length > 0) {
          successMsg += ':\n' + data.errors.map((e: any) => `Line ${e.line}: ${e.error}`).slice(0, 5).join('\n');
          if (data.totalErrors > 5) {
            successMsg += `\n... and ${data.totalErrors - 5} more`;
          }
        }
      }
      
      console.log('CSV Upload Result:', data); // Log full response for debugging
      
      setUploadSuccess(successMsg);
      await loadBankStatements();
      await loadSummary();

      // Clear file input
      event.target.value = '';
    } catch (error: any) {
      console.error('CSV Upload Error:', error);
      setUploadError(error.message || 'Failed to upload file');
    }
  };

  // Handle Ramp file upload
  const handleRampFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploadError(null);
      setUploadSuccess(null);
      
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/gl-management/ramp-transactions/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Upload failed');
      }

      const result = await response.json();
      setUploadSuccess(`✅ Imported ${result.imported} Ramp transactions${result.skipped ? `, skipped ${result.skipped}` : ''}`);
      
      // Reload data
      await loadRampTransactions();
      await loadSummary();
      
      // Clear file input
      event.target.value = '';
    } catch (error: any) {
      console.error('Error uploading Ramp file:', error);
      setUploadError(error.message || 'Failed to upload Ramp file');
    }
  };

  // Export to CSV
  const handleExport = () => {
    const csvRows = [
      ['Date', 'Source', 'Vendor/Customer', 'Description', 'Amount', 'GL Code', 'GL Code Name', 'Category', 'Bank Txn #', 'Notes'].join(',')
    ];

    transactions.forEach(t => {
      csvRows.push([
        t.date,
        t.source,
        `"${t.vendor}"`,
        `"${t.description}"`,
        t.amount.toFixed(2),
        t.glCode,
        `"${t.glCodeName}"`,
        t.category,
        t.bankTransactionNumber || '',
        `"${t.notes || ''}"`
      ].join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gl-transactions-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Category badge color
  const getCategoryColor = (category: string) => {
    const colors: {[key: string]: string} = {
      nre: 'bg-purple-100 text-purple-800 border-purple-200',
      inventory: 'bg-blue-100 text-blue-800 border-blue-200',
      opex: 'bg-orange-100 text-orange-800 border-orange-200',
      marketing: 'bg-pink-100 text-pink-800 border-pink-200',
      labor: 'bg-green-100 text-green-800 border-green-200',
      loans: 'bg-red-100 text-red-800 border-red-200',
      loan_interest: 'bg-pink-100 text-pink-800 border-pink-200',
      investments: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      revenue: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      other: 'bg-gray-100 text-gray-800 border-gray-200',
      unassigned: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };
    return colors[category] || colors.unassigned;
  };
  
  // Category display name
  const getCategoryDisplayName = (category: string) => {
    const names: {[key: string]: string} = {
      nre: 'NRE',
      inventory: 'Inventory',
      opex: 'OPEX',
      marketing: 'Marketing',
      labor: 'Labor',
      loans: 'RLOC',
      loan_interest: 'Loan Interest Paid',
      investments: 'Investments',
      revenue: 'Net Revenue',
      other: 'Other',
      unassigned: 'Unassigned',
    };
    return names[category] || category.toUpperCase();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Fixed Floating Summary Window - Stays at top, matches content width */}
      <div className="fixed top-20 left-64 right-4 z-40 px-4 sm:px-6 lg:px-8">
      <Card className="shadow-xl border-2 border-blue-200 bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Category Summary
            </CardTitle>
            <div className="text-xs font-medium text-gray-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              {startDate && endDate ? (
                <span>{startDate} to {endDate}</span>
              ) : startDate ? (
                <span>From {startDate}</span>
              ) : endDate ? (
                <span>Until {endDate}</span>
              ) : (
                <span>All Time</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Define card order: NRE, Inventory, Net Revenue, RLOC, Labor, Marketing, OPEX, etc. */}
            {['nre', 'inventory', 'revenue', 'loans', 'labor', 'marketing', 'opex', 'investments', 'other', 'unassigned'].map((key) => {
              const value = categorySummary[key] || 0;
              // Skip loan_interest as standalone - it's shown within RLOC card
              if (key === 'loan_interest') return null;
              
              const hasBreakdown = key === 'nre' || key === 'inventory';
              const breakdown = hasBreakdown ? categoryBreakdown[key as 'nre' | 'inventory'] : null;
              const hasRevenueBreakdown = key === 'revenue';
              const hasRlocBreakdown = key === 'loans';
              const hasLaborBreakdown = key === 'labor';
              const isLoans = key === 'loans';
              
              return (
                <div key={key}>
                  {/* Main category card */}
                  <div className={`p-3 rounded-lg border ${getCategoryColor(key)}`}>
                    <div className="text-xs font-medium mb-1">{getCategoryDisplayName(key)}</div>
                    
                    {/* Show breakdown for NRE and Inventory */}
                    {hasBreakdown && breakdown ? (
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-green-700">Paid:</span>
                          <span className="text-sm font-semibold">{formatCurrency(breakdown.paid)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-red-700">Past Due:</span>
                          <span className="text-sm font-semibold">{formatCurrency(breakdown.overdue)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-blue-700">To Be Paid:</span>
                          <span className="text-sm font-semibold">{formatCurrency(breakdown.toBePaid)}</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-current/20 flex justify-between items-center">
                          <span className="text-[10px] font-medium">Total (DB):</span>
                          <span className="text-base font-bold">{formatCurrency(value)}</span>
                        </div>
                        {/* Reconciliation Status */}
                        {reconciliation[key as 'nre' | 'inventory'] && (
                          <>
                            <div className="flex justify-between items-center text-[9px] text-gray-600">
                              <span>Categorized:</span>
                              <span>{formatCurrency(reconciliation[key as 'nre' | 'inventory'].categorized)}</span>
                            </div>
                            <div className={`flex justify-between items-center text-[10px] font-semibold ${
                              reconciliation[key as 'nre' | 'inventory'].isReconciled 
                                ? 'text-green-700' 
                                : 'text-red-700'
                            }`}>
                              <span className="flex items-center gap-1.5">
                                {reconciliation[key as 'nre' | 'inventory'].isReconciled ? '✅' : '🚩'}
                                <span className="ml-0.5">Delta:</span>
                              </span>
                              <span>{formatCurrency(Math.abs(reconciliation[key as 'nre' | 'inventory'].delta))}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : hasRevenueBreakdown ? (
                      /* Show breakdown for Revenue by channel */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-emerald-700">D2C:</span>
                          <span className="text-sm font-semibold">{formatCurrency(Math.abs(revenueBreakdown.d2c))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-emerald-700">B2B:</span>
                          <span className="text-sm font-semibold">{formatCurrency(Math.abs(revenueBreakdown.b2b))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-emerald-700">B2B (factored):</span>
                          <span className="text-sm font-semibold">{formatCurrency(Math.abs(revenueBreakdown.b2b_factored))}</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-current/20 flex justify-between items-center">
                          <span className="text-[10px] font-medium">Categorized:</span>
                          <span className="text-base font-bold">{formatCurrency(Math.abs(revenueBreakdown.d2c + revenueBreakdown.b2b + revenueBreakdown.b2b_factored))}</span>
                        </div>
                        {/* Reconciliation Status */}
                        <div className="flex justify-between items-center text-[9px] text-gray-600">
                          <span>From Bank/QB:</span>
                          <span>{formatCurrency(Math.abs(value))}</span>
                        </div>
                        <div className={`flex justify-between items-center text-[10px] font-semibold ${
                          reconciliation.revenue.isReconciled ? 'text-green-700' : 'text-red-700'
                        }`}>
                          <span className="flex items-center gap-1.5">
                            {reconciliation.revenue.isReconciled ? '✅' : '🚩'}
                            <span className="ml-0.5">Delta:</span>
                          </span>
                          <span>{formatCurrency(Math.abs(reconciliation.revenue.delta))}</span>
                        </div>
                      </div>
                    ) : hasRlocBreakdown ? (
                      /* Show breakdown for RLOC - Loan Total, Loans Applied, RLOC Available, then Loan Interest */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-blue-700">Loan Total:</span>
                          <span className="text-sm font-semibold">{formatCurrency(6242000)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-red-700">Loans Applied:</span>
                          <span className="text-sm font-semibold">{formatCurrency(Math.abs(value))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-green-700">RLOC Available:</span>
                          <span className="text-sm font-semibold">{formatCurrency(6242000 - Math.abs(value))}</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-current/20 flex justify-between items-center">
                          <span className="text-[10px] font-medium text-pink-700">Interest (Bank):</span>
                          <span className="text-base font-bold">{formatCurrency(categorySummary.loan_interest)}</span>
                        </div>
                        {/* Reconciliation Status for Loan Interest */}
                        {reconciliation.loan_interest && (
                          <>
                            <div className="flex justify-between items-center text-[9px] text-gray-600">
                              <span>Categorized:</span>
                              <span>{formatCurrency(reconciliation.loan_interest.categorized)}</span>
                            </div>
                            <div className={`flex justify-between items-center text-[10px] font-semibold ${
                              reconciliation.loan_interest.isReconciled 
                                ? 'text-green-700' 
                                : 'text-red-700'
                            }`}>
                              <span className="flex items-center gap-1.5">
                                {reconciliation.loan_interest.isReconciled ? '✅' : '🚩'}
                                <span className="ml-0.5">Delta:</span>
                              </span>
                              <span>{formatCurrency(Math.abs(reconciliation.loan_interest.delta))}</span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : hasLaborBreakdown ? (
                      /* Show breakdown for Labor - Payroll, Taxes/Overhead, Overhead Charges */
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-blue-700">Labor:</span>
                          <span className="text-sm font-semibold">{formatCurrency(laborManualBreakdown.payroll)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-orange-700">Taxes/Overhead:</span>
                          <span className="text-sm font-semibold">{formatCurrency(laborManualBreakdown.taxes)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-purple-700">Overhead Charges:</span>
                          <span className="text-sm font-semibold">{formatCurrency(laborManualBreakdown.overhead)}</span>
                        </div>
                        <div className="pt-1 mt-1 border-t border-current/20 flex justify-between items-center">
                          <span className="text-[10px] font-medium">Categorized:</span>
                          <span className="text-base font-bold">{formatCurrency(laborManualBreakdown.payroll + laborManualBreakdown.taxes + laborManualBreakdown.overhead)}</span>
                        </div>
                        {/* Reconciliation Status */}
                        <div className="flex justify-between items-center text-[9px] text-gray-600">
                          <span>From Bank/QB:</span>
                          <span>{formatCurrency(laborBankBreakdown.payroll + laborBankBreakdown.taxes + laborBankBreakdown.overhead)}</span>
                        </div>
                        <div className={`flex justify-between items-center text-[10px] font-semibold ${
                          reconciliation.labor.isReconciled ? 'text-green-700' : 'text-red-700'
                        }`}>
                          <span className="flex items-center gap-1.5">
                            {reconciliation.labor.isReconciled ? '✅' : '🚩'}
                            <span className="ml-0.5">Delta:</span>
                          </span>
                          <span>{formatCurrency(Math.abs(reconciliation.labor.delta))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-lg font-bold">{formatCurrency(value)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Outflows</div>
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(
                  categorySummary.nre + categorySummary.inventory + categorySummary.opex + 
                  categorySummary.marketing + categorySummary.labor + categorySummary.loans + categorySummary.loan_interest + 
                  categorySummary.investments + categorySummary.other + categorySummary.unassigned
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Total Inflows</div>
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(Math.abs(categorySummary.revenue))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600 mb-1">Net Cash Flow</div>
              <div className={`text-xl font-bold ${
                (Math.abs(categorySummary.revenue) - (categorySummary.nre + categorySummary.inventory + categorySummary.opex + categorySummary.marketing + categorySummary.labor + categorySummary.loans + categorySummary.investments + categorySummary.other + categorySummary.unassigned)) >= 0 
                  ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(
                  Math.abs(categorySummary.revenue) - 
                  (categorySummary.nre + categorySummary.inventory + categorySummary.opex + 
                  categorySummary.marketing + categorySummary.labor + categorySummary.loans + categorySummary.investments + 
                  categorySummary.other + categorySummary.unassigned)
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Spacer to push content below fixed summary */}
      <div className="h-[560px] sm:h-[540px]"></div>
      
      {/* Page Title - Above tabs */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 flex items-center gap-3">
          <Calculator className="h-8 w-8 text-blue-600" />
          GL Transaction Management
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Categorize and reconcile QuickBooks transactions with bank statements
        </p>
      </div>
      
      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* View Mode Toggle */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  onClick={() => setViewMode('transactions')}
                  variant={viewMode === 'transactions' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  QuickBooks Transactions
                </Button>
                <Button
                  onClick={() => setViewMode('bank')}
                  variant={viewMode === 'bank' ? 'default' : 'outline'}
                  className="flex-1"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Bank Statements
                </Button>
              </div>
              
              {/* Date Range Indicators - Both visible, aligned under respective tabs */}
              <div className="flex gap-2 text-xs">
                <div className="flex-1 flex items-center gap-2 text-gray-600">
                  <span className="font-medium">QB Data Range:</span>
                  {qbDateRange ? (
                    <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">
                      {qbDateRange.earliest} to {qbDateRange.latest}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">No data</span>
                  )}
                </div>
                <div className="flex-1 flex items-center gap-2 text-gray-600">
                  <span className="font-medium">Bank Data Range:</span>
                  {bankDateRange ? (
                    <span className="bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">
                      {bankDateRange.earliest} to {bankDateRange.latest}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">No data</span>
                  )}
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label className="text-sm mb-1">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm mb-1">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm mb-1">Original QB Category</Label>
                <Select value={originalCategoryFilter} onValueChange={setOriginalCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {/* Dynamically show unique original categories from transactions */}
                    {Array.from(new Set(transactions.map(t => t.originalCategory || 'unassigned')))
                      .sort()
                      .map(cat => (
                        <SelectItem key={cat} value={cat}>
                          {getCategoryDisplayName(cat)} ({transactions.filter(t => (t.originalCategory || 'unassigned') === cat).length})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-1">My New Category</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {/* Show ALL possible categories (even if 0 transactions) */}
                    {['nre', 'inventory', 'revenue', 'opex', 'marketing', 'labor', 'loans', 'loan_interest', 'investments', 'other', 'unassigned']
                      .map(cat => {
                        const count = transactions.filter(t => (t.category || 'unassigned') === cat).length;
                        return (
                          <SelectItem key={cat} value={cat}>
                            {getCategoryDisplayName(cat)} ({count})
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-1">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={loadAllData} variant="outline" className="flex-1" disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                ref={(input) => {
                  if (input) {
                    (window as any).csvUploadInput = input;
                  }
                }}
              />
              <Button 
                variant="outline" 
                onClick={() => document.getElementById('csv-upload')?.click()}
                type="button"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Bank File (CSV/Excel)
              </Button>
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export to CSV
              </Button>
            </div>

            {/* Upload feedback */}
            {uploadSuccess && (
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
                <Check className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm whitespace-pre-wrap flex-1">{uploadSuccess}</div>
                <button onClick={() => setUploadSuccess(null)} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {uploadError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="text-sm whitespace-pre-wrap flex-1">{uploadError}</div>
                <button onClick={() => setUploadError(null)} className="flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
        </div>
      )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading transactions...</p>
        </div>
      )}

      {/* Transactions View - Hierarchical */}
      {!isLoading && viewMode === 'transactions' && (
        <div className="space-y-4">
          {groupedData.length === 0 ? (
        <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>No transactions found matching your filters</p>
          </CardContent>
        </Card>
          ) : (
            groupedData.map((categoryGroup) => (
              <Card key={categoryGroup.category} className="overflow-hidden">
                {/* Level 1: Category */}
                <div
                  className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleCategory(categoryGroup.category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {collapsedCategories.has(categoryGroup.category) ? (
                        <ChevronRight className="h-5 w-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-600" />
                      )}
                      <Badge className={`${getCategoryColor(categoryGroup.category)} border`}>
                        {categoryGroup.category.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        ({categoryGroup.transactionCount} transactions)
                      </span>
                    </div>
                    <div className="font-bold text-lg">
                      {formatCurrency(categoryGroup.total)}
                    </div>
            </div>
            </div>

                {/* Level 2: GL Codes */}
                {!collapsedCategories.has(categoryGroup.category) && (
                  <div className="border-t">
                    {categoryGroup.glCodes.map((glCodeGroup) => {
                      const glKey = `${categoryGroup.category}:${glCodeGroup.glCode}`;
                      const isGLCollapsed = collapsedGLCodes.has(glKey);

                      return (
                        <div key={glKey} className="border-b last:border-b-0">
                          <div
                            className="p-3 pl-12 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleGLCode(categoryGroup.category, glCodeGroup.glCode)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isGLCollapsed ? (
                                  <ChevronRight className="h-4 w-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-500" />
                                )}
                                <span className="font-mono text-sm font-medium text-blue-600">
                                  {glCodeGroup.glCode}
                                </span>
                                <span className="text-sm text-gray-700">
                                  {glCodeGroup.glCodeName}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({glCodeGroup.transactions.length})
                                </span>
            </div>
                              <div className="font-semibold">
                                {formatCurrency(glCodeGroup.total)}
            </div>
            </div>
      </div>

                          {/* Level 3: Transactions */}
                          {!isGLCollapsed && (
                            <div className="pl-16 pr-4 pb-2 bg-gray-50">
                              <div className="space-y-2">
                                {glCodeGroup.transactions.map((txn) => (
                                  <TransactionRow
                                    key={txn.id}
                                    transaction={txn}
                                    onUpdate={updateTransaction}
                                  />
                                ))}
        </div>
          </div>
        )}
      </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Bank Statements View */}
      {!isLoading && viewMode === 'bank' && (
        <BankStatementsView
          statements={filteredBankStatements}
          onUpdate={loadBankStatements}
          onSummaryUpdate={loadSummary}
        />
      )}
    </div>
  );
}

// Transaction Row Component
function TransactionRow({ 
  transaction, 
  onUpdate 
}: { 
  transaction: Transaction; 
  onUpdate: (txn: Transaction, updates: Partial<Transaction>) => Promise<boolean>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAccountType, setEditedAccountType] = useState(transaction.accountType || 'Unclassified');
  const [editedCategory, setEditedCategory] = useState(transaction.category);
  const [editedNotes, setEditedNotes] = useState(transaction.notes);
  const [editedBankTxn, setEditedBankTxn] = useState(transaction.bankTransactionNumber);
  const [isSaving, setIsSaving] = useState(false);

  // When account type changes, auto-set the category
  const handleAccountTypeChange = (accountType: string) => {
    setEditedAccountType(accountType);
    const category = getCategoryForAccountType(accountType);
    if (category) {
      setEditedCategory(category);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const success = await onUpdate(transaction, {
      accountType: editedAccountType,
      category: editedCategory,
      notes: editedNotes,
      bankTransactionNumber: editedBankTxn,
    });
    if (success) {
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedAccountType(transaction.accountType || 'Unclassified');
    setEditedCategory(transaction.category);
    setEditedNotes(transaction.notes);
    setEditedBankTxn(transaction.bankTransactionNumber);
    setIsEditing(false);
  };

  // Group account types by category for display
  const accountTypesByCategory = getAccountTypesByCategory();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="p-3 bg-white rounded border hover:shadow-sm transition-shadow">
      <div className="grid grid-cols-12 gap-2 items-center text-sm">
        <div className="col-span-1 text-xs text-gray-600">
          {new Date(transaction.date).toLocaleDateString()}
        </div>
        <div className="col-span-1">
          <Badge variant="outline" className="text-xs">
            {transaction.source}
          </Badge>
        </div>
        <div className="col-span-2 text-xs truncate" title={transaction.vendor}>
          {transaction.vendor}
        </div>
        <div className="col-span-2 text-xs truncate" title={transaction.description}>
          {transaction.description}
        </div>
        <div className="col-span-1 font-semibold text-right">
          {formatCurrency(transaction.amount)}
        </div>
        
        {isEditing ? (
          <>
            <div className="col-span-2">
              <Select value={editedAccountType} onValueChange={handleAccountTypeChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(accountTypesByCategory).map(([category, types]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                        {getDisplayName(category)}
                      </div>
                      {types.map((mapping) => (
                        <SelectItem key={mapping.accountType} value={mapping.accountType}>
                          {mapping.accountType}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1">
              <Input
                value={editedBankTxn}
                onChange={(e) => setEditedBankTxn(e.target.value)}
                placeholder="Bank Txn #"
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2 flex gap-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="h-7 px-2 text-xs"
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                className="h-7 px-2 text-xs"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="col-span-2">
              <div className="flex flex-col gap-0.5">
                <Badge variant="outline" className="text-xs font-medium w-fit">
                  {transaction.accountType || 'Unclassified'}
                </Badge>
                <span className="text-[9px] text-gray-400">
                  → {getDisplayName(transaction.category || 'unassigned')}
                </span>
              </div>
            </div>
            <div className="col-span-1 text-xs text-center">
              {transaction.bankTransactionNumber || '-'}
            </div>
            <div className="col-span-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="h-7 px-2 text-xs w-full"
              >
                Edit
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Bank Statement Row Component with inline editing
function BankStatementRow({ 
  statement, 
  onUpdate,
  onSummaryUpdate,
}: { 
  statement: BankStatement; 
  onUpdate: () => void;
  onSummaryUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAccountType, setEditedAccountType] = useState(statement.account_type || 'Unclassified');
  const [editedCategory, setEditedCategory] = useState(statement.category || 'unassigned');
  const [editedNotes, setEditedNotes] = useState(statement.notes || '');
  const [editedBalance, setEditedBalance] = useState(statement.balance?.toString() || '');
  const [editedIsMatched, setEditedIsMatched] = useState(statement.is_matched || false);
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // When account type changes, auto-set the category
  const handleAccountTypeChange = (accountType: string) => {
    setEditedAccountType(accountType);
    const category = getCategoryForAccountType(accountType);
    if (category) {
      setEditedCategory(category);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/gl-management/bank-statements`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: statement.id,
          account_type: editedAccountType,
          category: editedCategory,
          notes: editedNotes,
          balance: editedBalance ? parseFloat(editedBalance) : null,
          is_matched: editedIsMatched,
        }),
      });

      if (response.ok) {
        setIsEditing(false);
        onUpdate();
        onSummaryUpdate();
      } else {
        console.error('Failed to update bank statement');
      }
    } catch (error) {
      console.error('Error updating bank statement:', error);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditedAccountType(statement.account_type || 'Unclassified');
    setEditedCategory(statement.category || 'unassigned');
    setEditedNotes(statement.notes || '');
    setEditedBalance(statement.balance?.toString() || '');
    setEditedIsMatched(statement.is_matched || false);
    setIsEditing(false);
  };

  // Group account types by category for display
  const accountTypesByCategory = getAccountTypesByCategory();

  return (
    <div className="grid grid-cols-13 gap-2 p-3 border rounded hover:bg-gray-50 text-xs items-center">
      <div className="col-span-1">{new Date(statement.transaction_date).toLocaleDateString()}</div>
      <div className="col-span-3 truncate" title={statement.description}>{statement.description}</div>
      <div className="col-span-1 text-right text-red-600">{statement.debit > 0 ? formatCurrency(statement.debit) : '-'}</div>
      <div className="col-span-1 text-right text-green-600">{statement.credit > 0 ? formatCurrency(statement.credit) : '-'}</div>
      
      {/* Balance - editable */}
      <div className="col-span-1 text-right font-semibold">
        {isEditing ? (
          <Input
            type="number"
            step="0.01"
            value={editedBalance}
            onChange={(e) => setEditedBalance(e.target.value)}
            className="h-7 text-xs text-right"
          />
        ) : (
          statement.balance ? formatCurrency(statement.balance) : '-'
        )}
      </div>
      
      {/* Account Type - editable (grouped by category) */}
      <div className="col-span-2">
        {isEditing ? (
          <Select value={editedAccountType} onValueChange={handleAccountTypeChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(accountTypesByCategory).map(([category, types]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                    {getDisplayName(category)}
                  </div>
                  {types.map((mapping) => (
                    <SelectItem key={mapping.accountType} value={mapping.accountType}>
                      {mapping.accountType}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className="text-xs font-medium">
              {statement.account_type || 'Unclassified'}
            </Badge>
            <span className="text-[9px] text-gray-400">
              → {getDisplayName(statement.category || 'unassigned')}
            </span>
          </div>
        )}
      </div>
      
      {/* Matched - editable checkbox */}
      <div className="col-span-1 text-center">
        {isEditing ? (
          <input
            type="checkbox"
            checked={editedIsMatched}
            onChange={(e) => setEditedIsMatched(e.target.checked)}
            className="h-4 w-4"
          />
        ) : (
          statement.is_matched ? (
            <Badge className="bg-green-100 text-green-800 text-xs">✓</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">-</Badge>
          )
        )}
      </div>
      
      {/* Notes - editable */}
      <div className="col-span-2">
        {isEditing ? (
          <Input
            type="text"
            value={editedNotes}
            onChange={(e) => setEditedNotes(e.target.value)}
            placeholder="Add notes..."
            className="h-7 text-xs"
          />
        ) : (
          <div className="truncate text-xs" title={statement.notes || ''}>
            {statement.notes || '-'}
          </div>
        )}
      </div>
      
      {/* Action buttons */}
      <div className="col-span-1 text-center">
        {isEditing ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSave}
              disabled={isSaving}
              className="h-6 w-6 p-0"
            >
              {isSaving ? '...' : '✓'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSaving}
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-6 w-6 p-0"
          >
            ✏️
          </Button>
        )}
      </div>
    </div>
  );
}

// Bank Statements View Component  
function BankStatementsView({
  statements,
  onUpdate,
  onSummaryUpdate,
}: {
  statements: BankStatement[];
  onUpdate: () => void;
  onSummaryUpdate: () => void;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
      <Card>
        <CardHeader>
        <CardTitle>Bank Statements ({statements.length})</CardTitle>
        </CardHeader>
        <CardContent>
        {statements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Upload className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p>No bank statements uploaded yet</p>
            <p className="text-sm mt-2">Click "Upload Bank CSV" to import statements</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-13 gap-2 p-3 bg-gray-50 rounded font-semibold text-xs">
              <div className="col-span-1">Date</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1 text-right">Debit</div>
              <div className="col-span-1 text-right">Credit</div>
              <div className="col-span-1 text-right">Balance</div>
              <div className="col-span-2">Account Type → Category</div>
              <div className="col-span-1 text-center">Matched</div>
              <div className="col-span-2">Notes</div>
              <div className="col-span-1 text-center">Actions</div>
            </div>
            {statements.map((stmt) => (
              <BankStatementRow 
                key={stmt.id} 
                statement={stmt}
                onUpdate={onUpdate}
                onSummaryUpdate={onSummaryUpdate}
              />
            ))}
            </div>
          )}
        </CardContent>
      </Card>
  );
}
