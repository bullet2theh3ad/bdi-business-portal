'use client';

import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function DebugInfo() {
  const { data: user } = useSWR<any>('/api/user', fetcher);
  const { data: team } = useSWR<any>('/api/team', fetcher);

  return (
    <div className="fixed top-20 right-4 z-50 bg-red-100 border-2 border-red-500 p-4 rounded-lg max-w-sm">
      <h3 className="font-bold text-red-800 mb-2">🚨 DEBUG INFO</h3>
      <div className="text-xs space-y-1">
        <div><strong>User ID:</strong> {user?.id || 'null'}</div>
        <div><strong>User Email:</strong> {user?.email || 'null'}</div>
        <div><strong>Team ID:</strong> {team?.id || 'null'}</div>
        <div><strong>Team Name:</strong> {team?.name || 'null'}</div>
        <div><strong>Subscription Status:</strong> {team?.subscriptionStatus || 'null'}</div>
        <div><strong>Plan Name:</strong> {team?.planName || 'null'}</div>
        <div><strong>Stripe Customer ID:</strong> {team?.stripeCustomerId || 'null'}</div>
        <div><strong>Stripe Subscription ID:</strong> {team?.stripeSubscriptionId || 'null'}</div>
        <div><strong>Stripe Product ID:</strong> {team?.stripeProductId || 'null'}</div>
        <div className="mt-2 pt-2 border-t border-red-300">
          <strong>Raw Team Data:</strong>
          <pre className="text-[10px] mt-1 overflow-auto max-h-20">
            {JSON.stringify(team, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
} 