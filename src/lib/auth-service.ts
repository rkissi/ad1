// Enhanced Authentication Service with Blockchain Integration
// Handles user authentication, session management, and blockchain wallet connection

import { UserProfile } from '@/types/platform';
import BlockchainIntegrationService from './blockchain-integration';

export interface AuthUser {
  did: string;
  email: string;
  name?: string;
  role: 'user' | 'advertiser' | 'publisher';
  walletAddress?: string;
  tokenBalance?: string;
  isVerified: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: string;
  refreshToken: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  role?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: 'user' | 'advertiser' | 'publisher';
}

export class AuthenticationService {
  private apiUrl: string;
  private blockchainService: BlockchainIntegrationService;
  private currentSession: AuthSession | null = null;

  constructor(apiUrl: string = 'http://localhost:3001') {
    this.apiUrl = apiUrl;
    this.blockchainService = new BlockchainIntegrationService();
    this.initializeBlockchain();
  }

  private async initializeBlockchain() {
    await this.blockchainService.initialize();
  }

  /**
   * Register a new user
   */
  async register(userData: RegisterData): Promise<AuthSession> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Registration failed');
      }

      const result = await response.json();
      const { user, token } = result.data;

      // Create auth session
      const authUser: AuthUser = {
        did: user.did,
        email: user.email,
        name: userData.name,
        role: userData.role,
        isVerified: true
      };

      // Get blockchain wallet address and balance
      if (this.blockchainService.isBlockchainConnected()) {
        authUser.walletAddress = this.generateWalletAddress(user.did);
        authUser.tokenBalance = await this.blockchainService.getUserTokenBalance(user.did);
        
        // Mint some demo tokens for new users
        await this.blockchainService.mintDemoTokens(user.did, '100');
      }

      const session: AuthSession = {
        token,
        user: authUser,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        refreshToken: this.generateRefreshToken()
      };

      this.currentSession = session;
      this.saveSessionToStorage(session);

      // Record initial consent on blockchain
      if (this.blockchainService.isBlockchainConnected()) {
        await this.blockchainService.recordUserConsent(user.did, 'platform_registration');
      }

      console.log('✅ User registered and authenticated:', authUser.email);
      return session;

    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Login existing user
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    try {
      const response = await fetch(`${this.apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Login failed');
      }

      const result = await response.json();
      const { user, token } = result.data;

      // Create auth session
      const authUser: AuthUser = {
        did: user.did,
        email: user.email,
        name: user.displayName,
        role: credentials.role as any || 'user',
        isVerified: true
      };

      // Get blockchain wallet address and balance
      if (this.blockchainService.isBlockchainConnected()) {
        authUser.walletAddress = this.generateWalletAddress(user.did);
        authUser.tokenBalance = await this.blockchainService.getUserTokenBalance(user.did);
      }

      const session: AuthSession = {
        token,
        user: authUser,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        refreshToken: this.generateRefreshToken()
      };

      this.currentSession = session;
      this.saveSessionToStorage(session);

      console.log('✅ User logged in:', authUser.email);
      return session;

    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      if (this.currentSession) {
        // Could call logout endpoint here if needed
        this.currentSession = null;
        this.clearSessionFromStorage();
        console.log('✅ User logged out');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentSession?.user || null;
  }

  /**
   * Get current session
   */
  getCurrentSession(): AuthSession | null {
    return this.currentSession;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.currentSession) {
      return false;
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(this.currentSession.expiresAt);
    
    if (now >= expiresAt) {
      this.logout();
      return false;
    }

    return true;
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<AuthSession> {
    if (!this.currentSession?.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      // In a real implementation, this would call a refresh endpoint
      // For now, we'll extend the current session
      const newSession: AuthSession = {
        ...this.currentSession,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        refreshToken: this.generateRefreshToken()
      };

      this.currentSession = newSession;
      this.saveSessionToStorage(newSession);

      return newSession;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<AuthUser> {
    if (!this.currentSession) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentSession.token}`
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Profile update failed');
      }

      const result = await response.json();
      const updatedUser = result.data;

      // Update current session
      this.currentSession.user = {
        ...this.currentSession.user,
        name: updatedUser.displayName
      };

      this.saveSessionToStorage(this.currentSession);
      return this.currentSession.user;

    } catch (error) {
      console.error('Profile update failed:', error);
      throw error;
    }
  }

  /**
   * Grant consent for a specific scope
   */
  async grantConsent(scope: string, campaignId?: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('Not authenticated');
    }

    try {
      // Record consent via API
      const response = await fetch(`${this.apiUrl}/api/v1/users/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.currentSession.token}`
        },
        body: JSON.stringify({ scope, campaignId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Consent recording failed');
      }

      // Also record on blockchain if connected
      if (this.blockchainService.isBlockchainConnected()) {
        await this.blockchainService.recordUserConsent(
          this.currentSession.user.did,
          scope,
          campaignId
        );
      }

      console.log('✅ Consent granted:', scope);
    } catch (error) {
      console.error('Consent granting failed:', error);
      throw error;
    }
  }

  /**
   * Revoke consent for a specific scope
   */
  async revokeConsent(scope: string, campaignId?: string): Promise<void> {
    if (!this.currentSession) {
      throw new Error('Not authenticated');
    }

    try {
      // Record revocation on blockchain if connected
      if (this.blockchainService.isBlockchainConnected()) {
        await this.blockchainService.revokeUserConsent(
          this.currentSession.user.did,
          scope,
          campaignId
        );
      }

      console.log('✅ Consent revoked:', scope);
    } catch (error) {
      console.error('Consent revocation failed:', error);
      throw error;
    }
  }

  /**
   * Get user's token balance
   */
  async getTokenBalance(): Promise<string> {
    if (!this.currentSession) {
      return '0';
    }

    try {
      const balance = await this.blockchainService.getUserTokenBalance(this.currentSession.user.did);
      
      // Update session with latest balance
      this.currentSession.user.tokenBalance = balance;
      this.saveSessionToStorage(this.currentSession);
      
      return balance;
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return '0';
    }
  }

  /**
   * Initialize session from storage (for page refresh)
   */
  initializeFromStorage(): boolean {
    try {
      const sessionData = localStorage.getItem('metaverse_ads_session');
      if (!sessionData) {
        return false;
      }

      const session: AuthSession = JSON.parse(sessionData);
      
      // Check if session is expired
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      
      if (now >= expiresAt) {
        this.clearSessionFromStorage();
        return false;
      }

      this.currentSession = session;
      return true;
    } catch (error) {
      console.error('Failed to initialize from storage:', error);
      this.clearSessionFromStorage();
      return false;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private generateWalletAddress(did: string): string {
    // Generate deterministic wallet address from DID
    const hash = did.split(':').pop() || did;
    return `0x${hash.padEnd(40, '0').substring(0, 40)}`;
  }

  private generateRefreshToken(): string {
    return `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private saveSessionToStorage(session: AuthSession): void {
    try {
      localStorage.setItem('metaverse_ads_session', JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save session to storage:', error);
    }
  }

  private clearSessionFromStorage(): void {
    try {
      localStorage.removeItem('metaverse_ads_session');
    } catch (error) {
      console.error('Failed to clear session from storage:', error);
    }
  }
}

export default AuthenticationService;