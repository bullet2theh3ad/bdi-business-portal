import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  date,
  uuid,
  jsonb,
  pgEnum,
  check,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { ne } from 'drizzle-orm';

// ===== CORE USER & ORGANIZATION STRUCTURE =====

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(), // UUID primary key
  authId: uuid('auth_id').notNull().unique(), // Supabase Auth UUID
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'), // member, admin, super_admin, developer
  
  // Profile fields
  phone: varchar('phone', { length: 20 }),
  avatarUrl: text('avatar_url'),
  title: varchar('title', { length: 100 }), // Job title
  department: varchar('department', { length: 100 }),
  
  // B2B Supply Chain fields
  supplierCode: varchar('supplier_code', { length: 50 }),
  preferredCommunication: varchar('preferred_communication', { length: 20 }).default('portal'),
  standardLeadTime: integer('standard_lead_time'),
  expeditedLeadTime: integer('expedited_lead_time'),
  minimumOrderQty: integer('minimum_order_qty'),
  paymentTerms: varchar('payment_terms', { length: 20 }).default('NET30'),
  businessHours: varchar('business_hours', { length: 100 }),
  timeZone: varchar('time_zone', { length: 50 }).default('America/New_York'),
  dataExchangeFormats: jsonb('data_exchange_formats').default(['JSON']),
  frequencyPreference: varchar('frequency_preference', { length: 20 }).default('daily'),
  
  // Contact information
  primaryContactName: varchar('primary_contact_name', { length: 100 }),
  primaryContactEmail: varchar('primary_contact_email', { length: 255 }),
  primaryContactPhone: varchar('primary_contact_phone', { length: 20 }),
  technicalContactName: varchar('technical_contact_name', { length: 100 }),
  technicalContactEmail: varchar('technical_contact_email', { length: 255 }),
  technicalContactPhone: varchar('technical_contact_phone', { length: 20 }),
  
  // Password reset fields
  resetToken: text('reset_token'),
  resetTokenExpiry: timestamp('reset_token_expiry'),
  
  // Status
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
});

// Organizations (BDI internal or external OEM partners)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(), // UUID primary key
  name: varchar('name', { length: 200 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }),
  type: varchar('type', { length: 50 }).notNull(), // 'internal', 'contractor', 'shipping_logistics', 'oem_partner', 'rd_partner', 'distributor', 'retail_partner', 'threpl_partner'
  code: varchar('code', { length: 20 }).unique(), // Short code like 'BDI', 'ACME'
  description: text('description'),
  
  // B2B Company Information
  dunsNumber: varchar('duns_number', { length: 20 }),
  taxId: varchar('tax_id', { length: 30 }),
  industryCode: varchar('industry_code', { length: 10 }),
  companySize: varchar('company_size', { length: 20 }),
  
  // Contact information
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  address: text('address'), // Primary business address
  businessAddress: text('business_address'),
  billingAddress: text('billing_address'),
  
  // Settings
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings'), // JSON for org-specific settings
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Teams within organizations (Sales, Ops, Planning, etc.)
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'sales', 'ops', 'planning', 'finance', 'vendor', 'odm'
  description: text('description'),
  
  // Team settings
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Groups (cross-functional teams that can span organizations)
export const groups = pgTable('groups', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'project', 'product_line', 'region', 'cpfr_cycle'
  
  // Group settings
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// User memberships in organizations
export const organizationMembers = pgTable('organization_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  userAuthId: uuid('user_auth_id').notNull().references(() => users.authId),
  organizationUuid: uuid('organization_uuid').notNull().references(() => organizations.id),
  role: varchar('role', { length: 50 }).notNull(), // 'owner', 'admin', 'member', 'viewer'
  permissions: jsonb('permissions'), // Specific permissions
  
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  isActive: boolean('is_active').default(true),
});

// User memberships in teams
export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  teamId: integer('team_id').notNull().references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(), // 'lead', 'member', 'contributor'
  
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  isActive: boolean('is_active').default(true),
});

// User memberships in groups
export const groupMembers = pgTable('group_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  groupId: integer('group_id').notNull().references(() => groups.id),
  role: varchar('role', { length: 50 }).notNull(), // 'lead', 'member', 'contributor'
  
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
  isActive: boolean('is_active').default(true),
});

// ===== CPFR SPECIFIC TABLES =====

// Items/SKUs master data
export const items = pgTable('items', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  sku: varchar('sku', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }),
  uom: varchar('uom', { length: 20 }).default('EA'), // Unit of measure
  
  // Item attributes
  leadTime: integer('lead_time'), // Days
  minOrderQty: numeric('min_order_qty', { precision: 15, scale: 2 }),
  packSize: numeric('pack_size', { precision: 15, scale: 2 }),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Sites/Locations
export const sites = pgTable('sites', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  code: varchar('code', { length: 50 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'warehouse', 'store', 'plant', 'dc'
  
  // Location details
  address: text('address'),
  timezone: varchar('timezone', { length: 50 }),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Forecasts (demand planning)
export const forecasts = pgTable('forecasts', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  siteId: integer('site_id').references(() => sites.id),
  
  period: date('period').notNull(), // Month/week start date
  periodType: varchar('period_type', { length: 20 }).notNull().default('monthly'), // monthly, weekly
  
  // Forecast quantities
  quantity: numeric('quantity', { precision: 15, scale: 2 }).notNull(),
  previousQuantity: numeric('previous_quantity', { precision: 15, scale: 2 }),
  
  // Metadata
  version: integer('version').default(1),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, submitted, approved, committed
  forecastType: varchar('forecast_type', { length: 50 }).notNull(), // sales, demand, statistical
  
  // Tracking
  createdBy: integer('created_by').notNull().references(() => users.id),
  submittedBy: integer('submitted_by').references(() => users.id),
  approvedBy: integer('approved_by').references(() => users.id),
  
  submittedAt: timestamp('submitted_at'),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Supply signals (ODM/supplier commitments)
export const supplySignals = pgTable('supply_signals', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
  supplierOrgId: integer('supplier_org_id').references(() => organizations.id),
  itemId: integer('item_id').notNull().references(() => items.id),
  siteId: integer('site_id').references(() => sites.id),
  
  period: date('period').notNull(),
  periodType: varchar('period_type', { length: 20 }).notNull().default('monthly'),
  
  // Supply quantities
  committedQuantity: numeric('committed_quantity', { precision: 15, scale: 2 }),
  availableQuantity: numeric('available_quantity', { precision: 15, scale: 2 }),
  allocatedQuantity: numeric('allocated_quantity', { precision: 15, scale: 2 }),
  
  // Metadata
  version: integer('version').default(1),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, committed, confirmed
  signalType: varchar('signal_type', { length: 50 }).notNull(), // commitment, capacity, allocation
  
  // Notes and constraints
  notes: text('notes'),
  constraints: jsonb('constraints'), // JSON for any constraints or conditions
  
  // Tracking
  createdBy: integer('created_by').notNull().references(() => users.id),
  confirmedBy: integer('confirmed_by').references(() => users.id),
  
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// CPFR Cycles (planning cycles)
export const cpfrCycles = pgTable('cpfr_cycles', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Cycle timing
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  freezeDate: date('freeze_date'), // When forecasts freeze
  
  // Cycle settings
  status: varchar('status', { length: 20 }).notNull().default('planning'), // planning, active, frozen, closed
  cycleType: varchar('cycle_type', { length: 50 }).notNull(), // monthly, quarterly, annual
  
  // Participating organizations
  organizationIds: jsonb('organization_ids'), // Array of org IDs
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// ===== AUDIT & ACTIVITY TRACKING =====

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  organizationId: integer('organization_id').references(() => organizations.id),
  
  action: varchar('action', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }), // 'forecast', 'supply_signal', 'user', etc.
  entityId: integer('entity_id'),
  
  details: jsonb('details'), // Additional context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// Invitations for new users
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  organizationId: integer('organization_id').references(() => organizations.id),
  teamId: integer('team_id').references(() => teams.id),
  groupId: integer('group_id').references(() => groups.id),
  
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  permissions: jsonb('permissions'),
  
  invitedBy: integer('invited_by').notNull().references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, accepted, expired, revoked
  acceptedAt: timestamp('accepted_at'),
  token: text('token').unique(),
});

// ===== RELATIONS =====

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  members: many(organizationMembers),
  teams: many(teams),
  items: many(items),
  sites: many(sites),
  forecasts: many(forecasts),
  supplySignals: many(supplySignals),
  createdBy: one(users, {
    fields: [organizations.createdBy],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  organizationMembers: many(organizationMembers),
  teamMembers: many(teamMembers),
  groupMembers: many(groupMembers),
  createdOrganizations: many(organizations),
  createdTeams: many(teams),
  createdGroups: many(groups),
  forecasts: many(forecasts),
  supplySignals: many(supplySignals),
  activityLogs: many(activityLogs),
  sentInvitations: many(invitations),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  createdBy: one(users, {
    fields: [teams.createdBy],
    references: [users.id],
  }),
}));

export const groupsRelations = relations(groups, ({ many, one }) => ({
  members: many(groupMembers),
  createdBy: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
}));

export const forecastsRelations = relations(forecasts, ({ one }) => ({
  organization: one(organizations, {
    fields: [forecasts.organizationId],
    references: [organizations.id],
  }),
  item: one(items, {
    fields: [forecasts.itemId],
    references: [items.id],
  }),
  site: one(sites, {
    fields: [forecasts.siteId],
    references: [sites.id],
  }),
  createdBy: one(users, {
    fields: [forecasts.createdBy],
    references: [users.id],
  }),
}));

export const supplySignalsRelations = relations(supplySignals, ({ one }) => ({
  organization: one(organizations, {
    fields: [supplySignals.organizationId],
    references: [organizations.id],
  }),
  supplierOrg: one(organizations, {
    fields: [supplySignals.supplierOrgId],
    references: [organizations.id],
  }),
  item: one(items, {
    fields: [supplySignals.itemId],
    references: [items.id],
  }),
  site: one(sites, {
    fields: [supplySignals.siteId],
    references: [sites.id],
  }),
  createdBy: one(users, {
    fields: [supplySignals.createdBy],
    references: [users.id],
  }),
}));

// ===== API KEYS & INTEGRATION TABLES =====

// Product SKUs for CPFR system
export const productSkus = pgTable('product_skus', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Basic SKU Information
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 100 }), // 'device', 'accessory', 'component', etc.
  subcategory: varchar('subcategory', { length: 100 }),
  
  // Product Specifications (Legacy - kept for backward compatibility)
  model: varchar('model', { length: 100 }),
  version: varchar('version', { length: 50 }),
  dimensions: varchar('dimensions', { length: 100 }), // "L x W x H"
  weight: numeric('weight', { precision: 10, scale: 3 }), // in grams
  color: varchar('color', { length: 50 }),
  
  // Business Information (restored for CPFR planning)
  moq: integer('moq').default(1), // Minimum Order Quantity
  leadTimeDays: integer('lead_time_days').default(30), // Lead time in days
  
  // Inventory & Status
  isActive: boolean('is_active').default(true),
  isDiscontinued: boolean('is_discontinued').default(false),
  replacementSku: varchar('replacement_sku', { length: 100 }), // If discontinued
  
  // Box Dimensions/Weights (Metric)
  boxLengthCm: numeric('box_length_cm', { precision: 10, scale: 2 }),
  boxWidthCm: numeric('box_width_cm', { precision: 10, scale: 2 }),
  boxHeightCm: numeric('box_height_cm', { precision: 10, scale: 2 }),
  boxWeightKg: numeric('box_weight_kg', { precision: 10, scale: 3 }),
  
  // Carton Dimensions/Weights (Metric)
  cartonLengthCm: numeric('carton_length_cm', { precision: 10, scale: 2 }),
  cartonWidthCm: numeric('carton_width_cm', { precision: 10, scale: 2 }),
  cartonHeightCm: numeric('carton_height_cm', { precision: 10, scale: 2 }),
  cartonWeightKg: numeric('carton_weight_kg', { precision: 10, scale: 3 }),
  boxesPerCarton: integer('boxes_per_carton'),
  
  // Pallet Dimensions/Weights (Metric)
  palletLengthCm: numeric('pallet_length_cm', { precision: 10, scale: 2 }),
  palletWidthCm: numeric('pallet_width_cm', { precision: 10, scale: 2 }),
  palletHeightCm: numeric('pallet_height_cm', { precision: 10, scale: 2 }),
  palletWeightKg: numeric('pallet_weight_kg', { precision: 10, scale: 3 }),
  palletMaterialType: varchar('pallet_material_type', { length: 50 }), // WOOD_HT, PLASTIC_HDPE, etc.
  palletNotes: text('pallet_notes'),
  
  // Manufacturing Program & Business Info
  mpStartDate: timestamp('mp_start_date'), // Manufacturing Program Start Date
  mfg: varchar('mfg', { length: 100 }), // Manufacturer code/name
  
  // Trade Classification
  htsCode: varchar('hts_code', { length: 12 }), // Harmonized Tariff Schedule code (NNNN.NN.NNNN)
  
  // Metadata
  tags: varchar('tags', { length: 255 }).array(), // Searchable tags
  specifications: jsonb('specifications'), // Flexible spec storage
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => users.authId),
});

// API Keys for developer users
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userAuthId: uuid('user_auth_id').notNull().references(() => users.authId),
  organizationUuid: uuid('organization_uuid').notNull().references(() => organizations.id),
  keyName: varchar('key_name', { length: 100 }).notNull(),
  keyHash: text('key_hash').notNull(), // Hashed version of the API key
  keyPrefix: varchar('key_prefix', { length: 10 }).notNull(), // First few chars for display
  permissions: jsonb('permissions').default({}), // API permissions
  rateLimitPerHour: integer('rate_limit_per_hour').default(1000),
  lastUsedAt: timestamp('last_used_at'),
  isActive: boolean('is_active').default(true),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Integration settings for B2B data exchange
export const integrationSettings = pgTable('integration_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  integrationType: varchar('integration_type', { length: 20 }).notNull(), // 'edi', 'api', 'ftp', 'email'
  configuration: jsonb('configuration').notNull().default({}), // Connection details, endpoints, etc.
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id),
});

// Data Category Enum for granular permissions
export const dataCategoryEnum = pgEnum('data_category', [
  'public',        // Company info, contact details
  'partner',       // Inventory levels, shipping schedules  
  'confidential',  // Financial data, contracts
  'internal'       // Strategic plans, employee data
]);

// Organization Connections (ASYMMETRIC - directional with granular permissions)
export const organizationConnections = pgTable('organization_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Directional: source → target (source can access target's data based on permissions)
  sourceOrganizationId: uuid('source_organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  targetOrganizationId: uuid('target_organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  
  connectionType: varchar('connection_type', { length: 50 }).notNull().default('messaging'), // 'messaging', 'file_share', 'full_collaboration'
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'pending', 'suspended'
  
  // Granular permissions - what SOURCE can see/do with TARGET's data
  permissions: jsonb('permissions').notNull().default('{}'),
  
  // Data category access control array  
  allowedDataCategories: dataCategoryEnum('allowed_data_categories').array().default(['public']),
  
  // Connection metadata
  description: text('description'),
  tags: varchar('tags', { length: 50 }).array().default([]), // e.g., ['supply-chain', 'logistics']
  
  // Audit trail
  createdBy: uuid('created_by').notNull().references(() => users.authId, { onDelete: 'cascade' }), // BDI Super Admin
  approvedBy: uuid('approved_by').references(() => users.authId), // Optional approval workflow
  
  // Time constraints
  startDate: date('start_date').defaultNow(),
  endDate: date('end_date'), // Optional expiration
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Relations for new tables
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userAuthId],
    references: [users.authId],
  }),
  organization: one(organizations, {
    fields: [apiKeys.organizationUuid],
    references: [organizations.id],
  }),
}));

export const integrationSettingsRelations = relations(integrationSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [integrationSettings.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [integrationSettings.createdBy],
    references: [users.id],
  }),
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  user: one(users, {
    fields: [organizationMembers.userAuthId],
    references: [users.authId],
  }),
  organization: one(organizations, {
    fields: [organizationMembers.organizationUuid],
    references: [organizations.id],
  }),
}));

// ===== TYPE EXPORTS =====

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Forecast = typeof forecasts.$inferSelect;
export type NewForecast = typeof forecasts.$inferInsert;
export type SupplySignal = typeof supplySignals.$inferSelect;
export type NewSupplySignal = typeof supplySignals.$inferInsert;
export type CPFRCycle = typeof cpfrCycles.$inferSelect;
export type NewCPFRCycle = typeof cpfrCycles.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type ProductSku = typeof productSkus.$inferSelect;
export type NewProductSku = typeof productSkus.$inferInsert;

// ===== INVOICE TABLES =====

// Main invoices table
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Invoice Details
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull().unique(),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  invoiceDate: timestamp('invoice_date').notNull(),
  requestedDeliveryWeek: timestamp('requested_delivery_week'),
  
  // Status and Business Terms
  status: varchar('status', { length: 50 }).notNull().default('draft'),
  terms: varchar('terms', { length: 100 }), // NET30, NET60, etc.
  incoterms: varchar('incoterms', { length: 20 }), // FOB, CIF, DDP, etc.
  incotermsLocation: varchar('incoterms_location', { length: 255 }),
  
  // Financial
  totalValue: numeric('total_value', { precision: 15, scale: 2 }).notNull().default('0.00'),
  
  // Supporting Documents (JSON array of file paths/URLs)
  documents: jsonb('documents').default('[]'),
  
  // Additional Info
  notes: text('notes'),
  
  // Audit Fields
  createdBy: uuid('created_by').notNull().references(() => users.authId),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Invoice line items table
export const invoiceLineItems = pgTable('invoice_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign Keys
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  skuId: uuid('sku_id').notNull().references(() => productSkus.id),
  
  // Line Item Details
  skuCode: varchar('sku_code', { length: 100 }).notNull(),
  skuName: varchar('sku_name', { length: 255 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitCost: numeric('unit_cost', { precision: 15, scale: 2 }).notNull(),
  lineTotal: numeric('line_total', { precision: 15, scale: 2 }).notNull().default('0.00'),
  
  // Audit
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Invoice documents table
export const invoiceDocuments = pgTable('invoice_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Foreign Key
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  
  // File Details
  fileName: varchar('file_name', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: integer('file_size').notNull(),
  
  // Upload Info
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.authId),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type InvoiceDocument = typeof invoiceDocuments.$inferSelect;
export type NewInvoiceDocument = typeof invoiceDocuments.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type IntegrationSetting = typeof integrationSettings.$inferSelect;
export type NewIntegrationSetting = typeof integrationSettings.$inferInsert;
export type OrganizationConnection = typeof organizationConnections.$inferSelect;
export type NewOrganizationConnection = typeof organizationConnections.$inferInsert;

// Complex types for UI
export type OrganizationWithMembers = Organization & {
  members: (typeof organizationMembers.$inferSelect & {
    user: Pick<User, 'id' | 'name' | 'email' | 'role'>;
  })[];
};

export type TeamWithMembers = Team & {
  members: (typeof teamMembers.$inferSelect & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

// Activity types enum
export enum ActivityType {
  // User actions
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  
  // Organization actions
  CREATE_ORGANIZATION = 'CREATE_ORGANIZATION',
  UPDATE_ORGANIZATION = 'UPDATE_ORGANIZATION',
  INVITE_MEMBER = 'INVITE_MEMBER',
  REMOVE_MEMBER = 'REMOVE_MEMBER',
  
  // CPFR actions
  CREATE_FORECAST = 'CREATE_FORECAST',
  UPDATE_FORECAST = 'UPDATE_FORECAST',
  SUBMIT_FORECAST = 'SUBMIT_FORECAST',
  APPROVE_FORECAST = 'APPROVE_FORECAST',
  CREATE_SUPPLY_SIGNAL = 'CREATE_SUPPLY_SIGNAL',
  UPDATE_SUPPLY_SIGNAL = 'UPDATE_SUPPLY_SIGNAL',
  COMMIT_SUPPLY_SIGNAL = 'COMMIT_SUPPLY_SIGNAL',
}