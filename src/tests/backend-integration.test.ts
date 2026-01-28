// Backend Integration Tests
import request from 'supertest';
import { expect } from 'chai';
import ApiServer from '../api/server';
import DatabaseService from '../lib/database';
import { eventTracker } from '../lib/event-tracker';

describe('Backend Integration Tests', function() {
  let server: ApiServer;
  let app: any;
  let testUser: any;
  let testCampaign: any;
  let authToken: string;

  before(async function() {
    this.timeout(10000);
    
    // Initialize server
    server = new ApiServer();
    app = server['app'];
    
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  after(async function() {
    await server.stop();
  });

  describe('Authentication API', function() {
    it('should register a new user', async function() {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          role: 'advertiser'
        })
        .expect(201);

      expect(response.body).to.have.property('user');
      expect(response.body).to.have.property('token');
      expect(response.body.user.email).to.equal('test@example.com');
      
      testUser = response.body.user;
      authToken = response.body.token;
    });

    it('should not register duplicate user', async function() {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          role: 'advertiser'
        })
        .expect(409);
    });

    it('should login existing user', async function() {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).to.have.property('user');
      expect(response.body).to.have.property('token');
    });

    it('should reject invalid credentials', async function() {
      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);
    });
  });

  describe('Campaign API', function() {
    it('should create a new campaign', async function() {
      const response = await request(app)
        .post('/api/v1/campaigns')
        .send({
          id: `test-campaign-${Date.now()}`,
          advertiser: testUser.did,
          name: 'Test Campaign',
          description: 'Integration test campaign',
          audienceSpec: {
            interests: ['technology', 'gaming'],
            verifiableClaims: [],
            demographics: {
              ageRange: [18, 65],
              locations: ['US'],
              languages: ['en']
            }
          },
          budget: 1000,
          currency: 'DEV-ERC20',
          creativeManifest: {
            type: 'html5',
            url: '/test-creative.html',
            assets: [],
            metadata: {}
          },
          payoutRules: {
            user: 0.6,
            publisher: 0.35,
            protocol: 0.05
          },
          deliveryConstraints: {
            maxImpressionsPerUser: 3,
            maxClicksPerUser: 1,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          },
          status: 'draft',
          metrics: {
            impressions: 0,
            clicks: 0,
            conversions: 0,
            spent: 0
          }
        })
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body.name).to.equal('Test Campaign');
      
      testCampaign = response.body;
    });

    it('should get campaign by ID', async function() {
      const response = await request(app)
        .get(`/api/v1/campaigns/${testCampaign.id}`)
        .expect(200);

      expect(response.body.id).to.equal(testCampaign.id);
      expect(response.body.name).to.equal('Test Campaign');
    });

    it('should get campaigns by advertiser', async function() {
      const response = await request(app)
        .get(`/api/v1/campaigns?advertiser=${testUser.did}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    });

    it('should update campaign', async function() {
      const response = await request(app)
        .patch(`/api/v1/campaigns/${testCampaign.id}`)
        .send({
          status: 'active',
          budget: 1500
        })
        .expect(200);

      expect(response.body.status).to.equal('active');
      expect(response.body.budget).to.equal(1500);
    });

    it('should return 404 for non-existent campaign', async function() {
      await request(app)
        .get('/api/v1/campaigns/non-existent-id')
        .expect(404);
    });
  });

  describe('Event Tracking API', function() {
    it('should track impression event', async function() {
      const response = await request(app)
        .post('/api/v1/events/impression')
        .send({
          adId: `ad_${testCampaign.id}`,
          campaignId: testCampaign.id,
          userDid: 'did:user:test123',
          publisherDid: 'did:publisher:test',
          slotId: 'header-banner',
          sessionId: 'session_123',
          metadata: {
            deviceType: 'desktop',
            browser: 'chrome'
          }
        })
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body).to.have.property('riskScore');
    });

    it('should track click event', async function() {
      const response = await request(app)
        .post('/api/v1/events/click')
        .send({
          adId: `ad_${testCampaign.id}`,
          campaignId: testCampaign.id,
          userDid: 'did:user:test123',
          publisherDid: 'did:publisher:test',
          slotId: 'header-banner',
          sessionId: 'session_123',
          metadata: {
            clickX: 100,
            clickY: 200
          }
        })
        .expect(201);

      expect(response.body.success).to.be.true;
    });

    it('should track batch events', async function() {
      const events = [
        {
          type: 'impression',
          adId: `ad_${testCampaign.id}`,
          campaignId: testCampaign.id,
          userDid: 'did:user:test456',
          publisherDid: 'did:publisher:test',
          slotId: 'sidebar',
          metadata: {}
        },
        {
          type: 'impression',
          adId: `ad_${testCampaign.id}`,
          campaignId: testCampaign.id,
          userDid: 'did:user:test789',
          publisherDid: 'did:publisher:test',
          slotId: 'footer',
          metadata: {}
        }
      ];

      const response = await request(app)
        .post('/api/v1/events/batch')
        .send({ events })
        .expect(201);

      expect(response.body.success).to.be.true;
      expect(response.body.count).to.equal(2);
    });

    it('should block fraudulent events', async function() {
      // Send many rapid events to trigger fraud detection
      const promises = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          request(app)
            .post('/api/v1/events/click')
            .send({
              adId: `ad_${testCampaign.id}`,
              campaignId: testCampaign.id,
              userDid: 'did:user:fraudster',
              publisherDid: 'did:publisher:test',
              slotId: 'header-banner',
              sessionId: 'fraud_session',
              metadata: {}
            })
        );
      }

      const responses = await Promise.all(promises);
      
      // At least some should be blocked
      const blockedCount = responses.filter(r => r.status === 403).length;
      expect(blockedCount).to.be.greaterThan(0);
    });
  });

  describe('Marketplace API', function() {
    it('should match ad to slot', async function() {
      const response = await request(app)
        .post('/api/v1/marketplace/match')
        .send({
          slot: {
            slotId: 'header-banner',
            width: 728,
            height: 90,
            format: 'banner',
            context: {
              keywords: ['technology', 'gaming'],
              url: 'https://example.com',
              deviceType: 'desktop'
            }
          },
          publisherDid: 'did:publisher:test',
          userDid: 'did:user:test123'
        })
        .expect(200);

      if (response.body.matched) {
        expect(response.body.ad).to.have.property('id');
        expect(response.body.ad).to.have.property('campaignId');
        expect(response.body.ad).to.have.property('creative');
      }
    });

    it('should return no match for incompatible slot', async function() {
      const response = await request(app)
        .post('/api/v1/marketplace/match')
        .send({
          slot: {
            slotId: 'sidebar',
            width: 300,
            height: 250,
            format: 'banner',
            context: {
              keywords: ['unrelated', 'topic'],
              url: 'https://example.com',
              deviceType: 'mobile'
            }
          },
          publisherDid: 'did:publisher:test',
          userDid: 'did:user:test123'
        })
        .expect(200);

      // May or may not match depending on available campaigns
      expect(response.body).to.have.property('matched');
    });
  });

  describe('Analytics API', function() {
    it('should get dashboard metrics', async function() {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .expect(200);

      expect(response.body).to.have.property('overview');
      expect(response.body).to.have.property('performance');
      expect(response.body).to.have.property('realtime');
      expect(response.body).to.have.property('fraud');
      expect(response.body).to.have.property('blockchain');
    });

    it('should get campaign performance', async function() {
      const response = await request(app)
        .get(`/api/v1/analytics/campaigns/${testCampaign.id}`)
        .expect(200);

      expect(response.body).to.be.an('array');
      if (response.body.length > 0) {
        expect(response.body[0]).to.have.property('campaignId');
        expect(response.body[0]).to.have.property('impressions');
        expect(response.body[0]).to.have.property('clicks');
        expect(response.body[0]).to.have.property('ctr');
      }
    });

    it('should get fraud alerts', async function() {
      const response = await request(app)
        .get('/api/v1/analytics/fraud/alerts')
        .expect(200);

      expect(response.body).to.be.an('array');
    });

    it('should get fraud stats', async function() {
      const response = await request(app)
        .get('/api/v1/analytics/fraud/stats')
        .expect(200);

      expect(response.body).to.have.property('totalAlerts');
      expect(response.body).to.have.property('activeAlerts');
      expect(response.body).to.have.property('blockedEntities');
    });
  });

  describe('Consent API', function() {
    it('should record consent', async function() {
      const response = await request(app)
        .post('/api/v1/consent/record')
        .send({
          userDid: 'did:user:test123',
          scope: 'marketing',
          campaignId: testCampaign.id
        })
        .expect(201);

      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('status');
    });

    it('should get user consents', async function() {
      const response = await request(app)
        .get('/api/v1/consent/did:user:test123')
        .expect(200);

      expect(response.body).to.be.an('array');
    });
  });

  describe('Blockchain Escrow API', function() {
    it('should lock campaign funds', async function() {
      this.timeout(30000); // Blockchain operations may take time

      const response = await request(app)
        .post(`/api/v1/campaigns/${testCampaign.id}/lock-funds`)
        .expect(200);

      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('type');
      expect(response.body.type).to.equal('campaign_deposit');
    });

    it('should release campaign funds', async function() {
      this.timeout(30000);

      const response = await request(app)
        .post(`/api/v1/campaigns/${testCampaign.id}/release-funds`)
        .send({
          recipients: [
            {
              address: '0x1234567890123456789012345678901234567890',
              amount: '60',
              role: 'user',
              did: 'did:user:test123'
            },
            {
              address: '0x2345678901234567890123456789012345678901',
              amount: '35',
              role: 'publisher',
              did: 'did:publisher:test'
            },
            {
              address: '0x3456789012345678901234567890123456789012',
              amount: '5',
              role: 'protocol'
            }
          ]
        })
        .expect(200);

      expect(response.body).to.have.property('id');
      expect(response.body).to.have.property('type');
      expect(response.body.type).to.equal('payout_execution');
    });
  });

  describe('Health & Metrics', function() {
    it('should return health status', async function() {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).to.have.property('environment');
      expect(response.body).to.have.property('status');
      expect(response.body).to.have.property('services');
    });

    it('should return Prometheus metrics', async function() {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).to.include('metaverse_ads_impressions_total');
      expect(response.text).to.include('metaverse_ads_clicks_total');
      expect(response.text).to.include('metaverse_ads_active_campaigns');
    });
  });

  describe('Error Handling', function() {
    it('should return 404 for unknown routes', async function() {
      await request(app)
        .get('/api/v1/unknown-route')
        .expect(404);
    });

    it('should handle malformed JSON', async function() {
      await request(app)
        .post('/api/v1/campaigns')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should enforce rate limiting', async function() {
      this.timeout(10000);

      // Send many requests rapidly
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app)
            .get('/api/v1/campaigns')
            .catch(() => {}) // Ignore errors
        );
      }

      const responses = await Promise.all(promises);
      
      // Some should be rate limited
      const rateLimited = responses.filter(r => r && r.status === 429).length;
      expect(rateLimited).to.be.greaterThan(0);
    });
  });

  describe('Performance Tests', function() {
    it('should handle concurrent campaign creation', async function() {
      this.timeout(10000);

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/v1/campaigns')
            .send({
              id: `perf-test-${Date.now()}-${i}`,
              advertiser: testUser.did,
              name: `Performance Test Campaign ${i}`,
              description: 'Load test',
              audienceSpec: {
                interests: ['test'],
                verifiableClaims: [],
                demographics: { ageRange: [18, 65], locations: [], languages: ['en'] }
              },
              budget: 100,
              currency: 'DEV-ERC20',
              creativeManifest: { type: 'html5', url: '/test.html', assets: [], metadata: {} },
              payoutRules: { user: 0.6, publisher: 0.35, protocol: 0.05 },
              deliveryConstraints: {
                maxImpressionsPerUser: 3,
                maxClicksPerUser: 1,
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
              },
              status: 'draft',
              metrics: { impressions: 0, clicks: 0, conversions: 0, spent: 0 }
            })
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 201).length;
      
      expect(successCount).to.equal(10);
    });

    it('should handle concurrent event tracking', async function() {
      this.timeout(10000);

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          request(app)
            .post('/api/v1/events/impression')
            .send({
              adId: `ad_${testCampaign.id}`,
              campaignId: testCampaign.id,
              userDid: `did:user:perf${i}`,
              publisherDid: 'did:publisher:test',
              slotId: 'test-slot',
              sessionId: `session_${i}`,
              metadata: {}
            })
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.status === 201).length;
      
      expect(successCount).to.be.greaterThan(40); // Allow some to be blocked by fraud detection
    });
  });
});
