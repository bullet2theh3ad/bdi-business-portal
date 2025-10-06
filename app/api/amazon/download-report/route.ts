/**
 * Amazon SP-API Download Report by Document ID
 * Downloads an existing report without requesting a new one
 */

import { NextRequest, NextResponse } from 'next/server';
import { AmazonSPAPIClient } from '@/lib/services/amazon-sp-api/client';
import { getAmazonCredentials, getConfigStatus } from '@/lib/services/amazon-sp-api/config';

export async function GET(request: NextRequest) {
  try {
    const status = getConfigStatus();
    if (!status.configured) {
      return NextResponse.json({
        success: false,
        error: 'Not configured',
      }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    
    if (!documentId) {
      return NextResponse.json({
        success: false,
        error: 'documentId parameter is required',
        example: '/api/amazon/download-report?documentId=amzn1.spdoc...',
      }, { status: 400 });
    }

    const credentials = getAmazonCredentials();
    const client = new AmazonSPAPIClient(credentials);

    console.log(`[Download Report] Downloading document: ${documentId}`);
    
    const startTime = Date.now();
    const reportData = await client.downloadReport(documentId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Detect format (XML vs TSV/CSV)
    const isXML = reportData.trim().startsWith('<?xml');
    const lines = reportData.split('\n');
    
    let parsedData: any = {};
    
    if (isXML) {
      // XML format (settlement reports)
      parsedData = {
        format: 'XML',
        size: reportData.length,
        preview: reportData.substring(0, 500),
        totalLines: lines.length,
      };
    } else {
      // TSV/CSV format
      const headers = lines[0]?.split('\t') || [];
      const dataRows = lines.slice(1).filter(line => line.trim());
      
      parsedData = {
        format: 'TSV',
        totalRecords: dataRows.length,
        headers: headers.slice(0, 15),
        sampleRows: dataRows.slice(0, 3).map(row => row.split('\t').slice(0, 5)),
        totalLines: lines.length,
      };
    }

    console.log(`[Download Report] Downloaded in ${duration}s - ${reportData.length} bytes`);

    return NextResponse.json({
      success: true,
      documentId,
      performance: {
        durationSeconds: Number(duration),
        sizeBytes: reportData.length,
      },
      data: parsedData,
      // Include full content for download
      content: reportData,
    });

  } catch (error) {
    console.error('[Download Report] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
