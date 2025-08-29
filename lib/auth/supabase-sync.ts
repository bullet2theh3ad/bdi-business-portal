import { createClient } from '@supabase/supabase-js';

// Create admin client for user management (optional - only if env vars are set)
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY 
  ? createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  : null;

export interface CreateSupabaseUserParams {
  email: string;
  password: string;
  riderId: string; // rider_id from our users table (stored in metadata)
  name?: string;
}

/**
 * Creates a user in Supabase Auth to sync with our custom users table
 * Option 1: Generate proper UUID and store rider_id in metadata
 */
export async function createSupabaseAuthUser({
  email,
  password,
  riderId,
  name
}: CreateSupabaseUserParams) {
  // Skip Supabase sync if not configured
  if (!supabaseAdmin) {
    console.log(`⚠️ SYNC: Skipping Supabase sync for ${email} - Supabase not configured`);
    return { user: null, session: null };
  }

  try {
    console.log(`🔄 SYNC: Creating Supabase Auth user for ${email} with rider_id ${riderId}`);
    
    // Create user in Supabase Auth - let Supabase generate proper UUID
    // Store our custom rider_id in metadata for mobile app linking
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: name || null,
        rider_id: riderId, // Store custom rider_id in metadata
        created_via: 'web_app_sync'
      }
    });

    if (error) {
      console.error(`❌ SYNC: Failed to create Supabase user for ${email}:`, error);
      throw error;
    }

    console.log(`✅ SYNC: Successfully created Supabase Auth user for ${email}`);
    console.log(`    Supabase UUID: ${data.user?.id}`);
    console.log(`    Custom rider_id: ${riderId} (stored in metadata)`);
    return data;

  } catch (error) {
    console.error(`💥 SYNC: Exception creating Supabase user for ${email}:`, error);
    throw error;
  }
}

/**
 * Updates a user's password in Supabase Auth
 */
export async function updateSupabaseAuthUserPassword(userId: string, newPassword: string) {
  // Skip Supabase update if not configured
  if (!supabaseAdmin) {
    console.log(`⚠️ SYNC: Skipping Supabase password update for ${userId} - Supabase not configured`);
    return { user: null };
  }

  try {
    console.log(`🔄 SYNC: Updating Supabase Auth password for user ${userId}`);
    
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) {
      console.error(`❌ SYNC: Failed to update Supabase password for ${userId}:`, error);
      throw error;
    }

    console.log(`✅ SYNC: Successfully updated Supabase Auth password for ${userId}`);
    return data;

  } catch (error) {
    console.error(`💥 SYNC: Exception updating Supabase password for ${userId}:`, error);
    throw error;
  }
}

/**
 * Deletes a user from Supabase Auth
 */
export async function deleteSupabaseAuthUser(userId: string) {
  // Skip Supabase delete if not configured
  if (!supabaseAdmin) {
    console.log(`⚠️ SYNC: Skipping Supabase user deletion for ${userId} - Supabase not configured`);
    return { user: null };
  }

  try {
    console.log(`🔄 SYNC: Deleting Supabase Auth user ${userId}`);
    
    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error(`❌ SYNC: Failed to delete Supabase user ${userId}:`, error);
      throw error;
    }

    console.log(`✅ SYNC: Successfully deleted Supabase Auth user ${userId}`);
    return data;

  } catch (error) {
    console.error(`💥 SYNC: Exception deleting Supabase user ${userId}:`, error);
    throw error;
  }
}
