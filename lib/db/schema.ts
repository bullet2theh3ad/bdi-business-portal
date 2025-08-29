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
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ===== CORE USER & ORGANIZATION STRUCTURE =====

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'), // member, admin, super_admin
  
  // Profile fields
  phone: varchar('phone', { length: 20 }),
  avatarUrl: text('avatar_url'),
  title: varchar('title', { length: 100 }), // Job title
  department: varchar('department', { length: 100 }),
  
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
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'internal', 'oem_partner', 'supplier', '3pl'
  code: varchar('code', { length: 20 }).unique(), // Short code like 'BDI', 'ACME'
  description: text('description'),
  
  // Contact information
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  address: text('address'),
  
  // Settings
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings'), // JSON for org-specific settings
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
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
  createdBy: integer('created_by').references(() => users.id),
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
  createdBy: integer('created_by').references(() => users.id),
});

// User memberships in organizations
export const organizationMembers = pgTable('organization_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  organizationId: integer('organization_id').notNull().references(() => organizations.id),
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
  createdBy: integer('created_by').references(() => users.id),
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