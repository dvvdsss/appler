/**
 * Cloudflare Workers Logs - Official Best Practices Implementation
 * Optimized for Cloudflare Workers Logs with structured JSON logging
 * Fully compliant with Cloudflare official documentation
 */

type LogLevel = "debug" | "info" | "warn" | "error";

class CloudflareLogger {
  /**
   * Log debug message with full context
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.log("debug", message, data);
  }

  /**
   * Log info message with full context
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.log("info", message, data);
  }

  /**
   * Log warning message with full context
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.log("warn", message, data);
  }

  /**
   * Log error message with full context and stack trace
   */
  error(message: string, data?: Record<string, unknown>, error?: Error): void {
    const errorData = {
      ...data,
      ...(error && {
        error_message: error.message,
        error_stack: error.stack,
        error_name: error.name,
      }),
    };
    this.log("error", message, errorData);
  }

  /**
   * Log business metrics
   */
  business(event: string, data?: Record<string, unknown>): void {
    this.log("info", `Business: ${event}`, {
      business_event: event,
      ...data,
    });
  }

  /**
   * Internal log method - Cloudflare Workers Logs optimized
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>
  ): void {
    // Create minimal log entry - Cloudflare handles timestamp, request_id, etc.
    const logEntry = {
      level,
      message,
      ...data,
    };

    // Use appropriate console method with direct object (not JSON string)
    // This allows Cloudflare to automatically index all fields
    const consoleMethod = this.getConsoleMethod(level);
    consoleMethod(logEntry);
  }

  /**
   * Get appropriate console method for log level
   */
  private getConsoleMethod(level: LogLevel): (entry: unknown) => void {
    switch (level) {
      case "debug":
        return console.debug;
      case "info":
        return console.info;
      case "warn":
        return console.warn;
      case "error":
        return console.error;
      default:
        return console.log;
    }
  }
}

// Export singleton logger instance
export const logger = new CloudflareLogger();
