import React, { useState, useEffect } from 'react';
import { OnboardingLayout } from '../OnboardingLayout';
import { OnboardingStepper } from '../OnboardingStepper';
import { onboardingService } from '@/lib/onboarding-service';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Check, Save } from 'lucide-react';

const STEPS = ['Identity', 'Compliance', 'Education', 'First Campaign'];

export function AdvertiserOnboarding() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    industry: '',
    compliance_confirmed: false,
    understands_consent_model: false,
    understands_targeting_limits: false,
    understands_payout_rules: false,
    first_campaign_name: '',
    first_campaign_budget: 100
  });

  useEffect(() => {
    if (profile?.onboarding_step) {
        const lastCompletedStep = String(profile.onboarding_step).toLowerCase();
        const stepIndex = STEPS.findIndex(s => s.toLowerCase() === lastCompletedStep);
        if (stepIndex > -1) {
            setCurrentStep(Math.min(stepIndex + 1, STEPS.length - 1));
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

      // Perform step specific actions
      if (currentStep === 3) { // First Campaign
         // Ideally create a campaign here
         // For now, we just mark the flag
         stepData = { first_campaign_created: true };
      }

      await onboardingService.saveStep(stepName, stepData);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);

      if (currentStep === STEPS.length - 1) {
          await onboardingService.complete();
          await refreshProfile();
          navigate('/advertiser');
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

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Identity
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Company Name</label>
              <input
                type="text"
                value={formData.company_name}
                onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Industry</label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
              >
                <option value="">Select Industry</option>
                <option value="tech">Technology</option>
                <option value="retail">Retail</option>
                <option value="finance">Finance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <button
              onClick={() => handleNext({ company_name: formData.company_name, industry: formData.industry })}
              disabled={isLoading || !formData.company_name || !formData.industry}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 1: // Compliance
        return (
          <div className="space-y-6">
             <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={formData.compliance_confirmed}
                  onChange={(e) => setFormData({...formData, compliance_confirmed: e.target.checked})}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                />
                <label className="ml-3 block text-sm text-gray-900">
                  I confirm that my ads will not contain scams, dark patterns, or illegal content.
                  I understand that non-compliance will result in account suspension and forfeiture of funds.
                </label>
             </div>
             <button
              onClick={() => handleNext({ compliance_confirmed: true })}
              disabled={isLoading || !formData.compliance_confirmed}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 2: // Education
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Platform Knowledge Check</h3>
            <div className="space-y-4">
               {[
                 { key: 'understands_consent_model', label: 'I understand users must explicitly opt-in to view my ads.' },
                 { key: 'understands_targeting_limits', label: 'I understand I cannot target users based on PII, only interests.' },
                 { key: 'understands_payout_rules', label: 'I understand funds are held in smart contracts and released on verified events.' }
               ].map((item) => (
                 <div key={item.key} className="flex items-start">
                    <input
                      type="checkbox"
                      checked={(formData as any)[item.key]}
                      onChange={(e) => setFormData({...formData, [item.key]: e.target.checked})}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                    />
                    <label className="ml-3 block text-sm text-gray-700">{item.label}</label>
                 </div>
               ))}
            </div>
             <button
              onClick={() => handleNext({
                  understands_consent_model: true,
                  understands_targeting_limits: true,
                  understands_payout_rules: true
              })}
              disabled={isLoading || !formData.understands_consent_model || !formData.understands_targeting_limits || !formData.understands_payout_rules}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Next'}
            </button>
          </div>
        );

      case 3: // First Campaign
        return (
           <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded text-sm text-gray-700">
                  Create your first campaign draft to complete onboarding. You won't be charged yet.
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Campaign Name</label>
                  <input
                    type="text"
                    value={formData.first_campaign_name}
                    onChange={(e) => setFormData({...formData, first_campaign_name: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                  />
              </div>
              <button
                onClick={() => handleNext()}
                disabled={isLoading || !formData.first_campaign_name}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Creating & Finishing...' : 'Create Draft & Finish'}
              </button>
           </div>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingLayout title="Advertiser Setup" subtitle="Reach engaged users securely">
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
