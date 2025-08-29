import { NextRequest } from 'next/server';
import { customerPortalAction } from '@/lib/payments/actions';

export async function GET(request: NextRequest) {
  try {
    // Create a FormData object (even though we don't need form data for this action)
    const formData = new FormData();
    
    // Call the customer portal action which will redirect
    await customerPortalAction(formData);
    
    // This won't be reached due to redirect, but TypeScript needs a return
    return new Response('Redirecting...', { status: 302 });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return new Response('Error creating portal session', { status: 500 });
  }
} 