'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart as LineChartIcon, TrendingUp, Calendar, Search, Download, ArrowLeft, FileSpreadsheet, RefreshCw, Save, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import html2canvas from 'html2canvas';
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown';

// Interfaces
interface Forecast {
  id: string;
  skuId: string;
  sku: {
    sku: string;
    name: string;
    mfg?: string;
    standardCost?: string;
  };
  deliveryWeek: string; // ISO week format: 2025-W12
  quantity: number;
  salesSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected';
  factorySignal: 'unknown' | 'reviewing' | 'confirmed' | 'rejected';
  shippingSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected';
  shippingPreference: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  selectedScenarioId?: string; // Link to SKU Financial Scenario
}

interface WeeklyData {
  weekStart: string; // ISO date: 2025-10-06
  weekLabel: string; // Display: W40 2025
  totalQuantity: number;
  skuBreakdown: { [skuCode: string]: number };
  totalCost: number; // Sum of (quantity * standardCost) for the week
  totalRevenue: number; // Sum of (quantity * asp) for the week
}

// Fetcher for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SalesForecastAnalysisPage() {
  const router = useRouter();
  
  // Data state with SWR
  const { data: forecasts, mutate: mutateForecasts, isLoading: loadingForecasts } = useSWR<Forecast[]>('/api/cpfr/forecasts', fetcher);
  const { data: skus, isLoading: loadingSkus } = useSWR<any[]>('/api/admin/skus', fetcher);
  const { data: scenariosResponse, isLoading: loadingScenarios } = useSWR<{scenarios: any[], count: number}>('/api/business-analysis/sku-scenarios', fetcher);
  const scenarios = scenariosResponse?.scenarios;
  const [organizationId, setOrganizationId] = useState<string>('');
  
  // Track scenario selections for each forecast
  const [forecastScenarios, setForecastScenarios] = useState<Record<string, string>>({});
  
  // Track manual ASP entries for each forecast (overrides scenario ASP)
  const [manualASPs, setManualASPs] = useState<Record<string, number>>({});
  
  // UI state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSKUs, setSelectedSKUs] = useState<string[]>([]); // Changed from single to array
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 100;
  const loading = loadingForecasts || loadingSkus || loadingScenarios;
  
  // Detailed Parameters Table State
  const [showDetailedTable, setShowDetailedTable] = useState<boolean>(false);
  const [detailedTableSearch, setDetailedTableSearch] = useState<string>('');
  const [detailedTableChannelFilter, setDetailedTableChannelFilter] = useState<string>('all');
  const [detailedTableCountryFilter, setDetailedTableCountryFilter] = useState<string>('all');
  const [detailedTableSKUFilter, setDetailedTableSKUFilter] = useState<string>('all');
  const [detailedTableWeekFilter, setDetailedTableWeekFilter] = useState<string>('all');
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, selectedSKUs, searchQuery]);
  
  // Helper function to get scenarios for a specific SKU
  const getScenariosForSKU = (skuCode: string) => {
    if (!scenarios || !Array.isArray(scenarios)) return [];
    const skuCodeLower = skuCode?.toLowerCase() || '';
    return scenarios.filter((scenario: any) => {
      const scenarioSKU = scenario.skuName?.toLowerCase() || '';
      return scenarioSKU === skuCodeLower || scenarioSKU.includes(skuCodeLower) || skuCodeLower.includes(scenarioSKU);
    });
  };
  
  // Helper function to get selected scenario for a forecast
  const getSelectedScenario = (forecastId: string) => {
    const scenarioId = forecastScenarios[forecastId];
    if (!scenarioId || !scenarios || !Array.isArray(scenarios)) return null;
    return scenarios.find((s: any) => s.id === scenarioId);
  };
  
  // Helper function to get effective ASP (manual entry overrides scenario)
  const getEffectiveASP = (forecastId: string): number => {
    // Manual entry takes priority
    if (manualASPs[forecastId] !== undefined && manualASPs[forecastId] > 0) {
      return manualASPs[forecastId];
    }
    // Otherwise use scenario ASP
    const scenario = getSelectedScenario(forecastId);
    return scenario ? parseFloat(scenario.asp || '0') : 0;
  };
  
  // Handle scenario selection for a forecast
  const handleScenarioChange = async (forecastId: string, scenarioId: string) => {
    setForecastScenarios(prev => ({
      ...prev,
      [forecastId]: scenarioId
    }));
    
    // Clear manual ASP when scenario changes
    setManualASPs(prev => {
      const newManualASPs = { ...prev };
      delete newManualASPs[forecastId];
      return newManualASPs;
    });
    
    // TODO: Persist to database via forecast-scenarios API
    // For now, just update local state
  };
  
  // Handle manual ASP entry
  const handleManualASPChange = (forecastId: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setManualASPs(prev => ({
        ...prev,
        [forecastId]: numValue
      }));
    } else if (value === '') {
      // Clear manual entry
      setManualASPs(prev => {
        const newManualASPs = { ...prev };
        delete newManualASPs[forecastId];
        return newManualASPs;
      });
    }
  };
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  
  // Worksheet modal filters
  const [worksheetSortOrder, setWorksheetSortOrder] = useState<'asc' | 'desc'>('asc');
  const [worksheetSKUFilter, setWorksheetSKUFilter] = useState<string>('all');
  const [worksheetManufacturerFilter, setWorksheetManufacturerFilter] = useState<string>('all');
  
  // Save/Load session modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [sessionDescription, setSessionDescription] = useState('');
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [savingSession, setSavingSession] = useState(false);
  
  // Configuration modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);
  
  // Configuration form state
  const [channelType, setChannelType] = useState<'D2C' | 'B2B'>('D2C');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [salesVelocity, setSalesVelocity] = useState<number>(0);
  const [velocityUnit, setVelocityUnit] = useState<'per_day' | 'per_week'>('per_day');
  const [daysToCash, setDaysToCash] = useState<number>(0);
  const [warehouse, setWarehouse] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  
  // B2B specific
  const [useFactoring, setUseFactoring] = useState(false);
  const [factoringInitialPercent, setFactoringInitialPercent] = useState<number>(85);
  const [factoringInitialDays, setFactoringInitialDays] = useState<number>(3);
  const [factoringRemainderPercent, setFactoringRemainderPercent] = useState<number>(15);
  const [factoringRemainderDays, setFactoringRemainderDays] = useState<number>(30);
  const [insurancePercent, setInsurancePercent] = useState<number>(0);
  const [pickupLocation, setPickupLocation] = useState<string>('Vietnam');
  
  // New fields for Sales Velocity, Lead Time, BOL Date, and Reorder Date
  const [salesVelocityUnitsPerDay, setSalesVelocityUnitsPerDay] = useState<number>(0);
  const [leadTimeDays, setLeadTimeDays] = useState<number>(90);
  const [bolHandoverDate, setBolHandoverDate] = useState<string>('');
  
  const [savingConfig, setSavingConfig] = useState(false);
  
  // Chart ref
  const chartRef = useRef<HTMLDivElement>(null);

  // Initialize date range (13 weeks from today)
  useEffect(() => {
    const today = new Date();
    const thirteenWeeksLater = new Date(today);
    thirteenWeeksLater.setDate(today.getDate() + (13 * 7));
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(thirteenWeeksLater.toISOString().split('T')[0]);
  }, []);

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const userData = await response.json();
          const orgId = userData.organizations?.[0]?.organization?.id;
          console.log('Organization ID:', orgId);
          setOrganizationId(orgId);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    }
    fetchUserData();
  }, []);

  // Convert ISO week (2025-W12) to date
  const isoWeekToDate = (isoWeek: string): Date => {
    const [year, week] = isoWeek.split('-W').map(Number);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  };

  // Filter forecasts (handle undefined from SWR)
  const filteredForecasts = (forecasts || []).filter(f => {
    if (!f.deliveryWeek) return false;
    
    const weekDate = isoWeekToDate(f.deliveryWeek);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (weekDate < start || weekDate > end) return false;
    
    // Filter by selected SKUs (if any are selected)
    if (selectedSKUs.length > 0 && !selectedSKUs.includes(f.sku?.sku || '')) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.sku?.sku?.toLowerCase().includes(query) ||
        f.sku?.name?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Aggregate forecasts by week
  const weeklyData: WeeklyData[] = [];
  const weekMap = new Map<string, WeeklyData>();

  filteredForecasts.forEach(f => {
    const weekDate = isoWeekToDate(f.deliveryWeek);
    const weekStart = weekDate.toISOString().split('T')[0];
    
    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, {
        weekStart,
        weekLabel: f.deliveryWeek,
        totalQuantity: 0,
        skuBreakdown: {},
        totalCost: 0,
        totalRevenue: 0,
      });
    }
    
    const week = weekMap.get(weekStart)!;
    week.totalQuantity += f.quantity;
    
    const skuCode = f.sku?.sku || 'Unknown';
    week.skuBreakdown[skuCode] = (week.skuBreakdown[skuCode] || 0) + f.quantity;
    
    // Calculate cost and revenue for this forecast
    const standardCost = parseFloat(f.sku?.standardCost || '0');
    const asp = getEffectiveASP(f.id);
    week.totalCost += f.quantity * standardCost;
    week.totalRevenue += f.quantity * asp;
  });

  weeklyData.push(...Array.from(weekMap.values()).sort((a, b) => 
    a.weekStart.localeCompare(b.weekStart)
  ));

  // Debug logging
  console.log('📊 Sales Forecast Debug:');
  console.log('Total forecasts:', forecasts?.length || 0);
  console.log('Filtered forecasts:', filteredForecasts.length);
  console.log('Weekly data:', weeklyData.length);
  console.log('Weekly data sample:', weeklyData.slice(0, 3));

  // Calculate summary stats
  const totalQuantity = filteredForecasts.reduce((sum, f) => sum + f.quantity, 0);
  const avgWeeklyQuantity = weeklyData.length > 0 ? totalQuantity / weeklyData.length : 0;
  const peakWeek = weeklyData.reduce((max, week) => 
    week.totalQuantity > max.totalQuantity ? week : max, 
    { totalQuantity: 0, weekLabel: '-', weekStart: '', skuBreakdown: {} }
  );
  const uniqueSKUs = new Set(filteredForecasts.map(f => f.sku?.sku).filter(Boolean)).size;
  
  // Count SKUs missing standard cost
  const missingCostCount = filteredForecasts.filter(f => {
    const standardCost = parseFloat(f.sku?.standardCost || '0');
    return standardCost === 0;
  }).length;
  
  // Calculate dollar amounts using Standard Cost
  const totalValue = filteredForecasts.reduce((sum, f) => {
    const standardCost = parseFloat(f.sku?.standardCost || '0');
    return sum + (f.quantity * standardCost);
  }, 0);
  const avgWeeklyValue = weeklyData.length > 0 ? totalValue / weeklyData.length : 0;
  
  // Calculate peak week value
  const peakWeekValue = weeklyData.reduce((max, week) => {
    const weekValue = filteredForecasts
      .filter(f => {
        const weekDate = isoWeekToDate(f.deliveryWeek);
        return weekDate.toISOString().split('T')[0] === week.weekStart;
      })
      .reduce((sum, f) => {
        const standardCost = parseFloat(f.sku?.standardCost || '0');
        return sum + (f.quantity * standardCost);
      }, 0);
    return weekValue > max.value ? { value: weekValue, weekLabel: week.weekLabel } : max;
  }, { value: 0, weekLabel: '-' });
  
  // Calculate revenue amounts using ASP from selected scenarios or manual entry
  const totalRevenue = filteredForecasts.reduce((sum, f) => {
    const asp = getEffectiveASP(f.id);
    return sum + (f.quantity * asp);
  }, 0);
  const avgWeeklyRevenue = weeklyData.length > 0 ? totalRevenue / weeklyData.length : 0;
  
  // Calculate peak week revenue
  const peakWeekRevenue = weeklyData.reduce((max, week) => {
    const weekRevenue = filteredForecasts
      .filter(f => {
        const weekDate = isoWeekToDate(f.deliveryWeek);
        return weekDate.toISOString().split('T')[0] === week.weekStart;
      })
      .reduce((sum, f) => {
        const asp = getEffectiveASP(f.id);
        return sum + (f.quantity * asp);
      }, 0);
    return weekRevenue > max.value ? { value: weekRevenue, weekLabel: week.weekLabel } : max;
  }, { value: 0, weekLabel: '-' });
  
  // Calculate gross profit (Revenue - Cost)
  const totalGrossProfit = totalRevenue - totalValue;
  const avgWeeklyGrossProfit = weeklyData.length > 0 ? totalGrossProfit / weeklyData.length : 0;
  const grossProfitPercent = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
  
  // Count forecasts with ASP assigned (either from scenario or manual)
  const forecastsWithASP = filteredForecasts.filter(f => getEffectiveASP(f.id) > 0).length;
  const avgUnitASP = forecastsWithASP > 0 && totalRevenue > 0 
    ? totalRevenue / filteredForecasts.filter(f => getEffectiveASP(f.id) > 0).reduce((sum, f) => sum + f.quantity, 0)
    : 0;
  
  // Count forecasts with scenarios assigned
  const scenariosAssignedCount = filteredForecasts.filter(f => !!forecastScenarios[f.id]).length;

  // Handle 13-week button
  const handleThirteenWeeks = () => {
    const today = new Date();
    const thirteenWeeksLater = new Date(today);
    thirteenWeeksLater.setDate(today.getDate() + (13 * 7));
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(thirteenWeeksLater.toISOString().split('T')[0]);
  };

  // Handle reset to all - refresh data and set date range
  const handleResetToAll = async () => {
    // Refresh data from API first
    await mutateForecasts();
    
    if (!forecasts || forecasts.length === 0) return;
    
    const allWeeks = forecasts.map(f => isoWeekToDate(f.deliveryWeek));
    const minDate = new Date(Math.min(...allWeeks.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allWeeks.map(d => d.getTime())));
    
    // Add 6 days to maxDate to include the entire last week (Monday + 6 days = Sunday)
    maxDate.setDate(maxDate.getDate() + 6);
    
    setStartDate(minDate.toISOString().split('T')[0]);
    setEndDate(maxDate.toISOString().split('T')[0]);
    
    console.log('📅 Reset to All - Date range:', {
      start: minDate.toISOString().split('T')[0],
      end: maxDate.toISOString().split('T')[0],
      totalForecasts: forecasts.length
    });
  };
  
  // Manual refresh function
  const handleRefresh = async () => {
    await mutateForecasts();
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Week', 'SKU', 'Quantity', 'Standard Cost', 'Std Cost Total', 'Sales Scenario', 'ASP', 'ASP Source', 'ASP Revenue Total'];
    const rows = filteredForecasts.map(f => {
      const standardCost = parseFloat(f.sku?.standardCost || '0');
      const extendedCost = f.quantity * standardCost;
      const selectedScenario = getSelectedScenario(f.id);
      const hasManualASP = manualASPs[f.id] !== undefined;
      const asp = getEffectiveASP(f.id);
      const extendedRevenue = f.quantity * asp;
      return [
      f.deliveryWeek,
      f.sku?.sku || '',
      f.quantity,
        standardCost.toFixed(2),
        extendedCost.toFixed(2),
        selectedScenario?.scenarioName || '',
        asp.toFixed(2),
        hasManualASP ? 'Manual Entry' : (selectedScenario ? 'Scenario' : 'None'),
        extendedRevenue.toFixed(2),
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-forecast-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Detailed Parameters to CSV
  const exportDetailedParametersToCSV = () => {
    // Get forecasts with scenarios
    const forecastsWithScenarios = filteredForecasts
      .map(f => ({
        forecast: f,
        scenario: getSelectedScenario(f.id)
      }))
      .filter(item => item.scenario !== null);
      
    if (forecastsWithScenarios.length === 0) {
      alert('No forecasts with scenarios to export');
      return;
    }
    
    // Build comprehensive headers
    const headers = [
      // Basic Info
      'Week', 'SKU', 'SKU Name', 'Quantity',
      // Scenario Info
      'Scenario Name', 'Channel', 'Country',
      // Pricing
      'ASP',
      // Fees & Advertising
      'FBA Fee %', 'FBA Fee $',
      'Amazon Referral %', 'Amazon Referral $',
      'ACOS %', 'ACOS $',
      // Net Sales
      'Net Sales',
      // Frontend Costs
      'Motorola Royalties %', 'Motorola Royalties $',
      'RTV Freight', 'RTV Repair',
      'DOA Credits %', 'DOA Credits $',
      'Invoice Factoring Net',
      'Sales Commissions %', 'Sales Commissions $',
      // Landed Costs
      'Import Duties %', 'Import Duties $',
      'Ex Works Standard',
      'Import Shipping Sea',
      'Gryphon Software',
      // Gross Profit
      'Gross Profit', 'Gross Margin %',
      // Extended Calculations
      'Std Cost', 'Std Cost Total', 'ASP Revenue Total'
    ];
    
    const rows = forecastsWithScenarios.map(({ forecast, scenario }) => {
      const standardCost = parseFloat(forecast.sku?.standardCost || '0');
      const extendedCost = forecast.quantity * standardCost;
      const asp = parseFloat(scenario!.asp || '0');
      const extendedRevenue = forecast.quantity * asp;
      
      return [
        forecast.deliveryWeek,
        forecast.sku?.sku || '',
        forecast.sku?.name || '',
        forecast.quantity,
        scenario!.scenarioName || '',
        scenario!.channel || '',
        scenario!.countryCode || '',
        scenario!.asp || '0',
        scenario!.fbaFeePercent || '0',
        scenario!.fbaFeeAmount || '0',
        scenario!.amazonReferralFeePercent || '0',
        scenario!.amazonReferralFeeAmount || '0',
        scenario!.acosPercent || '0',
        scenario!.acosAmount || '0',
        (parseFloat(scenario!.asp || '0') - 
         parseFloat(scenario!.fbaFeeAmount || '0') - 
         parseFloat(scenario!.amazonReferralFeeAmount || '0') - 
         parseFloat(scenario!.acosAmount || '0')).toFixed(2),
        scenario!.motorolaRoyaltiesPercent || '0',
        scenario!.motorolaRoyaltiesAmount || '0',
        scenario!.rtvFreightAssumptions || '0',
        scenario!.rtvRepairCosts || '0',
        scenario!.doaCreditsPercent || '0',
        scenario!.doaCreditsAmount || '0',
        scenario!.invoiceFactoringNet || '0',
        scenario!.salesCommissionsPercent || '0',
        scenario!.salesCommissionsAmount || '0',
        scenario!.importDutiesPercent || '0',
        scenario!.importDutiesAmount || '0',
        scenario!.exWorksStandard || '0',
        scenario!.importShippingSea || '0',
        scenario!.gryphonSoftware || '0',
        scenario!.grossProfit || '0',
        scenario!.grossMarginPercent || '0',
        standardCost.toFixed(2),
        extendedCost.toFixed(2),
        extendedRevenue.toFixed(2)
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detailed-parameters-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export chart as PNG
  const exportChartAsPNG = async () => {
    if (!chartRef.current) return;
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
      });
      
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `forecast-chart-${startDate}-to-${endDate}.png`;
      a.click();
    } catch (error) {
      console.error('Error exporting chart:', error);
      alert('Failed to export chart as PNG');
    }
  };

  // Save current analysis session
  const saveAnalysisSession = async () => {
    if (!sessionName.trim()) {
      alert('Please enter a session name');
      return;
    }

    setSavingSession(true);
    try {
      // Prepare selections data
      const selections = filteredForecasts.map(f => ({
        forecastId: f.id,
        skuScenarioId: forecastScenarios[f.id] || null,
        manualAsp: manualASPs[f.id] || null,
      }));

      const response = await fetch('/api/forecast-analysis-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionName,
          description: sessionDescription,
          startDate,
          endDate,
          selectedSkus: selectedSKUs, // Changed to array
          searchQuery,
          filters: {},
          selections,
        }),
      });

      if (response.ok) {
        alert('✅ Session saved successfully!');
        setShowSaveModal(false);
        setSessionName('');
        setSessionDescription('');
      } else {
        const error = await response.text();
        alert(`❌ Failed to save session: ${error}`);
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('❌ Error saving session');
    } finally {
      setSavingSession(false);
    }
  };

  // Load saved sessions
  const loadSavedSessions = async () => {
    try {
      const response = await fetch('/api/forecast-analysis-sessions');
      if (response.ok) {
        const data = await response.json();
        setSavedSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  // Load a specific session
  const loadAnalysisSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/forecast-analysis-sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const { session, selections } = data;

        // Restore filters
        setStartDate(session.startDate || '');
        setEndDate(session.endDate || '');
        // Handle both old format (selectedSku) and new format (selectedSkus)
        setSelectedSKUs(session.selectedSkus || (session.selectedSku && session.selectedSku !== 'all' ? [session.selectedSku] : []));
        setSearchQuery(session.searchQuery || '');

        // Restore scenario selections and manual ASPs
        const newForecastScenarios: Record<string, string> = {};
        const newManualASPs: Record<string, number> = {};

        selections.forEach((sel: any) => {
          if (sel.skuScenarioId) {
            newForecastScenarios[sel.forecastId] = sel.skuScenarioId;
          }
          if (sel.manualAsp) {
            newManualASPs[sel.forecastId] = parseFloat(sel.manualAsp);
          }
        });

        setForecastScenarios(newForecastScenarios);
        setManualASPs(newManualASPs);

        setShowLoadModal(false);
        alert('✅ Session loaded successfully!');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      alert('❌ Error loading session');
    }
  };

  // Load sessions when load modal opens
  useEffect(() => {
    if (showLoadModal) {
      loadSavedSessions();
    }
  }, [showLoadModal]);

  // Open configuration modal for a forecast
  const handleConfigure = async (forecast: Forecast) => {
    setSelectedForecast(forecast);
    setShowConfigModal(true);
    
    // Scenarios are already loaded via SWR at the top level
    // Filter logic is now in getScenariosForSKU() helper function
    
    // Check if this forecast already has a configuration
    try {
      const response = await fetch(`/api/forecast-scenarios?forecastId=${forecast.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          const config = data[0];
          // Load existing configuration
          setChannelType(config.channel_type);
          setSelectedScenarioId(config.sku_scenario_id || '');
          setSalesVelocity(config.sales_velocity || 0);
          setVelocityUnit(config.velocity_unit || 'per_day');
          setDaysToCash(config.days_to_cash || 0);
          setWarehouse(config.warehouse || '');
          setCustomerName(config.customer_name || '');
          setRegion(config.region || '');
          setNotes(config.notes || '');
          setUseFactoring(config.use_factoring || false);
          setFactoringInitialPercent(config.factoring_initial_percent || 85);
          setFactoringInitialDays(config.factoring_initial_days || 3);
          setFactoringRemainderPercent(config.factoring_remainder_percent || 15);
          setFactoringRemainderDays(config.factoring_remainder_days || 30);
          setInsurancePercent(config.insurance_percent || 0);
          setPickupLocation(config.pickup_location || 'Vietnam');
          setSalesVelocityUnitsPerDay(config.sales_velocity_units_per_day || 0);
          setLeadTimeDays(config.lead_time_days || 90);
          setBolHandoverDate(config.bol_handover_date || '');
        } else {
          // Reset to defaults for new configuration
          resetConfigForm();
        }
      }
    } catch (error) {
      console.error('Error loading existing configuration:', error);
      resetConfigForm();
    }
  };

  const resetConfigForm = () => {
    setChannelType('D2C');
    setSelectedScenarioId('');
    setSalesVelocity(0);
    setVelocityUnit('per_day');
    setDaysToCash(0);
    setWarehouse('');
    setCustomerName('');
    setRegion('');
    setNotes('');
    setUseFactoring(false);
    setFactoringInitialPercent(85);
    setFactoringInitialDays(3);
    setFactoringRemainderPercent(15);
    setFactoringRemainderDays(30);
    setInsurancePercent(0);
    setPickupLocation('Vietnam');
    setSalesVelocityUnitsPerDay(0);
    setLeadTimeDays(90);
    setBolHandoverDate('');
  };

  const saveConfiguration = async () => {
    if (!selectedForecast) return;

    setSavingConfig(true);
    try {
      const configData = {
        forecast_id: selectedForecast.id,
        channel_type: channelType,
        sku_scenario_id: selectedScenarioId || null,
        sales_velocity: salesVelocity,
        velocity_unit: velocityUnit,
        days_to_cash: daysToCash,
        warehouse: warehouse || null,
        customer_name: customerName || null,
        region: region || null,
        notes: notes || null,
        use_factoring: useFactoring,
        factoring_initial_percent: useFactoring ? factoringInitialPercent : null,
        factoring_initial_days: useFactoring ? factoringInitialDays : null,
        factoring_remainder_percent: useFactoring ? factoringRemainderPercent : null,
        factoring_remainder_days: useFactoring ? factoringRemainderDays : null,
        insurance_percent: insurancePercent || null,
        pickup_location: channelType === 'B2B' ? pickupLocation : null,
        sales_velocity_units_per_day: salesVelocityUnitsPerDay || null,
        lead_time_days: leadTimeDays || null,
        bol_handover_date: bolHandoverDate || null,
      };

      // Check if configuration exists
      const checkResponse = await fetch(`/api/forecast-scenarios?forecastId=${selectedForecast.id}`);
      const existing = checkResponse.ok ? await checkResponse.json() : [];

      let response;
      if (existing && existing.length > 0) {
        // Update existing
        response = await fetch('/api/forecast-scenarios', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...configData, id: existing[0].id }),
        });
      } else {
        // Create new
        response = await fetch('/api/forecast-scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData),
        });
      }

      if (response.ok) {
        alert('✅ Configuration saved successfully!');
        setShowConfigModal(false);
        // Optionally refresh the forecast list to show configured status
      } else {
        const error = await response.text();
        alert(`❌ Failed to save configuration: ${error}`);
      }
    } catch (error: any) {
      console.error('Error saving configuration:', error);
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading forecast data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push('/admin/business-analysis')}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <LineChartIcon className="h-8 w-8 text-blue-600" />
              Sales Forecast Analysis
            </h1>
            <p className="text-gray-600 mt-1">Timeline visualization of CPFR forecast data</p>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* SKU Filter - Multi-Select */}
            <div>
              <MultiSelectDropdown
                label="SKU"
                placeholder="All SKUs"
                options={(skus || []).map(sku => ({
                  value: sku.sku,
                  label: `${sku.sku} - ${sku.name}`
                }))}
                selectedValues={selectedSKUs}
                onChange={setSelectedSKUs}
                maxHeight="max-h-80"
              />
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search SKU or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col justify-end gap-2">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={loadingForecasts}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loadingForecasts ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleThirteenWeeks} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                13-Week
              </Button>
              <Button onClick={handleResetToAll} variant="outline" size="sm" disabled={loadingForecasts}>
                Reset to All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards - Units */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">📦 Unit Metrics</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Total Forecast</div>
            <div className="text-2xl font-bold text-blue-600">{totalQuantity.toLocaleString()}</div>
            <div className="text-xs text-gray-500">units</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Avg Weekly</div>
            <div className="text-2xl font-bold text-green-600">{Math.round(avgWeeklyQuantity).toLocaleString()}</div>
            <div className="text-xs text-gray-500">units/week</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Peak Week</div>
            <div className="text-2xl font-bold text-orange-600">{peakWeek.totalQuantity.toLocaleString()}</div>
            <div className="text-xs text-gray-500">{peakWeek.weekLabel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">SKUs</div>
            <div className="text-2xl font-bold text-purple-600">{uniqueSKUs}</div>
            <div className="text-xs text-gray-500">unique products</div>
            {missingCostCount > 0 && (
              <div className="mt-2 px-2 py-1 bg-red-50 border border-red-300 rounded">
                <p className="text-xs text-red-700 font-semibold">⚠️ {missingCostCount} missing cost{missingCostCount !== 1 ? 's' : ''}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards - Dollar Values */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">💵 Cost Metrics (Standard Cost)</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Total Value</div>
            <div className="text-2xl font-bold text-blue-600">${totalValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <div className="text-xs text-gray-500">total cost</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Avg Weekly Value</div>
            <div className="text-2xl font-bold text-green-600">${avgWeeklyValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <div className="text-xs text-gray-500">cost/week</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Peak Week Value</div>
            <div className="text-2xl font-bold text-orange-600">${peakWeekValue.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            <div className="text-xs text-gray-500">{peakWeekValue.weekLabel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Avg Unit Cost</div>
            <div className="text-2xl font-bold text-purple-600">${totalQuantity > 0 ? (totalValue / totalQuantity).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '0.00'}</div>
            <div className="text-xs text-gray-500">per unit</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Metrics Card - Styled like Profitability Analysis */}
      <Card className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            💰 Revenue Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total ASP Revenue */}
            <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 mb-1">Total ASP Revenue</div>
              <div className="text-2xl font-bold text-green-600 mb-1">
                ${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div className="text-xs text-gray-400">{forecastsWithASP}/{filteredForecasts.length} with ASP</div>
            </div>
            
            {/* Avg Weekly Revenue */}
            <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 mb-1">Avg Weekly Revenue</div>
              <div className="text-2xl font-bold text-blue-600 mb-1">
                ${avgWeeklyRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div className="text-xs text-gray-400">revenue/week</div>
            </div>
            
            {/* Peak Week Revenue */}
            <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 mb-1">Peak Week Revenue</div>
              <div className="text-2xl font-bold text-orange-600 mb-1">
                ${peakWeekRevenue.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div className="text-xs text-gray-400">{peakWeekRevenue.weekLabel}</div>
            </div>
            
            {/* Avg Unit ASP */}
            <div className="bg-white rounded-lg p-4 border border-green-100 shadow-sm">
              <div className="text-xs font-medium text-gray-500 mb-1">Avg Unit ASP</div>
              <div className="text-2xl font-bold text-purple-600 mb-1">
                ${avgUnitASP.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div className="text-xs text-gray-400">per unit</div>
            </div>
          </div>
          
          {/* SKU Financial Scenario Metrics */}
          <div className="mt-6 pt-6 border-t border-green-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-4">📊 SKU Financial Scenario Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Net Sales Revenue from Scenarios (using netSales field from API) */}
              <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">Net Sales Revenue</div>
                <div className="text-2xl font-bold text-emerald-600 mb-1">
                  ${(() => {
                    const netSalesTotal = filteredForecasts.reduce((sum, f) => {
                      const scenario = getSelectedScenario(f.id);
                      if (scenario && scenario.netSales) {
                        const unitNetSales = parseFloat(scenario.netSales);
                        return sum + (f.quantity * unitNetSales);
                      }
                      return sum;
                    }, 0);
                    return netSalesTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                  })()}
                </div>
                <div className="text-xs text-gray-400">from scenarios</div>
              </div>
              
              {/* Gross Profit - use grossProfit directly from scenario */}
              <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">Gross Profit (GP)</div>
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  ${(() => {
                    const totalGP = filteredForecasts.reduce((sum, f) => {
                      const scenario = getSelectedScenario(f.id);
                      if (scenario && scenario.grossProfit) {
                        const unitGP = parseFloat(scenario.grossProfit);
                        return sum + (f.quantity * unitGP);
                      }
                      return sum;
                    }, 0);
                    return totalGP.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
                  })()}
                </div>
                <div className="text-xs text-gray-400">from scenarios</div>
              </div>
              
              {/* Gross Margin - use grossMarginPercent directly from scenario (already calculated) */}
              <div className="bg-white rounded-lg p-4 border border-emerald-100 shadow-sm">
                <div className="text-xs font-medium text-gray-500 mb-1">Gross Margin (GM)</div>
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {(() => {
                    // Calculate weighted average GM% across all forecasts with scenarios
                    const totalGP = filteredForecasts.reduce((sum, f) => {
                      const scenario = getSelectedScenario(f.id);
                      if (scenario && scenario.grossProfit) {
                        return sum + (f.quantity * parseFloat(scenario.grossProfit));
                      }
                      return sum;
                    }, 0);
                    const totalNetSales = filteredForecasts.reduce((sum, f) => {
                      const scenario = getSelectedScenario(f.id);
                      if (scenario && scenario.netSales) {
                        return sum + (f.quantity * parseFloat(scenario.netSales));
                      }
                      return sum;
                    }, 0);
                    const weightedGM = totalNetSales > 0 ? (totalGP / totalNetSales) * 100 : 0;
                    return weightedGM.toFixed(2);
                  })()}%
                </div>
                <div className="text-xs text-gray-400">from scenarios</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Weekly Forecast Timeline
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setShowSaveModal(true)} variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Save Session
              </Button>
              <Button onClick={() => setShowLoadModal(true)} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Load Session
              </Button>
              <Button onClick={() => setShowWorksheetModal(true)} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Worksheet
              </Button>
              <Button onClick={exportChartAsPNG} variant="outline" size="sm">
                <ImageIcon className="w-4 h-4 mr-2" />
                Export PNG
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {weeklyData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No forecast data available for the selected period
            </div>
          ) : (
            <div ref={chartRef} className="overflow-x-auto bg-white p-4" style={{ overflow: 'visible' }}>
              <div className="min-w-[800px]" style={{ paddingTop: '120px', paddingBottom: '50px' }}>
                {/* Simple Stacked Bar Chart with Line Overlays */}
                <div className="relative" style={{ height: '400px' }}>
                  {/* Left Y-axis (Units) */}
                  <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-600 text-right pr-2">
                    {(() => {
                      const maxQty = Math.max(...weeklyData.map(w => w.totalQuantity), 1);
                      const steps = 5;
                      return Array.from({ length: steps + 1 }, (_, i) => {
                        const value = Math.round((maxQty / steps) * (steps - i));
                        return <div key={i}>{value.toLocaleString()}</div>;
                      });
                    })()}
                  </div>

                  {/* Right Y-axis (Dollars) */}
                  <div className="absolute right-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-gray-600 text-left pl-2">
                    {(() => {
                      const maxCost = Math.max(...weeklyData.map(w => w.totalCost), 1);
                      const maxRevenue = Math.max(...weeklyData.map(w => w.totalRevenue), 1);
                      const maxDollar = Math.max(maxCost, maxRevenue);
                      const steps = 5;
                      return Array.from({ length: steps + 1 }, (_, i) => {
                        const value = Math.round((maxDollar / steps) * (steps - i));
                        return <div key={i} className="text-green-600">${(value / 1000).toFixed(0)}K</div>;
                      });
                    })()}
                  </div>

                  {/* Chart bars */}
                  <div className="absolute left-12 right-16 top-0 bottom-8 border-l-2 border-r-2 border-b-2 border-gray-300">
                    <div className="flex items-end justify-around h-full gap-2 px-4" style={{ position: 'relative' }}>
                      {weeklyData.map((week, idx) => {
                        // Bars use unit scale only
                        const maxQty = Math.max(...weeklyData.map(w => w.totalQuantity), 1);
                        const barHeightPx = (week.totalQuantity / maxQty) * 350; // 350px max height
                        
                        // Define colors
                        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
                        const skus = Object.keys(week.skuBreakdown);
                        
                        return (
                          <div key={idx} className="relative flex flex-col items-center flex-1 max-w-[80px]">
                            {/* Bar container */}
                            <div 
                              className="w-full relative group cursor-pointer"
                              style={{ 
                                height: `${barHeightPx}px`,
                                minHeight: barHeightPx > 0 ? '5px' : '0px'
                              }}
                            >
                              {/* Stacked segments */}
                              <div className="w-full h-full flex flex-col-reverse rounded-t-md overflow-hidden border border-gray-200">
                                {skus.map((sku, skuIdx) => {
                                  const qty = week.skuBreakdown[sku];
                                  const segmentHeightPercent = (qty / week.totalQuantity) * 100;
                                  return (
                                    <div
                                      key={sku}
                                      style={{
                                        height: `${segmentHeightPercent}%`,
                                        backgroundColor: colors[skuIdx % colors.length],
                                        minHeight: '2px'
                                      }}
                                      title={`${sku}: ${qty}`}
                                    />
                                  );
                                })}
                              </div>
                              
                              {/* Tooltip - shows above for short bars, below for tall bars */}
                              <div className={`hidden group-hover:block absolute left-1/2 transform -translate-x-1/2 ${barHeightPx > 250 ? 'top-full mt-2' : 'bottom-full mb-2'} bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-20 shadow-lg`}>
                                <div className="font-bold mb-1">{week.weekLabel}</div>
                                <div className="text-blue-300 mb-1">{week.totalQuantity.toLocaleString()} units</div>
                                <div className="text-green-300 mb-1">💰 Cost: ${week.totalCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
                                <div className="text-purple-300 mb-2">💵 Revenue: ${week.totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
                                <div className="border-t border-gray-600 pt-1 space-y-1">
                                  {Object.entries(week.skuBreakdown)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([sku, qty], i) => (
                                      <div key={sku} className="flex items-center gap-2">
                                        <div 
                                          className="w-2 h-2 rounded-full" 
                                          style={{ backgroundColor: colors[skus.indexOf(sku) % colors.length] }}
                                        />
                                        <span>{sku}: {qty.toLocaleString()}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Week label - rotated at 45 degrees */}
                            <div className="absolute text-xs text-gray-600 font-medium whitespace-nowrap" style={{ 
                              bottom: '-35px',
                              left: '50%',
                              transform: 'rotate(-45deg) translateX(-50%)',
                              transformOrigin: 'top left'
                            }}>
                              {week.weekLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Line Overlays for Cost and Revenue - use dollar scale */}
                    <svg className="absolute left-0 top-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                      {(() => {
                        // Use dollar values for line scaling (separate from unit bars)
                        const maxCost = Math.max(...weeklyData.map(w => w.totalCost), 1);
                        const maxRevenue = Math.max(...weeklyData.map(w => w.totalRevenue), 1);
                        const maxDollar = Math.max(maxCost, maxRevenue);
                        
                        // Get the SVG dimensions (match the chart area)
                        const chartHeight = 350; // pixels (matching bar max height)
                        const padding = 16; // px-4 = 16px padding on each side
                        const chartWidth = 100; // We'll use percentage for proper alignment with justify-around
                        
                        return (
                          <>
                            {/* Cost Points */}
                            {weeklyData.map((week, idx) => {
                              const xPercent = ((2 * idx + 1) / (2 * weeklyData.length)) * chartWidth;
                              const y = chartHeight - ((week.totalCost / maxDollar) * chartHeight);
                              return (
                                <circle
                                  key={`cost-${idx}`}
                                  cx={`${xPercent}%`}
                                  cy={y}
                                  r="6"
                                  fill="#10B981"
                                  stroke="white"
                                  strokeWidth="2"
                                />
                              );
                            })}
                            
                            {/* Revenue Points */}
                            {weeklyData.map((week, idx) => {
                              const xPercent = ((2 * idx + 1) / (2 * weeklyData.length)) * chartWidth;
                              const y = chartHeight - ((week.totalRevenue / maxDollar) * chartHeight);
                              return (
                                <circle
                                  key={`revenue-${idx}`}
                                  cx={`${xPercent}%`}
                                  cy={y}
                                  r="6"
                                  fill="#8B5CF6"
                                  stroke="white"
                                  strokeWidth="2"
                                />
                              );
                            })}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-8">
                  <div className="flex flex-wrap gap-6 justify-center mb-4">
                    {/* Dot Legend */}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
                      <span className="text-sm font-medium text-gray-700">💰 Std Cost Total (right axis)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-white"></div>
                      <span className="text-sm font-medium text-gray-700">💵 ASP Revenue Total (right axis)</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {(() => {
                      const allSkus = Array.from(new Set(
                        filteredForecasts.map(f => f.sku?.sku).filter(Boolean)
                      ));
                      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
                      
                      return allSkus.map((sku, i) => (
                        <div key={sku} className="flex items-center gap-2">
                          <div 
                            className="w-4 h-4 rounded" 
                            style={{ backgroundColor: colors[i % colors.length] }}
                          />
                          <span className="text-sm font-mono font-medium">{sku}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forecast Details</CardTitle>
        </CardHeader>
        <CardContent>
          {missingCostCount > 0 && (
            <div className="mb-4 px-4 py-3 bg-red-50 border-l-4 border-red-500 rounded">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-semibold text-red-800">Missing Standard Costs</h3>
                  <p className="text-sm text-red-700 mt-1">
                    {missingCostCount} forecast{missingCostCount !== 1 ? 's have' : ' has'} SKUs with no Standard Cost set. 
                    These rows are highlighted in red below. Please update the SKU Standard Cost in the SKU management page.
                  </p>
                </div>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Week</th>
                  <th className="px-4 py-2 text-left font-semibold">SKU</th>
                  <th className="px-4 py-2 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-2 text-right font-semibold">Std Cost</th>
                  <th className="px-4 py-2 text-right font-semibold">Std Cost Total</th>
                  <th className="px-4 py-2 text-left font-semibold">Sales Scenario</th>
                  <th className="px-4 py-2 text-right font-semibold">ASP</th>
                  <th className="px-4 py-2 text-right font-semibold">ASP Revenue Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredForecasts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No forecasts match your filters
                    </td>
                  </tr>
                ) : (
                  filteredForecasts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((forecast, idx) => {
                    const standardCost = parseFloat(forecast.sku?.standardCost || '0');
                    const extendedCost = forecast.quantity * standardCost;
                    const isMissingCost = standardCost === 0;
                    
                    // Get effective ASP (manual entry or from scenario)
                    const asp = getEffectiveASP(forecast.id);
                    const extendedRevenue = forecast.quantity * asp;
                    const hasManualASP = manualASPs[forecast.id] !== undefined;
                    
                    // Get available scenarios for this SKU
                    const skuScenarios = getScenariosForSKU(forecast.sku?.sku || '');
                    
                    return (
                      <tr key={idx} className={`hover:bg-gray-50 ${isMissingCost ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-2">{forecast.deliveryWeek}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {forecast.sku?.sku || '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {forecast.quantity.toLocaleString()}
                      </td>
                        <td className={`px-4 py-2 text-right ${isMissingCost ? 'text-red-600 font-bold' : 'text-gray-700'}`}>
                          {isMissingCost ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs bg-red-100 px-2 py-1 rounded">⚠️ Not Set</span>
                              <span>${standardCost.toFixed(2)}</span>
                            </div>
                          ) : (
                            `$${standardCost.toFixed(2)}`
                          )}
                      </td>
                        <td className={`px-4 py-2 text-right font-semibold ${isMissingCost ? 'text-red-600' : 'text-green-700'}`}>
                          ${extendedCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </td>
                        <td className="px-2 py-2">
                          <Select 
                            value={forecastScenarios[forecast.id] || ''} 
                            onValueChange={(value) => handleScenarioChange(forecast.id, value)}
                          >
                            <SelectTrigger className="h-7 text-xs min-w-[200px]">
                              <SelectValue placeholder={skuScenarios.length > 0 ? "Select scenario..." : "No scenarios"} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[200px]" position="popper" sideOffset={5}>
                              {skuScenarios.length === 0 ? (
                                <SelectItem value="none" disabled>No scenarios available</SelectItem>
                              ) : (
                                skuScenarios.map((scenario: any) => (
                                  <SelectItem key={scenario.id} value={scenario.id} className="text-xs">
                                    {scenario.scenarioName} - ${parseFloat(scenario.asp || '0').toFixed(2)}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Manual"
                              value={manualASPs[forecast.id] || ''}
                              onChange={(e) => handleManualASPChange(forecast.id, e.target.value)}
                              className={`h-7 text-xs w-24 text-right ${hasManualASP ? 'bg-yellow-50 border-yellow-400' : ''}`}
                            />
                            {hasManualASP && (
                              <span className="text-xs text-yellow-600 font-semibold">✏️</span>
                            )}
                            {!hasManualASP && asp > 0 && (
                              <span className="text-xs text-blue-600 font-semibold">${asp.toFixed(2)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-blue-700">
                          {asp > 0 ? `$${extendedRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '-'}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {filteredForecasts.length > 0 && (
              <div className="flex items-center justify-between px-4 py-4 border-t">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredForecasts.length)} of {filteredForecasts.length} forecasts
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3">
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {Math.ceil(filteredForecasts.length / itemsPerPage)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredForecasts.length / itemsPerPage), prev + 1))}
                    disabled={currentPage >= Math.ceil(filteredForecasts.length / itemsPerPage)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Cost Parameters Table */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                📊 Detailed Cost Parameters
                <span className="text-sm font-normal text-gray-500">
                  ({filteredForecasts.filter(f => getSelectedScenario(f.id) !== null).length} forecasts with scenarios)
                </span>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Complete breakdown of all cost parameters from selected SKU scenarios
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowDetailedTable(!showDetailedTable)} 
                variant="outline" 
                size="sm"
              >
                {showDetailedTable ? 'Hide' : 'Show'} Details
              </Button>
              <Button 
                onClick={exportDetailedParametersToCSV} 
                variant="default" 
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {showDetailedTable && (
          <CardContent>
            {/* Filters */}
            <div className="space-y-3 mb-4">
              {/* Search Box */}
              <div className="w-full">
                <Input
                  type="text"
                  placeholder="Search by SKU, scenario name, or week..."
                  value={detailedTableSearch}
                  onChange={(e) => setDetailedTableSearch(e.target.value)}
                  className="w-full"
                />
              </div>
              
              {/* Filter Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Channel Filter */}
                <Select value={detailedTableChannelFilter} onValueChange={setDetailedTableChannelFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Channels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    {Array.from(new Set(
                      filteredForecasts
                        .map(f => getSelectedScenario(f.id))
                        .filter(s => s !== null)
                        .map(s => s!.channel)
                    )).sort().map(channel => (
                      <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Country Filter */}
                <Select value={detailedTableCountryFilter} onValueChange={setDetailedTableCountryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {Array.from(new Set(
                      filteredForecasts
                        .map(f => getSelectedScenario(f.id))
                        .filter(s => s !== null)
                        .map(s => s!.countryCode)
                    )).sort().map(country => (
                      <SelectItem key={country} value={country}>{country}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* SKU Filter */}
                <Select value={detailedTableSKUFilter} onValueChange={setDetailedTableSKUFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All SKUs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All SKUs</SelectItem>
                    {Array.from(new Set(
                      filteredForecasts
                        .filter(f => getSelectedScenario(f.id) !== null)
                        .map(f => f.sku?.sku)
                        .filter(Boolean)
                    )).sort().map(sku => (
                      <SelectItem key={sku} value={sku!}>{sku}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Week Filter */}
                <Select value={detailedTableWeekFilter} onValueChange={setDetailedTableWeekFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Weeks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Weeks</SelectItem>
                    {Array.from(new Set(
                      filteredForecasts
                        .filter(f => getSelectedScenario(f.id) !== null)
                        .map(f => f.deliveryWeek)
                    )).sort().map(week => (
                      <SelectItem key={week} value={week}>{week}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-[10px]">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    {/* Basic Info */}
                    <th className="px-2 py-1.5 text-left font-semibold border-r text-[9px]">Week</th>
                    <th className="px-2 py-1.5 text-left font-semibold border-r text-[9px]">SKU</th>
                    <th className="px-2 py-1.5 text-left font-semibold border-r text-[9px]">SKU Name</th>
                    <th className="px-2 py-1.5 text-right font-semibold border-r text-[9px]">Qty</th>
                    {/* Scenario Info */}
                    <th className="px-2 py-1.5 text-left font-semibold bg-blue-50 border-r text-[9px]">Scenario</th>
                    <th className="px-2 py-1.5 text-left font-semibold bg-blue-50 border-r text-[9px]">Channel</th>
                    <th className="px-2 py-1.5 text-left font-semibold bg-blue-50 border-r text-[9px]">Country</th>
                    {/* Pricing */}
                    <th className="px-2 py-1.5 text-right font-semibold bg-green-50 border-r text-[9px]">ASP</th>
                    {/* Fees & Advertising */}
                    <th className="px-2 py-1.5 text-right font-semibold bg-yellow-50 border-r text-[9px]">FBA %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-yellow-50 border-r text-[9px]">FBA $</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-yellow-50 border-r text-[9px]">Ref %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-yellow-50 border-r text-[9px]">Ref $</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-yellow-50 border-r text-[9px]">ACOS %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-yellow-50 border-r text-[9px]">ACOS $</th>
                    {/* Net Sales */}
                    <th className="px-2 py-1.5 text-right font-semibold bg-emerald-50 border-r text-[9px]">Net Sales</th>
                    {/* Frontend Costs */}
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">Roy %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">Roy $</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">RTV Frt</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">RTV Rep</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">DOA %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">DOA $</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">Factor</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">Comm %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-orange-50 border-r text-[9px]">Comm $</th>
                    {/* Landed Costs */}
                    <th className="px-2 py-1.5 text-right font-semibold bg-purple-50 border-r text-[9px]">Duty %</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-purple-50 border-r text-[9px]">Duty $</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-purple-50 border-r text-[9px]">Ex Works</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-purple-50 border-r text-[9px]">Ship</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-purple-50 border-r text-[9px]">Gryphon</th>
                    {/* Gross Profit */}
                    <th className="px-2 py-1.5 text-right font-semibold bg-indigo-100 text-[9px]">GP $</th>
                    <th className="px-2 py-1.5 text-right font-semibold bg-indigo-100 text-[9px]">GP %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    const forecastsWithScenarios = filteredForecasts
                      .map(f => ({
                        forecast: f,
                        scenario: getSelectedScenario(f.id)
                      }))
                      .filter(item => item.scenario !== null)
                      .filter(item => {
                        const search = detailedTableSearch.toLowerCase();
                        const matchesSearch = !search || 
                          item.forecast.sku?.sku?.toLowerCase().includes(search) ||
                          item.forecast.sku?.name?.toLowerCase().includes(search) ||
                          item.scenario!.scenarioName?.toLowerCase().includes(search) ||
                          item.forecast.deliveryWeek.toLowerCase().includes(search);
                        
                        const matchesChannel = detailedTableChannelFilter === 'all' || 
                          item.scenario!.channel === detailedTableChannelFilter;
                        
                        const matchesCountry = detailedTableCountryFilter === 'all' || 
                          item.scenario!.countryCode === detailedTableCountryFilter;
                        
                        const matchesSKU = detailedTableSKUFilter === 'all' || 
                          item.forecast.sku?.sku === detailedTableSKUFilter;
                        
                        const matchesWeek = detailedTableWeekFilter === 'all' || 
                          item.forecast.deliveryWeek === detailedTableWeekFilter;
                        
                        return matchesSearch && matchesChannel && matchesCountry && matchesSKU && matchesWeek;
                      });

                    if (forecastsWithScenarios.length === 0) {
                      return (
                        <tr>
                          <td colSpan={31} className="px-4 py-6 text-center text-gray-500 text-xs">
                            No forecasts with scenarios match your filters
                          </td>
                        </tr>
                      );
                    }

                    return forecastsWithScenarios.map(({ forecast, scenario }) => {
                      const asp = parseFloat(scenario!.asp || '0');
                      const fbaFeeAmt = parseFloat(scenario!.fbaFeeAmount || '0');
                      const amzRefAmt = parseFloat(scenario!.amazonReferralFeeAmount || '0');
                      const acosAmt = parseFloat(scenario!.acosAmount || '0');
                      const netSales = asp - fbaFeeAmt - amzRefAmt - acosAmt;

                      return (
                        <tr key={forecast.id} className="hover:bg-gray-50">
                          <td className="px-2 py-1 border-r whitespace-nowrap">{forecast.deliveryWeek}</td>
                          <td className="px-2 py-1 font-mono border-r whitespace-nowrap">{forecast.sku?.sku}</td>
                          <td className="px-2 py-1 border-r truncate max-w-[120px]" title={forecast.sku?.name}>
                            {forecast.sku?.name}
                          </td>
                          <td className="px-2 py-1 text-right font-semibold border-r">{forecast.quantity.toLocaleString()}</td>
                          <td className="px-2 py-1 bg-blue-50 border-r truncate max-w-[100px]" title={scenario!.scenarioName}>
                            {scenario!.scenarioName}
                          </td>
                          <td className="px-2 py-1 bg-blue-50 border-r whitespace-nowrap">{scenario!.channel}</td>
                          <td className="px-2 py-1 bg-blue-50 border-r">{scenario!.countryCode}</td>
                          <td className="px-2 py-1 text-right bg-green-50 border-r">${asp.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-yellow-50 border-r">{scenario!.fbaFeePercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-yellow-50 border-r">${parseFloat(scenario!.fbaFeeAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-yellow-50 border-r">{scenario!.amazonReferralFeePercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-yellow-50 border-r">${parseFloat(scenario!.amazonReferralFeeAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-yellow-50 border-r">{scenario!.acosPercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-yellow-50 border-r">${parseFloat(scenario!.acosAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-semibold bg-emerald-50 border-r">${netSales.toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">{scenario!.motorolaRoyaltiesPercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">${parseFloat(scenario!.motorolaRoyaltiesAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">${parseFloat(scenario!.rtvFreightAssumptions || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">${parseFloat(scenario!.rtvRepairCosts || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">{scenario!.doaCreditsPercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">${parseFloat(scenario!.doaCreditsAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">${parseFloat(scenario!.invoiceFactoringNet || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">{scenario!.salesCommissionsPercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-orange-50 border-r">${parseFloat(scenario!.salesCommissionsAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-purple-50 border-r">{scenario!.importDutiesPercent || '0'}%</td>
                          <td className="px-2 py-1 text-right bg-purple-50 border-r">${parseFloat(scenario!.importDutiesAmount || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-purple-50 border-r">${parseFloat(scenario!.exWorksStandard || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-purple-50 border-r">${parseFloat(scenario!.importShippingSea || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right bg-purple-50 border-r">${parseFloat(scenario!.gryphonSoftware || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-bold bg-indigo-100 text-green-700">${parseFloat(scenario!.grossProfit || '0').toFixed(2)}</td>
                          <td className="px-2 py-1 text-right font-bold bg-indigo-100 text-green-700">{parseFloat(scenario!.grossMarginPercent || '0').toFixed(2)}%</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-gray-600">
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-blue-50 border"></div>
                  <span>Scenario Info</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-yellow-50 border"></div>
                  <span>Fees & Advertising</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-orange-50 border"></div>
                  <span>Frontend Costs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-purple-50 border"></div>
                  <span>Landed Costs</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-indigo-100 border"></div>
                  <span>Gross Profit</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Worksheet Modal */}
      {showWorksheetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-[98vw] max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet className="h-7 w-7 text-green-600" />
                  Sales Forecast Worksheet
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure channel scenarios, cash flow timing, and sales velocity
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorksheetModal(false)}
                className="hover:bg-green-100"
              >
                <span className="text-2xl">&times;</span>
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Instructions Card */}
                <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-blue-900 mb-2">📊 Worksheet Overview</h3>
                    <p className="text-sm text-blue-800">
                      For each forecast, configure the channel type (D2C or B2B), link to a SKU financial scenario,
                      set sales velocity, and define cash flow timing. This will generate detailed cash flow projections
                      showing booked vs. received revenue, and calculate reorder triggers based on inventory levels.
                    </p>
                  </CardContent>
                </Card>

                {/* Worksheet Filters */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Filter Forecasts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Sort by Week */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sort by Week
                        </label>
                        <Select value={worksheetSortOrder} onValueChange={(value: 'asc' | 'desc') => setWorksheetSortOrder(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="asc">📅 Earliest First</SelectItem>
                            <SelectItem value="desc">📅 Latest First</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filter by SKU */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Filter by SKU
                        </label>
                        <Select value={worksheetSKUFilter} onValueChange={setWorksheetSKUFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All SKUs</SelectItem>
                            {Array.from(new Set(filteredForecasts.map(f => f.sku?.sku).filter(Boolean))).sort().map(sku => (
                              <SelectItem key={sku} value={sku!}>{sku}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Filter by Manufacturer */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Filter by Manufacturer
                        </label>
                        <Select value={worksheetManufacturerFilter} onValueChange={setWorksheetManufacturerFilter}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Manufacturers</SelectItem>
                            {Array.from(new Set(filteredForecasts.map(f => f.sku?.mfg).filter(Boolean))).sort().map(mfg => (
                              <SelectItem key={mfg} value={mfg!}>{mfg}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Active Filters Display */}
                    {(worksheetSKUFilter !== 'all' || worksheetManufacturerFilter !== 'all') && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="text-xs text-gray-600">Active filters:</span>
                        {worksheetSKUFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                            SKU: {worksheetSKUFilter}
                            <button onClick={() => setWorksheetSKUFilter('all')} className="hover:text-blue-900">×</button>
                          </span>
                        )}
                        {worksheetManufacturerFilter !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                            Mfg: {worksheetManufacturerFilter}
                            <button onClick={() => setWorksheetManufacturerFilter('all')} className="hover:text-green-900">×</button>
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setWorksheetSKUFilter('all');
                            setWorksheetManufacturerFilter('all');
                          }}
                          className="text-xs text-gray-600 hover:text-gray-900 underline"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Forecast List */}
                <div className="space-y-4">
                  {(() => {
                    // Apply worksheet-specific filters
                    let worksheetFiltered = [...filteredForecasts];
                    
                    // Filter by SKU
                    if (worksheetSKUFilter !== 'all') {
                      worksheetFiltered = worksheetFiltered.filter(f => f.sku?.sku === worksheetSKUFilter);
                    }
                    
                    // Filter by Manufacturer
                    if (worksheetManufacturerFilter !== 'all') {
                      worksheetFiltered = worksheetFiltered.filter(f => f.sku?.mfg === worksheetManufacturerFilter);
                    }
                    
                    // Sort by week
                    worksheetFiltered.sort((a, b) => {
                      if (worksheetSortOrder === 'asc') {
                        return a.deliveryWeek.localeCompare(b.deliveryWeek);
                      } else {
                        return b.deliveryWeek.localeCompare(a.deliveryWeek);
                      }
                    });

                    return (
                      <>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Configure Forecasts ({worksheetFiltered.length} {worksheetFiltered.length === 1 ? 'item' : 'items'})
                        </h3>
                        
                        {worksheetFiltered.length === 0 ? (
                          <Card>
                            <CardContent className="py-12 text-center text-gray-500">
                              No forecasts match your filters. Try adjusting the filters above.
                            </CardContent>
                          </Card>
                        ) : (
                          worksheetFiltered.slice(0, 20).map((forecast) => (
                      <Card key={forecast.id} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base font-semibold flex items-center gap-2">
                                📦 {forecast.sku?.sku || 'Unknown SKU'}
                              </CardTitle>
                              <p className="text-sm text-gray-600 mt-1">
                                {forecast.deliveryWeek} • {forecast.quantity.toLocaleString()} units
                              </p>
                              {forecast.sku?.mfg && (
                                <p className="text-xs text-gray-500 mt-1">
                                  🏭 {forecast.sku.mfg}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleConfigure(forecast)}
                            >
                              Configure →
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Channel:</span>
                              <span className="ml-2 font-medium text-gray-400">Not configured</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Scenario:</span>
                              <span className="ml-2 font-medium text-gray-400">Not linked</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Velocity:</span>
                              <span className="ml-2 font-medium text-gray-400">Not set</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Cash Timing:</span>
                              <span className="ml-2 font-medium text-gray-400">Not set</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                            ))
                        )}
                        
                        {worksheetFiltered.length > 20 && (
                          <Card className="bg-gray-50">
                            <CardContent className="py-4 text-center text-sm text-gray-600">
                              Showing first 20 of {worksheetFiltered.length} forecasts. 
                              Use filters above to narrow down results.
                            </CardContent>
                          </Card>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Coming Soon Features */}
                <Card className="border-l-4 border-l-yellow-500 bg-yellow-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-yellow-900 mb-2">🚧 Coming Next</h3>
                    <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                      <li>Channel configuration (D2C / B2B)</li>
                      <li>SKU Financial Scenario linking (ASP, margins, costs)</li>
                      <li>Sales velocity input (units/day or units/week)</li>
                      <li>Cash flow timing rules (days to receive cash)</li>
                      <li>B2B factoring options (85/15 splits, etc.)</li>
                      <li>Reorder triggers based on DSOH</li>
                      <li>Individual forecast graphs (booked vs. received revenue)</li>
                      <li>Consolidated dashboard (all forecasts stacked)</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4 bg-gray-50 flex justify-between">
              <div className="text-sm text-gray-600">
                💡 <strong>Tip:</strong> Start by configuring your most critical forecasts first
              </div>
              <Button
                onClick={() => setShowWorksheetModal(false)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {showConfigModal && selectedForecast && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-[98vw] max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  ⚙️ Configure Forecast
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedForecast.sku?.sku} • {selectedForecast.deliveryWeek} • {selectedForecast.quantity.toLocaleString()} units
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfigModal(false)}
                className="hover:bg-purple-100"
              >
                <span className="text-2xl">&times;</span>
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Channel Type Selection - Compact */}
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <Label>📡 Channel Type</Label>
                    <Select value={channelType} onValueChange={(value: 'D2C' | 'B2B') => setChannelType(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel type" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={5} className="z-[70]">
                        <SelectItem value="D2C">🛒 D2C - Direct to Consumer</SelectItem>
                        <SelectItem value="B2B">🏢 B2B - Business to Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* SKU Financial Scenario */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">💰 SKU Financial Scenario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingScenarios ? (
                      <div className="text-center py-4 text-gray-500">Loading scenarios...</div>
                    ) : (
                      <div className="space-y-4">
                        {(() => {
                          const skuScenarios = selectedForecast ? getScenariosForSKU(selectedForecast.sku?.sku || '') : [];
                          return (
                            <>
                              {skuScenarios.length > 0 ? (
                          <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded p-2 mb-2">
                                  ✓ Found {skuScenarios.length} scenario{skuScenarios.length !== 1 ? 's' : ''} for SKU: <strong>{selectedForecast?.sku?.sku}</strong>
                          </div>
                        ) : (
                          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2 mb-2">
                            ⚠️ No scenarios found for SKU: <strong>{selectedForecast?.sku?.sku}</strong>
                          </div>
                        )}
                        <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
                          <SelectTrigger className="w-full">
                                  <SelectValue placeholder={skuScenarios.length > 0 ? "Select a scenario" : "No scenarios available"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px] z-[70]" position="popper" sideOffset={5}>
                                  {skuScenarios.length === 0 ? (
                              <SelectItem value="none" disabled>No scenarios match this SKU</SelectItem>
                            ) : (
                                    skuScenarios.map((scenario, index) => {
                                console.log(`Rendering scenario ${index + 1}:`, scenario.scenarioName, scenario.skuName, scenario.asp);
                                return (
                                  <SelectItem key={scenario.id} value={scenario.id}>
                                    {scenario.scenarioName} - {scenario.skuName} - ${parseFloat(scenario.asp || '0').toFixed(2)} ({scenario.channel || 'N/A'})
                                  </SelectItem>
                                );
                              })
                            )}
                          </SelectContent>
                        </Select>
                            </>
                          );
                        })()}

                        {selectedScenarioId && scenarios && scenarios.find((s: any) => s.id === selectedScenarioId) && (() => {
                          const selectedScenario = scenarios.find((s: any) => s.id === selectedScenarioId);
                          if (!selectedScenario) return null;
                          
                          const asp = parseFloat(selectedScenario.asp || '0');
                          const gp = parseFloat(selectedScenario.grossProfit || '0');
                          const gpPercent = parseFloat(selectedScenario.grossMarginPercent || '0');
                          const quantity = selectedForecast?.quantity || 0;
                          
                          const totalRevenue = asp * quantity;
                          const totalGrossProfit = gp * quantity;
                          
                          return (
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-3 shadow-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-900">💰 Profitability Analysis</h4>
                                <div className="flex items-center gap-2">
                                  {channelType === 'B2B' && (
                                    <label className="flex items-center gap-1 bg-white px-2 py-1 rounded-full border border-purple-300 cursor-pointer hover:bg-purple-50">
                                      <input
                                        type="checkbox"
                                        checked={useFactoring}
                                        onChange={(e) => setUseFactoring(e.target.checked)}
                                        className="w-3 h-3"
                                      />
                                      <span className="text-xs font-medium">💳 Use Factoring</span>
                                    </label>
                                  )}
                                  <span className="text-xs bg-white px-2 py-1 rounded-full border border-gray-300">
                                    {quantity.toLocaleString()} units
                                  </span>
                                </div>
                              </div>
                              
                              {/* Main Grid - Compact Layout */}
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-3">
                                {/* Per Unit Metrics - Compact */}
                                <div className="md:col-span-3 bg-white rounded p-2 border border-gray-200">
                                  <p className="text-xs text-gray-500 mb-2 font-semibold">Per Unit</p>
                                  <div className="space-y-1.5">
                                    <div>
                                      <p className="text-xs text-gray-600">ASP:</p>
                                      <p className="text-base font-bold text-green-600">${asp.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-600">GP:</p>
                                      <p className="text-base font-bold text-blue-600">${gp.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-600">GP %:</p>
                                      <p className="text-base font-bold text-purple-600">{gpPercent.toFixed(2)}%</p>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Total Forecast Impact + BOL Date + Sales Velocity + Lead Time */}
                                <div className="md:col-span-9 bg-white rounded p-2 border-2 border-green-300">
                                  <p className="text-xs text-gray-500 mb-2 font-semibold">Total Forecast Impact</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
                                    <div>
                                      <p className="text-xs text-gray-600">Total Revenue:</p>
                                      <p className="text-lg font-bold text-green-600">${totalRevenue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                      <p className="text-xs text-gray-500">{quantity.toLocaleString()} × ${asp.toFixed(2)}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-gray-600">Total Gross Profit:</p>
                                      <p className="text-lg font-bold text-blue-600">${totalGrossProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                                      <p className="text-xs text-gray-500">{quantity.toLocaleString()} × ${gp.toFixed(2)}</p>
                              </div>
                              
                                    {/* BOL Handover Date - Compact */}
                              {channelType === 'B2B' && (
                                      <div>
                                        <Label className="text-xs text-gray-600">📦 BOL Handover Date</Label>
                                        <Input
                                          type="date"
                                          value={bolHandoverDate || (() => {
                                            if (!selectedForecast?.deliveryWeek) return '';
                                            const [year, week] = selectedForecast.deliveryWeek.split('-W');
                                            const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
                                            const day = date.getDay();
                                            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                                            const monday = new Date(date.setDate(diff));
                                            return monday.toISOString().split('T')[0];
                                          })()}
                                          onChange={(e) => setBolHandoverDate(e.target.value)}
                                          className="h-8 text-xs mt-1"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Week: {selectedForecast?.deliveryWeek}</p>
                                      </div>
                                    )}
                                    
                                    {/* Sales Velocity */}
                                    <div>
                                      <Label className="text-xs text-gray-600">📊 Sales Velocity</Label>
                                        <Input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        value={salesVelocityUnitsPerDay || ''}
                                        onChange={(e) => setSalesVelocityUnitsPerDay(parseFloat(e.target.value) || 0)}
                                        placeholder="0"
                                        className="h-8 text-xs mt-1"
                                      />
                                      <p className="text-xs text-gray-500 mt-1">units/day</p>
                                    </div>
                                  </div>
                                  
                                  {/* Second row - Lead Time and Reorder Date */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                                    {/* Lead Time */}
                                    <div>
                                      <Label className="text-xs text-gray-600">⏱️ Lead Time</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={leadTimeDays || ''}
                                        onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 90)}
                                        placeholder="90"
                                        className="h-8 text-xs mt-1"
                                      />
                                      <p className="text-xs text-gray-500 mt-1">days (typically 90)</p>
                                    </div>
                                    
                                    {/* Reorder Date - Calculated */}
                                    <div className="bg-purple-50 rounded p-2 border border-purple-300">
                                      <Label className="text-xs text-purple-700 font-semibold mb-1 block">🔔 Reorder Date</Label>
                                      {(() => {
                                        if (!bolHandoverDate && !selectedForecast?.deliveryWeek) return <p className="text-sm text-gray-500">N/A</p>;
                                        if (salesVelocityUnitsPerDay <= 0 || leadTimeDays <= 0) return <p className="text-sm text-gray-500">Set velocity & lead time</p>;
                                        
                                        // Use BOL date if set, otherwise calculate from delivery week
                                        let baseDate: Date;
                                        if (bolHandoverDate) {
                                          baseDate = new Date(bolHandoverDate);
                                        } else {
                                            const [year, week] = selectedForecast.deliveryWeek.split('-W');
                                            const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
                                            const day = date.getDay();
                                            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                                          baseDate = new Date(date.setDate(diff));
                                        }
                                        
                                        // Calculate days of stock on hand
                                        const daysOfStock = quantity / salesVelocityUnitsPerDay;
                                        
                                        // Reorder date = BOL date + days of stock - lead time
                                        const reorderDate = new Date(baseDate);
                                        reorderDate.setDate(reorderDate.getDate() + daysOfStock - leadTimeDays);
                                        
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const isInPast = reorderDate < today;
                                        
                                        // First available reorder date = today + lead time
                                        const firstAvailableDate = new Date(today);
                                        firstAvailableDate.setDate(firstAvailableDate.getDate() + leadTimeDays);
                                        
                                        return (
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <p className={`text-base font-bold ${isInPast ? 'text-red-600 line-through' : 'text-purple-600'}`}>
                                                {reorderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                              </p>
                                              <p className="text-xs text-purple-600">
                                                {`${daysOfStock.toFixed(1)} days of stock`}
                                              </p>
                                            </div>
                                            {isInPast && (
                                              <div className="bg-red-50 border border-red-300 rounded p-1.5 mt-1">
                                                <p className="text-xs text-red-700 font-semibold mb-0.5">⚠️ Date has passed!</p>
                                                <p className="text-xs text-red-600">
                                                  First available: <span className="font-bold">{firstAvailableDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                </p>
                                                <p className="text-xs text-red-500">
                                                  (Today + {leadTimeDays} day lead time)
                                                </p>
                                              </div>
                                            )}
                                          </div>
                                        );
                                          })()}
                                    </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                              <div className="text-xs text-gray-600 bg-white rounded px-2 py-1 border border-gray-200 mb-2">
                                <strong>Scenario:</strong> {selectedScenario.scenarioName} ({selectedScenario.channel})
                              </div>
                              
                              {/* Factoring Section - Pulled up closer */}
                              {channelType === 'B2B' && useFactoring && (
                                <div className="bg-purple-50 rounded p-2 border-2 border-purple-300">
                                      <h5 className="text-sm font-semibold text-purple-900 mb-2">💳 Factoring Terms</h5>
                                      
                                  {/* Initial Cash Row - More Compact */}
                                  <div className="grid grid-cols-12 gap-1 items-center mb-2 bg-white rounded p-2 text-xs">
                                        <div className="col-span-2">
                                          <Label className="text-xs">Initial %</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={factoringInitialPercent}
                                            onChange={(e) => setFactoringInitialPercent(parseFloat(e.target.value) || 0)}
                                        className="h-7 text-xs"
                                          />
                                        </div>
                                    <div className="col-span-1 text-center text-sm text-gray-400">=</div>
                                        <div className="col-span-3">
                                          <Label className="text-xs">Amount</Label>
                                          <div className="text-sm font-bold text-green-600 mt-1">
                                            ${((totalRevenue * factoringInitialPercent) / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                          </div>
                                        </div>
                                        <div className="col-span-2">
                                          <Label className="text-xs">Days</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={factoringInitialDays}
                                            onChange={(e) => setFactoringInitialDays(parseInt(e.target.value) || 0)}
                                        className="h-7 text-xs"
                                          />
                                        </div>
                                    <div className="col-span-1 text-center text-sm text-gray-400">→</div>
                                        <div className="col-span-3">
                                          <Label className="text-xs">AR Date</Label>
                                      <div className="text-xs font-bold text-purple-600 mt-1">
                                            {(() => {
                                          const baseDateStr = bolHandoverDate || (() => {
                                            if (!selectedForecast?.deliveryWeek) return '';
                                              const [year, week] = selectedForecast.deliveryWeek.split('-W');
                                              const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
                                              const day = date.getDay();
                                              const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                                              const monday = new Date(date.setDate(diff));
                                            return monday.toISOString().split('T')[0];
                                          })();
                                          if (!baseDateStr) return 'N/A';
                                          const arDate = new Date(baseDateStr);
                                          arDate.setDate(arDate.getDate() + factoringInitialDays);
                                          return arDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                      
                                  {/* Remainder Cash Row - More Compact */}
                                  <div className="grid grid-cols-12 gap-1 items-center mb-2 bg-white rounded p-2 text-xs">
                                        <div className="col-span-2">
                                          <Label className="text-xs">Remainder %</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={factoringRemainderPercent}
                                            onChange={(e) => setFactoringRemainderPercent(parseFloat(e.target.value) || 0)}
                                        className="h-7 text-xs"
                                          />
                                        </div>
                                    <div className="col-span-1 text-center text-sm text-gray-400">=</div>
                                        <div className="col-span-3">
                                          <Label className="text-xs">Amount</Label>
                                          <div className="text-sm font-bold text-blue-600 mt-1">
                                            ${((totalRevenue * factoringRemainderPercent) / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                          </div>
                                        </div>
                                        <div className="col-span-2">
                                          <Label className="text-xs">Days</Label>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={factoringRemainderDays}
                                            onChange={(e) => setFactoringRemainderDays(parseInt(e.target.value) || 0)}
                                        className="h-7 text-xs"
                                          />
                                        </div>
                                    <div className="col-span-1 text-center text-sm text-gray-400">→</div>
                                        <div className="col-span-3">
                                          <Label className="text-xs">AR Date</Label>
                                      <div className="text-xs font-bold text-purple-600 mt-1">
                                            {(() => {
                                          const baseDateStr = bolHandoverDate || (() => {
                                            if (!selectedForecast?.deliveryWeek) return '';
                                              const [year, week] = selectedForecast.deliveryWeek.split('-W');
                                              const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
                                              const day = date.getDay();
                                              const diff = date.getDate() - day + (day === 0 ? -6 : 1);
                                              const monday = new Date(date.setDate(diff));
                                            return monday.toISOString().split('T')[0];
                                          })();
                                          if (!baseDateStr) return 'N/A';
                                          const arDate = new Date(baseDateStr);
                                          arDate.setDate(arDate.getDate() + factoringRemainderDays);
                                          return arDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Factoring Summary */}
                                      <div className="pt-2 border-t border-purple-200">
                                        <div className="flex justify-between text-xs">
                                          <span className="font-medium">Total Factored:</span>
                                          <span className="font-bold text-purple-700">
                                            {factoringInitialPercent + factoringRemainderPercent}% = ${((totalRevenue * (factoringInitialPercent + factoringRemainderPercent)) / 100).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                          </span>
                                        </div>
                                      </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>


                {/* Customer & Notes (Both Channels) */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">📝 Customer & Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Customer Name</Label>
                          <Input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Customer or Partner"
                          />
                        </div>
                        <div>
                          <Label>Region</Label>
                          <Input
                            type="text"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="e.g., US, EU, APAC"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Notes</Label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="w-full border rounded-md p-2 min-h-[80px]"
                          placeholder="Additional notes about this forecast..."
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4 bg-gray-50 flex justify-between">
              <Button
                onClick={() => setShowConfigModal(false)}
                variant="outline"
                disabled={savingConfig}
              >
                Cancel
              </Button>
              <Button
                onClick={saveConfiguration}
                className="bg-green-600 hover:bg-green-700"
                disabled={savingConfig}
              >
                {savingConfig ? 'Saving...' : '💾 Save Configuration'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Session Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Save Analysis Session</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="sessionName">Session Name *</Label>
                <Input
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Q1 2026 Forecast Analysis"
                />
              </div>
              
              <div>
                <Label htmlFor="sessionDesc">Description (Optional)</Label>
                <Input
                  id="sessionDesc"
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  placeholder="Notes about this analysis..."
                />
              </div>
              
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                This will save:
                <ul className="list-disc list-inside mt-1">
                  <li>Date range and filters</li>
                  <li>SKU scenario selections</li>
                  <li>Manual ASP entries</li>
                </ul>
              </div>
            </div>
            
            <div className="flex gap-2 justify-end mt-6">
              <Button
                onClick={() => {
                  setShowSaveModal(false);
                  setSessionName('');
                  setSessionDescription('');
                }}
                variant="outline"
                disabled={savingSession}
              >
                Cancel
              </Button>
              <Button
                onClick={saveAnalysisSession}
                className="bg-blue-600 hover:bg-blue-700"
                disabled={savingSession || !sessionName.trim()}
              >
                {savingSession ? 'Saving...' : '💾 Save Session'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Load Session Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Load Saved Session</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {savedSessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No saved sessions found
                </div>
              ) : (
                <div className="space-y-3">
                  {savedSessions.map((session) => (
                    <div
                      key={session.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => loadAnalysisSession(session.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{session.sessionName}</h3>
                          {session.description && (
                            <p className="text-sm text-gray-600 mt-1">{session.description}</p>
                          )}
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
                            <span>📅 {new Date(session.createdAt).toLocaleDateString()}</span>
                            {session.startDate && session.endDate && (
                              <span>📊 {session.startDate} to {session.endDate}</span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          Load
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t">
              <Button
                onClick={() => setShowLoadModal(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

