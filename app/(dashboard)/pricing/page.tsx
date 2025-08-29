'use client';

import { checkoutAction } from '@/lib/payments/actions';
import { Check, Crown } from 'lucide-react';
import { SubmitButton } from './submit-button';
import { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  
  // Single rider count that applies to all plans for easy comparison
  const [globalRiderCount, setGlobalRiderCount] = useState(2); // Default to 2 for better comparison

  // Get current team/subscription data
  const { data: team } = useSWR<any>('/api/team', fetcher);
  
  // Determine current plan and billing interval
  const getCurrentPlanInfo = () => {
    if (!team?.planName) return { planName: null, interval: null };
    
    // Extract plan name and interval from Stripe plan name
    // e.g., "Rider (monthly)" -> { planName: "Rider", interval: "monthly" }
    // e.g., "Team (yearly)" -> { planName: "Team", interval: "yearly" }
    const planName = team.planName.split(' ')[0]; // Gets "Rider", "Team", or "Club"
    const intervalMatch = team.planName.match(/\((monthly|yearly)\)/);
    const interval = intervalMatch ? intervalMatch[1] : null;
    
    return { planName, interval };
  };
  
  const currentPlanInfo = getCurrentPlanInfo();
  const isCurrentPlanActive = team?.subscriptionStatus === 'active' || team?.subscriptionStatus === 'trialing';
  
  // Helper function to check if a plan is the current plan
  const isCurrentPlan = (planName: string) => {
    if (!isCurrentPlanActive || !currentPlanInfo.planName) return false;
    
    const currentInterval = currentPlanInfo.interval === 'yearly' ? true : false;
    const matchesPlan = currentPlanInfo.planName === planName;
    const matchesInterval = currentInterval === isYearly;
    
    return matchesPlan && matchesInterval;
  };

  const RIDER_PRICE_MONTHLY = 49; // $0.49 in cents
  const RIDER_PRICE_YEARLY = 499; // $4.99 in cents (yearly discount)
  
  // TODO: Replace with your actual Stripe price IDs
  const RIDER_PRICE_ID_MONTHLY = "price_1Rop24B7PQZuchfzQ7nZHctO"; // Replace with real ID
  const RIDER_PRICE_ID_YEARLY = "price_1Rop2cB7PQZuchfz0DvCHBvE";   // Replace with real ID

  // Update the global rider count (applies to all plans)
  const updateRiderCount = (count: number) => {
    setGlobalRiderCount(Math.max(1, count)); // Minimum 1 rider (admin)
  };

  const plans = [
    {
      name: "Rider", 
      monthlyPrice: 499, // $4.99/month
      yearlyPrice: 4999, // $49.99/year (20% discount)
      monthlyPriceId: "price_1RomqaB7PQZuchfzuBE2FwqZ",
      yearlyPriceId: "price_1Romr8B7PQZuchfzx6czLUSf",
      features: [
        'Real-time Telemetry',
        'Basic Safety Analysis', 
        'GPS Tracking',
        'Email Support',
      ]
    },
    {
      name: "Team",
      monthlyPrice: 799, // $7.99/month - MATCHES YOUR BILLING SYSTEM ✅
      yearlyPrice: 7999, // $79.99/year (20% discount)
      monthlyPriceId: "price_1RomraB7PQZuchfzAa5ucBIC", // Your actual Team price ID
      yearlyPriceId: "price_1RomrwB7PQZuchfzad0R29L4",
      features: [
        'Everything in Rider, and:',
        'Advanced AI Safety Analysis',
        'Fall Detection & Alerts', 
        'Weather Integration',
        'Priority Support',
        'Team Management Dashboard',
        'Rider Allocation System',
      ],
      highlighted: true
    },
    {
      name: "Club",
      monthlyPrice: 1499, // $14.99/month
      yearlyPrice: 14999, // $149.99/year (20% discount)
      monthlyPriceId: "price_1RomsPB7PQZuchfzamRW8sVX",
      yearlyPriceId: "price_1RomskB7PQZuchfzoy0mspxw",
      features: [
        'Everything in Team, and:',
        'Emergency Response System',
        'Live Location Sharing',
        'Advanced Analytics',
        '24/7 Phone Support',
        'Custom Integrations',
      ]
    }
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Per-Rider Explanation */}
                <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Pricing for Motorcycle Groups
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Each plan includes the admin/owner (who can also ride). Team members can be added for just{' '}
              <span className="font-semibold text-orange-500">
                ${RIDER_PRICE_MONTHLY / 100}/month
              </span>{' '}
              each (or ${(RIDER_PRICE_YEARLY / 100).toFixed(2)}/year when billed annually).
            </p>
            
            {/* Current Plan Info */}
            {currentPlanInfo.planName && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-lg mx-auto">
                <div className="text-center mb-3">
                  <p className="text-sm text-blue-800">
                    <strong>Current Plan:</strong> {currentPlanInfo.planName} ({currentPlanInfo.interval}) 
                    <br />
                    <strong>Status:</strong> {team?.subscriptionStatus}
                  </p>
                </div>
                
                {/* Current Billing Breakdown - Matches Team Settings */}
                {team?.totalRiderLimit && (
                  <div className="bg-white p-3 rounded border border-blue-200 mb-3">
                    <div className="text-xs text-blue-700 font-medium mb-2">Current Billing</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Base Plan ({team?.planName})</span>
                        <span>${((team?.planName?.includes('Team') ? 799 : team?.planName?.includes('Club') ? 1499 : 499) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Additional Riders ({team?.purchasedRiderSlots || 0} × $0.49)</span>
                        <span>${((team?.purchasedRiderSlots || 0) * 0.49).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total Monthly</span>
                        <span>${(((team?.planName?.includes('Team') ? 799 : team?.planName?.includes('Club') ? 1499 : 499) / 100) + ((team?.purchasedRiderSlots || 0) * 0.49)).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-blue-600 mt-2">
                      {team?.teamMembers?.length || 0} / {team?.totalRiderLimit} riders used
                    </div>
                  </div>
                )}
                
                {/* Rider Count Selector for Comparison */}
                <div className="border-t border-blue-200 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800">Compare with:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateRiderCount(globalRiderCount - 1)}
                        disabled={globalRiderCount <= 1}
                        className="w-6 h-6 rounded-full border border-blue-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-100 text-xs text-blue-800"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-medium font-mono text-blue-800">{globalRiderCount}</span>
                      <button
                        onClick={() => updateRiderCount(globalRiderCount + 1)}
                        className="w-6 h-6 rounded-full border border-blue-300 flex items-center justify-center hover:bg-blue-100 text-xs text-blue-800"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">
                    See pricing for {globalRiderCount} rider{globalRiderCount !== 1 ? 's' : ''} total
                  </p>
                </div>
              </div>
            )}
            
            {/* For users without a plan */}
            {!currentPlanInfo.planName && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg max-w-md mx-auto">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">Team size for comparison:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateRiderCount(globalRiderCount - 1)}
                      disabled={globalRiderCount <= 1}
                      className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 text-xs text-gray-800"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-medium font-mono text-gray-800">{globalRiderCount}</span>
                    <button
                      onClick={() => updateRiderCount(globalRiderCount + 1)}
                      className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 text-xs text-gray-800"
                    >
                      +
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Compare pricing for {globalRiderCount} rider{globalRiderCount !== 1 ? 's' : ''} total
                </p>
              </div>
            )}
          </div>

      {/* Billing Toggle */}
      <div className="flex justify-center items-center gap-4 mb-12">
        <div className="bg-gray-100 p-1 rounded-lg flex items-center">
          <button
            onClick={() => setIsYearly(false)}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              !isYearly 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsYearly(true)}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              isYearly 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly
          </button>
        </div>
        {/* Discount Badge */}
        <span className="bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium">
          Save Yearly
        </span>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <PricingCard
            key={plan.name}
            name={plan.name}
            price={isYearly ? plan.yearlyPrice : plan.monthlyPrice}
            monthlyPrice={plan.monthlyPrice}
            interval={isYearly ? "year" : "month"}
            priceId={isYearly ? plan.yearlyPriceId : plan.monthlyPriceId}
            features={plan.features}
            highlighted={plan.highlighted}
            isYearly={isYearly}
            riderCount={isCurrentPlan(plan.name) ? (team?.totalRiderLimit || globalRiderCount) : globalRiderCount}
            riderPrice={isYearly ? RIDER_PRICE_YEARLY : RIDER_PRICE_MONTHLY}
            riderPriceId={isYearly ? RIDER_PRICE_ID_YEARLY : RIDER_PRICE_ID_MONTHLY}
            isCurrentPlan={isCurrentPlan(plan.name)}
            team={team}
          />
        ))}
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  monthlyPrice,
  interval,
  features,
  priceId,
  highlighted = false,
  isYearly = false,
  riderCount,
  riderPrice,
  riderPriceId,
  isCurrentPlan = false,
  team,
}: {
  name: string;
  price: number;
  monthlyPrice: number;
  interval: string;
  features: string[];
  priceId?: string;
  highlighted?: boolean;
  isYearly?: boolean;
  riderCount: number;
  riderPrice: number;
  riderPriceId: string;
  isCurrentPlan?: boolean;
  team?: any;
}) {
  // For current plan, use actual team data; for others, use comparison count
  let actualRiderCount = riderCount;
  let actualAdditionalRiders = Math.max(0, riderCount - 1);
  let actualRiderCost = actualAdditionalRiders * riderPrice;
  
  if (isCurrentPlan && team) {
    // Use actual team data for current plan pricing
    actualRiderCount = team.totalRiderLimit || riderCount;
    actualAdditionalRiders = team.purchasedRiderSlots || 0;
    // Convert to monthly pricing if showing monthly
    const monthlyRiderPrice = isYearly ? riderPrice / 12 : (riderPrice / 100); // Convert cents to dollars
    actualRiderCost = actualAdditionalRiders * (isYearly ? riderPrice : 49); // 49 cents monthly
  }
  
  const totalPrice = price + actualRiderCost;

  return (
    <div className={`relative border rounded-lg p-4 md:p-6 h-full flex flex-col w-full max-w-[320px] md:max-w-[380px] mx-auto ${
      isCurrentPlan 
        ? 'border-green-400 bg-green-50 shadow-lg border-2' :
      highlighted 
        ? 'border-orange-500 bg-orange-50 shadow-lg' 
        : 'border-gray-200 bg-white shadow-sm'
    }`}>
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
            <Crown className="h-3 w-3" />
            Current Plan
          </span>
        </div>
      )}
      {highlighted && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">
            Most Popular
          </span>
        </div>
      )}
      
      <div className="flex-1">
        <h2 className="text-2xl font-medium text-gray-900 mb-2">{name}</h2>
        <p className="text-sm text-gray-600 mb-4">
          with 14 day free trial
        </p>
        <p className="text-xs text-gray-500 mb-4">
          💡 Admin/Owner included in base plan and can also ride
        </p>
        {isCurrentPlan && team && (
          <div className="mb-4 p-2 bg-green-100 border border-green-200 rounded text-xs">
            <div className="flex justify-between items-center">
              <span className="text-green-700">Current Usage:</span>
              <span className="font-medium text-green-800">
                {team.teamMembers?.length || 0} / {team.totalRiderLimit} riders
              </span>
            </div>
          </div>
        )}
        
        {/* Pricing Breakdown */}
        <div className="mb-6 p-3 md:p-4 bg-gray-50 rounded-lg border">
          <div className="space-y-3">
            {/* Base Price */}
            <div className="flex justify-between items-start">
              <span className="text-[10px] md:text-sm text-gray-600">Admin/Owner (included):</span>
              <div className="text-right w-[90px] md:w-[120px] font-mono">
                {isYearly ? (
                  <div className="flex flex-col md:flex-row md:items-center">
                    <span className="line-through text-gray-400 text-[10px] md:text-sm">
                      ${monthlyPrice / 100}
                    </span>
                    <span className="font-medium text-[10px] md:text-base md:ml-2">
                      ${price / 100}/yr
                    </span>
                  </div>
                ) : (
                  <span className="font-medium text-[10px] md:text-base">
                    ${price / 100}/{interval}
                  </span>
                )}
              </div>
            </div>

            {/* Additional Riders Cost - Always show */}
            <div className="flex justify-between items-start gap-1 md:gap-2">
              <span className="text-[10px] md:text-sm text-gray-600 flex-1 leading-tight">
                {isCurrentPlan && team ? 
                  `Additional Riders (${actualAdditionalRiders} × $0.49):` :
                  `Team members (${actualAdditionalRiders} × ${(riderPrice / 100).toFixed(2)}):`
                }
              </span>
              <div className="text-right w-[70px] md:w-[80px] font-mono">
                <span className="font-medium text-[10px] md:text-sm">
                  {isCurrentPlan && team ? 
                    `$${(actualAdditionalRiders * 0.49).toFixed(2)}/${isYearly ? 'yr' : 'month'}` :
                    `$${(actualRiderCost / 100).toFixed(2)}/${isYearly ? 'yr' : interval}`
                  }
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900 text-xs md:text-base">Total:</span>
                <div className="text-right w-[110px] md:w-[140px] font-mono">
                  <span className="text-sm md:text-xl font-bold text-gray-900">
                    ${(totalPrice / 100).toFixed(2)}/{isYearly ? 'yr' : interval}
                  </span>
                </div>
              </div>
              <div className="min-h-[20px]">
                {isYearly && (
                  <p className="text-[10px] md:text-xs text-gray-500 text-right mt-1">
                    billed annually
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <ul className="space-y-4 mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700">{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      
      <form action={checkoutAction} className="mt-auto">
        <input type="hidden" name="priceId" value={priceId} />
        <input type="hidden" name="riderCount" value={actualRiderCount} />
        <input type="hidden" name="riderPriceId" value={riderPriceId} />
        <SubmitButton isCurrentPlan={isCurrentPlan} />
      </form>
    </div>
  );
}
