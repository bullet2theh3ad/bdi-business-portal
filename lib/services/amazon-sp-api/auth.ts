/**
 * Amazon SP-API Authentication Service
 * Handles LWA (Login with Amazon) token management and AWS SigV4 signing
 * Based on working Python implementation from BDI_2/aws_client.py
 */

import crypto from 'crypto';
import { AmazonCredentials, LWATokenResponse, CachedToken, AmazonSPAPIError } from './types';

// ============================================================================
// LWA TOKEN MANAGEMENT
// ============================================================================

export class AmazonAuthService {
  private cachedToken: CachedToken | null = null;
  private readonly LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
  private readonly TOKEN_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

  constructor(private credentials: AmazonCredentials) {}

  /**
   * Get a valid LWA access token, refreshing if necessary
   * Based on: BDI_2/aws_client.py -> get_access_token()
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      console.log('[Amazon Auth] Using cached token');
      return this.cachedToken.accessToken;
    }

    // Request a new token
    console.log('[Amazon Auth] Requesting new LWA token...');
    return await this.requestNewToken();
  }

  /**
   * Request a new LWA access token using refresh token
   * Based on: BDI_2/aws_client.py -> _request_new_token()
   */
  private async requestNewToken(): Promise<string> {
    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.credentials.refreshToken,
      client_id: this.credentials.clientId,
      client_secret: this.credentials.clientSecret,
    });

    try {
      const response = await fetch(this.LWA_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new AmazonSPAPIError(
          'LWA_TOKEN_ERROR',
          `Failed to obtain LWA token: ${response.status}`,
          response.status,
          errorText
        );
      }

      const data: LWATokenResponse = await response.json();
      
      // Cache the token
      const expiresIn = data.expires_in || 3600; // Default 1 hour
      this.cachedToken = {
        accessToken: data.access_token,
        expiresAt: Date.now() + (expiresIn * 1000) - (this.TOKEN_BUFFER_SECONDS * 1000),
      };

      console.log('[Amazon Auth] New token obtained, expires in', expiresIn, 'seconds');
      return data.access_token;

    } catch (error) {
      if (error instanceof AmazonSPAPIError) {
        throw error;
      }
      throw new AmazonSPAPIError(
        'LWA_TOKEN_REQUEST_FAILED',
        `Failed to request LWA token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        undefined,
        error
      );
    }
  }

  /**
   * Check if a cached token is still valid
   */
  private isTokenValid(token: CachedToken): boolean {
    return Date.now() < token.expiresAt;
  }

  /**
   * Clear cached token (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cachedToken = null;
  }
}

// ============================================================================
// AWS SIGNATURE V4 SIGNING
// ============================================================================

export class AWSSignatureV4 {
  private readonly service = 'execute-api';
  private readonly algorithm = 'AWS4-HMAC-SHA256';

  constructor(
    private accessKey: string,
    private secretKey: string,
    private region: string
  ) {}

  /**
   * Generate AWS SigV4 signature for SP-API requests
   * Based on: BDI_2/aws_client.py -> _get_signature()
   * 
   * @param method HTTP method (GET, POST, etc.)
   * @param path API endpoint path
   * @param host SP-API host (e.g., sellingpartnerapi-na.amazon.com)
   * @param queryParams Query string parameters
   * @param payload Request body (for POST/PUT)
   * @param accessToken LWA access token
   * @returns Headers object with AWS signature
   */
  sign(
    method: string,
    path: string,
    host: string,
    queryParams: Record<string, string> = {},
    payload: string = '',
    accessToken: string
  ): Record<string, string> {
    const now = new Date();
    const amzDate = this.getAmzDate(now);
    const dateStamp = this.getDateStamp(now);

    // Step 1: Create canonical request
    const canonicalUri = path;
    const canonicalQueryString = this.createCanonicalQueryString(queryParams);
    const payloadHash = this.sha256(payload);
    
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-date';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Step 2: Create string to sign
    const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
    const stringToSign = [
      this.algorithm,
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join('\n');

    // Step 3: Calculate signature
    const signature = this.calculateSignature(dateStamp, stringToSign);

    // Step 4: Create authorization header
    const authorizationHeader = [
      `${this.algorithm} Credential=${this.accessKey}/${credentialScope}`,
      `SignedHeaders=${signedHeaders}`,
      `Signature=${signature}`,
    ].join(', ');

    // Return headers
    return {
      'Authorization': authorizationHeader,
      'x-amz-access-token': accessToken,
      'x-amz-date': amzDate,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create canonical query string from parameters
   */
  private createCanonicalQueryString(params: Record<string, string>): string {
    if (Object.keys(params).length === 0) {
      return '';
    }

    return Object.keys(params)
      .sort()
      .map(key => `${this.uriEncode(key)}=${this.uriEncode(params[key])}`)
      .join('&');
  }

  /**
   * Calculate AWS SigV4 signature
   */
  private calculateSignature(dateStamp: string, stringToSign: string): string {
    const kDate = this.hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = this.hmac(kDate, this.region);
    const kService = this.hmac(kRegion, this.service);
    const kSigning = this.hmac(kService, 'aws4_request');
    return this.hmac(kSigning, stringToSign, 'hex');
  }

  /**
   * HMAC-SHA256 helper
   */
  private hmac(key: string | Buffer, data: string, encoding: 'hex' | 'buffer' = 'buffer'): any {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(data);
    return encoding === 'hex' ? hmac.digest('hex') : hmac.digest();
  }

  /**
   * SHA256 hash helper
   */
  private sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  /**
   * Get AMZ date format (YYYYMMDDTHHMMSSZ)
   */
  private getAmzDate(date: Date): string {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  }

  /**
   * Get date stamp (YYYYMMDD)
   */
  private getDateStamp(date: Date): string {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }

  /**
   * URI encode (RFC 3986)
   */
  private uriEncode(str: string): string {
    return encodeURIComponent(str)
      .replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  }
}

// ============================================================================
// COMBINED AUTH CLIENT
// ============================================================================

export class AmazonSPAPIAuth {
  private authService: AmazonAuthService;
  private signer: AWSSignatureV4;

  constructor(credentials: AmazonCredentials) {
    this.authService = new AmazonAuthService(credentials);
    this.signer = new AWSSignatureV4(
      credentials.accessKey,
      credentials.secretKey,
      credentials.region || 'us-east-1'
    );
  }

  /**
   * Get signed headers for an SP-API request
   */
  async getSignedHeaders(
    method: string,
    path: string,
    host: string,
    queryParams: Record<string, string> = {},
    payload: string = ''
  ): Promise<Record<string, string>> {
    const accessToken = await this.authService.getAccessToken();
    return this.signer.sign(method, path, host, queryParams, payload, accessToken);
  }

  /**
   * Get access token only (for simple API calls)
   */
  async getAccessToken(): Promise<string> {
    return await this.authService.getAccessToken();
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.authService.clearCache();
  }
}
