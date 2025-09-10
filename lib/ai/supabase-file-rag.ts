import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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
      
      // Get files from each bucket
      const allFiles: any[] = [];
      
      for (const bucket of buckets) {
        try {
          const { data: files, error: filesError } = await this.serviceSupabase.storage
            .from(bucket.name)
            .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
          
          if (filesError) {
            console.error(`Error listing files in ${bucket.name}:`, filesError);
            continue;
          }
          
          const bucketFiles = (files || []).map(file => ({
            bucket: bucket.name,
            name: file.name,
            size: file.metadata?.size || 0,
            contentType: file.metadata?.mimetype || 'unknown',
            lastModified: file.updated_at || file.created_at,
            path: `${bucket.name}/${file.name}`
          }));
          
          allFiles.push(...bucketFiles);
          console.log(`📁 Found ${bucketFiles.length} files in ${bucket.name}`);
          
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

  // Get file content for analysis
  async getFileContent(bucket: string, filePath: string): Promise<string | null> {
    try {
      const { data, error } = await this.serviceSupabase.storage
        .from(bucket)
        .download(filePath);
      
      if (error) {
        console.error(`Error downloading file ${bucket}/${filePath}:`, error);
        return null;
      }
      
      // Convert blob to text for supported file types
      const text = await data.text();
      return text;
      
    } catch (error) {
      console.error(`Error reading file content:`, error);
      return null;
    }
  }

  // Extract text content from various file types
  async extractTextContent(file: any): Promise<string | null> {
    try {
      const { bucket, name, contentType } = file;
      
      // Handle different file types
      if (contentType?.includes('text') || contentType?.includes('csv')) {
        // Text-based files
        return await this.getFileContent(bucket, name);
      } else if (contentType?.includes('pdf')) {
        // PDF files - would need PDF parsing library
        console.log(`📄 PDF file detected: ${name} - PDF parsing not implemented yet`);
        return `[PDF File: ${name} - Content extraction not yet implemented]`;
      } else if (contentType?.includes('excel') || contentType?.includes('spreadsheet')) {
        // Excel files - would need Excel parsing library
        console.log(`📊 Excel file detected: ${name} - Excel parsing not implemented yet`);
        return `[Excel File: ${name} - Content extraction not yet implemented]`;
      } else {
        console.log(`📄 Unsupported file type: ${contentType} for ${name}`);
        return `[File: ${name} - Type: ${contentType} - Content extraction not supported]`;
      }
      
    } catch (error) {
      console.error('Error extracting text content:', error);
      return null;
    }
  }

  // Search files by content or metadata
  async searchFiles(query: string, maxFiles: number = 10): Promise<any[]> {
    try {
      console.log(`🔍 Searching files for: "${query}"`);
      
      const availableFiles = await this.getAvailableFiles();
      
      // Simple filename/path matching for now
      const matchingFiles = availableFiles.filter(file => 
        file.name.toLowerCase().includes(query.toLowerCase()) ||
        file.path.toLowerCase().includes(query.toLowerCase())
      );
      
      console.log(`🔍 Found ${matchingFiles.length} matching files`);
      return matchingFiles.slice(0, maxFiles);
      
    } catch (error) {
      console.error('Error searching files:', error);
      return [];
    }
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
