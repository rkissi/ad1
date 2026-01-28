// Mock API Server for Browser-based Development
// Simulates backend API responses when no backend is available

interface MockUser {
  did: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: string;
  interests: string[];
}

class MockApiServer {
  private users: Map<string, MockUser> = new Map();
  private campaigns: Map<string, any> = new Map();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData() {
    // Add demo users
    const demoUsers = [
      {
        did: 'did:advertiser:demo',
        email: 'advertiser@demo.com',
        passwordHash: 'demo123',
        displayName: 'Demo Advertiser',
        role: 'advertiser',
        interests: ['technology', 'marketing']
      },
      {
        did: 'did:user:demo',
        email: 'user@demo.com',
        passwordHash: 'demo123',
        displayName: 'Demo User',
        role: 'user',
        interests: ['travel', 'fashion', 'technology']
      },
      {
        did: 'did:publisher:demo',
        email: 'publisher@demo.com',
        passwordHash: 'demo123',
        displayName: 'Demo Publisher',
        role: 'publisher',
        interests: ['media', 'content']
      }
    ];

    demoUsers.forEach(user => {
      this.users.set(user.email, user);
    });
  }

  async register(email: string, password: string, name: string, role: string = 'user') {
    // Check if user exists
    if (this.users.has(email)) {
      throw new Error('User already exists');
    }

    // Create new user
    const userDid = `did:${role}:${Date.now()}`;
    const newUser: MockUser = {
      did: userDid,
      email,
      passwordHash: password,
      displayName: name || email.split('@')[0],
      role,
      interests: []
    };

    this.users.set(email, newUser);

    return {
      success: true,
      data: {
        user: {
          did: newUser.did,
          email: newUser.email,
          displayName: newUser.displayName,
          role: newUser.role,
          interests: newUser.interests
        },
        token: `mock-jwt-${userDid}`
      }
    };
  }

  async login(email: string, password: string) {
    const user = this.users.get(email);

    if (!user || user.passwordHash !== password) {
      throw new Error('Invalid email or password');
    }

    return {
      success: true,
      data: {
        user: {
          did: user.did,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          interests: user.interests
        },
        token: `mock-jwt-${user.did}`
      }
    };
  }

  async getCampaigns() {
    return {
      success: true,
      data: Array.from(this.campaigns.values())
    };
  }

  async createCampaign(campaignData: any) {
    const campaignId = `campaign-${Date.now()}`;
    const campaign = {
      id: campaignId,
      ...campaignData,
      status: 'draft',
      metrics: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spent: 0
      },
      createdAt: new Date().toISOString()
    };

    this.campaigns.set(campaignId, campaign);

    return {
      success: true,
      data: campaign
    };
  }
}

// Create singleton instance
export const mockApiServer = new MockApiServer();

// Intercept fetch requests and route to mock server
export function setupMockApi() {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Only intercept API calls
    if (!url.includes('/api/v1/')) {
      return originalFetch(input, init);
    }

    console.log('🔄 Mock API intercepted:', url);

    try {
      let result;

      // Parse request body
      const body = init?.body ? JSON.parse(init.body as string) : {};

      // Route to appropriate mock handler
      if (url.includes('/auth/register')) {
        result = await mockApiServer.register(
          body.email,
          body.password,
          body.name,
          body.role
        );
      } else if (url.includes('/auth/login')) {
        result = await mockApiServer.login(body.email, body.password);
      } else if (url.includes('/campaigns') && init?.method === 'POST') {
        result = await mockApiServer.createCampaign(body);
      } else if (url.includes('/campaigns')) {
        result = await mockApiServer.getCampaigns();
      } else {
        // Default success response
        result = { success: true, data: {} };
      }

      // Return mock response
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error: any) {
      console.error('❌ Mock API error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: { message: error.message }
        }),
        {
          status: error.message.includes('already exists') ? 409 : 
                  error.message.includes('Invalid') ? 401 : 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
  };

  console.log('✅ Mock API server initialized');
}

export default mockApiServer;
