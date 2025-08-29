'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { Team } from '@/lib/db/schema';

interface LicenseDashboardProps {
  team: Team & {
    teamMembers?: any[];
  };
}

export function LicenseDashboard({ team }: LicenseDashboardProps) {
  // Calculate rider usage
  const baseRiderLimit = team.baseRiderLimit || 1;
  const purchasedRiderSlots = team.purchasedRiderSlots || 0;
  const totalRiderLimit = team.totalRiderLimit || (baseRiderLimit + purchasedRiderSlots);
  const usedSlots = team.teamMembers?.length || 0;
  const availableSlots = Math.max(0, totalRiderLimit - usedSlots);

  // Debug logging (remove in production)
  // console.log('🔍 License Dashboard Debug:', { baseRiderLimit, purchasedRiderSlots, totalRiderLimit, usedSlots });
  
  // Calculate pricing (using the pricing from your existing pricing page)
  const RIDER_PRICE_MONTHLY = 0.49; // $0.49 per additional rider per month
  const monthlyRiderCost = purchasedRiderSlots * RIDER_PRICE_MONTHLY;
  
  // Get base plan pricing
  const getBasePlanPrice = () => {
    if (!team.planName) return 0;
    if (team.planName.includes('Rider')) return 4.99;
    if (team.planName.includes('Team')) return 7.99;
    if (team.planName.includes('Club')) return 14.99;
    return 0;
  };
  
  const basePlanPrice = getBasePlanPrice();
  const totalMonthlyCost = basePlanPrice + monthlyRiderCost;
  
  // Status indicators
  const isOverLimit = usedSlots > totalRiderLimit;
  const isNearLimit = usedSlots >= totalRiderLimit * 0.8 && !isOverLimit;
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Team License Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Info */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium">{team.planName || 'No Plan'}</p>
            <p className="text-sm text-gray-600">
              Status: {' '}
              <Badge variant={team.subscriptionStatus === 'active' ? 'default' : 'secondary'}>
                {team.subscriptionStatus === 'active' ? (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {team.subscriptionStatus || 'Inactive'}
                  </>
                )}
              </Badge>
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">${totalMonthlyCost.toFixed(2)}/month</p>
            <p className="text-xs text-gray-500">Current billing</p>
          </div>
        </div>
        
        {/* Rider Allocation */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Rider Allocation
            </h4>
            <Badge 
              variant={isOverLimit ? 'destructive' : isNearLimit ? 'secondary' : 'default'}
            >
              {usedSlots} / {totalRiderLimit} riders
            </Badge>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${
                isOverLimit ? 'bg-red-500' : 
                isNearLimit ? 'bg-yellow-500' : 
                'bg-blue-500'
              }`}
              style={{ 
                width: `${Math.min(100, (usedSlots / totalRiderLimit) * 100)}%` 
              }}
            />
          </div>
          
          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-gray-600">Base Plan Includes</p>
              <p className="font-semibold">{baseRiderLimit} rider</p>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <p className="text-gray-600">Additional Purchased</p>
              <p className="font-semibold">{purchasedRiderSlots} riders</p>
            </div>
            <div className="p-2 bg-purple-50 rounded">
              <p className="text-gray-600">Available Slots</p>
              <p className="font-semibold text-purple-600">{availableSlots} remaining</p>
            </div>
          </div>
        </div>
        
        {/* Cost Breakdown */}
        <div className="border-t pt-3">
          <h4 className="font-medium mb-2">Monthly Cost Breakdown</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Base Plan ({team.planName})</span>
              <span>${basePlanPrice.toFixed(2)}</span>
            </div>
            {purchasedRiderSlots > 0 && (
              <div className="flex justify-between">
                <span>Additional Riders ({purchasedRiderSlots} × ${RIDER_PRICE_MONTHLY})</span>
                <span>${monthlyRiderCost.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Total Monthly</span>
              <span>${totalMonthlyCost.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Status Messages */}
        {isOverLimit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              ⚠️ You are over your rider limit! Please purchase additional rider slots or remove team members.
            </p>
          </div>
        )}
        
        {isNearLimit && !isOverLimit && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              📢 You're near your rider limit. Consider purchasing additional slots.
            </p>
          </div>
        )}
        
        {availableSlots > 0 && !isNearLimit && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">
              ✅ You have {availableSlots} available rider slot{availableSlots !== 1 ? 's' : ''}.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
