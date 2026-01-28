// Fraud Prevention & Ad Integrity System
// Implements anti-fraud mechanisms, bot detection, and payout verification

import { eventTracker } from './event-tracker';
import DatabaseService from './database';

export interface FraudDetectionRule {
  id: string;
  name: string;
  type: 'rate_limit' | 'pattern_detection' | 'device_fingerprint' | 'behavioral_analysis';
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  timeWindow: number; // in seconds
  action: 'flag' | 'block' | 'require_verification';
  description: string;
}

export interface FraudAlert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userDid?: string;
  publisherDid?: string;
  campaignId?: string;
  ipAddress?: string;
  userAgent?: string;
  details: any;
  status: 'active' | 'resolved' | 'false_positive';
  createdAt: string;
  resolvedAt?: string;
}

export interface SessionAnalytics {
  sessionId: string;
  userDid?: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  events: {
    type: string;
    timestamp: string;
    campaignId: string;
    publisherDid: string;
  }[];
  riskScore: number;
  flags: string[];
  createdAt: string;
  lastActivity: string;
}

export class FraudPreventionService {
  private db: DatabaseService;
  private rules: Map<string, FraudDetectionRule> = new Map();
  private sessionCache: Map<string, SessionAnalytics> = new Map();
  private ipRateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private isInitialized: boolean = false;

  constructor(db: DatabaseService) {
    this.db = db;
    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    try {
      await this.createFraudTables();
      await this.loadRulesFromDatabase();
      this.startSessionCleanup();
      this.isInitialized = true;
      console.log('✅ Fraud Prevention Service initialized');
    } catch (error) {
      console.error('❌ Fraud Prevention initialization failed:', error);
      throw error;
    }
  }

  private async createFraudTables(): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      await client.query('BEGIN');

      // Fraud detection rules
      await client.query(`
        CREATE TABLE IF NOT EXISTS fraud_rules (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          enabled BOOLEAN DEFAULT true,
          severity VARCHAR(20) NOT NULL,
          threshold INTEGER NOT NULL,
          time_window INTEGER NOT NULL,
          action VARCHAR(50) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Fraud alerts
      await client.query(`
        CREATE TABLE IF NOT EXISTS fraud_alerts (
          id VARCHAR(255) PRIMARY KEY,
          rule_id VARCHAR(255) REFERENCES fraud_rules(id),
          severity VARCHAR(20) NOT NULL,
          user_did VARCHAR(255),
          publisher_did VARCHAR(255),
          campaign_id VARCHAR(255),
          ip_address INET,
          user_agent TEXT,
          details JSONB,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMP
        )
      `);

      // Session analytics
      await client.query(`
        CREATE TABLE IF NOT EXISTS session_analytics (
          session_id VARCHAR(255) PRIMARY KEY,
          user_did VARCHAR(255),
          ip_address INET,
          user_agent TEXT,
          device_fingerprint VARCHAR(255),
          events JSONB DEFAULT '[]',
          risk_score INTEGER DEFAULT 0,
          flags TEXT[],
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Blocked entities
      await client.query(`
        CREATE TABLE IF NOT EXISTS blocked_entities (
          id VARCHAR(255) PRIMARY KEY,
          type VARCHAR(20) NOT NULL, -- 'ip', 'user', 'publisher', 'device'
          value VARCHAR(255) NOT NULL,
          reason TEXT,
          blocked_until TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts(severity)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_session_analytics_ip ON session_analytics(ip_address)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_blocked_entities_type_value ON blocked_entities(type, value)');

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private initializeDefaultRules(): void {
    const defaultRules: FraudDetectionRule[] = [
      {
        id: 'excessive_clicks_per_session',
        name: 'Excessive Clicks Per Session',
        type: 'rate_limit',
        enabled: true,
        severity: 'high',
        threshold: 10,
        timeWindow: 300, // 5 minutes
        action: 'block',
        description: 'Blocks sessions with more than 10 clicks in 5 minutes'
      },
      {
        id: 'rapid_fire_impressions',
        name: 'Rapid Fire Impressions',
        type: 'rate_limit',
        enabled: true,
        severity: 'medium',
        threshold: 50,
        timeWindow: 60, // 1 minute
        action: 'flag',
        description: 'Flags sessions with more than 50 impressions per minute'
      },
      {
        id: 'suspicious_click_pattern',
        name: 'Suspicious Click Pattern',
        type: 'pattern_detection',
        enabled: true,
        severity: 'high',
        threshold: 5,
        timeWindow: 60,
        action: 'require_verification',
        description: 'Detects regular interval clicking patterns'
      },
      {
        id: 'high_ctr_anomaly',
        name: 'Abnormally High CTR',
        type: 'behavioral_analysis',
        enabled: true,
        severity: 'medium',
        threshold: 20, // 20% CTR
        timeWindow: 3600, // 1 hour
        action: 'flag',
        description: 'Flags sessions with CTR above 20%'
      },
      {
        id: 'bot_user_agent',
        name: 'Bot User Agent Detection',
        type: 'device_fingerprint',
        enabled: true,
        severity: 'critical',
        threshold: 1,
        timeWindow: 1,
        action: 'block',
        description: 'Blocks known bot user agents'
      },
      {
        id: 'ip_rate_limit',
        name: 'IP Address Rate Limiting',
        type: 'rate_limit',
        enabled: true,
        severity: 'medium',
        threshold: 100,
        timeWindow: 3600, // 1 hour
        action: 'flag',
        description: 'Flags IPs with more than 100 events per hour'
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  // ==================== EVENT VALIDATION ====================

  async validateEvent(eventData: {
    type: 'impression' | 'click' | 'conversion';
    sessionId: string;
    userDid?: string;
    publisherDid: string;
    campaignId: string;
    ipAddress: string;
    userAgent: string;
    timestamp: string;
    metadata?: any;
  }): Promise<{
    isValid: boolean;
    riskScore: number;
    flags: string[];
    action: 'allow' | 'block' | 'require_verification';
  }> {
    const session = await this.getOrCreateSession(eventData);
    const validationResult = {
      isValid: true,
      riskScore: session.riskScore,
      flags: [...session.flags],
      action: 'allow' as 'allow' | 'block' | 'require_verification'
    };

    // Check if entity is blocked
    const isBlocked = await this.isEntityBlocked(eventData);
    if (isBlocked) {
      validationResult.isValid = false;
      validationResult.action = 'block';
      validationResult.flags.push('blocked_entity');
      return validationResult;
    }

    // Run fraud detection rules
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const ruleResult = await this.evaluateRule(rule, eventData, session);
      
      if (ruleResult.triggered) {
        validationResult.riskScore += ruleResult.riskIncrease;
        validationResult.flags.push(rule.id);

        // Create fraud alert
        await this.createFraudAlert(rule, eventData, ruleResult.details);

        // Determine action based on rule severity
        if (rule.action === 'block' && rule.severity === 'critical') {
          validationResult.isValid = false;
          validationResult.action = 'block';
        } else if (rule.action === 'require_verification' && validationResult.action === 'allow') {
          validationResult.action = 'require_verification';
        }
      }
    }

    // Update session
    session.events.push({
      type: eventData.type,
      timestamp: eventData.timestamp,
      campaignId: eventData.campaignId,
      publisherDid: eventData.publisherDid
    });
    session.riskScore = validationResult.riskScore;
    session.flags = validationResult.flags;
    session.lastActivity = new Date().toISOString();

    await this.updateSession(session);

    return validationResult;
  }

  private async evaluateRule(
    rule: FraudDetectionRule,
    eventData: any,
    session: SessionAnalytics
  ): Promise<{ triggered: boolean; riskIncrease: number; details: any }> {
    switch (rule.type) {
      case 'rate_limit':
        return this.evaluateRateLimit(rule, eventData, session);
      case 'pattern_detection':
        return this.evaluatePatternDetection(rule, eventData, session);
      case 'device_fingerprint':
        return this.evaluateDeviceFingerprint(rule, eventData, session);
      case 'behavioral_analysis':
        return this.evaluateBehavioralAnalysis(rule, eventData, session);
      default:
        return { triggered: false, riskIncrease: 0, details: {} };
    }
  }

  private async evaluateRateLimit(
    rule: FraudDetectionRule,
    eventData: any,
    session: SessionAnalytics
  ): Promise<{ triggered: boolean; riskIncrease: number; details: any }> {
    const now = Date.now();
    const windowStart = now - (rule.timeWindow * 1000);

    let eventCount = 0;

    if (rule.id === 'ip_rate_limit') {
      // Check IP-based rate limiting
      const ipKey = eventData.ipAddress;
      const ipLimit = this.ipRateLimits.get(ipKey);
      
      if (!ipLimit || ipLimit.resetTime < now) {
        this.ipRateLimits.set(ipKey, { count: 1, resetTime: now + (rule.timeWindow * 1000) });
        eventCount = 1;
      } else {
        ipLimit.count++;
        eventCount = ipLimit.count;
      }
    } else {
      // Check session-based rate limiting
      eventCount = session.events.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= windowStart && 
               (rule.id.includes('clicks') ? event.type === 'click' : 
                rule.id.includes('impressions') ? event.type === 'impression' : true);
      }).length + 1; // +1 for current event
    }

    const triggered = eventCount > rule.threshold;
    
    return {
      triggered,
      riskIncrease: triggered ? (rule.severity === 'critical' ? 50 : rule.severity === 'high' ? 30 : 15) : 0,
      details: {
        eventCount,
        threshold: rule.threshold,
        timeWindow: rule.timeWindow
      }
    };
  }

  private async evaluatePatternDetection(
    rule: FraudDetectionRule,
    eventData: any,
    session: SessionAnalytics
  ): Promise<{ triggered: boolean; riskIncrease: number; details: any }> {
    if (rule.id === 'suspicious_click_pattern') {
      const clickEvents = session.events
        .filter(e => e.type === 'click')
        .map(e => new Date(e.timestamp).getTime())
        .sort((a, b) => a - b);

      if (clickEvents.length >= 3) {
        // Check for regular intervals (bot-like behavior)
        const intervals = [];
        for (let i = 1; i < clickEvents.length; i++) {
          intervals.push(clickEvents[i] - clickEvents[i - 1]);
        }

        // Check if intervals are suspiciously regular (within 500ms variance)
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const regularIntervals = intervals.filter(interval => 
          Math.abs(interval - avgInterval) < 500
        ).length;

        const triggered = regularIntervals >= rule.threshold;
        
        return {
          triggered,
          riskIncrease: triggered ? 40 : 0,
          details: {
            clickCount: clickEvents.length,
            avgInterval,
            regularIntervals,
            threshold: rule.threshold
          }
        };
      }
    }

    return { triggered: false, riskIncrease: 0, details: {} };
  }

  private async evaluateDeviceFingerprint(
    rule: FraudDetectionRule,
    eventData: any,
    session: SessionAnalytics
  ): Promise<{ triggered: boolean; riskIncrease: number; details: any }> {
    if (rule.id === 'bot_user_agent') {
      const botPatterns = [
        /bot/i, /crawler/i, /spider/i, /scraper/i,
        /curl/i, /wget/i, /python/i, /java/i,
        /headless/i, /phantom/i, /selenium/i
      ];

      const isBotUserAgent = botPatterns.some(pattern => 
        pattern.test(eventData.userAgent)
      );

      return {
        triggered: isBotUserAgent,
        riskIncrease: isBotUserAgent ? 100 : 0,
        details: {
          userAgent: eventData.userAgent,
          detectedPatterns: botPatterns.filter(pattern => 
            pattern.test(eventData.userAgent)
          ).map(p => p.toString())
        }
      };
    }

    return { triggered: false, riskIncrease: 0, details: {} };
  }

  private async evaluateBehavioralAnalysis(
    rule: FraudDetectionRule,
    eventData: any,
    session: SessionAnalytics
  ): Promise<{ triggered: boolean; riskIncrease: number; details: any }> {
    if (rule.id === 'high_ctr_anomaly') {
      const impressions = session.events.filter(e => e.type === 'impression').length;
      const clicks = session.events.filter(e => e.type === 'click').length;

      if (impressions >= 10) { // Need minimum impressions for meaningful CTR
        const ctr = (clicks / impressions) * 100;
        const triggered = ctr > rule.threshold;

        return {
          triggered,
          riskIncrease: triggered ? 25 : 0,
          details: {
            impressions,
            clicks,
            ctr: ctr.toFixed(2),
            threshold: rule.threshold
          }
        };
      }
    }

    return { triggered: false, riskIncrease: 0, details: {} };
  }

  // ==================== SESSION MANAGEMENT ====================

  private async getOrCreateSession(eventData: any): Promise<SessionAnalytics> {
    let session = this.sessionCache.get(eventData.sessionId);
    
    if (!session) {
      // Try to load from database
      session = await this.loadSessionFromDb(eventData.sessionId);
      
      if (!session) {
        // Create new session
        session = {
          sessionId: eventData.sessionId,
          userDid: eventData.userDid,
          ipAddress: eventData.ipAddress,
          userAgent: eventData.userAgent,
          deviceFingerprint: this.generateDeviceFingerprint(eventData),
          events: [],
          riskScore: 0,
          flags: [],
          createdAt: new Date().toISOString(),
          lastActivity: new Date().toISOString()
        };
        
        await this.saveSessionToDb(session);
      }
      
      this.sessionCache.set(eventData.sessionId, session);
    }

    return session;
  }

  private generateDeviceFingerprint(eventData: any): string {
    // Simple device fingerprinting based on available data
    const components = [
      eventData.userAgent,
      eventData.ipAddress,
      // In a real implementation, you'd include more factors like:
      // - Screen resolution, timezone, language, plugins, etc.
    ];
    
    return Buffer.from(components.join('|')).toString('base64').slice(0, 32);
  }

  private async loadSessionFromDb(sessionId: string): Promise<SessionAnalytics | null> {
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM session_analytics WHERE session_id = $1',
        [sessionId]
      );
      
      if (result.rows[0]) {
        const row = result.rows[0];
        return {
          sessionId: row.session_id,
          userDid: row.user_did,
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          deviceFingerprint: row.device_fingerprint,
          events: row.events || [],
          riskScore: row.risk_score,
          flags: row.flags || [],
          createdAt: row.created_at?.toISOString(),
          lastActivity: row.last_activity?.toISOString()
        };
      }
      
      return null;
    } finally {
      client.release();
    }
  }

  private async saveSessionToDb(session: SessionAnalytics): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      await client.query(`
        INSERT INTO session_analytics (
          session_id, user_did, ip_address, user_agent, device_fingerprint,
          events, risk_score, flags, created_at, last_activity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (session_id) DO UPDATE SET
          events = $6, risk_score = $7, flags = $8, last_activity = $10
      `, [
        session.sessionId,
        session.userDid,
        session.ipAddress,
        session.userAgent,
        session.deviceFingerprint,
        JSON.stringify(session.events),
        session.riskScore,
        session.flags,
        session.createdAt,
        session.lastActivity
      ]);
    } finally {
      client.release();
    }
  }

  private async updateSession(session: SessionAnalytics): Promise<void> {
    this.sessionCache.set(session.sessionId, session);
    await this.saveSessionToDb(session);
  }

  // ==================== FRAUD ALERT MANAGEMENT ====================

  private async createFraudAlert(rule: FraudDetectionRule, eventData: any, details: any): Promise<void> {
    const alert: FraudAlert = {
      id: `alert_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      severity: rule.severity,
      userDid: eventData.userDid,
      publisherDid: eventData.publisherDid,
      campaignId: eventData.campaignId,
      ipAddress: eventData.ipAddress,
      userAgent: eventData.userAgent,
      details,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const client = await this.db['pool'].connect();
    
    try {
      await client.query(`
        INSERT INTO fraud_alerts (
          id, rule_id, severity, user_did, publisher_did, campaign_id,
          ip_address, user_agent, details, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        alert.id,
        alert.ruleId,
        alert.severity,
        alert.userDid,
        alert.publisherDid,
        alert.campaignId,
        alert.ipAddress,
        alert.userAgent,
        JSON.stringify(alert.details),
        alert.status,
        alert.createdAt
      ]);
      
      console.log(`🚨 Fraud alert created: ${rule.name} (${alert.severity})`);
    } finally {
      client.release();
    }
  }

  // ==================== BLOCKING MANAGEMENT ====================

  private async isEntityBlocked(eventData: any): Promise<boolean> {
    const client = await this.db['pool'].connect();
    
    try {
      const checks = [
        { type: 'ip', value: eventData.ipAddress },
        { type: 'user', value: eventData.userDid },
        { type: 'publisher', value: eventData.publisherDid }
      ].filter(check => check.value);

      for (const check of checks) {
        const result = await client.query(`
          SELECT * FROM blocked_entities 
          WHERE type = $1 AND value = $2 
          AND (blocked_until IS NULL OR blocked_until > NOW())
        `, [check.type, check.value]);
        
        if (result.rows.length > 0) {
          return true;
        }
      }
      
      return false;
    } finally {
      client.release();
    }
  }

  async blockEntity(
    type: 'ip' | 'user' | 'publisher' | 'device',
    value: string,
    reason: string,
    duration?: number // in hours
  ): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      const blockedUntil = duration ? 
        new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() : 
        null;

      await client.query(`
        INSERT INTO blocked_entities (id, type, value, reason, blocked_until, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (type, value) DO UPDATE SET
          reason = $4, blocked_until = $5, created_at = $6
      `, [
        `block_${type}_${value}_${Date.now()}`,
        type,
        value,
        reason,
        blockedUntil,
        new Date().toISOString()
      ]);
      
      console.log(`🚫 Blocked ${type}: ${value} (${reason})`);
    } finally {
      client.release();
    }
  }

  // ==================== ANALYTICS & REPORTING ====================

  async getFraudStats(): Promise<{
    totalAlerts: number;
    activeAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByRule: Record<string, number>;
    blockedEntities: number;
    riskySessions: number;
  }> {
    const client = await this.db['pool'].connect();
    
    try {
      const [alertsResult, severityResult, ruleResult, blockedResult, sessionsResult] = await Promise.all([
        client.query('SELECT COUNT(*) as count FROM fraud_alerts'),
        client.query('SELECT severity, COUNT(*) as count FROM fraud_alerts WHERE status = \'active\' GROUP BY severity'),
        client.query('SELECT rule_id, COUNT(*) as count FROM fraud_alerts GROUP BY rule_id'),
        client.query('SELECT COUNT(*) as count FROM blocked_entities WHERE blocked_until IS NULL OR blocked_until > NOW()'),
        client.query('SELECT COUNT(*) as count FROM session_analytics WHERE risk_score > 50')
      ]);

      const severityCounts = severityResult.rows.reduce((acc, row) => {
        acc[row.severity] = parseInt(row.count);
        return acc;
      }, {});

      const ruleCounts = ruleResult.rows.reduce((acc, row) => {
        acc[row.rule_id] = parseInt(row.count);
        return acc;
      }, {});

      return {
        totalAlerts: parseInt(alertsResult.rows[0].count),
        activeAlerts: severityResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
        alertsBySeverity: severityCounts,
        alertsByRule: ruleCounts,
        blockedEntities: parseInt(blockedResult.rows[0].count),
        riskySessions: parseInt(sessionsResult.rows[0].count)
      };
    } finally {
      client.release();
    }
  }

  async getActiveAlerts(limit: number = 50): Promise<FraudAlert[]> {
    const client = await this.db['pool'].connect();
    
    try {
      const result = await client.query(`
        SELECT fa.*, fr.name as rule_name
        FROM fraud_alerts fa
        LEFT JOIN fraud_rules fr ON fa.rule_id = fr.id
        WHERE fa.status = 'active'
        ORDER BY fa.created_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        severity: row.severity,
        userDid: row.user_did,
        publisherDid: row.publisher_did,
        campaignId: row.campaign_id,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        details: row.details,
        status: row.status,
        createdAt: row.created_at?.toISOString(),
        resolvedAt: row.resolved_at?.toISOString()
      }));
    } finally {
      client.release();
    }
  }

  // ==================== CLEANUP ====================

  private startSessionCleanup(): void {
    // Clean up old sessions every hour
    setInterval(async () => {
      await this.cleanupOldSessions();
    }, 60 * 60 * 1000);
  }

  private async cleanupOldSessions(): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      // Remove sessions older than 24 hours
      const result = await client.query(`
        DELETE FROM session_analytics 
        WHERE last_activity < NOW() - INTERVAL '24 hours'
      `);
      
      if (result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} old sessions`);
      }

      // Clean up memory cache
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      for (const [sessionId, session] of this.sessionCache.entries()) {
        const lastActivity = new Date(session.lastActivity).getTime();
        if (lastActivity < oneDayAgo) {
          this.sessionCache.delete(sessionId);
        }
      }
    } finally {
      client.release();
    }
  }

  private async loadRulesFromDatabase(): Promise<void> {
    const client = await this.db['pool'].connect();
    
    try {
      // First, save default rules to database if they don't exist
      for (const rule of this.rules.values()) {
        await client.query(`
          INSERT INTO fraud_rules (
            id, name, type, enabled, severity, threshold, time_window, action, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (id) DO NOTHING
        `, [
          rule.id, rule.name, rule.type, rule.enabled, rule.severity,
          rule.threshold, rule.timeWindow, rule.action, rule.description
        ]);
      }

      // Load all rules from database
      const result = await client.query('SELECT * FROM fraud_rules');
      
      this.rules.clear();
      result.rows.forEach(row => {
        const rule: FraudDetectionRule = {
          id: row.id,
          name: row.name,
          type: row.type,
          enabled: row.enabled,
          severity: row.severity,
          threshold: row.threshold,
          timeWindow: row.time_window,
          action: row.action,
          description: row.description
        };
        this.rules.set(rule.id, rule);
      });
      
      console.log(`📋 Loaded ${this.rules.size} fraud detection rules`);
    } finally {
      client.release();
    }
  }
}

export default FraudPreventionService;