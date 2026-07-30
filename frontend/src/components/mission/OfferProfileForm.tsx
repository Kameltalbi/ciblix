import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Building2,
  Check,
  GripVertical,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Target,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import type { Organization } from '@/types';

type OfferItem = {
  libelle: string;
  valide_par_tenant?: boolean;
};

type MissionProfile = {
  activity?: string | null;
  companyBrief?: string | null;
  commercialPriorities?: string | null;
  identitySourceUrl?: string | null;
  inverseIcpText?: string | null;
  productsServices?: string[];
  sectors?: string[];
  countries?: string[];
  cities?: string[];
  targetClients?: string[];
  offerSheet?: {
    services_valides?: OfferItem[];
    proposition_de_valeur?: string;
  } | null;
  inverseIcp?: { texte_naturel?: string } | null;
};

export function stripMarkdownNoise(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^---+$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function textToList(value: string, maxItems = 40): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function listToText(items: string[]): string {
  return items.filter(Boolean).join('\n');
}

const LIMITS = {
  activity: 400,
  productLine: 100,
  productsLines: 8,
  priority: 280,
  icp: 350,
  list: 200,
} as const;

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span className={cn('text-[11px] tabular-nums', n >= max * 0.9 ? 'text-amber-600' : 'text-slate-400')}>
      {n}/{max}
    </span>
  );
}

function IconField({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <Label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        {children}
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  subtitle,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F1FE] text-[#016AEB]">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const inputIconClass =
  'h-11 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-none focus-visible:ring-[#016AEB]';

/**
 * Mon offre — design type dashboard (cartes pleine largeur, champs à icônes).
 */
export function OfferProfileForm() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: orgData, isLoading: orgLoading } = useQuery<Organization | Organization[]>({
    queryKey: ['organizations'],
    queryFn: () => api.get('/organizations').then((r) => r.data),
  });
  const org = Array.isArray(orgData) ? orgData[0] : orgData;

  const { data: missionData, isLoading: missionLoading } = useQuery({
    queryKey: ['mission'],
    queryFn: () => api.get('/mission').then((r) => r.data as { profile: MissionProfile }),
  });
  const profile = missionData?.profile;

  const [orgName, setOrgName] = useState('');
  const [website, setWebsite] = useState('');
  const [dirigeant, setDirigeant] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [activity, setActivity] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftService, setDraftService] = useState('');
  const [priority, setPriority] = useState('');
  const [icp, setIcp] = useState('');
  const [sectors, setSectors] = useState('');
  const [countries, setCountries] = useState('');
  const [cities, setCities] = useState('');
  const [targetClients, setTargetClients] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!org || !profile || hydrated) return;

    const fromOffer =
      profile.offerSheet?.services_valides
        ?.filter((s) => s.valide_par_tenant !== false && s.libelle?.trim())
        .map((s) => s.libelle.trim()) || [];
    const productList =
      (profile.productsServices || []).filter(Boolean).length > 0
        ? profile.productsServices || []
        : fromOffer;

    const briefRaw =
      profile.activity?.trim() ||
      profile.offerSheet?.proposition_de_valeur?.trim() ||
      profile.companyBrief?.trim() ||
      '';

    setOrgName(org.name || '');
    setWebsite(profile.identitySourceUrl || '');
    setDirigeant(user?.name || '');
    setEmail(org.email || '');
    setPhone(org.phone || '');
    setAddress(org.address || '');
    setActivity(clamp(stripMarkdownNoise(briefRaw), LIMITS.activity));
    setServices(
      productList.slice(0, LIMITS.productsLines).map((p) => clamp(p, LIMITS.productLine))
    );
    setPriority(clamp(profile.commercialPriorities || '', LIMITS.priority));
    setIcp(
      clamp(
        stripMarkdownNoise(profile.inverseIcpText || profile.inverseIcp?.texte_naturel || ''),
        LIMITS.icp
      )
    );
    setSectors(clamp(listToText(profile.sectors || []), LIMITS.list));
    setCountries(clamp(listToText(profile.countries || []), LIMITS.list));
    setCities(clamp(listToText(profile.cities || []), LIMITS.list));
    setTargetClients(clamp(listToText(profile.targetClients || []), LIMITS.list));
    setHydrated(true);
  }, [org, profile, user, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error('Organisation introuvable');

      const productsList = services.map((s) => s.trim()).filter(Boolean).slice(0, LIMITS.productsLines);
      const cleanActivity = clamp(activity.trim(), LIMITS.activity);

      await api.put(`/organizations/${org.id}`, {
        name: orgName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        tva: org.tva?.trim() || null,
      });

      if (user?.id && dirigeant.trim() && dirigeant.trim() !== user.name) {
        await api.put(`/users/${user.id}`, {
          name: dirigeant.trim(),
          email: user.email,
          role: user.role,
        });
      }

      await api.put('/agent-team/targeting', {
        activity: cleanActivity || null,
        companyBrief: cleanActivity || null,
        commercialPriorities: clamp(priority.trim(), LIMITS.priority) || null,
        identitySourceUrl: website.trim() || null,
        inverseIcpText: clamp(icp.trim(), LIMITS.icp) || null,
        productsServices: productsList,
        sectors: textToList(sectors, 12),
        countries: textToList(countries, 10),
        cities: textToList(cities, 15),
        targetClients: textToList(targetClients, 12),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organizations'] });
      void qc.invalidateQueries({ queryKey: ['mission'] });
      void qc.invalidateQueries({ queryKey: ['agent-team-targeting'] });
    },
  });

  const addService = () => {
    if (services.length >= LIMITS.productsLines) return;
    setServices((prev) => [...prev, '']);
    setEditingIndex(services.length);
    setDraftService('');
  };

  const commitEdit = (index: number) => {
    const value = clamp(draftService.trim(), LIMITS.productLine);
    if (!value) {
      setServices((prev) => prev.filter((_, i) => i !== index));
    } else {
      setServices((prev) => prev.map((s, i) => (i === index ? value : s)));
    }
    setEditingIndex(null);
    setDraftService('');
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setDraftService(services[index] || '');
  };

  const removeService = (index: number) => {
    setServices((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setDraftService('');
    }
  };

  if (orgLoading || missionLoading || !hydrated) {
    return (
      <div className="flex min-h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#016AEB]" />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-white to-[#E8F1FE]/60 px-6 py-7 sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Mon offre &amp; ma cible
              </h1>
              <Sparkles className="h-5 w-5 text-[#016AEB]" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
              Ces infos alimentent le Prospecteur et les messages sur vos fiches contacts.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {save.isSuccess ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                  Enregistré
                </span>
              ) : null}
              {save.isError ? (
                <span className="text-sm text-red-600">
                  {(save.error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                    'Erreur à l’enregistrement'}
                </span>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="rounded-xl" asChild>
                <Link to="/prospection-ia">Prospecteur</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl bg-[#016AEB] px-5 hover:bg-[#0159c4]"
                disabled={save.isPending || !orgName.trim()}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Enregistrer
              </Button>
            </div>
          </div>

          {/* Décor cible */}
          <div
            className="pointer-events-none hidden shrink-0 select-none lg:block"
            aria-hidden
          >
            <div className="relative h-28 w-28">
              <div className="absolute inset-0 rounded-full border-[10px] border-[#016AEB]/15" />
              <div className="absolute inset-4 rounded-full border-[8px] border-[#016AEB]/25" />
              <div className="absolute inset-9 rounded-full bg-[#016AEB]/20" />
              <div className="absolute -right-1 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                <User className="h-4 w-4 text-[#016AEB]" />
              </div>
              <div className="absolute -bottom-1 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                <Building2 className="h-4 w-4 text-[#016AEB]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Entreprise */}
      <SectionCard
        icon={Building2}
        title="Votre entreprise"
        subtitle="Identité utilisée dans les signatures et messages"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-slate-200"
            onClick={() => setShowSignature((v) => !v)}
          >
            Aperçu signature
          </Button>
        }
      >
        {showSignature ? (
          <div className="mb-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">{dirigeant || '—'}</p>
            <p>{orgName || '—'}</p>
            {activity ? <p className="mt-1 line-clamp-2 text-slate-500">{activity}</p> : null}
            <p className="mt-2 text-slate-500">
              {[phone, email, website].filter(Boolean).join(' · ') || 'Coordonnées à compléter'}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <IconField label="Nom de l'entreprise" icon={Building2}>
            <Input
              className={inputIconClass}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              maxLength={120}
            />
          </IconField>
          <IconField label="Site web" icon={Link2}>
            <Input
              className={inputIconClass}
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
              inputMode="url"
              maxLength={200}
            />
          </IconField>
          <IconField label="Dirigeant / contact" icon={User}>
            <Input
              className={inputIconClass}
              value={dirigeant}
              onChange={(e) => setDirigeant(e.target.value)}
              maxLength={80}
            />
          </IconField>
          <IconField label="Adresse e-mail" icon={Mail}>
            <Input
              className={inputIconClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              maxLength={120}
            />
          </IconField>
          <IconField label="Téléphone / WhatsApp" icon={Phone}>
            <Input
              className={inputIconClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+216"
              maxLength={40}
            />
          </IconField>
          <IconField label="Adresse" icon={MapPin}>
            <Input
              className={inputIconClass}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ville, pays"
              maxLength={160}
            />
          </IconField>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Activité
            </Label>
            <CharCount value={activity} max={LIMITS.activity} />
          </div>
          <div className="relative">
            <Pencil className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Textarea
              className="min-h-[88px] rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-none focus-visible:ring-[#016AEB]"
              value={activity}
              onChange={(e) => setActivity(clamp(e.target.value, LIMITS.activity))}
              rows={3}
              maxLength={LIMITS.activity}
              placeholder="2 à 4 phrases sur votre métier…"
            />
          </div>
        </div>
      </SectionCard>

      {/* Produits */}
      <SectionCard
        icon={Target}
        title="Produits & services"
        subtitle="Un produit ou service — utilisé dans les messages IA"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl border-[#016AEB]/30 text-[#016AEB] hover:bg-[#E8F1FE]"
            disabled={services.length >= LIMITS.productsLines}
            onClick={addService}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Ajouter un service
          </Button>
        }
      >
        <ul className="space-y-2">
          {services.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Aucun service — cliquez sur « Ajouter un service »
            </li>
          ) : null}
          {services.map((service, index) => (
            <li
              key={`svc-${index}`}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
              {editingIndex === index ? (
                <Input
                  autoFocus
                  className="h-9 flex-1 rounded-lg border-slate-200 text-sm shadow-none"
                  value={draftService}
                  maxLength={LIMITS.productLine}
                  onChange={(e) => setDraftService(clamp(e.target.value, LIMITS.productLine))}
                  onBlur={() => commitEdit(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitEdit(index);
                    }
                    if (e.key === 'Escape') {
                      setEditingIndex(null);
                      setDraftService('');
                    }
                  }}
                  placeholder="Nom du service"
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left text-sm text-slate-800"
                  onClick={() => startEdit(index)}
                >
                  {service || <span className="text-slate-400">Sans titre</span>}
                </button>
              )}
              <button
                type="button"
                className="rounded-lg p-1.5 text-[#016AEB] hover:bg-[#E8F1FE]"
                aria-label="Modifier"
                onClick={() => startEdit(index)}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                aria-label="Supprimer"
                onClick={() => removeService(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Max {LIMITS.productsLines} lignes · {services.length}/{LIMITS.productsLines}
        </p>
      </SectionCard>

      {/* Priorité + ICP */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard
          icon={Sparkles}
          title="Priorité du moment"
          subtitle="Formation, promo, événement à pousser dans les messages"
        >
          <div className="mb-1.5 flex justify-end">
            <CharCount value={priority} max={LIMITS.priority} />
          </div>
          <Textarea
            className="min-h-[120px] rounded-xl border-slate-200 text-sm shadow-none focus-visible:ring-[#016AEB]"
            value={priority}
            onChange={(e) => setPriority(clamp(e.target.value, LIMITS.priority))}
            rows={4}
            maxLength={LIMITS.priority}
            placeholder="Formation 18-19 sept 2026 Monastir — places limitées"
          />
        </SectionCard>

        <SectionCard
          icon={Users}
          title="Votre cible (ICP)"
          subtitle="Qui vous cherchez — secteurs, profils, zones"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Description
            </Label>
            <CharCount value={icp} max={LIMITS.icp} />
          </div>
          <Textarea
            className="mb-4 min-h-[72px] rounded-xl border-slate-200 text-sm shadow-none focus-visible:ring-[#016AEB]"
            value={icp}
            onChange={(e) => setIcp(clamp(e.target.value, LIMITS.icp))}
            rows={2}
            maxLength={LIMITS.icp}
            placeholder="PME industrielles, responsable RSE / QHSE…"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ['Secteurs', sectors, setSectors],
                ['Profils', targetClients, setTargetClients],
                ['Pays', countries, setCountries],
                ['Villes', cities, setCities],
              ] as const
            ).map(([label, value, setter]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {label}
                  </Label>
                  <CharCount value={value} max={LIMITS.list} />
                </div>
                <Textarea
                  className="min-h-[72px] rounded-xl border-slate-200 text-sm shadow-none focus-visible:ring-[#016AEB]"
                  value={value}
                  onChange={(e) => setter(clamp(e.target.value, LIMITS.list))}
                  rows={2}
                  maxLength={LIMITS.list}
                  placeholder="1 par ligne"
                />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
