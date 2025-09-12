// Script to upload the latest production template to Supabase storage
const fs = require('fs');
const path = require('path');

async function uploadTemplate() {
  try {
    console.log('📤 Uploading Production Data Template R2 to Supabase...');
    
    // Read the template file
    const templatePath = path.join(__dirname, 'public', 'Production Data Template R2 (Sep 12 2025).xlsx');
    
    if (!fs.existsSync(templatePath)) {
      console.error('❌ Template file not found:', templatePath);
      return;
    }
    
    const fileStats = fs.statSync(templatePath);
    console.log(`📊 File size: ${fileStats.size} bytes`);
    console.log(`📅 Last modified: ${fileStats.mtime}`);
    
    // Create form data
    const formData = new FormData();
    const fileBlob = new Blob([fs.readFileSync(templatePath)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    formData.append('file', fileBlob, 'Production Data Template R2 (Sep 12 2025).xlsx');
    formData.append('templateType', 'production-file');
    
    // Upload via API
    const response = await fetch('http://localhost:3000/api/inventory/production-files/templates', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Template uploaded successfully!');
      console.log(`📁 Supabase path: ${result.filePath}`);
      console.log(`📋 File name: ${result.fileName}`);
    } else {
      console.error('❌ Upload failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Upload script error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  uploadTemplate();
}

module.exports = { uploadTemplate };
