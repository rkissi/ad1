import React, { useState, useEffect } from 'react';
import { OnboardingLayout } from '../OnboardingLayout';
import { OnboardingStepper } from '../OnboardingStepper';
import { onboardingService } from '@/lib/onboarding-service';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';

const STEPS = ['Platform', 'Integration', 'Monetization', 'Verification'];

export function PublisherOnboarding() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [formData, setFormData] = useState({
    platform_type: 'web',
    content_categories: [] as string[],
    integration_method: 'sdk',
    revenue_split: 0.7,
    ad_density_cap: 2,
    test_ad_served: false,
    test_events_verified: false,
  });

  useEffect(() => {
    if (profile?.onboarding_step) {
        const lastCompletedStep = String(profile.onboarding_step).toLowerCase();
        const stepIndex = STEPS.findIndex(s => s.toLowerCase() === lastCompletedStep);
        if (stepIndex > -1) {
            setCurrentStep(stepIndex + 1);
        }
    }
  }, [profile]);

  const handleNext = async (stepData: any = {}) => {
    setIsLoading(true);
    try {
      const stepName = STEPS[currentStep].toLowerCase();
      const updatedData = { ...formData, ...stepData };
      setFormData(updatedData);

      await onboardingService.saveStep(stepName, stepData);

      if (currentStep === STEPS.length - 1) {
          await onboardingService.complete();
          await refreshProfile();
          navigate('/publisher');
      } else {
          setCurrentStep(prev => prev + 1);
          await refreshProfile();
      }
    } catch (error) {
      console.error(error);
      alert('Failed to save progress.');
    } finally {
      setIsLoading(false);
    }
  };

  const simulateVerification = async () => {
      setIsVerifying(true);
      // Simulate API call delay for test ad
      setTimeout(() => {
          setFormData(prev => ({ ...prev, test_ad_served: true }));
          // Simulate event verification
          setTimeout(() => {
              setFormData(prev => ({ ...prev, test_events_verified: true }));
              setIsVerifying(false);
          }, 1500);
      }, 1500);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Platform
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Platform Type</label>
              <select
                value={formData.platform_type}
                onChange={(e) => setFormData({...formData, platform_type: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="web">Website</option>
                <option value="mobile_app">Mobile App</option>
                <option value="game">Game (Unity/Unreal)</option>
                <option value="vr">VR Experience</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Content Categories</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                  {['News', 'Gaming', 'Education', 'Entertainment', 'Social'].map(cat => (
                      <label key={cat} className="flex items-center space-x-2">
                          <input type="checkbox"
                            checked={formData.content_categories.includes(cat)}
                            onChange={(e) => {
                                const newCats = e.target.checked
                                    ? [...formData.content_categories, cat]
                                    : formData.content_categories.filter(c => c !== cat);
                                setFormData({...formData, content_categories: newCats});
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-gray-700">{cat}</span>
                      </label>
                  ))}
              </div>
            </div>
            <button
              onClick={() => handleNext({ platform_type: formData.platform_type, content_categories: formData.content_categories })}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 1: // Integration
        return (
          <div className="space-y-6">
             <div>
                 <label className="text-base font-semibold text-gray-900">Integration Method</label>
                 <div className="mt-4 space-y-4">
                     <div className="flex items-center">
                         <input
                           id="sdk"
                           name="integration"
                           type="radio"
                           checked={formData.integration_method === 'sdk'}
                           onChange={() => setFormData({...formData, integration_method: 'sdk'})}
                           className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                         />
                         <label htmlFor="sdk" className="ml-3 block text-sm font-medium text-gray-700">
                             JavaScript / Unity SDK (Recommended)
                         </label>
                     </div>
                     <div className="flex items-center">
                         <input
                           id="api"
                           name="integration"
                           type="radio"
                           checked={formData.integration_method === 'api'}
                           onChange={() => setFormData({...formData, integration_method: 'api'})}
                           className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                         />
                         <label htmlFor="api" className="ml-3 block text-sm font-medium text-gray-700">
                             REST API (Advanced)
                         </label>
                     </div>
                 </div>
             </div>
             <button
              onClick={() => handleNext({ integration_method: formData.integration_method })}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 2: // Monetization
        return (
          <div className="space-y-6">
             <div>
                <label className="block text-sm font-medium text-gray-700">Ad Density Cap (Ads per view/page)</label>
                <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.ad_density_cap}
                    onChange={(e) => setFormData({...formData, ad_density_cap: parseInt(e.target.value)})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                />
             </div>
             <button
              onClick={() => handleNext({ ad_density_cap: formData.ad_density_cap, revenue_split: 0.7 })}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 3: // Verification
        return (
           <div className="space-y-6">
              <div className="bg-yellow-50 p-4 rounded text-sm text-yellow-800">
                  Please integrate the SDK/API and trigger a test ad. We need to verify event reception before activation.
              </div>
              <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-white border rounded">
                      <span className="text-sm font-medium text-gray-700">Test Ad Served</span>
                      {formData.test_ad_served ? (
                          <span className="text-green-600 font-bold">✓ Verified</span>
                      ) : (
                          <span className="text-gray-400">Pending...</span>
                      )}
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white border rounded">
                      <span className="text-sm font-medium text-gray-700">Event Received</span>
                      {formData.test_events_verified ? (
                          <span className="text-green-600 font-bold">✓ Verified</span>
                      ) : (
                          <span className="text-gray-400">Pending...</span>
                      )}
                  </div>
              </div>

              {!formData.test_events_verified && (
                  <button
                    onClick={simulateVerification}
                    disabled={isVerifying}
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isVerifying ? 'Verifying Integration...' : 'Simulate Test Traffic (Demo)'}
                  </button>
              )}

              <button
                onClick={() => handleNext({ test_ad_served: true, test_events_verified: true })}
                disabled={isLoading || !formData.test_events_verified}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Activating...' : 'Finish Setup'}
              </button>
           </div>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingLayout title="Publisher Setup" subtitle="Monetize your content">
      <OnboardingStepper steps={STEPS} currentStep={currentStep} />
      {renderStep()}
    </OnboardingLayout>
  );
}
