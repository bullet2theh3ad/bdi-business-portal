// COMPREHENSIVE SECURITY AND SCHEMA ANALYSIS FOR ASK BDI ALGORITHM
// Enhanced JavaScript version with RLS policy checking and security analysis

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ===== RLS POLICY AND SECURITY ANALYSIS =====

async function analyzeRLSPolicies() {
  console.log('🔒 Analyzing RLS policies and security gaps...');
  
  try {
    // Get all tables with their RLS status
    const { data: tablesRLS, error: rlsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
            t.table_name,
            CASE 
                WHEN p.tablename IS NOT NULL THEN 'RLS_ENABLED'
                ELSE 'UNRESTRICTED'
            END as rls_status,
            COALESCE(s.n_tup_ins, 0) as estimated_row_count,
            CASE 
                WHEN t.table_name IN ('api_keys', 'users', 'organizations', 'invoices', 'purchase_orders') 
                THEN 'HIGH_RISK'
                WHEN t.table_name LIKE '%document%' OR t.table_name LIKE '%file%'
                THEN 'MEDIUM_RISK'
                ELSE 'LOW_RISK'
            END as risk_level
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        LEFT JOIN (
            SELECT DISTINCT tablename 
            FROM pg_policies 
            WHERE schemaname = 'public'
        ) p ON p.tablename = t.table_name
        WHERE t.table_schema = 'public' 
            AND t.table_type = 'BASE TABLE'
            AND t.table_name NOT LIKE 'pg_%'
            AND t.table_name NOT LIKE '_prisma%'
            AND t.table_name NOT LIKE 'drizzle_%'
        ORDER BY 
            CASE WHEN p.tablename IS NULL THEN 0 ELSE 1 END,
            CASE 
                WHEN t.table_name IN ('api_keys', 'users', 'organizations', 'invoices', 'purchase_orders') THEN 1
                WHEN t.table_name LIKE '%document%' OR t.table_name LIKE '%file%' THEN 2
                ELSE 3
            END
      `
    });

    if (rlsError) {
      console.error('❌ Error analyzing RLS policies:', rlsError);
      return null;
    }

    const securityAnalysis = {
      totalTables: tablesRLS?.length || 0,
      unrestrictedTables: tablesRLS?.filter(t => t.rls_status === 'UNRESTRICTED') || [],
      highRiskUnrestricted: tablesRLS?.filter(t => t.rls_status === 'UNRESTRICTED' && t.risk_level === 'HIGH_RISK') || [],
      mediumRiskUnrestricted: tablesRLS?.filter(t => t.rls_status === 'UNRESTRICTED' && t.risk_level === 'MEDIUM_RISK') || [],
      protectedTables: tablesRLS?.filter(t => t.rls_status === 'RLS_ENABLED') || [],
      totalExposedRecords: tablesRLS?.filter(t => t.rls_status === 'UNRESTRICTED')
        .reduce((sum, t) => sum + (parseInt(t.estimated_row_count) || 0), 0) || 0
    };

    return securityAnalysis;

  } catch (error) {
    console.error('❌ Error analyzing RLS policies:', error);
    return null;
  }
}

// ===== STORAGE BUCKET ANALYSIS =====

async function analyzeOrganizationDocuments() {
  console.log('📁 Analyzing organization-documents bucket...');
  
  try {
    // Get all files from organization-documents bucket
    const { data: files, error } = await supabase.storage
      .from('organization-documents')
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('❌ Error fetching files:', error);
      return null;
    }

    console.log(`📊 Found ${files.length} files in organization-documents bucket`);

    // Analyze file structure
    const fileAnalysis = {
      totalFiles: files.length,
      fileTypes: {},
      organizationFolders: {},
      documentCategories: {},
      totalSize: 0,
      recentFiles: []
    };

    for (const file of files) {
      // Extract file extension
      const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
      fileAnalysis.fileTypes[extension] = (fileAnalysis.fileTypes[extension] || 0) + 1;

      // Extract organization folder
      const orgFolder = file.name.split('/')[0];
      if (!fileAnalysis.organizationFolders[orgFolder]) {
        fileAnalysis.organizationFolders[orgFolder] = {
          fileCount: 0,
          fileTypes: new Set(),
          totalSize: 0
        };
      }
      fileAnalysis.organizationFolders[orgFolder].fileCount++;
      fileAnalysis.organizationFolders[orgFolder].fileTypes.add(extension);
      fileAnalysis.organizationFolders[orgFolder].totalSize += file.metadata?.size || 0;

      // Categorize documents
      let category = 'uncategorized';
      if (file.name.includes('/production-files/')) category = 'production-files';
      else if (file.name.includes('/invoices/')) category = 'invoices';
      else if (file.name.includes('/purchase-orders/')) category = 'purchase-orders';
      else if (file.name.includes('/shipments/')) category = 'shipments';
      else if (file.name.includes('/warehouses/')) category = 'warehouses';
      else if (file.name.includes('/rag-documents/')) category = 'rag-documents';
      else if (file.name.includes('/templates/')) category = 'templates';

      fileAnalysis.documentCategories[category] = (fileAnalysis.documentCategories[category] || 0) + 1;
      fileAnalysis.totalSize += file.metadata?.size || 0;

      // Track recent files
      if (fileAnalysis.recentFiles.length < 10) {
        fileAnalysis.recentFiles.push({
          name: file.name,
          size: file.metadata?.size || 0,
          created: file.created_at,
          updated: file.updated_at
        });
      }
    }

    // Convert Sets to Arrays for JSON serialization
    Object.keys(fileAnalysis.organizationFolders).forEach(org => {
      fileAnalysis.organizationFolders[org].fileTypes = 
        Array.from(fileAnalysis.organizationFolders[org].fileTypes);
    });

    return fileAnalysis;

  } catch (error) {
    console.error('❌ Error analyzing organization documents:', error);
    return null;
  }
}

// ===== DATABASE SCHEMA ANALYSIS =====

async function analyzeDatabaseSchema() {
  console.log('🗄️ Analyzing database schema...');
  
  try {
    // Get all tables with metadata
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name, table_type')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
      .not('table_name', 'like', 'pg_%')
      .not('table_name', 'like', '_prisma%');

    if (tablesError) {
      console.error('❌ Error fetching tables:', tablesError);
      return null;
    }

    const schemaAnalysis = {
      totalTables: tables.length,
      tableDetails: {},
      relationships: {},
      businessDataSummary: {}
    };

    // For each table, get column information
    for (const table of tables) {
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', table.table_name)
        .eq('table_schema', 'public')
        .order('ordinal_position');

      if (!columnsError && columns) {
        schemaAnalysis.tableDetails[table.table_name] = {
          columnCount: columns.length,
          columns: columns.map(col => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
            default: col.column_default
          }))
        };
      }
    }

    return schemaAnalysis;

  } catch (error) {
    console.error('❌ Error analyzing database schema:', error);
    return null;
  }
}

// ===== BUSINESS DATA ANALYSIS =====

async function analyzeBusinessData() {
  console.log('📊 Analyzing business data patterns...');
  
  try {
    const businessAnalysis = {
      organizations: {},
      cpfrSignals: {},
      documentLinkage: {},
      userActivity: {}
    };

    // Analyze organizations
    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select(`
        id, name, code, type,
        organization_members(count),
        sales_forecasts(count),
        invoices(count)
      `);

    if (!orgsError && orgs) {
      businessAnalysis.organizations = orgs.reduce((acc, org) => {
        acc[org.code] = {
          name: org.name,
          type: org.type,
          memberCount: org.organization_members?.length || 0,
          forecastCount: org.sales_forecasts?.length || 0,
          invoiceCount: org.invoices?.length || 0
        };
        return acc;
      }, {});
    }

    // Analyze CPFR signals
    const { data: signals, error: signalsError } = await supabase
      .from('sales_forecasts')
      .select('sales_signal, factory_signal, transit_signal, warehouse_signal, custom_exw_date, date_change_history');

    if (!signalsError && signals) {
      businessAnalysis.cpfrSignals = {
        totalForecasts: signals.length,
        signalDistribution: {
          sales: {},
          factory: {},
          transit: {},
          warehouse: {}
        },
        hasExwDates: signals.filter(s => s.custom_exw_date).length,
        hasDateChanges: signals.filter(s => s.date_change_history && s.date_change_history.length > 0).length
      };

      // Count signal distributions
      signals.forEach(signal => {
        ['sales', 'factory', 'transit', 'warehouse'].forEach(type => {
          const signalValue = signal[`${type}_signal`];
          if (!businessAnalysis.cpfrSignals.signalDistribution[type][signalValue]) {
            businessAnalysis.cpfrSignals.signalDistribution[type][signalValue] = 0;
          }
          businessAnalysis.cpfrSignals.signalDistribution[type][signalValue]++;
        });
      });
    }

    return businessAnalysis;

  } catch (error) {
    console.error('❌ Error analyzing business data:', error);
    return null;
  }
}

// ===== ENHANCED ASK BDI DATA MAPPING =====

async function generateAskBDIDataMap() {
  console.log('🎯 Generating comprehensive data map for Ask BDI algorithm...');
  
  try {
    // Get complete table relationships for Ask BDI context understanding
    const { data: relationships, error: relError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
            tc.table_name as source_table,
            kcu.column_name as source_column,
            ccu.table_name as referenced_table,
            ccu.column_name as referenced_column,
            tc.constraint_name,
            CASE 
                WHEN tc.table_name LIKE '%document%' AND ccu.table_name IN ('organizations', 'users', 'invoices', 'purchase_orders', 'shipments')
                THEN 'DOCUMENT_LINK'
                WHEN ccu.table_name = 'organizations'
                THEN 'ORG_SCOPED'
                WHEN ccu.table_name = 'users'
                THEN 'USER_SCOPED'
                ELSE 'BUSINESS_LOGIC'
            END as relationship_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
      `
    });

    if (relError) {
      console.error('❌ Error getting relationships:', relError);
      return null;
    }

    // Build Ask BDI data context map
    const askBDIDataMap = {
      coreBusinessEntities: {
        organizations: {
          primaryKey: 'id',
          relationships: relationships?.filter(r => r.referenced_table === 'organizations') || [],
          contextFor: 'Multi-tenant organization scoping and access control'
        },
        users: {
          primaryKey: 'auth_id',
          relationships: relationships?.filter(r => r.referenced_table === 'users') || [],
          contextFor: 'User authentication, permissions, and activity tracking'
        },
        sales_forecasts: {
          primaryKey: 'id',
          relationships: relationships?.filter(r => r.source_table === 'sales_forecasts') || [],
          contextFor: 'CPFR signals, delivery planning, and supply chain coordination'
        },
        shipments: {
          primaryKey: 'id',
          relationships: relationships?.filter(r => r.source_table === 'shipments') || [],
          contextFor: 'Logistics tracking, status updates, and delivery coordination'
        },
        invoices: {
          primaryKey: 'id',
          relationships: relationships?.filter(r => r.source_table === 'invoices') || [],
          contextFor: 'Financial transactions, billing, and payment tracking'
        },
        purchase_orders: {
          primaryKey: 'id',
          relationships: relationships?.filter(r => r.source_table === 'purchase_orders') || [],
          contextFor: 'Procurement, supplier management, and order fulfillment'
        }
      },
      documentStorage: {
        buckets: ['organization-documents', 'templates', 'production-files'],
        linkagePattern: 'Documents linked via organization_id and entity-specific foreign keys',
        securityContext: 'Multi-tenant RLS policies required for document access control'
      },
      cpfrSignals: {
        signalTypes: ['sales_signal', 'factory_signal', 'transit_signal', 'warehouse_signal'],
        dateTracking: ['custom_exw_date', 'date_change_history', 'delivery_week'],
        businessContext: 'Real-time supply chain visibility and coordination'
      },
      apiAccessPatterns: {
        organizationScoped: relationships?.filter(r => r.relationship_type === 'ORG_SCOPED').map(r => r.source_table) || [],
        userScoped: relationships?.filter(r => r.relationship_type === 'USER_SCOPED').map(r => r.source_table) || [],
        documentLinked: relationships?.filter(r => r.relationship_type === 'DOCUMENT_LINK').map(r => r.source_table) || []
      }
    };

    return askBDIDataMap;

  } catch (error) {
    console.error('❌ Error generating Ask BDI data map:', error);
    return null;
  }
}

// ===== MAIN ANALYSIS FUNCTION =====

async function runCompleteAnalysis() {
  console.log('🔍 Starting comprehensive security and schema analysis for Ask BDI algorithm...');
  
  const results = {
    timestamp: new Date().toISOString(),
    securityAnalysis: await analyzeRLSPolicies(),
    storageAnalysis: await analyzeOrganizationDocuments(),
    schemaAnalysis: await analyzeDatabaseSchema(),
    businessAnalysis: await analyzeBusinessData(),
    askBDIDataMap: await generateAskBDIDataMap()
  };

  // Output results with security focus
  console.log('📋 COMPREHENSIVE ANALYSIS RESULTS:');
  console.log('=====================================');
  
  if (results.securityAnalysis) {
    console.log('\n🔒 SECURITY ANALYSIS:');
    console.log(`Total Tables: ${results.securityAnalysis.totalTables}`);
    console.log(`Unrestricted Tables: ${results.securityAnalysis.unrestrictedTables.length}`);
    console.log(`HIGH RISK Unrestricted:`, results.securityAnalysis.highRiskUnrestricted.map(t => t.table_name));
    console.log(`MEDIUM RISK Unrestricted:`, results.securityAnalysis.mediumRiskUnrestricted.map(t => t.table_name));
    console.log(`Total Exposed Records: ${results.securityAnalysis.totalExposedRecords}`);
    console.log(`Protected Tables: ${results.securityAnalysis.protectedTables.length}`);
  }
  
  if (results.storageAnalysis) {
    console.log('\n📁 STORAGE ANALYSIS:');
    console.log(`Total Files: ${results.storageAnalysis.totalFiles}`);
    console.log(`File Types:`, results.storageAnalysis.fileTypes);
    console.log(`Organization Folders:`, Object.keys(results.storageAnalysis.organizationFolders));
    console.log(`Document Categories:`, results.storageAnalysis.documentCategories);
    console.log(`Total Storage Size: ${(results.storageAnalysis.totalSize / 1024 / 1024).toFixed(2)} MB`);
  }

  if (results.schemaAnalysis) {
    console.log('\n🗄️ SCHEMA ANALYSIS:');
    console.log(`Total Tables: ${results.schemaAnalysis.totalTables}`);
    console.log('Table Details:', Object.keys(results.schemaAnalysis.tableDetails));
  }

  if (results.businessAnalysis) {
    console.log('\n📊 BUSINESS DATA ANALYSIS:');
    console.log('Organizations:', Object.keys(results.businessAnalysis.organizations));
    console.log('CPFR Signals:', results.businessAnalysis.cpfrSignals);
  }

  if (results.askBDIDataMap) {
    console.log('\n🎯 ASK BDI DATA MAP:');
    console.log('Core Business Entities:', Object.keys(results.askBDIDataMap.coreBusinessEntities));
    console.log('Document Storage Buckets:', results.askBDIDataMap.documentStorage.buckets);
    console.log('CPFR Signal Types:', results.askBDIDataMap.cpfrSignals.signalTypes);
    console.log('Organization-Scoped Tables:', results.askBDIDataMap.apiAccessPatterns.organizationScoped);
  }

  // Save results to file for Ask BDI algorithm
  fs.writeFileSync(
    path.join(process.cwd(), 'ask-bdi-comprehensive-analysis.json'), 
    JSON.stringify(results, null, 2)
  );

  console.log('\n✅ Comprehensive analysis complete! Results saved to ask-bdi-comprehensive-analysis.json');
  
  // Generate security recommendations
  if (results.securityAnalysis && results.securityAnalysis.unrestrictedTables.length > 0) {
    console.log('\n🚨 CRITICAL SECURITY RECOMMENDATIONS:');
    console.log('=====================================');
    console.log('The following tables require immediate RLS policy implementation:');
    
    results.securityAnalysis.highRiskUnrestricted.forEach(table => {
      console.log(`❌ HIGH RISK: ${table.table_name} (${table.estimated_row_count} exposed records)`);
    });
    
    results.securityAnalysis.mediumRiskUnrestricted.forEach(table => {
      console.log(`⚠️  MEDIUM RISK: ${table.table_name} (${table.estimated_row_count} exposed records)`);
    });
    
    console.log('\nRecommended immediate actions:');
    console.log('1. Implement organization-scoped RLS policies for multi-tenant tables');
    console.log('2. Add user-scoped RLS policies for sensitive user data');
    console.log('3. Secure API keys table with strict access controls');
    console.log('4. Review and restrict public bucket access');
  }
  
  return results;
}

// Export for use in other modules
export {
  analyzeRLSPolicies,
  analyzeOrganizationDocuments,
  analyzeDatabaseSchema,
  analyzeBusinessData,
  generateAskBDIDataMap,
  runCompleteAnalysis
};

// Run analysis if called directly
if (typeof require !== 'undefined' && require.main === module) {
  runCompleteAnalysis().catch(console.error);
}
