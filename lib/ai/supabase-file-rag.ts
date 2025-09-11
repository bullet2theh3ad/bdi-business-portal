import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

// PDF parsing with fallback handling
let pdfParse: any = null;

// Initialize PDF parser - simplified approach that works
async function initPdfParse() {
  if (!pdfParse) {
    try {
      // Use require for better compatibility in Node.js environment
      pdfParse = require('pdf-parse-fork');
      console.log('✅ PDF parsing initialized with pdf-parse-fork');
    } catch (error) {
      console.warn('📄 PDF parsing not available:', error instanceof Error ? error.message : String(error));
      pdfParse = null;
    }
  }
  return pdfParse;
}

// Supabase File RAG System
export class SupabaseFileRAG {
  private serviceSupabase;
  private openai;

  constructor() {
    this.serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  // Get all available files from Supabase storage
  async getAvailableFiles(): Promise<any[]> {
    try {
      console.log('📁 Scanning Supabase storage for available files...');
      
      // Get all buckets
      const { data: buckets, error: bucketsError } = await this.serviceSupabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
        return [];
      }
      
      console.log('📁 Found buckets:', buckets.map(b => b.name));
      
      // Get files from each bucket - enhanced to handle folders including RAG documents
      const allFiles: any[] = [];
      
      for (const bucket of buckets) {
        try {
          // Get root level items
          const { data: rootItems, error: rootError } = await this.serviceSupabase.storage
            .from(bucket.name)
            .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
          
          // CRITICAL: Also explicitly check for rag-documents folder
          if (bucket.name === 'organization-documents') {
            console.log('📁 Explicitly scanning rag-documents folder...');
            await this.exploreFolder(bucket.name, 'rag-documents', allFiles, 0);
          }
          
          if (rootError) {
            console.error(`Error listing root items in ${bucket.name}:`, rootError);
            continue;
          }
          
          // Process each item (could be file or folder)
          for (const item of rootItems || []) {
            if (item.metadata?.size > 0) {
              // It's a file
              allFiles.push({
                bucket: bucket.name,
                name: item.name,
                size: item.metadata.size,
                contentType: item.metadata.mimetype || 'unknown',
                lastModified: item.updated_at || item.created_at,
                path: `${bucket.name}/${item.name}`,
                isFile: true
              });
            } else {
              // It's likely a folder, try to list contents recursively
              try {
                await this.exploreFolder(bucket.name, item.name, allFiles);
              } catch (folderError) {
                console.log(`📁 Could not access folder ${item.name} in ${bucket.name}`);
              }
            }
          }
          
          const bucketFileCount = allFiles.filter(f => f.bucket === bucket.name).length;
          console.log(`📁 Found ${bucketFileCount} actual files in ${bucket.name}`);
          
        } catch (error) {
          console.error(`Error accessing bucket ${bucket.name}:`, error);
        }
      }
      
      console.log(`📁 Total files available: ${allFiles.length}`);
      return allFiles;
      
    } catch (error) {
      console.error('Error scanning Supabase storage:', error);
      return [];
    }
  }

  // Recursively explore folder structures to find actual files
  private async exploreFolder(bucket: string, folderPath: string, allFiles: any[], depth: number = 0): Promise<void> {
    // Prevent infinite recursion - increase depth for UUID folder structures
    if (depth > 5) {
      console.log(`📁 Max depth reached for ${bucket}/${folderPath}`);
      return;
    }
    
    try {
      console.log(`📁 Exploring folder: ${bucket}/${folderPath} (depth: ${depth})`);
      
      const { data: folderItems, error: folderError } = await this.serviceSupabase.storage
        .from(bucket)
        .list(folderPath, { limit: 100 });
      
      if (folderError || !folderItems) {
        console.log(`📁 Could not list items in ${bucket}/${folderPath}:`, folderError);
        return;
      }
      
      for (const item of folderItems) {
        const itemPath = `${folderPath}/${item.name}`;
        
        if (item.metadata?.size > 0) {
          // It's a file
          allFiles.push({
            bucket: bucket,
            name: item.name,
            folder: folderPath,
            size: item.metadata.size,
            contentType: item.metadata.mimetype || 'unknown',
            lastModified: item.updated_at || item.created_at,
            path: itemPath,
            isFile: true
          });
          console.log(`📄 Found file: ${itemPath} (${item.metadata.size} bytes)`);
        } else {
          // It's likely another folder (could be UUID folder), explore recursively
          console.log(`📁 Found subfolder: ${itemPath} - exploring deeper...`);
          await this.exploreFolder(bucket, itemPath, allFiles, depth + 1);
        }
      }
      
    } catch (error) {
      console.error(`Error exploring folder ${bucket}/${folderPath}:`, error);
    }
  }

  // Get file content for analysis - enhanced path handling
  async getFileContent(bucket: string, filePath: string): Promise<string | null> {
    try {
      console.log(`📥 Downloading file: ${bucket}/${filePath}`);
      
      const { data, error } = await this.serviceSupabase.storage
        .from(bucket)
        .download(filePath);
      
      if (error) {
        console.error(`Error downloading file ${bucket}/${filePath}:`, error);
        return null;
      }
      
      // Convert blob to text for supported file types
      const text = await data.text();
      console.log(`📄 Successfully read ${text.length} characters from ${filePath}`);
      return text;
      
    } catch (error) {
      console.error(`Error reading file content:`, error);
      return null;
    }
  }

  // Extract text content from various file types - ENHANCED
  async extractTextContent(file: any, query?: string): Promise<string | null> {
    // Store current query for deep analysis detection
    (this as any).currentQuery = query;
    try {
      const { bucket, name, contentType } = file;
      console.log(`📄 Extracting content from: ${name} (${contentType})`);
      
      // Get raw file data using the correct path
      const downloadPath = file.folder ? `${file.folder}/${name}` : name;
      console.log(`📥 Attempting download: ${bucket}/${downloadPath}`);
      
      const { data, error } = await this.serviceSupabase.storage
        .from(bucket)
        .download(downloadPath);
      
      if (error) {
        console.error(`Error downloading file ${bucket}/${downloadPath}:`, error);
        return `[Error downloading file: ${name} - ${error.message}]`;
      }
      
      if (!data || data.size === 0) {
        console.log(`📁 File appears to be empty or is a folder: ${name}`);
        return `[File: ${name} - Empty or folder, no content available]`;
      }
      
      // Handle different file types
      if (contentType?.includes('text/csv') || name.toLowerCase().endsWith('.csv')) {
        // CSV files
        const text = await data.text();
        return this.formatCSVContent(text, name);
        
      } else if (contentType?.includes('text/') || name.toLowerCase().endsWith('.txt')) {
        // Plain text files
        return await data.text();
        
      } else if (contentType?.includes('application/pdf') || name.toLowerCase().endsWith('.pdf')) {
        // PDF files with proper error handling
        try {
          const pdfParser = await initPdfParse();
          if (!pdfParser) {
            console.log(`📄 PDF parsing not available for: ${name}`);
            return `[PDF File: ${name} - Content extraction not available. File contains: ${name.includes('PI') ? 'Proforma Invoice' : 'PDF document'} - please open directly to view content.]`;
          }
          
          console.log(`📄 Extracting PDF content from: ${name}`);
          const buffer = await data.arrayBuffer();
          
          // Add timeout and size limits for safety
          if (buffer.byteLength > 10 * 1024 * 1024) { // 10MB limit
            return `[PDF File: ${name} - File too large for processing (${Math.round(buffer.byteLength / 1024 / 1024)}MB)]`;
          }
          
          const pdfData = await pdfParser(Buffer.from(buffer));
          return this.formatPDFContent(pdfData.text, name);
          
        } catch (error) {
          console.warn(`📄 Failed to parse PDF ${name}:`, error);
          return `[PDF File: ${name} - Parsing failed. File appears to be: ${name.includes('PI') ? 'Proforma Invoice for MNQ15 devices' : 'PDF document'}. Please open directly for full content.]`;
        }
        
      } else if (
        contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
        contentType?.includes('application/vnd.ms-excel') ||
        name.toLowerCase().endsWith('.xlsx') ||
        name.toLowerCase().endsWith('.xls')
      ) {
        // Excel files with smart analysis detection
        console.log(`📊 Extracting Excel content from: ${name}`);
        const buffer = await data.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        
        // Detect if user is requesting deep analysis
        const deepAnalysisKeywords = ['full data', 'all rows', 'complete analysis', 'deep analysis', 
                                     'comprehensive', 'all data', 'full extraction', 'analyze the', 'with all'];
        const isDeepAnalysisRequest = deepAnalysisKeywords.some(keyword => 
          (this as any).currentQuery?.toLowerCase().includes(keyword)
        );
        
        return this.formatExcelContent(workbook, name, isDeepAnalysisRequest);
        
      } else if (
        contentType?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
        name.toLowerCase().endsWith('.docx')
      ) {
        // Word documents
        console.log(`📝 Extracting Word content from: ${name}`);
        const buffer = await data.arrayBuffer();
        const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
        return this.formatWordContent(result.value, name);
        
      } else if (contentType?.includes('application/json') || name.toLowerCase().endsWith('.json')) {
        // JSON files
        const text = await data.text();
        const jsonData = JSON.parse(text);
        return this.formatJSONContent(jsonData, name);
        
      } else {
        console.log(`📄 Unsupported file type: ${contentType} for ${name}`);
        return `[File: ${name} - Type: ${contentType} - Content extraction not supported yet]`;
      }
      
    } catch (error) {
      console.error('Error extracting text content:', error);
      return `[Error extracting content from ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  // Format CSV content for AI analysis
  private formatCSVContent(csvText: string, fileName: string): string {
    const lines = csvText.split('\n').slice(0, 20); // First 20 lines
    return `
📊 CSV FILE: ${fileName}
📋 Content (first 20 rows):
${lines.join('\n')}

📈 CSV Summary:
- Total rows: ~${csvText.split('\n').length}
- Headers: ${lines[0] || 'Not available'}
- File type: Structured data (CSV)
    `;
  }

  // Format PDF content for AI analysis
  private formatPDFContent(pdfText: string, fileName: string): string {
    const preview = pdfText.substring(0, 2000);
    return `
📄 PDF FILE: ${fileName}
📋 Content Preview (first 2000 characters):
${preview}${pdfText.length > 2000 ? '...' : ''}

📈 PDF Summary:
- Total characters: ${pdfText.length.toLocaleString()}
- File type: Document (PDF)
    `;
  }

  // Format Excel content for AI analysis
  private formatExcelContent(workbook: XLSX.WorkBook, fileName: string, deepAnalysis: boolean = false): string {
    const sheetNames = workbook.SheetNames;
    let content = `📊 EXCEL FILE: ${fileName}\n📋 ALL SHEETS: ${sheetNames.join(', ')}\n\n`;
    
    // First, scan all sheets to get structure and sizes
    const sheetAnalysis: any[] = [];
    let totalRows = 0;
    let hasLargeSheets = false;
    
    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      const isFinancialSheet = /^(PL|P&L|CF|Revenue|Costs|KPI|Financial|Income|Profit|Loss)$/i.test(sheetName);
      
      sheetAnalysis.push({
        name: sheetName,
        rows: jsonData.length,
        isFinancial: isFinancialSheet,
        data: jsonData
      });
      
      totalRows += jsonData.length;
      if (jsonData.length > 100) hasLargeSheets = true;
    }
    
    // If file is large and not doing deep analysis, provide structure overview and ask
    if (hasLargeSheets && !deepAnalysis) {
      content += `🔍 FILE STRUCTURE ANALYSIS:\n`;
      content += `📊 Total sheets: ${sheetNames.length}\n`;
      content += `📊 Total rows across all sheets: ${totalRows.toLocaleString()}\n\n`;
      
      for (const sheet of sheetAnalysis) {
        content += `📋 ${sheet.name.toUpperCase()}: ${sheet.rows.toLocaleString()} rows`;
        if (sheet.isFinancial) content += ` (🔥 FINANCIAL DATA)`;
        if (sheet.rows > 100) content += ` (⚠️ LARGE DATASET)`;
        content += `\n`;
      }
      
      content += `\n🤔 ANALYSIS DECISION REQUIRED:\n`;
      content += `This file contains ${totalRows.toLocaleString()} total rows of data. `;
      content += `Full analysis will take significantly longer but provide complete insights.\n\n`;
      content += `💡 RECOMMENDATION: Ask a specific question like:\n`;
      content += `- "Analyze the PL tab with full data extraction"\n`;
      content += `- "Show me Revenue tab summary with all 900 rows"\n`;
      content += `- "Quick preview of all financial sheets"\n\n`;
      
      // Still show preview of first few rows from each sheet
      for (const sheet of sheetAnalysis) {
        if (sheet.data.length > 0) {
          content += `📋 ${sheet.name.toUpperCase()} PREVIEW (first 3 rows):\n`;
          content += sheet.data.slice(0, 3).map((row: any, index: number) => {
            const cleanRow = row.filter((cell: any) => cell !== null && cell !== undefined && cell !== '');
            return cleanRow.length > 0 ? `${index + 1}: ${cleanRow.join(' | ')}` : '';
          }).filter((row: string) => row).join('\n');
          content += `\n`;
        }
      }
      
      return content;
    }
    
    // DEEP ANALYSIS: Extract comprehensive data from all sheets
    content += `🔥 COMPREHENSIVE ANALYSIS MODE (${totalRows.toLocaleString()} total rows)\n\n`;
    
    for (const sheet of sheetAnalysis) {
      content += `📋 SHEET "${sheet.name.toUpperCase()}" FULL ANALYSIS:\n`;
      content += `📊 Total rows: ${sheet.rows.toLocaleString()}\n`;
      
      if (sheet.data.length > 0) {
        // For deep analysis, extract much more data
        const rowLimit = sheet.isFinancial ? Math.min(sheet.rows, 200) : Math.min(sheet.rows, 100);
        
        content += `📈 Content (${rowLimit} rows extracted):\n`;
        content += sheet.data.slice(0, rowLimit).map((row: any, index: number) => {
          const cleanRow = row.filter((cell: any) => cell !== null && cell !== undefined && cell !== '');
          return cleanRow.length > 0 ? `Row ${index + 1}: ${cleanRow.join(' | ')}` : '';
        }).filter((row: string) => row).join('\n');
        
        // For financial sheets, extract ALL key metrics
        if (sheet.isFinancial && sheet.data.length > 1) {
          content += `\n💰 ALL FINANCIAL METRICS DETECTED:\n`;
          const keyRows = sheet.data.filter((row: any) => {
            const rowText = row.join(' ').toLowerCase();
            return rowText.includes('revenue') || rowText.includes('profit') || 
                   rowText.includes('cost') || rowText.includes('margin') ||
                   rowText.includes('total') || rowText.includes('$') ||
                   rowText.includes('income') || rowText.includes('expense');
          });
          keyRows.forEach((row: any, index: number) => {
            content += `${index + 1}. ${row.filter((cell: any) => cell).join(' | ')}\n`;
          });
        }
      }
      
      content += `\n`;
    }
    
    return content;
  }

  // Format Word document content for AI analysis
  private formatWordContent(wordText: string, fileName: string): string {
    const preview = wordText.substring(0, 2000);
    return `
📝 WORD DOCUMENT: ${fileName}
📋 Content Preview (first 2000 characters):
${preview}${wordText.length > 2000 ? '...' : ''}

📈 Document Summary:
- Total characters: ${wordText.length.toLocaleString()}
- File type: Document (Word)
    `;
  }

  // Format JSON content for AI analysis
  private formatJSONContent(jsonData: any, fileName: string): string {
    return `
🔧 JSON FILE: ${fileName}
📋 Structure:
${JSON.stringify(jsonData, null, 2).substring(0, 1500)}

📈 JSON Summary:
- File type: Structured data (JSON)
- Top-level keys: ${Object.keys(jsonData).join(', ')}
    `;
  }

  // Search files by content or metadata - enhanced matching
  async searchFiles(query: string, maxFiles: number = 10): Promise<any[]> {
    try {
      console.log(`🔍 Searching files for: "${query}"`);
      
      const availableFiles = await this.getAvailableFiles();
      console.log(`📁 Available files:`, availableFiles.map(f => f.name));
      
      // DEBUG: Check if Boundless Financial Model is in available files
      const financialModel = availableFiles.find(f => f.name.includes('Boundless_Financial'));
      if (financialModel) {
        console.log(`🎯 DEBUG: Found Boundless Financial Model in available files: ${financialModel.name}`);
      } else {
        console.log(`❌ DEBUG: Boundless Financial Model NOT found in available files`);
      }
      
      // Enhanced search logic
      const queryLower = query.toLowerCase();
      const searchTerms = this.extractSearchTerms(queryLower);
      
      // CRITICAL: For general file listing queries, return ALL files
      const isGeneralFileQuery = searchTerms.some(term => 
        ['files', 'documents', 'how many', 'list', 'all files', 'total files', 'file count', 'directory', 'rag', 'see'].includes(term)
      ) || queryLower.includes('how many') || queryLower.includes('list') || queryLower.includes('what files') 
        || queryLower.includes('can you see') || queryLower.includes('rag directory') || queryLower.includes('whats in');
      
      if (isGeneralFileQuery) {
        console.log(`📁 General file query detected - returning all ${availableFiles.length} files`);
        // For general queries, return more files but limit content extraction to prevent timeout
        return availableFiles.slice(0, Math.max(maxFiles, 8)); // Further reduced to 8 for faster processing
      }
      
      const matchingFiles = availableFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        const filePath = file.path.toLowerCase();
        const bucket = file.bucket.toLowerCase();
        
        // CRITICAL: If query mentions specific file name, ALWAYS include it
        const fileNameParts = fileName.replace(/[^a-z0-9]/g, ' ').split(' ');
        const queryParts = queryLower.replace(/[^a-z0-9]/g, ' ').split(' ');
        const hasFileNameMatch = fileNameParts.some((part: string) => 
          part.length > 3 && queryParts.some((qPart: string) => qPart.includes(part) || part.includes(qPart))
        );
        
        if (hasFileNameMatch) {
          console.log(`🎯 CRITICAL FILE MATCH: ${fileName} matches query parts - FORCING INCLUSION`);
          return true;
        }
        
        // Direct filename/path matching
        if (fileName.includes(queryLower) || filePath.includes(queryLower)) {
          return true;
        }
        
        // Search term matching
        if (searchTerms.some(term => 
          fileName.includes(term) || filePath.includes(term) || bucket.includes(term)
        )) {
          return true;
        }
        
        // Enhanced content type matching
        if (searchTerms.includes('invoice') && (bucket.includes('organization') || bucket.includes('invoice') || fileName.includes('invoice'))) {
          return true;
        }
        
        if (searchTerms.includes('production') && (bucket.includes('production') || fileName.includes('production'))) {
          return true;
        }
        
        if (searchTerms.includes('shipment') && (bucket.includes('shipment') || fileName.includes('shipment'))) {
          return true;
        }
        
        if (searchTerms.includes('warehouse') && (bucket.includes('warehouse') || fileName.includes('warehouse'))) {
          return true;
        }
        
        // If query asks about "files" in general, include more files
        if (searchTerms.includes('file') && availableFiles.length <= 10) {
          return true; // Include all files if asking generally and not too many
        }
        
        // Purchase orders specific matching
        if (searchTerms.includes('purchase') || searchTerms.includes('orders') || searchTerms.includes('purchase-orders')) {
          return bucket.includes('organization') || filePath.includes('purchase-order') || fileName.includes('purchase');
        }
        
        // RAG documents specific matching
        if (searchTerms.includes('rag') || searchTerms.includes('rag-documents') || searchTerms.includes('directory')) {
          return filePath.includes('rag-documents') || bucket.includes('organization');
        }
        
        // Financial model specific matching
        if (searchTerms.includes('financial') || searchTerms.includes('model') || searchTerms.includes('boundless') || 
            searchTerms.includes('pl') || searchTerms.includes('p&l') || searchTerms.includes('analysis')) {
          return fileName.includes('financial') || fileName.includes('boundless') || fileName.includes('model') ||
                 filePath.includes('rag-documents') || bucket.includes('organization');
        }
        
        // If asking about specific organizations
        if (searchTerms.includes('emg') || searchTerms.includes('mtn') || searchTerms.includes('cbn') || searchTerms.includes('bdi')) {
          return true; // Include organization-related files
        }
        
        return false;
      });
      
      console.log(`🔍 Found ${matchingFiles.length} matching files:`, matchingFiles.map(f => f.name));
      return matchingFiles.slice(0, maxFiles);
      
    } catch (error) {
      console.error('Error searching files:', error);
      return [];
    }
  }

  // Extract search terms from query
  private extractSearchTerms(query: string): string[] {
    const terms = [];
    
    // Common business terms
    if (query.includes('invoice')) terms.push('invoice');
    if (query.includes('production')) terms.push('production');
    if (query.includes('shipment')) terms.push('shipment');
    if (query.includes('warehouse')) terms.push('warehouse');
    if (query.includes('document')) terms.push('document');
    if (query.includes('file')) terms.push('file');
    if (query.includes('report')) terms.push('report');
    if (query.includes('manifest')) terms.push('manifest');
    if (query.includes('jjolm')) terms.push('jjolm');
    if (query.includes('emg')) terms.push('emg');
    if (query.includes('mtn')) terms.push('mtn');
    if (query.includes('cbn')) terms.push('cbn');
    
    return terms;
  }

  // Generate file context for AI
  async generateFileContext(query: string): Promise<string> {
    try {
      console.log('📁 Generating file context for query...');
      
      // Also get database file metadata
      const dbFiles = await this.getFileMetadataFromDB(query);
      
      // Get relevant files from storage
      const relevantFiles = await this.searchFiles(query, 5);
      
      if (relevantFiles.length === 0) {
        return 'No relevant files found in Supabase storage.';
      }
      
      // Extract content from relevant files
      const fileContents: string[] = [];
      
      for (const file of relevantFiles) {
        const content = await this.extractTextContent(file, query);
        if (content) {
          fileContents.push(`
📄 FILE: ${file.name} (${file.bucket})
📅 Modified: ${file.lastModified}
📊 Size: ${(file.size / 1024).toFixed(1)} KB
📋 Content Preview:
${content.substring(0, 1000)}${content.length > 1000 ? '...' : ''}
          `);
        }
      }
      
      return `
🗂️ RELEVANT FILES FOUND (${relevantFiles.length}):
${fileContents.join('\n---\n')}

📁 FILE STORAGE SUMMARY:
- Total relevant files: ${relevantFiles.length}
- Storage buckets accessed: ${[...new Set(relevantFiles.map(f => f.bucket))].join(', ')}
- File types: ${[...new Set(relevantFiles.map(f => f.contentType))].join(', ')}
      `;
      
    } catch (error) {
      console.error('Error generating file context:', error);
      return 'Error accessing file storage for additional context.';
    }
  }

  // Enhanced AI analysis with file content and unified prompt
  async analyzeWithFiles(query: string, businessData: any, customSystemPrompt?: string): Promise<string> {
    try {
      console.log('🧠 Starting enhanced analysis with file content...');
      
      // Get file context
      const fileContext = await this.generateFileContext(query);
      
      // Create enhanced prompt with file data
      // Use custom unified prompt if provided, otherwise use enhanced default
      const enhancedPrompt = customSystemPrompt ? 
        customSystemPrompt + `

📁 FILE STORAGE CONTEXT:
${fileContext}

🎯 UNIFIED ANALYSIS QUERY: "${query}"

CRITICAL INSTRUCTIONS:
1. YOU HAVE DIRECT ACCESS to the file content shown above - USE IT!
2. DO NOT say "I don't have access" - the content is PROVIDED in this prompt
3. ANALYZE the actual data from the files, especially Excel sheet content
4. Cross-reference file content with database records for complete intelligence
5. Provide specific insights from the ACTUAL file data, not generic guidance
        ` :
        `
You are BDI's Ultimate Business Intelligence Assistant with access to BOTH database and file storage.

QUERY: "${query}"

📊 DATABASE CONTEXT:
${JSON.stringify(businessData, null, 2)}

📁 FILE STORAGE CONTEXT:
${fileContext}

🎯 ANALYSIS INSTRUCTIONS:
1. YOU HAVE DIRECT ACCESS to all file content shown above - USE IT!
2. DO NOT say "I don't have access" - the content is PROVIDED in this prompt
3. ANALYZE the actual data from files, especially Excel sheets and their tabs
4. Cross-reference database data with file content when applicable
5. Provide comprehensive insights using both data sources
6. Cite specific files and data sources in your response
7. Offer actionable recommendations based on complete information

MANDATORY: When analyzing Excel files, use the ACTUAL sheet content provided. If asked about a specific tab like "PL", analyze the ACTUAL data from that sheet that's included in the file context above.

Answer with the depth of a senior consultant who has access to all company data and documents.
        `;
      
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: enhancedPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
      
      return completion.choices[0]?.message?.content || 'Unable to generate analysis.';
      
    } catch (error) {
      console.error('Error in enhanced file analysis:', error);
      return 'Error performing enhanced analysis with file content.';
    }
  }

  // Get file metadata from database tables
  private async getFileMetadataFromDB(query: string): Promise<any[]> {
    try {
      console.log('📊 Getting file metadata from database...');
      
      // Query production files, invoice documents, etc.
      const [
        productionFiles,
        invoiceDocuments,
        shipmentDocuments,
        warehouseDocuments
      ] = await Promise.all([
        this.serviceSupabase.from('production_files').select(`
          id, file_name, file_type, organization_id, file_size, content_type,
          device_metadata, description, tags, created_at, uploaded_by
        `).limit(50),
        
        this.serviceSupabase.from('invoice_documents').select(`
          id, file_name, file_type, invoice_id, file_size, content_type,
          description, created_at, uploaded_by
        `).limit(50),
        
        this.serviceSupabase.from('shipment_documents').select(`
          id, file_name, file_type, shipment_id, file_size, content_type,
          description, created_at, uploaded_by
        `).limit(50),
        
        this.serviceSupabase.from('warehouse_documents').select(`
          id, file_name, file_type, warehouse_id, file_size, content_type,
          description, created_at, uploaded_by
        `).limit(50)
      ]);
      
      const allDbFiles = [
        ...(productionFiles.data || []).map((f: any) => ({ ...f, source: 'production_files' })),
        ...(invoiceDocuments.data || []).map((f: any) => ({ ...f, source: 'invoice_documents' })),
        ...(shipmentDocuments.data || []).map((f: any) => ({ ...f, source: 'shipment_documents' })),
        ...(warehouseDocuments.data || []).map((f: any) => ({ ...f, source: 'warehouse_documents' }))
      ];
      
      console.log(`📊 Found ${allDbFiles.length} files in database metadata`);
      return allDbFiles;
      
    } catch (error) {
      console.error('Error getting file metadata from DB:', error);
      return [];
    }
  }
}

// Export singleton instance
export const supabaseFileRAG = new SupabaseFileRAG();
