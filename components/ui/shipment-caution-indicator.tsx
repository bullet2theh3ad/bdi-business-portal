'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useHolidayCheck } from './holiday-date-picker';

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
  const { holidayInfo, isLoading } = useHolidayCheck(date);

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
