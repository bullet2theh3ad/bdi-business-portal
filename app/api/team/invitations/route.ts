import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getTeamInvitations, getUserWithTeam } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'User is not part of a team' }, { status: 400 });
    }

    // All team members can view invitations (but only owners can create them)
    // This allows members to see pending team invitations for transparency

    const invitations = await getTeamInvitations(userWithTeam.teamId);
    
    return NextResponse.json(invitations);
    
  } catch (error) {
    console.error('Error fetching team invitations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
