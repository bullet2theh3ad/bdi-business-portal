'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { withTeam } from '@/lib/auth/middleware';

export const checkoutAction = withTeam(async (formData, team) => {
  const priceId = formData.get('priceId') as string;
  const riderCount = parseInt(formData.get('riderCount') as string) || 1;
  const riderPriceId = formData.get('riderPriceId') as string;
  
  // Debug logging
  console.log('=== CHECKOUT DEBUG ===');
  console.log('Base Plan Price ID:', priceId);
  console.log('Rider Count (total):', riderCount);
  console.log('Additional Riders:', Math.max(0, riderCount - 1));
  console.log('Rider Price ID:', riderPriceId);
  console.log('Team:', team?.id, team?.name);
  
  await createCheckoutSession({ 
    team: team, 
    priceId,
    riderCount: Math.max(0, riderCount - 1), // Subtract 1 for admin
    riderPriceId 
  });
});

export const customerPortalAction = withTeam(async (_, team) => {
  const portalSession = await createCustomerPortalSession(team);
  redirect(portalSession.url);
});
