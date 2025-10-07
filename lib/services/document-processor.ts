/**
 * Document Processor Service
 * Uses OpenAI GPT-4 for intelligent document extraction
 * Extracts text from PDFs and Word documents for NRE line item auto-fill
 */

import mammoth from 'mammoth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedDocument {
  text: string;
  metadata: {
    pages?: number;
    title?: string;
    author?: string;
    creationDate?: Date;
    modificationDate?: Date;
  };
  lineItems: ExtractedLineItem[];
  vendorInfo?: {
    name?: string;
    contact?: string;
    quoteNumber?: string;
    quoteDate?: string;
  };
}

export interface ExtractedLineItem {
  lineNumber?: number;
  description: string;
  category: string;
  quantity?: number;
  unitPrice?: number;
  totalAmount?: number;
  confidence: number; // 0-1 score
}

/**
 * Extract text and structured data from PDF
 * STEP 1: Just convert PDF → PNG and save it (NO OpenAI yet)
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<ExtractedDocument> {
  try {
    console.log('📄 Converting PDF to PNG...');
    
    const fs = await import('fs');
    const path = await import('path');
    const { fromBuffer } = await import('pdf2pic');
    
    // Ensure temp directory exists
    await fs.promises.mkdir('./public/temp', { recursive: true });
    
    // Create converter
    const converter = fromBuffer(buffer, {
      density: 300,           // High DPI for quality
      saveFilename: 'nre-preview',
      savePath: './public/temp',
      format: 'png',
      width: 2400,           // High resolution
      height: 3000,
    });
    
    console.log('🔄 Converting PDF page 1 to PNG...');
    
    // Convert first page
    const result = await converter(1, { responseType: 'buffer' });
    
    const imagePath = './public/temp/nre-preview.1.png';
    
    console.log(`✅ PNG created at: ${imagePath}`);
    console.log(`📸 VIEW IT HERE: http://localhost:3000/temp/nre-preview.1.png`);
    if (result.buffer) {
      console.log(`📊 Image size: ${(result.buffer.length / 1024).toFixed(2)} KB`);
    }
    console.log(`⏸️  STOPPED - Not sending to OpenAI yet. Check the image first!`);

    // Return empty result for now
    return {
      text: 'Image created - not processed yet',
      metadata: {
        pages: 1,
      },
      lineItems: [],
      vendorInfo: undefined,
    };
  } catch (error) {
    console.error('PDF to PNG conversion error:', error);
    throw new Error(`Failed to convert PDF to PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from Word document (100% local)
 */
export async function extractTextFromWord(buffer: Buffer): Promise<ExtractedDocument> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    return {
      text,
      metadata: {},
      lineItems: parseLineItems(text),
      vendorInfo: extractVendorInfo(text),
    };
  } catch (error) {
    console.error('Word extraction error:', error);
    throw new Error(`Failed to extract Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse line items from extracted text using regex patterns
 */
function parseLineItems(text: string): ExtractedLineItem[] {
  const lineItems: ExtractedLineItem[] = [];
  const lines = text.split('\n');
  
  // Pattern to match line items with amounts
  // Examples: "1. Tooling - $5,000", "Engineering hours: $12,500.00", "Mold fabrication 3500"
  const lineItemPattern = /(?:(\d+)[\.\)]\s*)?(.+?)[\s:$]*?([\d,]+\.?\d*)\s*$/;
  
  // Pattern to match currency amounts
  const amountPattern = /\$?\s*([\d,]+\.?\d*)/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 5) continue;
    
    // Try to match line item pattern
    const match = line.match(lineItemPattern);
    if (match) {
      const [, lineNum, description, amountStr] = match;
      const amount = parseFloat(amountStr.replace(/,/g, ''));
      
      // Skip if amount is too small (likely not a real line item)
      if (amount < 10) continue;
      
      // Categorize based on keywords
      const category = categorizeLineItem(description);
      
      lineItems.push({
        lineNumber: lineNum ? parseInt(lineNum) : undefined,
        description: description.trim(),
        category,
        totalAmount: amount,
        confidence: 0.7, // Medium confidence for regex extraction
      });
    }
  }
  
  return lineItems;
}

/**
 * Categorize line item based on keywords (local processing)
 */
function categorizeLineItem(description: string): string {
  const desc = description.toLowerCase();
  
  // NRE Design
  if (/design|electrical|mechanical|engineering hours|schematic|pcb|layout/.test(desc)) {
    return 'NRE_DESIGN';
  }
  
  // Tooling
  if (/tooling|mold|jig|fixture|rework|fabrication/.test(desc)) {
    return 'TOOLING';
  }
  
  // EVT/DVT/PVT
  if (/evt|dvt|pvt|validation|prototype|build/.test(desc)) {
    return 'EVT_DVT_PVT';
  }
  
  // Certifications
  if (/certification|fcc|ul|ce|rohs|testing|compliance/.test(desc)) {
    return 'CERTIFICATIONS';
  }
  
  // Field Testing
  if (/field test|pilot|trial|beta|field trial/.test(desc)) {
    return 'FIELD_TESTING';
  }
  
  // ODM Setup
  if (/odm|setup|factory|line setup|production setup/.test(desc)) {
    return 'ODM_SETUP';
  }
  
  // Firmware
  if (/firmware|software|ota|development|programming/.test(desc)) {
    return 'FIRMWARE';
  }
  
  // Logistics Samples
  if (/logistics|sample|shipment|shipping|prototype shipment/.test(desc)) {
    return 'LOGISTICS_SAMPLES';
  }
  
  // Warranty / Reliability
  if (/warranty|reliability|halt|burn-in|stress test/.test(desc)) {
    return 'WARRANTY_RELIABILITY';
  }
  
  // Default to Others
  return 'OTHERS';
}

/**
 * Extract vendor information from text
 */
function extractVendorInfo(text: string): ExtractedDocument['vendorInfo'] {
  const vendorInfo: ExtractedDocument['vendorInfo'] = {};
  
  // Extract quote number (e.g., "Quote #12345", "Q-2024-001")
  const quoteMatch = text.match(/quote\s*#?\s*:?\s*([A-Z0-9-]+)/i);
  if (quoteMatch) {
    vendorInfo.quoteNumber = quoteMatch[1];
  }
  
  // Extract date (various formats)
  const dateMatch = text.match(/(?:date|dated)[\s:]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dateMatch) {
    vendorInfo.quoteDate = dateMatch[1];
  }
  
  // Extract vendor name (look for "From:", "Vendor:", company name patterns)
  const vendorMatch = text.match(/(?:from|vendor|company)[\s:]+([A-Z][A-Za-z\s&,\.]+?)(?:\n|$)/i);
  if (vendorMatch) {
    vendorInfo.name = vendorMatch[1].trim();
  }
  
  // Extract contact email
  const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    vendorInfo.contact = emailMatch[1];
  }
  
  return vendorInfo;
}

/**
 * Main entry point - auto-detect file type and extract
 */
export async function processDocument(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractedDocument> {
  console.log(`📄 Processing document locally (${mimeType})...`);
  
  if (mimeType === 'application/pdf' || mimeType.includes('pdf')) {
    return await extractTextFromPDF(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType.includes('word') ||
    mimeType.includes('docx')
  ) {
    return await extractTextFromWord(buffer);
  } else {
    throw new Error(`Unsupported document type: ${mimeType}`);
  }
}

/**
 * Format extracted data for database insertion
 */
export function formatForDatabase(
  extracted: ExtractedDocument,
  documentId: string,
  userId: string
) {
  return extracted.lineItems.map((item, index) => ({
    document_id: documentId,
    line_item_number: item.lineNumber || index + 1,
    description: item.description,
    category: item.category,
    quantity: item.quantity || 1,
    unit_price: item.unitPrice,
    total_amount: item.totalAmount || 0,
    currency: 'USD',
    vendor_name: extracted.vendorInfo?.name,
    vendor_contact: extracted.vendorInfo?.contact,
    quote_number: extracted.vendorInfo?.quoteNumber,
    quote_date: extracted.vendorInfo?.quoteDate,
    status: 'pending',
    confidence_score: item.confidence,
    extracted_data: {
      raw_text: extracted.text.substring(0, 5000), // Store first 5000 chars
      metadata: extracted.metadata,
    },
    created_by: userId,
  }));
}
