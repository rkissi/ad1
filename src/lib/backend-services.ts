// Backend Services with Enterprise Error Handling
// Centralized API service with role-based access control

// Use relative path to support proxying/rewrites
const API_BASE_URL = '';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class BackendService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  private updateToken() {
    this.token = localStorage.getItem('auth_token');
  }

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    this.updateToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      // Handle different response types
      const contentType = response.headers.get('content-type');
      let result: any;

      if (contentType?.includes('application/json')) {
        result = await response.json();
      } else {
        result = { success: false, error: { message: await response.text() } };
      }

      if (!response.ok) {
        throw new ApiError(
          result.error?.message || `HTTP ${response.status}`,
          response.status,
          result.error?.code,
          result.error?.details
        );
      }

      return result.data || result;
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or other errors
      console.error(`API request failed [${endpoint}]:`, error);
      throw new ApiError(
        error.message || 'Network error. Please check your connection.',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // ==================== HEALTH ====================
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.json();
    } catch (error) {
      return { status: 'unavailable', error: 'Backend service is not reachable' };
    }
  }

  // ==================== ADMIN ENDPOINTS ====================
  
  async getAdminUsers(params?: { limit?: number; offset?: number; search?: string; role?: string; status?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/v1/admin/users${query ? '?' + query : ''}`);
  }

  async getAdminUser(did: string) {
    return this.request(`/api/v1/admin/users/${did}`);
  }

  async suspendUser(did: string) {
    return this.request(`/api/v1/admin/users/${did}/suspend`, { method: 'POST' });
  }

  async activateUser(did: string) {
    return this.request(`/api/v1/admin/users/${did}/activate`, { method: 'POST' });
  }

  async deleteUser(did: string) {
    return this.request(`/api/v1/admin/users/${did}`, { method: 'DELETE' });
  }

  async getAdminCampaigns(params?: { limit?: number; offset?: number; status?: string; search?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/v1/admin/campaigns${query ? '?' + query : ''}`);
  }

  async approveCampaign(id: string) {
    return this.request(`/api/v1/admin/campaigns/${id}/approve`, { method: 'POST' });
  }

  async rejectCampaign(id: string, reason: string) {
    return this.request(`/api/v1/admin/campaigns/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async pauseCampaign(id: string) {
    return this.request(`/api/v1/admin/campaigns/${id}/pause`, { method: 'POST' });
  }

  async getAdminAnalytics() {
    return this.request('/api/v1/admin/analytics/overview');
  }

  async getRevenueAnalytics(period: number = 30) {
    return this.request(`/api/v1/admin/analytics/revenue?period=${period}`);
  }

  async getFraudAlerts() {
    return this.request('/api/v1/admin/fraud/alerts');
  }

  async resolveFraudAlert(id: string, resolution: string) {
    return this.request(`/api/v1/admin/fraud/alerts/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    });
  }

  async getSystemSettings() {
    return this.request('/api/v1/admin/settings');
  }

  async updateSystemSettings(settings: any) {
    return this.request('/api/v1/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getAuditLog(params?: { limit?: number; offset?: number; actionType?: string; targetType?: string }) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/api/v1/admin/audit-log${query ? '?' + query : ''}`);
  }

  // ==================== USER ENDPOINTS ====================

  async getUserProfile() {
    return this.request('/api/v1/users/profile');
  }

  async updateUserProfile(updates: any) {
    return this.request('/api/v1/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  // ==================== CAMPAIGN ENDPOINTS ====================

  async getCampaigns() {
    return this.request('/api/v1/campaigns');
  }

  async getCampaign(id: string) {
    return this.request(`/api/v1/campaigns/${id}`);
  }

  async createCampaign(campaignData: any) {
    return this.request('/api/v1/campaigns', {
      method: 'POST',
      body: JSON.stringify(campaignData),
    });
  }

  async updateCampaign(id: string, updates: any) {
    return this.request(`/api/v1/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getCampaignMetrics(id: string) {
    return this.request(`/api/v1/campaigns/${id}/metrics`);
  }

  // ==================== EVENT TRACKING ====================

  async trackEvent(eventData: any) {
    return this.request('/api/v1/events/track', {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
  }

  // ==================== MARKETPLACE ====================

  async requestAd(adRequest: any) {
    return this.request('/api/v1/marketplace/match', {
      method: 'POST',
      body: JSON.stringify(adRequest),
    });
  }
}

export const backendService = new BackendService();
export default BackendService;