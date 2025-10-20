/**
 * Amazon FBA Inventory Sync API
 * Automatically requests, downloads, and processes inventory reports
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';
import { AmazonSPAPIService } from '@/lib/services/amazon-sp-api';

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

/**
 * Parse boolean from CSV string
 */
function parseBoolean(value: string): boolean {
  return value?.toLowerCase() === 'yes' || value?.toLowerCase() === 'true';
}

/**
 * Parse integer from CSV string
 */
function parseInteger(value: string): number {
  if (!value || value === '') return 0;
  const num = parseInt(value);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse decimal from CSV string
 */
function parseDecimal(value: string): number | null {
  if (!value || value === '') return null;
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Amazon API configuration
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        error: 'Amazon API not configured',
      }, { status: 400 });
    }

    const credentials = getAmazonCredentials();
    const amazon = new AmazonSPAPIService(credentials);

    console.log('🚀 Starting automated inventory sync...');

    // Use the working client method that handles everything
    const csvText = await amazon.getInventoryReport();

    console.log(`✅ Inventory report downloaded: ${csvText.split('\n').length} lines`);

    // TODO: Parse and store inventory data
    // For now, just return success

    return NextResponse.json({
      success: true,
      message: 'Inventory report downloaded successfully',
      lines: csvText.split('\n').length,
    });

  } catch (error: any) {
    console.error('❌ Inventory sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
