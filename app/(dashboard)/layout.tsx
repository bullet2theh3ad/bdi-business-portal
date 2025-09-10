'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { UserMenu } from '@/app/(dashboard)/user-menu';
import { Button } from '@/components/ui/button';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import VersionDisplay from '@/components/VersionDisplay';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { getUserLocale } from '@/lib/i18n/simple-translator';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const userLocale = getUserLocale(user);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Desktop Sidebar - hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75"
              onClick={() => setSidebarOpen(false)}
            />
            
            {/* Sidebar */}
            <div className="fixed top-0 left-0 bottom-0 w-64 bg-white shadow-xl">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="text-xl font-bold text-gray-900">BDI Portal</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                  className="p-2"
                >
                  ✕
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar />
              </div>
            </div>
          </div>
        )}
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header */}
          <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="lg:hidden flex items-center space-x-3">
                {/* Mobile Hamburger Menu Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarOpen(true)}
                  className="p-2"
                >
                  <div className="w-5 h-5 flex flex-col justify-center space-y-1">
                    <div className="w-full h-0.5 bg-gray-700"></div>
                    <div className="w-full h-0.5 bg-gray-700"></div>
                    <div className="w-full h-0.5 bg-gray-700"></div>
                  </div>
                </Button>
                <div className="text-xl font-bold text-gray-900">BDI Business Portal</div>
              </div>
              
              <div className="hidden lg:block">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {/* Page title will be dynamic based on route */}
                </h1>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-4">
                {/* Language Switcher - Mobile optimized */}
                <LanguageSwitcher
                  currentLanguage={userLocale}
                  onLanguageChange={() => {}} // Handled internally by component
                  compact={true} // Always compact for header
                  className="order-1 sm:order-none"
                />
                
                {/* Version Display */}
                <VersionDisplay />
                
                <UserMenu />
              </div>
            </div>
          </header>
          
          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
      
      {/* Mobile sidebar overlay would go here */}
    </div>
  );
}
