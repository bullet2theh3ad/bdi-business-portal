import { desc, and, eq, isNull, sql, ne } from 'drizzle-orm';
import { db } from './drizzle';
import { 
  activityLogs, 
  teamMembers, 
  teams, 
  users, 
  invitations, 
  groups, 
  groupMembers,
  organizations,
  organizationMembers
} from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'string' // UUID from Supabase auth.users
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  // For BDI Portal, we'll look up by email since we don't use riderId
  const userEmail = sessionData.user.email;
  
  if (!userEmail) {
    return null;
  }
  
  // Query the actual users table to get real user data
  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.email, userEmail), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    console.log(`❌ No user found with email "${userEmail}"`);
    return null;
  }

  const foundUser = user[0];
  console.log(`✅ Found user: ${foundUser.email}`);
  
  return foundUser;
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function updateTeamRiderLimits(
  teamId: number,
  riderData: {
    baseRiderLimit: number;
    purchasedRiderSlots: number;
    totalRiderLimit: number;
  }
) {
  await db
    .update(teams)
    .set({
      baseRiderLimit: riderData.baseRiderLimit,
      purchasedRiderSlots: riderData.purchasedRiderSlots,
      totalRiderLimit: riderData.totalRiderLimit,
      updatedAt: new Date()
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      team: {
        id: teams.id,
        name: teams.name,
        createdAt: teams.createdAt
      }
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  // 🔄 MIGRATION: Re-enabling activity logs with proper user lookup
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id)) // user.id is integer from users table
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser() {
  // 🔄 MIGRATION: Re-enabling team function with proper user lookup
  const user = await getUser();
  if (!user) {
    return null;
  }

  const result = await db.query.teamMembers.findFirst({
    where: eq(teamMembers.userId, user.id), // user.id is integer from users table
    with: {
      team: {
        columns: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripeProductId: true,
          planName: true,
          subscriptionStatus: true,
          baseRiderLimit: true,
          purchasedRiderSlots: true,
          totalRiderLimit: true,
          homeLocationName: true,
          homeLatitude: true,
          homeLongitude: true
        },
        with: {
          teamMembers: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  email: true,
                  riderId: true,
                  avatarUrl: true,
                  phone: true,
                  teamDisplayName: true,
                  emergencyContactName: true,
                  emergencyContactEmail: true,
                  emergencyContactPhone: true,
                  allergies: true
                }
              }
            }
          }
        }
      }
    }
  });

  return result?.team || null;
}

export async function getTeamInvitations(teamId: number) {
  return await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      status: invitations.status,
      invitedAt: invitations.invitedAt,
      invitedBy: invitations.invitedBy,
      inviterName: users.name,
      inviterEmail: users.email
    })
    .from(invitations)
    .leftJoin(users, eq(invitations.invitedBy, users.id))
    .where(eq(invitations.teamId, teamId))
    .orderBy(desc(invitations.invitedAt));
}

export async function deleteInvitation(invitationId: number, teamId: number) {
  return await db
    .delete(invitations)
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.teamId, teamId)
      )
    );
}

export async function getTeamGroups(teamId: number) {
  return await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
      createdBy: groups.createdBy,
      creatorName: users.name,
      creatorEmail: users.email
    })
    .from(groups)
    .leftJoin(users, eq(groups.createdBy, users.id))
    .orderBy(groups.createdAt);
}

export async function getTeamGroupsWithMemberCounts(teamId: number) {
  const groupsResult = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
      createdBy: groups.createdBy,
      creatorName: users.name,
      creatorEmail: users.email
    })
    .from(groups)
    .leftJoin(users, eq(groups.createdBy, users.id))
    .orderBy(groups.createdAt);

  // Get member counts for each group
  const groupsWithCounts = await Promise.all(
    groupsResult.map(async (group) => {
      const memberCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id));
      
      return {
        ...group,
        memberCount: memberCount[0]?.count || 0
      };
    })
  );

  return groupsWithCounts;
}

export async function getGroupMembers(groupId: number) {
  return await db
    .select({
      id: groupMembers.id,
      userId: groupMembers.userId,
      assignedAt: groupMembers.assignedAt,
      assignedBy: groupMembers.assignedBy,
      userName: users.name,
      userEmail: users.email,
      userRole: teamMembers.role
    })
    .from(groupMembers)
    .leftJoin(users, eq(groupMembers.userId, users.id))
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(groupMembers.assignedAt);
}

export async function addUserToGroup(groupId: number, userId: number, assignedBy: number) {
  return await db.insert(groupMembers).values({
    groupId,
    userId,
    assignedBy
  });
}

export async function removeUserFromGroup(groupId: number, userId: number) {
  return await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, userId)
      )
    );
}

export async function getTeamMembersNotInGroup(teamId: number, groupId: number) {
  // Get all team members
  const allTeamMembers = await db
    .select({
      userId: teamMembers.userId,
      userName: users.name,
      userEmail: users.email,
      role: teamMembers.role
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));

  // Get current group members
  const groupMembers = await db
    .select({
      userId: groupMembers.userId
    })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));

  const groupMemberIds = new Set(groupMembers.map(m => m.userId));
  
  // Filter out users already in the group
  return allTeamMembers.filter(member => !groupMemberIds.has(member.userId));
}

export async function createGroup(groupData: {
  name: string;
  description?: string;
  type?: string;
  createdBy: number;
}) {
  return await db.insert(groups).values({
    name: groupData.name,
    description: groupData.description,
    type: groupData.type || 'project',
    createdBy: groupData.createdBy
  }).returning();
}

export async function updateGroup(groupId: number, groupData: {
  name?: string;
  description?: string;
  type?: string;
}) {
  return await db
    .update(groups)
    .set(groupData)
    .where(eq(groups.id, groupId));
}

export async function deleteGroup(groupId: number) {
  // First delete all group memberships (cascade should handle this, but being explicit)
  await db
    .delete(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  
  // Then delete the group
  return await db
    .delete(groups)
    .where(eq(groups.id, groupId));
}

export async function checkGroupNameExists(name: string, excludeGroupId?: number) {
  let whereConditions = [
    eq(groups.name, name)
  ];

  if (excludeGroupId) {
    whereConditions.push(ne(groups.id, excludeGroupId));
  }

  const result = await db
    .select({ id: groups.id })
    .from(groups)
    .where(and(...whereConditions))
    .limit(1);

  return result.length > 0;
}

export async function getUserGroups(userId: number) {
  return await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      assignedAt: groupMembers.assignedAt
    })
    .from(groupMembers)
    .leftJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .orderBy(groups.name);
}
