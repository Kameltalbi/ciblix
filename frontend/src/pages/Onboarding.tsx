import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

const AGENT_OPTIONS = [
  { slug: 'copilot-ia', label: 'Copilot IA' },
  { slug: 'hunt-ai', label: 'Chasseur IA' },
  { slug: 'gmail-ai', label: 'Gmail IA' },
  { slug: 'scout-ai', label: 'Veilleur IA' },
];

export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [sectorId, setSectorId] = useState('generic');
  const [tier, setTier] = useState('DECOUVERTE');
  const [agents, setAgents] = useState<string[]>(['copilot-ia', 'hunt-ai']);

  const { data: templates } = useQuery({
    queryKey: ['sector-templates'],
    queryFn: () =>
      api.get('/organizations/sector-templates').then(
        (r) => r.data as Array<{ id: string; label: string; sector: string }>
      ),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post('/organizations/onboarding/complete', {
        sectorTemplateId: sectorId,
        tier,
        agentSlugs: agents,
      }),
    onSuccess: () => {
      localStorage.setItem('onboardingCompleted', 'true');
      navigate('/dashboard');
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || 'Erreur onboarding');
    },
  });

  const steps = useMemo(
    () => [
      { title: t('onboarding.step0Title'), content: t('onboarding.step0Body') },
      { title: 'Votre secteur', content: 'Choisissez un modèle pour pré-remplir le lexique et la grille de scoring.' },
      { title: 'Votre palier', content: 'Découverte est gratuit sans carte bancaire. Vous pourrez upgrader plus tard.' },
      { title: 'Vos agents', content: 'Activez les agents dont vous avez besoin. Vous pourrez connecter WhatsApp plus tard.' },
      { title: t('onboarding.step3Title'), content: t('onboarding.step3Body') },
    ],
    [t]
  );

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeMutation.mutate();
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
                  className={`h-1 rounded-full w-8 ${idx <= currentStep ? 'bg-leaf' : 'bg-gray-200'}`}
                />
              ))}
            </div>
            <button onClick={handleSkip} className="text-sm text-gray-500 hover:text-gray-700 underline">
              {t('onboarding.skip')}
            </button>
          </div>
          <CardTitle className="text-2xl">{step.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600">{step.content}</p>

          {currentStep === 1 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {(templates || []).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setSectorId(tpl.id)}
                  className={cn(
                    'rounded-lg border p-3 text-left text-sm transition-colors',
                    sectorId === tpl.id ? 'border-leaf bg-leaf/5' : 'hover:border-gray-300'
                  )}
                >
                  <p className="font-medium">{tpl.label}</p>
                  <p className="text-xs text-muted-foreground">{tpl.sector}</p>
                </button>
              ))}
            </div>
          )}

          {currentStep === 2 && (
            <div className="grid gap-2">
              {['DECOUVERTE', 'CROISSANCE', 'PRO'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  className={cn(
                    'rounded-lg border p-3 text-left text-sm',
                    tier === t ? 'border-leaf bg-leaf/5' : ''
                  )}
                >
                  {t === 'DECOUVERTE' ? 'Découverte (gratuit)' : t === 'CROISSANCE' ? 'Croissance' : 'Pro'}
                </button>
              ))}
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-2">
              {AGENT_OPTIONS.map((a) => (
                <label key={a.slug} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={agents.includes(a.slug)}
                    onChange={(e) => {
                      setAgents((prev) =>
                        e.target.checked ? [...prev, a.slug] : prev.filter((x) => x !== a.slug)
                      );
                    }}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          )}

          {currentStep === steps.length - 1 && (
            <div className="space-y-3 pt-4">
              {[t('onboarding.done1'), t('onboarding.done2'), t('onboarding.done3')].map((txt) => (
                <div key={txt} className="flex items-center gap-2 text-sm text-green-700">
                  <Check size={16} />
                  <span>{txt}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(0, s - 1))} disabled={currentStep === 0}>
              <ArrowLeft size={16} className="mr-2" />
              {t('common.back')}
            </Button>
            <Button onClick={handleNext} disabled={completeMutation.isPending}>
              {currentStep === steps.length - 1 ? t('onboarding.start') : t('common.next')}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
