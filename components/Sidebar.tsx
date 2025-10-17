'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { useState } from 'react';
import useSWR from 'swr';
import { User as UserType } from '@/lib/db/schema';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { canAccessQuickBooks, canAccessBusinessAnalysis } from '@/lib/feature-flags';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NavItem {
  title: string;
  href?: string;
  icon: keyof typeof import('@/components/BDIIcon').SEMANTIC_ICONS;
  children?: NavItem[];
  requiresRole?: string[];
  requiresBDI?: boolean; // Only show for BDI organization users
  requiresNonBDI?: boolean; // Only show for non-BDI organization users
  requiresFeatureFlag?: (email: string) => boolean; // Custom feature flag check
}

// 🌍 DYNAMIC: Navigation items will be created inside component for translations
// const navigationItems: NavItem[] = [ // TODO: Remove static version

const getNavigationItems = (tn: (key: string, fallback?: string) => string): NavItem[] => [
  {
    title: tn('dashboard', 'Dashboard'), // 🌍 TRANSLATED
    href: '/dashboard',
    icon: 'dashboard',
  },
  {
    title: 'CPFR', // Keep as acronym (international standard)
    icon: 'cpfr',
    children: [
      {
        title: tn('invoices', 'Invoices'), // 🌍 TRANSLATED
        href: '/cpfr/invoices',
        icon: 'orders',
      },
      {
        title: tn('forecasts', 'Forecasts'), // 🌍 TRANSLATED
        href: '/cpfr/forecasts',
        icon: 'forecasts',
      },
      {
        title: tn('purchaseOrders', 'Purchase Orders'), // 🌍 TRANSLATED
        href: '/cpfr/purchase-orders',
        icon: 'orders',
      },
      {
        title: tn('shipments', 'Shipments'), // 🌍 TRANSLATED
        href: '/cpfr/shipments',
        icon: 'shipping',
      },
    ],
  },
  {
    title: tn('inventory', 'Inventory'), // 🌍 TRANSLATED
    icon: 'inventory_analytics',
    children: [
      {
        title: tn('skus', 'SKUs'), // 🌍 TRANSLATED
        href: '/admin/skus',
        icon: 'inventory_items',
        requiresRole: ['super_admin', 'admin'],
        requiresBDI: true,
      },
      {
        title: tn('warehouses', 'Warehouses'), // 🌍 TRANSLATED
        href: '/inventory/warehouses',
        icon: 'sites',
      },
      {
        title: tn('productionFiles', 'Production Files'), // 🌍 TRANSLATED
        href: '/inventory/production-files',
        icon: 'analytics',
        requiresRole: ['super_admin', 'admin', 'operations', 'sales', 'member'],
      },
    ],
  },
  {
    title: tn('account', 'My Account'), // 🌍 TRANSLATED
    icon: 'profile',
    children: [
      {
        title: tn('profile', 'Profile'), // 🌍 TRANSLATED
        href: '/account/profile',
        icon: 'profile',
      },
      {
        title: `${tn('settings', 'Settings')} 🌍`, // 🌍 TRANSLATED + Language indicator
        href: '/account/settings',
        icon: 'settings',
      },
    ],
  },
  {
    title: tn('admin', 'Admin'), // 🌍 TRANSLATED
    icon: 'settings',
    requiresRole: ['super_admin', 'admin'],
    requiresBDI: true, // Only show Admin menu for BDI users
    children: [
      {
        title: tn('analytics', 'Analytics'), // 🌍 TRANSLATED
        href: '/admin/analytics',
        icon: 'analytics',
      },
      {
        title: '🤖 Ask BDI', // Keep as emoji for now
        href: '/admin/ask-bdi',
        icon: 'query',
        requiresRole: ['super_admin'], // Super Admin only
      },
      {
        title: tn('organizations', 'Organizations'), // 🌍 TRANSLATED
        href: '/admin/organizations',
        icon: 'collaboration',
      },
      {
        title: tn('apiKeys', 'API Keys'), // 🌍 TRANSLATED
        href: '/admin/api-keys',
        icon: 'connect',
        requiresRole: ['super_admin'], // Super Admin only
      },
      {
        title: tn('connections', 'Connections'), // 🌍 TRANSLATED
        href: '/admin/connections',
        icon: 'connections',
      },
      {
        title: tn('users', 'Users'), // 🌍 TRANSLATED
        href: '/admin/users',
        icon: 'users',
      },
      {
        title: tn('policies', 'Policies'), // 🌍 TRANSLATED
        href: '/admin/policies',
        icon: 'document',
        requiresBDI: true, // BDI-only feature
      },
      {
        title: 'Teams',
        href: '/admin/teams',
        icon: 'collaboration',
        requiresBDI: true, // BDI-only feature
      },
      {
        title: tn('amazonData', 'Amazon Data'), // 🌍 TRANSLATED
        icon: 'analytics',
        requiresRole: ['super_admin', 'admin_cfo'], // Super Admin and CFO only
        requiresBDI: true, // BDI-only feature
        children: [
          {
            title: 'Reports',
            href: '/admin/amazon-data',
            icon: 'reports',
          },
          {
            title: 'Financial Data',
            href: '/admin/amazon-data/financial',
            icon: 'finance',
          },
        ],
      },
      {
        title: 'NRE Spend',
        href: '/admin/nre-budget',
        icon: 'orders',
        requiresRole: ['super_admin', 'admin_cfo', 'admin_nre'], // Super Admin, CFO, and NRE Manager
        requiresBDI: true, // BDI-only feature
      },
      {
        title: '🎯 Budget Targets',
        href: '/admin/budget-targets',
        icon: 'forecasts',
        requiresRole: ['super_admin', 'admin_cfo'], // Super Admin and CFO only
        requiresBDI: true, // BDI-only feature
      },
      {
        title: '💰 QuickBooks',
        icon: 'analytics',
        requiresRole: ['super_admin'], // Super Admin only
        requiresBDI: true, // BDI-only feature
        requiresFeatureFlag: canAccessQuickBooks, // Email-based whitelist
        children: [
          {
            title: 'Dashboard',
            href: '/admin/quickbooks',
            icon: 'dashboard',
          },
          {
            title: 'Reports',
            href: '/admin/quickbooks/reports',
            icon: 'reports',
          },
          {
            title: 'Products',
            href: '/admin/quickbooks/products',
            icon: 'inventory',
          },
          {
            title: 'Payments/Bills',
            href: '/admin/quickbooks/payments-bills',
            icon: 'finance',
          },
          {
            title: 'Sales Receipts',
            href: '/admin/quickbooks/sales-receipts',
            icon: 'orders',
          },
          {
            title: 'Credit Memos',
            href: '/admin/quickbooks/credit-memos',
            icon: 'document',
          },
          {
            title: 'Purchase Orders',
            href: '/admin/quickbooks/purchase-orders',
            icon: 'shipping',
          },
          {
            title: 'Bank Deposits',
            href: '/admin/quickbooks/bank-deposits',
            icon: 'finance',
          },
          {
            title: 'Data Viewer',
            href: '/admin/quickbooks/data-viewer',
            icon: 'list',
          },
        ],
      },
      {
        title: '📊 Business Analysis',
        icon: 'analytics',
        requiresRole: ['super_admin'], // Super Admin only
        requiresBDI: true, // BDI-only feature
        requiresFeatureFlag: canAccessBusinessAnalysis, // Email-based whitelist
        children: [
          {
            title: 'Dashboard',
            href: '/admin/business-analysis',
            icon: 'dashboard',
          },
          {
            title: 'SKU Financial Entry',
            href: '/admin/business-analysis/sku-financial-entry',
            icon: 'calculator',
          },
          {
            title: 'Sales Reports',
            href: '/admin/business-analysis/sales-reports',
            icon: 'reports',
          },
        ],
      },
      {
        title: '📦 WIP Flow',
        icon: 'inventory_analytics',
        requiresRole: ['super_admin', 'admin', 'operations'], // Operations team access
        requiresBDI: true, // BDI-only feature
        children: [
          {
            title: '📊 Dashboard',
            href: '/admin/warehouse-wip/dashboard',
            icon: 'dashboard',
          },
          {
            title: '📊 RMA Analytics',
            href: '/admin/warehouse-wip/rma',
            icon: 'dashboard',
          },
        ],
      },
    ],
  },
  {
    title: tn('organization', 'Organization'), // 🌍 TRANSLATED
    icon: 'collaboration',
    requiresRole: ['admin'],
    requiresNonBDI: true, // Only show for non-BDI organizations
    children: [
      {
        title: tn('users', 'Users'), // 🌍 TRANSLATED
        href: '/organization/users',
        icon: 'users',
      },
      {
        title: `${tn('settings', 'Settings')} 🌍`, // 🌍 TRANSLATED + Language indicator
        href: '/organization/settings',
        icon: 'settings',
      },
      {
        title: 'Teams',
        href: '/organization/teams',
        icon: 'collaboration',
        requiresBDI: true, // Not ready for non-BDI organizations yet
      },
    ],
  },
  {
    title: tn('userGuide', 'Portal User Guide'), // 🌍 TRANSLATED
    href: '/user-guide',
    icon: 'help',
  },
  {
    title: tn('portalApiGuide', 'Portal API Guide'), // 🌍 TRANSLATED
    href: '/admin/api-keys/documentation',
    icon: 'connect',
  },
  {
    title: tn('ediIntegrationGuide', 'EDI Integration Guide'), // 🌍 TRANSLATED
    href: '/edi-integration-guide',
    icon: 'integration',
  },
]; // 🌍 END: Dynamic navigation items

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { data: user } = useSWR<UserType>('/api/user', fetcher);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
  // 🌍 SAFE: Simple translation functions (no routing changes)
  const userLocale = getUserLocale(user);
  const { tn, tc } = useSimpleTranslations(userLocale);

  const toggleExpanded = (title: string) => {
    setExpandedItems(prev => 
      prev.includes(title) 
        ? prev.filter(item => item !== title)
        : [...prev, title]
    );
  };

  const hasRequiredRole = (requiredRoles?: string[]) => {
    if (!requiredRoles) return true;
    if (!user) return false;
    
    // Check system role
    if (requiredRoles.includes(user.role)) return true;
    
    // Also check organization membership roles
    if ((user as any).organizations && Array.isArray((user as any).organizations)) {
      const orgRoles = (user as any).organizations.map((org: any) => org.membershipRole);
      return requiredRoles.some(role => orgRoles.includes(role));
    }
    
    return false;
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    if (!hasRequiredRole(item.requiresRole)) {
      return null;
    }

    // Check if item requires BDI organization access
    if (item.requiresBDI && (user as any)?.organization?.code !== 'BDI') {
      return null;
    }

    // Check if item requires non-BDI organization access
    if (item.requiresNonBDI && ((user as any)?.organization?.code === 'BDI' || (user as any)?.organization?.type === 'internal')) {
      return null;
    }

    // Check feature flag (email-based whitelist)
    if (item.requiresFeatureFlag && !item.requiresFeatureFlag(user?.email || '')) {
      return null;
    }

    const isExpanded = expandedItems.includes(item.title);
    const hasChildren = item.children && item.children.length > 0;
    const active = item.href ? isActive(item.href) : false;

    if (hasChildren) {
      return (
        <div key={item.title}>
          <button
            onClick={() => toggleExpanded(item.title)}
            className={cn(
              'flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors',
              'hover:bg-gray-100 hover:text-bdi-green-1',
              'focus:outline-none focus:ring-2 focus:ring-bdi-green-1',
              active && 'bg-bdi-green-1/10 text-bdi-green-1'
            )}
          >
            <div className="flex items-center">
              <SemanticBDIIcon semantic={item.icon} size={20} className="mr-3" />
              {item.title}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {isExpanded && (
            <div className="mt-1 space-y-1 ml-4">
              {item.children?.map(child => renderNavItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    if (!item.href) return null;

    return (
      <Link
        key={item.title}
        href={item.href}
        className={cn(
          'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
          'hover:bg-gray-100 hover:text-bdi-green-1',
          'focus:outline-none focus:ring-2 focus:ring-bdi-green-1',
          active 
            ? 'bg-bdi-green-1/10 text-bdi-green-1 border-r-2 border-bdi-green-1' 
            : 'text-gray-700'
        )}
      >
        <SemanticBDIIcon semantic={item.icon} size={20} className="mr-3" priority={true} />
        {item.title}
      </Link>
    );
  };

  return (
    <div className={cn('flex flex-col w-64 bg-white border-r border-gray-200 h-screen', className)}>
      <div className="flex items-center px-6 py-4 border-b border-gray-200 flex-shrink-0">
        <Link href="/dashboard" className="flex items-center space-x-3">
          <img 
            src="/logos/SVG/Full Lockup Color.svg" 
            alt="BDI Business Portal" 
            className="h-8"
            loading="eager"
            fetchPriority="high"
          />
        </Link>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
        {getNavigationItems(tn).map(item => renderNavItem(item))}
      </nav>
      
      {user && (
        <div className="border-t border-gray-200 p-4 flex-shrink-0">
          <div className="flex items-center text-sm">
            <div className="w-8 h-8 bg-bdi-green-1/10 rounded-full flex items-center justify-center mr-3">
              <SemanticBDIIcon semantic="profile" size={16} className="text-bdi-green-1" priority={true} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {user.name || user.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
