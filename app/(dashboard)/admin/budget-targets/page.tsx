'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, Target, TrendingUp, TrendingDown, Calendar, 
  DollarSign, Save, BarChart3, AlertCircle, Check, 
  ChevronDown, ChevronUp
} from 'lucide-react';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';
import { SemanticBDIIcon } from '@/components/BDIIcon';

// NRE Categories (same as NRE Budget)
const NRE_CATEGORIES = [
  { value: 'TOTAL_BUDGET', label: 'Total Budget (Not Yet Categorized)' },
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
];

const PAYMENT_FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom' },
];

interface PaymentPeriod {
  paymentNumber: number;
  periodStart: string;
  periodEnd: string;
  label: string;
  estimatedAmount: number;
  notes?: string;
}

interface BudgetTarget {
  id: string;
  projectName: string;
  skuCode?: string;
  fiscalYear: number;
  fiscalQuarter?: number;
  budgetCategory: string;
  budgetDescription?: string;
  totalBudgetAmount: number;
  paymentFrequency: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  assumptions?: string;
  status: string;
  isLocked: boolean;
  paymentPeriods?: PaymentPeriod[];
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function BudgetTargetsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: skus = [] } = useSWR('/api/skus', fetcher);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetTarget | null>(null);
  
  // Collapsible state - track which budgets have expanded NRE details
  const [expandedBudgets, setExpandedBudgets] = useState<Set<string>>(new Set());
  
  // Form state
  const [projectName, setProjectName] = useState('');
  const [skuCode, setSkuCode] = useState('');
  const [fiscalYear, setFiscalYear] = useState(new Date().getFullYear());
  const [fiscalQuarter, setFiscalQuarter] = useState<number | undefined>();
  const [budgetCategory, setBudgetCategory] = useState('TOTAL_BUDGET'); // Default to total budget category
  const [budgetDescription, setBudgetDescription] = useState('');
  const [totalBudgetAmount, setTotalBudgetAmount] = useState<number>(0);
  const [paymentFrequency, setPaymentFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [paymentPeriods, setPaymentPeriods] = useState<PaymentPeriod[]>([]);
  
  // Fetch budget targets
  const { data: budgetTargets = [], mutate: mutateBudgetTargets } = useSWR<BudgetTarget[]>(
    '/api/admin/budget-targets',
    fetcher,
    { refreshInterval: 30000, fallbackData: [] }
  );
  
  // Fetch budget vs actual analysis
  const { data: budgetAnalysis = [] } = useSWR(
    '/api/admin/budget-targets/analysis',
    fetcher,
    { refreshInterval: 30000, fallbackData: [] }
  );

  // Fetch NRE Budgets to show actual spending breakdown
  const { data: nreBudgets = [] } = useSWR(
    '/api/admin/nre-budget',
    fetcher,
    { refreshInterval: 30000, fallbackData: [] }
  );

  // Auto-generate payment periods when frequency or dates change
  useEffect(() => {
    if (startDate && endDate && paymentFrequency !== 'custom' && totalBudgetAmount > 0) {
      generatePaymentPeriods();
    }
  }, [startDate, endDate, paymentFrequency, totalBudgetAmount]);

  const generatePaymentPeriods = () => {
    if (!startDate || !endDate) return;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const periods: PaymentPeriod[] = [];
    
    let currentStart = new Date(start);
    let periodNum = 1;
    
    while (currentStart <= end) {
      let currentEnd = new Date(currentStart);
      let label = '';
      
      switch (paymentFrequency) {
        case 'weekly':
          currentEnd.setDate(currentEnd.getDate() + 6);
          label = `Week ${periodNum}`;
          break;
        case 'biweekly':
          currentEnd.setDate(currentEnd.getDate() + 13);
          label = `Bi-Week ${periodNum}`;
          break;
        case 'monthly':
          currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 1, 0);
          label = currentStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          break;
        case 'quarterly':
          currentEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() + 3, 0);
          label = `Q${Math.floor(currentStart.getMonth() / 3) + 1} ${currentStart.getFullYear()}`;
          break;
      }
      
      if (currentEnd > end) currentEnd = end;
      
      periods.push({
        paymentNumber: periodNum,
        periodStart: currentStart.toISOString().split('T')[0],
        periodEnd: currentEnd.toISOString().split('T')[0],
        label,
        estimatedAmount: 0,
        notes: '',
      });
      
      currentStart = new Date(currentEnd);
      currentStart.setDate(currentStart.getDate() + 1);
      periodNum++;
    }
    
    // Distribute total budget evenly across periods
    const amountPerPeriod = Math.round((totalBudgetAmount / periods.length) * 100) / 100;
    periods.forEach((p, idx) => {
      p.estimatedAmount = idx === periods.length - 1 
        ? totalBudgetAmount - (amountPerPeriod * (periods.length - 1)) // Last period gets remainder
        : amountPerPeriod;
    });
    
    setPaymentPeriods(periods);
  };

  const updatePaymentPeriod = (index: number, field: keyof PaymentPeriod, value: any) => {
    const updated = [...paymentPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentPeriods(updated);
  };

  const addCustomPaymentPeriod = () => {
    const newPeriod: PaymentPeriod = {
      paymentNumber: paymentPeriods.length + 1,
      periodStart: '',
      periodEnd: '',
      label: `Period ${paymentPeriods.length + 1}`,
      estimatedAmount: 0,
    };
    setPaymentPeriods([...paymentPeriods, newPeriod]);
  };

  const removePaymentPeriod = (index: number) => {
    setPaymentPeriods(paymentPeriods.filter((_, i) => i !== index));
  };

  const calculateTotalFromPeriods = () => {
    return paymentPeriods.reduce((sum, p) => sum + p.estimatedAmount, 0);
  };

  const resetForm = () => {
    setProjectName('');
    setSkuCode('');
    setFiscalYear(new Date().getFullYear());
    setFiscalQuarter(undefined);
    setBudgetCategory('TOTAL_BUDGET'); // Default to total budget
    setBudgetDescription('');
    setTotalBudgetAmount(0);
    setPaymentFrequency('monthly');
    setStartDate('');
    setEndDate('');
    setNotes('');
    setAssumptions('');
    setPaymentPeriods([]);
    setEditingBudget(null);
  };

  const handleSaveBudgetTarget = async () => {
    if (!projectName || totalBudgetAmount <= 0) {
      alert('Please provide project name and budget amount.');
      return;
    }

    const budgetData = {
      projectName,
      skuCode,
      fiscalYear,
      fiscalQuarter,
      budgetCategory,
      budgetDescription,
      totalBudgetAmount,
      paymentFrequency,
      startDate,
      endDate,
      notes,
      assumptions,
      status: 'active',
      paymentPeriods,
    };

    try {
      const url = editingBudget 
        ? `/api/admin/budget-targets/${editingBudget.id}`
        : '/api/admin/budget-targets';
      
      const method = editingBudget ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetData),
      });

      if (!response.ok) throw new Error('Failed to save budget target');

      alert(`Budget target ${editingBudget ? 'updated' : 'created'} successfully!`);
      setShowCreateDialog(false);
      resetForm();
      mutateBudgetTargets();
    } catch (error) {
      alert('Failed to save budget target');
    }
  };

  const handleEdit = (budget: BudgetTarget) => {
    setEditingBudget(budget);
    setProjectName(budget.projectName);
    setSkuCode(budget.skuCode || '');
    setFiscalYear(budget.fiscalYear);
    setFiscalQuarter(budget.fiscalQuarter);
    setBudgetCategory(budget.budgetCategory);
    setBudgetDescription(budget.budgetDescription || '');
    setTotalBudgetAmount(budget.totalBudgetAmount);
    setPaymentFrequency(budget.paymentFrequency);
    setStartDate(budget.startDate || '');
    setEndDate(budget.endDate || '');
    setNotes(budget.notes || '');
    setAssumptions(budget.assumptions || '');
    setPaymentPeriods(budget.paymentPeriods || []);
    setShowCreateDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this budget target?')) return;

    try {
      const response = await fetch(`/api/admin/budget-targets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      alert('Budget target deleted successfully');
      mutateBudgetTargets();
    } catch (error) {
      alert('Failed to delete budget target');
    }
  };

  // Access control
  const hasAccess = () => {
    if (!user) return false;
    if ((user as any).organization?.code !== 'BDI') return false;
    if (['super_admin', 'admin_cfo'].includes(user.role)) return true;
    if ((user as any).organizations && Array.isArray((user as any).organizations)) {
      const orgRoles = (user as any).organizations.map((org: any) => org.membershipRole);
      return ['super_admin', 'admin_cfo', 'admin'].some(role => orgRoles.includes(role));
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
              Only BDI Super Admins and CFOs can access Budget Target management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Budget Targets & Estimates
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">
            Enter estimated budget numbers to compare against actual NRE spending
          </p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setShowCreateDialog(true);
          }}
          className="w-full sm:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Budget Target
        </Button>
      </div>

      {/* Budget Analysis Summary */}
      {budgetAnalysis && budgetAnalysis.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold text-blue-600 break-words">
                ${budgetAnalysis.reduce((sum: number, b: any) => sum + parseFloat(b.targetAmount || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Budget Target</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold text-green-600 break-words">
                ${budgetAnalysis.reduce((sum: number, b: any) => sum + parseFloat(b.actualAmount || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Actual Spent</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
              {(() => {
                const totalVariance = budgetAnalysis.reduce((sum: number, b: any) => sum + parseFloat(b.varianceAmount || 0), 0);
                const totalTarget = budgetAnalysis.reduce((sum: number, b: any) => sum + parseFloat(b.targetAmount || 0), 0);
                const variancePercentage = totalTarget > 0 ? (totalVariance / totalTarget) * 100 : 0;
                return (
                  <>
                    <div className={`text-lg sm:text-2xl font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(totalVariance).toLocaleString()}
                      <span className="text-xs sm:text-sm ml-1">
                        ({Math.abs(variancePercentage).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                      Variance
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 sm:pt-6 pb-4 sm:pb-6">
              <div className="text-lg sm:text-2xl font-bold text-purple-600">
                {budgetAnalysis.length}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 mt-1">Active Projects</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Targets List */}
      <div className="space-y-4">
        {budgetTargets.length === 0 ? (
          <Card className="p-12">
            <div className="text-center text-gray-500">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold mb-2">No Budget Targets Yet</h3>
              <p className="mb-4">Create your first budget target to start tracking estimates vs actuals.</p>
              <Button onClick={() => {
                resetForm();
                setShowCreateDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Budget Target
              </Button>
            </div>
          </Card>
        ) : budgetTargets.map((budget) => {
          const analysis = budgetAnalysis?.find((a: any) => a.budgetTargetId === budget.id);
          
          // Find matching NRE Budgets for this Budget Target (match by SKU Code)
          const matchingNREBudgets = nreBudgets.filter((nre: any) => {
            if (!budget.skuCode) return false;
            return nre.skuCode && nre.skuCode === budget.skuCode;
          });
          
          return (
            <Card key={budget.id} className="border-2">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-green-50 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg sm:text-xl break-words">{budget.projectName}</CardTitle>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      {budget.skuCode && `SKU: ${budget.skuCode} • `}
                      {NRE_CATEGORIES.find(c => c.value === budget.budgetCategory)?.label}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={budget.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {budget.status.toUpperCase()}
                    </Badge>
                    {analysis && (
                      <Badge 
                        variant={
                          analysis.budgetStatus === 'OVER_BUDGET' ? 'destructive' :
                          analysis.budgetStatus === 'NEAR_BUDGET' ? 'secondary' :
                          'outline'
                        }
                        className="text-xs"
                      >
                        {analysis.budgetStatus.replace('_', ' ')}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-xs sm:text-sm text-gray-600">Target Budget</div>
                    <div className="text-xl sm:text-2xl font-bold text-blue-600 break-words">
                      ${budget.totalBudgetAmount.toLocaleString()}
                    </div>
                  </div>
                  {analysis && (
                    <>
                      <div>
                        <div className="text-xs sm:text-sm text-gray-600">Actual Spent</div>
                        <div className="text-xl sm:text-2xl font-bold text-green-600 break-words">
                          ${parseFloat(analysis.actualAmount).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1">
                          Variance
                          {parseFloat(analysis.varianceAmount) < 0 ? (
                            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
                          )}
                        </div>
                        <div className={`text-xl sm:text-2xl font-bold break-words ${
                          parseFloat(analysis.varianceAmount) < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ${Math.abs(parseFloat(analysis.varianceAmount)).toLocaleString()}
                          <span className="text-xs sm:text-sm ml-1">
                            ({parseFloat(analysis.variancePercentage).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Actual NRE Budgets Being Counted */}
                {matchingNREBudgets.length > 0 && (
                  <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-green-50 rounded-lg border-2 border-green-300">
                    <div 
                      className="flex items-center justify-between mb-2 sm:mb-3 cursor-pointer hover:bg-green-100 -m-3 sm:-m-4 p-3 sm:p-4 rounded-t-lg transition-colors"
                      onClick={() => {
                        const newExpanded = new Set(expandedBudgets);
                        if (newExpanded.has(budget.id)) {
                          newExpanded.delete(budget.id);
                        } else {
                          newExpanded.add(budget.id);
                        }
                        setExpandedBudgets(newExpanded);
                      }}
                    >
                      <h4 className="text-xs sm:text-sm font-semibold text-green-900 flex items-center gap-2">
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" />
                        Actual NRE Budgets ({matchingNREBudgets.length})
                      </h4>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-green-200"
                      >
                        {expandedBudgets.has(budget.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    {expandedBudgets.has(budget.id) && (
                      <div className="space-y-3 mt-3">
                      {matchingNREBudgets.map((nre: any) => (
                        <Card key={nre.id} className="bg-white border border-green-200">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <div className="font-mono text-xs text-gray-600">{nre.nreReferenceNumber}</div>
                                <div className="font-semibold text-sm">{nre.vendorName}</div>
                                {nre.quoteNumber && (
                                  <div className="text-xs text-gray-500">Quote: {nre.quoteNumber}</div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-lg font-bold text-green-600">
                                  ${nre.totalAmount.toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {new Date(nre.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            
                            {/* Real Payment Schedule from NRE Budget */}
                            {nre.paymentLineItems && nre.paymentLineItems.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-green-200">
                                <div className="text-xs font-semibold text-green-800 mb-1">Payment Schedule:</div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                  {nre.paymentLineItems.map((payment: any, idx: number) => (
                                    <div key={idx} className="text-xs bg-green-100 rounded p-1.5">
                                      <div className="flex items-center gap-1">
                                        <Badge variant="secondary" className="text-[9px] h-3 px-1 bg-green-200">
                                          #{payment.paymentNumber}
                                        </Badge>
                                        {payment.isPaid && (
                                          <Check className="h-3 w-3 text-green-600" />
                                        )}
                                      </div>
                                      <div className="text-[10px] text-gray-600 mt-0.5">
                                        {new Date(payment.paymentDate).toLocaleDateString()}
                                      </div>
                                      <div className="font-bold text-green-700">
                                        ${payment.amount.toLocaleString()}
                                      </div>
                                      {payment.notes && (
                                        <div className="text-[9px] text-gray-500 italic truncate">
                                          {payment.notes}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Line Items Summary */}
                            {nre.lineItems && nre.lineItems.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-green-200">
                                <div className="text-xs font-semibold text-green-800 mb-1">
                                  Line Items ({nre.lineItems.length}):
                                </div>
                                <div className="space-y-1">
                                  {nre.lineItems.slice(0, 3).map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-xs">
                                      <span className="text-gray-600 truncate flex-1">{item.description}</span>
                                      <span className="font-semibold text-green-700 ml-2">
                                        ${item.totalAmount.toLocaleString()}
                                      </span>
                                    </div>
                                  ))}
                                  {nre.lineItems.length > 3 && (
                                    <div className="text-xs text-gray-500 italic">
                                      +{nre.lineItems.length - 3} more items
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      <div className="mt-3 pt-3 border-t-2 border-green-400 flex justify-between items-center">
                        <span className="text-sm font-semibold text-green-900">Total from NRE Budgets:</span>
                        <span className="text-xl font-bold text-green-600">
                          ${matchingNREBudgets.reduce((sum: number, nre: any) => sum + nre.totalAmount, 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4 pt-4 border-t">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(budget)} className="w-full sm:w-auto">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(budget.id)} className="w-full sm:w-auto">
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State Note - Before Running SQL */}
      {budgetTargets.length === 0 && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Getting Started</h4>
                <p className="text-sm text-blue-800 mb-2">
                  Before creating budget targets, make sure you've run the SQL migration to create the database tables.
                </p>
                <p className="text-xs text-blue-700">
                  Run the SQL file: <code className="bg-blue-100 px-1 py-0.5 rounded">create-budget-targets-table.sql</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => {
        setShowCreateDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="!max-w-[98vw] sm:!max-w-[95vw] !w-[98vw] sm:!w-[95vw] max-h-[95vh] overflow-y-auto p-4 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              {editingBudget ? 'Edit Budget Target' : 'Create Budget Target'}
            </DialogTitle>
          </DialogHeader>

          {editingBudget ? (
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="breakdown">Category Breakdown</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Project Name *</Label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g., MNQ15 DVT"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">SKU Code *</Label>
                    <select
                      value={skuCode}
                      onChange={(e) => {
                        const selectedSku = skus.find((s: any) => s.sku_code === e.target.value);
                        setSkuCode(e.target.value);
                        if (selectedSku && !projectName) {
                          setProjectName(selectedSku.sku_code.substring(0, 7));
                        }
                      }}
                      className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                      required
                    >
                      <option value="">-- Select SKU --</option>
                      {skus.map((sku: any) => (
                        <option key={sku.id} value={sku.sku_code}>
                          {sku.sku_code} - {sku.sku_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm">Total Budget Amount ($) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={totalBudgetAmount}
                      onChange={(e) => setTotalBudgetAmount(parseFloat(e.target.value) || 0)}
                      className="text-xl sm:text-2xl font-bold text-blue-600 py-3 mt-1"
                      placeholder="Enter total budget amount"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Tip: Enter your top-level budget number here. You can break it down by category later when editing.
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm">Budget Description</Label>
                    <Input
                      value={budgetDescription}
                      onChange={(e) => setBudgetDescription(e.target.value)}
                      placeholder="Brief description"
                      className="mt-1"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Category Breakdown Tab - Only shown when editing */}
              <TabsContent value="breakdown" className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200 mb-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Break Down Your Budget by Category
                  </h3>
                  <p className="text-sm text-blue-800 mb-2">
                    Total Budget: <span className="font-bold text-xl">${totalBudgetAmount.toLocaleString()}</span>
                  </p>
                  <p className="text-xs text-blue-700">
                    💡 Allocate your total budget across different NRE categories for detailed tracking and analysis.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {NRE_CATEGORIES.map((category) => (
                    <Card key={category.value} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">{category.label}</Label>
                          <Badge variant="outline" className="text-xs">
                            {category.value}
                          </Badge>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="$0.00"
                          className="text-lg font-bold text-green-600"
                          disabled
                        />
                        <p className="text-xs text-gray-500 italic">
                          Coming soon: Allocate budget per category
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>

                <Card className="p-4 bg-green-50 border-2 border-green-300 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Allocated:</span>
                    <span className="text-2xl font-bold text-green-600">
                      $0.00
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    💡 This feature will let you track spending by category and compare against your per-category budgets.
                  </p>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Project Name *</Label>
                  <Input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g., MNQ15 DVT"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">SKU Code *</Label>
                  <select
                    value={skuCode}
                    onChange={(e) => {
                      const selectedSku = skus.find((s: any) => s.sku_code === e.target.value);
                      setSkuCode(e.target.value);
                      if (selectedSku && !projectName) {
                        setProjectName(selectedSku.sku_code.substring(0, 7));
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-md text-sm mt-1"
                    required
                  >
                    <option value="">-- Select SKU --</option>
                    {skus.map((sku: any) => (
                      <option key={sku.id} value={sku.sku_code}>
                        {sku.sku_code} - {sku.sku_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">Total Budget Amount ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={totalBudgetAmount}
                    onChange={(e) => setTotalBudgetAmount(parseFloat(e.target.value) || 0)}
                    className="text-xl sm:text-2xl font-bold text-blue-600 py-3 mt-1"
                    placeholder="Enter total budget amount"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Tip: Enter your top-level budget number here. You can break it down by category later when editing.
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-sm">Budget Description</Label>
                  <Input
                    value={budgetDescription}
                    onChange={(e) => setBudgetDescription(e.target.value)}
                    placeholder="Brief description"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t mt-6">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveBudgetTarget} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {editingBudget ? 'Update Budget Target' : 'Create Budget Target'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

