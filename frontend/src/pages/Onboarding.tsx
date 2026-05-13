import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/form-controls';

export function Onboarding() {
  const { t } = useTranslation();
  const steps = useMemo(
    () => [
      {
        title: t('onboarding.step0Title'),
        content: t('onboarding.step0Body'),
      },
      {
        title: t('onboarding.step1Title'),
        content: t('onboarding.step1Body'),
        input: {
          label: t('onboarding.step1Label'),
          placeholder: t('onboarding.step1Placeholder'),
        },
      },
      {
        title: t('onboarding.step2Title'),
        content: t('onboarding.step2Body'),
        input: {
          label: t('onboarding.step2Label'),
          placeholder: t('onboarding.step2Placeholder'),
        },
      },
      {
        title: t('onboarding.step3Title'),
        content: t('onboarding.step3Body'),
      },
    ],
    [t],
  );
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({ companyName: '', amount: '' });

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Complete onboarding
      localStorage.setItem('onboardingCompleted', 'true');
      navigate('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    navigate('/dashboard');
  };

  const step = steps[currentStep];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full w-8 ${
                    idx <= currentStep ? 'bg-leaf' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={handleSkip}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              {t('onboarding.skip')}
            </button>
          </div>
          <CardTitle className="text-2xl">{step.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">{step.content}</p>

          {step.input && (
            <div className="space-y-2">
              <Label>{step.input.label}</Label>
              <Input
                placeholder={step.input.placeholder}
                value={currentStep === 1 ? formData.companyName : formData.amount}
                onChange={(e) => {
                  if (currentStep === 1) {
                    setFormData({ ...formData, companyName: e.target.value });
                  } else {
                    setFormData({ ...formData, amount: e.target.value });
                  }
                }}
              />
            </div>
          )}

          {currentStep === steps.length - 1 && (
            <div className="space-y-3 pt-4">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Check size={16} />
                <span>{t('onboarding.done1')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Check size={16} />
                <span>{t('onboarding.done2')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700">
                <Check size={16} />
                <span>{t('onboarding.done3')}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ArrowLeft size={16} className="mr-2" />
              {t('common.back')}
            </Button>
            <Button onClick={handleNext}>
              {currentStep === steps.length - 1 ? t('onboarding.start') : t('common.next')}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
