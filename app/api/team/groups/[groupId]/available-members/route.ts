import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamMembersNotInGroup, getUserWithTeam } from '@/lib/db/queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
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
    const groupId = parseInt(resolvedParams.groupId);
    if (isNaN(groupId)) {
      return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
    }

    const availableMembers = await getTeamMembersNotInGroup(userWithTeam.teamId, groupId);
    
    return NextResponse.json(availableMembers);
    
  } catch (error) {
    console.error('Error fetching available members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
