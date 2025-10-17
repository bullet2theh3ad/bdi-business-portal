'use server';

import { db } from '@/lib/db/drizzle';
import { users, organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Validation schema for profile updates
const updateProfileSchema = z.object({
  // Personal Information
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  title: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  
  // B2B Supply Chain fields
  supplierCode: z.string().max(50).optional(),
  preferredCommunication: z.enum(['portal', 'api', 'edi', 'email']).optional(),
  standardLeadTime: z.number().int().min(0).max(365).optional(),
  expeditedLeadTime: z.number().int().min(0).max(365).optional(),
  minimumOrderQty: z.number().int().min(0).optional(),
  paymentTerms: z.enum(['NET15', 'NET30', 'NET45', 'NET60', 'COD', 'PREPAID']).optional(),
  businessHours: z.string().max(100).optional(),
  timeZone: z.string().max(50).optional(),
  dataExchangeFormats: z.array(z.string()).optional(),
  frequencyPreference: z.enum(['real-time', 'hourly', 'daily', 'weekly', 'monthly', 'on-demand']).optional(),
  
  // Contact Information
  primaryContactName: z.string().max(100).optional(),
  primaryContactEmail: z.string().email().max(255).optional(),
  primaryContactPhone: z.string().max(20).optional(),
  technicalContactName: z.string().max(100).optional(),
  technicalContactEmail: z.string().email().max(255).optional(),
  technicalContactPhone: z.string().max(20).optional(),
});

const updateOrganizationSchema = z.object({
  // Business Information
  companyName: z.string().min(1).max(200).optional(),
  companyLegalName: z.string().max(200).optional(),
  dunsNumber: z.string().max(20).optional(),
  taxId: z.string().max(30).optional(),
  industryCode: z.string().max(10).optional(),
  companySize: z.enum(['1-10', '11-50', '51-200', '201-1000', '1000+']).or(z.literal('')).optional(),
  businessAddress: z.string().optional(),
  billingAddress: z.string().optional(),
});

export async function updateUserProfile(authId: string, data: z.infer<typeof updateProfileSchema>) {
  try {
    // Validate the input data
    const validatedData = updateProfileSchema.parse(data);
    
    // Remove undefined values
    const updateData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No valid data to update' };
    }

    // Update user profile using auth_id
    await db
      .update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.authId, authId));

    // Revalidate the profile page
    revalidatePath('/account/profile');
    
    return { success: true, message: 'Profile updated successfully' };
    
  } catch (error) {
    console.error('Error updating user profile:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Invalid data provided',
        details: error.errors 
      };
    }
    
    return { 
      success: false, 
      error: 'Failed to update profile. Please try again.' 
    };
  }
}

export async function updateOrganizationProfile(organizationId: string, data: z.infer<typeof updateOrganizationSchema>) {
  try {
    // Skip organization update if no ID provided
    if (!organizationId || organizationId === '') {
      return { success: true, message: 'Organization update skipped - no ID provided' };
    }

    // Validate the input data
    const validatedData = updateOrganizationSchema.parse(data);
    
    // Remove undefined values and map to database column names
    const updateData: any = {};
    
    if (validatedData.companyName !== undefined) {
      updateData.name = validatedData.companyName;
    }
    if (validatedData.companyLegalName !== undefined) {
      updateData.legalName = validatedData.companyLegalName;
    }
    if (validatedData.dunsNumber !== undefined) {
      updateData.dunsNumber = validatedData.dunsNumber;
    }
    if (validatedData.taxId !== undefined) {
      updateData.taxId = validatedData.taxId;
    }
    if (validatedData.industryCode !== undefined) {
      updateData.industryCode = validatedData.industryCode;
    }
    if (validatedData.companySize !== undefined && validatedData.companySize !== '') {
      updateData.companySize = validatedData.companySize;
    }
    if (validatedData.businessAddress !== undefined) {
      updateData.businessAddress = validatedData.businessAddress;
    }
    if (validatedData.billingAddress !== undefined) {
      updateData.billingAddress = validatedData.billingAddress;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'No valid data to update' };
    }

    // Update organization using UUID
    await db
      .update(organizations)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    // Revalidate the profile page
    revalidatePath('/account/profile');
    
    return { success: true, message: 'Organization updated successfully' };
    
  } catch (error) {
    console.error('Error updating organization:', error);
    
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: 'Invalid data provided',
        details: error.errors 
      };
    }
    
    return { 
      success: false, 
      error: 'Failed to update organization. Please try again.' 
    };
  }
}

// Combined action to update both user and organization data
export async function updateCompleteProfile(
  authId: string, 
  organizationId: string, 
  profileData: z.infer<typeof updateProfileSchema>,
  organizationData: z.infer<typeof updateOrganizationSchema>
) {
  try {
    const results = await Promise.allSettled([
      updateUserProfile(authId, profileData),
      updateOrganizationProfile(organizationId, organizationData)
    ]);

    const userResult = results[0];
    const orgResult = results[1];

    const errors = [];
    
    if (userResult.status === 'rejected' || (userResult.status === 'fulfilled' && !userResult.value.success)) {
      errors.push(`User profile: ${userResult.status === 'rejected' ? userResult.reason : userResult.value.error}`);
    }
    
    if (orgResult.status === 'rejected' || (orgResult.status === 'fulfilled' && !orgResult.value.success)) {
      errors.push(`Organization: ${orgResult.status === 'rejected' ? orgResult.reason : orgResult.value.error}`);
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: 'Some updates failed',
        details: errors
      };
    }

    return {
      success: true,
      message: 'Profile and organization updated successfully'
    };

  } catch (error) {
    console.error('Error updating complete profile:', error);
    return {
      success: false,
      error: 'Failed to update profile. Please try again.'
    };
  }
}
