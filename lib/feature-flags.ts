/**
 * Feature Flags System
 * Controls access to experimental/beta features
 */

// QuickBooks Integration Feature Flag
export const QUICKBOOKS_WHITELIST = [
  'scistulli@boundlessdevices.com',
  // Add more emails here as you expand access
  // 'dzand@boundlessdevices.com',
];

export function canAccessQuickBooks(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return QUICKBOOKS_WHITELIST.includes(userEmail.toLowerCase());
}

// Future feature flags can go here
export const FEATURE_FLAGS = {
  QUICKBOOKS_INTEGRATION: 'quickbooks_integration',
  // Add more features as needed
} as const;

export function hasFeatureAccess(
  featureFlag: string,
  userEmail: string | null | undefined
): boolean {
  switch (featureFlag) {
    case FEATURE_FLAGS.QUICKBOOKS_INTEGRATION:
      return canAccessQuickBooks(userEmail);
    default:
      return false;
  }
}

