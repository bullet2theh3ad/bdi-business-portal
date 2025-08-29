import { NextRequest, NextResponse } from 'next/server';
import { getUser, getUserGroups, getUserWithTeam } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userWithTeam = await getUserWithTeam(user.id);
    
    if (!userWithTeam?.teamId) {
      return NextResponse.json({ error: 'User is not part of a team' }, { status: 400 });
    }

    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.userId);
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const userGroups = await getUserGroups(userId, userWithTeam.teamId);
    
    return NextResponse.json(userGroups);
    
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
