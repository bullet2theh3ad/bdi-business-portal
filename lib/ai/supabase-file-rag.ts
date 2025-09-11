import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';

// Dynamic import for pdf-parse to avoid build issues
let pdfParse: any = null;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.warn('PDF parsing not available:', error);
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
      
      // Get files from each bucket - enhanced to handle folders
      const allFiles: any[] = [];
      
      for (const bucket of buckets) {
        try {
          // Get root level items
          const { data: rootItems, error: rootError } = await this.serviceSupabase.storage
            .from(bucket.name)
            .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
          
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
              // It's likely a folder, try to list contents
              try {
                const { data: folderFiles, error: folderError } = await this.serviceSupabase.storage
                  .from(bucket.name)
                  .list(item.name, { limit: 100 });
                
                if (!folderError && folderFiles) {
                  for (const file of folderFiles) {
                    if (file.metadata?.size > 0) {
                      allFiles.push({
                        bucket: bucket.name,
                        name: file.name,
                        folder: item.name,
                        size: file.metadata.size,
                        contentType: file.metadata.mimetype || 'unknown',
                        lastModified: file.updated_at || file.created_at,
                        path: `${bucket.name}/${item.name}/${file.name}`,
                        isFile: true
                      });
                    }
                  }
                }
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
  async extractTextContent(file: any): Promise<string | null> {
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
        // PDF files
        if (!pdfParse) {
          console.log(`📄 PDF parsing not available for: ${name}`);
          return `[PDF File: ${name} - PDF parsing library not available]`;
        }
        console.log(`📄 Extracting PDF content from: ${name}`);
        const buffer = await data.arrayBuffer();
        const pdfData = await pdfParse(Buffer.from(buffer));
        return this.formatPDFContent(pdfData.text, name);
        
      } else if (
        contentType?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
        contentType?.includes('application/vnd.ms-excel') ||
        name.toLowerCase().endsWith('.xlsx') ||
        name.toLowerCase().endsWith('.xls')
      ) {
        // Excel files
        console.log(`📊 Extracting Excel content from: ${name}`);
        const buffer = await data.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        return this.formatExcelContent(workbook, name);
        
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
  private formatExcelContent(workbook: XLSX.WorkBook, fileName: string): string {
    const sheetNames = workbook.SheetNames;
    let content = `📊 EXCEL FILE: ${fileName}\n📋 Sheets: ${sheetNames.join(', ')}\n\n`;
    
    // Extract data from first 2 sheets
    for (let i = 0; i < Math.min(2, sheetNames.length); i++) {
      const sheetName = sheetNames[i];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      content += `📋 Sheet "${sheetName}" (first 10 rows):\n`;
      content += jsonData.slice(0, 10).map((row: any) => row.join(' | ')).join('\n');
      content += `\n📊 Total rows in ${sheetName}: ${jsonData.length}\n\n`;
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
      
      // Enhanced search logic
      const queryLower = query.toLowerCase();
      const searchTerms = this.extractSearchTerms(queryLower);
      
      const matchingFiles = availableFiles.filter(file => {
        const fileName = file.name.toLowerCase();
        const filePath = file.path.toLowerCase();
        const bucket = file.bucket.toLowerCase();
        
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
        
        // If asking about specific organizations
        if (searchTerms.includes('emg') || searchTerms.includes('mtn') || searchTerms.includes('cbn')) {
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
        const content = await this.extractTextContent(file);
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

  // Enhanced AI analysis with file content
  async analyzeWithFiles(query: string, businessData: any): Promise<string> {
    try {
      console.log('🧠 Starting enhanced analysis with file content...');
      
      // Get file context
      const fileContext = await this.generateFileContext(query);
      
      // Create enhanced prompt with file data
      const enhancedPrompt = `
You are BDI's Ultimate Business Intelligence Assistant with access to BOTH database and file storage.

QUERY: "${query}"

📊 DATABASE CONTEXT:
${JSON.stringify(businessData, null, 2)}

📁 FILE STORAGE CONTEXT:
${fileContext}

🎯 ANALYSIS INSTRUCTIONS:
1. Analyze the query to determine if file content is relevant
2. Cross-reference database data with file content when applicable
3. Provide comprehensive insights using both data sources
4. Cite specific files and data sources in your response
5. Offer actionable recommendations based on complete information

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
