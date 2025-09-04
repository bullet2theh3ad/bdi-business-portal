// Client-side version info interface
export interface VersionInfo {
  version: string;
  commitHash: string;
  buildDate: string;
  shortHash: string;
}

// Client-side version (pre-generated at build time via environment variables)
export const VERSION_INFO: VersionInfo = {
  version: process.env.NEXT_PUBLIC_APP_VERSION || 'v1.0.dev',
  commitHash: process.env.NEXT_PUBLIC_COMMIT_HASH || 'unknown',
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString().split('T')[0],
  shortHash: process.env.NEXT_PUBLIC_SHORT_HASH || 'dev'
};
