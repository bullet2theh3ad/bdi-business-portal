import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Unit conversion utilities
export const units = {
  // Convert meters to feet
  metersToFeet: (meters: number): number => meters * 3.28084,
  
  // Convert kilometers to miles
  kilometersToMiles: (km: number): number => km * 0.621371,
  
  // Format elevation with proper units (currently defaults to feet for consistency)
  formatElevation: (altitudeMeters: number | null | undefined, useMetric = false): string => {
    if (altitudeMeters === null || altitudeMeters === undefined) return '--';
    
    if (useMetric) {
      return `${altitudeMeters.toFixed(1)}m`;
    } else {
      return `${(altitudeMeters * 3.28084).toFixed(0)}ft`;
    }
  },
  
  // Format distance with proper units (currently defaults to imperial for consistency)
  formatDistance: (distanceKm: number | null | undefined, useMetric = false): string => {
    if (distanceKm === null || distanceKm === undefined) return '--';
    
    if (useMetric) {
      return distanceKm < 1 
        ? `${(distanceKm * 1000).toFixed(0)}m`
        : `${distanceKm.toFixed(1)}km`;
    } else {
      const miles = distanceKm * 0.621371;
      return miles < 0.1 
        ? `${(distanceKm * 3280.84).toFixed(0)}ft`
        : `${miles.toFixed(1)}mi`;
    }
  }
};
