/**
 * Simple structured logger for Apple RAG MCP Server
 * Optimized for Cloudflare Workers Logs
 */

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  context?: LogContext;
}

/**
 * Simple structured logger for MCP server
 */
class MCPLogger {
  private serviceName = "apple-rag-mcp";

  /**
   * Create structured log entry
   */
  private createLogEntry(
    level: string,
    message: string,
    context?: LogContext
  ): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      context,
    };
  }

  /**
   * Output structured log to console
   */
  private output(entry: LogEntry): void {
    const logData = {
      ...entry,
      "@timestamp": entry.timestamp,
      "@level": entry.level,
      "@message": entry.message,
      "@service": entry.service,
    };

    // Use appropriate console method based on level
    switch (entry.level) {
      case "error":
        console.error(JSON.stringify(logData));
        break;
      case "warn":
        console.warn(JSON.stringify(logData));
        break;
      case "debug":
        console.debug(JSON.stringify(logData));
        break;
      default:
        console.log(JSON.stringify(logData));
    }
  }

  /**
   * Info level logging
   */
  info(message: string, context?: LogContext): void {
    this.output(this.createLogEntry("info", message, context));
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: LogContext): void {
    this.output(this.createLogEntry("warn", message, context));
  }

  /**
   * Error level logging
   */
  error(message: string, context?: LogContext): void {
    this.output(this.createLogEntry("error", message, context));
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: LogContext): void {
    this.output(this.createLogEntry("debug", message, context));
  }

  /**
   * Log MCP protocol events
   */
  mcp(event: string, context?: LogContext): void {
    this.info(`MCP: ${event}`, {
      type: "mcp_protocol",
      event,
      ...context,
    });
  }

  /**
   * Log authentication events
   */
  auth(event: string, context?: LogContext): void {
    this.info(`Auth: ${event}`, {
      type: "auth",
      event,
      ...context,
    });
  }

  /**
   * Log request events
   */
  request(method: string, path: string, context?: LogContext): void {
    this.info(`${method} ${path}`, {
      type: "request",
      method,
      path,
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new MCPLogger();
