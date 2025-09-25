// Script to upload the existing BDI DB Backup Policy to the Policies system
// Run this with: node upload-existing-bdi-policy.js

const fs = require('fs');
const path = require('path');

async function uploadBDIPolicy() {
  const filePath = './BDI_DB_Backup_Policy_R1.docx';
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log('❌ BDI_DB_Backup_Policy_R1.docx not found in project root');
    console.log('📁 Available files:');
    const files = fs.readdirSync('.').filter(f => f.endsWith('.docx') || f.endsWith('.pdf'));
    files.forEach(f => console.log(`   - ${f}`));
    return;
  }

  console.log('✅ Found BDI_DB_Backup_Policy_R1.docx');
  console.log('📋 To upload this to your Policies system:');
  console.log('');
  console.log('1. Go to Admin > Policies in your portal');
  console.log('2. Click "Upload Policy Document"');
  console.log('3. Select this file: BDI_DB_Backup_Policy_R1.docx');
  console.log('4. Choose Category: "Database & Backup"');
  console.log('5. Description: "BDI Database Backup Policy - Revision 1"');
  console.log('6. Click Upload');
  console.log('');
  console.log('🎨 It will appear as a beautiful purple card with database icon!');
  
  // Show file stats
  const stats = fs.statSync(filePath);
  console.log('');
  console.log('📊 File Information:');
  console.log(`   - Size: ${(stats.size / 1024).toFixed(1)} KB`);
  console.log(`   - Modified: ${stats.mtime.toLocaleDateString()} ${stats.mtime.toLocaleTimeString()}`);
}

uploadBDIPolicy();
