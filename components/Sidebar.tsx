'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  Building2, 
  Package, 
  TrendingUp, 
  Users, 
  User,
  Settings,
  BookOpen,
  Home,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { User as UserType } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NavItem {
  title: string;
  href?: string;
  icon: React.ComponentType<any>;
  children?: NavItem[];
  requiresRole?: string[];
}

const navigationItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    title: 'CPFR',
    icon: TrendingUp,
    children: [
      {
        title: 'Forecasts',
        href: '/cpfr/forecasts',
        icon: TrendingUp,
      },
      {
        title: 'Supply Signals',
        href: '/cpfr/supply-signals',
        icon: Package,
      },
      {
        title: 'Cycles',
        href: '/cpfr/cycles',
        icon: BarChart3,
      },
      {
        title: 'Overview',
        href: '/cpfr/overview',
        icon: BarChart3,
      },
    ],
  },
  {
    title: 'Inventory',
    icon: Package,
    children: [
      {
        title: 'Items',
        href: '/inventory/items',
        icon: Package,
      },
      {
        title: 'Sites',
        href: '/inventory/sites',
        icon: Building2,
      },
    ],
  },
  {
    title: 'Teams',
    href: '/teams',
    icon: Users,
  },
  {
    title: 'My Account',
    icon: User,
    children: [
      {
        title: 'Profile',
        href: '/account/profile',
        icon: User,
      },
      {
        title: 'Settings',
        href: '/account/settings',
        icon: Settings,
      },
    ],
  },
  {
    title: 'Admin',
    icon: Settings,
    requiresRole: ['super_admin', 'admin'],
    children: [
      {
        title: 'Organizations',
        href: '/admin/organizations',
        icon: Building2,
      },
      {
        title: 'Users',
        href: '/admin/users',
        icon: Users,
      },
      {
        title: 'System',
        href: '/admin/system',
        icon: Settings,
      },
    ],
  },
  {
    title: 'BDI Business Portal User Guide',
    href: '/user-guide',
    icon: BookOpen,
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
              'hover:bg-gray-100 hover:text-gray-900',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              level > 0 && 'ml-4',
              active && 'bg-blue-50 text-blue-700'
            )}
          >
            <div className="flex items-center">
              <item.icon className="mr-3 h-5 w-5" />
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
          'hover:bg-gray-100 hover:text-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          level > 0 && 'ml-4',
          active 
            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
            : 'text-gray-700'
        )}
      >
        <item.icon className="mr-3 h-5 w-5" />
        {item.title}
      </Link>
    );
  };

  return (
    <div className={cn('flex flex-col w-64 bg-white border-r border-gray-200', className)}>
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <Link href="/dashboard" className="flex items-center">
          <div className="text-xl font-bold text-gray-900">BDI Business Portal</div>
        </Link>
      </div>
      
      <nav className="flex-1 px-4 py-4 space-y-2">
        {navigationItems.map(item => renderNavItem(item))}
      </nav>
      
      {user && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center text-sm">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <User className="h-4 w-4 text-blue-600" />
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
