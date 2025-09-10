import { createClient } from '@supabase/supabase-js';

// Schema-Aware AI Prompt Builder
export class SchemaAwarePromptBuilder {
  private serviceSupabase;

  constructor() {
    this.serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // Scan entire database schema and build god-like AI prompt
  async buildUltimatePrompt(): Promise<string> {
    console.log('🧠 Building schema-aware AI prompt...');
    
    const [
      tableSchemas,
      foreignKeys,
      indexes,
      constraints,
      tableStats,
      sampleData
    ] = await Promise.all([
      this.getTableSchemas(),
      this.getForeignKeyRelationships(),
      this.getIndexes(),
      this.getConstraints(),
      this.getTableStatistics(),
      this.getSampleData()
    ]);

    const prompt = `You are BDI's Ultimate Business Intelligence Assistant with COMPLETE knowledge of the entire database schema and business relationships.

🏢 BDI BUSINESS CONTEXT:
- B2B CPFR platform for telecom/networking equipment supply chain
- Partners: MTN (Vietnam Factory), CBN (Compal), OLM (Shipping), EMG (Warehouse)
- Products: Motorola networking devices (routers, modems, hotspots)

🗄️ COMPLETE DATABASE SCHEMA KNOWLEDGE:
${this.formatTableSchemas(tableSchemas)}

🔗 TABLE RELATIONSHIPS & FOREIGN KEYS:
${this.formatRelationships(foreignKeys)}

📊 CURRENT DATA STATISTICS:
${this.formatTableStats(tableStats)}

🔍 BUSINESS DATA PATTERNS:
${this.formatSampleData(sampleData)}

📋 QUERY CAPABILITIES:
You have FULL ACCESS to query any table, join across relationships, and perform complex analysis including:

**CORE BUSINESS TABLES:**
- organizations: Company data (BDI, MTN, CBN, OLM, EMG)
- product_skus: All products with manufacturer (mfg field), categories, specifications
- sales_forecasts: Demand planning with CPFR signals (sales, factory, shipping, transit, warehouse)
- shipments: Logistics with 3-step flow (origin factory, shipper, destination)
- invoices + invoice_line_items: Financial transactions and SKU sales data
- purchase_orders: Procurement and supplier management

**INVENTORY & WAREHOUSE:**
- warehouses: Facility specifications, capabilities, contacts
- emg_inventory_tracking: REAL-TIME EMG inventory levels (qty_on_hand, qty_allocated, qty_backorder, net_stock)
- emg_inventory_history: Inventory change tracking and trends
- production_files: Manufacturing files and device metadata

**OPERATIONAL TRACKING:**
- jjolm_tracking + jjolm_history: Shipping logistics and timeline tracking
- users + organization_members: User access and roles
- organization_connections: Inter-company data sharing permissions

🎯 ADVANCED ANALYSIS CAPABILITIES:
- **Inventory Analysis**: Current stock levels, allocation efficiency, backorder management
- **Manufacturer Performance**: SKU performance by MTN, CBN, etc.
- **Supply Chain Flow**: Factory → Shipper → Warehouse tracking
- **CPFR Signal Analysis**: Collaboration effectiveness across partners
- **Financial Insights**: Revenue by customer, margin analysis, payment terms
- **Operational KPIs**: Lead times, delivery performance, capacity utilization

💼 COMMUNICATION STYLE:
- Lead with specific data points and numbers
- Cite exact table/field sources for transparency
- Provide actionable business recommendations
- Use professional supply chain terminology
- Format numbers clearly (e.g., "24,544 units", "$2.6M revenue")

🔍 QUERY STRATEGY:
When answering questions:
1. Identify which tables contain relevant data
2. Consider relationships and joins needed
3. Provide specific numbers with context
4. Explain data sources and freshness
5. Offer business insights and recommendations

You are essentially a senior business intelligence analyst with COMPLETE access to BDI's data warehouse and deep understanding of supply chain operations.`;

    console.log('🧠 Schema-aware prompt built successfully');
    return prompt;
  }

  // Get complete table schemas
  private async getTableSchemas() {
    const { data, error } = await this.serviceSupabase.rpc('get_table_schemas');
    if (error) {
      console.error('Error getting table schemas:', error);
      // Fallback to basic schema query
      return await this.getBasicTableSchemas();
    }
    return data;
  }

  // Fallback basic schema query
  private async getBasicTableSchemas() {
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'information_schema%'
      ORDER BY table_name, ordinal_position
    `;
    
    const { data, error } = await this.serviceSupabase.rpc('exec_sql', { sql: query });
    return data || [];
  }

  // Get foreign key relationships
  private async getForeignKeyRelationships() {
    const query = `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `;
    
    const { data, error } = await this.serviceSupabase.rpc('exec_sql', { sql: query });
    return data || [];
  }

  // Get table statistics
  private async getTableStatistics() {
    const tables = [
      'organizations', 'product_skus', 'sales_forecasts', 'shipments', 'invoices', 
      'warehouses', 'emg_inventory_tracking', 'purchase_orders', 'users'
    ];
    
    const stats = await Promise.all(
      tables.map(async (table) => {
        const { count, error } = await this.serviceSupabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        return { table, count: count || 0, error };
      })
    );
    
    return stats;
  }

  // Get indexes for performance context
  private async getIndexes() {
    const query = `
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `;
    
    const { data, error } = await this.serviceSupabase.rpc('exec_sql', { sql: query });
    return data || [];
  }

  // Get constraints for business rules
  private async getConstraints() {
    const query = `
      SELECT 
        table_name,
        constraint_name,
        constraint_type,
        check_clause
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.check_constraints cc
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.constraint_type IN ('CHECK', 'UNIQUE')
      ORDER BY table_name, constraint_name
    `;
    
    const { data, error } = await this.serviceSupabase.rpc('exec_sql', { sql: query });
    return data || [];
  }

  // Get sample data for context
  private async getSampleData() {
    const samples = await Promise.all([
      this.serviceSupabase.from('product_skus').select('sku, name, mfg, category').limit(5),
      this.serviceSupabase.from('organizations').select('code, name, type').limit(5),
      this.serviceSupabase.from('emg_inventory_tracking').select('model, qty_on_hand, location').limit(5),
      this.serviceSupabase.from('sales_forecasts').select('delivery_week, quantity, status').limit(3)
    ]);
    
    return {
      sampleSKUs: samples[0].data || [],
      sampleOrgs: samples[1].data || [],
      sampleInventory: samples[2].data || [],
      sampleForecasts: samples[3].data || []
    };
  }

  // Format table schemas for AI prompt
  private formatTableSchemas(schemas: any[]): string {
    const tableGroups = this.groupBy(schemas, 'table_name');
    
    return Object.entries(tableGroups)
      .map(([tableName, columns]) => {
        const columnArray = Array.isArray(columns) ? columns : [];
        const columnList = columnArray
          .map((col: any) => `  ${col.column_name} (${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''})${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`)
          .join('\n');
        
        return `📋 ${tableName}:\n${columnList}`;
      })
      .join('\n\n');
  }

  // Format relationships for AI understanding
  private formatRelationships(relationships: any[]): string {
    return relationships
      .map((rel: any) => `${rel.table_name}.${rel.column_name} → ${rel.foreign_table_name}.${rel.foreign_column_name}`)
      .join('\n');
  }

  // Format table statistics
  private formatTableStats(stats: any[]): string {
    return stats
      .map((stat: any) => `${stat.table}: ${stat.count?.toLocaleString() || 0} records`)
      .join('\n');
  }

  // Format sample data for context
  private formatSampleData(samples: any): string {
    return `
Sample SKUs: ${JSON.stringify(samples.sampleSKUs, null, 2)}
Sample Organizations: ${JSON.stringify(samples.sampleOrgs, null, 2)}
Sample EMG Inventory: ${JSON.stringify(samples.sampleInventory, null, 2)}
Sample Forecasts: ${JSON.stringify(samples.sampleForecasts, null, 2)}
    `;
  }

  // Helper function to group array by key
  private groupBy(array: any[], key: string) {
    return array.reduce((groups: any, item: any) => {
      const value = item[key];
      if (!groups[value]) {
        groups[value] = [];
      }
      groups[value].push(item);
      return groups;
    }, {});
  }
}

// Export singleton instance
export const schemaPromptBuilder = new SchemaAwarePromptBuilder();
