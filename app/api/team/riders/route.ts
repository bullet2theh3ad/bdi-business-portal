import { NextRequest, NextResponse } from 'next/server';
import { getUser, getTeamForUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  try {
    // Get current authenticated user
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Get user's team with all members
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'User not part of any team' }, { status: 404 });
    }

    // 🎯 TEAM MAP FIX: ALL users can see ALL team members (social feature!)
    // Only restrict data access (rides/analytics), not team visibility

    // Return all team members for everyone (social feature!)
    const riders = team.teamMembers?.map((member: any) => ({
      userId: member.user.id,
      name: member.user.name || member.user.email,
      email: member.user.email,
      riderId: member.user.riderId, // This will be null if not set yet
      role: member.role,
      isCurrentUser: member.user.id === user.id,
      avatarUrl: member.user.avatarUrl || null,
      emergencyContactName: member.user.emergencyContactName || null,
      emergencyContactEmail: member.user.emergencyContactEmail || null,
      emergencyContactPhone: member.user.emergencyContactPhone || null,
      allergies: member.user.allergies || null
    })) || [];

    console.log('👑 OWNER TEAM VIEW:', {
      teamName: team.name,
      totalMembers: riders.length,
      ridersWithIds: riders.filter(r => r.riderId).length,
      riderIds: riders.map(r => r.riderId)
    });
    
    return NextResponse.json({
      riders: riders, // Return all team members for everyone (social feature!)
      isOwner: user.role === 'owner',
      teamName: team.name
    });
  } catch (error) {
    console.error('Error fetching team riders:', error);
    return NextResponse.json({ error: 'Failed to fetch team riders' }, { status: 500 });
  }
} 