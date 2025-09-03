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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NavItem {
  title: string;
  href?: string;
  icon: keyof typeof import('@/components/BDIIcon').SEMANTIC_ICONS;
  children?: NavItem[];
  requiresRole?: string[];
  requiresBDI?: boolean; // Only show for BDI organization users
  requiresNonBDI?: boolean; // Only show for non-BDI organization users
}

const navigationItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
  },
  {
    title: 'CPFR',
    icon: 'cpfr',
    children: [
      {
        title: 'Invoices',
        href: '/cpfr/invoices',
        icon: 'orders',
      },
      {
        title: 'Forecasts',
        href: '/cpfr/forecasts',
        icon: 'forecasts',
      },
      {
        title: 'Purchase Orders',
        href: '/cpfr/purchase-orders',
        icon: 'orders',
      },
      {
        title: 'Shipments',
        href: '/cpfr/shipments',
        icon: 'shipping',
      },
    ],
  },
  {
    title: 'Inventory',
    icon: 'inventory_analytics',
    children: [
      {
        title: 'SKUs',
        href: '/admin/skus',
        icon: 'inventory_items',
        requiresRole: ['super_admin', 'admin'],
        requiresBDI: true,
      },
      {
        title: 'Warehouses',
        href: '/inventory/warehouses',
        icon: 'sites',
      },
      {
        title: 'Production Files',
        icon: 'analytics',
        requiresRole: ['super_admin', 'admin', 'operations', 'sales', 'member'],
        children: [
          {
            title: 'Files',
            href: '/inventory/production-files',
            icon: 'analytics',
          },
          {
            title: 'Templates',
            href: '/inventory/production-files/templates',
            icon: 'help',
          },
        ],
      },
    ],
  },
  {
    title: 'My Account',
    icon: 'profile',
    children: [
      {
        title: 'Profile',
        href: '/account/profile',
        icon: 'profile',
      },
      {
        title: 'Settings',
        href: '/account/settings',
        icon: 'settings',
      },
    ],
  },
  {
    title: 'Admin',
    icon: 'settings',
    requiresRole: ['super_admin', 'admin'],
    requiresBDI: true, // Only show Admin menu for BDI users
    children: [
      {
        title: 'Organizations',
        href: '/admin/organizations',
        icon: 'collaboration',
      },
      {
        title: 'Connections',
        href: '/admin/connections',
        icon: 'connect',
      },
      {
        title: 'Users',
        href: '/admin/users',
        icon: 'users',
      },
      {
        title: 'Teams',
        href: '/admin/teams',
        icon: 'collaboration',
      },
    ],
  },
  {
    title: 'Organization',
    icon: 'collaboration',
    requiresRole: ['admin'],
    requiresNonBDI: true, // Only show for non-BDI organizations
    children: [
      {
        title: 'Users',
        href: '/organization/users',
        icon: 'users',
      },
      {
        title: 'Teams',
        href: '/organization/teams',
        icon: 'collaboration',
      },
    ],
  },
  {
    title: 'Portal User Guide',
    href: '/user-guide',
    icon: 'help',
  },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { data: user } = useSWR<UserType>('/api/user', fetcher);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

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
    return requiredRoles.includes(user.role);
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
              level > 0 && 'ml-4',
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
            <div className="mt-1 space-y-1">
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
          level > 0 && 'ml-4',
          active 
            ? 'bg-bdi-green-1/10 text-bdi-green-1 border-r-2 border-bdi-green-1' 
            : 'text-gray-700'
        )}
      >
        <SemanticBDIIcon semantic={item.icon} size={20} className="mr-3" />
        {item.title}
      </Link>
    );
  };

  return (
    <div className={cn('flex flex-col w-64 bg-white border-r border-gray-200', className)}>
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center space-x-3">
          <img 
            src="/logos/SVG/Full Lockup Color.svg" 
            alt="BDI Business Portal" 
            className="h-8"
          />
        </Link>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navigationItems.map(item => renderNavItem(item))}
      </nav>
      
      {user && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center text-sm">
            <div className="w-8 h-8 bg-bdi-green-1/10 rounded-full flex items-center justify-center mr-3">
              <SemanticBDIIcon semantic="profile" size={16} className="text-bdi-green-1" />
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
