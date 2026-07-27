import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Flame,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  Mic,
  MoreHorizontal,
  Phone,
  Pencil,
  RefreshCw,
  Sparkles,
  Star,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  buildPourquoiMaintenant,
  buildResurgenceBanner,
  freshnessLabel,
  initialsFromName,
  normalizeObjectionTags,
  OBJECTION_LABELS,
} from './ficheDisplay';
import { mailtoLink, mapsLink, siteHref, waLink } from './ficheLinks';
import type { FicheEntrepriseProps } from './FicheEntreprise';

export type FicheEntrepriseDashboardProps = FicheEntrepriseProps & {
  contactName?: string | null;
};

type TabId = 'apercu' | 'decideurs' | 'actualites' | 'historique' | 'fichiers' | 'notes';

type DecideurRow = {
  id: string;
  nom: string;
  fonction?: string | null;
  tag?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  linkedin?: string | null;
};

const TABS: { id: TabId; label: string; count?: number }[] = [
  { id: 'apercu', label: 'Aperçu' },
  { id: 'decideurs', label: 'Décideurs' },
  { id: 'actualites', label: 'Actualités' },
  { id: 'historique', label: 'Historique' },
  { id: 'fichiers', label: 'Fichiers' },
  { id: 'notes', label: 'Notes' },
];

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatVerified(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'récemment';
  const days = Math.max(0, Math.round((Date.now() - d.getTime()) / (24 * 3600_000)));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} jours`;
}

function canalLabel(c: string): string {
  const m: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    appel: 'Appel',
    note: 'Note',
    vocal: 'Vocal',
    linkedin: 'LinkedIn',
  };
  return m[c] || c;
}

function scoreStars(score: number): number {
  return Math.round((score / 20) * 10) / 10;
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Prospect très pertinent';
  if (score >= 70) return 'Prospect pertinent';
  if (score >= 50) return 'Prospect à qualifier';
  return 'Prospect faible';
}

function deriveDimensions(score: number) {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  return [
    { label: 'Adéquation ICP', value: clamp(score + 1) },
    { label: 'Engagement digital', value: clamp(score - 4) },
    { label: 'Potentiel commercial', value: clamp(score - 2) },
    { label: 'Urgence / Timing', value: clamp(score + 3) },
    { label: 'Accessibilité', value: clamp(score - 14) },
  ];
}

function splitAngles(text?: string | null): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/[.;]\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8)
    .slice(0, 4);
}

function buildDecideurs(
  decideur: FicheEntrepriseProps['decideur'],
  contactName?: string | null
): DecideurRow[] {
  const rows: DecideurRow[] = [];
  if (decideur?.nom?.trim()) {
    rows.push({
      id: 'decideur',
      nom: decideur.nom.trim(),
      fonction: decideur.fonction,
      tag: 'Décideur',
      phone: decideur.phone,
      email: decideur.email,
      whatsapp: decideur.whatsapp || decideur.phone,
    });
  }
  const cn = contactName?.trim();
  if (cn && !rows.some((r) => r.nom.toLowerCase() === cn.toLowerCase())) {
    rows.push({
      id: 'contact',
      nom: cn,
      fonction: decideur?.fonction ? 'Contact principal' : null,
      tag: rows.length ? 'Contact' : 'Décideur',
      phone: decideur?.phone,
      email: decideur?.email,
      whatsapp: decideur?.whatsapp || decideur?.phone,
    });
  }
  if (!rows.length && (decideur?.phone || decideur?.email)) {
    rows.push({
      id: 'contact-fallback',
      nom: contactName?.trim() || 'Contact non identifié',
      phone: decideur?.phone,
      email: decideur?.email,
      whatsapp: decideur?.whatsapp || decideur?.phone,
    });
  }
  return rows;
}

export function FicheEntrepriseDashboard(props: FicheEntrepriseDashboardProps) {
  const {
    contactId,
    nomLegal,
    contactName,
    secteur,
    ville,
    decideur,
    besoinDetecte,
    raisonDuScore,
    prochaineAction,
    dateRelance,
    messageBrouillon,
    historique,
    objections,
    signaux,
    referentiel,
    scoreFit,
    ficheEtat,
    resurgence,
    onReprendre,
    onDicter,
    onVoirMessage,
    onOutbound,
    messagePending,
    messageError,
    dictationPrompt,
    onDismissDictationPrompt,
    className,
  } = props;

  const [tab, setTab] = useState<TabId>('apercu');
  const [copied, setCopied] = useState(false);
  const messagePanelRef = useRef<HTMLDivElement>(null);

  const score = typeof scoreFit === 'number' ? Math.round(scoreFit) : null;
  const stars = score != null ? scoreStars(score) : null;
  const dimensions = score != null ? deriveDimensions(score) : [];

  const sortedHisto = useMemo(() => {
    return [...(historique || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [historique]);

  const sortedSignals = useMemo(() => {
    return [...(signaux || [])].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [signaux]);

  const decideurs = useMemo(() => buildDecideurs(decideur, contactName), [decideur, contactName]);
  const tabsWithCount = TABS.map((t) =>
    t.id === 'decideurs' ? { ...t, count: decideurs.length || undefined } : t
  );

  const lastIx = sortedHisto[0];
  const lastSignal = sortedSignals[0];
  const tags = normalizeObjectionTags(objections);

  const pourquoi = buildPourquoiMaintenant({
    besoinDetecte,
    raisonDuScore,
    prochaineAction,
    dateRelance,
    lastInteractionResume: lastIx?.resume,
    lastSignalTitre: lastSignal?.titre,
    lastSignalAt: lastSignal?.at,
  });

  const banner =
    resurgence || (lastSignal && lastIx)
      ? buildResurgenceBanner({
          lastContactAt: lastIx?.at,
          lastObjectionOrResume: objections?.[0] || lastIx?.resume,
          signalTitre: lastSignal?.titre,
        })
      : null;

  const freshHint = freshnessLabel(
    referentiel?.scoreFraicheur,
    referentiel?.dateDerniereVerification
  );

  const closed =
    referentiel?.statutActivite === 'CESSEE' ||
    referentiel?.statutActivite === 'EN_LIQUIDATION';

  const resumeIa =
    [raisonDuScore, besoinDetecte].filter(Boolean).join(' ') ||
    pourquoi ||
    'Analyse en cours — les agents Ciblix enrichissent cette fiche.';

  const angles = splitAngles(raisonDuScore || besoinDetecte);
  const whyItems = useMemo(() => {
    const items: string[] = [];
    for (const s of sortedSignals.slice(0, 4)) items.push(s.titre);
    if (besoinDetecte?.trim()) items.push(besoinDetecte.trim());
    if (prochaineAction?.trim()) items.push(prochaineAction.trim());
    if (lastIx?.resume?.trim()) items.push(`Dernier échange : ${lastIx.resume.trim()}`);
    return [...new Set(items)].slice(0, 6);
  }, [sortedSignals, besoinDetecte, prochaineAction, lastIx]);

  const timingGood = sortedSignals.length > 0 || (score != null && score >= 75);

  const metaParts = [
    secteur,
    ville,
    referentiel?.tailleEstimee,
  ].filter(Boolean);

  const markOutbound = (canal: 'appel' | 'whatsapp', name?: string) => {
    try {
      sessionStorage.setItem(
        `ciblix_outbound_${contactId}`,
        JSON.stringify({ canal, at: Date.now(), name: name || decideur?.nom || nomLegal })
      );
    } catch {
      /* ignore */
    }
    onOutbound?.(canal);
  };

  const copyMessage = async () => {
    if (!messageBrouillon?.trim()) return;
    try {
      await navigator.clipboard.writeText(messageBrouillon.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const primaryDecideur = decideurs[0];
  const footerAction =
    prochaineAction?.trim() ||
    (primaryDecideur?.nom
      ? `Contacter ${primaryDecideur.nom}${primaryDecideur.phone ? ' par téléphone' : ''}`
      : 'Planifier la prochaine action');

  return (
    <div className={cn('pb-24', className)}>
      {closed ? (
        <AlertBanner tone="danger">
          Entreprise signalée inactive. Actions désactivées — l’historique reste consultable.
        </AlertBanner>
      ) : null}
      {banner && !closed ? <AlertBanner tone="amber">{banner}</AlertBanner> : null}
      {dictationPrompt ? (
        <AlertBanner tone="blue">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{dictationPrompt}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="bg-[#016AEB]" onClick={onDicter}>
                Dicter ma note
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={onDismissDictationPrompt}>
                Plus tard
              </Button>
            </div>
          </div>
        </AlertBanner>
      ) : null}

      {/* En-tête fiche */}
      <header className="rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#016AEB] to-[#1E72B9] text-2xl font-semibold text-white">
              {initialsFromName(nomLegal)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-neutral-900">{nomLegal}</h1>
                {score != null ? (
                  <span className="rounded-lg bg-[#EEF5FF] px-2.5 py-1 text-sm font-semibold text-[#016AEB]">
                    {score}/100
                  </span>
                ) : null}
                {stars != null ? (
                  <span className="inline-flex items-center gap-0.5 text-amber-500">
                    <Star size={14} fill="currentColor" />
                    <span className="text-sm font-medium text-neutral-700">{stars}</span>
                  </span>
                ) : null}
              </div>
              {score != null ? (
                <p className="mt-1 text-sm text-neutral-600">{scoreLabel(score)}</p>
              ) : null}
              <p className="mt-1 text-sm text-neutral-500">{metaParts.join(' • ') || 'Informations en cours'}</p>
              {referentiel?.dateDerniereVerification ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#016AEB]">
                  <BadgeCheck size={14} />
                  Entreprise vérifiée {formatVerified(referentiel.dateDerniereVerification)}
                </p>
              ) : freshHint ? (
                <p className="mt-2 text-xs text-amber-700">{freshHint}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {score != null && score >= 80 ? (
                  <Badge className="border-0 bg-orange-50 text-orange-700 hover:bg-orange-50">
                    <Flame size={12} className="mr-1" /> Opportunité chaude
                  </Badge>
                ) : null}
                {contactName && contactName !== nomLegal ? (
                  <Badge variant="outline" className="text-neutral-600">
                    Contact : {contactName}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <UserPlus size={14} /> Ajouter à une liste
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
              <MoreHorizontal size={16} />
            </Button>
          </div>
        </div>

        <nav className="mt-5 flex gap-1 overflow-x-auto border-t border-neutral-100 pt-4">
          {tabsWithCount.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition',
                tab === t.id
                  ? 'bg-[#016AEB] text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              )}
            >
              {t.label}
              {t.count ? ` (${t.count})` : ''}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'apercu' ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-12">
          {/* Colonne gauche — IA */}
          <div className="space-y-4 xl:col-span-4">
            <Panel title="Résumé IA" icon={<Sparkles size={16} className="text-violet-600" />}>
              <p className="text-sm leading-relaxed text-neutral-700">{resumeIa}</p>
              {timingGood ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3 bg-violet-600 hover:bg-violet-700"
                  disabled={closed}
                >
                  Très bon moment pour contacter
                </Button>
              ) : null}
            </Panel>

            {angles.length ? (
              <Panel title="Angle d'approche conseillé">
                <ul className="space-y-2">
                  {angles.map((a) => (
                    <li key={a} className="flex gap-2 text-sm text-neutral-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#016AEB]" />
                      {a}
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            <div ref={messagePanelRef} id="fiche-message-ia">
            <Panel
              title="Message recommandé par IA"
              action={
                messageBrouillon ? (
                  <Badge className="border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                    Prêt à envoyer
                  </Badge>
                ) : null
              }
            >
              {messageError ? (
                <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{messageError}</p>
              ) : null}
              {messageBrouillon ? (
                <>
                  <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-800">
                    {messageBrouillon}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copyMessage}>
                      <Copy size={14} /> {copied ? 'Copié' : 'Copier'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={closed || messagePending}
                      onClick={onReprendre}
                    >
                      <Pencil size={14} /> Modifier
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={closed || messagePending}
                      onClick={onReprendre}
                    >
                      <RefreshCw size={14} className={messagePending ? 'animate-spin' : undefined} />{' '}
                      {messagePending ? 'Génération…' : 'Régénérer'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-500">Aucun message généré pour le moment.</p>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-[#016AEB] hover:bg-[#0159c4]"
                    disabled={closed || messagePending}
                    onClick={onReprendre}
                  >
                    {messagePending ? (
                      <>
                        <RefreshCw size={14} className="mr-1.5 animate-spin" /> Génération en cours…
                      </>
                    ) : (
                      'Préparer un message'
                    )}
                  </Button>
                </div>
              )}
            </Panel>
            </div>
          </div>

          {/* Colonne centrale — qualification */}
          <div className="space-y-4 xl:col-span-4">
            <Panel title="Pourquoi contacter aujourd'hui ?">
              {whyItems.length ? (
                <ul className="space-y-2.5">
                  {whyItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-neutral-700">
                      <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">
                  {pourquoi || 'En attente de signaux ou d’interactions.'}
                </p>
              )}
            </Panel>

            {score != null ? (
              <Panel title="Score détaillé">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                    <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15.5"
                        fill="none"
                        stroke="#016AEB"
                        strokeWidth="3"
                        strokeDasharray={`${score} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-lg font-semibold text-neutral-900">{score}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    {dimensions.map((d) => (
                      <div key={d.label}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="text-neutral-600">{d.label}</span>
                          <span className="font-medium text-neutral-800">{d.value}/100</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                          <div
                            className="h-full rounded-full bg-[#016AEB]"
                            style={{ width: `${d.value}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            ) : null}

            <Panel title="Décideurs identifiés">
              <DecideursList
                rows={decideurs}
                messageBrouillon={messageBrouillon}
                nomLegal={nomLegal}
                closed={closed}
                onOutbound={markOutbound}
              />
            </Panel>
          </div>

          {/* Colonne droite — entreprise & actions */}
          <div className="space-y-4 xl:col-span-4">
            <Panel title="Informations entreprise" icon={<Building2 size={16} className="text-neutral-500" />}>
              <dl className="space-y-2.5 text-sm">
                <InfoRow label="Industrie" value={secteur} />
                <InfoRow label="Effectif" value={referentiel?.tailleEstimee} />
                <InfoRow label="Création" value={referentiel?.anneeCreation?.toString()} />
                <InfoRow label="Identifiant" value={referentiel?.identifiantNational} />
                {referentiel?.adresseSiege ? (
                  <div>
                    <dt className="text-xs text-neutral-500">Adresse</dt>
                    <dd className="mt-0.5">
                      <a
                        href={mapsLink(referentiel.adresseSiege)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 text-[#016AEB] hover:underline"
                      >
                        <MapPin size={14} className="mt-0.5 shrink-0" />
                        {referentiel.adresseSiege}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {referentiel?.telephoneStandard ? (
                  <div>
                    <dt className="text-xs text-neutral-500">Téléphone</dt>
                    <dd className="mt-0.5">
                      <a href={`tel:${referentiel.telephoneStandard}`} className="text-[#016AEB] hover:underline">
                        {referentiel.telephoneStandard}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {referentiel?.emailGenerique ? (
                  <div>
                    <dt className="text-xs text-neutral-500">Email</dt>
                    <dd className="mt-0.5">
                      <a
                        href={mailtoLink(referentiel.emailGenerique, messageBrouillon, nomLegal)}
                        className="text-[#016AEB] hover:underline"
                      >
                        {referentiel.emailGenerique}
                      </a>
                    </dd>
                  </div>
                ) : null}
                {referentiel?.siteWeb ? (
                  <div>
                    <dt className="text-xs text-neutral-500">Site web</dt>
                    <dd className="mt-0.5">
                      <a
                        href={siteHref(referentiel.siteWeb)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[#016AEB] hover:underline"
                      >
                        <Globe size={14} />
                        {referentiel.siteWeb.replace(/^https?:\/\//i, '')}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              {!referentiel?.telephoneStandard && !referentiel?.emailGenerique && decideur?.phone ? (
                <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                  Coordonnées contact :{' '}
                  {decideur.phone ? (
                    <a href={`tel:${decideur.phone}`} className="text-[#016AEB]">
                      {decideur.phone}
                    </a>
                  ) : null}
                  {decideur.email ? (
                    <>
                      {' · '}
                      <a href={`mailto:${decideur.email}`} className="text-[#016AEB]">
                        {decideur.email}
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </Panel>

            {sortedHisto.length ? (
              <Panel title="Historique d'engagement">
                <ul className="space-y-3">
                  {sortedHisto.slice(0, 5).map((ix, i) => (
                    <li key={`${ix.at}-${i}`} className="relative pl-4">
                      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[#016AEB]" />
                      {i < Math.min(sortedHisto.length, 5) - 1 ? (
                        <span className="absolute bottom-0 left-[3px] top-3 w-px bg-neutral-200" />
                      ) : null}
                      <p className="text-xs text-neutral-500">
                        {formatWhen(ix.at)} · {canalLabel(ix.canal)}
                      </p>
                      <p className="text-sm text-neutral-800">{ix.resume}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}

            {tags.length ? (
              <Panel title="Objections détectées">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-red-700">
                      {OBJECTION_LABELS[t]}
                    </Badge>
                  ))}
                </div>
              </Panel>
            ) : null}

            <Panel title="Actions rapides">
              <div className="grid grid-cols-2 gap-2">
                <QuickAction
                  label="WhatsApp"
                  tone="green"
                  disabled={closed || !decideur?.whatsapp && !decideur?.phone}
                  href={
                    decideur?.whatsapp || decideur?.phone
                      ? waLink(decideur.whatsapp || decideur.phone!, messageBrouillon)
                      : undefined
                  }
                  onClick={() =>
                    markOutbound('whatsapp', primaryDecideur?.nom)
                  }
                />
                <QuickAction
                  label="Appeler"
                  tone="blue"
                  disabled={closed || !decideur?.phone}
                  href={decideur?.phone ? `tel:${decideur.phone}` : undefined}
                  onClick={() => markOutbound('appel', primaryDecideur?.nom)}
                />
                <QuickAction
                  label="Envoyer un email"
                  tone="outline"
                  disabled={closed || !decideur?.email}
                  href={
                    decideur?.email
                      ? mailtoLink(decideur.email, messageBrouillon, nomLegal)
                      : undefined
                  }
                />
                <QuickAction label="Créer un RDV" tone="purple" disabled={closed} />
                <QuickAction
                  label="Dicter une note"
                  tone="dark"
                  disabled={closed}
                  onClick={onDicter}
                />
              </div>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === 'decideurs' ? (
        <div className="mt-5 max-w-2xl">
          <Panel title="Décideurs et contacts">
            <DecideursList
              rows={decideurs}
              messageBrouillon={messageBrouillon}
              nomLegal={nomLegal}
              closed={closed}
              onOutbound={markOutbound}
              expanded
            />
          </Panel>
        </div>
      ) : null}

      {tab === 'actualites' ? (
        <div className="mt-5 max-w-2xl space-y-3">
          {sortedSignals.length ? (
            sortedSignals.map((s, i) => (
              <div key={`${s.at}-${i}`} className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="text-xs text-amber-800/80">{formatWhen(s.at)}</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">{s.titre}</p>
                {s.source_url ? (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-[#016AEB]"
                  >
                    Voir la source
                  </a>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyTab message="Aucune actualité détectée pour le moment." />
          )}
        </div>
      ) : null}

      {tab === 'historique' ? (
        <div className="mt-5 max-w-2xl">
          {sortedHisto.length ? (
            <Panel title="Historique complet">
              <ul className="space-y-4">
                {sortedHisto.map((ix, i) => (
                  <li key={`${ix.at}-${i}`} className="border-b border-neutral-100 pb-4 last:border-0">
                    <p className="text-xs text-neutral-500">
                      {formatWhen(ix.at)} · {canalLabel(ix.canal)}
                    </p>
                    <p className="mt-1 text-sm text-neutral-800">{ix.resume}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <EmptyTab message="Aucun échange enregistré." />
          )}
        </div>
      ) : null}

      {tab === 'fichiers' || tab === 'notes' ? (
        <div className="mt-5">
          <EmptyTab
            message={
              tab === 'fichiers'
                ? 'Aucun fichier attaché à cette fiche.'
                : 'Aucune note — utilisez « Dicter une note » pour en ajouter.'
            }
          />
        </div>
      ) : null}

      {/* Barre d'action IA */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2">
            <Sparkles size={18} className="mt-0.5 shrink-0 text-violet-600" />
            <p className="text-sm text-neutral-800">
              <span className="font-medium">Prochaine action :</span> {footerAction}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-[#016AEB] hover:bg-[#0159c4]"
              disabled={closed || messagePending}
              onClick={() => {
                setTab('apercu');
                const scrollToMsg = () => {
                  messagePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
                if (messageBrouillon?.trim()) {
                  // Message déjà là → juste le montrer
                  requestAnimationFrame(scrollToMsg);
                  return;
                }
                // Sinon générer puis le panneau se mettra à jour
                (onVoirMessage || onReprendre)?.();
                window.setTimeout(scrollToMsg, 800);
              }}
            >
              {messagePending
                ? 'Génération…'
                : messageBrouillon?.trim()
                  ? 'Voir le message'
                  : 'Préparer un message'}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={closed} onClick={onDicter}>
              <Mic size={14} className="mr-1.5" /> Dicter une note
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value?.trim()) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function DecideursList({
  rows,
  messageBrouillon,
  nomLegal,
  closed,
  onOutbound,
  expanded,
}: {
  rows: DecideurRow[];
  messageBrouillon?: string | null;
  nomLegal: string;
  closed?: boolean;
  onOutbound: (canal: 'appel' | 'whatsapp', name?: string) => void;
  expanded?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-neutral-500">Aucun décideur identifié pour le moment.</p>;
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className={cn(
            'rounded-xl border border-neutral-100 bg-neutral-50/50 p-3',
            expanded && 'p-4'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF5FF] text-sm font-semibold text-[#016AEB]">
              {initialsFromName(row.nom)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-neutral-900">{row.nom}</p>
                {row.tag ? (
                  <Badge variant="outline" className="text-[10px]">
                    {row.tag}
                  </Badge>
                ) : null}
              </div>
              {row.fonction ? <p className="text-xs text-neutral-500">{row.fonction}</p> : null}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                {row.phone ? (
                  <a href={`tel:${row.phone}`} className="inline-flex items-center gap-1 text-[#016AEB]">
                    <Phone size={12} /> {row.phone}
                  </a>
                ) : null}
                {row.email ? (
                  <a
                    href={mailtoLink(row.email, messageBrouillon, nomLegal)}
                    className="inline-flex items-center gap-1 text-[#016AEB]"
                  >
                    <Mail size={12} /> {row.email}
                  </a>
                ) : null}
                {row.whatsapp ? (
                  <a
                    href={waLink(row.whatsapp, messageBrouillon)}
                    className="inline-flex items-center gap-1 text-emerald-700"
                    onClick={() => onOutbound('whatsapp', row.nom)}
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
              <div className="mt-2 flex gap-1">
                {row.linkedin ? (
                  <a
                    href={row.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-[#016AEB] hover:bg-white"
                  >
                    <Linkedin size={14} />
                  </a>
                ) : null}
                {row.email ? (
                  <a
                    href={mailtoLink(row.email, messageBrouillon, nomLegal)}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-[#016AEB] hover:bg-white',
                      closed && 'pointer-events-none opacity-40'
                    )}
                  >
                    <Mail size={14} />
                  </a>
                ) : null}
                {row.phone ? (
                  <a
                    href={`tel:${row.phone}`}
                    className={cn(
                      'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-[#016AEB] hover:bg-white',
                      closed && 'pointer-events-none opacity-40'
                    )}
                    onClick={() => onOutbound('appel', row.nom)}
                  >
                    <Phone size={14} />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuickAction({
  label,
  tone,
  href,
  disabled,
  onClick,
}: {
  label: string;
  tone: 'green' | 'blue' | 'outline' | 'purple' | 'dark';
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const className = cn(
    'inline-flex h-10 items-center justify-center rounded-xl px-3 text-xs font-medium transition',
    tone === 'green' && 'bg-emerald-600 text-white hover:bg-emerald-700',
    tone === 'blue' && 'bg-[#016AEB] text-white hover:bg-[#0159c4]',
    tone === 'outline' && 'border border-[#016AEB] text-[#016AEB] hover:bg-[#EEF5FF]',
    tone === 'purple' && 'border border-violet-300 text-violet-700 hover:bg-violet-50',
    tone === 'dark' && 'border border-neutral-800 text-neutral-800 hover:bg-neutral-50',
    disabled && 'pointer-events-none opacity-40'
  );

  if (href && !disabled) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-8 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

function AlertBanner({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'amber' | 'danger' | 'blue';
}) {
  return (
    <div
      className={cn(
        'mb-4 rounded-xl px-4 py-3 text-sm leading-relaxed',
        tone === 'amber' && 'bg-amber-50 text-amber-950',
        tone === 'danger' && 'bg-red-50 text-red-900',
        tone === 'blue' && 'bg-[#EEF5FF] text-neutral-900'
      )}
    >
      {children}
    </div>
  );
}
