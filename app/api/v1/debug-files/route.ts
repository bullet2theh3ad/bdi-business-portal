import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productionFiles, organizations } from '@/lib/db/schema';

/**
 * Debug endpoint to check if production files exist in database
 */
export async function GET(request: NextRequest) {
  try {
    // Check if production files table exists and has data
    const allFiles = await db
      .select({
        id: productionFiles.id,
        fileName: productionFiles.fileName,
        organizationId: productionFiles.organizationId,
        createdAt: productionFiles.createdAt,
      })
      .from(productionFiles)
      .limit(10);

    // Check if organizations table has data
    const allOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        code: organizations.code,
      })
      .from(organizations)
      .limit(10);

    return NextResponse.json({
      success: true,
      message: 'Database tables check successful',
      debug: {
        totalProductionFiles: allFiles.length,
        totalOrganizations: allOrgs.length,
        productionFiles: allFiles.map(f => ({
          id: f.id,
          fileName: f.fileName,
          organizationId: f.organizationId,
          createdAt: f.createdAt
        })),
        organizations: allOrgs.map(o => ({
          id: o.id,
          name: o.name,
          code: o.code
        }))
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Database tables check failed',
      debug: {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      }
    }, { status: 500 });
  }
}
