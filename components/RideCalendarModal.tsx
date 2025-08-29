'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Clock,
  TrendingUp,
  Gauge,
  FileText
} from 'lucide-react';
import { RideData } from '@/hooks/useRideData';

type RideCalendarModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelectRide?: (ride: RideData) => void;
  riderId?: string;
  rides: RideData[];
  isLoading?: boolean;
  ridersData?: any; // Team riders data for user switching
  onRiderChange?: (riderId: string | null) => void; // Callback when user switches rider
};

// Utility functions for calendar calculations
const addMonths = (date: Date, months: number): Date => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const endOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const eachDayOfInterval = (start: Date, end: Date): Date[] => {
  const days = [];
  const current = new Date(start);
  
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return days;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.toDateString() === date2.toDateString();
};

const formatMonthYear = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RideCalendarModal({
  isOpen,
  onClose,
  onSelectRide,
  riderId,
  rides = [],
  isLoading = false,
  ridersData,
  onRiderChange
}: RideCalendarModalProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Create a map of rides by date for quick lookup
  const ridesByDate = useMemo(() => {
    const map = new Map<string, RideData[]>();
    
    rides.forEach(ride => {
      const rideDate = new Date(ride.ride_start);
      const dateKey = rideDate.toDateString();
      
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(ride);
    });
    
    return map;
  }, [rides]);

  // Generate single month calendar data (current month only) - Always 6x7 grid (42 days)
  const currentMonthData = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    
    // Add padding days to start on Sunday
    const firstDayOfWeek = monthStart.getDay();
    const paddingStart = firstDayOfWeek > 0 ? 
      eachDayOfInterval(
        new Date(monthStart.getTime() - firstDayOfWeek * 24 * 60 * 60 * 1000),
        new Date(monthStart.getTime() - 24 * 60 * 60 * 1000)
      ) : [];
    
    // Get the actual month days
    const monthDays = eachDayOfInterval(monthStart, monthEnd);
    
    // Calculate current total
    const currentTotal = paddingStart.length + monthDays.length;
    
    // Always pad to exactly 42 days (6 rows × 7 columns)
    const targetTotal = 42;
    const additionalPaddingNeeded = targetTotal - currentTotal;
    
    const paddingEnd = additionalPaddingNeeded > 0 ? 
      eachDayOfInterval(
        new Date(monthEnd.getTime() + 24 * 60 * 60 * 1000),
        new Date(monthEnd.getTime() + additionalPaddingNeeded * 24 * 60 * 60 * 1000)
      ) : [];
    
    const allDays = [...paddingStart, ...monthDays, ...paddingEnd];
    
    // Ensure we have exactly 42 days
    const finalDays = allDays.slice(0, 42);
    
    return {
      month: monthStart,
      days: finalDays,
      isCurrentMonth: (day: Date) => day >= monthStart && day <= monthEnd
    };
  }, [currentMonth]);

  // Get rides for the selected day
  const selectedDayRides = useMemo(() => {
    if (!selectedDay) return [];
    return ridesByDate.get(selectedDay.toDateString()) || [];
  }, [selectedDay, ridesByDate]);



  const handleDayClick = useCallback((day: Date) => {
    setSelectedDay(day);
  }, []);

  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, -1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth(prev => addMonths(prev, 1));
  }, []);

  const handleRideSelect = useCallback((ride: RideData) => {
    onSelectRide?.(ride);
    onClose();
  }, [onSelectRide, onClose]);

  const getRideCountForDay = (day: Date): number => {
    return ridesByDate.get(day.toDateString())?.length || 0;
  };

  const getHeatMapIntensity = (count: number, isPastOrCurrent: boolean): string => {
    if (!isPastOrCurrent) return 'bg-transparent'; // Future dates have no background
    if (count === 0) return 'bg-gray-50'; // Soft gray for 0 rides
    if (count === 1) return 'bg-blue-200';
    if (count === 2) return 'bg-blue-300';
    if (count >= 3) return 'bg-blue-500';
    return 'bg-blue-100';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none max-h-[85vh] overflow-y-auto w-[95vw] h-[85vh]">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              My Rides Calendar
            </DialogTitle>
            
            {/* User Selection Dropdown - Same line on desktop, below on mobile, moved left to avoid X button */}
            {ridersData?.isOwner && ridersData?.riders?.length > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:mr-4">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  View Rides For:
                </label>
                <select
                  value={riderId || ''}
                  onChange={(e) => onRiderChange?.(e.target.value || null)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm min-w-[200px]"
                >
                  <option value="">🏢 All Team Members</option>
                  {ridersData.riders.map((rider: any) => (
                    <option key={rider.riderId} value={rider.riderId}>
                      👤 {rider.name} {rider.isCurrentUser ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Section - Takes up 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {formatMonthYear(currentMonth)}
              </h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Single Month Calendar Grid */}
            <div className="space-y-4">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-0.5 text-xs text-gray-500 font-medium">
                {WEEKDAY_NAMES.map(day => (
                  <div key={day} className="text-center p-1 w-16 h-6 flex items-center justify-center">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-0.5">
                {currentMonthData.days.map((day, dayIndex) => {
                  const isCurrentMonth = currentMonthData.isCurrentMonth(day);
                  const isSelected = selectedDay && isSameDay(selectedDay, day);
                  const rideCount = getRideCountForDay(day);
                  const hasRides = rideCount > 0;
                  const isPastOrCurrent = day <= new Date();
                  
                  return (
                    <button
                      key={dayIndex}
                      onClick={() => handleDayClick(day)}
                      className={`
                        w-16 h-16 text-sm rounded-md transition-all p-1 flex flex-col items-center justify-center
                        ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                        ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : getHeatMapIntensity(rideCount, isPastOrCurrent && isCurrentMonth)}
                        ${isCurrentMonth && !isSelected ? 'hover:bg-gray-100' : ''}
                        ${hasRides ? 'hover:scale-105 font-medium' : ''}
                      `}
                    >
                      <span className="text-sm">{day.getDate()}</span>
                      <div className="text-[10px] font-bold min-h-[12px] flex items-center">
                        {isCurrentMonth && day <= new Date() ? (
                          <span className={hasRides ? 'text-blue-700' : 'text-gray-400'}>
                            {rideCount}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rides List Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">
                {selectedDay ? (
                  <>Rides on {selectedDay.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</>
                ) : (
                  'Select a day'
                )}
              </h3>
              {selectedDay && (
                <p className="text-sm text-gray-600">
                  {selectedDayRides.length} ride{selectedDayRides.length !== 1 ? 's' : ''} found
                </p>
              )}
            </div>

            {isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {!isLoading && selectedDay && selectedDayRides.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-gray-500">No rides found for this day</p>
              </Card>
            )}

            {!selectedDay && (
              <Card className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">
                  Select a day from the calendar to view your rides
                </p>
              </Card>
            )}

            {/* Rides List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {selectedDayRides.map((ride) => {
                const rideStart = new Date(ride.ride_start);
                const duration = ride.ride_stop ? 
                  Math.round((new Date(ride.ride_stop).getTime() - rideStart.getTime()) / 1000 / 60) : 
                  null;

                return (
                  <Card 
                    key={ride.ride_id} 
                    className="p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="space-y-3">
                      {/* Ride Header */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">
                            {ride.user_defined_filename || `Ride ${ride.ride_id.substring(0, 18)}...`}
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="h-3 w-3" />
                            {rideStart.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                            {duration && <span>• {duration} min</span>}
                          </div>
                        </div>
                        <Badge 
                          variant={ride.risk_level === 'low' ? 'default' : 'destructive'}
                          className="text-xs hidden"
                        >
                          {ride.risk_level}
                        </Badge>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-3 w-3 text-blue-500" />
                          <span className="text-gray-600">Max Speed:</span>
                          <span className="font-medium">{ride.max_speed_kmh.toFixed(1)} km/h</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Gauge className="h-3 w-3 text-orange-500" />
                          <span className="text-gray-600">Max Lean:</span>
                          <span className="font-medium">{ride.max_lean_angle.toFixed(1)}°</span>
                        </div>
                      </div>

                      {/* Data Points Count */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Data Points:</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            ride.point_count > 1500 ? 'text-red-600' :
                            ride.point_count > 1000 ? 'text-orange-600' : 'text-gray-900'
                          }`}>
                            {ride.point_count?.toLocaleString() || 0}
                          </span>
                          {ride.point_count > 1000 && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${
                                ride.point_count > 1500 ? 'border-red-500 text-red-600' : 'border-orange-500 text-orange-600'
                              }`}
                            >
                              Large Dataset
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Safety Score */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Safety Score:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                ride.safety_score >= 80 ? 'bg-green-500' :
                                ride.safety_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${ride.safety_score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{ride.safety_score}</span>
                        </div>
                      </div>

                      {/* Load File Button */}
                      <div className="pt-2 border-t border-gray-100">
                        <Button
                          onClick={() => handleRideSelect(ride)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Load File
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Stats at Bottom */}
        {rides.length > 0 && (
          <div className="border-t pt-4 mt-6">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{rides.length}</div>
                <div className="text-xs text-gray-600">Total Rides</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(rides.reduce((sum, r) => sum + r.max_speed_kmh, 0) / rides.length)}
                </div>
                <div className="text-xs text-gray-600">Avg Speed (km/h)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(rides.reduce((sum, r) => sum + r.max_lean_angle, 0) / rides.length)}
                </div>
                <div className="text-xs text-gray-600">Avg Max Lean (°)</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(rides.reduce((sum, r) => sum + r.safety_score, 0) / rides.length)}
                </div>
                <div className="text-xs text-gray-600">Avg Safety</div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
