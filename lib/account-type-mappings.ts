/**
 * Account Type to Category Mappings
 * 
 * This defines the hierarchical categorization:
 * - Account Types are detailed classifications
 * - Categories are high-level rollups for summary cards
 */

export interface AccountTypeMapping {
  accountType: string;
  category: string;
  description?: string;
}

export const ACCOUNT_TYPE_MAPPINGS: AccountTypeMapping[] = [
  // OpEx Account Types
  { accountType: 'Contract', category: 'opex', description: 'Contractual obligations and agreements' },
  { accountType: 'Services', category: 'opex', description: 'Professional and consulting services' },
  { accountType: 'Annual Subscription', category: 'opex', description: 'Software and service subscriptions' },
  { accountType: 'Insurance', category: 'opex', description: 'Insurance premiums and policies' },
  { accountType: 'Rent', category: 'opex', description: 'Facility and equipment rent' },
  { accountType: 'Utilities', category: 'opex', description: 'Power, water, internet, etc.' },
  { accountType: 'Office Supplies', category: 'opex', description: 'General office supplies and equipment' },
  { accountType: 'Professional Fees', category: 'opex', description: 'Legal, accounting, consulting fees' },
  { accountType: 'Contract Labor', category: 'opex', description: 'Contract and freelance labor costs' },
  { accountType: 'Consulting Services', category: 'opex', description: 'Independent contractor consulting' },
  { accountType: 'Freelance Labor', category: 'opex', description: 'Freelance and gig workers' },
  { accountType: 'Temporary Staffing', category: 'opex', description: 'Temporary staffing agency costs' },
  
  // Marketing Account Types
  { accountType: 'Advertising', category: 'marketing', description: 'Paid advertising and promotions' },
  { accountType: 'Marketing Services', category: 'marketing', description: 'Marketing agency and consultant fees' },
  { accountType: 'Trade Shows', category: 'marketing', description: 'Trade show and event expenses' },
  { accountType: 'Content Creation', category: 'marketing', description: 'Photography, video, graphics' },
  
  // NRE Account Types
  { accountType: 'Design Services', category: 'nre', description: 'Product design and engineering' },
  { accountType: 'Prototyping', category: 'nre', description: 'Prototype development costs' },
  { accountType: 'Testing & Certification', category: 'nre', description: 'Product testing and compliance' },
  { accountType: 'Tooling', category: 'nre', description: 'Manufacturing tooling and molds' },
  { accountType: 'R&D Services', category: 'nre', description: 'Research and development expenses' },
  { accountType: 'DevOps', category: 'nre', description: 'DevOps infrastructure and development operations' },
  { accountType: 'Firmware Development', category: 'nre', description: 'Firmware and embedded software development' },
  { accountType: 'Certifications', category: 'nre', description: 'Certification costs and fees' },
  
  // Inventory Account Types
  { accountType: 'Raw Materials', category: 'inventory', description: 'Raw material purchases' },
  { accountType: 'Finished Goods', category: 'inventory', description: 'Finished product purchases' },
  { accountType: 'Components', category: 'inventory', description: 'Component and part purchases' },
  { accountType: 'Packaging', category: 'inventory', description: 'Packaging materials' },
  { accountType: 'Freight In', category: 'inventory', description: 'Inbound shipping costs' },
  
  // Labor Account Types
  { accountType: 'Payroll', category: 'labor', description: 'Employee salaries and wages' },
  { accountType: 'Payroll Taxes', category: 'labor', description: 'Employer payroll taxes' },
  { accountType: 'Benefits', category: 'labor', description: 'Health insurance and benefits' },
  { accountType: 'Payroll Charges', category: 'labor', description: 'Payroll processing and overhead charges' },
  { accountType: 'Retirement', category: 'labor', description: '401k and retirement contributions' },
  
  // RLOC/Loans Account Types
  { accountType: 'Loan Principal', category: 'loans', description: 'Loan principal payments' },
  { accountType: 'Loan Interest', category: 'loan_interest', description: 'Loan interest payments' },
  { accountType: 'Line of Credit Draw', category: 'loans', description: 'RLOC draws' },
  
  // Revenue Account Types
  { accountType: 'D2C Sales', category: 'revenue', description: 'Direct to consumer sales' },
  { accountType: 'B2B Sales', category: 'revenue', description: 'Business to business sales' },
  { accountType: 'B2B Factored Sales', category: 'revenue', description: 'Factored B2B sales' },
  
  // Other Account Types
  { accountType: 'Miscellaneous', category: 'other', description: 'Miscellaneous expenses' },
  { accountType: 'Unclassified', category: 'unassigned', description: 'Not yet classified' },
];

/**
 * Get all unique categories
 */
export function getCategories(): string[] {
  const categories = new Set(ACCOUNT_TYPE_MAPPINGS.map(m => m.category));
  return Array.from(categories).sort();
}

/**
 * Get all account types for a specific category
 */
export function getAccountTypesForCategory(category: string): AccountTypeMapping[] {
  return ACCOUNT_TYPE_MAPPINGS.filter(m => m.category === category);
}

/**
 * Get the category for a specific account type
 */
export function getCategoryForAccountType(accountType: string): string | null {
  const mapping = ACCOUNT_TYPE_MAPPINGS.find(m => m.accountType === accountType);
  return mapping?.category || null;
}

/**
 * Get all account types
 */
export function getAllAccountTypes(): string[] {
  return ACCOUNT_TYPE_MAPPINGS.map(m => m.accountType);
}

/**
 * Get display name for category
 */
export function getCategoryDisplayName(category: string): string {
  const displayNames: Record<string, string> = {
    'opex': 'OPEX',
    'marketing': 'Marketing',
    'nre': 'NRE',
    'inventory': 'Inventory',
    'labor': 'Labor',
    'loans': 'RLOC',
    'loan_interest': 'Loan Interest Paid',
    'revenue': 'Net Revenue',
    'investments': 'Investments',
    'other': 'Other',
    'unassigned': 'Unassigned',
  };
  return displayNames[category] || category;
}

/**
 * Group account types by category for UI display
 */
export function getAccountTypesByCategory(): Record<string, AccountTypeMapping[]> {
  const grouped: Record<string, AccountTypeMapping[]> = {};
  
  ACCOUNT_TYPE_MAPPINGS.forEach(mapping => {
    if (!grouped[mapping.category]) {
      grouped[mapping.category] = [];
    }
    grouped[mapping.category].push(mapping);
  });
  
  return grouped;
}

