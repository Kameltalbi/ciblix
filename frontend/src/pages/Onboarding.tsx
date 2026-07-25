import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Check, ArrowRight, ArrowLeft, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type MissionForm = {
  activity: string;
  productsServices: string;
  targetClients: string;
  sectors: string;
  countries: string;
  cities: string;
  keywords: string;
  excludeCompanies: string;
  tenders: boolean;
  news: boolean;
  companies: boolean;
  tier: 'DECOUVERTE' | 'CROISSANCE' | 'PRO';
};

const emptyForm: MissionForm = {
  activity: '',
  productsServices: '',
  targetClients: '',
  sectors: '',
  countries: '',
  cities: '',
  keywords: '',
  excludeCompanies: '',
  tenders: true,
  news: true,
  companies: true,
  tier: 'DECOUVERTE',
};

function toList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MissionForm>(emptyForm);

  const completeMutation = useMutation({
    mutationFn: () =>
      api.post('/organizations/onboarding/complete', {
        sectorTemplateId: 'generic',
        tier: form.tier,
        agentSlugs: ['hunt-ai', 'copilot-ia', 'scout-ai', 'analyste-ai'],
        targeting: {
          activity: form.activity.trim() || null,
          productsServices: toList(form.productsServices),
          targetClients: toList(form.targetClients),
          sectors: toList(form.sectors),
          countries: toList(form.countries),
          cities: toList(form.cities),
          markets: toList(form.countries),
          keywords: toList(form.keywords),
          excludeCompanies: toList(form.excludeCompanies),
          opportunityTypes: {
            tenders: form.tenders,
            news: form.news,
            companies: form.companies,
          },
          orchestratorEnabled: true,
          orchestratorIntervalH: 1,
        },
        startTeam: true,
      }),
    onSuccess: () => {
      localStorage.setItem('onboardingCompleted', 'true');
      localStorage.removeItem('ciblix-last-dashboard-visit');
      navigate('/dashboard');
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || t('onboarding.error'));
    },
  });

  const steps = useMemo(
    () => [
      { title: t('onboarding.step0Title'), body: t('onboarding.step0Body') },
      { title: t('onboarding.missionSellTitle'), body: t('onboarding.missionSellBody') },
      { title: t('onboarding.missionWhoTitle'), body: t('onboarding.missionWhoBody') },
      { title: t('onboarding.missionWhereTitle'), body: t('onboarding.missionWhereBody') },
      { title: t('onboarding.missionSignalsTitle'), body: t('onboarding.missionSignalsBody') },
      { title: t('onboarding.step3Title'), body: t('onboarding.step3Body') },
    ],
    [t]
  );

  const canNext = () => {
    if (step === 1) return form.activity.trim().length >= 3 || toList(form.productsServices).length > 0;
    if (step === 2) return toList(form.targetClients).length > 0 || toList(form.sectors).length > 0;
    if (step === 3) return toList(form.countries).length > 0 || toList(form.cities).length > 0;
    if (step === 4) return toList(form.keywords).length > 0 || form.tenders || form.news || form.companies;
    return true;
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    completeMutation.mutate();
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    navigate('/dashboard');
  };

  const current = steps[step];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#F0F7FF] to-white p-4">
      <Card className="w-full max-w-2xl border-slate-200/80 shadow-[0_8px_32px_rgba(15,23,42,0.06)]">
        <CardHeader>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-2">
              {steps.map((_, idx) => (
                <div
                  key={idx}
                  className={cn('h-1 w-8 rounded-full', idx <= step ? 'bg-[#016AEB]' : 'bg-slate-200')}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-slate-500 underline hover:text-slate-700"
            >
              {t('onboarding.skip')}
            </button>
          </div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#016AEB]/10 px-3 py-1 text-xs font-medium text-[#016AEB]">
            <Bot size={14} />
            {t('onboarding.teamBadge')}
          </div>
          <CardTitle className="text-2xl tracking-tight">{current.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 leading-relaxed">{current.body}</p>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('onboarding.fieldActivity')}</Label>
                <Textarea
                  rows={3}
                  value={form.activity}
                  onChange={(e) => setForm({ ...form, activity: e.target.value })}
                  placeholder={t('onboarding.phActivity')}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('onboarding.fieldProducts')}</Label>
                <Textarea
                  rows={2}
                  value={form.productsServices}
                  onChange={(e) => setForm({ ...form, productsServices: e.target.value })}
                  placeholder={t('onboarding.phList')}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('onboarding.fieldTargetClients')}</Label>
                <Textarea
                  rows={2}
                  value={form.targetClients}
                  onChange={(e) => setForm({ ...form, targetClients: e.target.value })}
                  placeholder={t('onboarding.phTargetClients')}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('onboarding.fieldSectors')}</Label>
                <Textarea
                  rows={2}
                  value={form.sectors}
                  onChange={(e) => setForm({ ...form, sectors: e.target.value })}
                  placeholder={t('onboarding.phList')}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('onboarding.fieldCountries')}</Label>
                <Input
                  value={form.countries}
                  onChange={(e) => setForm({ ...form, countries: e.target.value })}
                  placeholder={t('onboarding.phCountries')}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('onboarding.fieldCities')}</Label>
                <Input
                  value={form.cities}
                  onChange={(e) => setForm({ ...form, cities: e.target.value })}
                  placeholder={t('onboarding.phCities')}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <Label>{t('onboarding.fieldKeywords')}</Label>
                <Textarea
                  rows={2}
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder={t('onboarding.phKeywords')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('onboarding.fieldOppTypes')}</Label>
                {(
                  [
                    ['tenders', t('onboarding.oppTenders')],
                    ['news', t('onboarding.oppNews')],
                    ['companies', t('onboarding.oppCompanies')],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <Label>{t('onboarding.fieldExclude')}</Label>
                <Textarea
                  rows={2}
                  value={form.excludeCompanies}
                  onChange={(e) => setForm({ ...form, excludeCompanies: e.target.value })}
                  placeholder={t('onboarding.phExclude')}
                />
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid gap-2">
                {(
                  [
                    { id: 'DECOUVERTE' as const, label: 'Essentiel', detail: '65 TND/mois · 1 user · 100 actions' },
                    { id: 'CROISSANCE' as const, label: 'Croissance', detail: '89 TND/mois · 3 users · 300 actions' },
                    { id: 'PRO' as const, label: 'Pro', detail: '129 TND/mois · 10 users · 1 000 actions' },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm({ ...form, tier: opt.id })}
                    className={cn(
                      'rounded-xl border p-3 text-left text-sm transition-colors',
                      form.tier === opt.id ? 'border-[#016AEB] bg-[#016AEB]/5' : 'hover:border-slate-300'
                    )}
                  >
                    <p className="font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.detail}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-2 rounded-xl bg-emerald-50/80 px-4 py-3">
                {[t('onboarding.done1'), t('onboarding.done2'), t('onboarding.done3')].map((txt) => (
                  <div key={txt} className="flex items-center gap-2 text-sm text-emerald-800">
                    <Check size={16} />
                    <span>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft size={16} className="mr-2" />
              {t('common.back')}
            </Button>
            <Button onClick={handleNext} disabled={completeMutation.isPending || !canNext()}>
              {step === steps.length - 1 ? t('onboarding.start') : t('common.next')}
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
