'use client';

import { Sidebar } from '@/components/Sidebar';
import { UserMenu } from '@/app/(dashboard)/user-menu';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar - hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <Sidebar />
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top header */}
          <header className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="lg:hidden">
                {/* Mobile menu button would go here */}
                                        <div className="text-xl font-bold text-gray-900">BDI Business Portal</div>
              </div>
              
              <div className="hidden lg:block">
                <h1 className="text-2xl font-semibold text-gray-900">
                  {/* Page title will be dynamic based on route */}
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
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
