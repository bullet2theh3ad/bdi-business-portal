/**
 * Amazon SP-API Rate Limiter
 * Implements exponential backoff with jitter to handle rate limits
 * Based on working Python implementation from BDI_2
 */

import { RateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG, AmazonSPAPIError } from './types';

// ============================================================================
// RATE LIMITER
// ============================================================================

export class AmazonRateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
  }

  /**
   * Execute a function with exponential backoff retry logic
   * Based on: BDI_2/amazon_finances_API.py retry patterns
   * 
   * @param fn Function to execute
   * @param operationName Name for logging
   * @returns Result of the function
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    operationName: string = 'API call'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        console.log(`[Rate Limiter] ${operationName} - Attempt ${attempt + 1}/${this.config.maxRetries}`);
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Check if this is a rate limit error
        const isRateLimitError = this.isRateLimitError(error);
        const isRetryableError = this.isRetryableError(error);

        if (!isRateLimitError && !isRetryableError) {
          // Not a retryable error, throw immediately
          console.error(`[Rate Limiter] ${operationName} - Non-retryable error:`, error);
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt);
        
        console.warn(
          `[Rate Limiter] ${operationName} - ${isRateLimitError ? 'Rate limit' : 'Retryable error'} hit. ` +
          `Retrying in ${delay}ms (attempt ${attempt + 1}/${this.config.maxRetries})`
        );

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // All retries exhausted
    console.error(`[Rate Limiter] ${operationName} - All ${this.config.maxRetries} retries exhausted`);
    throw new AmazonSPAPIError(
      'MAX_RETRIES_EXCEEDED',
      `Failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
      undefined,
      lastError
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * Formula: min(initialDelay * (backoffMultiplier ^ attempt) + random jitter, maxDelay)
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    const jitter = Math.random() * 1000; // Random jitter up to 1 second
    const totalDelay = exponentialDelay + jitter;
    return Math.min(totalDelay, this.config.maxDelayMs);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (error instanceof AmazonSPAPIError) {
      return error.code === 'QuotaExceeded' || 
             error.code === 'RequestThrottled' ||
             error.statusCode === 429;
    }

    // Check for HTTP 429 status
    if (error?.response?.status === 429) {
      return true;
    }

    // Check for rate limit keywords in message
    const message = error?.message?.toLowerCase() || '';
    return message.includes('quota') || 
           message.includes('throttle') || 
           message.includes('rate limit');
  }

  /**
   * Check if error is retryable (network errors, 5xx errors, etc.)
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof AmazonSPAPIError) {
      const statusCode = error.statusCode;
      // Retry on 5xx server errors and some 4xx errors
      return (statusCode && statusCode >= 500) || 
             statusCode === 408 || // Request Timeout
             statusCode === 429;   // Too Many Requests
    }

    // Check for network errors
    if (error?.code === 'ECONNRESET' || 
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ENOTFOUND' ||
        error?.code === 'ECONNREFUSED') {
      return true;
    }

    // Check for fetch errors
    if (error?.name === 'FetchError' || error?.name === 'AbortError') {
      return true;
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// REQUEST QUEUE (For managing concurrent requests)
// ============================================================================

export class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private maxConcurrent: number;

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Add a request to the queue
   */
  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.running++;
    const fn = this.queue.shift();
    
    if (fn) {
      try {
        await fn();
      } finally {
        this.running--;
        this.processQueue();
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus(): { queued: number; running: number } {
    return {
      queued: this.queue.length,
      running: this.running,
    };
  }
}
