import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Bot, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

type IdealProfile = {
  id: string;
  name: string;
  description: string;
  importance: number;
  sector?: string;
  companySize?: string;
  constraints?: string;
};

type MissionProfile = {
  missionStatus: string;
  missionStep: number;
  missionSummary: string | null;
  companyBrief: string | null;
  countries: string[];
  regions: string[];
  cities: string[];
  idealProfiles: IdealProfile[];
  detectSignals: string[];
  commercialPriorities: string | null;
  excludeCompanies: string[];
  excludeClients: string[];
  excludeCompetitors: string[];
  excludePartners: string[];
  excludeSectors: string[];
  excludeCountries: string[];
  extractedInsights?: Record<string, string[]> | null;
};

type SignalOpt = { id: string; labelFr: string; labelEn: string };

function uid() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

function listToText(items: string[]): string {
  return (items || []).join('\n');
}

function textToList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const STEPS = 7;

export function MissionWizard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lang = (i18n.resolvedLanguage || i18n.language || 'fr').startsWith('en') ? 'en' : 'fr';

  const { data, isPending } = useQuery({
    queryKey: ['mission'],
    queryFn: () =>
      api.get('/mission').then(
        (r) => r.data as { profile: MissionProfile; signals: SignalOpt[] }
      ),
  });

  const [step, setStep] = useState(1);
  const [brief, setBrief] = useState('');
  const [countries, setCountries] = useState('');
  const [regions, setRegions] = useState('');
  const [cities, setCities] = useState('');
  const [profiles, setProfiles] = useState<IdealProfile[]>([
    { id: uid(), name: '', description: '', importance: 4 },
  ]);
  const [signals, setSignals] = useState<string[]>(['tenders', 'investments', 'hiring', 'new_projects']);
  const [priorities, setPriorities] = useState('');
  const [exClients, setExClients] = useState('');
  const [exCompetitors, setExCompetitors] = useState('');
  const [exPartners, setExPartners] = useState('');
  const [exSectors, setExSectors] = useState('');
  const [exCompanies, setExCompanies] = useState('');
  const [exCountries, setExCountries] = useState('');
  const [summary, setSummary] = useState('');
  const [insights, setInsights] = useState<Record<string, string[]> | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!data?.profile || hydrated) return;
    const p = data.profile;
    setStep(Math.min(7, Math.max(1, p.missionStep || 1)));
    setBrief(p.companyBrief || '');
    setCountries(listToText(p.countries));
    setRegions(listToText(p.regions));
    setCities(listToText(p.cities));
    const ideals = Array.isArray(p.idealProfiles) ? p.idealProfiles : [];
    setProfiles(
      ideals.length
        ? ideals
        : [{ id: uid(), name: '', description: '', importance: 4 }]
    );
    setSignals(p.detectSignals?.length ? p.detectSignals : ['tenders', 'investments', 'hiring']);
    setPriorities(p.commercialPriorities || '');
    setExClients(listToText(p.excludeClients));
    setExCompetitors(listToText(p.excludeCompetitors));
    setExPartners(listToText(p.excludePartners));
    setExSectors(listToText(p.excludeSectors));
    setExCompanies(listToText(p.excludeCompanies));
    setExCountries(listToText(p.excludeCountries));
    setSummary(p.missionSummary || '');
    setInsights(p.extractedInsights || null);
    setHydrated(true);
  }, [data, hydrated]);

  const draftPayload = useCallback(
    (nextStep?: number) => ({
      missionStep: nextStep ?? step,
      companyBrief: brief,
      countries: textToList(countries),
      regions: textToList(regions),
      cities: textToList(cities),
      markets: textToList(countries),
      idealProfiles: profiles.filter((p) => p.name.trim()),
      detectSignals: signals,
      commercialPriorities: priorities,
      excludeClients: textToList(exClients),
      excludeCompetitors: textToList(exCompetitors),
      excludePartners: textToList(exPartners),
      excludeSectors: textToList(exSectors),
      excludeCompanies: textToList(exCompanies),
      excludeCountries: textToList(exCountries),
    }),
    [
      step,
      brief,
      countries,
      regions,
      cities,
      profiles,
      signals,
      priorities,
      exClients,
      exCompetitors,
      exPartners,
      exSectors,
      exCompanies,
      exCountries,
    ]
  );

  const saveDraft = useMutation({
    mutationFn: (payload: ReturnType<typeof draftPayload>) =>
      api.put('/mission/draft', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mission'] });
      void qc.invalidateQueries({ queryKey: ['mission-status'] });
    },
  });

  const extract = useMutation({
    mutationFn: () => api.post('/mission/extract', { brief }).then((r) => r.data),
    onSuccess: (res) => {
      setInsights(res.insights);
      void qc.invalidateQueries({ queryKey: ['mission'] });
    },
  });

  const preview = useMutation({
    mutationFn: async () => {
      await api.put('/mission/draft', draftPayload(7));
      return api.post('/mission/preview-summary').then((r) => r.data);
    },
    onSuccess: (res) => {
      setSummary(res.summary || '');
    },
  });

  const activate = useMutation({
    mutationFn: async () => {
      await api.put('/mission/draft', draftPayload(7));
      return api.post('/mission/activate').then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mission'] });
      void qc.invalidateQueries({ queryKey: ['mission-status'] });
      void qc.invalidateQueries({ queryKey: ['agent-team-overnight'] });
      navigate('/dashboard');
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || t('mission.activateError'));
    },
  });

  const canNext = useMemo(() => {
    if (step === 1) return brief.trim().length >= 20;
    if (step === 2)
      return textToList(countries).length > 0 || textToList(cities).length > 0 || textToList(regions).length > 0;
    if (step === 3) return profiles.some((p) => p.name.trim().length >= 2);
    if (step === 4) return signals.length > 0;
    if (step === 5) return priorities.trim().length >= 8;
    if (step === 6) return true;
    return Boolean(summary.trim());
  }, [step, brief, countries, cities, regions, profiles, signals, priorities, summary]);

  const goNext = async () => {
    if (step === 1) {
      await extract.mutateAsync();
      await saveDraft.mutateAsync(draftPayload(2));
      setStep(2);
      return;
    }
    if (step === 6) {
      await saveDraft.mutateAsync(draftPayload(7));
      await preview.mutateAsync();
      setStep(7);
      return;
    }
    if (step < STEPS) {
      const next = step + 1;
      await saveDraft.mutateAsync(draftPayload(next));
      setStep(next);
    }
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const titles = [
    t('mission.s1Title'),
    t('mission.s2Title'),
    t('mission.s3Title'),
    t('mission.s4Title'),
    t('mission.s5Title'),
    t('mission.s6Title'),
    t('mission.s7Title'),
  ];

  if (isPending || !hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('common.loading')}
      </div>
    );
  }

  const signalOptions = data?.signals || [];
  const busy = extract.isPending || saveDraft.isPending || preview.isPending || activate.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#016AEB]/10 px-3 py-1 text-xs font-medium text-[#016AEB]">
          <Bot size={14} />
          {t('mission.badge')}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {t('mission.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-500">{t('mission.subtitle')}</p>
      </header>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {t('mission.stepOf', { current: step, total: STEPS })}
          </span>
          <span>{Math.round((step / STEPS) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[#016AEB] transition-all duration-500"
            style={{ width: `${(step / STEPS) * 100}%` }}
          />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full',
                i < step ? 'bg-[#016AEB]' : 'bg-slate-200'
              )}
            />
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">{titles[step - 1]}</h2>

        {step === 1 && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-600">{t('mission.s1Body')}</p>
            <Textarea
              rows={8}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={t('mission.s1Placeholder')}
              className="min-h-[180px] text-[15px] leading-relaxed"
            />
            {insights ? (
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {t('mission.extractedHint')}{' '}
                {(insights.keywords || []).slice(0, 8).join(' · ') || '—'}
              </div>
            ) : null}
          </div>
        )}

        {step === 2 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <Label>{t('mission.countries')}</Label>
              <Textarea rows={4} value={countries} onChange={(e) => setCountries(e.target.value)} placeholder={t('mission.listHint')} />
            </div>
            <div className="space-y-1">
              <Label>{t('mission.regions')}</Label>
              <Textarea rows={4} value={regions} onChange={(e) => setRegions(e.target.value)} placeholder={t('mission.listHint')} />
            </div>
            <div className="space-y-1">
              <Label>{t('mission.cities')}</Label>
              <Textarea rows={4} value={cities} onChange={(e) => setCities(e.target.value)} placeholder={t('mission.listHint')} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">{t('mission.s3Body')}</p>
            {profiles.map((p, idx) => (
              <div key={p.id} className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between">
                  <Label>{t('mission.profileName')} #{idx + 1}</Label>
                  {profiles.length > 1 ? (
                    <button
                      type="button"
                      className="text-slate-400 hover:text-rose-600"
                      onClick={() => setProfiles((prev) => prev.filter((x) => x.id !== p.id))}
                    >
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                </div>
                <Input
                  value={p.name}
                  onChange={(e) =>
                    setProfiles((prev) =>
                      prev.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x))
                    )
                  }
                  placeholder={t('mission.profileNamePh')}
                />
                <Textarea
                  rows={2}
                  value={p.description}
                  onChange={(e) =>
                    setProfiles((prev) =>
                      prev.map((x) => (x.id === p.id ? { ...x, description: e.target.value } : x))
                    )
                  }
                  placeholder={t('mission.profileDescPh')}
                />
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>{t('mission.importance')}</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() =>
                            setProfiles((prev) =>
                              prev.map((x) => (x.id === p.id ? { ...x, importance: n } : x))
                            )
                          }
                          className="p-0.5"
                        >
                          <Star
                            size={18}
                            className={n <= p.importance ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t('mission.sector')}</Label>
                    <Input
                      value={p.sector || ''}
                      onChange={(e) =>
                        setProfiles((prev) =>
                          prev.map((x) => (x.id === p.id ? { ...x, sector: e.target.value } : x))
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t('mission.companySize')}</Label>
                    <Input
                      value={p.companySize || ''}
                      onChange={(e) =>
                        setProfiles((prev) =>
                          prev.map((x) => (x.id === p.id ? { ...x, companySize: e.target.value } : x))
                        )
                      }
                      placeholder="PME, ETI…"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{t('mission.constraints')}</Label>
                  <Input
                    value={p.constraints || ''}
                    onChange={(e) =>
                      setProfiles((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, constraints: e.target.value } : x))
                      )
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() =>
                setProfiles((prev) => [
                  ...prev,
                  { id: uid(), name: '', description: '', importance: 3 },
                ])
              }
            >
              <Plus size={14} className="mr-1.5" />
              {t('mission.addProfile')}
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {signalOptions.map((s) => {
              const label = lang === 'en' ? s.labelEn : s.labelFr;
              const on = signals.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setSignals((prev) =>
                      on ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                    )
                  }
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                    on ? 'border-[#016AEB] bg-[#016AEB]/5 font-medium text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {step === 5 && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-slate-600">{t('mission.s5Body')}</p>
            <Textarea
              rows={5}
              value={priorities}
              onChange={(e) => setPriorities(e.target.value)}
              placeholder={t('mission.s5Placeholder')}
            />
          </div>
        )}

        {step === 6 && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                [exClients, setExClients, t('mission.exClients')],
                [exCompetitors, setExCompetitors, t('mission.exCompetitors')],
                [exPartners, setExPartners, t('mission.exPartners')],
                [exSectors, setExSectors, t('mission.exSectors')],
                [exCompanies, setExCompanies, t('mission.exCompanies')],
                [exCountries, setExCountries, t('mission.exCountries')],
              ] as const
            ).map(([value, setter, label]) => (
              <div key={label} className="space-y-1">
                <Label>{label}</Label>
                <Textarea rows={3} value={value} onChange={(e) => setter(e.target.value)} placeholder={t('mission.listHint')} />
              </div>
            ))}
          </div>
        )}

        {step === 7 && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">{t('mission.s7Body')}</p>
            <div className="whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-800 ring-1 ring-slate-100">
              {summary || t('mission.summaryLoading')}
            </div>
            {!summary && preview.isPending ? (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('mission.summaryLoading')}
              </p>
            ) : null}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="outline" className="rounded-xl" disabled={step === 1 || busy} onClick={goBack}>
            <ArrowLeft size={16} className="mr-2" />
            {t('common.back')}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-xl text-slate-500"
              onClick={() => navigate('/dashboard')}
            >
              {t('mission.exploreLater')}
            </Button>
            {step < STEPS ? (
              <Button type="button" className="rounded-xl" disabled={!canNext || busy} onClick={() => void goNext()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('common.next')}
                <ArrowRight size={16} className="ml-2" />
              </Button>
            ) : (
              <Button
                type="button"
                className="rounded-xl bg-[#016AEB] hover:bg-[#0158c7]"
                disabled={!summary || activate.isPending}
                onClick={() => activate.mutate()}
              >
                {activate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('mission.launch')}
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
