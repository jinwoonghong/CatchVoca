/**
 * CatchVoca Custom Error Classes
 * 명확한 에러 타입 구분 및 컨텍스트 정보 제공
 */

/**
 * Base Error Class
 */
export class CatchVocaError extends Error {
  public readonly timestamp: number;
  public readonly context?: Record<string, unknown>;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.context = context;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Network-related errors (API calls, fetch failures)
 */
export class NetworkError extends CatchVocaError {
  public readonly statusCode?: number;
  public readonly url?: string;

  constructor(message: string, statusCode?: number, url?: string, context?: Record<string, unknown>) {
    super(message, context);
    this.statusCode = statusCode;
    this.url = url;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      statusCode: this.statusCode,
      url: this.url,
    };
  }
}

/**
 * Validation errors (invalid input, schema violations)
 */
export class ValidationError extends CatchVocaError {
  public readonly field?: string;
  public readonly value?: unknown;

  constructor(message: string, field?: string, value?: unknown, context?: Record<string, unknown>) {
    super(message, context);
    this.field = field;
    this.value = value;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value,
    };
  }
}

/**
 * Database-related errors (IndexedDB failures)
 */
export class DatabaseError extends CatchVocaError {
  public readonly operation?: string;
  public readonly tableName?: string;

  constructor(message: string, operation?: string, tableName?: string, context?: Record<string, unknown>) {
    super(message, context);
    this.operation = operation;
    this.tableName = tableName;
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      operation: this.operation,
      tableName: this.tableName,
    };
  }
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: (new (...args: any[]) => Error)[];
}

/**
 * Default Retry Configuration
 */
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableErrors: [NetworkError],
};

/**
 * Exponential Backoff Retry Utility
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      const isRetryable = finalConfig.retryableErrors.some(
        (ErrorClass) => lastError instanceof ErrorClass
      );

      // If not retryable or last attempt, throw immediately
      if (!isRetryable || attempt === finalConfig.maxAttempts) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelay
      );

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Retry failed with unknown error');
}

/**
 * Error Helper Functions
 */

/**
 * Check if error is a specific CatchVoca error type
 */
export function isErrorType<T extends CatchVocaError>(
  error: unknown,
  ErrorClass: new (...args: any[]) => T
): error is T {
  return error instanceof ErrorClass;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract error context safely
 */
export function getErrorContext(error: unknown): Record<string, unknown> | undefined {
  if (error instanceof CatchVocaError) {
    return error.context;
  }
  return undefined;
}
