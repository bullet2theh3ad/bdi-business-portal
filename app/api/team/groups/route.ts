import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { getTeamGroupsWithMemberCounts, getUserWithTeam } from '@/lib/db/queries';

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

    const groups = await getTeamGroupsWithMemberCounts(userWithTeam.teamId);
    
    return NextResponse.json(groups);
    
  } catch (error) {
    console.error('Error fetching team groups:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
