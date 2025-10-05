'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';

interface ShipmentCautionIndicatorProps {
  date: string;
  showIcon?: boolean;
  showBadge?: boolean;
  showTooltip?: boolean;
  className?: string;
}

export function ShipmentCautionIndicator({ 
  date, 
  showIcon = true, 
  showBadge = false, 
  showTooltip = true,
  className = '' 
}: ShipmentCautionIndicatorProps) {
  const [holidayInfo, setHolidayInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check holiday status when date changes
  useEffect(() => {
    if (!date) {
      setHolidayInfo(null);
      return;
    }

    const checkHolidayStatus = async () => {
      setIsLoading(true);
      try {
        console.log(`🔍 Checking holiday status for date: ${date}`);
        const response = await fetch(`/api/holidays/chinese/periods?date=${date}`);
        if (response.ok) {
          const data = await response.json();
          console.log(`📅 Holiday API response for ${date}:`, data);
          if (data.success && data.shipmentCaution) {
            const cautionInfo = {
              isCaution: data.shipmentCaution.isCaution,
              type: data.shipmentCaution.type,
              reason: data.shipmentCaution.reason,
              holidayName: data.shipmentCaution.holidayName
            };
            console.log(`⚠️ Setting holiday info for ${date}:`, cautionInfo);
            setHolidayInfo(cautionInfo);
          } else {
            console.log(`✅ No holiday caution for ${date}`);
            setHolidayInfo(null);
          }
        }
      } catch (error) {
        console.error('Error checking holiday status:', error);
        setHolidayInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(checkHolidayStatus, 100);
    return () => clearTimeout(timeoutId);
  }, [date]);

  if (isLoading) {
    return showIcon ? <span className="text-xs text-gray-400">🔄</span> : null;
  }

  if (!holidayInfo?.isCaution) {
    return null;
  }

  const getIcon = () => {
    if (holidayInfo.type === 'holiday') {
      return '🚫';
    } else if (holidayInfo.type === 'soft-holiday') {
      return '⚠️';
    }
    return '⚠️';
  };

  const getBadgeColor = () => {
    if (holidayInfo.type === 'holiday') {
      return 'bg-red-100 text-red-800 border-red-200';
    } else if (holidayInfo.type === 'soft-holiday') {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  const getTooltipText = () => {
    if (holidayInfo.type === 'holiday') {
      return `No shipments during ${holidayInfo.holidayName}`;
    } else if (holidayInfo.type === 'soft-holiday') {
      return holidayInfo.reason || 'Caution: Near holiday period';
    }
    return 'Shipping caution advised';
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {showIcon && (
        <span 
          className="text-sm cursor-help" 
          title={showTooltip ? getTooltipText() : undefined}
        >
          {getIcon()}
        </span>
      )}
      
      {showBadge && (
        <Badge 
          className={`text-xs ${getBadgeColor()}`}
          title={showTooltip ? getTooltipText() : undefined}
        >
          {holidayInfo.type === 'holiday' ? 'Holiday' : 'Caution'}
        </Badge>
      )}
    </div>
  );
}

// Inline caution text component
// Hook for checking holiday status (reusable)
function useHolidayCheck(date: string) {
  const [holidayInfo, setHolidayInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!date) {
      setHolidayInfo(null);
      return;
    }

    const checkHolidayStatus = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/holidays/chinese/periods?date=${date}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.shipmentCaution) {
            setHolidayInfo({
              isCaution: data.shipmentCaution.isCaution,
              type: data.shipmentCaution.type,
              reason: data.shipmentCaution.reason,
              holidayName: data.shipmentCaution.holidayName
            });
          }
        }
      } catch (error) {
        console.error('Error checking holiday status:', error);
        setHolidayInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(checkHolidayStatus, 100);
    return () => clearTimeout(timeoutId);
  }, [date]);

  return { holidayInfo, isLoading };
}

export function ShipmentCautionText({ 
  date, 
  className = '' 
}: { 
  date: string; 
  className?: string; 
}) {
  const { holidayInfo, isLoading } = useHolidayCheck(date);

  if (isLoading || !holidayInfo?.isCaution) {
    return null;
  }

  const getTextColor = () => {
    if (holidayInfo.type === 'holiday') {
      return 'text-red-600';
    } else if (holidayInfo.type === 'soft-holiday') {
      return 'text-orange-600';
    }
    return 'text-yellow-600';
  };

  return (
    <div className={`text-xs font-medium ${getTextColor()} ${className}`}>
      {holidayInfo.reason}
    </div>
  );
}

// Timeline milestone caution wrapper
export function TimelineMilestoneWithCaution({ 
  date, 
  children, 
  className = '' 
}: { 
  date: string; 
  children: React.ReactNode; 
  className?: string; 
}) {
  const { holidayInfo } = useHolidayCheck(date);

  const getWrapperStyle = () => {
    if (!holidayInfo?.isCaution) return '';
    
    if (holidayInfo.type === 'holiday') {
      return 'border-l-4 border-red-500 bg-red-50 pl-3';
    } else if (holidayInfo.type === 'soft-holiday') {
      return 'border-l-4 border-orange-400 bg-orange-50 pl-3';
    }
    return '';
  };

  return (
    <div className={`${getWrapperStyle()} ${className}`}>
      <div className="flex items-center gap-2">
        {children}
        <ShipmentCautionIndicator date={date} showIcon={true} showBadge={false} />
      </div>
      <ShipmentCautionText date={date} className="mt-1" />
    </div>
  );
}
