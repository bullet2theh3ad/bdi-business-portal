/**
 * Feature Flags System
 * Controls access to experimental/beta features
 */

// QuickBooks Integration Feature Flag (for GL Management data access)
export const QUICKBOOKS_WHITELIST = [
  'scistulli@boundlessdevices.com',
  'dzand@boundlessdevices.com',
  'sjin@boundlessdevices.com',
  'hmitchem@boundlessdevices.com',  // Heather Mitchell
  'hmitcehm@boundlessdevices.com',  // Alternative spelling in case of typo
  'dhenry@boundlessdevices.com',    // David Henry
];

export function canAccessQuickBooks(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return QUICKBOOKS_WHITELIST.includes(userEmail.toLowerCase());
}

// Business Analysis Feature Flag
export const BUSINESS_ANALYSIS_WHITELIST = [
  'scistulli@boundlessdevices.com',
  'dzand@boundlessdevices.com',
  'sjin@boundlessdevices.com',
  'hmitchem@boundlessdevices.com',  // Heather Mitchell
  'hmitcehm@boundlessdevices.com',  // Alternative spelling
  'jeskelson@boundlessdevices.com',
  'amartinez@boundlessdevices.com',
  'kdrennan@boundlessdevices.com',
  'dhenry@boundlessdevices.com',    // David Henry
];

export function canAccessBusinessAnalysis(userEmail: string | null | undefined): boolean {
  if (!userEmail) return false;
  return BUSINESS_ANALYSIS_WHITELIST.includes(userEmail.toLowerCase());
}

// Future feature flags can go here
export const FEATURE_FLAGS = {
  QUICKBOOKS_INTEGRATION: 'quickbooks_integration',
  BUSINESS_ANALYSIS: 'business_analysis',
  // Add more features as needed
} as const;

export function hasFeatureAccess(
  featureFlag: string,
  userEmail: string | null | undefined
): boolean {
  switch (featureFlag) {
    case FEATURE_FLAGS.QUICKBOOKS_INTEGRATION:
      return canAccessQuickBooks(userEmail);
    case FEATURE_FLAGS.BUSINESS_ANALYSIS:
      return canAccessBusinessAnalysis(userEmail);
    default:
      return false;
  }
}

