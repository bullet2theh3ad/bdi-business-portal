'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  FileText, 
  Users, 
  Building2, 
  DollarSign, 
  Package,
  CreditCard,
  Receipt,
  ShoppingCart,
  FileX,
  Truck,
  Eye
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface DataCategory {
  title: string;
  icon: React.ReactNode;
  endpoint: string;
  color: string;
  description: string;
}

const dataCategories: DataCategory[] = [
  {
    title: 'Invoices',
    icon: <FileText className="h-6 w-6" />,
    endpoint: '/api/quickbooks/reports/invoices',
    color: 'blue',
    description: 'View all QuickBooks invoices'
  },
  {
    title: 'Customers',
    icon: <Users className="h-6 w-6" />,
    endpoint: '/api/quickbooks/reports/customers',
    color: 'green',
    description: 'View all QuickBooks customers'
  },
  {
    title: 'Vendors',
    icon: <Building2 className="h-6 w-6" />,
    endpoint: '/api/quickbooks/reports/vendors',
    color: 'purple',
    description: 'View all QuickBooks vendors'
  },
  {
    title: 'Expenses',
    icon: <DollarSign className="h-6 w-6" />,
    endpoint: '/api/quickbooks/reports/expenses',
    color: 'red',
    description: 'View all QuickBooks expenses'
  },
  {
    title: 'Items/Products',
    icon: <Package className="h-6 w-6" />,
    endpoint: '/api/quickbooks/items',
    color: 'orange',
    description: 'View all QuickBooks items'
  },
  {
    title: 'Payments',
    icon: <CreditCard className="h-6 w-6" />,
    endpoint: '/api/quickbooks/payments',
    color: 'teal',
    description: 'View all QuickBooks payments'
  },
  {
    title: 'Bills',
    icon: <Receipt className="h-6 w-6" />,
    endpoint: '/api/quickbooks/bills',
    color: 'indigo',
    description: 'View all QuickBooks bills'
  },
  {
    title: 'Sales Receipts',
    icon: <ShoppingCart className="h-6 w-6" />,
    endpoint: '/api/quickbooks/sales-receipts',
    color: 'pink',
    description: 'View all QuickBooks sales receipts'
  },
  {
    title: 'Credit Memos',
    icon: <FileX className="h-6 w-6" />,
    endpoint: '/api/quickbooks/credit-memos',
    color: 'yellow',
    description: 'View all QuickBooks credit memos'
  },
  {
    title: 'Purchase Orders',
    icon: <Truck className="h-6 w-6" />,
    endpoint: '/api/quickbooks/purchase-orders',
    color: 'cyan',
    description: 'View all QuickBooks purchase orders'
  },
];

const colorClasses: Record<string, { bg: string; text: string; hover: string; border: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', hover: 'hover:bg-blue-100', border: 'border-blue-200' },
  green: { bg: 'bg-green-50', text: 'text-green-700', hover: 'hover:bg-green-100', border: 'border-green-200' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', hover: 'hover:bg-purple-100', border: 'border-purple-200' },
  red: { bg: 'bg-red-50', text: 'text-red-700', hover: 'hover:bg-red-100', border: 'border-red-200' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-700', hover: 'hover:bg-orange-100', border: 'border-orange-200' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-700', hover: 'hover:bg-teal-100', border: 'border-teal-200' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', hover: 'hover:bg-indigo-100', border: 'border-indigo-200' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-700', hover: 'hover:bg-pink-100', border: 'border-pink-200' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700', hover: 'hover:bg-yellow-100', border: 'border-yellow-200' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-700', hover: 'hover:bg-cyan-100', border: 'border-cyan-200' },
};

export default function QuickBooksDataViewer() {
  const [selectedCategory, setSelectedCategory] = useState<DataCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch data when a category is selected
  const { data: categoryData, isLoading } = useSWR(
    selectedCategory ? selectedCategory.endpoint : null,
    fetcher
  );

  const handleViewData = (category: DataCategory) => {
    setSelectedCategory(category);
    setSearchTerm('');
  };

  const handleCloseModal = () => {
    setSelectedCategory(null);
    setSearchTerm('');
  };

  // Extract data from various response formats
  const extractData = (response: any) => {
    if (!response) return [];
    
    // Handle different response structures
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    if (response.items && Array.isArray(response.items)) return response.items;
    if (response.invoices && Array.isArray(response.invoices)) return response.invoices;
    if (response.customers && Array.isArray(response.customers)) return response.customers;
    if (response.vendors && Array.isArray(response.vendors)) return response.vendors;
    if (response.expenses && Array.isArray(response.expenses)) return response.expenses;
    if (response.payments && Array.isArray(response.payments)) return response.payments;
    if (response.bills && Array.isArray(response.bills)) return response.bills;
    if (response.salesReceipts && Array.isArray(response.salesReceipts)) return response.salesReceipts;
    if (response.creditMemos && Array.isArray(response.creditMemos)) return response.creditMemos;
    if (response.purchaseOrders && Array.isArray(response.purchaseOrders)) return response.purchaseOrders;
    
    return [];
  };

  const rawData = extractData(categoryData);

  // Filter data based on search term
  const filteredData = rawData.filter((item: any) => 
    JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">QuickBooks Data Viewer</h1>
        <p className="text-muted-foreground">
          View raw line-item data from QuickBooks for debugging and analysis
        </p>
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {dataCategories.map((category) => {
          const colors = colorClasses[category.color];
          return (
            <Card 
              key={category.title}
              className={`${colors.bg} ${colors.border} border-2 ${colors.hover} cursor-pointer transition-all hover:shadow-lg`}
              onClick={() => handleViewData(category)}
            >
              <CardHeader>
                <CardTitle className={`flex items-center gap-2 ${colors.text}`}>
                  {category.icon}
                  <span className="text-base sm:text-lg">{category.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{category.description}</p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewData(category);
                  }}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Data
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Data Modal */}
      <Dialog open={!!selectedCategory} onOpenChange={handleCloseModal}>
        <DialogContent className="w-[98vw] h-[98vh] max-w-none overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {selectedCategory?.icon}
              {selectedCategory?.title} - Raw Data
            </DialogTitle>
            <DialogDescription>
              Total Records: {rawData.length}
            </DialogDescription>
          </DialogHeader>

          {/* Search Bar */}
          <div className="flex-shrink-0 space-y-2">
            <Input
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? `Showing ${filteredData.length} of ${rawData.length} records` : ''}
            </p>
          </div>

          {/* Data Display */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading data...</p>
                </div>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-muted-foreground text-lg">No data found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    {searchTerm ? 'Try a different search term' : 'No records available for this category'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredData.map((item: any, index: number) => (
                  <Card key={index} className="overflow-hidden">
                    <CardContent className="p-4">
                      <pre className="text-xs overflow-x-auto whitespace-pre-wrap break-words bg-gray-50 p-4 rounded">
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 pt-4 border-t">
            <Button onClick={handleCloseModal} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

