import { db } from './drizzle';
import { users, organizations, organizationMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';

async function seedBDIOrganization() {
  console.log('🌱 Seeding BDI organization and super admin...');

  // Create BDI organization
  const [bdiOrg] = await db
    .insert(organizations)
    .values({
      name: 'Boundless Devices Inc',
      legalName: 'Boundless Devices Incorporated',
      code: 'BDI',
      type: 'internal',
      dunsNumber: '11-946-7796',
      taxId: '33-3227521',
      industryCode: '423690',
      companySize: '1-10',
      businessAddress: '343 S Highway 101\nSte 200',
      billingAddress: 'Same as business address',
      isActive: true,
    })
    .returning();

  console.log('✅ Created BDI organization:', bdiOrg.name);

  // Create super admin user
  const [superAdmin] = await db
    .insert(users)
    .values({
      name: 'Steven Cistulli',
      email: 'scistulli@boundlessdevices.com',
      passwordHash: await hashPassword('password123'),
      role: 'super_admin',
      authId: crypto.randomUUID(),
      title: 'CEO',
      department: 'Admin',
      phone: '7703632420',
      isActive: true,
    })
    .returning();

  console.log('✅ Created super admin:', superAdmin.email);

  // Add super admin to BDI organization
  await db
    .insert(organizationMembers)
    .values({
      userAuthId: superAdmin.authId,
      organizationUuid: bdiOrg.id,
      role: 'owner',
    });

  console.log('✅ Added super admin to BDI organization');
}

export async function seedDatabase() {
  try {
    console.log('🚀 Starting B2B Portal database seeding...');
    
    await seedBDIOrganization();
    
    console.log('✅ B2B Portal database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
