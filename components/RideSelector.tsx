'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, FileText } from 'lucide-react';
import LoadFileModal from './LoadFileModal';
import RideCalendarModal from './RideCalendarModal';
import { RideData } from '@/hooks/useRideData';

type RideSelectorProps = {
  rides: RideData[];
  selectedRideId: string | null;
  onRideLoad: (rideId: string, loadType: 'limited' | 'full') => Promise<void>;
  isLoading: boolean;
  getTelemetryPointCount?: (rideId: string) => number;
  disabled?: boolean;
  className?: string;
  riderId?: string;
};

export default function RideSelector({
  rides,
  selectedRideId,
  onRideLoad,
  isLoading,
  getTelemetryPointCount,
  disabled = false,
  className = "",
  riderId,
}: RideSelectorProps) {
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showLoadFileModal, setShowLoadFileModal] = useState(false);
  const [pendingRide, setPendingRide] = useState<RideData | null>(null);

  // Default function to get point count from ride data or estimate
  const getPointCount = (rideId: string): number => {
    if (getTelemetryPointCount) {
      return getTelemetryPointCount(rideId);
    }
    
    // Fallback: use point_count from ride data or estimate
    const ride = rides.find(r => r.ride_id === rideId);
    return ride?.point_count || 500; // Default estimate
  };

  // Handle ride selection from calendar modal
  const handleRideSelectFromCalendar = (ride: RideData) => {
    setPendingRide(ride);
    setShowCalendarModal(false);
    setShowLoadFileModal(true);
  };

  const handleLoadConfirmed = async (loadType: 'limited' | 'full') => {
    if (!pendingRide) return;
    
    await onRideLoad(pendingRide.ride_id, loadType);
    setShowLoadFileModal(false);
    setPendingRide(null);
  };

  const handleLoadFileModalClose = () => {
    setShowLoadFileModal(false);
    setPendingRide(null);
  };

  const handleCalendarModalClose = () => {
    setShowCalendarModal(false);
  };

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        <div className="flex flex-col space-y-4 md:flex-row md:items-start md:justify-between md:space-y-0 md:space-x-6">
          {/* Calendar Button - Primary Action */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Ride ({rides.length} available)
            </label>
            <Button
              onClick={() => setShowCalendarModal(true)}
              variant="outline"
              disabled={isLoading || disabled}
              className="flex items-center gap-2 w-full max-w-md justify-start px-3 py-2 h-10 border-gray-300 hover:bg-gray-50"
            >
              <Calendar className="h-4 w-4" />
              {selectedRideId 
                ? `${selectedRideId.substring(0, 12)}... (click to change)`
                : 'Open Calendar to Select Ride'
              }
            </Button>
          </div>

          {/* Reload Button (for currently selected ride) */}
          {selectedRideId && (
            <div className="flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Ride
              </label>
              <Button
                onClick={() => {
                  const ride = rides.find(r => r.ride_id === selectedRideId);
                  if (ride) {
                    setPendingRide(ride);
                    setShowLoadFileModal(true);
                  }
                }}
                variant="outline"
                disabled={isLoading || disabled}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Reload File
              </Button>
            </div>
          )}
        </div>

        {/* Current Selection Display */}
        {selectedRideId && (
          <div className="text-sm text-gray-600">
            Currently loaded: <span className="font-mono">{selectedRideId.substring(0, 12)}...</span>
          </div>
        )}
      </div>

      {/* Calendar Modal */}
      <RideCalendarModal
        isOpen={showCalendarModal}
        onClose={handleCalendarModalClose}
        onSelectRide={handleRideSelectFromCalendar}
        riderId={riderId}
        rides={rides}
        isLoading={isLoading}
      />

      {/* Load File Modal */}
      {pendingRide && (
        <LoadFileModal
          isOpen={showLoadFileModal}
          onClose={handleLoadFileModalClose}
          onConfirmLoad={handleLoadConfirmed}
          rideId={pendingRide.ride_id}
          totalPoints={getPointCount(pendingRide.ride_id)}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
