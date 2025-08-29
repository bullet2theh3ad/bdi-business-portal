'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  FileText,
  AlertCircle,
  Clock,
  Database
} from 'lucide-react';

type LoadFileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirmLoad: (loadType: 'limited' | 'full') => Promise<void>;
  rideId: string;
  totalPoints: number;
  isLoading?: boolean;
  telemetryProgress?: { stage: string; percentage: number; currentPoints: number; totalPoints: number };
};

export default function LoadFileModal({
  isOpen,
  onClose,
  onConfirmLoad,
  rideId,
  totalPoints,
  isLoading = false,
  telemetryProgress
}: LoadFileModalProps) {
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  
  const showWarning = totalPoints > 1000;
  const showLimitedOption = totalPoints > 1000; // Only show limited option for files > 1000 points
  const estimatedLoadTime = Math.ceil(totalPoints / 1000) * 2; // Rough estimate: 2 seconds per 1000 points

  const handleLoadFile = async (loadType: 'limited' | 'full') => {
    setIsLoadingFile(true);
    try {
      await onConfirmLoad(loadType);
    } finally {
      setIsLoadingFile(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Load Ride Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Ride Info */}
          <Card className="p-4 bg-gray-50">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Ride ID:</span>
                <span className="text-sm text-gray-600 font-mono">
                  {rideId.substring(0, 12)}...
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Total Data Points:</span>
                <span className="text-lg font-bold text-blue-600">
                  {totalPoints.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>

          {/* Notice for large files */}
          {showWarning && (
            <Card className="p-4 bg-amber-50 border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-amber-800">
                    Notice
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-amber-600">
                    <Clock className="h-3 w-3" />
                    <span>
                      Estimated loading time for {totalPoints.toLocaleString()} points: ~{estimatedLoadTime} seconds
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Normal file message */}
          {!showWarning && (
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <p className="text-sm text-green-700">
                  This file size is optimal for quick loading.
                </p>
              </div>
            </Card>
          )}

          {/* Enhanced Loading State */}
          {(isLoading || isLoadingFile) && telemetryProgress && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm font-medium">{telemetryProgress.stage || 'Loading ride data...'}</span>
                </div>
                <span className="text-sm font-bold text-blue-700">{Math.round(telemetryProgress.percentage)}%</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${telemetryProgress.percentage}%` }}
                ></div>
              </div>
              {telemetryProgress.totalPoints > 0 && (
                <div className="text-xs text-blue-600">
                  {telemetryProgress.totalPoints > 1000 && (
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs mr-2">
                      Large Dataset
                    </span>
                  )}
                  {telemetryProgress.currentPoints > 0 
                    ? `Processing ${telemetryProgress.currentPoints.toLocaleString()} / ${telemetryProgress.totalPoints.toLocaleString()} points`
                    : `Expecting ${telemetryProgress.totalPoints.toLocaleString()} data points`
                  }
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 flex flex-col items-center justify-center py-4 h-16"
              disabled={isLoadingFile || isLoading}
            >
              <span>Cancel</span>
            </Button>
            <Button
              onClick={() => handleLoadFile('limited')}
              variant="outline"
              className={`flex-1 flex flex-col items-center justify-center py-4 h-16 ${
                !showLimitedOption ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={isLoadingFile || isLoading || !showLimitedOption}
            >
              <span>Load Limited</span>
              <span className="text-xs italic text-gray-500">(1000 points)</span>
            </Button>
            <Button
              onClick={() => handleLoadFile('full')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 flex flex-col items-center justify-center py-4 h-16"
              disabled={isLoadingFile || isLoading}
            >
              {(isLoadingFile || isLoading) ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {telemetryProgress?.stage ? 'Loading...' : 'Loading...'}
                </div>
              ) : (
                <>
                  <span>Load All</span>
                  <span className="text-xs italic text-blue-200">({totalPoints.toLocaleString()} points)</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
