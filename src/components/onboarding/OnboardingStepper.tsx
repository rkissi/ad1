import React from 'react';

interface OnboardingStepperProps {
  steps: string[];
  currentStep: number; // 0-indexed
}

export function OnboardingStepper({ steps, currentStep }: OnboardingStepperProps) {
  return (
    <div className="w-full py-4 mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
           const isCompleted = index < currentStep;
           const isCurrent = index === currentStep;

           return (
             <React.Fragment key={step}>
               <div className="flex flex-col items-center relative z-10">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors duration-200
                   ${isCompleted ? 'bg-indigo-600 border-indigo-600' : isCurrent ? 'bg-white border-indigo-600 text-indigo-600' : 'bg-white border-gray-300 text-gray-400'}`}>
                   {isCompleted ? (
                     <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                     </svg>
                   ) : (
                     <span className="text-sm font-bold">{index + 1}</span>
                   )}
                 </div>
                 <span className={`mt-2 text-xs font-medium hidden sm:block ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>
                   {step}
                 </span>
               </div>
               {index < steps.length - 1 && (
                 <div className={`flex-1 h-0.5 mx-2 mb-6 transition-colors duration-200 ${index < currentStep ? 'bg-indigo-600' : 'bg-gray-200'}`} />
               )}
             </React.Fragment>
           )
        })}
      </div>
    </div>
  );
}
