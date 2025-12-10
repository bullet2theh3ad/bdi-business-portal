'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User, ProductSku } from '@/lib/db/schema';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import { HolidayCalendarToggle, useHolidayCalendar } from '@/components/ui/holiday-calendar-toggle';
import { ShipmentCautionIndicator } from '@/components/ui/shipment-caution-indicator';
import { getHolidaySummaryForYear } from '@/lib/services/production-holidays';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

interface PurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  supplierName: string;
  purchaseOrderDate: string;
  requestedDeliveryDate: string;
  status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered';
  terms: string;
  incoterms: string;
  incotermsLocation: string;
  totalValue: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface SalesForecast {
  id: string;
  skuId: string;
  sku: ProductSku;
  purchaseOrderId?: string; // Link to PO
  purchaseOrder?: PurchaseOrder;
  deliveryWeek: string; // ISO week format: 2025-W12
  quantity: number;
  
  // CPFR Supply Chain Signals
  salesSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected'; // Sales team status
  factorySignal: 'unknown' | 'reviewing' | 'confirmed' | 'rejected'; // Factory/ODM status  
  shippingSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected'; // Shipping/logistics status
  
  shippingPreference: string; // AIR_EXPRESS, SEA_STANDARD, etc.
  notes?: string;
  createdBy: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SalesForecastsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc, tn, tcpfr } = useSimpleTranslations(userLocale);
  const { data: forecasts, mutate: mutateForecasts } = useSWR<SalesForecast[]>('/api/cpfr/forecasts', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds for real-time updates
    revalidateOnFocus: true, // Refresh when user returns to tab
  });
  const { data: purchaseOrders } = useSWR<PurchaseOrder[]>('/api/cpfr/purchase-orders', fetcher);
  const { data: inventoryData } = useSWR('/api/cpfr/inventory/availability', fetcher);
  const { data: productionSchedules } = useSWR('/api/production-schedules', fetcher);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(highlightId ? 'list' : 'calendar');
  const [calendarView, setCalendarView] = useState<'months' | 'weeks' | 'days'>('months');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [quantityError, setQuantityError] = useState<string>('');
  const [moqOverride, setMoqOverride] = useState<boolean>(false);
  const [leadTimeOption, setLeadTimeOption] = useState<'mp_ready' | 'normal' | 'custom'>('normal');
  const [customLeadTime, setCustomLeadTime] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [confidenceLevel, setConfidenceLevel] = useState<'part_of_po' | 'pre_po' | 'planning'>('planning');
  const [forecastQuantity, setForecastQuantity] = useState<number>(0);
  
  // List view filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [skuFilter, setSkuFilter] = useState<string>('all');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');
  const [dateSort, setDateSort] = useState<'ascending' | 'descending'>('ascending');
  
  // Handle highlight: scroll to forecast when highlighted
  useEffect(() => {
    if (highlightId && forecasts && viewMode === 'list') {
      setTimeout(() => {
        const element = document.getElementById(`forecast-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2');
          }, 3000);
        }
      }, 500);
    }
  }, [highlightId, forecasts, viewMode]);
  
  // Holiday calendar functionality
  const holidayCalendar = useHolidayCalendar();
  
  // Helper function to check if a month contains holidays
  const getMonthHolidayStyle = (monthDate: Date) => {
    if (!holidayCalendar.isEnabled) return '';
    
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    let hasHoliday = false;
    let hasSoftHoliday = false;
    
    // Check entire month for holidays
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const checkDate = new Date(year, month, day);
      const dateStr = checkDate.toISOString().split('T')[0];
      const classification = holidayCalendar.getDateClassification(dateStr);
      
      if (classification.type === 'holiday') {
        hasHoliday = true;
        break; // Holiday takes priority
      } else if (classification.type === 'soft-holiday') {
        hasSoftHoliday = true;
      }
    }
    
    if (hasHoliday) {
      return 'bg-red-50 border-red-200 hover:border-red-300';
    } else if (hasSoftHoliday) {
      return 'bg-orange-50 border-orange-200 hover:border-orange-300';
    }
    
    return '';
  };
  
  // Auto-classify dates when holiday calendar is enabled or month changes
  useEffect(() => {
    const classifyCurrentView = async () => {
      if (holidayCalendar.isEnabled) {
        // For 6-month view, we need to classify a much wider range that spans multiple years
        const currentYear = currentDate.getFullYear();
        
        // Get the full 6-month range being displayed
        const startMonth = new Date(currentYear, currentDate.getMonth(), 1);
        const endMonth = new Date(currentYear, currentDate.getMonth() + 5, 0); // 6 months ahead
        
        // Extend to cover full calendar grid
        const calendarStart = new Date(startMonth);
        calendarStart.setDate(calendarStart.getDate() - startMonth.getDay());
        
        const calendarEnd = new Date(endMonth);
        calendarEnd.setDate(calendarEnd.getDate() + (6 - endMonth.getDay()));
        
        console.log(`🎊 Auto-classifying 6-month calendar range: ${calendarStart.toISOString().split('T')[0]} to ${calendarEnd.toISOString().split('T')[0]}`);
        console.log(`📅 This spans years: ${calendarStart.getFullYear()} to ${calendarEnd.getFullYear()}`);
        
        await holidayCalendar.classifyDateRange(
          calendarStart.toISOString().split('T')[0],
          calendarEnd.toISOString().split('T')[0]
        );
      }
    };
    
    classifyCurrentView();
  }, [holidayCalendar.isEnabled, currentDate, viewMode]);
  
  // Initial holiday data load when component mounts (since holidays are ON by default)
  useEffect(() => {
    if (holidayCalendar.isEnabled) {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const calendarStart = new Date(startOfMonth);
      calendarStart.setDate(calendarStart.getDate() - startOfMonth.getDay());
      const calendarEnd = new Date(endOfMonth);
      calendarEnd.setDate(calendarEnd.getDate() + (6 - endOfMonth.getDay()));
      
      console.log(`🎊 Initial holiday classification for: ${calendarStart.toISOString().split('T')[0]} to ${calendarEnd.toISOString().split('T')[0]}`);
      holidayCalendar.classifyDateRange(
        calendarStart.toISOString().split('T')[0],
        calendarEnd.toISOString().split('T')[0]
      );
    }
  }, []); // Run once on mount
  const [salesForecastStatus, setSalesForecastStatus] = useState<'draft' | 'submitted' | 'rejected' | 'confirmed'>('draft');
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<string>('');
  
  // SKU Selection State
  const [skuViewMode, setSkuViewMode] = useState<'grid' | 'list' | 'dropdown'>('grid');
  const [skuSearchTerm, setSkuSearchTerm] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedWeekForDetail, setSelectedWeekForDetail] = useState<string>('');
  const [editingForecast, setEditingForecast] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  
  // Edit Forecast Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedForecast, setSelectedForecast] = useState<SalesForecast | null>(null);
  const [editForecastData, setEditForecastData] = useState<any>({});
  
  // Scenario Analysis Modal State
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisForecast, setAnalysisForecast] = useState<SalesForecast | null>(null);
  const [analysisData, setAnalysisData] = useState({
    shippingMethod: '',
    customShippingDays: '',
    leadTime: 'auto',
    customLeadTimeDays: '',
    safetyBuffer: '5',
    customBufferDays: ''
  });
  const [timelineResults, setTimelineResults] = useState<any>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Email Action Items Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState({
    recipients: 'dzand@boundlessdevices.com, scistulli@boundlessdevices.com',
    additionalEmails: '',
    subject: '',
    includeTimeline: true,
    includeRiskAssessment: true,
    includeActionItems: true
  });

  // Calculate work-backwards timeline from delivery date
  const calculateRealisticTimeline = () => {
    if (!analysisForecast || !analysisData.shippingMethod) return;

    // Parse delivery week to get target delivery date
    const deliveryWeek = analysisForecast.deliveryWeek; // e.g., "2025-W43"
    const [year, week] = deliveryWeek.split('-W');
    const deliveryDate = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
    
    // Get shipping days
    const getShippingDays = () => {
      if (analysisData.shippingMethod === 'custom') {
        return parseInt(analysisData.customShippingDays) || 0;
      }
      const shippingDays: Record<string, number> = {
        'SEA_ASIA_US_WEST': 21,
        'SEA_STANDARD_WEST_COAST': 45,
        'AIR_14_DAYS': 14,
        'AIR_7_DAYS': 7,
        'SEA_STANDARD': 28
      };
      return shippingDays[analysisData.shippingMethod] || 21;
    };

    // Get lead time days
    const getLeadTimeDays = () => {
      if (analysisData.leadTime === 'custom') {
        return parseInt(analysisData.customLeadTimeDays) || 30;
      }
      if (analysisData.leadTime === 'auto') {
        // TODO: Get from SKU data - for now use 30 days default
        return 30;
      }
      return parseInt(analysisData.leadTime) || 30;
    };

    // Get safety buffer days
    const getBufferDays = () => {
      if (analysisData.safetyBuffer === 'custom') {
        return parseInt(analysisData.customBufferDays) || 5;
      }
      return parseInt(analysisData.safetyBuffer) || 5;
    };

    const shippingDays = getShippingDays();
    const leadTimeDays = getLeadTimeDays();
    const bufferDays = getBufferDays();

    // Work backwards from delivery date
    const warehouseArrival = new Date(deliveryDate.getTime() - bufferDays * 24 * 60 * 60 * 1000);
    const shippingStart = new Date(warehouseArrival.getTime() - shippingDays * 24 * 60 * 60 * 1000);
    const productionStart = new Date(shippingStart.getTime() - leadTimeDays * 24 * 60 * 60 * 1000);
    const factorySignalDate = new Date(productionStart.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before production

    // Calculate risk assessment
    const totalDaysRequired = leadTimeDays + shippingDays + bufferDays + 7; // +7 for factory signal buffer
    const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000));
    const riskLevel = daysUntilDelivery < totalDaysRequired ? 'HIGH' : 
                     daysUntilDelivery < totalDaysRequired + 14 ? 'MEDIUM' : 'LOW';

    const timeline = {
      deliveryDate,
      warehouseArrival,
      shippingStart,
      productionStart,
      factorySignalDate,
      shippingDays,
      leadTimeDays,
      bufferDays,
      totalDaysRequired,
      daysUntilDelivery,
      riskLevel,
      isRealistic: daysUntilDelivery >= totalDaysRequired
    };

    setTimelineResults(timeline);
    setShowTimeline(true);
  };

  // Prepare and send CPFR action items email
  const prepareActionItemsEmail = () => {
    if (!timelineResults || !analysisForecast) return;
    
    // Auto-generate subject line
    const subject = `URGENT CPFR Action Required - ${analysisForecast.sku?.sku} Factory Signal Due ${timelineResults.factorySignalDate.toLocaleDateString()}`;
    
    setEmailData(prev => ({
      ...prev,
      subject
    }));
    setShowEmailModal(true);
  };

  const sendActionItemsEmail = async () => {
    if (!timelineResults || !analysisForecast) return;

    try {
      const allRecipients = emailData.additionalEmails 
        ? `${emailData.recipients}, ${emailData.additionalEmails}`
        : emailData.recipients;

      const emailPayload = {
        to: allRecipients,
        subject: emailData.subject,
        forecast: analysisForecast,
        timeline: timelineResults,
        analysisData,
        includeTimeline: emailData.includeTimeline,
        includeRiskAssessment: emailData.includeRiskAssessment,
        includeActionItems: emailData.includeActionItems
      };

      // Send email via API endpoint
      const response = await fetch('/api/cpfr/send-action-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send email');
      }

      // Success - show confirmation and close modal
      alert(`✅ CPFR Action Items email sent successfully to: ${allRecipients}`);
      setShowEmailModal(false);
      
    } catch (error) {
      console.error('Failed to send action items email:', error);
      alert(`❌ Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Download CPFR Data function - organization-specific permissions
  const downloadCPFRData = async () => {
    try {
      if (!user?.organization?.code) {
        alert('Organization information not available');
        return;
      }

      const orgCode = user.organization.code;
      const isBDI = orgCode === 'BDI';
      
      // Prepare data for download using available properties
      const dataToDownload = forecastsArray.map(forecast => {
        // Find matching production schedule via shipment linkage
        // A forecast should only have production schedule dates if:
        // 1. The forecast has a shipment (shipment.forecastId === forecast.id)
        // 2. That shipment is linked to a production schedule (via production_schedule_shipments)
        let matchingSchedule = null;
        
        if (productionSchedules && Array.isArray(productionSchedules)) {
          matchingSchedule = productionSchedules.find((ps: any) => {
            // Check if this production schedule has any shipments linked to this forecast
            return ps.shipments?.some((shipmentLink: any) => {
              // The shipment's forecastId should match this forecast's ID
              return shipmentLink.shipment?.forecastId === forecast.id;
            });
          });
        }

        return {
          'Forecast ID': forecast.id,
          'SKU': forecast.sku?.sku || 'Unknown',
          'SKU Name': forecast.sku?.name || 'Unknown',
          'Manufacturer': forecast.sku?.mfg || '',
          'Material Arrival': matchingSchedule?.materialArrivalDate || '',
          'SMT': matchingSchedule?.smtDate || '',
          'DIP': matchingSchedule?.dipDate || '',
          'ATP Begin': matchingSchedule?.atpBeginDate || '',
          'ATP End': matchingSchedule?.atpEndDate || '',
          'OBA': matchingSchedule?.obaDate || '',
          'EXW': matchingSchedule?.exwDate || '',
          'Delivery Week': forecast.deliveryWeek,
          'Quantity': forecast.quantity,
          'Shipping Preference': forecast.shippingPreference || 'Not specified',
          'Sales Signal': forecast.salesSignal,
          'Factory Signal': forecast.factorySignal,
          'Shipping Signal': forecast.shippingSignal,
          'Notes': forecast.notes || '',
          'Created Date': forecast.createdAt ? new Date(forecast.createdAt).toLocaleDateString() : '',
          'Created By': forecast.createdBy,
          'Organization': isBDI ? 'BDI (All Data)' : orgCode
        };
      });

      // Convert to CSV
      const headers = Object.keys(dataToDownload[0] || {});
      const csvContent = [
        headers.join(','),
        ...dataToDownload.map(row => 
          headers.map(header => {
            const value = (row as any)[header];
            // Properly escape CSV values: handle quotes, commas, and newlines
            if (typeof value === 'string') {
              // Replace newlines with spaces to prevent row breaks
              const cleanValue = value.replace(/[\r\n]+/g, ' ').trim();
              // Wrap in quotes if contains comma, quote, or originally had newlines
              if (cleanValue.includes(',') || cleanValue.includes('"') || value.includes('\n') || value.includes('\r')) {
                return `"${cleanValue.replace(/"/g, '""')}"`;
              }
              return cleanValue;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      const fileName = isBDI 
        ? `BDI_CPFR_All_Organizations_${new Date().toISOString().split('T')[0]}.csv`
        : `${orgCode}_CPFR_Data_${new Date().toISOString().split('T')[0]}.csv`;
        
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`📊 CPFR data downloaded for ${orgCode}:`, {
        recordCount: dataToDownload.length,
        fileName,
        isBDIAllAccess: isBDI
      });

    } catch (error) {
      console.error('Error downloading CPFR data:', error);
      alert('Failed to download CPFR data. Please try again.');
    }
  };
  
  // Calendar picker state
  const [calendarPickerDate, setCalendarPickerDate] = useState(new Date());
  const [selectedDeliveryWeek, setSelectedDeliveryWeek] = useState<string>('');

  // Helper function to get available quantity for a SKU
  const getAvailableQuantity = (skuId: string) => {
    // PRIORITY 1: Check if current forecast has attached PO - use PO quantity
    if (selectedPurchaseOrder && purchaseOrders) {
      const attachedPO = purchaseOrders.find(po => po.id === selectedPurchaseOrder);
      if (attachedPO) {
        // For now, use PO total value as indicator (line items fetched separately)
        // TODO: Fetch PO line items to get exact SKU quantity
        console.log(`📦 PO attached: ${attachedPO.purchaseOrderNumber}, using invoice fallback for now`);
      }
    }
    
    // PRIORITY 2: Check if current forecast has attached Invoice - use Invoice quantity
    // (Invoice logic would go here if we add invoice attachment)
    
    // PRIORITY 3: Fallback to general inventory availability (from invoices/MOQ)
    if (!inventoryData?.availability) return 0;
    return inventoryData.availability[skuId]?.availableQuantity || 0;
  };



  // CPFR Supply Chain Signal Icons
  const getSignalIcon = (status: 'unknown' | 'draft' | 'submitted' | 'reviewing' | 'confirmed' | 'rejected') => {
    switch (status) {
      case 'unknown':
        return '❓'; // Question mark for unknown status
      case 'submitted':
        return '⏳'; // Sand clock for submitted/reviewing status
      case 'reviewing':
        return '⏳'; // Sand clock for reviewing status
      case 'rejected':
        return '❌'; // X for rejected status
      case 'confirmed':
        return '✅'; // Green check for confirmed status
      default:
        return '❓';
    }
  };

  // Get signal color for status
  const getSignalColor = (status: 'unknown' | 'draft' | 'submitted' | 'reviewing' | 'confirmed' | 'rejected') => {
    switch (status) {
      case 'unknown':
        return 'text-gray-500'; // Gray for unknown
      case 'submitted':
        return 'text-blue-500'; // Blue for submitted
      case 'reviewing':
        return 'text-yellow-500'; // Yellow for reviewing
      case 'rejected':
        return 'text-red-500'; // Red for rejected
      case 'confirmed':
        return 'text-green-500'; // Green for confirmed
      default:
        return 'text-gray-500';
    }
  };

  // Get overall forecast status color for calendar boxes
  const getForecastStatusColor = (forecast: any) => {
    const sales = forecast.salesSignal || 'unknown';
    const factory = forecast.factorySignal || 'unknown';
    const shipping = forecast.shippingSignal || 'unknown';
    
    // CPFR Signal Priority Logic:
    // 🔴 RED: Any rejected OR incomplete process (submitted but others unknown)
    // 🟡 YELLOW: All submitted/reviewing (actively in process)  
    // 🟢 GREEN: All three confirmed (complete success)
    // ⚪ GRAY: All unknown (no activity yet)
    
    if (sales === 'rejected' || factory === 'rejected' || shipping === 'rejected') {
      return 'bg-red-50 border-red-300'; // Any rejection = red
                    } else if (sales === 'confirmed' && factory === 'confirmed' && shipping === 'confirmed') {
                      return 'bg-green-50 border-green-300'; // All confirmed = green
    } else if (
      (sales === 'submitted' || sales === 'draft') && 
      (factory === 'reviewing') && 
      (shipping === 'submitted')
    ) {
      return 'bg-yellow-50 border-yellow-300'; // All actively in process = yellow
    } else if (
      sales === 'submitted' && 
      (factory === 'unknown' || shipping === 'unknown')
    ) {
      return 'bg-red-50 border-red-300'; // Submitted but incomplete = red (needs action)
    } else if (sales === 'unknown' && factory === 'unknown' && shipping === 'unknown') {
      return 'bg-gray-50 border-gray-300'; // All unknown = gray (no activity)
    } else {
      return 'bg-red-50 border-red-300'; // Any other incomplete state = red
    }
  };

  // Generate months for calendar view (6 months ahead)
  const generateMonths = () => {
    const months = [];
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Get forecast activity for this month
      const monthForecasts = forecastsArray.filter(f => {
        if (f.deliveryWeek.includes('W')) {
          // ISO week format: 2025-W36
          const year = parseInt(f.deliveryWeek.split('-')[0]);
          const week = parseInt(f.deliveryWeek.split('W')[1]);
          const weekDate = getDateFromISOWeek(year, week);
          return weekDate.getFullYear() === monthDate.getFullYear() && 
                 weekDate.getMonth() === monthDate.getMonth();
        }
        return false;
      });

      months.push({
        date: monthDate,
        name: monthName,
        key: monthKey,
        forecastCount: monthForecasts.length,
        forecasts: monthForecasts
      });
    }
    return months;
  };

  // Helper to convert ISO week to date
  const getDateFromISOWeek = (year: number, week: number) => {
    const date = new Date(year, 0, 1);
    const dayOfWeek = date.getDay();
    const daysToAdd = (week - 1) * 7 - dayOfWeek + 1;
    date.setDate(date.getDate() + daysToAdd);
    return date;
  };

  // Generate weeks for a specific month
  const generateWeeksForMonth = (monthDate: Date) => {
    const weeks = [];
    const startOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const endOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    
    // Find the first Monday of the month view
    const firstDay = new Date(startOfMonth);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay() + 1);
    
    let currentWeek = new Date(firstDay);
    
    while (currentWeek <= endOfMonth || currentWeek.getMonth() === monthDate.getMonth()) {
      const weekEnd = new Date(currentWeek);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const isoWeek = getISOWeek(currentWeek);
      const weekForecasts = forecastsArray.filter(f => f.deliveryWeek === isoWeek);
      
      weeks.push({
        start: new Date(currentWeek),
        end: weekEnd,
        isoWeek: isoWeek,
        forecastCount: weekForecasts.length,
        forecasts: weekForecasts
      });
      
      currentWeek.setDate(currentWeek.getDate() + 7);
      
      // Prevent infinite loop
      if (weeks.length > 6) break;
    }
    
    return weeks;
  };

  // Helper to get ISO week (standardized calculation)
  const getISOWeek = (date: Date) => {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return `${target.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
  };

  // Helper function to get effective lead time based on selected option
  const getEffectiveLeadTime = (): number => {
    if (!selectedSku) return 30;
    
    switch (leadTimeOption) {
      case 'mp_ready':
        if ((selectedSku as any)?.mpStartDate) {
          const mpReady = new Date((selectedSku as any).mpStartDate);
          const today = new Date();
          const diffTime = mpReady.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return Math.max(1, diffDays); // Ensure at least 1 day
        }
        return (selectedSku as any)?.leadTimeDays || 30; // Fallback to normal
      case 'custom':
        if (customDate) {
          const customDeliveryDate = new Date(customDate);
          const today = new Date();
          const diffTime = customDeliveryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return Math.max(1, diffDays);
        }
        return customLeadTime || (selectedSku as any)?.leadTimeDays || 30;
      case 'normal':
      default:
        return (selectedSku as any)?.leadTimeDays || 30;
    }
  };

  // Access control - Sales team and admins can create forecasts
  if (!user || !['super_admin', 'admin', 'sales', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="forecasts" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Sales team access required for demand forecasting.</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine user organization type for permissions
  const isBDIUser = user.organization?.code === 'BDI' && user.organization?.type === 'internal';
  const isPartnerUser = !isBDIUser && user.organization?.code;
  const canCreateForecasts = isBDIUser; // Only BDI can create new forecasts
  const canRespondToForecasts = isPartnerUser; // Partners can respond to existing forecasts

  const handleCreateForecast = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cpfr/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: selectedSku?.id,
          purchaseOrderId: selectedPurchaseOrder || null,
          deliveryWeek: formData.get('deliveryWeek'),
          quantity: parseInt(formData.get('quantity') as string),
          confidence: formData.get('confidence'),
          shippingPreference: formData.get('shippingPreference'),
          moqOverride: moqOverride,
          notes: formData.get('notes'),
          status: salesForecastStatus,
          customExwDate: customDate || null, // Include custom EXW date from Lead Time Options
        }),
      });

      if (response.ok) {
        mutateForecasts();
        setShowCreateModal(false);
        setSelectedSku(null);
        setSelectedPurchaseOrder('');
        setMoqOverride(false);
        setQuantityError('');
        setForecastQuantity(0);
        setSalesForecastStatus('draft');
      } else {
        const errorData = await response.json();
        alert(`Failed to create forecast: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating forecast:', error);
      alert('Failed to create forecast');
    }
    setIsLoading(false);
  };

  const handleDeleteForecast = async (forecastId: string, forecastSku: string) => {
    if (!confirm(`Are you sure you want to delete forecast for ${forecastSku}?\n\nThis will permanently remove the forecast and any related records. This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch('/api/cpfr/forecasts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forecastId: forecastId
        }),
      });

      if (response.ok) {
        mutateForecasts(); // Refresh the forecast list
        alert('Forecast deleted successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to delete forecast: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting forecast:', error);
      alert('Failed to delete forecast. Please try again.');
    }
  };

  // Get planning weeks - extends 6 weeks beyond earliest possible delivery
  const getPlanningWeeks = () => {
    const weeks = [];
    const now = new Date();
    
    // Helper to get ISO week number
    const getISOWeek = (date: Date) => {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };
    
    // Helper to get Monday of the week
    const getMondayOfWeek = (date: Date) => {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.setDate(diff));
    };
    
    // Calculate how many weeks we need based on selected SKU and shipping
    let totalWeeks = 12; // Default minimum
    
    if (selectedSku && selectedShipping) {
      const leadTime = getEffectiveLeadTime();
      const shippingDays: { [key: string]: number } = {
        'INDIRECT': 0,
        'ZERO_LAG_SAME_DAY': 0,
        'ZERO_LAG_NEXT_DAY': 1,
        'ZERO_LAG_CUSTOM': 0,
        'AIR_7_DAYS': 7,
        'AIR_14_DAYS': 14,
        'AIR_NLD': 14,
        'AIR_AUT': 14,
        'SEA_ASIA_US_WEST': 45,
        'SEA_ASIA_US_EAST': 52,
        'SEA_WEST_EXPEDITED': 35,
        'SEA_ASIA_NLD': 45,
        'SEA_ASIA_AUT': 45,
        'TRUCK_EXPRESS': 10.5,
        'TRUCK_STANDARD': 21,
        'RAIL': 28,
      };
      const shippingTime = shippingDays[selectedShipping] || 0;
      const totalDays = leadTime + shippingTime;
      const weeksUntilEarliest = Math.ceil(totalDays / 7);
      totalWeeks = Math.max(12, weeksUntilEarliest + 6); // 6 weeks beyond earliest
    }
    
    for (let i = 0; i < totalWeeks; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + (i * 7));
      const monday = getMondayOfWeek(new Date(weekStart));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const isoWeek = getISOWeek(monday);
      const year = monday.getFullYear();
      
      weeks.push({
        isoWeek: `${year}-W${String(isoWeek).padStart(2, '0')}`,
        weekNumber: isoWeek,
        year,
        startDate: monday,
        endDate: sunday,
        dateRange: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        fullRange: `${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      });
    }
    return weeks;
  };

  const weeks = getPlanningWeeks();
  const skusArray = Array.isArray(skus) ? skus : [];
  const forecastsArray = Array.isArray(forecasts) ? forecasts : [];
  const posArray = Array.isArray(purchaseOrders) ? purchaseOrders : [];

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="forecasts" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{tc('salesForecasts', 'Sales Forecasts')}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{tc('forecastsDescription', 'Create demand forecasts for CPFR planning')}</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              onClick={() => mutateForecasts()}
              className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white flex-1 sm:flex-none"
            >
              <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
              <span className="hidden sm:inline">{tc('refreshButton', 'Refresh')}</span>
              <span className="sm:hidden">↻</span>
            </Button>
            {canCreateForecasts && (
              <Button className="bg-blue-600 hover:bg-blue-700 flex-1 sm:flex-none" onClick={() => setShowCreateModal(true)}>
                <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                <span className="hidden sm:inline">New Forecast</span>
                <span className="sm:hidden">+ New</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* View Toggle & Calendar Controls */}
      <div className="flex flex-col space-y-3 lg:flex-row lg:items-start lg:justify-between lg:space-y-0 lg:space-x-4">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          {/* View Mode Toggle */}
          <div className="flex border rounded-md">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              📅 <span className="hidden sm:inline">Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              📋 <span className="hidden sm:inline">List</span>
            </button>
          </div>

          {/* Holiday Calendar Toggle - Mobile optimized */}
          <HolidayCalendarToggle
            onToggle={(enabled) => {
              holidayCalendar.setIsEnabled(enabled);
              if (enabled) {
                // Classify current month when enabled
                const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                holidayCalendar.classifyDateRange(
                  startOfMonth.toISOString().split('T')[0],
                  endOfMonth.toISOString().split('T')[0]
                );
              }
            }}
            className="w-full sm:w-auto"
          />
          
          {/* Dynamic Holiday List Display - Show both years when calendar spans years */}
          {holidayCalendar.isEnabled && (() => {
            const currentYear = currentDate.getFullYear();
            const nextYear = currentYear + 1;
            
            // Check if 6-month view spans into next year
            const endMonth = new Date(currentYear, currentDate.getMonth() + 5, 0);
            const spansYears = endMonth.getFullYear() > currentYear;
            
            const currentYearHolidays = getHolidaySummaryForYear(currentYear);
            const nextYearHolidays = spansYears ? getHolidaySummaryForYear(nextYear) : [];
            
            return (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2 sm:p-3">
                <div className="font-semibold text-red-800 text-xs sm:text-sm mb-2">
                  🎊 {currentYear}{spansYears ? ` & ${nextYear}` : ''} Chinese Holidays
                </div>
                <div className="space-y-2">
                  {/* Current Year Holidays */}
                  <div className="space-y-1 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
                    {currentYearHolidays.map((holiday, index) => (
                      <div key={`${currentYear}-${index}`} className="text-xs">
                        <span className="font-medium text-red-700">{holiday.name}:</span>{' '}
                        <span className="text-red-600">{holiday.dates}</span>{' '}
                        <span className="text-gray-500">({holiday.period}d)</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Next Year Holidays (if calendar spans years) */}
                  {spansYears && nextYearHolidays.length > 0 && (
                    <div className="border-t border-red-200 pt-2">
                      <div className="text-xs font-medium text-red-700 mb-1">{nextYear}:</div>
                      <div className="space-y-1 sm:space-y-0 sm:grid sm:grid-cols-3 sm:gap-3">
                        {nextYearHolidays.map((holiday, index) => (
                          <div key={`${nextYear}-${index}`} className="text-xs">
                            <span className="font-medium text-red-700">{holiday.name}:</span>{' '}
                            <span className="text-red-600">{holiday.dates}</span>{' '}
                            <span className="text-gray-500">({holiday.period}d)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Calendar Zoom Controls */}
          {viewMode === 'calendar' && (
            <div className="flex border rounded-md">
              <button
                onClick={() => {
                  setCalendarView('months');
                  setSelectedMonth(null);
                }}
                className={`px-2 sm:px-3 py-2 text-xs transition-colors ${calendarView === 'months' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                🗓️ <span className="hidden sm:inline">Months</span>
              </button>
              <button
                onClick={() => setCalendarView('weeks')}
                className={`px-2 sm:px-3 py-2 text-xs transition-colors ${calendarView === 'weeks' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-50'}`}
                disabled={!selectedMonth}
              >
                📊 <span className="hidden sm:inline">Weeks</span>
              </button>
              <button
                onClick={() => setCalendarView('days')}
                className={`px-2 sm:px-3 py-2 text-xs transition-colors ${calendarView === 'days' ? 'bg-green-100 text-green-800' : 'text-gray-600 hover:bg-gray-50'}`}
                disabled={!selectedMonth}
              >
                📋 <span className="hidden sm:inline">Days</span>
              </button>
            </div>
          )}
        </div>
        
        {/* CPFR Supply Chain Signals Legend - Hidden on mobile, compact on tablet */}
        <div className="hidden md:flex items-center space-x-4 lg:space-x-6">
          <div className="flex items-center space-x-2 lg:space-x-4 text-xs">
            <span className="text-gray-500">CPFR:</span>
            <div className="flex items-center space-x-2">
              <span className="font-medium">S</span>
              <span className="font-medium">F</span>
              <span className="font-medium">Sh</span>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-3">
              <span>❓</span>
              <span>⏳</span>
              <span>✅</span>
              <span>❌</span>
            </div>
          </div>
        </div>
        
        {/* Mobile CPFR Legend - Compact version */}
        <div className="md:hidden">
          <div className="flex items-center justify-center space-x-3 text-xs bg-gray-50 rounded-md p-2">
            <span className="text-gray-500">CPFR:</span>
            <span>❓ ⏳ ✅ ❌</span>
          </div>
        </div>
      </div>

      {/* CPFR Calendar View - Multi-level */}
      {viewMode === 'calendar' ? (
        <div>
          {/* Calendar Navigation Header */}
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
              <Button
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
                onClick={() => {
                  if (calendarView === 'months') {
                    // Navigate months view
                    const newDate = new Date(currentDate);
                    newDate.setMonth(newDate.getMonth() - 6); // Move back 6 months for 6-month view
                    setCurrentDate(newDate);
                  } else if (calendarView === 'weeks' && selectedMonth) {
                    // Navigate to previous month in weeks view
                    const newMonth = new Date(selectedMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    setSelectedMonth(newMonth);
                  }
                }}
              >
                ← <span className="hidden sm:inline">
                  <DynamicTranslation userLanguage={userLocale} context="general">
                    Previous
                  </DynamicTranslation>{' '}
                </span>{calendarView === 'months' ? '6M' : 
                  <DynamicTranslation userLanguage={userLocale} context="general">
                    Month
                  </DynamicTranslation>
                }
              </Button>
              <h2 className="text-sm sm:text-lg lg:text-xl font-semibold text-blue-800 text-center sm:text-left">
                {calendarView === 'months' && `${currentDate.getFullYear()} - CPFR Planning`}
                {calendarView === 'weeks' && selectedMonth && selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {calendarView === 'days' && selectedMonth && selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="text-xs sm:text-sm"
                onClick={() => {
                  if (calendarView === 'months') {
                    // Navigate months view
                    const newDate = new Date(currentDate);
                    newDate.setMonth(newDate.getMonth() + 6); // Move forward 6 months for 6-month view
                    setCurrentDate(newDate);
                  } else if (calendarView === 'weeks' && selectedMonth) {
                    // Navigate to next month in weeks view
                    const newMonth = new Date(selectedMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    setSelectedMonth(newMonth);
                  }
                }}
              >
                <span className="hidden sm:inline">
                  <DynamicTranslation userLanguage={userLocale} context="general">
                    Next
                  </DynamicTranslation>{' '}
                </span>{calendarView === 'months' ? '6M' : 
                  <DynamicTranslation userLanguage={userLocale} context="general">
                    Month
                  </DynamicTranslation>
                } →
              </Button>
              
              {/* Today/Current Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentDate(new Date());
                  if (calendarView === 'weeks') {
                    setSelectedMonth(new Date());
                  }
                }}
                className="bg-blue-100 text-blue-700 hover:bg-blue-200"
              >
                📍 Today
              </Button>
            </div>
            <div className="text-sm text-blue-700">
              {calendarView === 'months' ? '6-Month CPFR View' : 
               calendarView === 'weeks' ? 
                 <DynamicTranslation userLanguage={userLocale} context="general">
                   Weekly Detail View
                 </DynamicTranslation> : 
                 <DynamicTranslation userLanguage={userLocale} context="general">
                   Daily Detail View
                 </DynamicTranslation>
               }
            </div>
          </div>

          {/* Months View - Landing Page */}
          {calendarView === 'months' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {generateMonths().map((month) => (
                <Card 
                  key={month.key} 
                  className={`hover:shadow-lg transition-all cursor-pointer border-2 ${
                    getMonthHolidayStyle(month.date) || 'hover:border-blue-300'
                  }`}
                  onClick={() => {
                    setSelectedMonth(month.date);
                    setCalendarView('weeks');
                  }}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-semibold text-center">
                      {month.name}
                    </CardTitle>
                    <CardDescription className="text-center">
                      <div className="text-sm font-medium text-blue-600">
                        {month.forecastCount} forecast{month.forecastCount !== 1 ? 's' : ''}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Activity Dots Preview */}
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {/* Generate mini calendar with accurate dots */}
                      {(() => {
                        const firstDay = new Date(month.date.getFullYear(), month.date.getMonth(), 1);
                        const lastDay = new Date(month.date.getFullYear(), month.date.getMonth() + 1, 0);
                        const startOfCalendar = new Date(firstDay);
                        startOfCalendar.setDate(startOfCalendar.getDate() - firstDay.getDay());
                        
                        // Get actual dates with forecast activity and their status
                        const activeDates = new Map<number, string>(); // date -> overall status
                        month.forecasts.forEach(forecast => {
                          if (forecast.deliveryWeek.includes('W')) {
                            const year = parseInt(forecast.deliveryWeek.split('-')[0]);
                            const week = parseInt(forecast.deliveryWeek.split('W')[1]);
                            const weekDate = getDateFromISOWeek(year, week);
                            if (weekDate.getMonth() === month.date.getMonth()) {
                              // Determine overall status for dot color
                              const sales = forecast.salesSignal || 'unknown';
                              const factory = forecast.factorySignal || 'unknown';
                              const shipping = forecast.shippingSignal || 'unknown';
                              
                              let overallStatus = 'activity'; // Default red dot
                              
                              // CPFR Signal Priority Logic for Calendar Dots:
                              // 🟢 GREEN: All three confirmed (complete success)
                              if (sales === 'confirmed' && factory === 'confirmed' && shipping === 'confirmed') {
                                overallStatus = 'confirmed';
                              }
                              // 🔴 RED: Any rejected OR incomplete process (submitted but others unknown)
                              else if (sales === 'rejected' || factory === 'rejected' || shipping === 'rejected') {
                                overallStatus = 'rejected';
                              }
                              else if (sales === 'submitted' && (factory === 'unknown' || shipping === 'unknown')) {
                                overallStatus = 'rejected'; // Red - submitted but incomplete
                              }
                              // 🟡 YELLOW: All actively in process (sales submitted, others reviewing)
                              else if (
                                sales === 'submitted' && 
                                factory === 'reviewing' && 
                                shipping === 'submitted'
                              ) {
                                overallStatus = 'reviewing';
                              }
                              
                              activeDates.set(weekDate.getDate(), overallStatus);
                            }
                          }
                        });
                        
                        return Array.from({ length: 35 }, (_, i) => {
                          const currentDate = new Date(startOfCalendar);
                          currentDate.setDate(startOfCalendar.getDate() + i);
                          
                          const dayNumber = currentDate.getDate();
                          const isCurrentMonth = currentDate.getMonth() === month.date.getMonth();
                          const activityStatus = isCurrentMonth ? activeDates.get(dayNumber) : null;
                          
                          // Get dot color based on CPFR status
                          const getDotColor = (status: string | null) => {
                            switch (status) {
                              case 'confirmed': return 'bg-green-400'; // All three signals confirmed
                              case 'reviewing': return 'bg-yellow-400'; // Some signals reviewing
                              case 'rejected': return 'bg-red-400'; // Any signal rejected
                              case 'activity': return 'bg-red-400'; // Default activity (unknown/submitted)
                              default: return null;
                            }
                          };
                          
                          return (
                            <div
                              key={i}
                              className={`w-6 h-6 flex items-center justify-center text-xs rounded ${
                                isCurrentMonth
                                  ? activityStatus 
                                    ? 'bg-blue-100 text-blue-800 font-bold' 
                                    : 'text-gray-400 hover:bg-gray-50'
                                  : 'text-gray-300'
                              }`}
                            >
                              {isCurrentMonth ? (
                                <div className="relative">
                                  {dayNumber}
                                  {activityStatus && (
                                    <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${getDotColor(activityStatus)}`}></div>
                                  )}
                                </div>
                              ) : (
                                currentDate.getDate()
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    
                    <div className="text-center text-xs text-gray-600">
                      Click to view weekly details →
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Weeks View - Month Detail */}
          {calendarView === 'weeks' && selectedMonth && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCalendarView('months');
                    setSelectedMonth(null);
                  }}
                >
                  ← Back to Months
                </Button>
                <h3 className="text-lg font-semibold">
                  {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} - Weekly View
                </h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {generateWeeksForMonth(selectedMonth).map((week) => (
                  <Card key={week.isoWeek} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold">
                        Week {week.isoWeek.split('W')[1]}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        <div className="font-medium">{week.start.toLocaleDateString()} - {week.end.toLocaleDateString()}</div>
                        <div className="text-gray-500 mt-1">
                          {week.forecastCount} forecast{week.forecastCount !== 1 ? 's' : ''}
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {canCreateForecasts && (
                        <Button 
                          variant="outline" 
                          className="w-full text-xs mb-3"
                          onClick={() => {
                            setSelectedDate(week.isoWeek);
                            setShowCreateModal(true);
                          }}
                        >
                          <SemanticBDIIcon semantic="plus" size={12} className="mr-1" />
                          Add Forecast
                        </Button>
                      )}
                      
                      {/* Week Forecasts with Signals */}
                      <div className="space-y-2">
                        {week.forecasts.slice(0, 2).map(forecast => (
                          <div 
                            key={forecast.id} 
                            className={`p-2 rounded border cursor-pointer hover:shadow-sm ${getForecastStatusColor(forecast)}`}
                            onClick={() => {
                              setSelectedWeekForDetail(week.isoWeek);
                              setShowDetailModal(true);
                            }}
                          >
                            <div className="font-mono text-xs font-bold">{forecast.sku.sku}</div>
                            <div className="text-xs">{forecast.quantity.toLocaleString()} units</div>
                            <div className="flex items-center justify-between text-xs mt-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-600">Sales</span>
                                <span className={getSignalColor(forecast.salesSignal || 'unknown')}>
                                  {getSignalIcon(forecast.salesSignal || 'unknown')}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-600">Factory</span>
                                <span className={getSignalColor(forecast.factorySignal || 'unknown')}>
                                  {getSignalIcon(forecast.factorySignal || 'unknown')}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-600">Shipping</span>
                                <span className={getSignalColor(forecast.shippingSignal || 'unknown')}>
                                  {getSignalIcon(forecast.shippingSignal || 'unknown')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {week.forecasts.length > 2 && (
                          <div className="text-xs text-center text-blue-600 cursor-pointer hover:underline"
                               onClick={() => {
                                 setSelectedWeekForDetail(week.isoWeek);
                                 setShowDetailModal(true);
                               }}>
                            +{week.forecasts.length - 2} more
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="forecasts" size={20} className="mr-2" />
                  All Forecasts
                </CardTitle>
                
                {/* Download CPFR Data Button - Organization-specific */}
                <Button
                  onClick={downloadCPFRData}
                  disabled={!forecastsArray.length}
                  variant="outline"
                  size="sm"
                  className="flex items-center"
                >
                  <SemanticBDIIcon semantic="download" size={16} className="mr-2" />
                  Download CPFR Data
                </Button>
              </div>
              
              {/* Search and Filters */}
              {forecastsArray.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Search Box */}
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="forecast-search" className="text-xs font-medium text-gray-700">Search</Label>
                    <Input
                      id="forecast-search"
                      type="text"
                      placeholder="Search SKU, name, notes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="px-2 py-1.5 text-sm"
                    />
                  </div>
                  
                  {/* SKU Filter */}
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="sku-filter" className="text-xs font-medium text-gray-700">SKU</Label>
                    <select
                      id="sku-filter"
                      value={skuFilter}
                      onChange={(e) => setSkuFilter(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All SKUs</option>
                      {Array.from(new Set(forecastsArray.map(f => f.sku.sku))).sort().map(sku => (
                        <option key={sku} value={sku}>{sku}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Manufacturer Filter */}
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="manufacturer-filter" className="text-xs font-medium text-gray-700">Manufacturer</Label>
                    <select
                      id="manufacturer-filter"
                      value={manufacturerFilter}
                      onChange={(e) => setManufacturerFilter(e.target.value)}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Manufacturers</option>
                      {Array.from(new Set(forecastsArray.map(f => f.sku.mfg).filter(Boolean) as string[])).sort().map(mfr => (
                        <option key={mfr} value={mfr}>{mfr}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Date Sort */}
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="date-sort" className="text-xs font-medium text-gray-700">Sort by Date</Label>
                    <select
                      id="date-sort"
                      value={dateSort}
                      onChange={(e) => setDateSort(e.target.value as 'ascending' | 'descending')}
                      className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ascending">📅 Oldest First</option>
                      <option value="descending">📅 Newest First</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Risk detection: Determine if forecast can meet delivery week
  // Check if forecast is fully completed (all signals confirmed)
  const isFullyCompleted = (forecast: SalesForecast): boolean => {
    const transitSignal = (forecast as any).transitSignal || 'unknown';
    const warehouseSignal = (forecast as any).warehouseSignal || 'unknown';
    
    return (
      forecast.salesSignal === 'confirmed' &&
      forecast.factorySignal === 'confirmed' &&
      (transitSignal === 'confirmed' || warehouseSignal === 'confirmed' || warehouseSignal === 'completed')
    );
  };

  const isAtRisk = (forecast: SalesForecast): boolean => {
    try {
      // Parse delivery week (e.g., "2025-W47")
      const [year, week] = forecast.deliveryWeek.split('-W');
      const deliveryYear = parseInt(year);
      const deliveryWeekNum = parseInt(week);
                  
                  // Calculate delivery date from week number
                  const jan1 = new Date(deliveryYear, 0, 1);
                  const daysToAdd = (deliveryWeekNum - 1) * 7;
                  const deliveryDate = new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                  
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); // Normalize to start of day
                  const daysUntilDelivery = Math.ceil((deliveryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
                  
                  // Check all signals
                  const factoryConfirmed = forecast.factorySignal === 'confirmed';
                  const factoryPending = !factoryConfirmed;
                  
                  const transitSignal = (forecast as any).transitSignal || 'unknown';
                  const warehouseSignal = (forecast as any).warehouseSignal || 'unknown';
                  
                  // If warehouse is confirmed/completed, it's already delivered - NOT at risk!
                  if (warehouseSignal === 'confirmed' || warehouseSignal === 'completed') {
                    return false;
                  }
                  
                  // If transit is confirmed (delivered) - NOT at risk!
                  if (transitSignal === 'confirmed') {
                    return false;
                  }
                  
                  // If already past delivery date and NOT delivered, definitely at risk
                  if (daysUntilDelivery < 0) return true;
                  
                  const inTransit = transitSignal === 'submitted';
                  // Check if delivered (either transit or warehouse confirmed)
                  const transitConfirmed = transitSignal === 'confirmed';
                  const warehouseConfirmed = warehouseSignal === 'confirmed';
                  const isDelivered = transitConfirmed || warehouseConfirmed;
                  
                  // Use ACTUAL milestone dates if available (more accurate than estimates!)
                  const customExwDate = (forecast as any).customExwDate;
                  const estimatedTransitStart = (forecast as any).estimatedTransitStart;
                  const estimatedWarehouseArrival = (forecast as any).estimatedWarehouseArrival;
                  const confirmedDeliveryDate = (forecast as any).confirmedDeliveryDate;
                  
                  // If we have actual warehouse arrival date, check if it will be after delivery week
                  if (estimatedWarehouseArrival) {
                    const arrivalDate = new Date(estimatedWarehouseArrival);
                    arrivalDate.setHours(0, 0, 0, 0);
                    if (arrivalDate > deliveryDate) {
                      console.log(`🚨 Risk: Estimated arrival ${arrivalDate.toLocaleDateString()} is after delivery week ${forecast.deliveryWeek}`);
                      return true;
                    }
                  }
                  
                  // If we have confirmed delivery date, check if it will be after delivery week
                  if (confirmedDeliveryDate) {
                    const finalDate = new Date(confirmedDeliveryDate);
                    finalDate.setHours(0, 0, 0, 0);
                    if (finalDate > deliveryDate) {
                      console.log(`🚨 Risk: Confirmed delivery ${finalDate.toLocaleDateString()} is after delivery week ${forecast.deliveryWeek}`);
                      return true;
                    }
                  }
                  
                  // Estimate shipping time based on shipping preference
                  let estimatedShippingDays = 21; // default sea shipping
                  const shippingPref = forecast.shippingPreference || '';
                  if (shippingPref.includes('AIR')) {
                    if (shippingPref.includes('7')) estimatedShippingDays = 7;
                    else if (shippingPref.includes('14')) estimatedShippingDays = 14;
                    else estimatedShippingDays = 10; // default air
                  } else if (shippingPref.includes('SEA')) {
                    if (shippingPref.includes('45')) estimatedShippingDays = 45;
                    else if (shippingPref.includes('28')) estimatedShippingDays = 28;
                    else estimatedShippingDays = 21; // default sea
                  }
                  
                  // Risk scenarios:
                  // 1. Factory not confirmed and less than (lead time + shipping time) days left
                  if (factoryPending) {
                    const minimumLeadTime = 30; // Assume 30 days minimum factory lead time
                    const totalTimeNeeded = minimumLeadTime + estimatedShippingDays + 5; // +5 buffer
                    if (daysUntilDelivery < totalTimeNeeded) return true;
                  }
                  
                  // 2. Factory confirmed but not in transit and less than (shipping time + buffer) days left
                  if (factoryConfirmed && !inTransit) {
                    const totalTimeNeeded = estimatedShippingDays + 7; // +7 days buffer for factory to ship
                    if (daysUntilDelivery < totalTimeNeeded) return true;
                  }
                  
                  // 3. In transit but not enough time based on shipping method
                  if (inTransit && !isDelivered) {
                    if (daysUntilDelivery < estimatedShippingDays) return true;
                  }
                  
                  // 4. Less than 14 days and still not delivered
                  if (daysUntilDelivery < 14 && !isDelivered) return true;
                  
                  return false;
                } catch (error) {
                  console.error('Risk assessment error:', error);
                  return false;
                }
              };
              
              // Apply filters and sorting
              const filtered = forecastsArray.filter(forecast => {
                // Search filter
                const matchesSearch = !searchTerm || 
                  forecast.sku.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  forecast.sku.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (forecast.notes && forecast.notes.toLowerCase().includes(searchTerm.toLowerCase()));
                
                // SKU filter
                const matchesSku = skuFilter === 'all' || forecast.sku.sku === skuFilter;
                
                // Manufacturer filter (use mfg field from SKU, e.g., MTN, CBN - same as Shipments)
                const matchesManufacturer = manufacturerFilter === 'all' || forecast.sku?.mfg === manufacturerFilter;
                
                return matchesSearch && matchesSku && matchesManufacturer;
              }).sort((a, b) => {
                // Sort by delivery week
                const weekA = a.deliveryWeek || '';
                const weekB = b.deliveryWeek || '';
                
                if (dateSort === 'ascending') {
                  return weekA.localeCompare(weekB);
                } else {
                  return weekB.localeCompare(weekA);
                }
              });
              
              return filtered.length === 0 ? (
              <div className="text-center py-12">
                <SemanticBDIIcon semantic="forecasts" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {forecastsArray.length === 0 ? (
                    <DynamicTranslation userLanguage={userLocale} context="cpfr">
                      {canCreateForecasts ? 'No Forecasts Yet' : 'No Forecasts Available'}
                    </DynamicTranslation>
                  ) : 'No Matching Forecasts'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {forecastsArray.length === 0 ? (
                    <DynamicTranslation userLanguage={userLocale} context="cpfr">
                      {canCreateForecasts 
                        ? 'Create your first demand forecast to start CPFR planning'
                        : 'Waiting for BDI to create forecasts for your organization'
                      }
                    </DynamicTranslation>
                  ) : 'Try adjusting your search or filters'}
                </p>
                {canCreateForecasts && forecastsArray.length === 0 && (
                  <Button onClick={() => setShowCreateModal(true)}>
                    <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                    Create First Forecast
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (forecastsArray.length > 0) {
                      setSearchTerm('');
                      setSkuFilter('all');
                      setManufacturerFilter('all');
                    } else {
                      mutateForecasts();
                    }
                  }}
                  className="ml-2"
                >
                  <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
                  {forecastsArray.length === 0 ? tc('refreshButton', 'Refresh') : 'Clear Filters'}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((forecast) => {
                  const atRisk = isAtRisk(forecast);
                  const completed = isFullyCompleted(forecast);
                  return (
                  <div 
                    key={forecast.id}
                    id={`forecast-${forecast.id}`}
                    className={`border rounded-lg p-3 sm:p-4 transition-colors ${
                      completed
                        ? 'bg-green-50 border-green-200 hover:bg-green-100'
                        : atRisk 
                        ? 'bg-red-50 border-red-200 hover:bg-red-100' 
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                      <div className="flex-1">
                        {/* Header with SKU name and code */}
                        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 mb-3">
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="font-semibold text-sm sm:text-base">{forecast.sku.name}</h3>
                            <Badge variant="outline" className="font-mono text-xs">
                              {forecast.sku.sku}
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
                              {forecast.quantity.toLocaleString()} units
                            </Badge>
                            <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
                              {forecast.deliveryWeek}
                            </Badge>
                            {forecast.shippingPreference && (
                              <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">
                                {forecast.shippingPreference === 'INDIRECT' ? '📦' : 
                                 forecast.shippingPreference === 'ZERO_LAG_SAME_DAY' || forecast.shippingPreference === 'ZERO_LAG_NEXT_DAY' || forecast.shippingPreference === 'ZERO_LAG_CUSTOM' ? '⚡' :
                                 forecast.shippingPreference.startsWith('AIR_') ? '✈️' : 
                                 forecast.shippingPreference.startsWith('SEA_') ? '🚢' : 
                                 forecast.shippingPreference.startsWith('TRUCK_') || forecast.shippingPreference === 'RAIL' ? '🚛' : '🚚'}
                                {forecast.shippingPreference}
                              </Badge>
                            )}
                          </div>
                          
                          {/* CPFR Signals - Mobile: Below title, Desktop: Same line */}
                          <div className="flex items-center space-x-3 sm:space-x-4 text-xs">
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-600 hidden sm:inline">Sales</span>
                              <span className="text-gray-600 sm:hidden">S</span>
                              <span className={getSignalColor(forecast.salesSignal || 'unknown')}>
                                {getSignalIcon(forecast.salesSignal || 'unknown')}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-600 hidden sm:inline">Factory</span>
                              <span className="text-gray-600 sm:hidden">F</span>
                              <span className={getSignalColor(forecast.factorySignal || 'unknown')}>
                                {getSignalIcon(forecast.factorySignal || 'unknown')}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-600 hidden sm:inline">Transit</span>
                              <span className="text-gray-600 sm:hidden">T</span>
                              <span className={getSignalColor((forecast as any).transitSignal || 'unknown')}>
                                {getSignalIcon((forecast as any).transitSignal || 'unknown')}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-gray-600 hidden sm:inline">Warehouse</span>
                              <span className="text-gray-600 sm:hidden">W</span>
                              <span className={getSignalColor((forecast as any).warehouseSignal || 'unknown')}>
                                {getSignalIcon((forecast as any).warehouseSignal || 'unknown')}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Forecast Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Delivery Week:</span>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{forecast.deliveryWeek}</p>
                              {holidayCalendar.isEnabled && (() => {
                                // Convert delivery week to approximate date for holiday check
                                const [year, week] = forecast.deliveryWeek.split('-W');
                                const weekNum = parseInt(week);
                                const jan1 = new Date(parseInt(year), 0, 1);
                                const daysToAdd = (weekNum - 1) * 7;
                                const deliveryDate = new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                                const dateStr = deliveryDate.toISOString().split('T')[0];
                                
                                return <ShipmentCautionIndicator date={dateStr} showIcon={true} showBadge={false} />;
                              })()}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <p className="font-medium">{forecast.quantity.toLocaleString()} units</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <p className="font-medium">{new Date(forecast.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {forecast.notes && (
                          <p className="text-sm text-gray-600 mt-2">{forecast.notes}</p>
                        )}
                      </div>
                      
                      {/* Action Buttons - Mobile: Below content, Desktop: Right side */}
                      <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                        <Link href={`/cpfr/shipments?highlight=${forecast.id}`}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full sm:w-auto bg-cyan-50 hover:bg-cyan-100 border-cyan-200"
                          >
                            <SemanticBDIIcon semantic="warehouse" size={14} className="mr-1" />
                            View Shipment
                          </Button>
                        </Link>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto"
                          onClick={() => {
                            setSelectedForecast(forecast);
                            console.log('🔍 Loading forecast data for edit:', forecast);
                            console.log('🔍 Shipping preference check:', {
                              shippingPreference: forecast.shippingPreference,
                              shipping_preference: (forecast as any).shipping_preference,
                              salesSignal: forecast.salesSignal,
                              sales_signal: (forecast as any).sales_signal,
                              factorySignal: forecast.factorySignal,
                              factory_signal: (forecast as any).factory_signal
                            });
                            
                            setEditForecastData({
                              quantity: forecast.quantity,
                              deliveryWeek: forecast.deliveryWeek,
                              shippingPreference: forecast.shippingPreference || (forecast as any).shipping_preference || '',
                              notes: forecast.notes || '',
                              salesSignal: forecast.salesSignal || (forecast as any).sales_signal || 'unknown',
                              factorySignal: forecast.factorySignal || (forecast as any).factory_signal || 'unknown',
                              transitSignal: (forecast as any).transitSignal || (forecast as any).transit_signal || 'unknown',
                              warehouseSignal: (forecast as any).warehouseSignal || (forecast as any).warehouse_signal || 'unknown'
                            });
                            setShowEditModal(true);
                          }}
                        >
                          <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                          <DynamicTranslation userLanguage={userLocale} context="general">
                            {canCreateForecasts ? 'Edit' : 'Respond'}
                          </DynamicTranslation>
                        </Button>
                        
                        {/* Scenario Analysis Button - CPFR Leader Tool */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto text-purple-600 border-purple-300 hover:bg-purple-50"
                          onClick={() => {
                            setAnalysisForecast(forecast);
                            // Reset analysis data for fresh analysis
                            setAnalysisData({
                              shippingMethod: '',
                              customShippingDays: '',
                              leadTime: 'auto',
                              customLeadTimeDays: '',
                              safetyBuffer: '5',
                              customBufferDays: ''
                            });
                            // Reset timeline results
                            setTimelineResults(null);
                            setShowTimeline(false);
                            setShowAnalysisModal(true);
                          }}
                        >
                          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                          Analysis
                        </Button>
                        
                        {/* Delete Button - Only for BDI users with permission */}
                        {canCreateForecasts && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50"
                            onClick={() => handleDeleteForecast(forecast.id, forecast.sku.sku)}
                          >
                            <SemanticBDIIcon semantic="delete" size={14} className="mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Create Forecast Modal - Only for BDI users */}
      {showCreateModal && canCreateForecasts && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="forecasts" size={20} className="mr-2" />
                {tc('createSalesForecast', 'Create Sales Forecast')}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-12 p-8" onSubmit={(e) => {
              e.preventDefault();
              handleCreateForecast(new FormData(e.currentTarget));
            }}>
              {/* SKU Selection */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
                  <Label className="text-base font-semibold">Select Product SKU</Label>
                  
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                    {/* Search Input */}
                    <div className="relative">
                      <SemanticBDIIcon 
                        semantic="search" 
                        size={16} 
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" 
                      />
                      <Input
                        placeholder="Search SKUs..."
                        value={skuSearchTerm}
                        onChange={(e) => setSkuSearchTerm(e.target.value)}
                        className="pl-9 w-full sm:w-64"
                      />
                    </div>
                    
                    {/* Grid/List/Dropdown Toggle */}
                    <div className="flex border rounded-md">
                      <button
                        type="button"
                        onClick={() => setSkuViewMode('grid')}
                        className={`px-3 py-2 text-sm transition-colors ${
                          skuViewMode === 'grid' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <SemanticBDIIcon semantic="grid" size={14} className="mr-1" />
                        Grid
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkuViewMode('list')}
                        className={`px-3 py-2 text-sm transition-colors ${
                          skuViewMode === 'list' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <SemanticBDIIcon semantic="list" size={14} className="mr-1" />
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => setSkuViewMode('dropdown')}
                        className={`px-3 py-2 text-sm transition-colors ${
                          skuViewMode === 'dropdown' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <SemanticBDIIcon semantic="dropdown" size={14} className="mr-1" />
                        Dropdown
                      </button>
                    </div>
                  </div>
                </div>
                
                {skuViewMode === 'dropdown' ? (
                  // Dropdown View (Compact Single Line)
                  <div className="border rounded-lg p-3">
                    <select
                      value={selectedSku?.id || ''}
                      onChange={(e) => {
                        const selected = skusArray.find(s => s.id === e.target.value);
                        setSelectedSku(selected || null);
                        setForecastQuantity(0);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a SKU...</option>
                      {skusArray
                        .filter(sku => 
                          sku.sku.toLowerCase().includes(skuSearchTerm.toLowerCase()) ||
                          sku.name.toLowerCase().includes(skuSearchTerm.toLowerCase())
                        )
                        .map((sku) => (
                          <option key={sku.id} value={sku.id}>
                            {sku.sku} - {sku.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : (
                  // Grid/List Views (Standard Height)
                  <div className={`max-h-80 overflow-y-auto border rounded-lg p-3 sm:p-6 ${
                    skuViewMode === 'grid' 
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 lg:gap-4' 
                      : 'space-y-2'
                  }`}>
                  {skusArray
                    .filter(sku => 
                      sku.sku.toLowerCase().includes(skuSearchTerm.toLowerCase()) ||
                      sku.name.toLowerCase().includes(skuSearchTerm.toLowerCase())
                    )
                    .map((sku) => {
                    const productType = sku.sku.length >= 3 ? sku.sku.charAt(2) : 'C';
                    const getProductTypeColor = (type: string) => {
                      const colors: { [key: string]: string } = {
                        'B': 'bg-blue-100 border-blue-300 text-blue-800',
                        'G': 'bg-green-100 border-green-300 text-green-800',
                        'Q': 'bg-purple-100 border-purple-300 text-purple-800',
                        'F': 'bg-orange-100 border-orange-300 text-orange-800',
                        'P': 'bg-pink-100 border-pink-300 text-pink-800',
                        'X': 'bg-indigo-100 border-indigo-300 text-indigo-800',
                        'A': 'bg-yellow-100 border-yellow-300 text-yellow-800',
                        'R': 'bg-red-100 border-red-300 text-red-800',
                      };
                      return colors[type] || 'bg-gray-100 border-gray-300 text-gray-800';
                    };
                    
                    return skuViewMode === 'grid' ? (
                      // Grid View (Current)
                      <div 
                        key={sku.id} 
                        className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${
                          selectedSku?.id === sku.id 
                            ? 'ring-2 ring-blue-500 border-blue-500' 
                            : getProductTypeColor(productType)
                        } hover:shadow-md`}
                        onClick={() => {
                          setSelectedSku(sku);
                          setForecastQuantity(0); // Reset forecast quantity when SKU changes
                        }}
                      >
                        <div className="text-center">
                          <div className="text-xs font-mono font-bold mb-1 truncate">
                            {sku.sku}
                          </div>
                          <div className="text-xs font-medium leading-tight line-clamp-2">
                            {sku.name}
                          </div>
                        </div>
                      </div>
                    ) : (
                      // List View (New)
                      <div 
                        key={sku.id} 
                        className={`relative border rounded-lg p-3 cursor-pointer transition-all ${
                          selectedSku?.id === sku.id 
                            ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50' 
                            : getProductTypeColor(productType)
                        } hover:shadow-md`}
                        onClick={() => {
                          setSelectedSku(sku);
                          setForecastQuantity(0); // Reset forecast quantity when SKU changes
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <div className={`w-3 h-3 rounded-full ${
                              selectedSku?.id === sku.id ? 'bg-blue-500' : 'bg-current opacity-30'
                            }`}></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-bold text-sm truncate">{sku.sku}</p>
                            <p className="text-sm text-gray-600 truncate">{sku.name}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
                {selectedSku && (
                  <div className="mt-4 p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="font-mono text-sm px-3 py-1">{selectedSku.sku}</Badge>
                        <span className="font-semibold text-lg">{selectedSku.name}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6 xl:gap-10 text-sm">
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Units per Carton</span>
                        <p className="font-bold text-3xl text-blue-600 mb-2">
                          {(selectedSku as any).boxesPerCarton || 
                            <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                              Not Set
                            </DynamicTranslation>
                          }
                        </p>
                        <p className="text-xs text-gray-500">
                          <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                            {(selectedSku as any).boxesPerCarton ? 'Forecast in multiples of this' : 'Configure in SKU settings'}
                          </DynamicTranslation>
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Lead Time Options</span>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="mp_ready"
                              name="leadTimeOption"
                              value="mp_ready"
                              checked={leadTimeOption === 'mp_ready'}
                              onChange={(e) => setLeadTimeOption(e.target.value as 'mp_ready')}
                              className="text-orange-600 flex-shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <label htmlFor="mp_ready" className="text-xs font-medium truncate">
                                MP Ready (EXW)
                              </label>
                              <span className="text-xs text-gray-500 truncate">
                                {(selectedSku as any)?.mpStartDate 
                                  ? new Date((selectedSku as any).mpStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : 'Not set'
                                }
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="normal"
                              name="leadTimeOption"
                              value="normal"
                              checked={leadTimeOption === 'normal'}
                              onChange={(e) => setLeadTimeOption(e.target.value as 'normal')}
                              className="text-orange-600 flex-shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <label htmlFor="normal" className="text-xs font-medium truncate">
                                Normal
                              </label>
                              <span className="text-xs text-gray-500 truncate">
                                {(selectedSku as any)?.leadTimeDays || 30} days
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="custom"
                              name="leadTimeOption"
                              value="custom"
                              checked={leadTimeOption === 'custom'}
                              onChange={(e) => setLeadTimeOption(e.target.value as 'custom')}
                              className="text-orange-600 flex-shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <label htmlFor="custom" className="text-xs font-medium truncate">
                                Custom
                              </label>
                              {leadTimeOption === 'custom' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    placeholder="Days"
                                    value={customLeadTime || ''}
                                    onChange={(e) => setCustomLeadTime(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-12 px-1 py-0.5 border rounded text-xs"
                                    min="1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                    className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                                  >
                                    📅
                                  </button>
                                  {showDatePicker && (
                                    <input
                                      type="date"
                                      value={customDate}
                                      onChange={(e) => setCustomDate(e.target.value)}
                                      className="px-1 py-0.5 border rounded text-xs w-20"
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500 truncate">
                                  Days or date
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">MOQ</span>
                        <p className="font-bold text-3xl text-green-600 mb-2">
                          {((selectedSku as any).moq || 1).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Minimum order quantity
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Shipping Time</span>
                        <p className="font-bold text-xl text-purple-600 mb-2">
                          {(() => {
                            const shippingTimes: { [key: string]: string } = {
                              'INDIRECT': 'EXW = Delivery Week',
                              'ZERO_LAG_SAME_DAY': 'Same day',
                              'ZERO_LAG_NEXT_DAY': '1 day',
                              'ZERO_LAG_CUSTOM': 'Custom',
                              'AIR_7_DAYS': '7 days',
                              'AIR_14_DAYS': '14 days',
                              'AIR_NLD': '14 days',
                              'AIR_AUT': '14 days',
                              'SEA_ASIA_US_WEST': '45 days',
                              'SEA_ASIA_US_EAST': '52 days',
                              'SEA_WEST_EXPEDITED': '35 days',
                              'SEA_ASIA_NLD': '45 days',
                              'SEA_ASIA_AUT': '45 days',
                              'TRUCK_EXPRESS': '7-14 days',
                              'TRUCK_STANDARD': '14-28 days',
                              'RAIL': '21-35 days',
                            };
                            return selectedShipping ? shippingTimes[selectedShipping] || 
                              <DynamicTranslation userLanguage={userLocale} context="cpfr">
                                TBD
                              </DynamicTranslation> : 
                              <DynamicTranslation userLanguage={userLocale} context="cpfr">
                                Select shipping
                              </DynamicTranslation>;
                          })()}
                        </p>
                        <p className="text-xs text-gray-500">
                          <DynamicTranslation userLanguage={userLocale} context="cpfr">
                            {selectedShipping ? 'Transit time for selected method' : 'Choose shipping method above'}
                          </DynamicTranslation>
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Total Delivery Time</span>
                        <p className="font-bold text-xl text-indigo-600 mb-2">
                          {(() => {
                            if (!selectedShipping) return (
                              <DynamicTranslation userLanguage={userLocale} context="cpfr">
                                Select shipping
                              </DynamicTranslation>
                            );
                            const leadTime = getEffectiveLeadTime();
                            const shippingDays: { [key: string]: number } = {
                              'AIR_7_DAYS': 7,
                              'AIR_14_DAYS': 14,
                              'AIR_NLD': 14,
                              'AIR_AUT': 14,
                              'SEA_ASIA_US_WEST': 45,
                              'SEA_ASIA_US_EAST': 52,
                              'SEA_WEST_EXPEDITED': 35,
                              'SEA_ASIA_EU_NLD': 45,
                              'SEA_ASIA_EU_AUT': 45,
                              'GROUND': 14
                            };
                            
                            if (leadTimeOption === 'mp_ready' && (selectedSku as any)?.mpStartDate) {
                              const mpReady = new Date((selectedSku as any).mpStartDate);
                              const today = new Date();
                              const daysToMpReady = Math.ceil((mpReady.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              const totalDays = daysToMpReady + shippingTime;

                              return totalDays;
                            } else {
                              const leadTime = getEffectiveLeadTime();
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              const totalDays = leadTime + shippingTime;

                              return totalDays;
                            }
                          })()} days
                        </p>
                        <p className="text-xs text-gray-500">
                          <DynamicTranslation userLanguage={userLocale} context="cpfr">
                            {selectedShipping ? 'Lead time + shipping time' : 'Select shipping for calculation'}
                          </DynamicTranslation>
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Purchase Order Selection */}
              {selectedSku && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg border border-green-200">
                  <Label htmlFor="purchaseOrder" className="text-base font-semibold text-green-800 mb-3 block">
                    Link to Purchase Order (Optional)
                  </Label>
                  <select
                    id="purchaseOrder"
                    name="purchaseOrder"
                    value={selectedPurchaseOrder}
                    onChange={(e) => setSelectedPurchaseOrder(e.target.value)}
                    className="w-full px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select Purchase Order (Optional)</option>
                    {Array.isArray(purchaseOrders) && purchaseOrders
                      .filter(po => {
                        // Show POs where the supplier organization matches the SKU's target organization
                        // For now, show all POs - will enhance with SKU-specific filtering
                        return po.supplierName; // Only show POs with supplier organizations
                      })
                      .map(po => (
                        <option key={po.id} value={po.id}>
                          {po.purchaseOrderNumber} - {po.supplierName} - ${Number(po.totalValue).toLocaleString()}
                        </option>
                      ))}
                  </select>
                  <div className="text-xs text-green-600 mt-2">
                    Link this forecast to a specific Purchase Order for enhanced CPFR tracking
                  </div>
                </div>
              )}

              {/* Forecast Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 xl:gap-20 mt-8 lg:mt-12">
                <div>
                  <Label htmlFor="deliveryWeek">Final Delivery Week *</Label>
                  
                  {/* Compact Calendar Picker */}
                  <div className="mt-1 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 rounded-xl shadow-sm overflow-hidden">
                    
                    {/* Selected Week Display */}
                    <div className="bg-white border-b border-blue-200 p-3">
                      <div className="text-center">
                        <div className="text-sm font-medium text-blue-800 mb-1">Selected Delivery Week</div>
                        <div className="text-lg font-bold text-blue-900 bg-blue-100 rounded-lg py-2 px-4">
                          {selectedDeliveryWeek || 
                            <DynamicTranslation userLanguage={userLocale} context="general">
                              Click a week below
                            </DynamicTranslation>
                          }
                        </div>
                      </div>
                    </div>
                    
                    {/* Mini Month Navigation */}
                    <div className="bg-white border-b border-blue-100 px-3 py-2">
                      <div className="flex justify-between items-center">
                        <button 
                          type="button"
                          onClick={() => {
                            const newDate = new Date(calendarPickerDate);
                            newDate.setMonth(newDate.getMonth() - 1);
                            setCalendarPickerDate(newDate);
                          }}
                          className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                        >
                          ← Prev
                        </button>
                        <div className="text-center">
                          <div className="font-bold text-blue-900">
                            {calendarPickerDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => {
                            const newDate = new Date(calendarPickerDate);
                            newDate.setMonth(newDate.getMonth() + 1);
                            setCalendarPickerDate(newDate);
                          }}
                          className="p-2 hover:bg-blue-100 rounded-full text-blue-600 transition-colors"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                    
                    {/* Compact Calendar Grid */}
                    <div className="p-3 bg-white">
                      {/* Week headers */}
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                          <div key={`day-${index}`} className="text-center font-bold text-xs text-gray-600 py-1">
                            {day}
                          </div>
                        ))}
                      </div>
                      
                      {/* Calendar Days */}
                      <div className="grid grid-cols-7 gap-1">
                        {(() => {
                          const year = calendarPickerDate.getFullYear();
                          const month = calendarPickerDate.getMonth();
                          const firstDay = new Date(year, month, 1);
                          const lastDay = new Date(year, month + 1, 0);
                          const startDate = new Date(firstDay);
                          startDate.setDate(startDate.getDate() - firstDay.getDay());
                          
                          const days = [];
                          const currentDate = new Date(startDate);
                          
                          for (let i = 0; i < 42; i++) {
                            const isCurrentMonth = currentDate.getMonth() === month;
                            const dayNum = currentDate.getDate();
                            
                            // Calculate ISO week
                            const getISOWeek = (date: Date) => {
                              const target = new Date(date.valueOf());
                              const dayNr = (date.getDay() + 6) % 7;
                              target.setDate(target.getDate() - dayNr + 3);
                              const firstThursday = target.valueOf();
                              target.setMonth(0, 1);
                              if (target.getDay() !== 4) {
                                target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
                              }
                              const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
                              return `${target.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
                            };
                            
                            const isoWeek = getISOWeek(currentDate);
                            const isSelected = selectedDeliveryWeek === isoWeek;
                            const isToday = currentDate.toDateString() === new Date().toDateString();
                            
                            // Get holiday classification for this date
                            const dateStr = currentDate.toISOString().split('T')[0];
                            const holidayStyle = holidayCalendar.getDateStyle(dateStr);
                            
                            // Debug logging for October dates
                            if (currentDate.getMonth() === 9 && currentDate.getFullYear() === 2025 && dayNum <= 10) {
                              const classification = holidayCalendar.getDateClassification(dateStr);
                              console.log(`🎊 Oct ${dayNum}, 2025: dateStr="${dateStr}", type="${classification.type}", holiday="${classification.holidayName}", enabled=${holidayCalendar.isEnabled}, isCurrentMonth=${isCurrentMonth}`);
                            }
                            
            // Check if this week is too early based on lead time + shipping
            let isTooEarly = false;
            let weekHasTooEarlyDays = false;
            
            // ZERO LAG & INDIRECT EXCEPTION: Bypass all date restrictions for immediate shipping and indirect shipments
            const isZeroLag = selectedShipping?.startsWith('ZERO_LAG_') || selectedShipping === 'INDIRECT';
            
            if (selectedSku && selectedShipping && !isZeroLag) {
                              const leadTime = getEffectiveLeadTime();
                              const shippingDays: { [key: string]: number } = {
                                // Indirect & Zero Lag Options
                                'INDIRECT': 0, 'ZERO_LAG_SAME_DAY': 0, 'ZERO_LAG_NEXT_DAY': 1, 'ZERO_LAG_CUSTOM': 0,
                                // Standard Options
                                'AIR_7_DAYS': 7, 'AIR_14_DAYS': 14, 'AIR_NLD': 14, 'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45, 'SEA_ASIA_US_EAST': 52, 'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_NLD': 45, 'SEA_ASIA_AUT': 45, 'TRUCK_EXPRESS': 10.5,
                                'TRUCK_STANDARD': 21, 'RAIL': 28,
                              };
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              const totalDays = leadTime + shippingTime;
                              const earliestDelivery = new Date();
                              earliestDelivery.setDate(earliestDelivery.getDate() + totalDays);
                              isTooEarly = currentDate < earliestDelivery;
                              
                              // Check if ANY day in this week is too early
                              const weekStart = new Date(currentDate);
                              weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday
                              
                              for (let d = 0; d < 7; d++) {
                                const dayInWeek = new Date(weekStart);
                                dayInWeek.setDate(weekStart.getDate() + d);
                                if (dayInWeek < earliestDelivery) {
                                  weekHasTooEarlyDays = true;
                                  break;
                                }
                              }
                            }
                            
                            days.push(
                              <button
                                key={i}
                                type="button"
                                onClick={() => {
                                  if (isCurrentMonth) {
                                    // If this week has any "Too Early" days, find the next valid week (UNLESS Zero Lag or Indirect)
                                    if (weekHasTooEarlyDays && selectedSku && selectedShipping && !selectedShipping.startsWith('ZERO_LAG_') && selectedShipping !== 'INDIRECT') {
                                      const leadTime = getEffectiveLeadTime();
                                      const shippingDays: { [key: string]: number } = {
                                        // Indirect & Zero Lag Options
                                        'INDIRECT': 0, 'ZERO_LAG_SAME_DAY': 0, 'ZERO_LAG_NEXT_DAY': 1, 'ZERO_LAG_CUSTOM': 0,
                                        // Standard Options
                                        'AIR_7_DAYS': 7, 'AIR_14_DAYS': 14, 'AIR_NLD': 14, 'AIR_AUT': 14,
                                        'SEA_ASIA_US_WEST': 45, 'SEA_ASIA_US_EAST': 52, 'SEA_WEST_EXPEDITED': 35,
                                        'SEA_ASIA_NLD': 45, 'SEA_ASIA_AUT': 45, 'TRUCK_EXPRESS': 10.5,
                                        'TRUCK_STANDARD': 21, 'RAIL': 28,
                                      };
                                      const shippingTime = shippingDays[selectedShipping] || 0;
                                      const totalDays = leadTime + shippingTime;
                                      const earliestDelivery = new Date();
                                      earliestDelivery.setDate(earliestDelivery.getDate() + totalDays);
                                      
                                      // Find next full week that doesn't have any "Too Early" days
                                      let nextWeekStart = new Date(currentDate);
                                      nextWeekStart.setDate(currentDate.getDate() - currentDate.getDay() + 7); // Next Sunday
                                      
                                      let foundValidWeek = false;
                                      let attempts = 0;
                                      
                                      while (!foundValidWeek && attempts < 10) {
                                        let weekIsValid = true;
                                        
                                        // Check all 7 days of this week
                                        for (let d = 0; d < 7; d++) {
                                          const dayInWeek = new Date(nextWeekStart);
                                          dayInWeek.setDate(nextWeekStart.getDate() + d);
                                          if (dayInWeek < earliestDelivery) {
                                            weekIsValid = false;
                                            break;
                                          }
                                        }
                                        
                                        if (weekIsValid) {
                                          foundValidWeek = true;
                                          // Calculate ISO week for this valid week
                                          const validWeekISO = getISOWeek(nextWeekStart);
                                          setSelectedDeliveryWeek(validWeekISO);
                                          
                                          // Show helpful message
                                          alert(`⚠️ Selected week had "Too Early" days. Advanced to next valid week: ${validWeekISO}\\n\\n📅 Total lead time: ${Math.round(totalDays)} days (${leadTime} production + ${Math.round(shippingTime)} shipping)`);
                                        } else {
                                          // Try next week
                                          nextWeekStart.setDate(nextWeekStart.getDate() + 7);
                                          attempts++;
                                        }
                                      }
                                    } else {
                                      // Week is valid, select it normally
                                      setSelectedDeliveryWeek(isoWeek);
                                    }
                                  }
                                }}
                                className={`
                                  h-8 text-xs font-medium rounded-md transition-all duration-200 transform hover:scale-105 relative
                                  ${(() => {
                                    if (!isCurrentMonth) return 'text-gray-300 cursor-not-allowed';
                                    
                                    // PROPER: Use API-based holiday classification for production
                                    if (holidayCalendar.isEnabled) {
                                      const classification = holidayCalendar.getDateClassification(dateStr);
                                      if (classification.type === 'holiday') {
                                        return '!bg-red-500 !text-white font-bold !border-red-600 hover:!bg-red-600';
                                      } else if (classification.type === 'soft-holiday') {
                                        return '!bg-red-200 !text-red-800 !border-red-300 hover:!bg-red-300';
                                      }
                                    }
                                    
                                    // Default calendar styling
                                    if (isSelected) return 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg';
                                    if (weekHasTooEarlyDays) return 'text-orange-600 bg-orange-50 border border-orange-300 hover:bg-orange-100 cursor-pointer';
                                    if (isTooEarly) return 'text-red-500 bg-red-50 border border-red-200 hover:bg-red-100';
                                    if (isToday) return 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-md';
                                    return 'text-blue-800 hover:bg-blue-100 hover:text-blue-900';
                                  })()}
                                  ${isCurrentMonth && !isTooEarly ? 'hover:shadow-md' : ''}
                                `}
                                disabled={!isCurrentMonth}
                                title={isCurrentMonth ? 
                                  `Week ${isoWeek}${
                                    weekHasTooEarlyDays ? ' - Will advance to next valid week' : 
                                    isTooEarly ? ' - Too Early' : ''
                                  }${
                                    holidayCalendar.isEnabled && holidayStyle ? 
                                      ` - ${holidayCalendar.getDateClassification(dateStr).holidayName || 'Chinese Holiday Period'}` : 
                                      ''
                                  }` : ''
                                }
                              >
                                {isCurrentMonth ? dayNum : ''}
                                {isCurrentMonth && isToday && <div className="w-1 h-1 bg-white rounded-full mx-auto mt-0.5"></div>}
                              </button>
                            );
                            
                            currentDate.setDate(currentDate.getDate() + 1);
                          }
                          
                          return days;
                        })()}
                      </div>
                      
                      {/* Legend */}
                      <div className="mt-3 pt-3 border-t border-blue-100 text-xs text-gray-600">
                        <div className="flex flex-wrap gap-3 justify-center">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gradient-to-br from-green-400 to-emerald-500 rounded"></div>
                            <span>Today</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded"></div>
                            <span>Selected</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-orange-100 border border-orange-300 rounded"></div>
                            <span>Auto-Advance</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                            <span>Too Early</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Hidden input for form submission */}
                    <input
                      type="hidden"
                      id="deliveryWeek"
                      name="deliveryWeek"
                      value={selectedDeliveryWeek}
                      required
                    />
                  </div>
                  {selectedSku && selectedShipping && (
                    <div className="mt-1">
                      <div className="text-xs text-gray-600 mb-2">
                        Final customer delivery week (includes lead time + shipping)
                      </div>
                      <div className="p-4 bg-gradient-to-r from-green-50 via-blue-50 to-emerald-50 border border-green-200 rounded-lg text-sm shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="text-center">
                          <span className="font-medium text-orange-800 block">
                            ⏱️ Lead Time
                          </span>
                          <p className="font-bold text-xl text-orange-600 my-1">
                            {(() => {
                              if (leadTimeOption === 'mp_ready' && (selectedSku as any)?.mpStartDate) {
                                const mpReady = new Date((selectedSku as any).mpStartDate);
                                const today = new Date();
                                const daysAway = Math.ceil((mpReady.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                return `${daysAway} days`;
                              }
                              return `${getEffectiveLeadTime()} days`;
                            })()}
                          </p>
                          <span className="text-orange-600 text-xs">
                            {leadTimeOption === 'mp_ready' ? 'To MP Ready (Sep 29)' : 'Production + prep'}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-purple-800 block">
                            🚚 Shipping Time
                          </span>
                          <p className="font-bold text-xl text-purple-600 my-1">
                            {(() => {
                              const shippingDays: { [key: string]: number } = {
                                // Indirect & Zero Lag Options
                                'INDIRECT': 0,
                                'ZERO_LAG_SAME_DAY': 0,
                                'ZERO_LAG_NEXT_DAY': 1,
                                'ZERO_LAG_CUSTOM': 0,
                                // Standard Options
                                'AIR_7_DAYS': 7,
                                'AIR_14_DAYS': 14,
                                'AIR_NLD': 14,
                                'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45,
                                'SEA_ASIA_US_EAST': 52,
                                'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_EU_NLD': 45,
                                'SEA_ASIA_EU_AUT': 45,
                                'GROUND': 14
                              };
                              return `${shippingDays[selectedShipping] || 0} days`;
                            })()} 
                          </p>
                          <span className="text-purple-600 text-xs">
                            Transit time
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-blue-800 block">
                            📅 Total Timeline
                          </span>
                          <p className="font-bold text-xl text-blue-600 my-1">
                            {(() => {
                              const leadTime = getEffectiveLeadTime();
                              const shippingDays: { [key: string]: number } = {
                                'INDIRECT': 0,
                                'ZERO_LAG_SAME_DAY': 0,
                                'ZERO_LAG_NEXT_DAY': 1,
                                'ZERO_LAG_CUSTOM': 0,
                                'AIR_7_DAYS': 7,
                                'AIR_14_DAYS': 14,
                                'AIR_NLD': 14,
                                'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45,
                                'SEA_ASIA_US_EAST': 52,
                                'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_NLD': 45,
                                'SEA_ASIA_AUT': 45,
                                'TRUCK_EXPRESS': 10.5,
                                'TRUCK_STANDARD': 21,
                                'RAIL': 28,
                              };
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              return `${Math.round(leadTime + shippingTime)} days`;
                            })()}
                          </p>
                          <span className="text-blue-600 text-xs">
                            Order to delivery
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-emerald-800 block">
                            🎯 Best Case
                          </span>
                          <p className="font-bold text-xl text-emerald-600 my-1">
                            {(() => {
                              const orderDate = new Date();
                              const leadTime = getEffectiveLeadTime();
                              const shippingDays: { [key: string]: number } = {
                                'INDIRECT': 0,
                                'ZERO_LAG_SAME_DAY': 0,
                                'ZERO_LAG_NEXT_DAY': 1,
                                'ZERO_LAG_CUSTOM': 0,
                                'AIR_7_DAYS': 7, // Fixed timing
                                'AIR_14_DAYS': 14,
                                'AIR_NLD': 14,
                                'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45,
                                'SEA_ASIA_US_EAST': 52,
                                'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_NLD': 45,
                                'SEA_ASIA_AUT': 45,
                                'TRUCK_EXPRESS': 7,
                                'TRUCK_STANDARD': 14,
                                'RAIL': 21,
                              };
                              const bestCaseShipping = shippingDays[selectedShipping] || 0;
                              const bestCaseDays = leadTime + bestCaseShipping;
                              const bestCaseDate = new Date(orderDate);
                              bestCaseDate.setDate(orderDate.getDate() + bestCaseDays);
                              return bestCaseDate.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              });
                            })()}
                          </p>
                          <span className="text-emerald-600 text-xs">
                            Earliest delivery
                          </span>
                        </div>
                      </div>
                    </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity (units) *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    step="1"
                    placeholder={
                      (selectedSku as any)?.boxesPerCarton 
                        ? `Multiples of ${(selectedSku as any).boxesPerCarton} (e.g., ${(selectedSku as any).boxesPerCarton * 100})`
                        : "e.g., 5000"
                    }
                    required
                    className={`mt-1 ${quantityError ? 'border-red-500 bg-red-50 text-red-900' : ''}`}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      const unitsPerCarton = (selectedSku as any)?.boxesPerCarton;
                      const moq = (selectedSku as any)?.moq || 1;
                      
                      // Update forecast quantity for CPFR calculations
                      setForecastQuantity(value || 0);
                      
                      let error = '';
                      
                      // Check carton multiple
                      if (unitsPerCarton && value && value % unitsPerCarton !== 0) {
                        error = `Must be multiple of ${unitsPerCarton} (units per carton)`;
                      }
                      // Check MOQ (unless override is enabled)
                      else if (!moqOverride && value && value < moq) {
                        error = `Below MOQ of ${moq.toLocaleString()} units`;
                      }
                      
                      setQuantityError(error);
                      e.target.setCustomValidity(error);
                    }}
                  />
                  
                  {/* Real-time Inventory Availability & CPFR Signaling */}
                  {selectedSku && (
                    <div className="mt-3 space-y-3">
                      {/* CPFR Inventory Intelligence */}
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <SemanticBDIIcon semantic="inventory" size={14} className="text-blue-600" />
                            <span className="text-blue-800 font-medium text-sm">CPFR Inventory ({selectedSku.sku}):</span>
                          </div>
                          <div className="text-right">
                            <span className="text-blue-900 font-bold text-lg">
                              {getAvailableQuantity(selectedSku.id).toLocaleString()}
                            </span>
                            <span className="text-blue-700 text-sm ml-1">units available</span>
                          </div>
                        </div>
                        
                        {/* CPFR Inventory Breakdown */}
                        <div className="bg-white p-2 rounded border text-xs space-y-1">
                          {inventoryData?.availability?.[selectedSku.id]?.totalFromPOs > 0 && (
                            <div className="flex justify-between">
                              <span className="text-blue-600">📦 Total from POs:</span>
                              <span className="font-medium text-blue-600">{inventoryData.availability[selectedSku.id].totalFromPOs.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">📄 Total from Invoices:</span>
                            <span className="font-medium">{inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices?.toLocaleString() || '0'}</span>
                          </div>
                          {inventoryData?.availability?.[selectedSku.id]?.alreadyAllocated > 0 && (
                            <div className="flex justify-between">
                              <span className="text-orange-600">📊 Already in Forecasts:</span>
                              <span className="font-medium text-orange-600">-{inventoryData.availability[selectedSku.id].alreadyAllocated.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t pt-1">
                            <span className="text-green-600 font-medium">📦 Net Available:</span>
                            <span className="font-bold text-green-600">{getAvailableQuantity(selectedSku.id).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            From {inventoryData?.availability?.[selectedSku.id]?.sourcePOs > 0 
                              ? `${inventoryData.availability[selectedSku.id].sourcePOs} PO(s)` 
                              : `${inventoryData?.availability?.[selectedSku.id]?.sourceInvoices || 0} invoice(s)`}
                            {inventoryData?.availability?.[selectedSku.id]?.primarySource && (
                              <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                {inventoryData.availability[selectedSku.id].primarySource}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>



                      {/* Remaining Inventory After Forecast - Smart Color Logic */}
                      {forecastQuantity > 0 && getAvailableQuantity(selectedSku.id) > 0 && (
                        <div className={`p-3 rounded-md border transition-all duration-300 ${(() => {
                          const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                          const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                          
                          // Smart color logic based on remaining inventory
                          if (remaining < 2000) {
                            return 'bg-red-50 border-red-200'; // 🔴 Critical low stock
                          } else if (remaining < (totalFromInvoices * 0.5)) {
                            return 'bg-amber-50 border-amber-200'; // 🟡 Below 50% warning
                          } else {
                            return 'bg-emerald-50 border-emerald-200'; // 🟢 Healthy stock
                          }
                        })()}`}>
                          <div className="flex items-center justify-between text-sm">
                            <span className={`font-medium ${(() => {
                              const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                              const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                              
                              if (remaining < 2000) {
                                return 'text-red-700';
                              } else if (remaining < (totalFromInvoices * 0.5)) {
                                return 'text-amber-700';
                              } else {
                                return 'text-emerald-700';
                              }
                            })()}`}>
                              {(() => {
                                const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                                const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                                
                                // Add status icons and labels based on inventory level
                                if (remaining < 0) {
                                  return '🚨 OVERSOLD - Exceeds Available:';
                                } else if (remaining < 2000) {
                                  return '⚠️ CRITICAL LOW - Remaining after forecast:';
                                } else if (remaining < (totalFromInvoices * 0.5)) {
                                  return '⚡ LOW STOCK - Remaining after forecast:';
                                } else {
                                  return '✅ HEALTHY STOCK - Remaining after forecast:';
                                }
                              })()}
                            </span>
                            <span className={`font-bold text-lg px-2 py-1 rounded ${(() => {
                              const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                              const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                              
                              if (remaining < 0) {
                                return 'text-red-900 bg-red-200';
                              } else if (remaining < 2000) {
                                return 'text-red-800 bg-red-100';
                              } else if (remaining < (totalFromInvoices * 0.5)) {
                                return 'text-amber-800 bg-amber-100';
                              } else {
                                return 'text-emerald-800 bg-emerald-100';
                              }
                            })()}`}>
                              {Math.abs(getAvailableQuantity(selectedSku.id) - forecastQuantity).toLocaleString()} units
                            </span>
                          </div>
                          
                          {/* Stock Level Indicator Bar */}
                          <div className="mt-2">
                            <div className="flex items-center text-xs space-x-2">
                              <span className="text-gray-600">Stock Level:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${(() => {
                                    const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                                    const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                                    const percentage = totalFromInvoices > 0 ? (remaining / totalFromInvoices) * 100 : 0;
                                    
                                    if (remaining < 2000) {
                                      return 'bg-red-400';
                                    } else if (remaining < (totalFromInvoices * 0.5)) {
                                      return 'bg-amber-400';
                                    } else {
                                      return 'bg-emerald-400';
                                    }
                                  })()}`}
                                  style={{
                                    width: `${Math.min(100, Math.max(0, (() => {
                                      const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                                      const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                                      return totalFromInvoices > 0 ? (remaining / totalFromInvoices) * 100 : 0;
                                    })()))}%`
                                  }}
                                />
                              </div>
                              <span className="text-gray-600 min-w-[3rem] text-right">
                                {(() => {
                                  const totalFromInvoices = inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices || 0;
                                  const remaining = getAvailableQuantity(selectedSku.id) - forecastQuantity;
                                  const percentage = totalFromInvoices > 0 ? (remaining / totalFromInvoices) * 100 : 0;
                                  return `${Math.round(percentage)}%`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* SKU Requirements & Stock Status */}
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="space-y-2">
                          {(selectedSku as any)?.boxesPerCarton && (
                            <div className="text-xs text-blue-600">
                              💡 Must be multiple of {(selectedSku as any).boxesPerCarton} units (full cartons only)
                            </div>
                          )}
                          
                          {/* Enhanced MOQ with Stock Status */}
                          <div className="bg-white p-2 rounded border">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-600">MOQ & Stock Status:</span>
                              <div className="text-right">
                                <div className="text-xs font-medium text-green-600">
                                  📊 MOQ: {((selectedSku as any).moq || 1).toLocaleString()} units
                                </div>
                                <div className="text-xs font-medium text-blue-600">
                                  📦 Stock Available: {getAvailableQuantity(selectedSku.id).toLocaleString()} units
                                </div>
                                {inventoryData?.availability?.[selectedSku.id]?.alreadyAllocated > 0 && (
                                  <div className="text-xs text-orange-600">
                                    ⚠️ Reserved: {inventoryData.availability[selectedSku.id].alreadyAllocated.toLocaleString()} units
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {quantityError ? (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      ❌ {quantityError}
                      {quantityError.includes('Below MOQ') && (
                        <div className="mt-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={moqOverride}
                              onChange={(e) => {
                                setMoqOverride(e.target.checked);
                                if (e.target.checked) {
                                  setQuantityError('');
                                  const quantityInput = document.getElementById('quantity') as HTMLInputElement;
                                  if (quantityInput) quantityInput.setCustomValidity('');
                                }
                              }}
                              className="w-4 h-4 text-red-600"
                            />
                            <span className="text-red-700 font-medium">Override MOQ (special order)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : null}
                  
                  {/* Shipping Mode - Moved Below Delivery Week */}
                  <div className="mt-8">
                    <Label htmlFor="shippingPreference">Shipping Mode *</Label>
                    <select
                      id="shippingPreference"
                      name="shippingPreference"
                      required
                      value={selectedShipping}
                      onChange={(e) => setSelectedShipping(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="">Select Shipping Mode</option>
                      <optgroup label="📦 Indirect Shipment">
                        <option value="INDIRECT">Indirect - EXW = Delivery Week (customer arranges pickup)</option>
                      </optgroup>
                      <optgroup label="⚡ Immediate/Express (Zero Lag)">
                        <option value="ZERO_LAG_SAME_DAY">Zero Lag - Same Day (cross docking, special shipments)</option>
                        <option value="ZERO_LAG_NEXT_DAY">Zero Lag - Next Day (express fulfillment)</option>
                        <option value="ZERO_LAG_CUSTOM">Zero Lag - Custom Date (any lead time 1+ days)</option>
                      </optgroup>
                      <optgroup label="✈️ Air Freight (Fast, Higher Cost)">
                        <option value="AIR_7_DAYS">Air Express - 7 days door-to-door (urgent orders)</option>
                        <option value="AIR_14_DAYS">Air Standard - 14 days door-to-door (standard air)</option>
                        <option value="AIR_NLD">Air to Netherlands (NLD) - 14 days door-to-door</option>
                        <option value="AIR_AUT">Air to Austria (AUT) - 14 days door-to-door</option>
                      </optgroup>
                      <optgroup label="🚢 Ocean Freight (Bulk, Cost Efficient)">
                        <option value="SEA_ASIA_US_WEST">Sea Asia→US West - 45 days door-to-door (bulk)</option>
                        <option value="SEA_ASIA_US_EAST">Sea Asia→US East - 52 days door-to-door (bulk)</option>
                        <option value="SEA_WEST_EXPEDITED">Sea West Expedited - 35 days door-to-door (faster bulk)</option>
                        <option value="SEA_ASIA_NLD">Sea Asia→Netherlands (NLD) - 45 days door-to-door</option>
                        <option value="SEA_ASIA_AUT">Sea Asia→Austria (AUT) - 45 days door-to-door</option>
                      </optgroup>
                      <optgroup label="🚛 Ground Transport">
                        <option value="TRUCK_EXPRESS">Truck Express - 1-2 weeks (regional)</option>
                        <option value="TRUCK_STANDARD">Truck Standard - 2-4 weeks (domestic)</option>
                        <option value="RAIL">Rail Freight - 3-5 weeks (cost efficient)</option>
                      </optgroup>
                    </select>
                    <div className="mt-1 text-xs text-blue-600">
                      💡 Air ≈ 5-10× sea cost but faster. Sea = bulk/planned orders.
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-1 gap-12 mt-10">
                
                <div>
                  <Label htmlFor="salesForecastStatus">Sales Forecast Status</Label>
                  <select
                    id="salesForecastStatus"
                    name="salesForecastStatus"
                    value={salesForecastStatus}
                    onChange={(e) => setSalesForecastStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  >
                    <option value="draft">📝 Draft - Not submitted</option>
                    <option value="submitted">📤 Submitted - Awaiting ODM response</option>
                    <option value="confirmed">✅ Confirmed - ODM confirmed forecast</option>
                    <option value="rejected">❌ Rejected - ODM declined forecast</option>
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    Sales team forecast submission status
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <textarea
                  id="notes"
                  name="notes"
                  placeholder="Market conditions, customer feedback, special requirements, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                            setSelectedSku(null);
        setMoqOverride(false);
        setQuantityError('');
        setSelectedShipping('');
        setForecastQuantity(0);
        setSalesForecastStatus('draft');
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || !selectedSku || !!quantityError}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="forecasts" size={16} className="mr-2 brightness-0 invert" />
                      Create Forecast
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Detailed CPFR Signals Modal */}
      {showDetailModal && (
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="w-[90vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="analytics" size={20} className="mr-2" />
                <span>{tcpfr('modal.title', 'CPFR Supply Chain Signals')} - {tcpfr('modal.weekPrefix', 'Week')} {selectedWeekForDetail}</span>
                {/* Week Status Dot */}
                {(() => {
                  const weekForecasts = forecastsArray.filter(f => f.deliveryWeek === selectedWeekForDetail);
                  if (weekForecasts.length === 0) return null;
                  
                  // Calculate overall week status based on all forecasts
                  let hasRejected = false;
                  let hasIncomplete = false;
                  let allAccepted = true;
                  let allInProcess = true;
                  
                  weekForecasts.forEach(forecast => {
                    const sales = forecast.salesSignal || 'unknown';
                    const factory = forecast.factorySignal || 'unknown';
                    const shipping = forecast.shippingSignal || 'unknown';
                    
                    if (sales === 'rejected' || factory === 'rejected' || shipping === 'rejected') {
                      hasRejected = true;
                    }
                    if (sales === 'submitted' && (factory === 'unknown' || shipping === 'unknown')) {
                      hasIncomplete = true;
                    }
                    if (!(sales === 'confirmed' && factory === 'confirmed' && shipping === 'confirmed')) {
                      allAccepted = false;
                    }
                    if (!(
                      sales === 'submitted' && 
                      factory === 'reviewing' && 
                      shipping === 'submitted'
                    )) {
                      allInProcess = false;
                    }
                  });
                  
                  let dotColor = 'bg-gray-400'; // Default
                  if (hasRejected || hasIncomplete) {
                    dotColor = 'bg-red-400'; // Red for rejected or incomplete
                  } else if (allAccepted) {
                    dotColor = 'bg-green-400'; // Green for all confirmed
                  } else if (allInProcess) {
                    dotColor = 'bg-yellow-400'; // Yellow for all in process
                  }
                  
                  return (
                    <div className={`ml-3 w-3 h-3 ${dotColor} rounded-full shadow-sm border border-white`} 
                         title="Week CPFR Status"></div>
                  );
                })()}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 p-6">
              {/* Week Summary */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-2">{tcpfr('modal.weekSummary', 'Week Summary')}</h3>
                <div className="text-sm text-blue-700">
                  {forecastsArray.filter(f => f.deliveryWeek === selectedWeekForDetail).length} {tcpfr('modal.forecastsForDelivery', 'forecasts for delivery week')} {selectedWeekForDetail}
                </div>
              </div>

              {/* Detailed Forecast List with Full CPFR Signals */}
              <div className="space-y-4">
                {forecastsArray
                  .filter(f => f.deliveryWeek === selectedWeekForDetail)
                  .map(forecast => (
                    <div key={forecast.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-mono font-bold text-lg">{forecast.sku.sku}</h4>
                          <p className="text-gray-600">{forecast.sku.name}</p>
                          {editingForecast === forecast.id ? (
                            <div className="flex items-center space-x-2 mt-2">
                              <Input
                                type="number"
                                value={editFormData.quantity || forecast.quantity}
                                onChange={(e) => setEditFormData({...editFormData, quantity: parseInt(e.target.value)})}
                                className="w-32 text-sm"
                                min="1"
                              />
                              <span className="text-sm">units</span>
                            </div>
                          ) : (
                            <p className="text-sm font-medium">{forecast.quantity.toLocaleString()} units</p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {editingForecast === forecast.id ? (
                            <>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  // Save changes
                                  try {
                                    const response = await fetch(`/api/cpfr/forecasts`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        forecastId: forecast.id,
                                        ...editFormData
                                      })
                                    });
                                    if (response.ok) {
                                      mutateForecasts();
                                      setEditingForecast(null);
                                      setEditFormData({});
                                      alert('Forecast updated successfully!');
                                    }
                                  } catch (error) {
                                    alert('Failed to update forecast');
                                  }
                                }}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                💾 {tc('saveButton', 'Save')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingForecast(null);
                                  setEditFormData({});
                                }}
                              >
                                {tc('cancelButton', 'Cancel')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingForecast(forecast.id);
                                  setEditFormData({
                                    quantity: forecast.quantity,
                                    salesSignal: forecast.salesSignal || 'unknown',
                                    factorySignal: forecast.factorySignal || 'unknown',
                                    shippingSignal: forecast.shippingSignal || 'unknown',
                                    notes: forecast.notes || ''
                                  });
                                }}
                              >
                                ✏️ {tc('editButton', 'Edit')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  // Enhanced confirmation message
                                  const confirmMessage = `Delete forecast for ${forecast.sku.sku} (${forecast.quantity.toLocaleString()} units)?\n\n⚠️ WARNING: This will also delete:\n• Any related shipments and their documents\n• Any related production files\n• All associated data\n\nThis action cannot be undone.`;
                                  
                                  if (confirm(confirmMessage)) {
                                    try {
                                      const response = await fetch(`/api/cpfr/forecasts`, {
                                        method: 'DELETE',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ forecastId: forecast.id })
                                      });
                                      
                                      if (response.ok) {
                                        const result = await response.json();
                                        mutateForecasts();
                                        
                                        // Show enhanced success message
                                        alert(`✅ ${result.message}${result.deletedShipments > 0 ? `\n\n📦 Also deleted ${result.deletedShipments} related shipment${result.deletedShipments === 1 ? '' : 's'} and their documents.` : ''}`);
                                        
                                        // Close modal if no more forecasts for this week
                                        const remainingForecasts = forecastsArray.filter(f => 
                                          f.deliveryWeek === selectedWeekForDetail && f.id !== forecast.id
                                        );
                                        if (remainingForecasts.length === 0) {
                                          setShowDetailModal(false);
                                        }
                                      } else {
                                        const errorData = await response.json();
                                        
                                        // Show specific error message for foreign key constraints
                                        if (errorData.code === 'FOREIGN_KEY_CONSTRAINT') {
                                          alert(`⚠️ Cannot Delete Forecast\n\n${errorData.error}\n\nThis forecast may be referenced in:\n• Production Files\n• Other system data\n\nPlease remove all references first, then try deleting again.`);
                                        } else {
                                          alert(`Failed to delete forecast: ${errorData.error || 'Unknown error'}`);
                                        }
                                      }
                                    } catch (error) {
                                      console.error('Error deleting forecast:', error);
                                      alert('Failed to delete forecast');
                                    }
                                  }
                                }}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                🗑️ {tc('deleteButton', 'Delete')}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Three Signal Types - Responsive Layout */}
                      <div className="grid grid-cols-3 gap-2 md:gap-4">
                        {/* Sales */}
                        <div className="bg-blue-50 p-3 rounded border border-blue-200 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <span className="text-lg">📊</span>
                            <span className="text-sm font-medium text-blue-800">{tcpfr('milestones.sales', 'Sales')}</span>
                          </div>
                          {editingForecast === forecast.id ? (
                            <select
                              value={editFormData.salesSignal || 'unknown'}
                              onChange={(e) => setEditFormData({...editFormData, salesSignal: e.target.value})}
                              className="w-full px-2 py-1 text-xs border rounded"
                            >
                              <option value="unknown">❓ {tcpfr('signals.unknown', 'Unknown')}</option>
                              <option value="submitted">⏳ {tcpfr('signals.submitted', 'Submitted')}</option>
                              <option value="confirmed">✅ {tcpfr('signals.accepted', 'Accepted')}</option>
                              <option value="rejected">❌ {tcpfr('signals.rejected', 'Rejected')}</option>
                            </select>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <span className={`text-lg ${getSignalColor(forecast.salesSignal || 'unknown')}`}>
                                {getSignalIcon(forecast.salesSignal || 'unknown')}
                              </span>
                              <span className="text-sm text-blue-700">{forecast.salesSignal || 'Unknown'}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Factory */}
                        <div className="bg-orange-50 p-3 rounded border border-orange-200 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <span className="text-lg">🏭</span>
                            <span className="text-sm font-medium text-orange-800">{tcpfr('milestones.factory', 'Factory')}</span>
                          </div>
                          {editingForecast === forecast.id ? (
                            <select
                              value={editFormData.factorySignal || 'unknown'}
                              onChange={(e) => setEditFormData({...editFormData, factorySignal: e.target.value})}
                              className="w-full px-2 py-1 text-xs border rounded"
                            >
                              <option value="unknown">❓ {tcpfr('signals.unknown', 'Unknown')}</option>
                              <option value="reviewing">⏳ {tcpfr('signals.reviewing', 'Reviewing')}</option>
                              <option value="confirmed">✅ {tcpfr('signals.accepted', 'Accepted')}</option>
                              <option value="rejected">❌ {tcpfr('signals.rejected', 'Rejected')}</option>
                            </select>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <span className={`text-lg ${getSignalColor(forecast.factorySignal || 'unknown')}`}>
                                {getSignalIcon(forecast.factorySignal || 'unknown')}
                              </span>
                              <span className="text-sm text-orange-700">{forecast.factorySignal || 'Unknown'}</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Shipping */}
                        <div className="bg-green-50 p-3 rounded border border-green-200 text-center">
                          <div className="flex items-center justify-center space-x-2 mb-2">
                            <span className="text-lg">🚢</span>
                            <span className="text-sm font-medium text-green-800">{tcpfr('milestones.shipping', 'Shipping')}</span>
                          </div>
                          {editingForecast === forecast.id ? (
                            <select
                              value={editFormData.shippingSignal || 'unknown'}
                              onChange={(e) => setEditFormData({...editFormData, shippingSignal: e.target.value})}
                              className="w-full px-2 py-1 text-xs border rounded"
                            >
                              <option value="unknown">❓ {tcpfr('signals.unknown', 'Unknown')}</option>
                              <option value="reviewing">⏳ {tcpfr('signals.reviewing', 'Reviewing')}</option>
                              <option value="confirmed">✅ {tcpfr('signals.accepted', 'Accepted')}</option>
                              <option value="rejected">❌ {tcpfr('signals.rejected', 'Rejected')}</option>
                            </select>
                          ) : (
                            <div className="flex items-center justify-center space-x-2">
                              <span className={`text-lg ${getSignalColor(forecast.shippingSignal || 'unknown')}`}>
                                {getSignalIcon(forecast.shippingSignal || 'unknown')}
                              </span>
                              <span className="text-sm text-green-700">{forecast.shippingSignal || 'Unknown'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Status History & Notes Display */}
                      {forecast.notes && (
                        <div className="mt-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                            <SemanticBDIIcon semantic="notes" size={16} className="mr-2 text-blue-600" />
                            Status History & Notes
                          </h4>
                          <div className="bg-white p-3 rounded border">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                              {forecast.notes}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              
              {/* Close Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowDetailModal(false)}
                >
                  {tcpfr('modal.closeButton', 'Close')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Email Action Items Modal */}
      {showEmailModal && timelineResults && analysisForecast && (
        <Dialog open={showEmailModal} onOpenChange={setShowEmailModal}>
          <DialogContent className="w-[98vw] h-[95vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center text-xl">
                <SemanticBDIIcon semantic="email" size={24} className="mr-3 text-blue-600" />
                Send CPFR Action Items - {analysisForecast.sku?.sku}
              </DialogTitle>
              <p className="text-gray-600 mt-2">
                Email work-backwards timeline analysis and action items to stakeholders
              </p>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              {/* Email Recipients */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="emailRecipients">Primary Recipients (Pre-populated)</Label>
                  <Input
                    id="emailRecipients"
                    value={emailData.recipients}
                    onChange={(e) => setEmailData({...emailData, recipients: e.target.value})}
                    placeholder="Primary email addresses"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Dariush & Steve - key CPFR stakeholders</p>
                </div>
                
                <div>
                  <Label htmlFor="additionalEmails">Additional Recipients (Optional)</Label>
                  <Input
                    id="additionalEmails"
                    value={emailData.additionalEmails}
                    onChange={(e) => setEmailData({...emailData, additionalEmails: e.target.value})}
                    placeholder="additional@email.com, another@email.com"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Add sales team, factory contacts, or other stakeholders</p>
                </div>
              </div>

              {/* Email Subject */}
              <div>
                <Label htmlFor="emailSubject">Email Subject</Label>
                <Input
                  id="emailSubject"
                  value={emailData.subject}
                  onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                  className="mt-1"
                />
              </div>

              {/* Email Content Options */}
              <div>
                <Label className="text-base font-medium">Include in Email:</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeTimeline"
                      checked={emailData.includeTimeline}
                      onChange={(e) => setEmailData({...emailData, includeTimeline: e.target.checked})}
                      className="rounded"
                    />
                    <Label htmlFor="includeTimeline" className="text-sm">Work-backwards timeline with dates</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeRiskAssessment"
                      checked={emailData.includeRiskAssessment}
                      onChange={(e) => setEmailData({...emailData, includeRiskAssessment: e.target.checked})}
                      className="rounded"
                    />
                    <Label htmlFor="includeRiskAssessment" className="text-sm">Risk assessment and feasibility analysis</Label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="includeActionItems"
                      checked={emailData.includeActionItems}
                      onChange={(e) => setEmailData({...emailData, includeActionItems: e.target.checked})}
                      className="rounded"
                    />
                    <Label htmlFor="includeActionItems" className="text-sm">Specific action items and deadlines</Label>
                  </div>
                </div>
              </div>

              {/* Email Preview */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <h4 className="font-medium text-gray-800 mb-2">📧 Email Preview:</h4>
                <div className="text-sm space-y-2">
                  <div><strong>To:</strong> {emailData.additionalEmails ? `${emailData.recipients}, ${emailData.additionalEmails}` : emailData.recipients}</div>
                  <div><strong>Subject:</strong> {emailData.subject}</div>
                  <div className="mt-3">
                    <strong>Key Points:</strong>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
                      <li>SKU: {analysisForecast.sku?.sku} ({analysisForecast.quantity.toLocaleString()} units)</li>
                      <li>Delivery Target: {timelineResults.deliveryDate.toLocaleDateString()}</li>
                      <li>Factory Signal Due: <span className={timelineResults.factorySignalDate < new Date() ? 'text-red-600 font-bold' : 'text-orange-600 font-bold'}>
                        {timelineResults.factorySignalDate.toLocaleDateString()}
                        {timelineResults.factorySignalDate < new Date() && ' (OVERDUE)'}
                      </span></li>
                      <li>Risk Level: <span className={`font-bold ${
                        timelineResults.riskLevel === 'HIGH' ? 'text-red-600' :
                        timelineResults.riskLevel === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                      }`}>{timelineResults.riskLevel}</span></li>
                      <li>Shipping Method: {analysisData.shippingMethod === 'custom' ? `Custom (${analysisData.customShippingDays} days)` : analysisData.shippingMethod.replace(/_/g, ' ')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0 pt-4 border-t">
              <div className="text-sm text-gray-600">
                <span className="font-medium">CPFR Action Items</span> - Critical timeline communication
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={sendActionItemsEmail}
                  disabled={!emailData.subject.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 flex-1 sm:flex-none"
                >
                  <SemanticBDIIcon semantic="send" size={16} className="mr-2" />
                  Send Action Items
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Forecast Modal */}
      {showEditModal && selectedForecast && (
        <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                Edit Forecast - {selectedForecast.sku?.sku}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              
              try {
                const response = await fetch(`/api/cpfr/forecasts`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    forecastId: selectedForecast.id,
                    quantity: editForecastData.quantity,
                    deliveryWeek: editForecastData.deliveryWeek,
                    shippingPreference: editForecastData.shippingPreference,
                    salesSignal: editForecastData.salesSignal,
                    factorySignal: editForecastData.factorySignal,
                    transitSignal: editForecastData.transitSignal,
                    warehouseSignal: editForecastData.warehouseSignal,
                    notes: editForecastData.notes
                  })
                });

                if (response.ok) {
                  alert('✅ Forecast updated successfully!');
                  mutateForecasts();
                  setShowEditModal(false);
                  setSelectedForecast(null);
                } else {
                  const errorData = await response.json();
                  alert(`❌ Update failed: ${errorData.error || 'Unknown error'}`);
                }
              } catch (error) {
                console.error('Error updating forecast:', error);
                alert('❌ Error updating forecast. Please try again.');
              } finally {
                setIsLoading(false);
              }
            }} className="space-y-6 p-4">

              {/* Forecast Overview */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3">Forecast Overview</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">SKU:</span>
                    <p className="font-mono font-medium">{selectedForecast.sku?.sku}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Product:</span>
                    <p className="font-medium">{selectedForecast.sku?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Created:</span>
                    <p className="font-medium">{new Date(selectedForecast.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Editable Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="editQuantity">Quantity *</Label>
                  <Input
                    id="editQuantity"
                    type="number"
                    value={editForecastData.quantity || ''}
                    onChange={(e) => setEditForecastData({
                      ...editForecastData,
                      quantity: parseInt(e.target.value) || 0
                    })}
                    min="1"
                    required
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="editDeliveryWeek">Delivery Week *</Label>
                  <Input
                    id="editDeliveryWeek"
                    value={editForecastData.deliveryWeek || ''}
                    onChange={(e) => setEditForecastData({
                      ...editForecastData,
                      deliveryWeek: e.target.value
                    })}
                    placeholder="e.g., 2026-W30"
                    required
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="editShippingPreference">Shipping Method *</Label>
                  <select
                    id="editShippingPreference"
                    value={editForecastData.shippingPreference || ''}
                    onChange={(e) => setEditForecastData({
                      ...editForecastData,
                      shippingPreference: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    required
                  >
                    <option value="">Select Shipping Mode</option>
                    <optgroup label="📦 Indirect Shipment">
                      <option value="INDIRECT">Indirect - EXW = Delivery Week (customer arranges pickup)</option>
                    </optgroup>
                    <optgroup label="⚡ Immediate/Express (Zero Lag)">
                      <option value="ZERO_LAG_SAME_DAY">Zero Lag - Same Day (cross docking, special shipments)</option>
                      <option value="ZERO_LAG_NEXT_DAY">Zero Lag - Next Day (express fulfillment)</option>
                      <option value="ZERO_LAG_CUSTOM">Zero Lag - Custom Date (any lead time 1+ days)</option>
                    </optgroup>
                    <optgroup label="✈️ Air Freight (Fast, Higher Cost)">
                      <option value="AIR_7_DAYS">Air Express - 7 days door-to-door (urgent orders)</option>
                      <option value="AIR_14_DAYS">Air Standard - 14 days door-to-door (standard air)</option>
                      <option value="AIR_NLD">Air to Netherlands (NLD) - 14 days door-to-door</option>
                      <option value="AIR_AUT">Air to Austria (AUT) - 14 days door-to-door</option>
                    </optgroup>
                    <optgroup label="🚢 Ocean Freight (Bulk, Cost Efficient)">
                      <option value="SEA_ASIA_US_WEST">Sea Asia→US West - 45 days door-to-door (bulk)</option>
                      <option value="SEA_ASIA_US_EAST">Sea Asia→US East - 52 days door-to-door (bulk)</option>
                      <option value="SEA_WEST_EXPEDITED">Sea West Expedited - 35 days door-to-door (faster bulk)</option>
                      <option value="SEA_ASIA_NLD">Sea Asia→Netherlands (NLD) - 45 days door-to-door</option>
                      <option value="SEA_ASIA_AUT">Sea Asia→Austria (AUT) - 45 days door-to-door</option>
                    </optgroup>
                    <optgroup label="🚛 Ground Transport">
                      <option value="TRUCK_EXPRESS">Truck Express - 1-2 weeks (regional)</option>
                      <option value="TRUCK_STANDARD">Truck Standard - 2-4 weeks (domestic)</option>
                      <option value="RAIL">Rail Freight - 3-5 weeks (cost efficient)</option>
                    </optgroup>
                  </select>
                </div>
                
              </div>

              {/* CPFR Signals */}
              <div className="space-y-4">
                <Label className="text-lg font-medium text-gray-900">CPFR Signals</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="editSalesSignal">Sales Signal</Label>
                    <select
                      id="editSalesSignal"
                      value={editForecastData.salesSignal || 'unknown'}
                      onChange={(e) => setEditForecastData({
                        ...editForecastData,
                        salesSignal: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="draft">Draft</option>
                      <option value="submitted">Submitted</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="editFactorySignal">Factory Signal</Label>
                    <select
                      id="editFactorySignal"
                      value={editForecastData.factorySignal || 'unknown'}
                      onChange={(e) => setEditForecastData({
                        ...editForecastData,
                        factorySignal: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="pending">Pending</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="editTransitSignal">Transit Signal</Label>
                    <select
                      id="editTransitSignal"
                      value={editForecastData.transitSignal || 'unknown'}
                      onChange={(e) => setEditForecastData({
                        ...editForecastData,
                        transitSignal: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  
                  <div>
                    <Label htmlFor="editWarehouseSignal">Warehouse Signal</Label>
                    <select
                      id="editWarehouseSignal"
                      value={editForecastData.warehouseSignal || 'unknown'}
                      onChange={(e) => setEditForecastData({
                        ...editForecastData,
                        warehouseSignal: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="pending">Pending</option>
                      <option value="submitted">Submitted</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <textarea
                  id="editNotes"
                  value={editForecastData.notes || ''}
                  onChange={(e) => setEditForecastData({
                    ...editForecastData,
                    notes: e.target.value
                  })}
                  placeholder="Additional notes or comments..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  rows={4}
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedForecast(null);
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="check" size={16} className="mr-2" />
                      Update Forecast
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Scenario Analysis Modal - CPFR Leader Tool */}
      {showAnalysisModal && analysisForecast && (
        <Dialog open={showAnalysisModal} onOpenChange={setShowAnalysisModal}>
          <DialogContent className="w-[100vw] h-[100vh] sm:w-[98vw] sm:h-[95vh] p-0" style={{ maxWidth: 'none' }}>
            <DialogHeader className="p-4 sm:p-6 border-b">
              <DialogTitle className="flex items-center text-xl sm:text-2xl">
                <SemanticBDIIcon semantic="analytics" size={24} className="mr-3 text-purple-600" />
                CPFR Scenario Analysis - {analysisForecast.sku?.sku}
              </DialogTitle>
              <p className="text-gray-600 mt-2">
                Analyze real-world timeline impact vs optimistic sales forecasts
              </p>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8">
              {/* Current Forecast Overview */}
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <h3 className="font-semibold text-yellow-900 mb-3">⚠️ Sales Forecast (Current)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">SKU:</span>
                    <p className="font-mono font-medium">{analysisForecast.sku?.sku}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Quantity:</span>
                    <p className="font-medium">{analysisForecast.quantity.toLocaleString()} units</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Delivery Week:</span>
                    <p className="font-medium">{analysisForecast.deliveryWeek}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Current Shipping:</span>
                    <p className="font-medium text-yellow-700">
                      {analysisForecast.shippingPreference || 'Not specified'}
                    </p>
                  </div>
                </div>
                {analysisForecast.shippingPreference?.includes('ZERO_LAG') && (
                  <div className="mt-3 p-3 bg-yellow-100 rounded border border-yellow-300">
                    <p className="text-yellow-800 text-sm font-medium">
                      ⚠️ Warning: Zero Lag shipping is unrealistic for CPFR planning
                    </p>
                  </div>
                )}
              </div>

              {/* Scenario Analysis Controls */}
              <div className="bg-blue-50 p-4 sm:p-6 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-3 text-lg">🔬 Real-World Scenario Analysis</h3>
                <p className="text-blue-700 text-sm sm:text-base mb-4 sm:mb-6">
                  Analyze the impact of realistic shipping methods and lead times on your CPFR timeline
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                  <div>
                    <Label htmlFor="analysisShippingMethod">Realistic Shipping Method *</Label>
                    <select
                      id="analysisShippingMethod"
                      value={analysisData.shippingMethod}
                      onChange={(e) => setAnalysisData({
                        ...analysisData,
                        shippingMethod: e.target.value,
                        customShippingDays: e.target.value === 'custom' ? analysisData.customShippingDays : ''
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="">Select Realistic Method</option>
                      <option value="SEA_ASIA_US_WEST">Sea Asia to US West (21 days)</option>
                      <option value="SEA_STANDARD_WEST_COAST">Sea Standard West Coast (45 days)</option>
                      <option value="AIR_14_DAYS">Air Express (14 days)</option>
                      <option value="AIR_7_DAYS">Air Priority (7 days)</option>
                      <option value="SEA_STANDARD">Sea Standard (28 days)</option>
                      <option value="custom">Custom Transit Time...</option>
                    </select>
                    {analysisData.shippingMethod === 'custom' && (
                      <div className="mt-2">
                        <Label htmlFor="customShippingDays">Custom Transit Days</Label>
                        <Input
                          id="customShippingDays"
                          type="number"
                          value={analysisData.customShippingDays}
                          onChange={(e) => setAnalysisData({
                            ...analysisData,
                            customShippingDays: e.target.value
                          })}
                          placeholder="Enter days"
                          min="1"
                          max="90"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="analysisLeadTime">Factory Lead Time</Label>
                    <select
                      id="analysisLeadTime"
                      value={analysisData.leadTime}
                      onChange={(e) => setAnalysisData({
                        ...analysisData,
                        leadTime: e.target.value,
                        customLeadTimeDays: e.target.value === 'custom' ? analysisData.customLeadTimeDays : ''
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="auto">Use SKU Default</option>
                      <option value="30">30 days (Standard)</option>
                      <option value="45">45 days (Extended)</option>
                      <option value="60">60 days (Long Lead)</option>
                      <option value="custom">Custom Lead Time...</option>
                    </select>
                    {analysisData.leadTime === 'custom' && (
                      <div className="mt-2">
                        <Label htmlFor="customLeadTimeDays">Custom Lead Time (Days)</Label>
                        <Input
                          id="customLeadTimeDays"
                          type="number"
                          value={analysisData.customLeadTimeDays}
                          onChange={(e) => setAnalysisData({
                            ...analysisData,
                            customLeadTimeDays: e.target.value
                          })}
                          placeholder="Enter days"
                          min="1"
                          max="180"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="analysisBuffer">Safety Buffer</Label>
                    <select
                      id="analysisBuffer"
                      value={analysisData.safetyBuffer}
                      onChange={(e) => setAnalysisData({
                        ...analysisData,
                        safetyBuffer: e.target.value,
                        customBufferDays: e.target.value === 'custom' ? analysisData.customBufferDays : ''
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    >
                      <option value="5">5 days (Standard)</option>
                      <option value="7">7 days (Conservative)</option>
                      <option value="10">10 days (High Risk)</option>
                      <option value="14">14 days (Very Safe)</option>
                      <option value="custom">Custom Buffer...</option>
                    </select>
                    {analysisData.safetyBuffer === 'custom' && (
                      <div className="mt-2">
                        <Label htmlFor="customBufferDays">Custom Buffer (Days)</Label>
                        <Input
                          id="customBufferDays"
                          type="number"
                          value={analysisData.customBufferDays}
                          onChange={(e) => setAnalysisData({
                            ...analysisData,
                            customBufferDays: e.target.value
                          })}
                          placeholder="Enter days"
                          min="1"
                          max="30"
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4">
                  <Button 
                    type="button"
                    onClick={calculateRealisticTimeline}
                    disabled={!analysisData.shippingMethod}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400"
                  >
                    <SemanticBDIIcon semantic="analytics" size={16} className="mr-2" />
                    Calculate Real Timeline
                  </Button>
                </div>
              </div>

              {/* Work-Backwards Timeline Results */}
              <div className="bg-green-50 p-4 sm:p-6 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-900 mb-3 text-lg">📊 Work-Backwards Timeline Analysis</h3>
                
                {!showTimeline ? (
                  <>
                    <p className="text-green-700 text-sm sm:text-base">
                      Click "Calculate Real Timeline" to see the work-backwards analysis from your sales delivery date.
                    </p>
                    <div className="mt-3 text-xs sm:text-sm text-green-600">
                      Shows: Factory signal timing, Production start, Shipping timeline, Risk assessment
                    </div>
                    
                    <div className="mt-4 p-4 bg-white rounded border border-green-300">
                      <div className="text-center text-gray-500">
                        <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Timeline calculation results will appear here</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    {/* Risk Assessment Header */}
                    <div className={`p-3 rounded-lg border ${
                      timelineResults?.riskLevel === 'HIGH' ? 'bg-red-100 border-red-300' :
                      timelineResults?.riskLevel === 'MEDIUM' ? 'bg-yellow-100 border-yellow-300' :
                      'bg-green-100 border-green-300'
                    }`}>
                      <div className="flex items-center justify-between flex-wrap">
                        <div className="flex items-center">
                          <span className="text-lg mr-2">
                            {timelineResults?.riskLevel === 'HIGH' ? '🚨' :
                             timelineResults?.riskLevel === 'MEDIUM' ? '⚠️' : '✅'}
                          </span>
                          <span className={`font-semibold ${
                            timelineResults?.riskLevel === 'HIGH' ? 'text-red-800' :
                            timelineResults?.riskLevel === 'MEDIUM' ? 'text-yellow-800' :
                            'text-green-800'
                          }`}>
                            Risk Level: {timelineResults?.riskLevel}
                          </span>
                        </div>
                        <div className="text-sm mt-1 sm:mt-0">
                          <span className="font-medium">
                            {timelineResults?.daysUntilDelivery} days until delivery
                          </span>
                          <span className="text-gray-600 ml-2">
                            ({timelineResults?.totalDaysRequired} days required)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile-Optimized Timeline - Right to Left (Delivery → Factory) */}
                    <div className="bg-white p-4 rounded-lg border border-green-300">
                      <h4 className="font-semibold text-gray-800 mb-4 text-center">
                        🎯 Work-Backwards Timeline (From Sales Delivery Date)
                      </h4>
                      
                      {/* Timeline Steps - Mobile Optimized Vertical Layout */}
                      <div className="space-y-4">
                        {/* Step 5: Sales Delivery (Stake in Ground) */}
                        <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            🎯
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                              <div>
                                <h5 className="font-semibold text-blue-800">Sales Delivery Date (Target)</h5>
                                <p className="text-sm text-blue-600">Stake in the ground - customer commitment</p>
                              </div>
                              <div className="text-right mt-1 sm:mt-0">
                                <div className="font-mono text-lg font-bold text-blue-800">
                                  {timelineResults?.deliveryDate?.toLocaleDateString()}
                                </div>
                                <div className="text-xs text-blue-600">Week {analysisForecast?.deliveryWeek}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center">
                          <div className="text-gray-400 text-2xl">↑</div>
                        </div>

                        {/* Step 4: Warehouse Arrival */}
                        <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            🏪
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                              <div>
                                <h5 className="font-semibold text-green-800">Warehouse Arrival</h5>
                                <p className="text-sm text-green-600">
                                  Buffer: {timelineResults?.bufferDays} days before delivery
                                </p>
                              </div>
                              <div className="text-right mt-1 sm:mt-0">
                                <div className="font-mono text-lg font-bold text-green-800">
                                  {timelineResults?.warehouseArrival?.toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center">
                          <div className="text-gray-400 text-2xl">↑</div>
                        </div>

                        {/* Step 3: Shipping Start */}
                        <div className="flex items-start space-x-3 p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                          <div className="flex-shrink-0 w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            🚢
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                              <div>
                                <h5 className="font-semibold text-purple-800">Shipping Start</h5>
                                <p className="text-sm text-purple-600">
                                  Transit: {timelineResults?.shippingDays} days ({analysisData.shippingMethod === 'custom' ? 'Custom' : 
                                  analysisData.shippingMethod.replace(/_/g, ' ')})
                                </p>
                              </div>
                              <div className="text-right mt-1 sm:mt-0">
                                <div className="font-mono text-lg font-bold text-purple-800">
                                  {timelineResults?.shippingStart?.toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center">
                          <div className="text-gray-400 text-2xl">↑</div>
                        </div>

                        {/* Step 2: Production Start */}
                        <div className="flex items-start space-x-3 p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                          <div className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            🏭
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                              <div>
                                <h5 className="font-semibold text-orange-800">Production Start</h5>
                                <p className="text-sm text-orange-600">
                                  Lead Time: {timelineResults?.leadTimeDays} days
                                </p>
                              </div>
                              <div className="text-right mt-1 sm:mt-0">
                                <div className="font-mono text-lg font-bold text-orange-800">
                                  {timelineResults?.productionStart?.toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Arrow Down */}
                        <div className="flex justify-center">
                          <div className="text-gray-400 text-2xl">↑</div>
                        </div>

                        {/* Step 1: Factory Signal (Critical Action) */}
                        <div className={`flex items-start space-x-3 p-3 rounded-lg border-l-4 ${
                          timelineResults?.factorySignalDate < new Date() 
                            ? 'bg-red-50 border-red-500' 
                            : 'bg-yellow-50 border-yellow-500'
                        }`}>
                          <div className={`flex-shrink-0 w-8 h-8 text-white rounded-full flex items-center justify-center text-sm font-bold ${
                            timelineResults?.factorySignalDate < new Date() 
                              ? 'bg-red-500' 
                              : 'bg-yellow-500'
                          }`}>
                            📡
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
                              <div>
                                <h5 className={`font-semibold ${
                                  timelineResults?.factorySignalDate < new Date() 
                                    ? 'text-red-800' 
                                    : 'text-yellow-800'
                                }`}>
                                  Factory Signal Required
                                </h5>
                                <p className={`text-sm ${
                                  timelineResults?.factorySignalDate < new Date() 
                                    ? 'text-red-600' 
                                    : 'text-yellow-600'
                                }`}>
                                  {timelineResults?.factorySignalDate < new Date() 
                                    ? '🚨 OVERDUE - Signal should have been sent!' 
                                    : 'Signal factory to start production planning'}
                                </p>
                              </div>
                              <div className="text-right mt-1 sm:mt-0">
                                <div className={`font-mono text-lg font-bold ${
                                  timelineResults?.factorySignalDate < new Date() 
                                    ? 'text-red-800' 
                                    : 'text-yellow-800'
                                }`}>
                                  {timelineResults?.factorySignalDate?.toLocaleDateString()}
                                </div>
                                {timelineResults?.factorySignalDate < new Date() && (
                                  <div className="text-xs text-red-600 font-medium">PAST DUE</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Summary Box */}
                      <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                        <h5 className="font-semibold text-gray-800 mb-2">📋 CPFR Analysis Summary</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Total Timeline:</span>
                            <span className="font-medium ml-2">{timelineResults?.totalDaysRequired} days</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Days Available:</span>
                            <span className="font-medium ml-2">{timelineResults?.daysUntilDelivery} days</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Feasibility:</span>
                            <span className={`font-medium ml-2 ${
                              timelineResults?.isRealistic ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {timelineResults?.isRealistic ? 'ACHIEVABLE' : 'AT RISK'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Action Required:</span>
                            <span className="font-medium ml-2 text-purple-600">
                              {timelineResults?.factorySignalDate < new Date() ? 'IMMEDIATE SIGNAL' : 'SCHEDULE SIGNAL'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* Modal Actions - Fixed at bottom */}
            <div className="border-t p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center space-y-3 sm:space-y-0">
              <div className="text-sm text-gray-600">
                <span className="font-medium">CPFR Analysis Tool</span> - Compare optimistic vs realistic timelines
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => setShowAnalysisModal(false)}
                  className="flex-1 sm:flex-none"
                >
                  Close Analysis
                </Button>
                <Button 
                  onClick={prepareActionItemsEmail}
                  disabled={!showTimeline || !timelineResults}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 flex-1 sm:flex-none"
                >
                  <SemanticBDIIcon semantic="email" size={16} className="mr-2" />
                  Send Action Items
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function SalesForecastsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SalesForecastsContent />
    </Suspense>
  );
}


