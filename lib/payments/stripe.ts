import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  updateTeamSubscription,
  updateTeamRiderLimits
} from '@/lib/db/queries';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil'
});

export async function createCheckoutSession({
  team,
  priceId,
  riderCount = 0,
  riderPriceId
}: {
  team: Team | null;
  priceId: string;
  riderCount?: number;
  riderPriceId?: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  // Build line items - always include base plan
  const lineItems = [
    {
      price: priceId,
      quantity: 1
    }
  ];

  // Add rider line item if there are additional riders
  if (riderCount > 0 && riderPriceId) {
    lineItems.push({
      price: riderPriceId,
      quantity: riderCount
    });
  }

  // Debug logging
  console.log('=== STRIPE SESSION DEBUG ===');
  console.log('Line Items:', JSON.stringify(lineItems, null, 2));
  console.log('Customer ID:', team.stripeCustomerId);
  console.log('Base Price ID valid?:', priceId && priceId.startsWith('price_'));
  console.log('Rider Price ID valid?:', riderPriceId && riderPriceId.startsWith('price_'));

  // Validation
  if (!priceId || !priceId.startsWith('price_')) {
    throw new Error(`Invalid base plan price ID: ${priceId}. Must start with 'price_'`);
  }
  
  if (riderCount > 0 && (!riderPriceId || !riderPriceId.startsWith('price_'))) {
    throw new Error(`Invalid rider price ID: ${riderPriceId}. Must start with 'price_'`);
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: 14
    }
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(team: Team) {
  if (!team.stripeCustomerId || !team.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await stripe.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await stripe.products.retrieve(team.stripeProductId);
    if (!product.active) {
      throw new Error("Team's product is not active in Stripe");
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the team's product");
    }

    configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        },
        payment_method_update: {
          enabled: true
        }
      }
    });
  }

  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'active' || status === 'trialing') {
    const plan = subscription.items.data[0]?.plan;
    
    // Parse rider count from subscription items
    let basePlanQuantity = 1;
    let additionalRiders = 0;
    
    // Look through all subscription items to find base plan and rider add-ons
    for (const item of subscription.items.data) {
      const product = item.plan.product as string;
      const quantity = item.quantity || 0;
      
      // Check if this is a rider add-on (you'll need to identify your rider price IDs)
      if (item.plan.id.includes('rider') || 
          (item.plan.metadata && item.plan.metadata.type === 'rider')) {
        additionalRiders += quantity;
      }
      // If it's the base plan, get the quantity (usually 1)
      else {
        basePlanQuantity = quantity;
      }
    }
    
    // Calculate total rider limit
    const baseRiderLimit = basePlanQuantity; // Base plan includes 1 rider
    const totalRiderLimit = baseRiderLimit + additionalRiders;
    
    console.log('🔄 Stripe Webhook - Updating rider limits:', {
      customerId,
      baseRiderLimit,
      additionalRiders,
      totalRiderLimit,
      subscriptionItems: subscription.items.data.map(item => ({
        priceId: item.plan.id,
        quantity: item.quantity,
        product: item.plan.product
      }))
    });

    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: plan?.product as string,
      planName: (plan?.product as Stripe.Product).name,
      subscriptionStatus: status
    });
    
    // Update rider limits in database
    await updateTeamRiderLimits(team.id, {
      baseRiderLimit,
      purchasedRiderSlots: additionalRiders,
      totalRiderLimit
    });
  } else if (status === 'canceled' || status === 'unpaid') {
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status
    });
  }
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring'
  });

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price']
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}
