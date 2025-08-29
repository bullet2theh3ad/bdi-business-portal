import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { teamMembers, teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { additionalRiders } = await request.json();
    
    if (!additionalRiders || additionalRiders <= 0) {
      return NextResponse.json({ error: 'Invalid rider count' }, { status: 400 });
    }

    // Get user's team
    const userTeam = await db
      .select({
        teamId: teamMembers.teamId,
      })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id))
      .limit(1);

    if (userTeam.length === 0) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get team data including subscription info
    const team = await db
      .select()
      .from(teams)
      .where(eq(teams.id, userTeam[0].teamId))
      .limit(1);

    if (team.length === 0 || !team[0].stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
    }

    const teamData = team[0];

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(teamData.stripeSubscriptionId!);

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found in Stripe' }, { status: 404 });
    }

    // TODO: For now, just update the database directly for testing
    // In production, you'd want to update the Stripe subscription first
    console.log(`🎯 Adding ${additionalRiders} riders to team ${teamData.id}`);
    console.log(`💳 Stripe subscription ID: ${teamData.stripeSubscriptionId}`);
    
    // Check if rider add-on already exists
    let riderItem = subscription.items.data.find(item => 
      item.price.id === 'price_1Rop24B7PQZuchfzQ7nZHctO' || // monthly rider price
      item.price.id === 'price_1Rop2cB7PQZuchfz0DvCHBvE'    // yearly rider price
    );

    const riderPriceId = 'price_1Rop24B7PQZuchfzQ7nZHctO'; // Default to monthly for now

    console.log(`🔍 Current rider item:`, riderItem ? 'Found' : 'Not found');
    
    // TODO: Uncomment for production Stripe integration
    /*
    if (riderItem) {
      // Update existing rider item
      await stripe.subscriptionItems.update(riderItem.id, {
        quantity: (riderItem.quantity || 0) + additionalRiders,
      });
    } else {
      // Add new rider item to subscription
      await stripe.subscriptionItems.create({
        subscription: subscription.id,
        price: riderPriceId,
        quantity: additionalRiders,
      });
    }
    */

    // Update team's rider limit in database
    const newPurchasedSlots = (teamData.purchasedRiderSlots || 0) + additionalRiders;
    
    await db
      .update(teams)
      .set({
        purchasedRiderSlots: newPurchasedSlots,
        updatedAt: new Date(),
      })
      .where(eq(teams.id, teamData.id));

    // Calculate expected new total (for response only - DB will compute this automatically)
    const expectedNewTotal = (teamData.baseRiderLimit || 1) + newPurchasedSlots;

    return NextResponse.json({ 
      success: true, 
      message: `Successfully added ${additionalRiders} rider slot${additionalRiders > 1 ? 's' : ''}`,
      newRiderLimit: expectedNewTotal 
    });

  } catch (error) {
    console.error('Error adding riders:', error);
    return NextResponse.json(
      { error: 'Failed to add riders to subscription' },
      { status: 500 }
    );
  }
}
