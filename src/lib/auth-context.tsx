import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeEmail, validateEmail } from './validation';
import type { Session } from '@supabase/supabase-js';
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
  onboardingStatus: string;
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
  onboardingStatus: profile.onboarding_status || 'not_started',
});


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Ref to store active profile fetch promise to deduplicate requests
  const fetchProfilePromiseRef = useRef<{userId: string, promise: Promise<Profile | null>} | null>(null);

  const fetchProfileWithRetry = async (userId: string, retries = 5, delay = 500): Promise<Profile | null> => {
    // Deduplication: if we are already fetching for this user, return the existing promise
    if (fetchProfilePromiseRef.current?.userId === userId) {
      return fetchProfilePromiseRef.current.promise;
    }

    const fetchPromise = (async () => {
      for (let i = 0; i < retries; i++) {
        try {
          const { data: userProfile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          if (!error && userProfile) {
            return userProfile;
          }

          if (error && error.code !== 'PGRST116') {
             // Handle AbortError
             const isAbort = error.name === 'AbortError' || error.message?.includes('AbortError');
             if (isAbort) {
                 console.debug(`Fetch aborted (attempt ${i + 1})`);
             } else {
                 console.warn(`Error fetching profile (attempt ${i + 1}):`, error);
             }
          }
        } catch (e: any) {
           if (e.name === 'AbortError' || e.message?.includes('AbortError')) {
              console.debug(`Fetch aborted (attempt ${i + 1})`);
           } else {
              console.warn(`Exception fetching profile (attempt ${i + 1}):`, e);
           }
        }

        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return null;
    })();

    fetchProfilePromiseRef.current = { userId, promise: fetchPromise };

    try {
      return await fetchPromise;
    } finally {
      // Clear the ref when done so future calls (e.g. refresh) can fetch again
      if (fetchProfilePromiseRef.current?.userId === userId) {
        fetchProfilePromiseRef.current = null;
      }
    }
  };

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log('Initializing auth state...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (!currentSession?.user) {
          if (mounted) {
            setUser(null);
            setProfile(null);
            setSession(null);
          }
          return;
        }

        if (mounted) setSession(currentSession);

        const userProfile = await fetchProfileWithRetry(currentSession.user.id);

        if (mounted) {
          if (userProfile) {
            setProfile(userProfile);
            setUser(profileToUser(userProfile));
            console.log('User state initialized');
          } else {
            console.warn('Profile not found for session user after retries');
            setProfile(null);
            setUser(null);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || error.message?.includes('AbortError')) {
           console.debug('Auth initialization aborted');
        } else {
           console.error('Auth initialization error:', error);
        }
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          console.log('Auth initialization complete');
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth state changed:', event);
        
        if (!mounted) return;

        if (!newSession?.user) {
          setUser(null);
          setProfile(null);
          setSession(null);
          return;
        }

        setSession(newSession);

        try {
          // fetchProfileWithRetry is now deduplicated, so perfectly safe to call here
          const userProfile = await fetchProfileWithRetry(newSession.user.id);

          if (mounted && userProfile) {
            setProfile(userProfile);
            setUser(profileToUser(userProfile));
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
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

    if (isAuthenticating) return;
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
        // Wait a moment for triggers/consistency
        await new Promise(resolve => setTimeout(resolve, 100));

        // Explicitly fetch profile.
        // Note: onAuthStateChange will also call this, but thanks to deduplication,
        // it will just await the same promise.
        const userProfile = await fetchProfileWithRetry(data.user.id);

        if (userProfile) {
          setSession(data.session);
          setProfile(userProfile);
          setUser(profileToUser(userProfile));
          console.log('✅ Login successful:', email);
        } else {
          console.warn('Profile not found for user:', data.user.id);
          // Don't throw here, as user might need to be created or it's just slow
        }
      }
    } catch (error: any) {
      if (error.message?.includes('AbortError') || error.name === 'AbortError') {
          console.warn('Login aborted.');
          return;
      }
      console.error('❌ Login error:', error);
      throw error;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = name.trim();

    if (isAuthenticating) return;
    setIsAuthenticating(true);

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

        const userProfile = await fetchProfileWithRetry(data.user.id);

        if (userProfile) {
          setProfile(userProfile);
          setUser(profileToUser(userProfile));
        }

        if (data.session) {
          // These operations are safe to run even if duplicates occur, due to upsert
          if (role === 'advertiser') {
            await supabase
              .from('advertisers')
              .upsert({
                user_id: data.user.id,
                company_name: normalizedName,
              }, { onConflict: 'user_id' });
          } else if (role === 'publisher') {
            await supabase
              .from('publishers')
              .upsert({
                user_id: data.user.id,
                name: normalizedName,
              }, { onConflict: 'user_id' });
          }
        }
      }
    } catch (error: any) {
      if (error.message?.includes('AbortError') || error.name === 'AbortError') {
          console.warn('Registration aborted.');
          return;
      }
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

    // We can just use fetchProfileWithRetry logic here, but maybe we want to force fresh?
    // fetchProfileWithRetry uses caching if a request is IN PROGRESS.
    // If no request is in progress, it fetches fresh.
    const userProfile = await fetchProfileWithRetry(session.user.id);

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

export default AuthContext;
