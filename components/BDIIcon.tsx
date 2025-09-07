'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// Icon mapping for the available BDI icons
export const BDI_ICONS = {
  // Main Icons
  'app-1': '/iconography/Iconography/Main Icons/SVG/App 1.svg',
  'app-2': '/iconography/Iconography/Main Icons/SVG/App 2.svg',
  'app-3': '/iconography/Iconography/Main Icons/SVG/App 3.svg',
  'app-4': '/iconography/Iconography/Main Icons/SVG/App 4.svg',
  'app-5': '/iconography/Iconography/Main Icons/SVG/App 5.svg',
  'ecommerce-1': '/iconography/Iconography/Main Icons/SVG/E-commerce 1.svg',
  'ecommerce-2': '/iconography/Iconography/Main Icons/SVG/E-commerce 2.svg',
  'ecommerce-3': '/iconography/Iconography/Main Icons/SVG/E-commerce 3.svg',
  'ecommerce-4': '/iconography/Iconography/Main Icons/SVG/E-commerce 4.svg',
  'ecommerce-5': '/iconography/Iconography/Main Icons/SVG/E-commerce 5.svg',
  'freight-1': '/iconography/Iconography/Main Icons/SVG/Freight 1.svg',
  'freight-2': '/iconography/Iconography/Main Icons/SVG/Freight 2.svg',
  'freight-3': '/iconography/Iconography/Main Icons/SVG/Freight 3.svg',
  'freight-4': '/iconography/Iconography/Main Icons/SVG/Freight 4.svg',
  'freight-5': '/iconography/Iconography/Main Icons/SVG/Freight 5.svg',
  'repair-1': '/iconography/Iconography/Main Icons/SVG/Repair 1.svg',
  'repair-2': '/iconography/Iconography/Main Icons/SVG/Repair 2.svg',
  'repair-3': '/iconography/Iconography/Main Icons/SVG/Repair 3.svg',
  'repair-4': '/iconography/Iconography/Main Icons/SVG/Repair 4.svg',
  'repair-5': '/iconography/Iconography/Main Icons/SVG/Repair 5.svg',
  'retail-1': '/iconography/Iconography/Main Icons/SVG/Retail 1.svg',
  'retail-2': '/iconography/Iconography/Main Icons/SVG/Retail 2.svg',
  'retail-3': '/iconography/Iconography/Main Icons/SVG/Retail 3.svg',
  'retail-4': '/iconography/Iconography/Main Icons/SVG/Retail 4.svg',
  'retail-5': '/iconography/Iconography/Main Icons/SVG/Retail 5.svg',
  'warehouse-1': '/iconography/Iconography/Main Icons/SVG/Warehouse 1.svg',
  'warehouse-2': '/iconography/Iconography/Main Icons/SVG/Warehouse 2.svg',
  'warehouse-3': '/iconography/Iconography/Main Icons/SVG/Warehouse 3.svg',
  'warehouse-4': '/iconography/Iconography/Main Icons/SVG/Warehouse 4.svg',
  'warehouse-5': '/iconography/Iconography/Main Icons/SVG/Warehouse 5.svg',
  
  // Network Icons (using artboard names for now - can be renamed based on actual content)
  'network-2': '/iconography/Iconography/Network Icons/SVG/Artboard 2.svg',
  'network-3': '/iconography/Iconography/Network Icons/SVG/Artboard 3.svg',
  'network-4': '/iconography/Iconography/Network Icons/SVG/Artboard 4.svg',
  'network-5': '/iconography/Iconography/Network Icons/SVG/Artboard 5.svg',
  'network-6': '/iconography/Iconography/Network Icons/SVG/Artboard 6.svg',
  'network-7': '/iconography/Iconography/Network Icons/SVG/Artboard 7.svg',
  'network-8': '/iconography/Iconography/Network Icons/SVG/Artboard 8.svg',
  'network-9': '/iconography/Iconography/Network Icons/SVG/Artboard 9.svg',
  'network-10': '/iconography/Iconography/Network Icons/SVG/Artboard 10.svg',
  'network-11': '/iconography/Iconography/Network Icons/SVG/Artboard 11.svg',
  'network-12': '/iconography/Iconography/Network Icons/SVG/Artboard 12.svg',
  'network-13': '/iconography/Iconography/Network Icons/SVG/Artboard 13.svg',
  'network-14': '/iconography/Iconography/Network Icons/SVG/Artboard 14.svg',
  'network-15': '/iconography/Iconography/Network Icons/SVG/Artboard 15.svg',
  'network-16': '/iconography/Iconography/Network Icons/SVG/Artboard 16.svg',
  'network-17': '/iconography/Iconography/Network Icons/SVG/Artboard 17.svg',
  'network-18': '/iconography/Iconography/Network Icons/SVG/Artboard 18.svg',
  'network-19': '/iconography/Iconography/Network Icons/SVG/Artboard 19.svg',
  'network-20': '/iconography/Iconography/Network Icons/SVG/Artboard 20.svg',
  'network-21': '/iconography/Iconography/Network Icons/SVG/Artboard 21.svg',
  'network-22': '/iconography/Iconography/Network Icons/SVG/Artboard 22.svg',
  'network-23': '/iconography/Iconography/Network Icons/SVG/Artboard 23.svg',
  'network-24': '/iconography/Iconography/Network Icons/SVG/Artboard 24.svg',
  'network-25': '/iconography/Iconography/Network Icons/SVG/Artboard 25.svg',
  
  // Mobile Icons
  'mobile-2': '/iconography/Iconography/Mobile Icons/SVG/Artboard 2.svg',
  'mobile-3': '/iconography/Iconography/Mobile Icons/SVG/Artboard 3.svg',
  'mobile-4': '/iconography/Iconography/Mobile Icons/SVG/Artboard 4.svg',
  'mobile-5': '/iconography/Iconography/Mobile Icons/SVG/Artboard 5.svg',
  'mobile-6': '/iconography/Iconography/Mobile Icons/SVG/Artboard 6.svg',
  'mobile-7': '/iconography/Iconography/Mobile Icons/SVG/Artboard 7.svg',
  'mobile-8': '/iconography/Iconography/Mobile Icons/SVG/Artboard 8.svg',
  'mobile-9': '/iconography/Iconography/Mobile Icons/SVG/Artboard 9.svg',
  'mobile-10': '/iconography/Iconography/Mobile Icons/SVG/Artboard 10.svg',
  'mobile-11': '/iconography/Iconography/Mobile Icons/SVG/Artboard 11.svg',
  'mobile-12': '/iconography/Iconography/Mobile Icons/SVG/Artboard 12.svg',
  'mobile-13': '/iconography/Iconography/Mobile Icons/SVG/Artboard 13.svg',
  'mobile-14': '/iconography/Iconography/Mobile Icons/SVG/Artboard 14.svg',
  'mobile-15': '/iconography/Iconography/Mobile Icons/SVG/Artboard 15.svg',
  'mobile-16': '/iconography/Iconography/Mobile Icons/SVG/Artboard 16.svg',
  'mobile-17': '/iconography/Iconography/Mobile Icons/SVG/Artboard 17.svg',
  'mobile-18': '/iconography/Iconography/Mobile Icons/SVG/Artboard 18.svg',
  'mobile-19': '/iconography/Iconography/Mobile Icons/SVG/Artboard 19.svg',
  'mobile-20': '/iconography/Iconography/Mobile Icons/SVG/Artboard 20.svg',
  'mobile-21': '/iconography/Iconography/Mobile Icons/SVG/Artboard 21.svg',
  'mobile-22': '/iconography/Iconography/Mobile Icons/SVG/Artboard 22.svg',
  'mobile-23': '/iconography/Iconography/Mobile Icons/SVG/Artboard 23.svg',
  'mobile-24': '/iconography/Iconography/Mobile Icons/SVG/Artboard 24.svg',
} as const;

export type BDIIconName = keyof typeof BDI_ICONS;

interface BDIIconProps {
  name: BDIIconName;
  size?: number | string;
  className?: string;
  alt?: string;
}

export function BDIIcon({ name, size = 24, className, alt }: BDIIconProps) {
  const iconPath = BDI_ICONS[name];
  
  if (!iconPath) {
    console.warn(`BDI Icon "${name}" not found`);
    return null;
  }

  return (
    <img
      src={iconPath}
      alt={alt || `${name} icon`}
      width={size}
      height={size}
      className={cn('inline-block', className)}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: typeof size === 'number' ? `${size}px` : size,
      }}
    />
  );
}

// Semantic icon mappings for common UI elements
export const SEMANTIC_ICONS: Record<string, BDIIconName> = {
  dashboard: 'app-1',
  forecasts: 'retail-2', // Chart/analytics looking icon
  cpfr: 'ecommerce-4', // More chart-like for CPFR analytics
  supply: 'warehouse-1',
  sites: 'network-10', // More geo/location-like icon
  inventory_items: 'warehouse-2', // Different warehouse icon
  inventory_analytics: 'ecommerce-1', // Different from forecasts
  collaboration: 'network-2',
  analytics: 'retail-1', // Complex analytics icon
  reports: 'ecommerce-3',
  settings: 'repair-1',
  users: 'app-2',
  profile: 'mobile-2',
  notifications: 'network-3',
  help: 'mobile-3',
  search: 'mobile-4',
  filter: 'mobile-5',
  export: 'freight-1',
  import: 'freight-2',
  upload: 'freight-3',
  download: 'freight-4',
  sync: 'network-4',
  connect: 'network-5',
  connections: 'network-7', // Matrix/data communications icon
  orders: 'ecommerce-2', // Purchase orders icon
  shipping: 'freight-5', // Shipments/delivery icon
  plus: 'network-6', // Plus/add icon
  inventory: 'warehouse-3', // Inventory icon
  info: 'mobile-10', // Info icon
  security: 'network-8', // Security/lock icon
  check: 'network-9', // Check/success icon
  calendar: 'mobile-11', // Calendar icon
  document: 'mobile-12', // Document icon
  calculator: 'mobile-13', // Calculator icon
  charts: 'mobile-14', // Charts icon
  ai: 'mobile-15', // AI/brain icon
  query: 'mobile-16', // Query icon
  delete: 'repair-5', // Delete/trash icon
};

interface SemanticBDIIconProps {
  semantic: keyof typeof SEMANTIC_ICONS;
  size?: number | string;
  className?: string;
  alt?: string;
}

export function SemanticBDIIcon({ semantic, size = 24, className, alt }: SemanticBDIIconProps) {
  const iconName = SEMANTIC_ICONS[semantic];
  
  if (!iconName) {
    console.warn(`Semantic icon "${semantic}" not found`);
    return null;
  }
  
  return (
    <BDIIcon
      name={iconName}
      size={size}
      className={className}
      alt={alt || `${semantic} icon`}
    />
  );
}
