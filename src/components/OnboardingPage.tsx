import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { UserOnboarding } from './onboarding/user/UserOnboarding';
import { AdvertiserOnboarding } from './onboarding/advertiser/AdvertiserOnboarding';
import { PublisherOnboarding } from './onboarding/publisher/PublisherOnboarding';
import { onboardingService } from '@/lib/onboarding-service';
import { useNavigate } from 'react-router-dom';

export default function OnboardingPage() {
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
       if (profile && profile.onboarding_status === 'not_started') {
           // Call start to set in_progress
           try {
               await onboardingService.start();
               await refreshProfile();
           } catch(e) {
               console.error('Failed to start onboarding:', e);
           }
       }
       setInitializing(false);
    }

    init();
  }, [user]);

  if (isLoading || initializing) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Preparing setup...</p>
            </div>
        </div>
      );
  }

  if (!profile) return null; // Router should handle redirect

  // Admin special case
  if (profile.role === 'admin') {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="bg-white p-8 rounded shadow max-w-md w-full text-center">
                  <h2 className="text-2xl font-bold mb-4">Welcome Admin</h2>
                  <p className="mb-6 text-gray-600">Please confirm your account setup to access the dashboard.</p>
                  <button
                    onClick={async () => {
                        try {
                            await onboardingService.complete();
                            await refreshProfile();
                            navigate('/admin');
                        } catch (e) {
                            console.error(e);
                            alert('Error completing setup');
                        }
                    }}
                    className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  >
                      Enter Dashboard
                  </button>
              </div>
          </div>
      );
  }

  switch (profile.role) {
    case 'user':
      return <UserOnboarding />;
    case 'advertiser':
      return <AdvertiserOnboarding />;
    case 'publisher':
      return <PublisherOnboarding />;
    default:
      return (
          <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                  <p className="text-red-600">Unknown role configuration: {profile.role}</p>
              </div>
          </div>
      );
  }
}
