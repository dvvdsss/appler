/**
 * Modern Security Middleware
 * Enterprise-grade protection with zero-configuration setup
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger.js";
import { ThreatDetector, type ThreatEvent } from "./threat-detector.js";

export interface SecurityConfig {
  readonly alertWebhookUrl?: string;
}

// SecurityMetrics removed - webhook-only architecture doesn't need detailed metrics exposure

/**
 * Minimal security middleware with webhook-only threat notifications
 */
export class SecurityMiddleware {
  private static readonly SUSPICIOUS_USER_AGENTS = new Set([
    "sqlmap",
    "nikto",
    "dirb",
    "gobuster",
    "wfuzz",
    "masscan",
    "nmap",
    "zap",
    "burp",
    "acunetix",
    "nessus",
    "openvas",
  ]);

  private readonly threatDetector = new ThreatDetector();

  constructor(private readonly config: SecurityConfig) {
    setInterval(() => this.cleanup(), 3600000);
    logger.info("Security system initialized", {
      status: "ALWAYS_ACTIVE",
      threatDetection: "enabled",
    });
  }

  async checkSecurity(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<boolean> {
    const ip = this.extractClientIP(request);
    const userAgent = request.headers["user-agent"] || "unknown";

    try {
      // User agent filtering
      if (
        SecurityMiddleware.SUSPICIOUS_USER_AGENTS.has(
          userAgent.toLowerCase().split("/")[0]
        )
      ) {
        await this.blockRequest(reply, "Suspicious user agent detected");
        return false;
      }

      // Threat analysis
      const threatAnalysis = this.threatDetector.analyzeThreat(
        ip,
        request.method,
        request.url,
        userAgent
      );
      if (threatAnalysis.isBlocked) {
        if (threatAnalysis.threat) {
          await this.handleThreatDetection(threatAnalysis.threat);
        }
        await this.blockRequest(reply, "Security threat detected");
        return false;
      }

      if (threatAnalysis.threat) {
        await this.handleThreatDetection(threatAnalysis.threat);
      }

      return true;
    } catch {
      return true; // Fail open
    }
  }

  /**
   * Extract real client IP from request
   */
  private extractClientIP(request: FastifyRequest): string {
    // Priority order for IP extraction
    const ipSources = [
      request.headers["cf-connecting-ip"], // Cloudflare
      request.headers["x-real-ip"], // Nginx
      request.headers["x-forwarded-for"], // Load balancer
      request.ip, // Direct connection
    ];

    for (const ip of ipSources) {
      if (ip && typeof ip === "string") {
        // Handle comma-separated IPs (take first one)
        return ip.split(",")[0].trim();
      }
    }

    return "unknown";
  }

  // isSuspiciousUserAgent removed - logic integrated into main check for efficiency

  /**
   * Handle threat detection with logging and alerting
   */
  private async handleThreatDetection(threat: ThreatEvent): Promise<void> {
    // Enhanced security logging
    logger.security("Threat detected", {
      severity: threat.pattern.severity,
      threatType: threat.pattern.type,
      attackerIP: threat.ip,
      userAgent: threat.userAgent,
      targetUrl: threat.url,
      method: threat.method,
      riskScore: threat.riskScore,
      timestamp: new Date(threat.timestamp).toISOString(),
      indicators: [...threat.pattern.indicators],
    });

    // Metrics tracking removed for webhook-only architecture

    // Send webhook alert for critical threats
    if (threat.pattern.severity === "CRITICAL" && this.config.alertWebhookUrl) {
      await this.sendSecurityAlert(threat);
    }
  }

  /**
   * Send startup notification webhook
   */
  async sendStartupNotification(message: string): Promise<void> {
    try {
      // Skip webhook in development environment
      if (process.env.NODE_ENV === "development") {
        logger.info(
          "Skipping startup webhook notification in development environment"
        );
        return;
      }

      if (!this.config.alertWebhookUrl) return;

      // Send the pre-formatted message directly
      const payload = {
        text: message,
      };

      await fetch(this.config.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      logger.warn("Failed to send startup notification", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send security alert webhook
   */
  private async sendSecurityAlert(threat: ThreatEvent): Promise<void> {
    try {
      if (!this.config.alertWebhookUrl) return;

      // Create the same message format as logs
      const message = `🚨 Security Threat Detected
Severity: ${threat.pattern.severity}
Type: ${threat.pattern.type}
Attacker IP: ${threat.ip}
Target URL: ${threat.url}
Risk Score: ${threat.riskScore}/100
Detection Time: ${new Date(threat.timestamp).toISOString()}
Server: Apple RAG MCP`;

      const payload = {
        text: message,
      };

      await fetch(this.config.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      logger.warn("Failed to send security alert", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async blockRequest(
    reply: FastifyReply,
    reason: string
  ): Promise<void> {
    logger.security("Request blocked", { reason });
    reply.code(429).send({
      error: "Too Many Requests",
      message: "Request temporarily blocked due to security policy",
      retryAfter: 3600,
    });
  }

  getHealthInfo() {
    return {
      status: "ALWAYS_ACTIVE",
      threatDetection: "enabled",
      alertMethod: "webhook-only",
      webhookConfigured: !!this.config.alertWebhookUrl,
    };
  }

  private cleanup(): void {
    this.threatDetector.cleanup();
  }
}
