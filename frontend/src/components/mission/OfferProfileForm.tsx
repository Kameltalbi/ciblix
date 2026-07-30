import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2, Loader2, Target, Package, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
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
  keywords?: string[];
  offerSheet?: {
    services_valides?: OfferItem[];
    proposition_de_valeur?: string;
  } | null;
  inverseIcp?: { texte_naturel?: string } | null;
};

/** Enlève le markdown brut (souvent collé depuis une extraction site). */
export function stripMarkdownNoise(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^---+$/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function listToText(items: string[]): string {
  return items.filter(Boolean).join('\n');
}

function textToList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function Section({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Building2;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#016AEB]/10 text-[#016AEB]">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Formulaire structuré « Mon offre » — remplace le pavé markdown illisible.
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
    queryFn: () =>
      api.get('/mission').then((r) => r.data as { profile: MissionProfile }),
  });
  const profile = missionData?.profile;

  const [orgName, setOrgName] = useState('');
  const [website, setWebsite] = useState('');
  const [dirigeant, setDirigeant] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [activity, setActivity] = useState('');
  const [products, setProducts] = useState('');
  const [priority, setPriority] = useState('');
  const [icp, setIcp] = useState('');
  const [sectors, setSectors] = useState('');
  const [countries, setCountries] = useState('');
  const [cities, setCities] = useState('');
  const [targetClients, setTargetClients] = useState('');
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
    setActivity(stripMarkdownNoise(briefRaw).slice(0, 2000));
    setProducts(listToText(productList));
    setPriority(profile.commercialPriorities || '');
    setIcp(
      stripMarkdownNoise(
        profile.inverseIcpText || profile.inverseIcp?.texte_naturel || ''
      )
    );
    setSectors(listToText(profile.sectors || []));
    setCountries(listToText(profile.countries || []));
    setCities(listToText(profile.cities || []));
    setTargetClients(listToText(profile.targetClients || []));
    setHydrated(true);
  }, [org, profile, user, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error('Organisation introuvable');

      const productsList = textToList(products);
      const cleanActivity = activity.trim();

      await api.put(`/organizations/${org.id}`, {
        name: orgName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
        tva: org.tva,
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
        commercialPriorities: priority.trim() || null,
        identitySourceUrl: website.trim() || null,
        inverseIcpText: icp.trim() || null,
        productsServices: productsList,
        sectors: textToList(sectors),
        countries: textToList(countries),
        cities: textToList(cities),
        targetClients: textToList(targetClients),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['organizations'] });
      void qc.invalidateQueries({ queryKey: ['mission'] });
      void qc.invalidateQueries({ queryKey: ['agent-team-targeting'] });
    },
  });

  if (orgLoading || missionLoading || !hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-[#016AEB]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
      <header>
        <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          Mon offre &amp; ma cible
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Renseignez votre entreprise clairement. Ces infos alimentent le Prospecteur et les
          messages sur chaque fiche contact.
        </p>
      </header>

      <Section
        icon={Building2}
        title="Votre entreprise"
        hint="Identité visible dans les messages et la signature"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nom de l’entreprise">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="CarboScan" />
          </Field>
          <Field label="Site web">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.carboscan.io"
              inputMode="url"
            />
          </Field>
          <Field label="Dirigeant / contact">
            <Input
              value={dirigeant}
              onChange={(e) => setDirigeant(e.target.value)}
              placeholder="Prénom Nom"
            />
          </Field>
          <Field label="Adresse e-mail">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@entreprise.com"
              type="email"
            />
          </Field>
          <Field label="Téléphone / WhatsApp">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+216 …"
            />
          </Field>
          <Field label="Adresse">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ville, pays"
            />
          </Field>
        </div>
        <Field label="Activité (en 2–4 phrases, sans markdown)">
          <Textarea
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            rows={4}
            placeholder="Ex. Conseil en stratégie climat et bilans carbone pour les entreprises en Tunisie…"
          />
        </Field>
      </Section>

      <Section
        icon={Package}
        title="Produits & services"
        hint="Un produit ou service par ligne — utilisé dans les messages IA"
      >
        <Textarea
          value={products}
          onChange={(e) => setProducts(e.target.value)}
          rows={5}
          placeholder={
            'Formation Bilan Carbone® — 18-19 sept 2026 — Monastir\nPlateforme CarboScan\nAccompagnement décarbonation'
          }
        />
      </Section>

      <Section
        icon={Megaphone}
        title="Priorité du moment"
        hint="Formation, promo ou offre à pousser maintenant"
      >
        <Textarea
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          rows={3}
          placeholder="Formation inter-entreprises Bilan Carbone® les 18 & 19 septembre 2026 à Monastir — places limitées. Inscription : …"
        />
      </Section>

      <Section
        icon={Target}
        title="Cible (ICP)"
        hint="Qui vous cherchez — secteurs, taille, zones"
      >
        <Field label="Description de la cible">
          <Textarea
            value={icp}
            onChange={(e) => setIcp(e.target.value)}
            rows={3}
            placeholder="Ex. PME industrielles et exportatrices, 50–200 salariés, avec un responsable RSE / QHSE…"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Secteurs (un par ligne)">
            <Textarea
              value={sectors}
              onChange={(e) => setSectors(e.target.value)}
              rows={3}
              placeholder={'Industrie\nAgroalimentaire\nTextile'}
            />
          </Field>
          <Field label="Types de clients (un par ligne)">
            <Textarea
              value={targetClients}
              onChange={(e) => setTargetClients(e.target.value)}
              rows={3}
              placeholder={'Responsable RSE\nQHSE\nDirigeant PME'}
            />
          </Field>
          <Field label="Pays">
            <Textarea
              value={countries}
              onChange={(e) => setCountries(e.target.value)}
              rows={2}
              placeholder="Tunisie"
            />
          </Field>
          <Field label="Villes / zones">
            <Textarea
              value={cities}
              onChange={(e) => setCities(e.target.value)}
              rows={2}
              placeholder={'Monastir\nSousse\nTunis'}
            />
          </Field>
        </div>
      </Section>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="bg-[#016AEB] hover:bg-[#0159c4]"
            disabled={save.isPending || !orgName.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/prospection-ia">Chercher des entreprises</Link>
          </Button>
        </div>
        {save.isSuccess ? (
          <p className="text-sm font-medium text-emerald-600">Enregistré — les messages utiliseront ces infos.</p>
        ) : null}
        {save.isError ? (
          <p className="text-sm text-destructive">
            {(save.error as { response?: { data?: { error?: string } }; message?: string })?.response
              ?.data?.error ||
              (save.error as Error)?.message ||
              'Erreur'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
