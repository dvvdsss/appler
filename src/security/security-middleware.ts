/**
 * Modern Security Middleware
 * Enterprise-grade protection with zero-configuration setup
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger.js";
import { ThreatDetector, type ThreatEvent } from "./threat-detector.js";

export interface SecurityConfig {
  readonly alertWebhookUrl?: string;
  readonly maxRequestsPerMinute: number;
}

// SecurityMetrics removed - webhook-only architecture doesn't need detailed metrics exposure

/**
 * Minimal security middleware with webhook-only threat notifications
 */
export class SecurityMiddleware {
  private static readonly SUSPICIOUS_USER_AGENTS = new Set([
    'sqlmap', 'nikto', 'dirb', 'gobuster', 'wfuzz', 'masscan',
    'nmap', 'zap', 'burp', 'acunetix', 'nessus', 'openvas'
  ]);

  private readonly threatDetector = new ThreatDetector();
  private readonly requestCounts = new Map<string, number[]>();

  constructor(private readonly config: SecurityConfig) {
    setInterval(() => this.cleanup(), 3600000);
    logger.info("Security system initialized", { 
      status: "ALWAYS_ACTIVE",
      maxRequestsPerMinute: this.config.maxRequestsPerMinute
    });
  }

  async checkSecurity(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
    const ip = this.extractClientIP(request);
    const userAgent = request.headers['user-agent'] || 'unknown';

    try {
      // Rate limiting
      if (!this.checkRateLimit(ip)) {
        await this.blockRequest(reply, 'Rate limit exceeded');
        return false;
      }

      // User agent filtering
      if (SecurityMiddleware.SUSPICIOUS_USER_AGENTS.has(userAgent.toLowerCase().split('/')[0])) {
        await this.blockRequest(reply, 'Suspicious user agent detected');
        return false;
      }

      // Threat analysis
      const threatAnalysis = this.threatDetector.analyzeThreat(ip, request.method, request.url, userAgent);
      if (threatAnalysis.isBlocked) {
        if (threatAnalysis.threat) {
          await this.handleThreatDetection(threatAnalysis.threat);
        }
        await this.blockRequest(reply, 'Security threat detected');
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
      request.headers['cf-connecting-ip'], // Cloudflare
      request.headers['x-real-ip'],        // Nginx
      request.headers['x-forwarded-for'],  // Load balancer
      request.ip                          // Direct connection
    ];

    for (const ip of ipSources) {
      if (ip && typeof ip === 'string') {
        // Handle comma-separated IPs (take first one)
        return ip.split(',')[0].trim();
      }
    }

    return 'unknown';
  }

  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const requests = this.requestCounts.get(ip) || [];
    
    // Filter recent requests (last minute)
    const recentRequests = requests.filter(timestamp => now - timestamp < 60000);
    
    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      return false;
    }

    // Update request history
    recentRequests.push(now);
    this.requestCounts.set(ip, recentRequests);
    return true;
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
      indicators: [...threat.pattern.indicators]
    });

    // Metrics tracking removed for webhook-only architecture

    // Send webhook alert for critical threats
    if (threat.pattern.severity === 'CRITICAL' && this.config.alertWebhookUrl) {
      await this.sendSecurityAlert(threat);
    }
  }

  /**
   * Send security alert webhook (optimized for Telegram)
   */
  private async sendSecurityAlert(threat: ThreatEvent): Promise<void> {
    try {
      if (!this.config.alertWebhookUrl) return;

      // Check if it's a Telegram webhook URL
      const isTelegram = this.config.alertWebhookUrl.includes('api.telegram.org');

      if (isTelegram) {
        // Telegram-optimized message format
        const severityEmoji = {
          'CRITICAL': '🔴',
          'HIGH': '🟠', 
          'MEDIUM': '🟡',
          'LOW': '🟢'
        }[threat.pattern.severity] || '⚪';

        const typeEmoji = {
          'VULNERABILITY_SCAN': '🔍',
          'CREDENTIAL_THEFT': '🔐',
          'PATH_TRAVERSAL': '📁',
          'SQL_INJECTION': '💾',
          'XSS_ATTEMPT': '🌐'
        }[threat.pattern.type] || '⚠️';

        const message = `🚨 *安全威胁检测*

${severityEmoji} *严重程度:* ${threat.pattern.severity}
${typeEmoji} *威胁类型:* ${threat.pattern.type}
🌐 *攻击者 IP:* \`${threat.ip}\`
🎯 *目标 URL:* \`${threat.url}\`
📊 *风险评分:* ${threat.riskScore}/100
🕒 *检测时间:* ${new Date(threat.timestamp).toLocaleString('zh-CN')}
🖥️ *服务器:* Apple RAG MCP

请立即查看安全仪表板获取详细分析。`;

        const payload = {
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        };

        await fetch(this.config.alertWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000)
        });
      } else {
        // Generic webhook format
        const alert = {
          type: 'security_threat',
          severity: threat.pattern.severity,
          timestamp: new Date(threat.timestamp).toISOString(),
          attacker: {
            ip: threat.ip,
            userAgent: threat.userAgent
          },
          attack: {
            type: threat.pattern.type,
            url: threat.url,
            method: threat.method,
            riskScore: threat.riskScore
          },
          server: {
            hostname: process.env.HOSTNAME || 'unknown',
            service: 'apple-rag-mcp'
          }
        };

        await fetch(this.config.alertWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert),
          signal: AbortSignal.timeout(5000)
        });
      }

      logger.info("Security alert sent successfully", {
        threatType: threat.pattern.type,
        severity: threat.pattern.severity,
        webhookType: isTelegram ? 'telegram' : 'generic'
      });
    } catch (error) {
      logger.warn("Failed to send security alert", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async blockRequest(reply: FastifyReply, reason: string): Promise<void> {
    logger.security("Request blocked", { reason });
    reply.code(429).send({
      error: "Too Many Requests", 
      message: "Request temporarily blocked due to security policy",
      retryAfter: 3600
    });
  }

  getHealthInfo() {
    return {
      status: "ALWAYS_ACTIVE",
      rateLimitPerMinute: this.config.maxRequestsPerMinute,
      alertMethod: "webhook-only",
      webhookConfigured: !!this.config.alertWebhookUrl
    };
  }

  private cleanup(): void {
    const cutoff = Date.now() - 60000;
    
    for (const [ip, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > cutoff);
      if (validRequests.length === 0) {
        this.requestCounts.delete(ip);
      } else {
        this.requestCounts.set(ip, validRequests);
      }
    }
    
    this.threatDetector.cleanup();
  }
}
