/**
 * Modern Threat Detection Engine
 * Zero-tolerance security middleware with ML-like pattern recognition
 */

export interface ThreatPattern {
  readonly type: 'VULNERABILITY_SCAN' | 'CREDENTIAL_THEFT' | 'PATH_TRAVERSAL' | 'SQL_INJECTION' | 'XSS_ATTEMPT';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly indicators: readonly string[];
  readonly maxViolations: number;
  readonly blockDurationMs: number;
}

export interface ThreatEvent {
  readonly timestamp: number;
  readonly ip: string;
  readonly userAgent: string;
  readonly method: string;
  readonly url: string;
  readonly pattern: ThreatPattern;
  readonly riskScore: number;
}

export interface IPThreatProfile {
  readonly ip: string;
  readonly firstSeen: number;
  readonly lastSeen: number;
  readonly violationCount: number;
  readonly blockedUntil: number;
  readonly threats: readonly ThreatEvent[];
  readonly riskScore: number;
}

/**
 * Advanced threat detection with real-time pattern analysis
 */
export class ThreatDetector {
  private readonly threatPatterns: readonly ThreatPattern[] = [
    {
      type: 'VULNERABILITY_SCAN',
      severity: 'HIGH',
      indicators: [
        'credentials', 'secrets', 'config', 'aws', '.env', 'password',
        'api_key', 'private_key', 'token', 'database', 'backup',
        '.git', 'admin', 'login', 'auth', 'wp-admin', '.php'
      ],
      maxViolations: 3,
      blockDurationMs: 3600000 // 1 hour
    },
    {
      type: 'CREDENTIAL_THEFT',
      severity: 'CRITICAL',
      indicators: [
        'aws_credentials', 'id_rsa', 'id_dsa', 'passwd', 'shadow',
        'private.key', 'server.key', 'certificate', '.pem'
      ],
      maxViolations: 1,
      blockDurationMs: 86400000 // 24 hours
    },
    {
      type: 'PATH_TRAVERSAL',
      severity: 'HIGH',
      indicators: ['../../../', '..\\..\\', '%2e%2e%2f', '%2e%2e%5c'],
      maxViolations: 2,
      blockDurationMs: 7200000 // 2 hours
    },
    {
      type: 'SQL_INJECTION',
      severity: 'HIGH',
      indicators: [
        'union select', 'drop table', 'insert into', 'delete from',
        'exec(', 'script>', '<script', 'javascript:', 'onload='
      ],
      maxViolations: 1,
      blockDurationMs: 43200000 // 12 hours
    }
  ] as const;

  private readonly ipProfiles = new Map<string, IPThreatProfile>();
  private readonly blockedIPs = new Set<string>();

  /**
   * Analyze request for security threats with pattern matching
   */
  analyzeThreat(
    ip: string,
    method: string,
    url: string,
    userAgent: string = 'unknown'
  ): { isBlocked: boolean; threat?: ThreatEvent; riskScore: number } {
    const now = Date.now();
    
    // Check if IP is currently blocked
    if (this.isIPBlocked(ip, now)) {
      return { isBlocked: true, riskScore: 100 };
    }

    // Pattern analysis
    const detectedPattern = this.detectPattern(url.toLowerCase(), userAgent.toLowerCase());
    if (!detectedPattern) {
      return { isBlocked: false, riskScore: 0 };
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(ip, detectedPattern, now);
    
    // Create threat event
    const threat: ThreatEvent = {
      timestamp: now,
      ip,
      userAgent,
      method,
      url,
      pattern: detectedPattern,
      riskScore
    };

    // Update IP profile
    this.updateIPProfile(ip, threat, now);

    // Determine if IP should be blocked
    const profile = this.ipProfiles.get(ip)!;
    const shouldBlock = profile.violationCount >= detectedPattern.maxViolations;
    
    if (shouldBlock) {
      this.blockIP(ip, now + detectedPattern.blockDurationMs);
    }

    return { isBlocked: shouldBlock, threat, riskScore };
  }

  /**
   * Pattern detection with advanced string matching
   */
  private detectPattern(url: string, userAgent: string): ThreatPattern | null {
    const searchText = `${url} ${userAgent}`.toLowerCase();
    
    for (const pattern of this.threatPatterns) {
      const matchCount = pattern.indicators.filter(indicator => 
        searchText.includes(indicator.toLowerCase())
      ).length;
      
      // Require at least one indicator match
      if (matchCount > 0) {
        console.log(`🚨 Threat pattern detected: ${pattern.type}, indicators: ${pattern.indicators.filter(i => searchText.includes(i.toLowerCase()))}`);
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * Advanced risk scoring algorithm
   */
  private calculateRiskScore(ip: string, pattern: ThreatPattern, timestamp: number): number {
    const profile = this.ipProfiles.get(ip);
    let baseScore = 0;

    // Base score by severity
    switch (pattern.severity) {
      case 'CRITICAL': baseScore = 90; break;
      case 'HIGH': baseScore = 70; break;
      case 'MEDIUM': baseScore = 50; break;
      case 'LOW': baseScore = 30; break;
    }

    if (!profile) return baseScore;

    // Repeat offender multiplier
    const violationMultiplier = Math.min(profile.violationCount * 10, 50);
    
    // Recent activity penalty (last 5 minutes)
    const recentActivityPenalty = (timestamp - profile.lastSeen) < 300000 ? 20 : 0;
    
    // Diversity penalty (multiple attack types)
    const threatTypes = new Set(profile.threats.map(t => t.pattern.type));
    const diversityPenalty = (threatTypes.size - 1) * 15;

    return Math.min(baseScore + violationMultiplier + recentActivityPenalty + diversityPenalty, 100);
  }

  /**
   * Update IP threat profile
   */
  private updateIPProfile(ip: string, threat: ThreatEvent, timestamp: number): void {
    const existing = this.ipProfiles.get(ip);
    
    if (!existing) {
      this.ipProfiles.set(ip, {
        ip,
        firstSeen: timestamp,
        lastSeen: timestamp,
        violationCount: 1,
        blockedUntil: 0,
        threats: [threat],
        riskScore: threat.riskScore
      });
    } else {
      this.ipProfiles.set(ip, {
        ...existing,
        lastSeen: timestamp,
        violationCount: existing.violationCount + 1,
        threats: [...existing.threats.slice(-9), threat], // Keep last 10 threats
        riskScore: Math.max(existing.riskScore, threat.riskScore)
      });
    }
  }

  /**
   * Block IP with expiration
   */
  private blockIP(ip: string, blockedUntil: number): void {
    this.blockedIPs.add(ip);
    const profile = this.ipProfiles.get(ip);
    if (profile) {
      this.ipProfiles.set(ip, { ...profile, blockedUntil });
    }
  }

  /**
   * Check if IP is currently blocked
   */
  private isIPBlocked(ip: string, timestamp: number): boolean {
    if (!this.blockedIPs.has(ip)) return false;
    
    const profile = this.ipProfiles.get(ip);
    if (!profile || timestamp >= profile.blockedUntil) {
      this.blockedIPs.delete(ip);
      return false;
    }
    
    return true;
  }

  /**
   * Get IP threat profile for monitoring
   */
  getIPProfile(ip: string): IPThreatProfile | null {
    return this.ipProfiles.get(ip) || null;
  }

  /**
   * Get all active threats for monitoring dashboard
   */
  getActiveThreats(limitHours: number = 24): readonly ThreatEvent[] {
    const cutoff = Date.now() - (limitHours * 3600000);
    const threats: ThreatEvent[] = [];
    
    for (const profile of this.ipProfiles.values()) {
      threats.push(...profile.threats.filter(t => t.timestamp >= cutoff));
    }
    
    return threats.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Cleanup expired profiles (memory management)
   */
  cleanup(retentionHours: number = 168): void { // 7 days default
    const cutoff = Date.now() - (retentionHours * 3600000);
    
    for (const [ip, profile] of this.ipProfiles.entries()) {
      if (profile.lastSeen < cutoff && profile.blockedUntil < Date.now()) {
        this.ipProfiles.delete(ip);
        this.blockedIPs.delete(ip);
      }
    }
  }
}
