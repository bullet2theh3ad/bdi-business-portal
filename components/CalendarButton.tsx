'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import RideCalendarModal from '@/components/RideCalendarModal';
import { useRideCalendarData } from '@/hooks/useRideData';

type CalendarButtonProps = {
  selectedRiderId?: string | null;
  onRideSelect?: (rideId: string) => void;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
};

export default function CalendarButton({
  selectedRiderId,
  onRideSelect,
  className = "bg-gray-800 border-purple-600 text-purple-400 hover:bg-purple-900 text-xs lg:text-sm px-2 lg:px-4",
  variant = "outline"
}: CalendarButtonProps) {
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  
  // Fetch ride data for calendar modal
  const { rides: calendarRides, isLoading: calendarLoading } = useRideCalendarData(selectedRiderId || undefined);
  
  const handleRideSelect = (ride: any) => {
    onRideSelect?.(ride.ride_id);
    setShowCalendarModal(false);
  };
  
  return (
    <>
      <Button
        onClick={() => setShowCalendarModal(true)}
        variant={variant}
        className={className}
        title="Calendar View"
      >
        <Calendar className="h-4 w-4" />
        <span className="hidden lg:inline ml-2">Calendar</span>
      </Button>
      
      {/* Ride Calendar Modal */}
      <RideCalendarModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        onSelectRide={handleRideSelect}
        riderId={selectedRiderId || undefined}
        rides={calendarRides}
        isLoading={calendarLoading}
      />
    </>
  );
}
