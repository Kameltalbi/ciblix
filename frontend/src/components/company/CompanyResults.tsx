import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  ClipboardCopy,
  Facebook,
  FileText,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';
import type {
  CompanyResult,
  CompanyResultsProps,
  CompanySignalKind,
  CompanySourceConfiance,
} from '@/types/companyResult';

const ACCENT = '#016AEB';
const NA = 'Non disponible';

function display(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : NA;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso?.trim()) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function whatsappHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
  return `https://wa.me/${digits}`;
}

function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, '')}`;
}

function ConfidenceBadge({
  source,
  size = 'sm',
}: {
  source?: CompanySourceConfiance | null;
  size?: 'sm' | 'md';
}) {
  const s = source || 'non_trouve';
  const cfg =
    s === 'rne'
      ? { label: 'Vérifié RNE', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80' }
      : s === 'site_officiel'
        ? { label: 'Web', className: 'bg-sky-50 text-sky-700 ring-sky-200/80' }
        : s === 'recherche_web'
          ? { label: 'Web', className: 'bg-sky-50/80 text-sky-600 ring-sky-100' }
          : { label: 'Non vérifié', className: 'bg-slate-100 text-slate-500 ring-slate-200/80' };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function signalIcon(kind?: CompanySignalKind | null) {
  switch (kind) {
    case 'ao':
      return FileText;
    case 'recrute':
      return User;
    case 'nouvelle_creation':
      return Sparkles;
    case 'investissement':
      return Briefcase;
    default:
      return Sparkles;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value || value === NA) return null;
  return (
    <button
      type="button"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
      title="Copier"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check size={14} className="text-emerald-600" /> : <ClipboardCopy size={14} />}
    </button>
  );
}

function Section({
  title,
  children,
  highlight,
}: {
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <section
      className={cn(
        'rounded-xl border p-4',
        highlight
          ? 'border-[#016AEB]/25 bg-gradient-to-br from-[#F0F7FF] to-white'
          : 'border-slate-100 bg-white'
      )}
    >
      <h3
        className={cn(
          'mb-3 text-xs font-semibold uppercase tracking-[0.06em]',
          highlight ? 'text-[#016AEB]' : 'text-slate-400'
        )}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const missing = value === NA;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className={cn('mt-0.5 text-sm', missing ? 'italic text-slate-400' : 'text-slate-800')}>
        {value}
      </dd>
    </div>
  );
}

function CompanyDetail({
  company,
  onBack,
  onSendMessage,
  onRegenerateMessage,
  showBack,
  showWhatsAppAction,
}: {
  company: CompanyResult;
  onBack?: () => void;
  onSendMessage?: CompanyResultsProps['onSendMessage'];
  onRegenerateMessage?: CompanyResultsProps['onRegenerateMessage'];
  showBack?: boolean;
  /** Bouton WhatsApp dans Contact — uniquement si mobile / tactile détecté */
  showWhatsAppAction?: boolean;
}) {
  const [message, setMessage] = useState(company.message_recommande || '');
  const [regenPending, setRegenPending] = useState(false);

  useEffect(() => {
    setMessage(company.message_recommande || '');
  }, [company.id, company.message_recommande]);

  const channel = company.canal_recommande || (company.telephone ? 'whatsapp' : 'email');
  const channelLabel =
    channel === 'whatsapp' ? 'WhatsApp' : channel === 'linkedin' ? 'LinkedIn' : 'Email';

  const activiteNat = [company.code_nat, company.activite_nat].filter(Boolean).join(' — ') || null;
  const SignalIcon = signalIcon(company.signal?.kind);
  const socials = company.reseaux_sociaux || {};

  const handleRegen = async () => {
    if (!onRegenerateMessage) return;
    setRegenPending(true);
    try {
      await onRegenerateMessage(company);
    } finally {
      setRegenPending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F8FAFC]">
      <header className="flex shrink-0 items-start gap-3 border-b border-slate-100 bg-white px-4 py-4 sm:px-5">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Retour"
          >
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight text-slate-900">
              {display(company.entreprise)}
            </h2>
            <ConfidenceBadge source={company.source_confiance} size="md" />
          </div>
          <p className="mt-1 text-sm text-slate-500">{display(company.secteur_probable)}</p>
          {company.url_site ? (
            <a
              href={company.url_site}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block truncate text-xs font-medium text-[#016AEB] hover:underline"
            >
              {company.url_site.replace(/^https?:\/\//, '')}
            </a>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
        <Section title="Identité légale">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Forme juridique" value={display(company.forme_juridique)} />
            <Field label="Activité (NAT)" value={display(activiteNat)} />
            <Field label="Date de création" value={formatDate(company.date_creation)} />
            <Field label="Dirigeant légal" value={display(company.dirigeant)} />
            <Field label="Capital" value={display(company.capital)} />
            <Field
              label="Localisation"
              value={display(
                [company.ville, company.gouvernorat].filter(Boolean).join(', ') || company.adresse
              )}
            />
          </dl>
        </Section>

        <Section title="Contact">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail size={15} className="shrink-0 text-slate-400" />
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-sm',
                  company.email_contact ? 'text-slate-800' : 'italic text-slate-400'
                )}
              >
                {display(company.email_contact)}
              </span>
              {company.email_contact ? <CopyButton value={company.email_contact} /> : null}
              {company.email_contact ? (
                <a
                  href={`mailto:${company.email_contact}`}
                  className="inline-flex h-8 items-center rounded-lg bg-slate-50 px-2.5 text-xs font-medium text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  Écrire
                </a>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Phone size={15} className="shrink-0 text-slate-400" />
              <span
                className={cn(
                  'min-w-0 text-sm',
                  company.telephone ? 'text-slate-800' : 'italic text-slate-400'
                )}
              >
                {display(company.telephone)}
              </span>
              {company.telephone ? (
                <>
                  <a
                    href={telHref(company.telephone)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 text-xs font-medium text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone size={12} /> Appeler
                  </a>
                  {showWhatsAppAction ? (
                    <a
                      href={whatsappHref(company.telephone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="flex items-start gap-2">
              <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />
              <span
                className={cn(
                  'text-sm leading-relaxed',
                  company.adresse ? 'text-slate-800' : 'italic text-slate-400'
                )}
              >
                {display(company.adresse)}
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {socials.linkedin ? (
                <a
                  href={socials.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2]/15"
                  title="LinkedIn"
                >
                  <Linkedin size={16} />
                </a>
              ) : null}
              {socials.facebook ? (
                <a
                  href={socials.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/15"
                  title="Facebook"
                >
                  <Facebook size={16} />
                </a>
              ) : null}
              {socials.instagram ? (
                <a
                  href={socials.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E4405F]/10 text-[#E4405F] hover:bg-[#E4405F]/15"
                  title="Instagram"
                >
                  <Instagram size={16} />
                </a>
              ) : null}
              {!socials.linkedin && !socials.facebook && !socials.instagram ? (
                <span className="text-sm italic text-slate-400">Réseaux sociaux : {NA}</span>
              ) : null}
            </div>
          </div>
        </Section>

        <Section title="Activité">
          <p
            className={cn(
              'text-sm leading-relaxed',
              company.resume_activite ? 'text-slate-700' : 'italic text-slate-400'
            )}
          >
            {display(company.resume_activite)}
          </p>
          <div className="mt-3">
            {company.secteur_probable ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {company.secteur_probable}
              </span>
            ) : (
              <span className="text-sm italic text-slate-400">Secteur : {NA}</span>
            )}
          </div>
        </Section>

        <Section title="Pourquoi maintenant" highlight>
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${ACCENT}14`, color: ACCENT }}
            >
              <SignalIcon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">
                {display(company.signal?.label)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Détecté le {formatDate(company.signal?.detectedAt || company.date_extraction)}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Action recommandée">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Message pré-rédigé par l’Assistant…"
            className="resize-y rounded-xl border-slate-200 bg-white text-sm"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              className="rounded-xl"
              disabled={!message.trim()}
              onClick={() => onSendMessage?.(company, message.trim(), channel)}
            >
              <Send size={14} />
              Envoyer via {channelLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={regenPending || !onRegenerateMessage}
              onClick={() => void handleRegen()}
            >
              <RefreshCw size={14} className={cn(regenPending && 'animate-spin')} />
              Régénérer le message
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function CompanyListRow({
  company,
  selected,
  onSelect,
}: {
  company: CompanyResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const SignalIcon = signalIcon(company.signal?.kind);
  const location = [company.ville, company.gouvernorat].filter(Boolean).join(', ');

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'group relative flex w-full flex-col gap-1.5 border-b border-slate-100 px-4 py-3.5 text-left transition-colors',
          selected
            ? 'bg-[#F0F7FF]'
            : 'bg-white hover:bg-slate-50/80'
        )}
      >
        {selected ? (
          <span
            className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r"
            style={{ backgroundColor: ACCENT }}
            aria-hidden
          />
        ) : null}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-900">
                {display(company.entreprise)}
              </span>
              <ConfidenceBadge source={company.source_confiance} />
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {display(company.secteur_probable)}
            </p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
              <MapPin size={11} className="shrink-0" />
              {location || NA}
            </p>
          </div>

          <div
            className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {company.telephone ? (
              <a
                href={whatsappHref(company.telephone)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50"
                title="WhatsApp"
              >
                <MessageCircle size={15} />
              </a>
            ) : null}
            {company.email_contact ? (
              <a
                href={`mailto:${company.email_contact}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#016AEB] hover:bg-[#016AEB]/10"
                title="Email"
              >
                <Mail size={15} />
              </a>
            ) : null}
          </div>
        </div>

        {company.signal?.label ? (
          <span className="inline-flex w-fit max-w-full items-center gap-1 truncate rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-100">
            <SignalIcon size={11} className="shrink-0 text-[#016AEB]" />
            <span className="truncate">{company.signal.label}</span>
          </span>
        ) : (
          <span className="text-[11px] italic text-slate-400">Signal : {NA}</span>
        )}
      </button>
    </li>
  );
}

/**
 * Master-detail : liste d’entreprises enrichies + fiche détail (modale plein écran sur mobile).
 */
export function CompanyResults({
  companies,
  selectedId: controlledId,
  onSelect,
  onSendMessage,
  onRegenerateMessage,
  className,
  emptyLabel = 'Aucune entreprise à afficher',
  loading,
}: CompanyResultsProps) {
  const [internalId, setInternalId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const touch = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => setIsMobile(mq.matches || touch.matches);
    apply();
    mq.addEventListener('change', apply);
    touch.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      touch.removeEventListener('change', apply);
    };
  }, []);

  const selectedId = controlledId !== undefined ? controlledId : internalId;

  const selected = useMemo(
    () => companies.find((c) => c.id === selectedId) || null,
    [companies, selectedId]
  );

  const select = (c: CompanyResult | null) => {
    if (controlledId === undefined) setInternalId(c?.id ?? null);
    onSelect?.(c);
  };

  if (loading) {
    return (
      <div className={cn('flex h-[480px] items-center justify-center rounded-2xl border border-slate-100 bg-white text-sm text-slate-400', className)}>
        Chargement…
      </div>
    );
  }

  if (!companies.length) {
    return (
      <div className={cn('flex h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-400', className)}>
        <Building2 size={28} className="text-slate-300" />
        {emptyLabel}
      </div>
    );
  }

  const listPane = (
    <div className="flex h-full min-h-0 flex-col border-slate-100 bg-white lg:border-r">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-400">
          Résultats
        </p>
        <p className="mt-0.5 text-sm font-medium text-slate-700">
          {companies.length} entreprise{companies.length > 1 ? 's' : ''}
        </p>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {companies.map((c) => (
          <CompanyListRow
            key={c.id}
            company={c}
            selected={c.id === selectedId}
            onSelect={() => select(c)}
          />
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'h-[min(720px,calc(100vh-8rem))]',
        className
      )}
    >
      {/* Desktop master-detail */}
      <div className="hidden h-full min-h-0 lg:grid lg:grid-cols-[minmax(280px,38%)_1fr]">
        {listPane}
        {selected ? (
          <CompanyDetail
            company={selected}
            showWhatsAppAction={isMobile}
            onSendMessage={onSendMessage}
            onRegenerateMessage={onRegenerateMessage}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#F8FAFC] text-sm text-slate-400">
            <Building2 size={32} className="text-slate-300" />
            Sélectionnez une entreprise pour voir la fiche
          </div>
        )}
      </div>

      {/* Mobile : liste plein écran */}
      <div className="h-full min-h-0 lg:hidden">{listPane}</div>

      {/* Mobile : fiche en overlay plein écran */}
      {isMobile && selected ? (
        <div className="absolute inset-0 z-10 bg-white lg:hidden">
          <CompanyDetail
            company={selected}
            showBack
            showWhatsAppAction
            onBack={() => select(null)}
            onSendMessage={onSendMessage}
            onRegenerateMessage={onRegenerateMessage}
          />
        </div>
      ) : null}
    </div>
  );
}

export { ConfidenceBadge, display as displayCompanyField };
