/**
 * Modern Structured Logger for Apple RAG MCP Server
 * Optimized for VPS deployment with environment-aware configuration
 */

export interface LogContext {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined
    | string[]
    | Record<string, unknown>
    | LogContext;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  pid: number;
  context: LogContext | undefined;
}

/**
 * High-performance structured logger for VPS deployment
 */
class MCPLogger {
  private serviceName = "apple-rag-mcp";
  private version = "2.0.0";
  private environment = process.env.NODE_ENV || "development";
  private isDevelopment = this.environment === "development";

  /**
   * Create structured log entry with enhanced metadata
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
      version: this.version,
      environment: this.environment,
      pid: process.pid,
      context,
    };
  }

  /**
   * Output structured log with environment-aware formatting
   */
  private output(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Pretty formatted output for development
      const timestamp = new Date(entry.timestamp).toLocaleTimeString();
      const levelColor = this.getLevelColor(entry.level);
      const contextStr = entry.context
        ? ` ${JSON.stringify(entry.context)}`
        : "";

      console.log(
        `${levelColor}[${timestamp}] ${entry.level.toUpperCase()}\x1b[0m ${entry.message}${contextStr}`
      );
    } else {
      // Structured JSON for production
      const logData = {
        "@timestamp": entry.timestamp,
        "@level": entry.level,
        "@message": entry.message,
        "@service": entry.service,
        "@version": entry.version,
        "@environment": entry.environment,
        "@pid": entry.pid,
        ...entry.context,
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
  }

  /**
   * Get color code for log level (development mode)
   */
  private getLevelColor(level: string): string {
    switch (level) {
      case "error":
        return "\x1b[31m"; // Red
      case "warn":
        return "\x1b[33m"; // Yellow
      case "info":
        return "\x1b[36m"; // Cyan
      case "debug":
        return "\x1b[90m"; // Gray
      default:
        return "\x1b[0m"; // Reset
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

  /**
   * Log security events
   */
  security(event: string, context?: LogContext): void {
    this.warn(`Security: ${event}`, {
      type: "security",
      event,
      ...context,
    });
  }

  /**
   * Log fatal errors that require immediate attention
   */
  fatal(message: string, context?: LogContext): void {
    this.error(`FATAL: ${message}`, {
      type: "fatal",
      severity: "critical",
      ...context,
    });
  }
}

// Export singleton instance
export const logger = new MCPLogger();
