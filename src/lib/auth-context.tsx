import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeEmail, validateEmail } from './validation';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@/types/supabase';

export interface User {
  id: string;
  did: string;
  email: string;
  displayName: string;
  role: UserRole;
  interests: string[];
  walletAddress?: string;
  tokenBalance?: number;
  avatarUrl?: string;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAuthenticating: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const profileToUser = (profile: Profile): User => ({
  id: profile.id,
  did: profile.did || `did:metaverse:${profile.id}`,
  email: profile.email,
  displayName: profile.display_name || profile.email.split('@')[0],
  role: profile.role,
  interests: profile.interests || [],
  walletAddress: profile.wallet_address || undefined,
  tokenBalance: profile.token_balance || 0,
  avatarUrl: profile.avatar_url || undefined,
});


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Fetch user profile from database
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Check for RLS-related errors and handle gracefully
        if (error.code === '42P17') {
          console.error('RLS policy error - please check database policies:', error);
        } else if (error.code === 'PGRST116') {
          // No rows returned - profile doesn't exist yet
          console.log('Profile not found for user:', userId);
        } else {
          console.error('Error fetching profile:', error);
        }
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Safety timeout to ensure loading screen doesn't hang indefinitely
    const timeoutId = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('Auth initialization timed out, forcing isLoading to false');
        setIsLoading(false);
      }
    }, 5000);

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth state...');
        // Get current session
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          if (mounted) setIsLoading(false);
          return;
        }

        if (currentSession?.user && mounted) {
          setSession(currentSession);
          console.log('Session found for user:', currentSession.user.email);
          const userProfile = await fetchProfile(currentSession.user.id);
          
          if (userProfile && mounted) {
            setProfile(userProfile);
            setUser(profileToUser(userProfile));
            console.log('User state initialized');
          } else if (mounted) {
            console.warn('Profile not found for session user');
            // We don't throw here to allow the app to mount,
            // but the user will be unauthenticated (isAuthenticated will be false)
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          console.log('Auth initialization complete');
          setIsLoading(false);
          clearTimeout(timeoutId);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);
        
        if (!mounted) return;

        setSession(newSession);

        try {
          if (event === 'SIGNED_IN' && newSession?.user) {
            console.log('User signed in, fetching profile...');
            const userProfile = await fetchProfile(newSession.user.id);

            if (userProfile && mounted) {
              setProfile(userProfile);
              setUser(profileToUser(userProfile));
              console.log('User state updated after sign in');
            } else {
              console.error('Profile not found on SIGNED_IN');
            }
          } else if (event === 'SIGNED_OUT') {
            setUser(null);
            setProfile(null);
          } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
            // Refresh profile on token refresh
            const userProfile = await fetchProfile(newSession.user.id);
            if (userProfile && mounted) {
              setProfile(userProfile);
              setUser(profileToUser(userProfile));
            }
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
        } finally {
          if (mounted) {
            setIsLoading(false);
            clearTimeout(timeoutId);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    console.log('Attempting login for:', email);
    setIsAuthenticating(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase signIn error:', error);
        throw new Error(error.message);
      }

      if (data.user && data.session) {
        setSession(data.session);
        
        // Try to fetch profile with retries
        let userProfile = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!userProfile && attempts < maxAttempts) {
          attempts++;
          userProfile = await fetchProfile(data.user.id);
          if (!userProfile && attempts < maxAttempts) {
            console.log(`Profile fetch attempt ${attempts} failed, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (userProfile) {
          setProfile(userProfile);
          setUser(profileToUser(userProfile));
          console.log('✅ Login successful:', email);
        } else {
          // Profile doesn't exist - this might happen for users created before profile trigger
          // Attempt to create profile from auth metadata
          console.warn('Profile not found, attempting to create from auth metadata...');
          
          const userMetadata = data.user.user_metadata || {};
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: data.user.email || email,
              display_name: userMetadata.display_name || email.split('@')[0],
              role: userMetadata.role || 'user',
              did: `did:metaverse:${data.user.id}`
            })
            .select()
            .single();

          if (createError) {
            console.error('Failed to create profile:', createError);
            throw new Error('Unable to load or create user profile. Please try again or contact support.');
          }

          setProfile(newProfile);
          setUser(profileToUser(newProfile));
          console.log('✅ Login successful (profile created):', email);
        }
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = name.trim();
    setIsAuthenticating(true);

    // Client-side validation before hitting Supabase
    if (!validateEmail(normalizedEmail)) {
      setIsAuthenticating(false);
      throw new Error(`Invalid email format: "${normalizedEmail}"`);
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: normalizedName,
            role: role,
          },
        },
      });

      if (error) {
        console.error('Supabase signUp error:', error);
        throw new Error(error.message);
      }

      if (data.user) {
        if (data.session) setSession(data.session);

        // Poll for profile creation (handled by trigger)
        let userProfile = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (!userProfile && attempts < maxAttempts) {
          attempts++;
          userProfile = await fetchProfile(data.user.id);
          if (!userProfile) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (!userProfile) {
          console.warn('Profile not found after polling, attempting manual creation');
          // Manual fallback if trigger fails or is slow
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              email: email,
              display_name: name,
              role: role,
              did: `did:metaverse:${data.user.id}`
            })
            .select()
            .single();

          if (insertError) {
            console.error('Manual profile creation failed:', insertError);
            throw new Error('Failed to create user profile. Please contact support.');
          } else {
            userProfile = newProfile;
          }
        } else {
          // Update profile if it exists but might need fresh data
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
              display_name: name,
              role: role
            })
            .eq('id', data.user.id)
            .select()
            .single();

          if (!updateError) {
            userProfile = updatedProfile;
          }
        }

        // Create role-specific record if session is available (RLS requirement)
        const currentSession = data.session || (await supabase.auth.getSession()).data.session;
        if (currentSession) {
          if (role === 'advertiser') {
            await supabase
              .from('advertisers')
              .upsert({
                user_id: data.user.id,
                company_name: name,
              }, { onConflict: 'user_id' });
          } else if (role === 'publisher') {
            await supabase
              .from('publishers')
              .upsert({
                user_id: data.user.id,
                name: name,
              }, { onConflict: 'user_id' });
          }
        }

        if (userProfile) {
          setProfile(userProfile);
          setUser(profileToUser(userProfile));
        }
      }
    } catch (error: any) {
      console.error('❌ Registration error:', error.message || error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      setSession(null);
      console.log('✅ Logout successful');
    } catch (error: any) {
      console.error('❌ Logout error:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user?.id) throw new Error('No user logged in');

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setUser(profileToUser(data));
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (!session?.user?.id) return;

    const userProfile = await fetchProfile(session.user.id);
    if (userProfile) {
      setProfile(userProfile);
      setUser(profileToUser(userProfile));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile,
      session,
      isAuthenticated: !!user && !!session, 
      isLoading,
      isAuthenticating,
      login, 
      register, 
      logout,
      updateProfile,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Safe version of useAuth that returns null values when not in AuthProvider
export function useAuthSafe() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    return {
      user: null,
      profile: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      isAuthenticating: false,
      login: async () => {},
      register: async () => {},
      logout: async () => {},
      updateProfile: async () => {},
      refreshProfile: async () => {},
    } as AuthContextType;
  }
  return context;
}

// Supabase-based API functions for campaigns
export const campaignAPI = {
  create: async (campaignData: any) => {
    const { data, error } = await supabase
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getAll: async (advertiserId?: string) => {
    let query = supabase.from('campaigns').select('*');
    if (advertiserId) {
      query = query.eq('advertiser_id', advertiserId);
    }
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  getMetrics: async (id: string) => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('impressions, clicks, conversions, ctr, spent, budget')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getEvents: async (id: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('campaign_id', id)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
};

// Event tracking API functions
export const eventAPI = {
  trackImpression: async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, type: 'impression' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  trackClick: async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, type: 'click' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  trackConversion: async (eventData: any) => {
    const { data, error } = await supabase
      .from('events')
      .insert({ ...eventData, type: 'conversion' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  batchTrack: async (events: any[]) => {
    const { data, error } = await supabase
      .from('events')
      .insert(events)
      .select();
    if (error) throw error;
    return data;
  },

  getUserEvents: async (userId: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
};

// Publisher API functions
export const publisherAPI = {
  create: async (publisherData: any) => {
    const { data, error } = await supabase
      .from('publishers')
      .insert(publisherData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getByUserId: async (userId: string) => {
    const { data, error } = await supabase
      .from('publishers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('publishers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getMetrics: async (id: string) => {
    const { data, error } = await supabase
      .from('publishers')
      .select('total_impressions, total_clicks, total_earnings')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getEvents: async (id: string) => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('publisher_id', id)
      .order('timestamp', { ascending: false })
      .limit(100);
    if (error) throw error;
    return data;
  }
};

// Advertiser API functions
export const advertiserAPI = {
  create: async (advertiserData: any) => {
    const { data, error } = await supabase
      .from('advertisers')
      .insert(advertiserData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  getByUserId: async (userId: string) => {
    const { data, error } = await supabase
      .from('advertisers')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('advertisers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// User rewards API functions
export const rewardsAPI = {
  getUserRewards: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  getTotalRewards: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed');
    if (error) throw error;
    return data?.reduce((sum, r) => sum + r.amount, 0) || 0;
  },

  getPendingRewards: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_rewards')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (error) throw error;
    return data?.reduce((sum, r) => sum + r.amount, 0) || 0;
  }
};

// Transactions API functions
export const transactionsAPI = {
  getAll: async (userId: string) => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  create: async (transactionData: any) => {
    const { data, error } = await supabase
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// Consent API functions
export const consentAPI = {
  getUserConsents: async (userId: string) => {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);
    if (error) throw error;
    return data;
  },

  grantConsent: async (consentData: any) => {
    const { data, error } = await supabase
      .from('consents')
      .insert(consentData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  revokeConsent: async (consentId: string) => {
    const { data, error } = await supabase
      .from('consents')
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', consentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

// Analytics API functions
export const analyticsAPI = {
  getDashboardStats: async (userId: string, role: UserRole) => {
    if (role === 'advertiser') {
      const { data: campaigns } = await supabase
        .from('campaigns')
        .select('impressions, clicks, conversions, spent, budget')
        .eq('advertiser_id', userId);
      
      return {
        totalCampaigns: campaigns?.length || 0,
        totalImpressions: campaigns?.reduce((sum, c) => sum + c.impressions, 0) || 0,
        totalClicks: campaigns?.reduce((sum, c) => sum + c.clicks, 0) || 0,
        totalConversions: campaigns?.reduce((sum, c) => sum + c.conversions, 0) || 0,
        totalSpent: campaigns?.reduce((sum, c) => sum + c.spent, 0) || 0,
      };
    } else if (role === 'publisher') {
      const { data: publisher } = await supabase
        .from('publishers')
        .select('total_impressions, total_clicks, total_earnings')
        .eq('user_id', userId)
        .single();
      
      return {
        totalImpressions: publisher?.total_impressions || 0,
        totalClicks: publisher?.total_clicks || 0,
        totalEarnings: publisher?.total_earnings || 0,
      };
    } else if (role === 'user') {
      const { data: rewards } = await supabase
        .from('user_rewards')
        .select('amount, status')
        .eq('user_id', userId);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('token_balance')
        .eq('id', userId)
        .single();
      
      return {
        totalEarned: rewards?.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.amount, 0) || 0,
        pendingRewards: rewards?.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0) || 0,
        tokenBalance: profile?.token_balance || 0,
      };
    }
    
    return {};
  },

  getAdminStats: async () => {
    const [
      { count: totalUsers },
      { count: totalCampaigns },
      { count: totalPublishers },
      { data: transactions }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }),
      supabase.from('publishers').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('amount').eq('status', 'completed'),
    ]);

    return {
      totalUsers: totalUsers || 0,
      totalCampaigns: totalCampaigns || 0,
      totalPublishers: totalPublishers || 0,
      totalRevenue: transactions?.reduce((sum, t) => sum + t.amount, 0) || 0,
    };
  }
};

// Marketplace API functions
export const marketplaceAPI = {
  requestAd: async (adRequest: { publisherId: string; slotId: string; userId?: string }) => {
    // Get active campaigns that match the request
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*, ad_creatives(*)')
      .eq('status', 'active')
      .gt('budget', 0)
      .limit(10);
    
    if (error) throw error;
    
    // Simple matching logic - in production this would be ML-based
    if (campaigns && campaigns.length > 0) {
      const selectedCampaign = campaigns[Math.floor(Math.random() * campaigns.length)];
      return {
        campaign: selectedCampaign,
        creative: selectedCampaign.ad_creatives?.[0] || null,
      };
    }
    
    return null;
  },

  getActiveCampaigns: async () => {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .gt('budget', 0);
    if (error) throw error;
    return data;
  }
};

// Ad Creatives API functions
export const creativesAPI = {
  create: async (creativeData: any) => {
    const { data, error } = await supabase
      .from('ad_creatives')
      .insert(creativeData)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getByCampaign: async (campaignId: string) => {
    const { data, error } = await supabase
      .from('ad_creatives')
      .select('*')
      .eq('campaign_id', campaignId);
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: any) => {
    const { data, error } = await supabase
      .from('ad_creatives')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('ad_creatives')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

// Platform settings API
export const settingsAPI = {
  get: async (key: string) => {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (error) throw error;
    return data?.value;
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('*');
    if (error) throw error;
    return data;
  }
};

export default AuthContext;