'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CreditCard, Crown } from 'lucide-react';
import { User } from '@/lib/db/schema';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function SubscriptionStatus() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: team } = useSWR<any>('/api/team', fetcher);

  // Debug: Show current subscription status
  console.log('Team subscription status:', team?.subscriptionStatus);
  console.log('Team plan name:', team?.planName);

  if (!user || !team) return null;

  // Only show subscription status to team owners
  if (user.role !== 'owner') return null;

  // Handle different subscription states
  const isActive = team.subscriptionStatus === 'active';
  const isCanceled = team.subscriptionStatus === 'canceled';
  const isIncomplete = team.subscriptionStatus === 'incomplete';
  const isPastDue = team.subscriptionStatus === 'past_due';
  const hasNoSubscription = !team.subscriptionStatus || team.subscriptionStatus === 'inactive';

  // Always show for debugging - remove this later
  // if (isActive) return null;
  
  // Temporary debug display
  if (isActive) {
    return (
      <Card className="mb-6 border-l-4 border-l-green-500 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-green-700">✅ Active Subscription</CardTitle>
          <CardDescription>
            Plan: {team.planName} | Status: {team.subscriptionStatus}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusInfo = () => {
    if (isCanceled) {
      return {
        title: "Subscription Canceled",
        description: "Your subscription has been canceled. Choose a plan to reactivate your account.",
        icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
        buttonText: "Choose New Plan",
        variant: "warning" as const
      };
    }
    
    if (isPastDue) {
      return {
        title: "Payment Failed",
        description: "Your payment failed. Please update your payment method.",
        icon: <CreditCard className="h-5 w-5 text-red-500" />,
        buttonText: "Update Payment",
        variant: "destructive" as const
      };
    }
    
    if (isIncomplete) {
      return {
        title: "Setup Incomplete",
        description: "Complete your subscription setup to access all features.",
        icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
        buttonText: "Complete Setup",
        variant: "warning" as const
      };
    }
    
    // hasNoSubscription or other states
    return {
      title: "No Active Subscription",
      description: "Choose a plan to unlock all WHEELS features for your motorcycle group.",
      icon: <Crown className="h-5 w-5 text-blue-500" />,
      buttonText: "Choose Plan",
      variant: "default" as const
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <Card className={`mb-6 border-l-4 ${
      statusInfo.variant === 'destructive' ? 'border-l-red-500 bg-red-50' :
      statusInfo.variant === 'warning' ? 'border-l-orange-500 bg-orange-50' :
      'border-l-blue-500 bg-blue-50'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          {statusInfo.icon}
          <CardTitle className="text-lg">{statusInfo.title}</CardTitle>
        </div>
        <CardDescription className="text-sm">
          {statusInfo.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-3">
          <Button asChild size="sm">
            <Link href="/pricing">
              {statusInfo.buttonText}
            </Link>
          </Button>
          {team.stripeCustomerId && isActive && (
            <Button asChild variant="outline" size="sm">
              <Link href="/api/stripe/portal" target="_blank">
                Manage Billing
              </Link>
            </Button>
          )}
        </div>
        
        {/* Temporary debug info - remove in production */}
        <div className="mt-3 p-2 bg-gray-100 rounded text-xs">
          <strong>Debug Info:</strong><br />
          Status: {team.subscriptionStatus || 'null'}<br />
          Plan: {team.planName || 'null'}<br />
          Customer ID: {team.stripeCustomerId || 'null'}<br />
          Subscription ID: {team.stripeSubscriptionId || 'null'}
        </div>
      </CardContent>
    </Card>
  );
} 