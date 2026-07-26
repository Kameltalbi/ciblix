import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

type SourceType = 'website' | 'facebook' | 'linkedin' | 'pdf' | 'name_brief';

type OfferItem = {
  libelle: string;
  description_courte: string;
  cible_typique: string;
  valide_par_tenant: boolean;
  source_extraction: string | null;
};

type InverseIcp = {
  secteurs_cibles: string[];
  taille_min: number | null;
  taille_max: number | null;
  zones: string[];
  type_acheteur: string;
  confiance: number;
  texte_naturel: string;
  fallback_from_offer?: boolean;
};

type MissionProfile = {
  missionStatus: string;
  missionStep: number;
  missionSummary: string | null;
  identitySourceType?: string | null;
  identitySourceUrl?: string | null;
  referenceClients?: string[];
  geoZonePresets?: string[];
  inverseIcpText?: string | null;
  inverseIcp?: InverseIcp | null;
  offerSheet?: {
    services_valides: OfferItem[];
    proposition_de_valeur: string;
  } | null;
  offerValidatedAt?: string | null;
  companyBrief?: string | null;
};

const SOURCE_OPTIONS: Array<{ id: SourceType; label: string }> = [
  { id: 'website', label: 'Site web' },
  { id: 'facebook', label: 'Page Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'name_brief', label: 'Nom + activité' },
];

/**
 * Onboarding V2 — max 3 champs saisis, reste pré-rempli à valider.
 * Étapes : 1 saisie → 2 extraction → 3 ICP → 4 offre → 5 lancer.
 */
export function MissionWizard() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAr = (i18n.resolvedLanguage || '').startsWith('ar');

  const { data, isPending } = useQuery({
    queryKey: ['mission'],
    queryFn: () =>
      api.get('/mission').then(
        (r) =>
          r.data as {
            profile: MissionProfile;
            geoZonePresets: string[];
            offerValidated: boolean;
          }
      ),
  });

  const [step, setStep] = useState(1);
  const [sourceType, setSourceType] = useState<SourceType>('website');
  const [sourceUrl, setSourceUrl] = useState('');
  const [freeText, setFreeText] = useState('');
  const [clients, setClients] = useState<string[]>(['', '', '']);
  const [geo, setGeo] = useState<string[]>(['Tunisie']);
  const [customGeo, setCustomGeo] = useState('');
  const [progress, setProgress] = useState<string[]>([]);
  const [icp, setIcp] = useState<InverseIcp | null>(null);
  const [offerItems, setOfferItems] = useState<OfferItem[]>([]);
  const [valueProp, setValueProp] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const presets = data?.geoZonePresets || [
    'Tunisie',
    'Maghreb',
    'Afrique de l’Ouest',
    'Afrique Centrale',
    'Europe',
    'Personnalisé',
  ];

  useEffect(() => {
    if (!data?.profile || hydrated) return;
    const p = data.profile;
    const s = Math.min(5, Math.max(1, p.missionStep || 1));
    setStep(p.missionStatus === 'ACTIVE' ? 5 : s === 2 ? 1 : s);
    if (p.identitySourceType) setSourceType(p.identitySourceType as SourceType);
    if (p.identitySourceUrl) setSourceUrl(p.identitySourceUrl);
    if (p.companyBrief && p.identitySourceType === 'name_brief') setFreeText(p.companyBrief);
    if (p.referenceClients?.length) {
      setClients([...p.referenceClients, '', '', ''].slice(0, Math.max(3, p.referenceClients.length)));
    }
    if (p.geoZonePresets?.length) setGeo(p.geoZonePresets);
    if (p.inverseIcp) setIcp(p.inverseIcp);
    if (p.offerSheet?.services_valides?.length) {
      setOfferItems(p.offerSheet.services_valides);
      setValueProp(p.offerSheet.proposition_de_valeur || '');
    }
    setHydrated(true);
  }, [data, hydrated]);

  const bootstrap = useMutation({
    mutationFn: async () => {
      setProgress(['Préparation…']);
      setStep(2);
      const referenceClients = clients.map((c) => c.trim()).filter(Boolean);
      const res = await api.post('/mission/onboarding/bootstrap', {
        sourceType,
        sourceUrl: sourceUrl.trim() || null,
        freeText: freeText.trim() || null,
        referenceClients,
        geoZonePresets: geo,
        customGeo: customGeo
          .split(/[,;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      return res.data as {
        progress: string[];
        icp: InverseIcp;
        offerDraft: { services_valides: OfferItem[]; proposition_de_valeur: string };
        profile: MissionProfile;
      };
    },
    onSuccess: (r) => {
      setProgress(r.progress || ['Terminé']);
      setIcp(r.icp);
      setOfferItems(r.offerDraft?.services_valides || []);
      setValueProp(r.offerDraft?.proposition_de_valeur || '');
      setStep(3);
      void qc.invalidateQueries({ queryKey: ['mission'] });
    },
    onError: () => setStep(1),
  });

  const confirmIcp = useMutation({
    mutationFn: async (accepted: boolean) => {
      const res = await api.post('/mission/onboarding/confirm-icp', {
        accepted,
        secteurs_cibles: icp?.secteurs_cibles,
        zones: icp?.zones,
        taille_min: icp?.taille_min,
        taille_max: icp?.taille_max,
        type_acheteur: icp?.type_acheteur,
        texte_naturel: icp?.texte_naturel,
      });
      return res.data;
    },
    onSuccess: () => {
      setStep(4);
      void qc.invalidateQueries({ queryKey: ['mission'] });
    },
  });

  const validateOffer = useMutation({
    mutationFn: async () => {
      const res = await api.post('/mission/onboarding/validate-offer', {
        services_valides: offerItems,
        proposition_de_valeur: valueProp,
      });
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mission'] }),
  });

  const activate = useMutation({
    mutationFn: async () => {
      const res = await api.post('/mission/activate');
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mission'] });
      void qc.invalidateQueries({ queryKey: ['mission-status'] });
      navigate('/prospection-ia');
    },
  });

  const canSubmitStep1 = useMemo(() => {
    const hasClients = clients.filter((c) => c.trim()).length >= 1;
    const hasGeo = geo.length > 0;
    const hasIdentity =
      sourceType === 'name_brief'
        ? freeText.trim().length >= 12
        : Boolean(sourceUrl.trim()) || freeText.trim().length >= 12;
    return hasClients && hasGeo && hasIdentity;
  }, [clients, geo, sourceType, sourceUrl, freeText]);

  if (isPending || !hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#016AEB]" />
      </div>
    );
  }

  if (data?.profile.missionStatus === 'ACTIVE' && step >= 5) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" dir={isAr ? 'rtl' : 'ltr'}>
        <h1 className="mb-3 font-serif text-2xl font-bold">Mission active</h1>
        <p className="mb-6 text-muted-foreground">
          Votre équipe cherche déjà des entreprises. Vous pouvez ajuster l’offre à tout moment.
        </p>
        <Button onClick={() => navigate('/prospection-ia')}>Voir les entreprises</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-xl px-4 py-8 sm:py-12" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#016AEB]">
          Démarrage · {step}/5
        </p>
        <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          Première liste en moins de 5 minutes
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          On déduit le maximum. Vous ne validez que ce qui compte.
        </p>
      </div>

      <div className="mb-6 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              n <= step ? 'bg-[#016AEB]' : 'bg-neutral-200'
            )}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <section className="space-y-3">
            <Label className="text-base font-semibold">1. Votre entreprise</Label>
            <p className="text-xs text-muted-foreground">
              Pour extraire ce que vous vendez — pas pour remplir un formulaire.
            </p>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSourceType(o.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium',
                    sourceType === o.id
                      ? 'border-[#016AEB] bg-[#016AEB]/10 text-[#016AEB]'
                      : 'border-neutral-200 text-neutral-600'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {sourceType !== 'name_brief' ? (
              <Input
                placeholder="https://…"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                inputMode="url"
                autoComplete="url"
              />
            ) : null}
            <Textarea
              placeholder={
                sourceType === 'name_brief'
                  ? 'Nom de l’entreprise + une phrase sur votre activité'
                  : 'Optionnel : précisez en une phrase si besoin'
              }
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={3}
            />
          </section>

          <section className="space-y-3">
            <Label className="text-base font-semibold">2. 3 à 5 clients actuels</Label>
            <p className="text-xs text-muted-foreground">
              Vos clients actuels nous servent à trouver leurs jumeaux. Juste des noms.
            </p>
            {clients.map((c, i) => (
              <Input
                key={i}
                placeholder={`Client ${i + 1}`}
                value={c}
                onChange={(e) => {
                  const next = [...clients];
                  next[i] = e.target.value;
                  setClients(next);
                }}
              />
            ))}
            {clients.length < 5 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#016AEB]"
                onClick={() => setClients([...clients, ''])}
              >
                <Plus size={14} /> Ajouter un client
              </button>
            ) : null}
          </section>

          <section className="space-y-3">
            <Label className="text-base font-semibold">3. Zone géographique</Label>
            <p className="text-xs text-muted-foreground">Où chercher vos prochains clients.</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((z) => {
                const on = geo.includes(z);
                return (
                  <button
                    key={z}
                    type="button"
                    onClick={() =>
                      setGeo((g) => (on ? g.filter((x) => x !== z) : [...g, z]))
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium',
                      on
                        ? 'border-[#016AEB] bg-[#016AEB]/10 text-[#016AEB]'
                        : 'border-neutral-200 text-neutral-600'
                    )}
                  >
                    {z}
                  </button>
                );
              })}
            </div>
            {geo.includes('Personnalisé') ? (
              <Input
                placeholder="Villes ou pays (séparés par des virgules)"
                value={customGeo}
                onChange={(e) => setCustomGeo(e.target.value)}
              />
            ) : null}
          </section>

          <Button
            className="w-full"
            size="lg"
            disabled={!canSubmitStep1 || bootstrap.isPending}
            onClick={() => bootstrap.mutate()}
          >
            {bootstrap.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Analyser et proposer mon profil
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 py-8 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-[#016AEB]" />
          <p className="font-medium">Analyse en cours…</p>
          <ul className="space-y-2 text-left text-sm text-muted-foreground">
            {(progress.length ? progress : ['Connexion…']).map((line) => (
              <li key={line} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#016AEB]" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 3 && icp && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#BED6F6]/70 bg-[#f7faff] p-5">
            <p className="text-base leading-relaxed text-neutral-800">{icp.texte_naturel}</p>
            {icp.fallback_from_offer ? (
              <p className="mt-3 text-xs text-amber-700">
                Profil de départ à affiner avec vos premiers retours (peu de clients identifiés).
              </p>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                Confiance {(icp.confiance * 100).toFixed(0)} % — déduit de vos clients cités.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-neutral-200 p-4">
            <p className="text-xs font-semibold uppercase text-neutral-500">Ajuster (pré-rempli)</p>
            <Label>Secteurs</Label>
            <Input
              value={(icp.secteurs_cibles || []).join(', ')}
              onChange={(e) =>
                setIcp({
                  ...icp,
                  secteurs_cibles: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <Label>Zones</Label>
            <Input
              value={(icp.zones || []).join(', ')}
              onChange={(e) =>
                setIcp({
                  ...icp,
                  zones: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Taille min</Label>
                <Input
                  type="number"
                  value={icp.taille_min ?? ''}
                  onChange={(e) =>
                    setIcp({
                      ...icp,
                      taille_min: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <Label>Taille max</Label>
                <Input
                  type="number"
                  value={icp.taille_max ?? ''}
                  onChange={(e) =>
                    setIcp({
                      ...icp,
                      taille_max: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              size="lg"
              disabled={confirmIcp.isPending}
              onClick={() => confirmIcp.mutate(true)}
            >
              Oui, cherchez ça
            </Button>
            <Button
              className="flex-1"
              size="lg"
              variant="outline"
              disabled={confirmIcp.isPending}
              onClick={() => confirmIcp.mutate(false)}
            >
              Ajuster puis continuer
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Validez ce que vous vendez</h2>
            <p className="text-sm text-muted-foreground">
              Seule étape obligatoire avant les messages. La recherche d’entreprises peut démarrer
              ensuite — la rédaction reste verrouillée tant que cette liste n’est pas validée.
            </p>
          </div>
          <div>
            <Label>Proposition de valeur</Label>
            <Textarea value={valueProp} onChange={(e) => setValueProp(e.target.value)} rows={2} />
          </div>
          <ul className="space-y-3">
            {offerItems.map((item, idx) => (
              <li
                key={`${item.libelle}-${idx}`}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={item.valide_par_tenant}
                  onChange={(e) => {
                    const next = [...offerItems];
                    next[idx] = { ...item, valide_par_tenant: e.target.checked };
                    setOfferItems(next);
                  }}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <Input
                    value={item.libelle}
                    onChange={(e) => {
                      const next = [...offerItems];
                      next[idx] = { ...item, libelle: e.target.value };
                      setOfferItems(next);
                    }}
                  />
                  {item.source_extraction ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      Source : {item.source_extraction}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="text-neutral-400 hover:text-red-500"
                  onClick={() => setOfferItems(offerItems.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setOfferItems([
                ...offerItems,
                {
                  libelle: '',
                  description_courte: '',
                  cible_typique: '',
                  valide_par_tenant: true,
                  source_extraction: null,
                },
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" /> Ajouter un service
          </Button>
          <Button
            className="w-full"
            size="lg"
            disabled={
              validateOffer.isPending ||
              !offerItems.some((s) => s.valide_par_tenant && s.libelle.trim())
            }
            onClick={() => validateOffer.mutate()}
          >
            {validateOffer.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Valider la fiche offre
          </Button>
          {(data?.offerValidated || validateOffer.isSuccess) && (
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              disabled={activate.isPending}
              onClick={() => activate.mutate()}
            >
              {activate.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Lancer la recherche d’entreprises
            </Button>
          )}
          <button
            type="button"
            className="w-full text-center text-xs text-muted-foreground underline"
            disabled={activate.isPending}
            onClick={() => activate.mutate()}
          >
            Continuer sans valider l’offre (recherche OK, messages verrouillés)
          </button>
        </div>
      )}
    </div>
  );
}

export default MissionWizard;
