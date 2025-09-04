#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function generateVersionInfo() {
  try {
    // Get git information
    const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const shortHash = commitHash.substring(0, 8);
    const commitCount = execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim();
    const commitDate = execSync('git log -1 --format=%cd --date=short', { encoding: 'utf8' }).trim();
    
    // Generate version
    const version = `v1.${commitCount}.${shortHash}`;
    const buildDate = new Date().toISOString().split('T')[0];
    
    console.log(`🔖 Generated version: ${version}`);
    console.log(`📅 Build date: ${buildDate}`);
    console.log(`🔗 Commit: ${shortHash}`);
    
    // Create or update .env.local with version info
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    
    // Read existing .env.local if it exists
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Remove existing version variables
    envContent = envContent
      .split('\n')
      .filter(line => !line.startsWith('NEXT_PUBLIC_APP_VERSION=') && 
                     !line.startsWith('NEXT_PUBLIC_COMMIT_HASH=') &&
                     !line.startsWith('NEXT_PUBLIC_SHORT_HASH=') &&
                     !line.startsWith('NEXT_PUBLIC_BUILD_DATE='))
      .join('\n');
    
    // Add new version variables
    const versionVars = `
# Auto-generated version info (updated on each build)
NEXT_PUBLIC_APP_VERSION=${version}
NEXT_PUBLIC_COMMIT_HASH=${commitHash}
NEXT_PUBLIC_SHORT_HASH=${shortHash}
NEXT_PUBLIC_BUILD_DATE=${buildDate}
`;
    
    envContent = envContent.trim() + versionVars;
    
    // Write back to .env.local
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Version info updated in .env.local');
    
    return {
      version,
      commitHash,
      shortHash,
      buildDate
    };
    
  } catch (error) {
    console.error('❌ Error generating version info:', error.message);
    
    // Fallback version
    const fallbackVersion = 'v1.0.dev';
    const fallbackDate = new Date().toISOString().split('T')[0];
    
    console.log(`🔄 Using fallback version: ${fallbackVersion}`);
    
    return {
      version: fallbackVersion,
      commitHash: 'unknown',
      shortHash: 'dev',
      buildDate: fallbackDate
    };
  }
}

// Run if called directly
if (require.main === module) {
  generateVersionInfo();
}

module.exports = { generateVersionInfo };
