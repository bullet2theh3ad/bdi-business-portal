/**
 * Test Data Sources for Sales Velocity
 * Baby steps to see what data is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Service role client for bypassing RLS
const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(request: NextRequest) {
  const results: any = {
    timestamp: new Date().toISOString(),
    dataSources: {},
  };

  console.log('🔍 Testing Data Sources for Sales Velocity...');

  // 1. Test Amazon Financial Events
  try {
    const { data: financialEvents, error } = await supabaseService
      .from('amazon_financial_events')
      .select('*')
      .limit(5);

    results.dataSources.amazonFinancialEvents = {
      exists: !error,
      error: error?.message || null,
      sampleCount: financialEvents?.length || 0,
      sample: financialEvents?.[0] || null,
    };
    console.log('✅ Amazon Financial Events:', results.dataSources.amazonFinancialEvents);
  } catch (err: any) {
    results.dataSources.amazonFinancialEvents = {
      exists: false,
      error: err.message,
    };
    console.log('❌ Amazon Financial Events:', err.message);
  }

  // 2. Test Amazon Inventory Snapshots
  try {
    const { data: inventory, error } = await supabaseService
      .from('amazon_inventory_snapshots')
      .select('*')
      .limit(5);

    results.dataSources.amazonInventorySnapshots = {
      exists: !error,
      error: error?.message || null,
      sampleCount: inventory?.length || 0,
      sample: inventory?.[0] || null,
    };
    console.log('✅ Amazon Inventory Snapshots:', results.dataSources.amazonInventorySnapshots);
  } catch (err: any) {
    results.dataSources.amazonInventorySnapshots = {
      exists: false,
      error: err.message,
    };
    console.log('❌ Amazon Inventory Snapshots:', err.message);
  }

  // 3. Test EMG Inventory
  try {
    const { data: emgInventory, error } = await supabaseService
      .from('emg_inventory_tracking')
      .select('*')
      .limit(5);

    results.dataSources.emgInventory = {
      exists: !error,
      error: error?.message || null,
      sampleCount: emgInventory?.length || 0,
      sample: emgInventory?.[0] || null,
    };
    console.log('✅ EMG Inventory:', results.dataSources.emgInventory);
  } catch (err: any) {
    results.dataSources.emgInventory = {
      exists: false,
      error: err.message,
    };
    console.log('❌ EMG Inventory:', err.message);
  }

  // 4. Test CATV WIP Units
  try {
    const { data: wipUnits, error } = await supabaseService
      .from('warehouse_wip_units')
      .select('*')
      .limit(5);

    results.dataSources.catvWipUnits = {
      exists: !error,
      error: error?.message || null,
      sampleCount: wipUnits?.length || 0,
      sample: wipUnits?.[0] || null,
    };
    console.log('✅ CATV WIP Units:', results.dataSources.catvWipUnits);
  } catch (err: any) {
    results.dataSources.catvWipUnits = {
      exists: false,
      error: err.message,
    };
    console.log('❌ CATV WIP Units:', err.message);
  }

  // 5. Test Sales Velocity Tables
  try {
    const { data: calculations, error } = await supabaseService
      .from('sales_velocity_calculations')
      .select('*')
      .limit(1);

    results.dataSources.salesVelocityCalculations = {
      exists: !error,
      error: error?.message || null,
      sampleCount: calculations?.length || 0,
    };
    console.log('✅ Sales Velocity Calculations:', results.dataSources.salesVelocityCalculations);
  } catch (err: any) {
    results.dataSources.salesVelocityCalculations = {
      exists: false,
      error: err.message,
    };
    console.log('❌ Sales Velocity Calculations:', err.message);
  }

  try {
    const { data: metrics, error } = await supabaseService
      .from('sales_velocity_metrics')
      .select('*')
      .limit(1);

    results.dataSources.salesVelocityMetrics = {
      exists: !error,
      error: error?.message || null,
      sampleCount: metrics?.length || 0,
    };
    console.log('✅ Sales Velocity Metrics:', results.dataSources.salesVelocityMetrics);
  } catch (err: any) {
    results.dataSources.salesVelocityMetrics = {
      exists: false,
      error: err.message,
    };
    console.log('❌ Sales Velocity Metrics:', err.message);
  }

  // Summary
  const existingTables = Object.entries(results.dataSources)
    .filter(([_, value]: any) => value.exists)
    .map(([key]) => key);

  const missingTables = Object.entries(results.dataSources)
    .filter(([_, value]: any) => !value.exists)
    .map(([key]) => key);

  results.summary = {
    totalDataSources: Object.keys(results.dataSources).length,
    existingCount: existingTables.length,
    missingCount: missingTables.length,
    existing: existingTables,
    missing: missingTables,
  };

  console.log('\n📊 SUMMARY:');
  console.log(`✅ Existing: ${existingTables.join(', ')}`);
  console.log(`❌ Missing: ${missingTables.join(', ')}`);

  return NextResponse.json(results, { status: 200 });
}

