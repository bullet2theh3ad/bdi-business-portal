'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingDown, Calendar, Search, ArrowUpDown, Eye, EyeOff, Download, Upload, Plus, Copy, Trash2, Save, ChevronDown, ChevronUp, Package, Zap } from 'lucide-react';

// Interfaces
interface MustPayItem {
  id: string;
  weekStart: string;
  category: 'labor' | 'opex' | 'r&d' | 'marketing' | 'cert' | 'other';
  description: string;
  amount: number;
  sourceType?: string;
  sourceReference?: string;
}

interface FundingRequest {
  id: string;
  weekStart: string;
  fundingType: 'lt_notes_payable' | 'st_notes_payable' | 'other';
  description: string;
  amount: number;
  isCalculated?: boolean;
}

interface NonOpDisbursement {
  id: string;
  weekStart: string;
  disbursementType: 'notes_repayment' | 'interest_payments' | 'distributions' | 'other';
  description: string;
  amount: number;
  sourceReference?: string;
}

interface OperatingReceipt {
  id: string;
  weekStart: string;
  receiptType: 'ar_aging' | 'ar_forecast' | 'other';
  description: string;
  amount: number;
  sourceReference?: string;
}

interface BankAccountEntry {
  id: string;
  weekStart: string;
  entryType: 'beginning_balance' | 'bank_reconciliation' | 'other';
  description: string;
  amount: number;
  notes?: string;
}

interface BankBalance {
  id: string;
  weekStart: string;
  beginningBalance: number;
  outstandingChecks: number;
  notes?: string;
}

interface WeeklyAggregate {
  weekStart: string;
  weekEnd: string;
  nreTotal: number;
  inventoryTotal: number;
  mustPayTotal: number;
  fundingTotal: number;
  nonOpTotal: number;
  operatingOutflows: number; // NRE + Inventory + Must Pays
  netCashFlow: number; // -Operating + Funding - NonOp
  total: number; // For chart display (operating outflows)
}

// Helper function to get Monday of the week for any date (PST)
const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = (day + 6) % 7; // Days to subtract to get to Monday
  d.setDate(d.getDate() - diff);
  return d;
};

export default function CashFlowRunwayPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Data state
  const [nrePayments, setNrePayments] = useState<any[]>([]);
  const [inventoryPayments, setInventoryPayments] = useState<any[]>([]);
  const [mustPayItems, setMustPayItems] = useState<MustPayItem[]>([]);
  const [operatingReceipts, setOperatingReceipts] = useState<OperatingReceipt[]>([]);
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);
  const [nonOpDisbursements, setNonOpDisbursements] = useState<NonOpDisbursement[]>([]);
  const [bankAccountEntries, setBankAccountEntries] = useState<BankAccountEntry[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);
  
  // GL Labor data state
  const [glLaborData, setGlLaborData] = useState<any[]>([]);
  const [showGlLabor, setShowGlLabor] = useState<boolean>(false);
  const [isLoadingGlLabor, setIsLoadingGlLabor] = useState<boolean>(false);
  
  // GL Revenue data state
  const [glRevenueData, setGlRevenueData] = useState<any[]>([]);
  const [showGlRevenue, setShowGlRevenue] = useState<boolean>(false);
  const [isLoadingGlRevenue, setIsLoadingGlRevenue] = useState<boolean>(false);
  
  const [glInventoryData, setGlInventoryData] = useState<any[]>([]);
  const [showGlInventory, setShowGlInventory] = useState<boolean>(false);
  const [isLoadingGlInventory, setIsLoadingGlInventory] = useState<boolean>(false);
  
  const [glNreData, setGlNreData] = useState<any[]>([]);
  const [showGlNre, setShowGlNre] = useState<boolean>(false);
  const [isLoadingGlNre, setIsLoadingGlNre] = useState<boolean>(false);
  
  const [glOpexData, setGlOpexData] = useState<any[]>([]);
  const [showGlOpex, setShowGlOpex] = useState<boolean>(false);
  const [isLoadingGlOpex, setIsLoadingGlOpex] = useState<boolean>(false);
  
  // Track collapsed sections per week: "receipts-2025-10-04", "operating-2025-10-04", etc.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Toggle section collapse
  const toggleSection = (sectionKey: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionKey)) {
        newSet.delete(sectionKey);
      } else {
        newSet.add(sectionKey);
      }
      return newSet;
    });
  };

  // UI state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'must-pays' | 'funding' | 'non-op'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [avgPeriodWeeks, setAvgPeriodWeeks] = useState<number>(13); // 3 months default
  const [showCurrentDateLine, setShowCurrentDateLine] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cash-flow-runway-show-current-date');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Hover state for tooltips
  const [hoveredWeek, setHoveredWeek] = useState<WeeklyAggregate | null>(null);
  const [hoveredAvg, setHoveredAvg] = useState<{ weekStart: string; average: number } | null>(null);

  // Organization ID
  const [organizationId, setOrganizationId] = useState<string>('');

  // Load user and organization
  useEffect(() => {
    const loadUserOrg = async () => {
      try {
        const userRes = await fetch('/api/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          // Organization ID is in the first organization
          const orgId = userData.organizations?.[0]?.organization?.id || userData.organizationId;
          console.log('🔍 Organization ID:', orgId);
          setOrganizationId(orgId);
        }
      } catch (error) {
        console.error('Failed to load user organization:', error);
      }
    };
    loadUserOrg();
  }, []);

  // Load all data
  useEffect(() => {
    if (organizationId) {
      loadAllData();
    }
  }, [organizationId]);

  // Set default 13-week range (-4 weeks to +16 weeks from today)
  useEffect(() => {
    const today = new Date();
    const mondayThisWeek = getMondayOfWeek(today);
    
    // Start: Monday of current week - 4 weeks
    const start = new Date(mondayThisWeek);
    start.setDate(start.getDate() - (4 * 7));
    
    // End: Monday of current week + 16 weeks + 6 days (to get to end of that week)
    const end = new Date(mondayThisWeek);
    end.setDate(end.getDate() + (16 * 7) + 6);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  const loadAllData = async () => {
    try {
      console.log('🚀 Loading all cash flow data for org:', organizationId);
      setIsLoading(true);

      // Load NRE
      console.log('📊 Fetching NRE data...');
      const nreRes = await fetch('/api/admin/nre-budget');
      if (nreRes.ok) {
        const nreData = await nreRes.json();
        const nrePaymentsList: any[] = [];
        nreData.forEach((budget: any) => {
          budget.paymentLineItems?.forEach((payment: any) => {
            nrePaymentsList.push({
              date: payment.paymentDate,
              amount: parseFloat(payment.amount) || 0,
            });
          });
        });
        setNrePayments(nrePaymentsList);
      }

      // Load Inventory
      const invRes = await fetch('/api/inventory-payments');
      if (invRes.ok) {
        const invData = await invRes.json();
        const invPaymentsList: any[] = [];
        invData.forEach((plan: any) => {
          plan.lineItems?.forEach((item: any) => {
            invPaymentsList.push({
              date: item.paymentDate,
              amount: parseFloat(item.amount) || 0,
            });
          });
        });
        setInventoryPayments(invPaymentsList);
      }

      // Load Must Pays
      console.log('💰 Fetching Must Pays...');
      const mustPayRes = await fetch(`/api/cash-flow/must-pays?organizationId=${organizationId}`);
      console.log('💰 Must Pays response:', mustPayRes.status, mustPayRes.ok);
      if (mustPayRes.ok) {
        const mustPayData = await mustPayRes.json();
        console.log('💰 Must Pays data:', mustPayData);
        setMustPayItems(mustPayData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          category: item.category,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          sourceType: item.sourceType || item.source_type,
          sourceReference: item.sourceReference || item.source_reference,
        })));
      }

      // Load Funding Requests
      const fundingRes = await fetch(`/api/cash-flow/funding-requests?organizationId=${organizationId}`);
      if (fundingRes.ok) {
        const fundingData = await fundingRes.json();
        setFundingRequests(fundingData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          fundingType: item.fundingType || item.funding_type,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          isCalculated: item.isCalculated || item.is_calculated,
        })));
      }

      // Load Non-Op Disbursements
      const nonOpRes = await fetch(`/api/cash-flow/non-operating-disbursements?organizationId=${organizationId}`);
      if (nonOpRes.ok) {
        const nonOpData = await nonOpRes.json();
        setNonOpDisbursements(nonOpData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          disbursementType: item.disbursementType || item.disbursement_type,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          sourceReference: item.sourceReference || item.source_reference,
        })));
      }

      // Load Operating Receipts
      const receiptsRes = await fetch(`/api/cash-flow/operating-receipts?organizationId=${organizationId}`);
      if (receiptsRes.ok) {
        const receiptsData = await receiptsRes.json();
        setOperatingReceipts(receiptsData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          receiptType: item.receiptType || item.receipt_type,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          sourceReference: item.sourceReference || item.source_reference,
        })));
      }

      // Load Bank Account Entries
      const bankAccountsRes = await fetch(`/api/cash-flow/bank-accounts?organizationId=${organizationId}`);
      if (bankAccountsRes.ok) {
        const bankAccountsData = await bankAccountsRes.json();
        setBankAccountEntries(bankAccountsData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          entryType: item.entryType || item.entry_type,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          notes: item.notes,
        })));
      }

      console.log('✅ All data loaded successfully');
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error loading data:', error);
      setIsLoading(false);
    }
  };

  // Calculate weekly aggregates
  const getWeeklyData = (): WeeklyAggregate[] => {
    if (!startDate || !endDate) return [];

    const weeks: WeeklyAggregate[] = [];
    const start = getMondayOfWeek(new Date(startDate)); // Align to Monday
    const end = new Date(endDate);
    let currentWeekStart = new Date(start);

    while (currentWeekStart <= end) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Monday + 6 days = Sunday

      const weekStartStr = currentWeekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // NRE total
      const nreTotal = nrePayments
        .filter(p => p.date >= weekStartStr && p.date <= weekEndStr)
        .reduce((sum, p) => sum + p.amount, 0);

      // Inventory total
      const inventoryTotal = inventoryPayments
        .filter(p => p.date >= weekStartStr && p.date <= weekEndStr)
        .reduce((sum, p) => sum + p.amount, 0);

      // Operating total
      const mustPayTotal = mustPayItems
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);

      // Funding total
      const fundingTotal = fundingRequests
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);

      // Non-Op total
      const nonOpTotal = nonOpDisbursements
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);

      const operatingOutflows = nreTotal + inventoryTotal + mustPayTotal;
      const netCashFlow = -operatingOutflows + fundingTotal - nonOpTotal;

      weeks.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        nreTotal,
        inventoryTotal,
        mustPayTotal,
        fundingTotal,
        nonOpTotal,
        operatingOutflows,
        netCashFlow,
        total: operatingOutflows, // For chart display
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return sortOrder === 'desc' ? weeks.reverse() : weeks;
  };

  const weeklyData = getWeeklyData();
  
  // DEBUG: Show what's available
  console.log('\n🔍 [Page Render] Operating Receipts:', operatingReceipts.length);
  console.log('   AR Forecast receipts:', operatingReceipts.filter(r => r.receiptType === 'ar_forecast'));
  console.log('   All receipt types:', [...new Set(operatingReceipts.map(r => r.receiptType))]);
  console.log('   Week starts in receipts:', [...new Set(operatingReceipts.map(r => r.weekStart))].sort());
  console.log('   Week starts in weeklyData:', weeklyData.slice(0, 4).map(w => w.weekStart));
  
  const peakWeek = Math.max(...weeklyData.map(w => w.total), 0);
  const totalOutflows = weeklyData.reduce((sum, w) => sum + w.operatingOutflows, 0);
  const totalFunding = weeklyData.reduce((sum, w) => sum + w.fundingTotal, 0);
  const totalNonOp = weeklyData.reduce((sum, w) => sum + w.nonOpTotal, 0);
  const avgWeekly = weeklyData.length > 0 ? totalOutflows / weeklyData.length : 0;
  const overallAvg = avgWeekly;

  // Calculate trailing averages
  const trailingAverages = weeklyData.map((week, index) => {
    const startIndex = Math.max(0, index - avgPeriodWeeks + 1);
    const relevantWeeks = weeklyData.slice(startIndex, index + 1);
    const average = relevantWeeks.reduce((sum, w) => sum + w.total, 0) / relevantWeeks.length;
    
    // Determine color based on burn rate vs overall average
    const burnRate = overallAvg > 0 ? (average / overallAvg) : 1;
    let color = '#10b981'; // Green (low burn, < 100%)
    if (burnRate >= 1.3) {
      color = '#ef4444'; // Red (high burn, >= 130%)
    } else if (burnRate >= 1.0) {
      color = '#f59e0b'; // Orange/Yellow (medium burn, 100-130%)
    }

    return {
      weekStart: week.weekStart,
      average,
      color,
    };
  });

  // Set 13-week view (-4 weeks to +16 weeks from today = 20 weeks total)
  const set13WeekView = () => {
    const today = new Date();
    const mondayThisWeek = getMondayOfWeek(today);
    
    // Start: Monday of current week - 4 weeks
    const start = new Date(mondayThisWeek);
    start.setDate(start.getDate() - (4 * 7));
    
    // End: Monday of current week + 16 weeks + 6 days (to get to end of that week)
    const end = new Date(mondayThisWeek);
    end.setDate(end.getDate() + (16 * 7) + 6);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Reset to all data
  const resetToAll = () => {
    const allDates = [
      ...nrePayments.map(p => p.date),
      ...inventoryPayments.map(p => p.date),
      ...mustPayItems.map(p => p.weekStart),
    ].filter(Boolean).sort();

    if (allDates.length > 0) {
      setStartDate(allDates[0]);
      setEndDate(allDates[allDates.length - 1]);
    }
  };

  // Load GL Labor Data
  const loadGlLaborData = async () => {
    try {
      setIsLoadingGlLabor(true);
      console.log('💼 Loading GL Labor data...');
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gl-management/weekly-labor?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Failed to load GL Labor data:', error);
        alert(`Failed to load GL Labor data: ${error.error || 'Unknown error'}`);
        return;
      }
      
      const result = await response.json();
      console.log('✅ GL Labor data loaded:', result.summary);
      setGlLaborData(result.data || []);
      setShowGlLabor(true);
    } catch (error) {
      console.error('❌ Error loading GL Labor data:', error);
      alert('Error loading GL Labor data. Check console for details.');
    } finally {
      setIsLoadingGlLabor(false);
    }
  };

  // Sync GL Labor data to Must Pay entries
  const syncGlLaborToMustPay = async () => {
    if (glLaborData.length === 0) {
      alert('Please load GL Labor data first');
      return;
    }

    if (!organizationId) {
      alert('Organization ID not available');
      return;
    }

    const confirmation = confirm(
      `This will create or update ${glLaborData.length} Labor entries in Must Pay based on GL data. Continue?`
    );
    
    if (!confirmation) return;

    try {
      setIsLoadingGlLabor(true);
      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const weekData of glLaborData) {
        // Check if a must-pay entry already exists for this week
        const existingEntry = mustPayItems.find(
          item => item.weekStart === weekData.weekStart && item.category === 'labor'
        );

        const laborAmount = Math.round(weekData.totalAmount);
        const description = `Labor (GL Synced): Payroll $${Math.round(weekData.breakdown.payroll).toLocaleString()}, Taxes $${Math.round(weekData.breakdown.payrollTaxes).toLocaleString()}, Benefits $${Math.round(weekData.breakdown.benefits).toLocaleString()}, Charges $${Math.round(weekData.breakdown.payrollCharges).toLocaleString()}`;

        if (existingEntry) {
          // Update existing entry
          try {
            const response = await fetch('/api/cash-flow/must-pays', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: existingEntry.id,
                weekStart: weekData.weekStart,
                category: 'labor',
                description,
                amount: laborAmount,
                sourceType: 'gl_labor',
                sourceReference: `GL Labor sync on ${new Date().toISOString()}`,
              }),
            });

            if (response.ok) {
              updated++;
              console.log(`✅ Updated labor for week ${weekData.weekStart}`);
            } else {
              failed++;
              console.error(`❌ Failed to update week ${weekData.weekStart}`);
            }
          } catch (error) {
            failed++;
            console.error(`❌ Error updating week ${weekData.weekStart}:`, error);
          }
        } else {
          // Create new entry
          try {
            const response = await fetch('/api/cash-flow/must-pays', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                weekStart: weekData.weekStart,
                category: 'labor',
                description,
                amount: laborAmount,
                organizationId,
                sourceType: 'gl_labor',
                sourceReference: `GL Labor sync on ${new Date().toISOString()}`,
              }),
            });

            if (response.ok) {
              created++;
              console.log(`✅ Created labor for week ${weekData.weekStart}`);
            } else {
              failed++;
              console.error(`❌ Failed to create week ${weekData.weekStart}`);
            }
          } catch (error) {
            failed++;
            console.error(`❌ Error creating week ${weekData.weekStart}:`, error);
          }
        }
      }

      // Reload must-pays to show updates
      await loadAllData();

      alert(
        `Sync complete!\n\nCreated: ${created}\nUpdated: ${updated}\nFailed: ${failed}\n\nTotal: ${glLaborData.length}`
      );
    } catch (error) {
      console.error('❌ Error syncing GL Labor to Must Pay:', error);
      alert('Error syncing data. Check console for details.');
    } finally {
      setIsLoadingGlLabor(false);
    }
  };

  // Load GL Revenue Data
  const loadGlRevenueData = async () => {
    try {
      setIsLoadingGlRevenue(true);
      console.log('💰 Loading GL Revenue data...');
      
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/gl-management/weekly-revenue?${params.toString()}`);
      
      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Failed to load GL Revenue data:', error);
        alert(`Failed to load GL Revenue data: ${error.error || 'Unknown error'}`);
        return;
      }
      
      const result = await response.json();
      console.log('✅ GL Revenue data loaded:', result.summary);
      setGlRevenueData(result.data || []);
      setShowGlRevenue(true);
    } catch (error) {
      console.error('❌ Error loading GL Revenue data:', error);
      alert('Error loading GL Revenue data. Check console for details.');
    } finally {
      setIsLoadingGlRevenue(false);
    }
  };

  // Sync GL Revenue data to Operating Receipts
  const syncGlRevenueToReceipts = async () => {
    if (glRevenueData.length === 0) {
      alert('Please load GL Revenue data first');
      return;
    }

    if (!organizationId) {
      alert('Organization ID not available');
      return;
    }

    // DEBUG: Show what weeks we're trying to sync
    console.log('\n🔍 [Sync Debug] GL Revenue weeks to sync:', glRevenueData.map(w => w.weekStart));
    console.log('🔍 [Sync Debug] Current Operating Receipts weeks:', operatingReceipts.map(r => r.weekStart));
    console.log('🔍 [Sync Debug] Cash Flow weeklyData weeks:', getWeeklyData().map(w => w.weekStart));

    const confirmation = confirm(
      `This will create or update ${glRevenueData.length} Revenue entries in Operating Receipts based on GL data. Continue?`
    );
    
    if (!confirmation) return;

    try {
      setIsLoadingGlRevenue(true);
      let created = 0;
      let updated = 0;
      let failed = 0;

      for (const weekData of glRevenueData) {
        console.log(`\n📅 [Sync] Processing week ${weekData.weekStart}...`);
        
        // Check if an operating receipt entry already exists for this week (AR forecast type)
        const existingEntry = operatingReceipts.find(
          item => item.weekStart === weekData.weekStart && item.receiptType === 'ar_forecast'
        );
        
        console.log(`   ${existingEntry ? '✏️ Found existing entry' : '➕ Will create new entry'} for ${weekData.weekStart}`);

        const revenueAmount = Math.round(weekData.totalAmount);
        const description = `Revenue (GL Synced): D2C $${Math.round(weekData.breakdown.d2c).toLocaleString()}, B2B $${Math.round(weekData.breakdown.b2b).toLocaleString()}, B2B (factored) $${Math.round(weekData.breakdown.b2b_factored).toLocaleString()}`;

        if (existingEntry) {
          // Update existing entry
          try {
            const payload = {
              id: existingEntry.id,
              weekStart: weekData.weekStart,
              receiptType: 'ar_forecast',
              description,
              amount: revenueAmount,
              sourceReference: `GL Revenue sync on ${new Date().toISOString()}`,
            };
            console.log(`   📝 Updating with:`, payload);
            
            const response = await fetch('/api/cash-flow/operating-receipts', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              updated++;
              console.log(`   ✅ Successfully updated revenue for week ${weekData.weekStart}`);
            } else {
              const errorText = await response.text();
              failed++;
              console.error(`   ❌ Failed to update week ${weekData.weekStart}:`, response.status, errorText);
            }
          } catch (error) {
            failed++;
            console.error(`   ❌ Error updating week ${weekData.weekStart}:`, error);
          }
        } else {
          // Create new entry
          try {
            const payload = {
              weekStart: weekData.weekStart,
              receiptType: 'ar_forecast',
              description,
              amount: revenueAmount,
              organizationId,
              sourceReference: `GL Revenue sync on ${new Date().toISOString()}`,
            };
            console.log(`   📝 Creating with:`, payload);
            
            const response = await fetch('/api/cash-flow/operating-receipts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (response.ok) {
              created++;
              console.log(`   ✅ Successfully created revenue for week ${weekData.weekStart}`);
            } else {
              const errorText = await response.text();
              failed++;
              console.error(`   ❌ Failed to create week ${weekData.weekStart}:`, response.status, errorText);
            }
          } catch (error) {
            failed++;
            console.error(`❌ Error creating week ${weekData.weekStart}:`, error);
          }
        }
      }

      // Reload operating receipts to show updates
      console.log('\n🔄 [Sync] Reloading all data...');
      await loadAllData();
      console.log('✅ [Sync] Data reloaded. Check "Total Incoming Cash" row in Weekly Cash Flow Summary.');

      alert(
        `Sync complete!\n\nCreated: ${created}\nUpdated: ${updated}\nFailed: ${failed}\n\nTotal: ${glRevenueData.length}\n\nCheck the "Total Incoming Cash" row!`
      );
    } catch (error) {
      console.error('❌ Error syncing GL Revenue to Operating Receipts:', error);
      alert('Error syncing data. Check console for details.');
    } finally {
      setIsLoadingGlRevenue(false);
    }
  };

  // Export GL Labor to CSV
  const exportGlLaborToCSV = () => {
    const headers = ['Week Start', 'Week End', 'Total Amount', 'Transaction Count', 'Payroll', 'Payroll Taxes', 'Benefits', 'Payroll Charges'];
    const rows = glLaborData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.totalAmount.toFixed(2),
      week.transactionCount,
      week.breakdown.payroll.toFixed(2),
      week.breakdown.payrollTaxes.toFixed(2),
      week.breakdown.benefits.toFixed(2),
      week.breakdown.payrollCharges.toFixed(2),
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gl-labor-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export GL Revenue to CSV
  const exportGlRevenueToCSV = () => {
    const headers = ['Week Start', 'Week End', 'Total Amount', 'Transaction Count', 'D2C', 'B2B', 'B2B (factored)'];
    const rows = glRevenueData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.totalAmount.toFixed(2),
      week.transactionCount,
      week.breakdown.d2c.toFixed(2),
      week.breakdown.b2b.toFixed(2),
      week.breakdown.b2b_factored.toFixed(2),
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gl-revenue-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Load GL Inventory data
  const loadGlInventoryData = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    try {
      setIsLoadingGlInventory(true);
      const response = await fetch(
        `/api/gl-management/weekly-inventory?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) {
        throw new Error('Failed to load GL Inventory data');
      }
      const data = await response.json();
      setGlInventoryData(data.weeklyData || []);
      setShowGlInventory(true);
    } catch (error) {
      console.error('Error loading GL Inventory:', error);
      alert('Failed to load GL Inventory data');
    } finally {
      setIsLoadingGlInventory(false);
    }
  };

  // Export GL Inventory to CSV
  const exportGlInventoryToCSV = () => {
    const headers = ['Week Start', 'Week End', 'Total Amount', 'Transaction Count', 'Finished Goods', 'Components', 'Freight In', 'RTV', 'Other'];
    const rows = glInventoryData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.totalAmount.toFixed(2),
      week.transactionCount,
      week.breakdown.finishedGoods.toFixed(2),
      week.breakdown.components.toFixed(2),
      week.breakdown.freightIn.toFixed(2),
      week.breakdown.rtv.toFixed(2),
      week.breakdown.other.toFixed(2),
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gl-inventory-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Load GL NRE data
  const loadGlNreData = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    try {
      setIsLoadingGlNre(true);
      const response = await fetch(
        `/api/gl-management/weekly-nre?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) {
        throw new Error('Failed to load GL NRE data');
      }
      const data = await response.json();
      setGlNreData(data.weeklyData || []);
      setShowGlNre(true);
    } catch (error) {
      console.error('Error loading GL NRE:', error);
      alert('Failed to load GL NRE data');
    } finally {
      setIsLoadingGlNre(false);
    }
  };

  // Export GL NRE to CSV
  const exportGlNreToCSV = () => {
    const headers = ['Week Start', 'Week End', 'Total Amount', 'Transaction Count', 'DevOps', 'Firmware Development', 'Certifications', 'Design', 'Other'];
    const rows = glNreData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.totalAmount.toFixed(2),
      week.transactionCount,
      week.breakdown.devOps.toFixed(2),
      week.breakdown.firmwareDevelopment.toFixed(2),
      week.breakdown.certifications.toFixed(2),
      week.breakdown.design.toFixed(2),
      week.breakdown.other.toFixed(2),
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gl-nre-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Load GL OpEx data
  const loadGlOpexData = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    try {
      setIsLoadingGlOpex(true);
      const response = await fetch(
        `/api/gl-management/weekly-opex?startDate=${startDate}&endDate=${endDate}`
      );
      if (!response.ok) {
        throw new Error('Failed to load GL OpEx data');
      }
      const data = await response.json();
      setGlOpexData(data.weeklyData || []);
      setShowGlOpex(true);
    } catch (error) {
      console.error('Error loading GL OpEx:', error);
      alert('Failed to load GL OpEx data');
    } finally {
      setIsLoadingGlOpex(false);
    }
  };

  // Export GL OpEx to CSV
  const exportGlOpexToCSV = () => {
    const headers = ['Week Start', 'Week End', 'Total Amount', 'Transaction Count', 'Contract Labor', 'Consulting Services', 'Travel', 'Software', 'Other'];
    const rows = glOpexData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.totalAmount.toFixed(2),
      week.transactionCount,
      week.breakdown.contractLabor.toFixed(2),
      week.breakdown.consultingServices.toFixed(2),
      week.breakdown.travel.toFixed(2),
      week.breakdown.software.toFixed(2),
      week.breakdown.other.toFixed(2),
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `gl-opex-data-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Week Start',
      'Week End',
      'NRE Total',
      'Inventory Total',
      'Operating Total',
      'Total Operating Outflows',
      'Funding Requests',
      'Non-Op Disbursements',
      'Net Cash Flow',
    ];

    const rows = weeklyData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.nreTotal.toFixed(2),
      week.inventoryTotal.toFixed(2),
      week.mustPayTotal.toFixed(2),
      week.operatingOutflows.toFixed(2),
      week.fundingTotal.toFixed(2),
      week.nonOpTotal.toFixed(2),
      week.netCashFlow.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cash-flow-runway-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Chart to PNG
  const exportChartToPNG = async () => {
    if (!chartRef.current) return;

    try {
      // @ts-ignore - dom-to-image doesn't have TypeScript definitions
      const { default: domtoimage } = await import('dom-to-image');
      const dataUrl = await domtoimage.toPng(chartRef.current);
      const link = document.createElement('a');
      link.download = `cash-flow-runway-chart-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to export chart:', error);
      alert('Failed to export chart as PNG');
    }
  };

  // Toggle current date line
  const toggleCurrentDateLine = () => {
    const newValue = !showCurrentDateLine;
    setShowCurrentDateLine(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cash-flow-runway-show-current-date', String(newValue));
    }
  };

  // Save Must Pay item
  const saveMustPayItem = async (item: MustPayItem) => {
    try {
      const isNew = item.id.startsWith('mustpay-temp-');
      const url = '/api/cash-flow/must-pays';
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save must pay item');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving must pay item:', error);
      alert('Failed to save must pay item');
      return false;
    }
  };

  // Delete Must Pay item
  const deleteMustPayItem = async (id: string) => {
    if (!id || id.startsWith('mustpay-temp-')) {
      // Just remove from local state if it's temporary
      setMustPayItems(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/must-pays?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete must pay item');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting must pay item:', error);
      alert('Failed to delete must pay item');
    }
  };

  // Add new Must Pay item
  const addMustPayItem = (weekStart: string) => {
    const newItem: MustPayItem = {
      id: `mustpay-temp-${Date.now()}`,
      weekStart,
      category: 'labor',
      description: '',
      amount: 0,
    };
    setMustPayItems([...mustPayItems, newItem]);
  };

  // Update Must Pay item
  const updateMustPayItem = (id: string, field: keyof MustPayItem, value: any) => {
    setMustPayItems(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Copy week's Must Pay items to next week
  const copyToNextWeek = (weekStart: string) => {
    const weekItems = mustPayItems.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `mustpay-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setMustPayItems([...mustPayItems, ...copiedItems]);
  };

  // Funding Request CRUD functions
  const saveFundingRequest = async (item: FundingRequest) => {
    try {
      const isNew = item.id.startsWith('funding-temp-');
      const url = '/api/cash-flow/funding-requests';
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save funding request');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving funding request:', error);
      alert('Failed to save funding request');
      return false;
    }
  };

  const deleteFundingRequest = async (id: string) => {
    if (!id || id.startsWith('funding-temp-')) {
      setFundingRequests(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/funding-requests?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete funding request');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting funding request:', error);
      alert('Failed to delete funding request');
    }
  };

  const addFundingRequest = (weekStart: string) => {
    const newItem: FundingRequest = {
      id: `funding-temp-${Date.now()}`,
      weekStart,
      fundingType: 'lt_notes_payable',
      description: '',
      amount: 0,
    };
    setFundingRequests([...fundingRequests, newItem]);
  };

  const updateFundingRequest = (id: string, field: keyof FundingRequest, value: any) => {
    setFundingRequests(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const copyFundingToNextWeek = (weekStart: string) => {
    const weekItems = fundingRequests.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `funding-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setFundingRequests([...fundingRequests, ...copiedItems]);
  };

  // Non-Operating Disbursements CRUD functions
  const saveNonOpDisbursement = async (item: NonOpDisbursement) => {
    try {
      const isNew = item.id.startsWith('nonop-temp-');
      const url = '/api/cash-flow/non-operating-disbursements';
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save cash disbursement');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving cash disbursement:', error);
      alert('Failed to save cash disbursement');
      return false;
    }
  };

  const deleteNonOpDisbursement = async (id: string) => {
    if (!id || id.startsWith('nonop-temp-')) {
      setNonOpDisbursements(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/non-operating-disbursements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete cash disbursement');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting cash disbursement:', error);
      alert('Failed to delete cash disbursement');
    }
  };

  const addNonOpDisbursement = (weekStart: string) => {
    const newItem: NonOpDisbursement = {
      id: `nonop-temp-${Date.now()}`,
      weekStart,
      disbursementType: 'notes_repayment',
      description: '',
      amount: 0,
    };
    setNonOpDisbursements([...nonOpDisbursements, newItem]);
  };

  const updateNonOpDisbursement = (id: string, field: keyof NonOpDisbursement, value: any) => {
    setNonOpDisbursements(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const copyNonOpToNextWeek = (weekStart: string) => {
    const weekItems = nonOpDisbursements.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `nonop-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setNonOpDisbursements([...nonOpDisbursements, ...copiedItems]);
  };

  // Operating Receipts CRUD functions
  const saveOperatingReceipt = async (item: OperatingReceipt) => {
    try {
      const isNew = item.id.startsWith('receipt-temp-');
      const url = '/api/cash-flow/operating-receipts';
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save operating receipt');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving operating receipt:', error);
      alert('Failed to save operating receipt');
      return false;
    }
  };

  const deleteOperatingReceipt = async (id: string) => {
    if (!id || id.startsWith('receipt-temp-')) {
      setOperatingReceipts(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/operating-receipts?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete operating receipt');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting operating receipt:', error);
      alert('Failed to delete operating receipt');
    }
  };

  const addOperatingReceipt = (weekStart: string) => {
    const newItem: OperatingReceipt = {
      id: `receipt-temp-${Date.now()}`,
      weekStart,
      receiptType: 'ar_aging',
      description: '',
      amount: 0,
    };
    setOperatingReceipts([...operatingReceipts, newItem]);
  };

  const updateOperatingReceipt = (id: string, field: keyof OperatingReceipt, value: any) => {
    setOperatingReceipts(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const copyReceiptsToNextWeek = (weekStart: string) => {
    const weekItems = operatingReceipts.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `receipt-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setOperatingReceipts([...operatingReceipts, ...copiedItems]);
  };

  // Bank Account Entries CRUD functions
  const saveBankAccountEntry = async (item: BankAccountEntry) => {
    try {
      const isNew = item.id.startsWith('bank-temp-');
      const url = '/api/cash-flow/bank-accounts';
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save bank account entry');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving bank account entry:', error);
      alert('Failed to save bank account entry');
      return false;
    }
  };

  const deleteBankAccountEntry = async (id: string) => {
    if (!id || id.startsWith('bank-temp-')) {
      setBankAccountEntries(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/bank-accounts?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete bank account entry');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting bank account entry:', error);
      alert('Failed to delete bank account entry');
    }
  };

  const addBankAccountEntry = (weekStart: string) => {
    const newItem: BankAccountEntry = {
      id: `bank-temp-${Date.now()}`,
      weekStart,
      entryType: 'beginning_balance',
      description: '',
      amount: 0,
    };
    setBankAccountEntries([...bankAccountEntries, newItem]);
  };

  const updateBankAccountEntry = (id: string, field: keyof BankAccountEntry, value: any) => {
    setBankAccountEntries(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const copyBankAccountsToNextWeek = (weekStart: string) => {
    const weekItems = bankAccountEntries.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `bank-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setBankAccountEntries([...bankAccountEntries, ...copiedItems]);
  };

  const categoryLabels = {
    labor: 'Labor',
    opex: 'OpEx',
    'r&d': 'R&D',
    marketing: 'Marketing',
    cert: 'Cert',
    other: 'Other',
  };

  const fundingTypeLabels = {
    'lt_notes_payable': 'TR Capital Funding (LT Notes Payable)',
    'st_notes_payable': 'TR Cashflow Funding (ST Notes Payable)',
    'other': 'Other Funding Request',
  };

  const disbursementTypeLabels = {
    'notes_repayment': 'TR Notes Repayment',
    'interest_payments': 'TR Interest Payments',
    'distributions': 'TR Distributions',
    'other': 'Other',
  };

  const receiptTypeLabels = {
    'ar_aging': 'Customer Cash Receipts (A/R Aging)',
    'ar_forecast': 'Customer Forecasted Receipts (A/R Forecast)',
    'other': 'Other',
  };

  const bankAccountEntryLabels = {
    'beginning_balance': 'Beginning Bank Balance',
    'bank_reconciliation': 'Bank Reconciliation',
    'other': 'Other',
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bdi-green-1"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Cash Flow Runway</h1>
        <p className="text-sm sm:text-base text-gray-600">
          13-week cash flow projections with NRE, Inventory, and Operating expenses
        </p>
      </div>

      {/* GL Labor Comparison Section */}
      <Card className="mb-6 border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-purple-600" />
              GL Labor Data Comparison
              {glLaborData.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({glLaborData.length} weeks loaded)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {showGlLabor && glLaborData.length > 0 && (
                <Button
                  onClick={() => setShowGlLabor(!showGlLabor)}
                  variant="outline"
                  size="sm"
                >
                  {showGlLabor ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showGlLabor ? 'Hide' : 'Show'}
                </Button>
              )}
              {glLaborData.length > 0 && (
                <>
                  <Button
                    onClick={exportGlLaborToCSV}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={syncGlLaborToMustPay}
                    disabled={isLoadingGlLabor}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Sync to Must Pay
                  </Button>
                </>
              )}
              <Button
                onClick={loadGlLaborData}
                disabled={isLoadingGlLabor || !startDate || !endDate}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoadingGlLabor ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Load GL Labor
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showGlLabor && glLaborData.length > 0 && (
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Compare your manually entered Labor costs with actual GL Labor data from QuickBooks and Bank Statements. 
              This shows payroll, taxes, benefits, and charges categorized in GL Code Assignment.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-purple-50">
                    <th className="text-left py-2 px-3 font-semibold">Week</th>
                    <th className="text-right py-2 px-3 font-semibold">GL Labor Total</th>
                    <th className="text-right py-2 px-3 font-semibold">Payroll</th>
                    <th className="text-right py-2 px-3 font-semibold">Payroll Taxes</th>
                    <th className="text-right py-2 px-3 font-semibold">Benefits</th>
                    <th className="text-right py-2 px-3 font-semibold">Charges</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700">Current Must Pay</th>
                    <th className="text-right py-2 px-3 font-semibold text-red-700">Difference</th>
                    <th className="text-right py-2 px-3 font-semibold">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {glLaborData.map((weekData: any) => {
                    // Find matching must pay labor items for this week
                    const mustPayLabor = mustPayItems
                      .filter(item => item.weekStart === weekData.weekStart && item.category === 'labor')
                      .reduce((sum, item) => sum + item.amount, 0);
                    
                    const difference = weekData.totalAmount - mustPayLabor;
                    const hasDifference = Math.abs(difference) > 1;
                    
                    return (
                      <tr key={weekData.weekStart} className={`border-b ${hasDifference ? 'bg-yellow-50' : ''}`}>
                        <td className="py-2 px-3">
                          <div className="font-medium">{new Date(weekData.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-gray-500">{new Date(weekData.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-purple-700">
                          ${Math.round(weekData.totalAmount).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.payroll).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.payrollTaxes).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.benefits).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.payrollCharges).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 font-semibold text-blue-700">
                          ${Math.round(mustPayLabor).toLocaleString()}
                        </td>
                        <td className={`text-right py-2 px-3 font-semibold ${hasDifference ? (difference > 0 ? 'text-red-700' : 'text-green-700') : 'text-gray-400'}`}>
                          {difference > 0 ? '+' : ''}{difference !== 0 ? `$${Math.round(difference).toLocaleString()}` : '✓'}
                        </td>
                        <td className="text-right py-2 px-3 text-xs text-gray-500">
                          {weekData.transactionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3">TOTAL</td>
                    <td className="text-right py-2 px-3 text-purple-700">
                      ${Math.round(glLaborData.reduce((sum: number, w: any) => sum + w.totalAmount, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glLaborData.reduce((sum: number, w: any) => sum + w.breakdown.payroll, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glLaborData.reduce((sum: number, w: any) => sum + w.breakdown.payrollTaxes, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glLaborData.reduce((sum: number, w: any) => sum + w.breakdown.benefits, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glLaborData.reduce((sum: number, w: any) => sum + w.breakdown.payrollCharges, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3 text-blue-700">
                      ${Math.round(
                        mustPayItems
                          .filter(item => item.category === 'labor' && glLaborData.some((w: any) => w.weekStart === item.weekStart))
                          .reduce((sum, item) => sum + item.amount, 0)
                      ).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      {(() => {
                        const glTotal = glLaborData.reduce((sum: number, w: any) => sum + w.totalAmount, 0);
                        const mustPayTotal = mustPayItems
                          .filter(item => item.category === 'labor' && glLaborData.some((w: any) => w.weekStart === item.weekStart))
                          .reduce((sum, item) => sum + item.amount, 0);
                        const diff = glTotal - mustPayTotal;
                        return (
                          <span className={diff > 0 ? 'text-red-700' : diff < 0 ? 'text-green-700' : 'text-gray-400'}>
                            {diff > 0 ? '+' : ''}${Math.round(diff).toLocaleString()}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="text-right py-2 px-3 text-xs">
                      {glLaborData.reduce((sum: number, w: any) => sum + w.transactionCount, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <p className="font-semibold text-blue-900 mb-1">💡 Next Steps:</p>
              <ul className="text-blue-800 space-y-1 ml-4">
                <li>• <span className="text-yellow-600 font-semibold">Yellow rows</span> show weeks where GL Labor differs from your Must Pay entries</li>
                <li>• <span className="text-red-600 font-semibold">Red difference</span> = GL Labor is higher (you may be under-budgeting)</li>
                <li>• <span className="text-green-600 font-semibold">Green difference</span> = GL Labor is lower (you may be over-budgeting)</li>
                <li>• Use this data to adjust your Must Pay entries or auto-populate from GL (coming soon!)</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* GL Revenue Comparison Section */}
      <Card className="mb-6 border-l-4 border-l-green-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
              GL Revenue Data Comparison
              {glRevenueData.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({glRevenueData.length} weeks loaded)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {showGlRevenue && glRevenueData.length > 0 && (
                <Button
                  onClick={() => setShowGlRevenue(!showGlRevenue)}
                  variant="outline"
                  size="sm"
                >
                  {showGlRevenue ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showGlRevenue ? 'Hide' : 'Show'}
                </Button>
              )}
              {glRevenueData.length > 0 && (
                <>
                  <Button
                    onClick={exportGlRevenueToCSV}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export CSV
                  </Button>
                  <Button
                    onClick={syncGlRevenueToReceipts}
                    disabled={isLoadingGlRevenue}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Sync to Receipts
                  </Button>
                </>
              )}
              <Button
                onClick={loadGlRevenueData}
                disabled={isLoadingGlRevenue || !startDate || !endDate}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoadingGlRevenue ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Load GL Revenue
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showGlRevenue && glRevenueData.length > 0 && (
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Compare your manually entered Revenue (Operating Receipts) with actual GL Revenue data from QuickBooks and Bank Statements. 
              This shows D2C, B2B, and B2B (factored) revenue categorized in GL Code Assignment.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-green-50">
                    <th className="text-left py-2 px-3 font-semibold">Week</th>
                    <th className="text-right py-2 px-3 font-semibold">GL Revenue Total</th>
                    <th className="text-right py-2 px-3 font-semibold">D2C</th>
                    <th className="text-right py-2 px-3 font-semibold">B2B</th>
                    <th className="text-right py-2 px-3 font-semibold">B2B (factored)</th>
                    <th className="text-right py-2 px-3 font-semibold text-blue-700">Current Receipts</th>
                    <th className="text-right py-2 px-3 font-semibold text-red-700">Difference</th>
                    <th className="text-right py-2 px-3 font-semibold">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {glRevenueData.map((weekData: any) => {
                    // Find matching operating receipt items for this week
                    const currentReceipts = operatingReceipts
                      .filter(item => item.weekStart === weekData.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    
                    const difference = weekData.totalAmount - currentReceipts;
                    const hasDifference = Math.abs(difference) > 1;
                    
                    return (
                      <tr key={weekData.weekStart} className={`border-b ${hasDifference ? 'bg-yellow-50' : ''}`}>
                        <td className="py-2 px-3">
                          <div className="font-medium">{new Date(weekData.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-gray-500">{new Date(weekData.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-green-700">
                          ${Math.round(weekData.totalAmount).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.d2c).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.b2b).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.b2b_factored).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 font-semibold text-blue-700">
                          ${Math.round(currentReceipts).toLocaleString()}
                        </td>
                        <td className={`text-right py-2 px-3 font-semibold ${hasDifference ? (difference > 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-400'}`}>
                          {difference > 0 ? '+' : ''}{difference !== 0 ? `$${Math.round(difference).toLocaleString()}` : '✓'}
                        </td>
                        <td className="text-right py-2 px-3 text-xs text-gray-500">
                          {weekData.transactionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3">TOTAL</td>
                    <td className="text-right py-2 px-3 text-green-700">
                      ${Math.round(glRevenueData.reduce((sum: number, w: any) => sum + w.totalAmount, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glRevenueData.reduce((sum: number, w: any) => sum + w.breakdown.d2c, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glRevenueData.reduce((sum: number, w: any) => sum + w.breakdown.b2b, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glRevenueData.reduce((sum: number, w: any) => sum + w.breakdown.b2b_factored, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3 text-blue-700">
                      ${Math.round(
                        operatingReceipts
                          .filter(item => glRevenueData.some((w: any) => w.weekStart === item.weekStart))
                          .reduce((sum, item) => sum + item.amount, 0)
                      ).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      {(() => {
                        const glTotal = glRevenueData.reduce((sum: number, w: any) => sum + w.totalAmount, 0);
                        const receiptsTotal = operatingReceipts
                          .filter(item => glRevenueData.some((w: any) => w.weekStart === item.weekStart))
                          .reduce((sum, item) => sum + item.amount, 0);
                        const diff = glTotal - receiptsTotal;
                        return (
                          <span className={diff > 0 ? 'text-green-700' : diff < 0 ? 'text-red-700' : 'text-gray-400'}>
                            {diff > 0 ? '+' : ''}${Math.round(diff).toLocaleString()}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="text-right py-2 px-3 text-xs">
                      {glRevenueData.reduce((sum: number, w: any) => sum + w.transactionCount, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <p className="font-semibold text-green-900 mb-1">💡 Next Steps:</p>
              <ul className="text-green-800 space-y-1 ml-4">
                <li>• <span className="text-yellow-600 font-semibold">Yellow rows</span> show weeks where GL Revenue differs from your Operating Receipts</li>
                <li>• <span className="text-green-600 font-semibold">Green difference</span> = GL Revenue is higher (more income than forecasted!)</li>
                <li>• <span className="text-red-600 font-semibold">Red difference</span> = GL Revenue is lower (less income than expected)</li>
                <li>• Use this data to adjust your Operating Receipts forecast or sync directly from GL</li>
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* GL Inventory Data Comparison - Orange themed */}
      <Card className="mb-6 border-2 border-orange-200">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-orange-900 flex items-center gap-2">
              <Package className="h-5 w-5" />
              GL Inventory Data Comparison
              {glInventoryData.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({glInventoryData.length} weeks loaded)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {showGlInventory && glInventoryData.length > 0 && (
                <Button
                  onClick={() => setShowGlInventory(!showGlInventory)}
                  variant="outline"
                  size="sm"
                >
                  {showGlInventory ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showGlInventory ? 'Hide' : 'Show'}
                </Button>
              )}
              {glInventoryData.length > 0 && (
                <Button
                  onClick={exportGlInventoryToCSV}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              )}
              <Button
                onClick={loadGlInventoryData}
                disabled={isLoadingGlInventory || !startDate || !endDate}
                size="sm"
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isLoadingGlInventory ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Load GL Inventory
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showGlInventory && glInventoryData.length > 0 && (
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              View inventory purchases categorized in GL Code Assignment by week. Breakdown includes Finished Goods, Components, Freight In, and RTV.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-orange-50">
                    <th className="text-left py-2 px-3 font-semibold">Week</th>
                    <th className="text-right py-2 px-3 font-semibold">Total Inventory</th>
                    <th className="text-right py-2 px-3 font-semibold">Finished Goods</th>
                    <th className="text-right py-2 px-3 font-semibold">Components</th>
                    <th className="text-right py-2 px-3 font-semibold">Freight In</th>
                    <th className="text-right py-2 px-3 font-semibold">RTV</th>
                    <th className="text-right py-2 px-3 font-semibold">Other</th>
                    <th className="text-right py-2 px-3 font-semibold">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {glInventoryData.map((weekData: any) => {
                    return (
                      <tr key={weekData.weekStart} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium">{new Date(weekData.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-gray-500">{new Date(weekData.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-orange-700">
                          ${Math.round(weekData.totalAmount).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.finishedGoods).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.components).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.freightIn).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.rtv).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.other).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-xs text-gray-500">
                          {weekData.transactionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3">TOTAL</td>
                    <td className="text-right py-2 px-3 text-orange-700">
                      ${Math.round(glInventoryData.reduce((sum: number, w: any) => sum + w.totalAmount, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glInventoryData.reduce((sum: number, w: any) => sum + w.breakdown.finishedGoods, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glInventoryData.reduce((sum: number, w: any) => sum + w.breakdown.components, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glInventoryData.reduce((sum: number, w: any) => sum + w.breakdown.freightIn, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glInventoryData.reduce((sum: number, w: any) => sum + w.breakdown.rtv, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glInventoryData.reduce((sum: number, w: any) => sum + w.breakdown.other, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3 text-xs text-gray-500">
                      {glInventoryData.reduce((sum: number, w: any) => sum + w.transactionCount, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* GL NRE Data Comparison - Blue themed */}
      <Card className="mb-6 border-2 border-blue-200">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-900 flex items-center gap-2">
              <Zap className="h-5 w-5" />
              GL NRE Data Comparison
              {glNreData.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({glNreData.length} weeks loaded)
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {showGlNre && glNreData.length > 0 && (
                <Button
                  onClick={() => setShowGlNre(!showGlNre)}
                  variant="outline"
                  size="sm"
                >
                  {showGlNre ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {showGlNre ? 'Hide' : 'Show'}
                </Button>
              )}
              {glNreData.length > 0 && (
                <Button
                  onClick={exportGlNreToCSV}
                  variant="outline"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              )}
              <Button
                onClick={loadGlNreData}
                disabled={isLoadingGlNre || !startDate || !endDate}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoadingGlNre ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-1" />
                    Load GL NRE
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showGlNre && glNreData.length > 0 && (
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              View Non-Recurring Engineering (NRE) expenses categorized in GL Code Assignment by week. Breakdown includes DevOps, Firmware Development, Certifications, and Design.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 bg-blue-50">
                    <th className="text-left py-2 px-3 font-semibold">Week</th>
                    <th className="text-right py-2 px-3 font-semibold">Total NRE</th>
                    <th className="text-right py-2 px-3 font-semibold">DevOps</th>
                    <th className="text-right py-2 px-3 font-semibold">Firmware Dev</th>
                    <th className="text-right py-2 px-3 font-semibold">Certifications</th>
                    <th className="text-right py-2 px-3 font-semibold">Design</th>
                    <th className="text-right py-2 px-3 font-semibold">Other</th>
                    <th className="text-right py-2 px-3 font-semibold">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {glNreData.map((weekData: any) => {
                    return (
                      <tr key={weekData.weekStart} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">
                          <div className="font-medium">{new Date(weekData.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-gray-500">{new Date(weekData.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-blue-700">
                          ${Math.round(weekData.totalAmount).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.devOps).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.firmwareDevelopment).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.certifications).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.design).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.other).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-xs text-gray-500">
                          {weekData.transactionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3">TOTAL</td>
                    <td className="text-right py-2 px-3 text-blue-700">
                      ${Math.round(glNreData.reduce((sum: number, w: any) => sum + w.totalAmount, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glNreData.reduce((sum: number, w: any) => sum + w.breakdown.devOps, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glNreData.reduce((sum: number, w: any) => sum + w.breakdown.firmwareDevelopment, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glNreData.reduce((sum: number, w: any) => sum + w.breakdown.certifications, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glNreData.reduce((sum: number, w: any) => sum + w.breakdown.design, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glNreData.reduce((sum: number, w: any) => sum + w.breakdown.other, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3 text-xs text-gray-500">
                      {glNreData.reduce((sum: number, w: any) => sum + w.transactionCount, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* GL OpEx Data Comparison (Purple Theme) */}
      <Card className="mb-6 border-purple-200">
        <CardHeader className="bg-purple-50 border-b border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <CardTitle className="text-purple-900">GL OpEx Data Comparison</CardTitle>
                <p className="text-xs text-purple-700 mt-1">
                  Operating Expenses from GL Code categorizations
                  {glOpexData.length > 0 && (
                    <span className="ml-2 font-semibold">
                      ({glOpexData.length} weeks loaded)
                    </span>
                  )}
                </p>
              </div>
              {showGlOpex && glOpexData.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGlOpex(false)}
                  className="text-purple-700 hover:bg-purple-100"
                >
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide
                </Button>
              )}
              {glOpexData.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportGlOpexToCSV}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
              )}
            </div>
            <Button
              onClick={loadGlOpexData}
              disabled={isLoadingGlOpex || !startDate || !endDate}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isLoadingGlOpex ? (
                <>Loading...</>
              ) : (
                <>Load GL OpEx</>
              )}
            </Button>
          </div>
        </CardHeader>
        {showGlOpex && glOpexData.length > 0 && (
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-purple-50 border-b border-purple-200">
                  <tr>
                    <th className="text-left py-2 px-3 text-purple-900 font-semibold">Week</th>
                    <th className="text-right py-2 px-3 text-purple-900 font-semibold">Total OpEx</th>
                    <th className="text-right py-2 px-3 text-gray-700">Contract Labor</th>
                    <th className="text-right py-2 px-3 text-gray-700">Consulting</th>
                    <th className="text-right py-2 px-3 text-gray-700">Travel</th>
                    <th className="text-right py-2 px-3 text-gray-700">Software</th>
                    <th className="text-right py-2 px-3 text-gray-700">Other</th>
                    <th className="text-right py-2 px-3 text-gray-500 text-xs">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {glOpexData.map((weekData: any) => {
                    return (
                      <tr key={weekData.weekStart} className="border-b border-gray-100 hover:bg-purple-50">
                        <td className="py-2 px-3">
                          <div className="font-medium">{new Date(weekData.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                          <div className="text-xs text-gray-500">{new Date(weekData.weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </td>
                        <td className="text-right py-2 px-3 font-bold text-purple-700">
                          ${Math.round(weekData.totalAmount).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.contractLabor).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.consultingServices).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.travel).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.software).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-gray-700">
                          ${Math.round(weekData.breakdown.other).toLocaleString()}
                        </td>
                        <td className="text-right py-2 px-3 text-xs text-gray-500">
                          {weekData.transactionCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="py-2 px-3">TOTAL</td>
                    <td className="text-right py-2 px-3 text-purple-700">
                      ${Math.round(glOpexData.reduce((sum: number, w: any) => sum + w.totalAmount, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glOpexData.reduce((sum: number, w: any) => sum + w.breakdown.contractLabor, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glOpexData.reduce((sum: number, w: any) => sum + w.breakdown.consultingServices, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glOpexData.reduce((sum: number, w: any) => sum + w.breakdown.travel, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glOpexData.reduce((sum: number, w: any) => sum + w.breakdown.software, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3">
                      ${Math.round(glOpexData.reduce((sum: number, w: any) => sum + w.breakdown.other, 0)).toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-3 text-xs text-gray-500">
                      {glOpexData.reduce((sum: number, w: any) => sum + w.transactionCount, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Search, Filters, and Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search and Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search className="inline w-4 h-4 mr-1" />
                  Search
                </label>
                <Input
                  placeholder="Source, description, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                >
                  <option value="all">All Categories</option>
                  <option value="must-pays">Operating</option>
                  <option value="funding">Funding Requests</option>
                  <option value="non-op">Non-Op Disbursements</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Trailing Average Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trailing Average Period</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAvgPeriodWeeks(4)}
                  variant={avgPeriodWeeks === 4 ? 'default' : 'outline'}
                  size="sm"
                >
                  4 Weeks
                </Button>
                <Button
                  onClick={() => setAvgPeriodWeeks(13)}
                  variant={avgPeriodWeeks === 13 ? 'default' : 'outline'}
                  size="sm"
                >
                  3 Months (13 weeks)
                </Button>
                <Button
                  onClick={() => setAvgPeriodWeeks(26)}
                  variant={avgPeriodWeeks === 26 ? 'default' : 'outline'}
                  size="sm"
                >
                  6 Months (26 weeks)
                </Button>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>

              <Button onClick={exportChartToPNG} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export PNG
              </Button>

              <Button onClick={set13WeekView} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                13 Weeks
              </Button>

              <Button onClick={resetToAll} variant="outline" size="sm">
                Reset to All
              </Button>

              <Button
                onClick={() => setShowChart(!showChart)}
                variant="outline"
                size="sm"
              >
                {showChart ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showChart ? 'Hide' : 'Show'} Chart
              </Button>

              <Button
                onClick={toggleCurrentDateLine}
                variant="outline"
                size="sm"
              >
                {showCurrentDateLine ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showCurrentDateLine ? 'Hide' : 'Show'} Current Date
              </Button>

              <Button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                variant="outline"
                size="sm"
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Chart: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Outflows ({weeklyData.length} weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalOutflows.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">NRE + Inventory + Operating</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Peak Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${peakWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">Highest single week outflow</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Weekly</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${avgWeekly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">Average per week</p>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Bar Chart */}
      {showChart && weeklyData.length > 0 && (
        <Card className="mb-6" ref={chartRef}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">Weekly Cash Flow</CardTitle>
                <p className="text-sm text-gray-600">
                  Stacked bar chart with {avgPeriodWeeks}-week trailing average
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
                <Button onClick={exportChartToPNG} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export PNG</span>
                  <span className="sm:hidden">PNG</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-600"></div>
                  <span>NRE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600"></div>
                  <span>Inventory</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-600"></div>
                  <span>OpEx</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-gray-900"></div>
                  <span>{avgPeriodWeeks}wk Avg (colored by burn rate)</span>
                </div>
              </div>

              {/* Chart */}
              <div className="relative" style={{ height: '400px' }}>
                {/* Burn Rate Legend (HTML positioned) */}
                <div className="absolute top-4 left-4 z-20 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-md">
                  <div className="text-xs font-bold text-gray-800 mb-2">Avg Line Burn Rate:</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-xs text-gray-700">High ≥130%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-xs text-gray-700">Med 100-130%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs text-gray-700">Low &lt;100%</span>
                    </div>
                  </div>
                </div>

                {/* Custom Tooltip for Bars */}
                {hoveredWeek && (
                  <div
                    className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                    style={{
                      left: '50%',
                      top: '20px',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="font-semibold mb-1">
                      Week of {new Date(hoveredWeek.weekStart).toLocaleDateString()}
                    </div>
                    <div className="text-green-300">NRE: ${hoveredWeek.nreTotal.toLocaleString()}</div>
                    <div className="text-blue-300">Inventory: ${hoveredWeek.inventoryTotal.toLocaleString()}</div>
                    <div className="text-purple-300">Operating: ${hoveredWeek.mustPayTotal.toLocaleString()}</div>
                    <div className="text-yellow-300 font-bold mt-1 pt-1 border-t border-gray-700">
                      Total: ${hoveredWeek.total.toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Custom Tooltip for Average Line */}
                {hoveredAvg && (
                  <div
                    className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                    style={{
                      left: '50%',
                      top: '60px',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="font-semibold">
                      {avgPeriodWeeks}-week avg: ${hoveredAvg.average.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}

                <svg width="100%" height="100%" viewBox="0 0 1000 400" preserveAspectRatio="none" className="overflow-visible">

                  {/* Bars and Line */}
                  {weeklyData.map((week, index) => {
                    const barWidth = 100 / weeklyData.length;
                    const barX = index * barWidth;
                    const maxHeight = 350;

                    const nreHeight = peakWeek > 0 ? (week.nreTotal / peakWeek) * maxHeight : 0;
                    const invHeight = peakWeek > 0 ? (week.inventoryTotal / peakWeek) * maxHeight : 0;
                    const mustPayHeight = peakWeek > 0 ? (week.mustPayTotal / peakWeek) * maxHeight : 0;

                    // Check if this week is "today"
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const weekStartDate = new Date(week.weekStart);
                    weekStartDate.setHours(0, 0, 0, 0);
                    const weekEndDate = new Date(week.weekEnd);
                    weekEndDate.setHours(0, 0, 0, 0);
                    const isCurrentWeek = today >= weekStartDate && today <= weekEndDate;

                    return (
                      <g key={week.weekStart}>
                        {/* NRE Bar */}
                        <rect
                          x={`${barX + barWidth * 0.1}%`}
                          y={maxHeight - nreHeight}
                          width={`${barWidth * 0.8}%`}
                          height={nreHeight}
                          fill="#16a34a"
                          className="hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredWeek(week)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        />
                        {/* Inventory Bar */}
                        <rect
                          x={`${barX + barWidth * 0.1}%`}
                          y={maxHeight - nreHeight - invHeight}
                          width={`${barWidth * 0.8}%`}
                          height={invHeight}
                          fill="#2563eb"
                          className="hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredWeek(week)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        />
                        {/* Operating Bar */}
                        <rect
                          x={`${barX + barWidth * 0.1}%`}
                          y={maxHeight - nreHeight - invHeight - mustPayHeight}
                          width={`${barWidth * 0.8}%`}
                          height={mustPayHeight}
                          fill="#9333ea"
                          className="hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredWeek(week)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        />

                        {/* Current Date Line */}
                        {showCurrentDateLine && isCurrentWeek && (
                          <g>
                            <line
                              x1={`${barX + barWidth * 0.5}%`}
                              y1="0"
                              x2={`${barX + barWidth * 0.5}%`}
                              y2={maxHeight}
                              stroke="#3b82f6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                              opacity="0.6"
                            />
                            <text
                              x={`${barX + barWidth * 0.5}%`}
                              y="-5"
                              textAnchor="middle"
                              fill="#3b82f6"
                              fontSize="12"
                              fontWeight="bold"
                            >
                              Today
                            </text>
                          </g>
                        )}

                        {/* Week 13 Marker Line */}
                        {(() => {
                          const today = new Date();
                          const week13Date = new Date(today);
                          week13Date.setDate(week13Date.getDate() + (13 * 7)); // 13 weeks from today
                          const week13Start = new Date(week13Date);
                          week13Start.setDate(week13Start.getDate() - (week13Start.getDay() || 7)); // Monday of that week
                          const week13StartStr = week13Start.toISOString().split('T')[0];
                          const isWeek13 = week.weekStart === week13StartStr;
                          
                          return showCurrentDateLine && isWeek13 && (
                            <g>
                              <line
                                x1={`${barX + barWidth * 0.5}%`}
                                y1="0"
                                x2={`${barX + barWidth * 0.5}%`}
                                y2={maxHeight}
                                stroke="#10b981"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                                opacity="0.6"
                              />
                              <text
                                x={`${barX + barWidth * 0.5}%`}
                                y="-5"
                                textAnchor="middle"
                                fill="#10b981"
                                fontSize="12"
                                fontWeight="bold"
                              >
                                Week 13
                              </text>
                            </g>
                          );
                        })()}

                        {/* Week Label */}
                        <text
                          x={`${barX + barWidth * 0.5}%`}
                          y={maxHeight + 20}
                          textAnchor="middle"
                          fill="#6b7280"
                          fontSize="10"
                        >
                          {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </text>
                      </g>
                    );
                  })}

                  {/* Trailing Average Line - Colored Segments */}
                  {trailingAverages.map((avg, index) => {
                    if (index === 0) return null; // Skip first point (no line before it)
                    
                    const barWidth = 100 / weeklyData.length;
                    const prevAvg = trailingAverages[index - 1];
                    
                    const x1 = ((index - 1) * barWidth + barWidth * 0.5);
                    const y1 = 350 - (peakWeek > 0 ? (prevAvg.average / peakWeek) * 350 : 0);
                    const x2 = (index * barWidth + barWidth * 0.5);
                    const y2 = 350 - (peakWeek > 0 ? (avg.average / peakWeek) * 350 : 0);

                    return (
                      <line
                        key={`line-${avg.weekStart}`}
                        x1={`${x1}%`}
                        y1={y1}
                        x2={`${x2}%`}
                        y2={y2}
                        stroke={avg.color}
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}

                  {/* Average Line Data Points */}
                  {trailingAverages.map((avg, index) => {
                    const barWidth = 100 / weeklyData.length;
                    const x = (index * barWidth + barWidth * 0.5);
                    const y = 350 - (peakWeek > 0 ? (avg.average / peakWeek) * 350 : 0);

                    return (
                      <circle
                        key={avg.weekStart}
                        cx={`${x}%`}
                        cy={y}
                        r="5"
                        fill={avg.color}
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredAvg(avg)}
                        onMouseLeave={() => setHoveredAvg(null)}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consolidated Weekly Summary Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Weekly Cash Flow Summary</CardTitle>
          <p className="text-sm text-gray-600">Consolidated view of all cash inflows and outflows</p>
          <p className="text-xs text-gray-500 mt-1 md:hidden">← Swipe to see all weeks →</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 px-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <table className={`w-full min-w-full ${weeklyData.length > 15 ? 'text-[8px] md:text-[10px]' : weeklyData.length > 10 ? 'text-[9px] md:text-xs' : 'text-[10px] md:text-sm'}`}>
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="sticky left-0 z-10 bg-white text-left py-1 md:py-2 px-0.5 md:px-1 font-semibold whitespace-nowrap min-w-[100px] md:min-w-[140px] text-[9px] md:text-sm shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    <span className="hidden md:inline">Week Starting</span>
                    <span className="md:hidden">Week</span>
                  </th>
                  {weeklyData.map((week) => (
                    <th key={week.weekStart} className="text-right py-1 md:py-2 px-0.5 md:px-1 font-semibold whitespace-nowrap">
                      <span className="hidden sm:inline">{new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <span className="sm:hidden">{new Date(week.weekStart).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }).replace('/', '/')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Total Incoming Cash */}
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-green-700 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">
                    <span className="hidden lg:inline">Total Incoming Cash</span>
                    <span className="lg:hidden">Incoming Cash</span>
                  </td>
                  {weeklyData.map((week, index) => {
                    const receiptsTotal = operatingReceipts
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    
                    // DEBUG: Log first 4 weeks
                    if (index < 4) {
                      console.log(`💰 [Revenue Display] Week ${week.weekStart}:`);
                      console.log(`   All receipts for this week:`, operatingReceipts.filter(item => item.weekStart === week.weekStart));
                      console.log(`   Calculated total: $${receiptsTotal}`);
                    }
                    
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 whitespace-nowrap ${receiptsTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(receiptsTotal).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Total Operating Cash Disbursements */}
                <tr className="border-b border-gray-200 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-red-700 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">
                    <span className="hidden lg:inline">Total Operating Cash Disbursements</span>
                    <span className="lg:hidden">Operating Disb.</span>
                  </td>
                  {weeklyData.map((week) => {
                    const total = week.nreTotal + week.inventoryTotal + week.mustPayTotal;
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 whitespace-nowrap ${total >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(total).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Operating Cash Flow */}
                <tr className="border-b-2 border-gray-300 bg-blue-50">
                  <td className="sticky left-0 z-10 bg-blue-50 py-1 md:py-1.5 px-0.5 md:px-1 font-bold whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm text-blue-900">
                    <span className="hidden lg:inline">Operating Cash Flow</span>
                    <span className="lg:hidden">Operating CF</span>
                  </td>
                  {weeklyData.map((week) => {
                    const receiptsTotal = operatingReceipts
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const operatingCashFlow = receiptsTotal - (week.nreTotal + week.inventoryTotal + week.mustPayTotal);
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 font-bold whitespace-nowrap ${operatingCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(operatingCashFlow).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Funding Request Total */}
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-purple-700 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">
                    <span className="hidden lg:inline">Funding Request Total</span>
                    <span className="lg:hidden">Funding</span>
                  </td>
                  {weeklyData.map((week) => {
                    const fundingTotal = fundingRequests
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 whitespace-nowrap ${fundingTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(fundingTotal).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Cash Disbursements Total */}
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-red-700 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">
                    <span className="hidden lg:inline">Cash Disbursements Total</span>
                    <span className="lg:hidden">Cash Disb.</span>
                  </td>
                  {weeklyData.map((week) => {
                    const nonOpTotal = nonOpDisbursements
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 whitespace-nowrap ${nonOpTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(nonOpTotal).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Net Cash Flow */}
                <tr className="border-b-2 border-gray-400 bg-yellow-50">
                  <td className="sticky left-0 z-10 bg-yellow-50 py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-gray-900 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-xs">
                    <span className="hidden lg:inline">Net Cash Flow</span>
                    <span className="lg:hidden">Net CF</span>
                  </td>
                  {weeklyData.map((week) => {
                    const receiptsTotal = operatingReceipts
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const operatingTotal = week.nreTotal + week.inventoryTotal + week.mustPayTotal;
                    const fundingTotal = fundingRequests
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const nonOpTotal = nonOpDisbursements
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const netCashFlow = receiptsTotal - operatingTotal + fundingTotal - nonOpTotal;
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 font-semibold text-xs whitespace-nowrap ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(netCashFlow).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Beginning Bank Balance */}
                <tr className="border-b border-gray-200 bg-gray-50">
                  <td className="sticky left-0 z-10 bg-gray-50 py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-blue-700 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">
                    <span className="hidden lg:inline">Beginning Bank Balance</span>
                    <span className="lg:hidden">Begin Balance</span>
                  </td>
                  {weeklyData.map((week, weekIndex) => {
                    // First week: use beginning_balance entry
                    // Subsequent weeks: use previous week's ending balance
                    let beginningBalance = 0;
                    
                    if (weekIndex === 0) {
                      // First week - get from bank account entries
                      beginningBalance = bankAccountEntries
                        .filter(item => item.weekStart === week.weekStart && item.entryType === 'beginning_balance')
                        .reduce((sum, item) => sum + item.amount, 0);
                    } else {
                      // Calculate previous week's ending balance
                      const prevWeek = weeklyData[weekIndex - 1];
                      const prevReceipts = operatingReceipts
                        .filter(item => item.weekStart === prevWeek.weekStart)
                        .reduce((sum, item) => sum + item.amount, 0);
                      const prevOperating = prevWeek.nreTotal + prevWeek.inventoryTotal + prevWeek.mustPayTotal;
                      const prevFunding = fundingRequests
                        .filter(item => item.weekStart === prevWeek.weekStart)
                        .reduce((sum, item) => sum + item.amount, 0);
                      const prevNonOp = nonOpDisbursements
                        .filter(item => item.weekStart === prevWeek.weekStart)
                        .reduce((sum, item) => sum + item.amount, 0);
                      const prevNetCashFlow = prevReceipts - prevOperating + prevFunding - prevNonOp;
                      
                      const prevBeginningBalance = weekIndex === 1 
                        ? bankAccountEntries
                            .filter(item => item.weekStart === prevWeek.weekStart && item.entryType === 'beginning_balance')
                            .reduce((sum, item) => sum + item.amount, 0)
                        : 0; // Will be calculated recursively in actual implementation
                      
                      const prevBankRecon = bankAccountEntries
                        .filter(item => item.weekStart === prevWeek.weekStart && item.entryType === 'bank_reconciliation')
                        .reduce((sum, item) => sum + item.amount, 0);
                      
                      beginningBalance = prevNetCashFlow + prevBeginningBalance + prevBankRecon;
                    }
                    
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 whitespace-nowrap ${beginningBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(beginningBalance).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Bank Reconciliations */}
                <tr className="border-b border-gray-200">
                  <td className="sticky left-0 z-10 bg-white py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-gray-700 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-sm">
                    <span className="hidden lg:inline">Bank Reconciliations</span>
                    <span className="lg:hidden">Bank Recon</span>
                  </td>
                  {weeklyData.map((week) => {
                    const bankRecon = bankAccountEntries
                      .filter(item => item.weekStart === week.weekStart && item.entryType === 'bank_reconciliation')
                      .reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 whitespace-nowrap ${bankRecon >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(bankRecon).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Ending Book Balance */}
                <tr className="border-b-2 border-gray-400 bg-green-50">
                  <td className="sticky left-0 z-10 bg-green-50 py-1 md:py-1.5 px-0.5 md:px-1 font-semibold text-gray-900 whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-[9px] md:text-xs">
                    <span className="hidden lg:inline">Ending Book Balance</span>
                    <span className="lg:hidden">End Balance</span>
                  </td>
                  {weeklyData.map((week, weekIndex) => {
                    const receiptsTotal = operatingReceipts
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const operatingTotal = week.nreTotal + week.inventoryTotal + week.mustPayTotal;
                    const fundingTotal = fundingRequests
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const nonOpTotal = nonOpDisbursements
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const netCashFlow = receiptsTotal - operatingTotal + fundingTotal - nonOpTotal;
                    
                    let beginningBalance = 0;
                    if (weekIndex === 0) {
                      beginningBalance = bankAccountEntries
                        .filter(item => item.weekStart === week.weekStart && item.entryType === 'beginning_balance')
                        .reduce((sum, item) => sum + item.amount, 0);
                    } else {
                      // Use previous week's ending balance (simplified - full recursion would be needed)
                      const prevWeek = weeklyData[weekIndex - 1];
                      const prevReceipts = operatingReceipts
                        .filter(item => item.weekStart === prevWeek.weekStart)
                        .reduce((sum, item) => sum + item.amount, 0);
                      const prevOperating = prevWeek.nreTotal + prevWeek.inventoryTotal + prevWeek.mustPayTotal;
                      const prevFunding = fundingRequests
                        .filter(item => item.weekStart === prevWeek.weekStart)
                        .reduce((sum, item) => sum + item.amount, 0);
                      const prevNonOp = nonOpDisbursements
                        .filter(item => item.weekStart === prevWeek.weekStart)
                        .reduce((sum, item) => sum + item.amount, 0);
                      const prevNetCashFlow = prevReceipts - prevOperating + prevFunding - prevNonOp;
                      
                      const prevBeginningBalance = weekIndex === 1 
                        ? bankAccountEntries
                            .filter(item => item.weekStart === prevWeek.weekStart && item.entryType === 'beginning_balance')
                            .reduce((sum, item) => sum + item.amount, 0)
                        : 0;
                      
                      const prevBankRecon = bankAccountEntries
                        .filter(item => item.weekStart === prevWeek.weekStart && item.entryType === 'bank_reconciliation')
                        .reduce((sum, item) => sum + item.amount, 0);
                      
                      beginningBalance = prevNetCashFlow + prevBeginningBalance + prevBankRecon;
                    }
                    
                    const bankRecon = bankAccountEntries
                      .filter(item => item.weekStart === week.weekStart && item.entryType === 'bank_reconciliation')
                      .reduce((sum, item) => sum + item.amount, 0);
                    
                    const endingBalance = netCashFlow + beginningBalance + bankRecon;
                    
                    return (
                      <td key={week.weekStart} className={`text-right py-1.5 px-1 font-semibold text-xs whitespace-nowrap ${endingBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${Math.round(endingBalance).toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Entry Sections */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Weekly Cash Flow Entry</CardTitle>
          <p className="text-sm text-gray-600">Enter all cash receipts and disbursements by week</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {weeklyData.map((week) => {
              const weekItems = mustPayItems.filter(item => item.weekStart === week.weekStart);
              const weekTotal = weekItems.reduce((sum, item) => sum + item.amount, 0);
              const weekReceipts = operatingReceipts.filter(item => item.weekStart === week.weekStart);
              const receiptsTotal = weekReceipts.reduce((sum, item) => sum + item.amount, 0);
              const weekFunding = fundingRequests.filter(item => item.weekStart === week.weekStart);
              const fundingTotal = weekFunding.reduce((sum, item) => sum + item.amount, 0);
              const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
              const nonOpTotal = weekNonOp.reduce((sum, item) => sum + item.amount, 0);

              return (
                <div key={week.weekStart} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">
                        Week of {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Receipts: ${receiptsTotal.toLocaleString()} | 
                        Total Op. Disb.: ${(week.nreTotal + week.inventoryTotal + weekTotal).toLocaleString()} 
                        <span className="text-xs text-gray-500">(NRE: ${week.nreTotal.toLocaleString()} + Inv: ${week.inventoryTotal.toLocaleString()} + Weekly: ${weekTotal.toLocaleString()})</span> | 
                        Funding: ${fundingTotal.toLocaleString()} | 
                        Cash Disb.: ${nonOpTotal.toLocaleString()}
                      </p>
                    </div>
                    {(weekReceipts.length > 0 || weekItems.length > 0 || weekFunding.length > 0 || (() => {
                      const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
                      const weekBankEntries = bankAccountEntries.filter(item => item.weekStart === week.weekStart);
                      return weekNonOp.length > 0 || weekBankEntries.length > 0;
                    })()) && (
                      <Button
                        onClick={async () => {
                          try {
                            // Save all sections for this week
                            const promises = [];
                            
                            // Save Operating Receipts
                            for (const item of weekReceipts) {
                              promises.push(saveOperatingReceipt(item));
                            }
                            
                            // Save Weekly Operating
                            for (const item of weekItems) {
                              promises.push(saveMustPayItem(item));
                            }
                            
                            // Save Funding Requests
                            for (const item of weekFunding) {
                              promises.push(saveFundingRequest(item));
                            }
                            
                            // Save Cash Disbursements
                            const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
                            for (const item of weekNonOp) {
                              promises.push(saveNonOpDisbursement(item));
                            }
                            
                            // Save Bank Accounts
                            const weekBankEntries = bankAccountEntries.filter(item => item.weekStart === week.weekStart);
                            for (const item of weekBankEntries) {
                              promises.push(saveBankAccountEntry(item));
                            }
                            
                            // Wait for all saves to complete
                            await Promise.all(promises);
                            alert('✅ All entries for this week saved successfully!');
                          } catch (error) {
                            console.error('Failed to save week:', error);
                            alert('❌ Failed to save some entries. Please check the console.');
                          }
                        }}
                        variant="default"
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        Save All for This Week
                      </Button>
                    )}
                  </div>

                  {/* Operating Cash Receipts Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {weekReceipts.length > 0 && (
                          <Button
                            onClick={() => toggleSection(`receipts-${week.weekStart}`)}
                            variant="ghost"
                            size="sm"
                            className="p-1"
                          >
                            {collapsedSections.has(`receipts-${week.weekStart}`) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <h4 className="font-semibold text-green-700">Operating Cash Receipts</h4>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addOperatingReceipt(week.weekStart)}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Receipt
                        </Button>
                        {weekReceipts.length > 0 && (
                          <Button
                            onClick={() => copyReceiptsToNextWeek(week.weekStart)}
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy to Next Week
                          </Button>
                        )}
                      </div>
                    </div>

                    {weekReceipts.length > 0 && !collapsedSections.has(`receipts-${week.weekStart}`) && (
                        <div className="space-y-2">
                          {weekReceipts.map(item => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-3">
                                <Select
                                  value={item.receiptType}
                                  onValueChange={(value) => updateOperatingReceipt(item.id, 'receiptType', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(receiptTypeLabels).map(([key, label]) => (
                                      <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            <div className="col-span-5">
                              <Input
                                placeholder="Description"
                                value={item.description}
                                onChange={(e) => updateOperatingReceipt(item.id, 'description', e.target.value)}
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={item.amount || ''}
                                onChange={(e) => updateOperatingReceipt(item.id, 'amount', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                onClick={() => deleteOperatingReceipt(item.id)}
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Weekly Operating Section */}
                  <div className="mb-6 pt-6 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {weekItems.length > 0 && (
                          <Button
                            onClick={() => toggleSection(`operating-${week.weekStart}`)}
                            variant="ghost"
                            size="sm"
                            className="p-1"
                          >
                            {collapsedSections.has(`operating-${week.weekStart}`) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <h4 className="font-semibold">Weekly Operating</h4>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addMustPayItem(week.weekStart)}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                        {weekItems.length > 0 && (
                          <Button
                            onClick={() => copyToNextWeek(week.weekStart)}
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy to Next Week
                          </Button>
                        )}
                      </div>
                    </div>

                  {weekItems.length > 0 && !collapsedSections.has(`operating-${week.weekStart}`) && (
                    <div className="space-y-2">
                      {weekItems.map(item => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <Select
                              value={item.category}
                              onValueChange={(value) => updateMustPayItem(item.id, 'category', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(categoryLabels).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-5">
                            <Input
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateMustPayItem(item.id, 'description', e.target.value)}
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={item.amount || ''}
                              onChange={(e) => updateMustPayItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              onClick={() => deleteMustPayItem(item.id)}
                              variant="ghost"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  </div>

                  {/* Funding Request Section */}
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {weekFunding.length > 0 && (
                          <Button
                            onClick={() => toggleSection(`funding-${week.weekStart}`)}
                            variant="ghost"
                            size="sm"
                            className="p-1"
                          >
                            {collapsedSections.has(`funding-${week.weekStart}`) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronUp className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                        <h4 className="font-semibold text-purple-700">Funding Requests</h4>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addFundingRequest(week.weekStart)}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Funding
                        </Button>
                        {weekFunding.length > 0 && (
                          <Button
                            onClick={() => copyFundingToNextWeek(week.weekStart)}
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy to Next Week
                          </Button>
                        )}
                      </div>
                    </div>

                    {weekFunding.length > 0 && !collapsedSections.has(`funding-${week.weekStart}`) && (
                      <div className="space-y-2">
                        {weekFunding.map(item => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3">
                              <Select
                                value={item.fundingType}
                                onValueChange={(value) => updateFundingRequest(item.id, 'fundingType', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(fundingTypeLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-5">
                              <Input
                                placeholder="Description / Notes"
                                value={item.description}
                                onChange={(e) => updateFundingRequest(item.id, 'description', e.target.value)}
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={item.amount || ''}
                                onChange={(e) => updateFundingRequest(item.id, 'amount', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                onClick={() => deleteFundingRequest(item.id)}
                                variant="ghost"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Cash Disbursements Section */}
                  <div className="mt-6 pt-6 border-t">
                    {(() => {
                      const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
                      return (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {weekNonOp.length > 0 && (
                                <Button
                                  onClick={() => toggleSection(`disbursement-${week.weekStart}`)}
                                  variant="ghost"
                                  size="sm"
                                  className="p-1"
                                >
                                  {collapsedSections.has(`disbursement-${week.weekStart}`) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronUp className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                              <h4 className="font-semibold text-red-700">Cash Disbursements (Non-Operating)</h4>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => addNonOpDisbursement(week.weekStart)}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Disbursement
                              </Button>
                              {weekNonOp.length > 0 && (
                                <Button
                                  onClick={() => copyNonOpToNextWeek(week.weekStart)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy to Next Week
                                </Button>
                              )}
                            </div>
                          </div>

                          {weekNonOp.length > 0 && !collapsedSections.has(`disbursement-${week.weekStart}`) && (
                            <div className="space-y-2">
                              {weekNonOp.map(item => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-3">
                                    <Select
                                      value={item.disbursementType}
                                      onValueChange={(value) => updateNonOpDisbursement(item.id, 'disbursementType', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(disbursementTypeLabels).map(([key, label]) => (
                                          <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-5">
                                    <Input
                                      placeholder="Description / Notes"
                                      value={item.description}
                                      onChange={(e) => updateNonOpDisbursement(item.id, 'description', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <Input
                                      type="number"
                                      placeholder="Amount"
                                      value={item.amount || ''}
                                      onChange={(e) => updateNonOpDisbursement(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <Button
                                      onClick={() => deleteNonOpDisbursement(item.id)}
                                      variant="ghost"
                                      size="sm"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Bank Accounts Section */}
                  <div className="mt-6 pt-6 border-t">
                    {(() => {
                      const weekBankEntries = bankAccountEntries.filter(item => item.weekStart === week.weekStart);
                      return (
                        <>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              {weekBankEntries.length > 0 && (
                                <Button
                                  onClick={() => toggleSection(`bank-${week.weekStart}`)}
                                  variant="ghost"
                                  size="sm"
                                  className="p-1"
                                >
                                  {collapsedSections.has(`bank-${week.weekStart}`) ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronUp className="w-4 h-4" />
                                  )}
                                </Button>
                              )}
                              <h4 className="font-semibold text-blue-700">Bank Accounts</h4>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => addBankAccountEntry(week.weekStart)}
                                variant="outline"
                                size="sm"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Entry
                              </Button>
                              {weekBankEntries.length > 0 && (
                                <Button
                                  onClick={() => copyBankAccountsToNextWeek(week.weekStart)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Copy className="w-4 h-4 mr-2" />
                                  Copy to Next Week
                                </Button>
                              )}
                            </div>
                          </div>

                          {weekBankEntries.length > 0 && !collapsedSections.has(`bank-${week.weekStart}`) && (
                            <div className="space-y-2">
                              {weekBankEntries.map(item => (
                                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-3">
                                    <Select
                                      value={item.entryType}
                                      onValueChange={(value) => updateBankAccountEntry(item.id, 'entryType', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(bankAccountEntryLabels).map(([key, label]) => (
                                          <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="col-span-5">
                                    <Input
                                      placeholder="Description / Notes"
                                      value={item.description}
                                      onChange={(e) => updateBankAccountEntry(item.id, 'description', e.target.value)}
                                    />
                                  </div>
                                  <div className="col-span-3">
                                    <Input
                                      type="number"
                                      placeholder="Amount"
                                      value={item.amount || ''}
                                      onChange={(e) => updateBankAccountEntry(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div className="col-span-1">
                                    <Button
                                      onClick={() => deleteBankAccountEntry(item.id)}
                                      variant="ghost"
                                      size="sm"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
