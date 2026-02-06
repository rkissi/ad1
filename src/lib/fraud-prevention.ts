// Fraud Prevention & Ad Integrity System
// Implements anti-fraud mechanisms, bot detection, and payout verification

import { eventTracker } from './event-tracker';
import { supabaseServer } from './supabase-server';

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
  private rules: Map<string, FraudDetectionRule> = new Map();
  private sessionCache: Map<string, SessionAnalytics> = new Map();
  private ipRateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private isInitialized: boolean = false;
  private supabase = supabaseServer;

  constructor() {
    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    try {
      // Tables are managed via migrations
      await this.loadRulesFromDatabase();
      this.startSessionCleanup();
      this.isInitialized = true;
      console.log('✅ Fraud Prevention Service initialized');
    } catch (error) {
      console.error('❌ Fraud Prevention initialization failed:', error);
      throw error;
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
    // Evaluation logic remains same (memory based mostly)
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

  // ... (evaluate methods omitted for brevity as they are logic-only, will copy original implementation)
  private async evaluateRateLimit(
    rule: FraudDetectionRule,
    eventData: any,
    session: SessionAnalytics
  ): Promise<{ triggered: boolean; riskIncrease: number; details: any }> {
    const now = Date.now();
    const windowStart = now - (rule.timeWindow * 1000);

    let eventCount = 0;

    if (rule.id === 'ip_rate_limit') {
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
      eventCount = session.events.filter(event => {
        const eventTime = new Date(event.timestamp).getTime();
        return eventTime >= windowStart && 
               (rule.id.includes('clicks') ? event.type === 'click' : 
                rule.id.includes('impressions') ? event.type === 'impression' : true);
      }).length + 1;
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
        const intervals = [];
        for (let i = 1; i < clickEvents.length; i++) {
          intervals.push(clickEvents[i] - clickEvents[i - 1]);
        }
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
      if (impressions >= 10) {
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
      session = await this.loadSessionFromDb(eventData.sessionId);
      
      if (!session) {
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
    const components = [
      eventData.userAgent,
      eventData.ipAddress,
    ];
    return Buffer.from(components.join('|')).toString('base64').slice(0, 32);
  }

  private async loadSessionFromDb(sessionId: string): Promise<SessionAnalytics | null> {
    const { data, error } = await this.supabase
      .from('session_analytics')
      .select('*')
      .eq('session_id', sessionId)
      .single();
    
    if (error || !data) return null;

    return {
      sessionId: data.session_id,
      userDid: data.user_did,
      ipAddress: data.ip_address,
      userAgent: data.user_agent,
      deviceFingerprint: data.device_fingerprint,
      events: data.events || [],
      riskScore: data.risk_score,
      flags: data.flags || [],
      createdAt: data.created_at,
      lastActivity: data.last_activity
    };
  }

  private async saveSessionToDb(session: SessionAnalytics): Promise<void> {
    const { error } = await this.supabase
      .from('session_analytics')
      .upsert({
        session_id: session.sessionId,
        user_did: session.userDid,
        ip_address: session.ipAddress,
        user_agent: session.userAgent,
        device_fingerprint: session.deviceFingerprint,
        events: session.events,
        risk_score: session.riskScore,
        flags: session.flags,
        created_at: session.createdAt,
        last_activity: session.lastActivity
      });

    if (error) console.error('Error saving session:', error);
  }

  private async updateSession(session: SessionAnalytics): Promise<void> {
    this.sessionCache.set(session.sessionId, session);
    await this.saveSessionToDb(session);
  }

  // ==================== FRAUD ALERT MANAGEMENT ====================

  private async createFraudAlert(rule: FraudDetectionRule, eventData: any, details: any): Promise<void> {
    const alertId = `alert_${rule.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const { error } = await this.supabase
      .from('fraud_alerts')
      .insert({
        id: alertId,
        rule_id: rule.id,
        severity: rule.severity,
        user_did: eventData.userDid,
        publisher_did: eventData.publisherDid,
        campaign_id: eventData.campaignId,
        ip_address: eventData.ipAddress,
        user_agent: eventData.userAgent,
        details: details,
        status: 'active',
        created_at: new Date().toISOString()
      });
      
    if (error) {
       console.error('Error creating fraud alert:', error);
    } else {
       console.log(`🚨 Fraud alert created: ${rule.name} (${rule.severity})`);
    }
  }

  // ==================== BLOCKING MANAGEMENT ====================

  private async isEntityBlocked(eventData: any): Promise<boolean> {
    const checks = [
      { type: 'ip', value: eventData.ipAddress },
      { type: 'user', value: eventData.userDid },
      { type: 'publisher', value: eventData.publisherDid }
    ].filter(check => check.value);

    for (const check of checks) {
      // Need to handle blocked_until logic.
      // Supabase query: type=check.type, value=check.value, AND (blocked_until IS NULL OR blocked_until > NOW)
      // .is('blocked_until', null) OR .gt('blocked_until', now)
      // Supabase 'or' syntax: .or('blocked_until.is.null,blocked_until.gt.now')
      const now = new Date().toISOString();
      const { data } = await this.supabase
        .from('blocked_entities')
        .select('id')
        .eq('type', check.type)
        .eq('value', check.value)
        .or(`blocked_until.is.null,blocked_until.gt.${now}`)
        .limit(1);
      
      if (data && data.length > 0) return true;
    }

    return false;
  }

  async blockEntity(
    type: 'ip' | 'user' | 'publisher' | 'device',
    value: string,
    reason: string,
    duration?: number // in hours
  ): Promise<void> {
    const blockedUntil = duration ?
      new Date(Date.now() + duration * 60 * 60 * 1000).toISOString() :
      null;

    // Check if already blocked to avoid duplicates (manual upsert logic)
    const { data: existing } = await this.supabase
      .from('blocked_entities')
      .select('id')
      .eq('type', type)
      .eq('value', value)
      .is('blocked_until', null) // Only check active permanent blocks or future blocks
      .limit(1);

    if (existing && existing.length > 0) {
       // Already blocked, maybe update?
       return;
    }

    const { error } = await this.supabase
      .from('blocked_entities')
      .insert({
         // id: auto-generated UUID
         type,
         value,
         reason,
         blocked_until: blockedUntil,
         created_at: new Date().toISOString()
      });

    if (error) console.error('Error blocking entity:', error);
    else console.log(`🚫 Blocked ${type}: ${value} (${reason})`);
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
    const { count: totalAlerts } = await this.supabase.from('fraud_alerts').select('*', { count: 'exact', head: true });
    const { data: alerts } = await this.supabase.from('fraud_alerts').select('severity, rule_id, status');
    
    const activeAlerts = alerts?.filter(a => a.status === 'active').length || 0;

    const alertsBySeverity = alerts?.reduce((acc: any, row: any) => {
        if (row.status === 'active') {
            acc[row.severity] = (acc[row.severity] || 0) + 1;
        }
        return acc;
    }, {}) || {};

    const alertsByRule = alerts?.reduce((acc: any, row: any) => {
        acc[row.rule_id] = (acc[row.rule_id] || 0) + 1;
        return acc;
    }, {}) || {};

    const { count: blockedEntities } = await this.supabase.from('blocked_entities').select('*', { count: 'exact', head: true });
    // Filter active blocks is harder with count, assume total for now or query
    const { count: riskySessions } = await this.supabase.from('session_analytics').select('*', { count: 'exact', head: true }).gt('risk_score', 50);

    return {
      totalAlerts: totalAlerts || 0,
      activeAlerts,
      alertsBySeverity,
      alertsByRule,
      blockedEntities: blockedEntities || 0,
      riskySessions: riskySessions || 0
    };
  }

  async getActiveAlerts(limit: number = 50): Promise<FraudAlert[]> {
    const { data, error } = await this.supabase
      .from('fraud_alerts')
      .select(`
        *,
        fraud_rules (name)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map(row => ({
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
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
    }));
  }

  // ==================== CLEANUP ====================

  private startSessionCleanup(): void {
    setInterval(async () => {
      await this.cleanupOldSessions();
    }, 60 * 60 * 1000);
  }

  private async cleanupOldSessions(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { error } = await this.supabase
        .from('session_analytics')
        .delete()
        .lt('last_activity', oneDayAgo);

    if (error) console.error('Error cleaning sessions:', error);

    // Clean cache
    const now = Date.now();
    for (const [sessionId, session] of this.sessionCache.entries()) {
        const lastActivity = new Date(session.lastActivity).getTime();
        if (lastActivity < now - (24 * 60 * 60 * 1000)) {
            this.sessionCache.delete(sessionId);
        }
    }
  }

  private async loadRulesFromDatabase(): Promise<void> {
    // Save defaults
    for (const rule of this.rules.values()) {
        await this.supabase.from('fraud_rules').upsert({
            id: rule.id,
            name: rule.name,
            type: rule.type,
            enabled: rule.enabled,
            severity: rule.severity,
            threshold: rule.threshold,
            time_window: rule.timeWindow,
            action: rule.action,
            description: rule.description
        });
    }

    // Load
    const { data, error } = await this.supabase.from('fraud_rules').select('*');

    if (data) {
        this.rules.clear();
        data.forEach(row => {
            this.rules.set(row.id, {
                id: row.id,
                name: row.name,
                type: row.type as any,
                enabled: row.enabled,
                severity: row.severity as any,
                threshold: row.threshold,
                timeWindow: row.time_window,
                action: row.action as any,
                description: row.description
            });
        });
        console.log(`📋 Loaded ${this.rules.size} fraud detection rules`);
    }
  }
}

export default FraudPreventionService;
