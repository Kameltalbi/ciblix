import { useMemo, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  Mail,
  MapPin,
  Mic,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  OBJECTION_LABELS,
  buildPourquoiMaintenant,
  buildResurgenceBanner,
  freshnessLabel,
  initialsFromName,
  normalizeObjectionTags,
  type ObjectionTag,
} from './ficheDisplay';

export type FicheDecideur = {
  nom?: string | null;
  fonction?: string | null;
  canal_prefere?: 'email' | 'whatsapp' | 'linkedin' | 'telephone' | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
};

export type FicheInteraction = {
  at: string;
  canal: string;
  resume: string;
};

export type FicheSignal = {
  at: string;
  titre: string;
  source_url?: string | null;
};

export type FicheReferentielFacts = {
  adresseSiege?: string | null;
  telephoneStandard?: string | null;
  emailGenerique?: string | null;
  siteWeb?: string | null;
  identifiantNational?: string | null;
  anneeCreation?: number | null;
  tailleEstimee?: string | null;
  statutActivite?: string | null;
  scoreFraicheur?: number | null;
  dateDerniereVerification?: string | null;
  sourceLabel?: string | null;
};

export type FicheEntrepriseProps = {
  contactId: string;
  nomLegal: string;
  secteur?: string | null;
  ville?: string | null;
  decideur?: FicheDecideur | null;
  besoinDetecte?: string | null;
  raisonDuScore?: string | null;
  prochaineAction?: string | null;
  dateRelance?: string | null;
  messageBrouillon?: string | null;
  messageCanal?: string | null;
  historique?: FicheInteraction[] | null;
  objections?: string[] | null;
  signaux?: FicheSignal[] | null;
  referentiel?: FicheReferentielFacts | null;
  /** Jamais affiché — accepté pour typage / oubli volontaire */
  scoreFit?: number | null;
  ficheEtat?: string | null;
  resurgence?: boolean;
  onReprendre?: () => void;
  onDicter?: () => void;
  onVoirMessage?: () => void;
  /** Appelé dès qu’un canal sortant est déclenché (affiche le bandeau Dicter sans recharger). */
  onOutbound?: (canal: 'appel' | 'whatsapp') => void;
  dictationPrompt?: string | null;
  onDismissDictationPrompt?: () => void;
  className?: string;
};

function waLink(phone: string, draft?: string | null): string {
  const digits = phone.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  if (draft?.trim()) return `${base}?text=${encodeURIComponent(draft.trim())}`;
  return base;
}

function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function mailtoLink(email: string, draft?: string | null, company?: string): string {
  const subject = encodeURIComponent(company ? `Suite — ${company}` : 'Suite');
  if (draft?.trim()) {
    return `mailto:${email}?subject=${subject}&body=${encodeURIComponent(draft.trim())}`;
  }
  return `mailto:${email}?subject=${subject}`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statutLabel(s?: string | null): string {
  switch ((s || '').toUpperCase()) {
    case 'ACTIVE':
      return 'Active';
    case 'CESSEE':
      return 'Cessée';
    case 'EN_LIQUIDATION':
      return 'En liquidation';
    default:
      return 'Statut à vérifier';
  }
}

function canalLabel(c: string): string {
  const m: Record<string, string> = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    appel: 'Appel',
    note: 'Note',
    vocal: 'Vocal',
  };
  return m[c] || c;
}

/**
 * Fiche entreprise complète — 7 blocs, lecture seule.
 * Deux actions produit : Reprendre / Dicter (ou Voir le message si fraîche).
 */
export function FicheEntreprise(props: FicheEntrepriseProps) {
  const {
    contactId,
    nomLegal,
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
    ficheEtat,
    resurgence,
    onReprendre,
    onDicter,
    onVoirMessage,
    onOutbound,
    dictationPrompt,
    onDismissDictationPrompt,
    className,
  } = props;

  // score_fit volontairement non lu pour l’affichage
  void props.scoreFit;

  const [chronoOpen, setChronoOpen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const sortedHisto = useMemo(() => {
    const list = [...(historique || [])];
    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [historique]);

  const sortedSignals = useMemo(() => {
    const list = [...(signaux || [])];
    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [signaux]);

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

  const isFresh = !sortedHisto.length && (ficheEtat === 'DECOUVERTE' || ficheEtat === 'QUALIFIEE' || !ficheEtat);
  const closed =
    referentiel?.statutActivite === 'CESSEE' ||
    referentiel?.statutActivite === 'EN_LIQUIDATION';
  const freshHint = freshnessLabel(
    referentiel?.scoreFraicheur,
    referentiel?.dateDerniereVerification
  );

  const phone = decideur?.phone || null;
  const email = decideur?.email || null;
  const whatsapp = decideur?.whatsapp || phone;
  const pref = decideur?.canal_prefere;

  const markOutbound = (canal: 'appel' | 'whatsapp') => {
    try {
      sessionStorage.setItem(
        `ciblix_outbound_${contactId}`,
        JSON.stringify({ canal, at: Date.now(), name: decideur?.nom || nomLegal })
      );
    } catch {
      /* ignore */
    }
    onOutbound?.(canal);
  };

  const identityMeta = [secteur, ville, statutLabel(referentiel?.statutActivite)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn('mx-auto max-w-lg pb-28', className)}>
      {closed ? (
        <AlertBanner tone="danger">
          Entreprise signalée {statutLabel(referentiel?.statutActivite).toLowerCase()}. Actions
          désactivées — l’historique reste consultable.{' '}
          <a href="mailto:contact@ciblix.com?subject=Correction%20r%C3%A9f%C3%A9rentiel" className="underline">
            Signaler une erreur
          </a>
        </AlertBanner>
      ) : null}

      {banner && !closed ? <AlertBanner tone="amber">{banner}</AlertBanner> : null}

      {dictationPrompt ? (
        <AlertBanner tone="blue">
          <div className="flex flex-col gap-2">
            <span>{dictationPrompt}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" className="h-10 bg-[#016AEB]" onClick={onDicter}>
                Dicter ma note
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-10" onClick={onDismissDictationPrompt}>
                Plus tard
              </Button>
            </div>
          </div>
        </AlertBanner>
      ) : null}

      {/* Bloc 1 — En-tête */}
      <header className="border-b border-neutral-200/80 pb-4">
        <h1 className="text-base font-medium text-neutral-900">{nomLegal}</h1>
        <p className="mt-1 text-xs text-neutral-500">{identityMeta}</p>
        {freshHint ? (
          <p className="mt-1 text-xs text-amber-700/80">{freshHint}</p>
        ) : null}
      </header>

      {/* Bloc 2 — Pourquoi maintenant (seul bloc coloré) */}
      <section className="mt-4 rounded-xl bg-[#EEF5FF] px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#1E72B9]">
          Pourquoi maintenant
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-neutral-900">
          {pourquoi || 'En attente d’un signal ou d’un besoin détecté.'}
        </p>
      </section>

      {/* Bloc 3 — Interlocuteur */}
      <section className="mt-5 border-b border-neutral-200/80 pb-5">
        <div className="flex items-center gap-3 rounded-xl bg-[#F0F7FF] px-3 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-medium text-[#016AEB]">
            {initialsFromName(decideur?.nom)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-neutral-900">
              {decideur?.nom || 'Interlocuteur non identifié'}
            </p>
            {decideur?.fonction ? (
              <p className="text-xs text-neutral-500">{decideur.fonction}</p>
            ) : null}
          </div>
        </div>

        {phone || email || whatsapp ? (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ChannelButton
              label="Appeler"
              disabled={closed || !phone}
              preferred={pref === 'telephone'}
              href={phone ? `tel:${phone}` : undefined}
              onClick={() => {
                if (phone) {
                  markOutbound('appel');
                  setShowPhone(true);
                }
              }}
              icon={<Phone size={16} />}
            />
            <ChannelButton
              label="WhatsApp"
              disabled={closed || !whatsapp}
              preferred={pref === 'whatsapp'}
              href={whatsapp ? waLink(whatsapp, messageBrouillon) : undefined}
              onClick={() => whatsapp && markOutbound('whatsapp')}
              icon={<span className="text-[11px] font-bold">WA</span>}
            />
            <ChannelButton
              label="Email"
              disabled={closed || !email}
              preferred={pref === 'email'}
              href={email ? mailtoLink(email, messageBrouillon, nomLegal) : undefined}
              icon={<Mail size={16} />}
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">
            Coordonnées non identifiées — voir le standard entreprise plus bas.
          </p>
        )}
        {showPhone && phone ? (
          <p className="mt-2 text-xs text-neutral-400" onContextMenu={(e) => e.preventDefault()}>
            {phone}
          </p>
        ) : null}
      </section>

      {/* Bloc 4 — Dernier échange */}
      {lastIx ? (
        <section className="mt-5 border-b border-neutral-200/80 pb-5">
          <p className="text-xs text-neutral-500">
            {formatWhen(lastIx.at)} · {canalLabel(lastIx.canal)}
          </p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-neutral-800">
            {lastIx.resume}
          </p>
          {tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <ObjectionChip key={t} tag={t} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Bloc 5 — Chronologie (repliée) */}
      {sortedHisto.length > 1 ? (
        <section className="mt-4 border-b border-neutral-200/80 pb-4">
          <button
            type="button"
            className="flex h-11 w-full items-center justify-between text-left text-[13px] font-medium text-neutral-800"
            onClick={() => setChronoOpen((v) => !v)}
          >
            Chronologie ({sortedHisto.length})
            <ChevronDown
              size={16}
              className={cn('text-neutral-400 transition', chronoOpen && 'rotate-180')}
            />
          </button>
          {chronoOpen ? (
            <ul className="mt-2 space-y-3">
              {sortedHisto.map((ix, i) => (
                <li key={`${ix.at}-${i}`} className="border-l-2 border-neutral-200 pl-3">
                  <p className="text-xs text-neutral-500">
                    {formatWhen(ix.at)} · {canalLabel(ix.canal)}
                  </p>
                  <p className="text-[13px] leading-relaxed text-neutral-700">{ix.resume}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-neutral-400">
              {Math.min(3, sortedHisto.length)} derniers échanges — toucher pour tout voir
            </p>
          )}
        </section>
      ) : null}

      {/* Bloc 6 — Faits référentiel */}
      <section className="mt-5 border-b border-neutral-200/80 pb-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
          Entreprise
        </p>
        <ul className="space-y-2 text-[13px]">
          {referentiel?.adresseSiege ? (
            <li>
              <a
                href={mapsLink(referentiel.adresseSiege)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-[#016AEB]"
              >
                <MapPin size={14} /> {referentiel.adresseSiege}
              </a>
            </li>
          ) : null}
          {referentiel?.telephoneStandard ? (
            <li>
              <a
                href={`tel:${referentiel.telephoneStandard}`}
                className="inline-flex min-h-11 items-center gap-2 text-[#016AEB]"
              >
                <Phone size={14} /> Standard · {referentiel.telephoneStandard}
              </a>
            </li>
          ) : null}
          {referentiel?.emailGenerique ? (
            <li>
              <a
                href={`mailto:${referentiel.emailGenerique}`}
                className="inline-flex min-h-11 items-center gap-2 text-[#016AEB]"
              >
                <Mail size={14} /> {referentiel.emailGenerique}
              </a>
            </li>
          ) : null}
          {referentiel?.siteWeb ? (
            <li>
              <a
                href={
                  /^https?:\/\//i.test(referentiel.siteWeb)
                    ? referentiel.siteWeb
                    : `https://${referentiel.siteWeb}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-[#016AEB]"
              >
                Site web
              </a>
            </li>
          ) : null}
        </ul>
        <p className="mt-3 text-xs text-neutral-400">
          {[
            referentiel?.identifiantNational,
            referentiel?.anneeCreation ? `créée ${referentiel.anneeCreation}` : null,
            referentiel?.tailleEstimee,
          ]
            .filter(Boolean)
            .join(' · ') || 'Faits entreprise incomplets'}
        </p>
        <p className="mt-1 text-xs text-neutral-400">
          {referentiel?.sourceLabel || 'Référentiel'}
          {referentiel?.dateDerniereVerification
            ? ` · vérifié le ${formatWhen(referentiel.dateDerniereVerification)}`
            : ''}
          {freshHint ? ` · ${freshHint}` : ''}
        </p>
      </section>

      {/* Bloc 7 — Signaux */}
      {sortedSignals.length ? (
        <section className="mt-5">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
            Signaux détectés
          </p>
          <ul className="space-y-2">
            {sortedSignals.map((s, i) => (
              <li
                key={`${s.at}-${i}`}
                className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2"
              >
                <p className="text-xs text-amber-800/80">{formatWhen(s.at)}</p>
                <p className="text-[13px] text-neutral-800">{s.titre}</p>
                {s.source_url ? (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#016AEB]"
                  >
                    Source
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Actions produit — bas, pouce */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200/80 bg-white/95 px-4 py-3 backdrop-blur supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg gap-2">
          {isFresh ? (
            <Button
              type="button"
              className="h-11 flex-1 gap-2 bg-[#016AEB] hover:bg-[#0159c4]"
              disabled={closed}
              onClick={onVoirMessage || onReprendre}
            >
              Voir le message
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 flex-1 gap-2 bg-[#016AEB] hover:bg-[#0159c4]"
              disabled={closed}
              onClick={onReprendre}
            >
              <RefreshCw size={16} /> Reprendre le contact
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 gap-2"
            disabled={closed}
            onClick={onDicter}
          >
            <Mic size={16} /> Dicter une note
          </Button>
        </div>
      </div>
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
        'mb-4 rounded-xl px-3 py-3 text-[13px] leading-relaxed',
        tone === 'amber' && 'bg-amber-50 text-amber-950',
        tone === 'danger' && 'bg-red-50 text-red-900',
        tone === 'blue' && 'bg-[#EEF5FF] text-neutral-900'
      )}
    >
      {children}
    </div>
  );
}

function ObjectionChip({ tag }: { tag: ObjectionTag }) {
  return (
    <span className="inline-flex rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-800/90">
      {OBJECTION_LABELS[tag]}
    </span>
  );
}

function ChannelButton({
  label,
  href,
  disabled,
  preferred,
  onClick,
  icon,
}: {
  label: string;
  href?: string;
  disabled?: boolean;
  preferred?: boolean;
  onClick?: () => void;
  icon: ReactNode;
}) {
  const className = cn(
    'inline-flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border text-[11px] font-medium transition',
    preferred
      ? 'border-[#016AEB]/50 bg-[#016AEB] text-white'
      : 'border-neutral-200 bg-white text-neutral-700',
    disabled && 'pointer-events-none opacity-40'
  );

  if (href && !disabled) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {icon}
        {label}
      </a>
    );
  }
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}
