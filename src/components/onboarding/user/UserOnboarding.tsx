import React, { useState, useEffect } from 'react';
import { OnboardingLayout } from '../OnboardingLayout';
import { OnboardingStepper } from '../OnboardingStepper';
import { onboardingService } from '@/lib/onboarding-service';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Check, Save } from 'lucide-react';

const STEPS = ['Intent', 'Consent', 'Privacy', 'Rewards'];

export function UserOnboarding() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [formData, setFormData] = useState({
    intent: 'earn',
    allowed_categories: [] as string[],
    blocked_categories: [] as string[],
    format_preferences: ['display'] as string[],
    privacy_acknowledged: false,
    payout_threshold: 10,
  });

  // Sync with profile step
  useEffect(() => {
    if (profile?.onboarding_step) {
        const lastCompletedStep = String(profile.onboarding_step).toLowerCase();
        const stepIndex = STEPS.findIndex(s => s.toLowerCase() === lastCompletedStep);
        if (stepIndex > -1) {
            // If the user has completed a step, move them to the next one
            // Ensure we don't go out of bounds
            const nextStep = Math.min(stepIndex + 1, STEPS.length - 1);
            setCurrentStep(nextStep);
        }
    }
  }, [profile]);

  // Reset saved indicator on change
  useEffect(() => {
    setIsSaved(false);
  }, [formData, currentStep]);

  const handleNext = async (stepData: any = {}) => {
    setIsLoading(true);
    try {
      const stepName = STEPS[currentStep].toLowerCase();
      const updatedData = { ...formData, ...stepData };
      setFormData(updatedData);

      // Save current step data
      await onboardingService.saveStep(stepName, stepData);

      // Show saved indicator
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);

      if (currentStep === STEPS.length - 1) {
          // Verify completion and redirect
          await onboardingService.complete();
          await refreshProfile();
          navigate('/user');
      } else {
          setCurrentStep(prev => prev + 1);
          await refreshProfile();
      }
    } catch (error) {
      console.error(error);
      alert('Failed to save progress. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Intent
        return (
          <div className="space-y-6">
            <div>
              <label className="text-base font-semibold text-gray-900">What is your primary goal?</label>
              <p className="text-sm text-gray-500">Select the main reason you are joining.</p>
              <fieldset className="mt-4">
                <div className="space-y-4">
                  {['Earn Rewards', 'Discover Products', 'Support Creators'].map((intent) => (
                    <div key={intent} className="flex items-center">
                      <input
                        id={intent}
                        name="intent"
                        type="radio"
                        checked={formData.intent === intent.split(' ')[0].toLowerCase()}
                        onChange={() => setFormData({...formData, intent: intent.split(' ')[0].toLowerCase()})}
                        className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label htmlFor={intent} className="ml-3 block text-sm font-medium leading-6 text-gray-900">
                        {intent}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </div>
            <button
              onClick={() => handleNext({ intent: formData.intent })}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 1: // Consent
        return (
          <div className="space-y-6">
             <div>
              <label className="text-base font-semibold text-gray-900">Ad Categories</label>
              <p className="text-sm text-gray-500">Select categories you are interested in.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                  {['Technology', 'Fashion', 'Gaming', 'Finance', 'Food', 'Travel'].map(cat => (
                      <label key={cat} className="flex items-center space-x-2">
                          <input type="checkbox"
                            checked={formData.allowed_categories.includes(cat)}
                            onChange={(e) => {
                                const newCats = e.target.checked
                                    ? [...formData.allowed_categories, cat]
                                    : formData.allowed_categories.filter(c => c !== cat);
                                setFormData({...formData, allowed_categories: newCats});
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <span className="text-sm text-gray-700">{cat}</span>
                      </label>
                  ))}
              </div>
            </div>
            <button
              onClick={() => handleNext({ allowed_categories: formData.allowed_categories })}
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 2: // Privacy
        return (
            <div className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-md">
                    <h3 className="text-sm font-medium text-blue-800">Privacy First</h3>
                    <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                        <li>We do not store PII.</li>
                        <li>You own your data.</li>
                        <li>You can revoke consent anytime.</li>
                    </ul>
                </div>
                <div className="flex items-start">
                    <div className="flex h-6 items-center">
                        <input
                            id="privacy"
                            name="privacy"
                            type="checkbox"
                            checked={formData.privacy_acknowledged}
                            onChange={(e) => setFormData({...formData, privacy_acknowledged: e.target.checked})}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                        />
                    </div>
                    <div className="ml-3 text-sm leading-6">
                        <label htmlFor="privacy" className="font-medium text-gray-900">
                            I acknowledge the privacy terms
                        </label>
                    </div>
                </div>
                <button
                    onClick={() => handleNext({ privacy_acknowledged: true })}
                    disabled={isLoading || !formData.privacy_acknowledged}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isLoading ? 'Saving...' : 'Next'}
                </button>
            </div>
        );

      case 3: // Rewards
        return (
            <div className="space-y-6">
                <div>
                    <label htmlFor="payout" className="block text-sm font-medium leading-6 text-gray-900">
                        Minimum Payout Threshold ($)
                    </label>
                    <div className="mt-2">
                        <input
                            type="number"
                            name="payout"
                            id="payout"
                            min="5"
                            value={formData.payout_threshold}
                            onChange={(e) => setFormData({...formData, payout_threshold: parseFloat(e.target.value)})}
                            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
                        />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                        Minimum amount required to trigger a payout to your wallet.
                    </p>
                </div>
                <button
                    onClick={() => handleNext({ payout_threshold: formData.payout_threshold })}
                    disabled={isLoading}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isLoading ? 'Finishing...' : 'Complete Setup'}
                </button>
            </div>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingLayout title="Welcome User" subtitle="Let's set up your preferences">
       <div className="flex justify-end mb-2 h-6">
           {isSaved && (
               <span className="text-xs text-green-600 flex items-center animate-fade-in-out">
                   <Save className="w-3 h-3 mr-1" /> Progress saved
               </span>
           )}
       </div>
      <OnboardingStepper steps={STEPS} currentStep={currentStep} />
      {renderStep()}
    </OnboardingLayout>
  );
}
