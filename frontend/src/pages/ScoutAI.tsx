import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Radar,
  Search,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  Calendar,
  MapPin,
  Banknote,
  FileText,
  PartyPopper,
  Newspaper,
  Loader2,
  AlertCircle,
  Link2,
  ArrowRight,
  Settings2,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Trash2,
  TrendingUp,
  Clock,
  ScanLine,
  Save,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Sparkles,
  MessageSquare,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────

type Category = 'TENDER' | 'EVENT' | 'NEWS';
type OppStatus = 'NEW' | 'SAVED' | 'DISMISSED' | 'APPLIED';

interface ScoutProfile {
  id: string;
  keywords: string[];
  sectors: string[];
  geoZones: string[];
  watchSites?: string[];
  tenderEnabled: boolean;
  eventEnabled: boolean;
  newsEnabled: boolean;
  autoScanEnabled: boolean;
  scanIntervalH: number;
  alertEmailEnabled?: boolean;
  alertMinScore?: number;
  lastScanAt: string | null;
}

interface Opportunity {
  id: string;
  category: Category;
  title: string;
  url: string;
  source: string;
  snippet: string | null;
  aiSummary: string | null;
  relevanceScore: number;
  deadline: string | null;
  location: string | null;
  budget: string | null;
  status: OppStatus;
  createdAt: string;
}

interface Stats {
  total: number;
  newCount: number;
  savedCount: number;
  byCategory: Record<string, number>;
  lastScanAt: string | null;
  autoScanEnabled: boolean;
}

interface UrlAnalysis {
  type: string;
  title: string;
  summary: string;
  deadline: string | null;
  budget: string | null;
  location: string;
  organizer: string;
  requirements: string[];
  relevance: string;
  actionItems: string[];
}

// ─── Config ────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { icon: typeof FileText; label: string; color: string; bg: string; scanLabel: string }> = {
  TENDER: { icon: FileText, label: "Appels d'offres", color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', scanLabel: "Scanner les appels d'offres" },
  EVENT: { icon: PartyPopper, label: 'Événements', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200', scanLabel: 'Scanner les événements' },
  NEWS: { icon: Newspaper, label: 'Actualités', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', scanLabel: 'Scanner les actualités' },
};

const STATUS_CONFIG: Record<OppStatus, { icon: typeof Eye; label: string; color: string }> = {
  NEW: { icon: Eye, label: 'Nouveau', color: 'text-blue-600' },
  SAVED: { icon: BookmarkCheck, label: 'Sauvegardé', color: 'text-amber-600' },
  DISMISSED: { icon: EyeOff, label: 'Ignoré', color: 'text-gray-400' },
  APPLIED: { icon: CheckCircle2, label: 'Traité', color: 'text-emerald-600' },
};

const SUGGESTED_KEYWORDS = [
  'bilan carbone', 'environnement', 'conseil',
  'audit énergétique', 'RSE', 'développement durable', 'ISO 14001',
  'informatique', 'digital', 'BTP', 'agroalimentaire',
];

const SUGGESTED_SECTORS = [
  'Environnement', 'IT & Digital', 'BTP & Construction', 'Agroalimentaire',
  'Santé', 'Éducation & Formation', 'Énergie', 'Transport & Logistique',
  'Tourisme', 'Finance & Banque', 'Industrie', 'Télécommunications',
];

/** Marché ciblé (où chercher), indépendant du pays de l’utilisateur. */
type MarketId = 'TN' | 'FR' | 'DZ' | 'MA' | 'BE' | 'CA' | 'SN' | 'CI' | 'INT';

const MARKETS: Array<{ id: MarketId; label: string; countryLabel: string; gl: string }> = [
  { id: 'TN', label: 'Tunisie', countryLabel: 'Tunisie', gl: 'tn' },
  { id: 'FR', label: 'France', countryLabel: 'France', gl: 'fr' },
  { id: 'DZ', label: 'Algérie', countryLabel: 'Algérie', gl: 'dz' },
  { id: 'MA', label: 'Maroc', countryLabel: 'Maroc', gl: 'ma' },
  { id: 'BE', label: 'Belgique', countryLabel: 'Belgique', gl: 'be' },
  { id: 'CA', label: 'Canada', countryLabel: 'Canada', gl: 'ca' },
  { id: 'SN', label: 'Sénégal', countryLabel: 'Sénégal', gl: 'sn' },
  { id: 'CI', label: 'Côte d’Ivoire', countryLabel: "Côte d'Ivoire", gl: 'ci' },
  { id: 'INT', label: 'International', countryLabel: '', gl: '' },
];

const ZONES_BY_MARKET: Record<MarketId, string[]> = {
  TN: [
    'Tunisie entière', 'Tunis', 'Grand Tunis', 'Sfax', 'Sousse', 'Nabeul',
    'Monastir', 'Bizerte', 'Gabès', 'Kairouan', 'Hammamet',
  ],
  FR: [
    'France entière', 'Paris', 'Île-de-France', 'Lyon', 'Marseille', 'Lille',
    'Toulouse', 'Bordeaux', 'Nantes', 'Nice', 'Strasbourg',
  ],
  DZ: [
    'Algérie entière', 'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Sétif',
  ],
  MA: [
    'Maroc entier', 'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Agadir',
  ],
  BE: [
    'Belgique entière', 'Bruxelles', 'Anvers', 'Liège', 'Gand', 'Charleroi',
  ],
  CA: [
    'Canada entier', 'Montréal', 'Québec', 'Toronto', 'Ottawa', 'Laval',
  ],
  SN: [
    'Sénégal entier', 'Dakar', 'Thiès', 'Saint-Louis', 'Kaolack',
  ],
  CI: [
    "Côte d'Ivoire entière", 'Abidjan', 'Bouaké', 'San-Pédro', 'Yamoussoukro',
  ],
  INT: [
    'Europe', 'Afrique du Nord', 'Afrique de l’Ouest', 'Moyen-Orient', 'Golfe', 'Monde',
  ],
};

function inferMarketFromZones(zones: string[]): MarketId {
  const hay = zones.join(' ').toLowerCase();
  if (/tunis|nabeul|sfax|sousse|hammamet|monastir|bizerte|gabès|gabes|kairouan/.test(hay)) return 'TN';
  if (/paris|lyon|marseille|lille|toulouse|bordeaux|nantes|france|île-de-france|ile-de-france/.test(hay)) return 'FR';
  if (/alger|oran|constantine|algérie|algerie/.test(hay)) return 'DZ';
  if (/casablanca|rabat|marrakech|tanger|maroc/.test(hay)) return 'MA';
  if (/bruxelles|anvers|liège|liege|gand|belgique/.test(hay)) return 'BE';
  if (/montréal|montreal|québec|quebec|toronto|ottawa|canada/.test(hay)) return 'CA';
  if (/dakar|sénégal|senegal/.test(hay)) return 'SN';
  if (/abidjan|yamoussoukro|côte d|cote d/.test(hay)) return 'CI';
  if (/europe|monde|golfe|international|afrique/.test(hay)) return 'INT';
  return 'FR'; // défaut neutre : ne plus forcer la Tunisie
}

const MARKET_STORAGE_KEY = 'ciblix.scout.marketCountry';

const EXAMPLE_BRIEFS = [
  "Je cherche des appels d'offres UNDP, UNIDO et UNGM (sites + LinkedIn) sur le bilan carbone",
  "Veille AO internationaux environnement sur les portails ONU et leurs pages LinkedIn",
  "Je cherche des appels d'offres bilan carbone et RSE en France",
  'Veille AO audit énergétique en Tunisie',
];

/** Portails AO internationaux (miroir backend). */
const WATCH_SITE_PRESETS: Array<{ id: string; shortLabel: string; org: string; kind: 'portal' | 'linkedin' }> = [
  { id: 'ungm', shortLabel: 'UNGM', org: 'ONU', kind: 'portal' },
  { id: 'undp', shortLabel: 'UNDP', org: 'ONU', kind: 'portal' },
  { id: 'unido', shortLabel: 'UNIDO', org: 'ONU', kind: 'portal' },
  { id: 'unops', shortLabel: 'UNOPS', org: 'ONU', kind: 'portal' },
  { id: 'unicef', shortLabel: 'UNICEF', org: 'ONU', kind: 'portal' },
  { id: 'worldbank', shortLabel: 'World Bank', org: 'Banque', kind: 'portal' },
  { id: 'afdb', shortLabel: 'AfDB', org: 'Banque', kind: 'portal' },
  { id: 'ted', shortLabel: 'TED Europa', org: 'UE', kind: 'portal' },
  { id: 'dgmarket', shortLabel: 'dgMarket', org: 'Agrégateur', kind: 'portal' },
  { id: 'li-undp', shortLabel: 'LI · UNDP', org: 'LinkedIn', kind: 'linkedin' },
  { id: 'li-unido', shortLabel: 'LI · UNIDO', org: 'LinkedIn', kind: 'linkedin' },
  { id: 'li-ungm', shortLabel: 'LI · UNGM', org: 'LinkedIn', kind: 'linkedin' },
  { id: 'li-unops', shortLabel: 'LI · UNOPS', org: 'LinkedIn', kind: 'linkedin' },
  { id: 'li-unicef', shortLabel: 'LI · UNICEF', org: 'LinkedIn', kind: 'linkedin' },
  { id: 'li-worldbank', shortLabel: 'LI · World Bank', org: 'LinkedIn', kind: 'linkedin' },
  { id: 'li-afdb', shortLabel: 'LI · AfDB', org: 'LinkedIn', kind: 'linkedin' },
];

type SetupView = 'converse' | 'review' | 'manual';

// ─── Helpers ───────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-500' : 'text-gray-400';
  return (
    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold', color,
      score >= 70 ? 'border-emerald-300 bg-emerald-50' : score >= 40 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
    )}>
      {score}
    </div>
  );
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function TagInput({
  label,
  tags,
  setTags,
  suggestions,
  placeholder,
  maxTags = 20,
}: {
  label: string;
  tags: string[];
  setTags: (t: string[] | ((prev: string[]) => string[])) => void;
  suggestions: string[];
  placeholder: string;
  maxTags?: number;
}) {
  const [inputValue, setInputValue] = useState('');

  const commit = (raw: string) => {
    const parts = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return false;
    setTags((prev) => {
      const next = [...prev];
      for (const part of parts) {
        if (!next.includes(part) && next.length < maxTags) next.push(part);
      }
      return next;
    });
    setInputValue('');
    return true;
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              e.stopPropagation();
              commit(inputValue);
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => commit(inputValue)}
          disabled={!inputValue.trim()}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-brand-soft/80 bg-white px-3 text-sm font-semibold text-brand-accent disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Écrivez un mot, puis cliquez <strong>Ajouter</strong> (ou Entrée). Les pastilles bleues doivent apparaître.
      </p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="ml-0.5 text-blue-400 hover:text-blue-700"
                aria-label={`Retirer ${tag}`}
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-700">Aucun tag pour l’instant.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        {suggestions
          .filter((s) => !tags.includes(s))
          .slice(0, 8)
          .map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => commit(s)}
              className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              + {s}
            </button>
          ))}
      </div>
    </div>
  );
}

// ─── Opportunity card ──────────────────────────────────────

function OpportunityCard({
  opp, onStatusChange, statusLoading,
}: {
  opp: Opportunity; onStatusChange: (id: string, status: OppStatus) => void; statusLoading: boolean;
}) {
  const catConfig = CATEGORY_CONFIG[opp.category];
  const CatIcon = catConfig.icon;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={opp.relevanceScore} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className={cn('mb-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', catConfig.bg, catConfig.color)}>
                  <CatIcon size={10} /> {catConfig.label}
                </span>
                <h3 className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{opp.title}</h3>
              </div>
              <div className="flex shrink-0 gap-1">
                {opp.status !== 'SAVED' && (
                  <button type="button" onClick={() => onStatusChange(opp.id, 'SAVED')} disabled={statusLoading}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:text-amber-600 hover:bg-amber-50" title="Sauvegarder">
                    <Bookmark size={16} />
                  </button>
                )}
                {opp.status === 'SAVED' && (
                  <button type="button" onClick={() => onStatusChange(opp.id, 'NEW')} disabled={statusLoading}
                    className="rounded-lg p-2 text-amber-600 bg-amber-50 transition-colors hover:text-amber-700" title="Retirer sauvegarde">
                    <BookmarkCheck size={16} />
                  </button>
                )}
                {opp.status !== 'APPLIED' && (
                  <button type="button" onClick={() => onStatusChange(opp.id, 'APPLIED')} disabled={statusLoading}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:text-emerald-600 hover:bg-emerald-50" title="Marquer traité">
                    <CheckCircle2 size={16} />
                  </button>
                )}
                {opp.status !== 'DISMISSED' && (
                  <button type="button" onClick={() => onStatusChange(opp.id, 'DISMISSED')} disabled={statusLoading}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-50" title="Ignorer">
                    <XCircle size={16} />
                  </button>
                )}
              </div>
            </div>

            {opp.aiSummary && (
              <p className="text-sm text-muted-foreground leading-relaxed">{opp.aiSummary}</p>
            )}
            {!opp.aiSummary && opp.snippet && (
              <p className="text-sm text-muted-foreground line-clamp-2">{opp.snippet}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {opp.deadline && (
                <span className="inline-flex items-center gap-1"><Calendar size={12} /> {opp.deadline}</span>
              )}
              {opp.location && (
                <span className="inline-flex items-center gap-1"><MapPin size={12} /> {opp.location}</span>
              )}
              {opp.budget && (
                <span className="inline-flex items-center gap-1"><Banknote size={12} /> {opp.budget}</span>
              )}
              <span className="inline-flex items-center gap-1"><Link2 size={12} /> {opp.source}</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {new Date(opp.createdAt).toLocaleDateString('fr-TN')}
              </span>
            </div>

            <a href={opp.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Voir la source <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ScoutAI() {
  const queryClient = useQueryClient();

  // ─── Profile state ───────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false); // legacy — remplacé par mainView
  const [mainView, setMainView] = useState<'opportunities' | 'mission' | 'analyzer'>('opportunities');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [geoZones, setGeoZones] = useState<string[]>([]);
  const [market, setMarket] = useState<MarketId>(() => {
    try {
      const stored = localStorage.getItem(MARKET_STORAGE_KEY) as MarketId | null;
      if (stored && MARKETS.some((m) => m.id === stored)) return stored;
    } catch {
      /* ignore */
    }
    return 'FR';
  });
  const [tenderEnabled, setTenderEnabled] = useState(true);
  const [eventEnabled, setEventEnabled] = useState(true);
  const [newsEnabled, setNewsEnabled] = useState(true);
  const [watchSites, setWatchSites] = useState<string[]>([]);
  const [linkedinUrlDraft, setLinkedinUrlDraft] = useState('');
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [scanIntervalH, setScanIntervalH] = useState(24);
  const [alertEmailEnabled, setAlertEmailEnabled] = useState(true);
  const [alertMinScore, setAlertMinScore] = useState(70);
  const [setupView, setSetupView] = useState<SetupView>('converse');
  const [briefText, setBriefText] = useState('');
  const [missionTitle, setMissionTitle] = useState('');
  const [missionSummary, setMissionSummary] = useState('');

  // ─── Tab / filter state ──────────────────────────────────
  const [activeTab, setActiveTab] = useState<Category | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<OppStatus | 'ALL'>('ALL');
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  // showAnalyzer removed — onglet analyzer

  // ─── Queries ─────────────────────────────────────────────

  const profileQuery = useQuery({
    queryKey: ['scout-profile'],
    queryFn: () => api.get('/scout-ai/profile').then((r) => r.data.profile as ScoutProfile | null),
  });

  const statsQuery = useQuery({
    queryKey: ['scout-stats'],
    queryFn: () => api.get('/scout-ai/stats').then((r) => r.data as Stats),
    refetchInterval: 60000,
  });

  const opportunitiesQuery = useQuery({
    queryKey: ['scout-opportunities', activeTab, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeTab !== 'ALL') params.set('category', activeTab);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      params.set('limit', '100');
      return api.get(`/scout-ai/opportunities?${params}`).then((r) => r.data as {
        opportunities: Opportunity[];
        total: number;
        categoryCounts: Record<string, number>;
        statusCounts: Record<string, number>;
      });
    },
  });

  // Sync profile to local state once when loaded (ne pas écraser les tags en cours d'édition)
  const profileHydratedRef = useRef(false);
  useEffect(() => {
    if (!profileQuery.data || profileHydratedRef.current) return;
    profileHydratedRef.current = true;
    const zones = normalizeTags(profileQuery.data.geoZones);
    setKeywords(normalizeTags(profileQuery.data.keywords));
    setSectors(normalizeTags(profileQuery.data.sectors));
    setGeoZones(zones);
    setTenderEnabled(profileQuery.data.tenderEnabled);
    setEventEnabled(profileQuery.data.eventEnabled);
    setNewsEnabled(profileQuery.data.newsEnabled);
    setWatchSites(normalizeTags(profileQuery.data.watchSites));
    setAutoScanEnabled(profileQuery.data.autoScanEnabled ?? true);
    setScanIntervalH(profileQuery.data.scanIntervalH ?? 24);
    setAlertEmailEnabled(profileQuery.data.alertEmailEnabled !== false);
    setAlertMinScore(profileQuery.data.alertMinScore ?? 70);
    const inferred = inferMarketFromZones(zones);
    setMarket(inferred);
    try {
      localStorage.setItem(MARKET_STORAGE_KEY, inferred);
    } catch {
      /* ignore */
    }
  }, [profileQuery.data]);

  const selectMarket = (id: MarketId) => {
    setMarket(id);
    const meta = MARKETS.find((m) => m.id === id);
    // Changer de pays = nouvelles zones (évite Tunis sous Algérie) + reset onglet
    setGeoZones(meta?.countryLabel ? [meta.countryLabel] : []);
    setActiveTab('ALL');
    try {
      localStorage.setItem(MARKET_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const zoneSuggestions = ZONES_BY_MARKET[market] || ZONES_BY_MARKET.FR;
  const marketMeta = MARKETS.find((m) => m.id === market) || MARKETS[0];

  // Auto-open mission tab if no profile exists
  useEffect(() => {
    if (profileQuery.isSuccess && !profileQuery.data) {
      setMainView('mission');
      setSetupView('converse');
    }
  }, [profileQuery.isSuccess, profileQuery.data]);

  // Sync legacy profileOpen helpers
  useEffect(() => {
    setProfileOpen(mainView === 'mission');
  }, [mainView]);

  // ─── Mutations ───────────────────────────────────────────

  const applyProposal = (proposal: {
    missionTitle?: string;
    summary?: string;
    marketCountry?: string;
    geoZones?: string[];
    keywords?: string[];
    sectors?: string[];
    tenderEnabled?: boolean;
    eventEnabled?: boolean;
    newsEnabled?: boolean;
    watchSites?: string[];
  }) => {
    const mid = (proposal.marketCountry || 'FR').toUpperCase() as MarketId;
    const marketId = MARKETS.some((m) => m.id === mid) ? mid : (mid === 'INT' ? 'INT' : 'FR');
    setMarket(marketId);
    try {
      localStorage.setItem(MARKET_STORAGE_KEY, marketId);
    } catch { /* ignore */ }
    setKeywords(normalizeTags(proposal.keywords));
    setSectors(normalizeTags(proposal.sectors));
    setGeoZones(normalizeTags(proposal.geoZones));
    setWatchSites(normalizeTags(proposal.watchSites));
    setTenderEnabled(proposal.tenderEnabled !== false);
    setEventEnabled(Boolean(proposal.eventEnabled));
    setNewsEnabled(Boolean(proposal.newsEnabled));
    setMissionTitle(proposal.missionTitle || 'Mission de veille');
    setMissionSummary(proposal.summary || '');
    setSetupView('review');
  };

  const interpretBriefMutation = useMutation({
    mutationFn: (brief: string) =>
      api.post('/scout-ai/interpret-brief', { brief }).then((r) => r.data as {
        proposal: {
          missionTitle: string;
          summary: string;
          marketCountry: string;
          geoZones: string[];
          keywords: string[];
          sectors: string[];
          watchSites: string[];
          tenderEnabled: boolean;
          eventEnabled: boolean;
          newsEnabled: boolean;
        };
      }),
    onSuccess: (data) => {
      if (data.proposal) applyProposal(data.proposal);
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: () => {
      const country = marketMeta.countryLabel;
      const zones =
        country && !geoZones.some((z) => z.toLowerCase().includes(country.toLowerCase()))
          ? [...geoZones, country]
          : geoZones;
      return api.post('/scout-ai/profile', {
        keywords,
        sectors,
        geoZones: zones,
        watchSites,
        tenderEnabled,
        eventEnabled,
        newsEnabled,
        autoScanEnabled,
        scanIntervalH,
        alertEmailEnabled,
        alertMinScore,
        marketCountry: market,
      });
    },
    onSuccess: (res) => {
      const saved = res.data?.profile as ScoutProfile | undefined;
      if (saved) {
        profileHydratedRef.current = true;
        setKeywords(normalizeTags(saved.keywords));
        setSectors(normalizeTags(saved.sectors));
        setGeoZones(normalizeTags(saved.geoZones));
        setWatchSites(normalizeTags(saved.watchSites));
        setTenderEnabled(saved.tenderEnabled);
        setEventEnabled(saved.eventEnabled);
        setNewsEnabled(saved.newsEnabled);
        setAutoScanEnabled(saved.autoScanEnabled ?? true);
        setScanIntervalH(saved.scanIntervalH ?? 24);
        setAlertEmailEnabled(saved.alertEmailEnabled !== false);
        setAlertMinScore(saved.alertMinScore ?? 70);
      }
      void queryClient.invalidateQueries({ queryKey: ['scout-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
    },
  });

  const persistProfile = async () => {
    const country = marketMeta.countryLabel;
    const zones =
      country && !geoZones.some((z) => z.toLowerCase().includes(country.toLowerCase()))
        ? [...geoZones, country]
        : geoZones;
    await api.post('/scout-ai/profile', {
      keywords,
      sectors,
      geoZones: zones,
      watchSites,
      tenderEnabled,
      eventEnabled,
      newsEnabled,
      autoScanEnabled,
      scanIntervalH,
      alertEmailEnabled,
      alertMinScore,
      marketCountry: market,
    });
    void queryClient.invalidateQueries({ queryKey: ['scout-profile'] });
    void queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
  };

  const activateAgentMutation = useMutation({
    mutationFn: async () => {
      await persistProfile();
      return api.post('/scout-ai/scan-all').then((r) => r.data);
    },
    onSuccess: () => {
      setMainView('opportunities');
      setSetupView('converse');
      void queryClient.invalidateQueries({ queryKey: ['scout-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
      void queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (category: Category) => {
      if (keywords.length > 0) await persistProfile();
      return api.post('/scout-ai/scan', { category }).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: async () => {
      if (keywords.length > 0) await persistProfile();
      return api.post('/scout-ai/scan-all').then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OppStatus }) =>
      api.patch(`/scout-ai/opportunities/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    },
  });

  const analyzeUrlMutation = useMutation({
    mutationFn: (params: { url: string; context?: string }) =>
      api.post('/scout-ai/analyze-url', params).then((r) => r.data as { url: string; analysis: UrlAnalysis }),
  });

  // ─── Derived ─────────────────────────────────────────────
  const hasProfile = !!profileQuery.data;
  const isScanning = scanMutation.isPending || scanAllMutation.isPending;
  const opportunities = opportunitiesQuery.data?.opportunities || [];
  const catCounts = opportunitiesQuery.data?.categoryCounts || {};
  const statusCounts = opportunitiesQuery.data?.statusCounts || {};
  const stats = statsQuery.data;
  const enabledCategories = (opportunitiesQuery.data as { enabledCategories?: Category[] } | undefined)?.enabledCategories
    ?? ([
      ...(tenderEnabled ? (['TENDER'] as const) : []),
      ...(eventEnabled ? (['EVENT'] as const) : []),
      ...(newsEnabled ? (['NEWS'] as const) : []),
    ] as Category[]);
  const visibleCategories = (['TENDER', 'EVENT', 'NEWS'] as const).filter((c) =>
    enabledCategories.includes(c),
  );
  const totalAll = visibleCategories.reduce((sum, c) => sum + (catCounts[c] || 0), 0);

  useEffect(() => {
    if (activeTab === 'ALL') return;
    if (!visibleCategories.includes(activeTab as Category)) {
      setActiveTab(visibleCategories.length === 1 ? visibleCategories[0] : 'ALL');
    }
  }, [activeTab, visibleCategories]);

  return (
    <div className="relative min-h-[70vh]">
      {/* Atmosphere légère — marque bleue, pas de mauve */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-56 bg-[radial-gradient(ellipse_at_top,_rgba(1,106,235,0.10),_transparent_65%)]"
      />

      <div className="relative space-y-6">
      {/* Header agent */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#016AEB]">Agent IA</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Veilleur</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Surveille les AO et sources choisies, filtre le bruit, alerte sur les pistes utiles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasProfile && (
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              autoScanEnabled
                ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', autoScanEnabled ? 'bg-emerald-500' : 'bg-slate-400')} />
              {autoScanEnabled ? `Actif · scan ${scanIntervalH}h` : 'Mission en pause'}
            </span>
          )}
          {hasProfile && (
            <Button
              size="sm"
              className="gap-1.5 bg-[#016AEB] hover:bg-[#0158c7]"
              onClick={() => scanAllMutation.mutate()}
              disabled={isScanning}
            >
              {scanAllMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
              Lancer un scan
            </Button>
          )}
        </div>
      </div>

      {/* Onglets principaux — la page opportunités reste centrale */}
      <div className="flex gap-1 border-b border-slate-200">
        {([
          { id: 'opportunities' as const, label: 'Opportunités', show: true },
          { id: 'mission' as const, label: hasProfile ? 'Mission' : 'Briefer l’agent', show: true },
          { id: 'analyzer' as const, label: 'Analyser une URL', show: true },
        ]).filter((t) => t.show).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMainView(tab.id);
              if (tab.id === 'mission') setSetupView(hasProfile && keywords.length ? 'review' : 'converse');
            }}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              mainView === tab.id
                ? 'border-[#016AEB] text-[#016AEB]'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            {tab.label}
            {tab.id === 'opportunities' && hasProfile ? ` (${totalAll})` : ''}
          </button>
        ))}
      </div>

      {/* Status strip — visible sur l’onglet opportunités */}
      {stats && hasProfile && mainView === 'opportunities' && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
          <span><strong className="text-slate-900">{stats.total}</strong> opportunités</span>
          <span><strong className="text-slate-900">{stats.newCount}</strong> nouvelles</span>
          <span><strong className="text-slate-900">{stats.savedCount}</strong> sauvegardées</span>
          <span className="text-slate-400">
            Dernier scan · {stats.lastScanAt
              ? new Date(stats.lastScanAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'jamais'}
          </span>
        </div>
      )}

      {/* Onglet Mission */}
      {mainView === 'mission' && (
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {hasProfile ? 'Ajuster la mission' : 'Briefer le Veilleur'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Une phrase claire suffit. L&apos;agent en déduit les sources, le marché et les mots-clés — vous validez avant activation.
            </p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Votre brief</label>
            <textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              rows={4}
              placeholder="Ex. : Surveille les appels d’offres UNDP, UNIDO et UNGM (sites + LinkedIn) sur bilan carbone et ESG."
              className="w-full resize-none border-0 border-b border-slate-200 bg-transparent px-0 py-2 text-base leading-relaxed text-slate-900 placeholder:text-slate-300 focus:border-[#016AEB] focus:outline-none focus:ring-0"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_BRIEFS.slice(0, 2).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setBriefText(ex)}
                    className="max-w-full truncate text-left text-xs text-slate-400 transition-colors hover:text-[#016AEB]"
                  >
                    {ex.length > 72 ? `${ex.slice(0, 72)}…` : ex}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                className="gap-1.5 bg-[#016AEB] hover:bg-[#0158c7]"
                disabled={briefText.trim().length < 8 || interpretBriefMutation.isPending}
                onClick={() => interpretBriefMutation.mutate(briefText.trim())}
              >
                {interpretBriefMutation.isPending
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Sparkles size={14} />}
                Analyser
              </Button>
            </div>
            {interpretBriefMutation.isError && (
              <p className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle size={14} /> Impossible d&apos;analyser le brief. Réessayez.
              </p>
            )}
          </div>

          {(setupView === 'review' || setupView === 'manual' || keywords.length > 0) && (
            <div className="space-y-6 border-t border-slate-200 pt-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#016AEB]">Proposition de l&apos;agent</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  {missionTitle || 'Mission de veille'}
                </h3>
                {missionSummary && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{missionSummary}</p>
                )}
              </div>

              <dl className="grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">À surveiller</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {([
                      { key: 'tender' as const, label: "Appels d'offres", on: tenderEnabled, set: setTenderEnabled },
                      { key: 'event' as const, label: 'Événements', on: eventEnabled, set: setEventEnabled },
                      { key: 'news' as const, label: 'Actualités', on: newsEnabled, set: setNewsEnabled },
                    ]).map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => c.set(!c.on)}
                        className={cn(
                          'border-b-2 pb-0.5 text-sm transition-colors',
                          c.on
                            ? 'border-[#016AEB] font-medium text-slate-900'
                            : 'border-transparent text-slate-300 line-through',
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Marché</dt>
                  <dd className="mt-2">
                    <Select value={market} onValueChange={(v) => selectMarket(v as MarketId)}>
                      <SelectTrigger className="h-9 w-full max-w-xs border-slate-200 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARKETS.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Mots-clés</dt>
                  <dd className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-800">
                    {keywords.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1">
                        {k}
                        <button type="button" className="text-slate-300 hover:text-slate-600" onClick={() => setKeywords((p) => p.filter((x) => x !== k))}>&times;</button>
                      </span>
                    ))}
                  </dd>
                </div>
                {sectors.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-wider text-slate-400">Secteurs</dt>
                    <dd className="mt-2 text-sm text-slate-700">{sectors.join(' · ')}</dd>
                  </div>
                )}
              </dl>

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Sources prioritaires</p>
                <div className="flex flex-wrap gap-2">
                  {WATCH_SITE_PRESETS.filter((s) => s.kind === 'portal').map((site) => {
                    const on = watchSites.includes(site.id);
                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() =>
                          setWatchSites((prev) =>
                            on ? prev.filter((id) => id !== site.id) : [...prev, site.id],
                          )
                        }
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          on ? 'bg-[#016AEB] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                        )}
                      >
                        {site.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <p className="pt-1 text-xs font-medium uppercase tracking-wider text-slate-400">Pages LinkedIn</p>
                <div className="flex flex-wrap gap-2">
                  {WATCH_SITE_PRESETS.filter((s) => s.kind === 'linkedin').map((site) => {
                    const on = watchSites.includes(site.id);
                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() =>
                          setWatchSites((prev) =>
                            on ? prev.filter((id) => id !== site.id) : [...prev, site.id],
                          )
                        }
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
                        )}
                      >
                        {site.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-1">
                  <input
                    type="url"
                    value={linkedinUrlDraft}
                    onChange={(e) => setLinkedinUrlDraft(e.target.value)}
                    placeholder="Coller une URL linkedin.com/company/…"
                    className="min-w-0 flex-1 border-0 border-b border-slate-200 bg-transparent py-1.5 text-sm focus:border-[#016AEB] focus:outline-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[#016AEB]"
                    disabled={!/linkedin\.com\/company\//i.test(linkedinUrlDraft)}
                    onClick={() => {
                      const url = linkedinUrlDraft.trim();
                      if (!url) return;
                      setWatchSites((prev) => (prev.includes(url) ? prev : [...prev, url]));
                      setLinkedinUrlDraft('');
                    }}
                  >
                    Ajouter
                  </Button>
                </div>
                {watchSites.length === 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-[#016AEB] hover:underline"
                    onClick={() => setWatchSites(['ungm', 'undp', 'unido', 'li-undp', 'li-unido', 'li-ungm'])}
                  >
                    Préremplir ONU (UNDP + UNIDO + UNGM)
                  </button>
                )}
              </div>

              <button
                type="button"
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-slate-700"
                onClick={() => setSetupView(setupView === 'manual' ? 'review' : 'manual')}
              >
                {setupView === 'manual' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Ajuster mots-clés / zones
              </button>
              {setupView === 'manual' && (
                <div className="space-y-4 border border-slate-200 p-4">
                  <TagInput label="Mots-clés" tags={keywords} setTags={setKeywords} suggestions={SUGGESTED_KEYWORDS} placeholder="Ajouter…" />
                  <TagInput label="Secteurs" tags={sectors} setTags={setSectors} suggestions={SUGGESTED_SECTORS} placeholder="Ajouter…" maxTags={10} />
                  <TagInput label={`Zones (${marketMeta.label})`} tags={geoZones} setTags={setGeoZones} suggestions={zoneSuggestions} placeholder="Ville…" maxTags={10} />
                </div>
              )}

              <div className="space-y-4 border-t border-slate-200 pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="rounded border-slate-300 text-[#016AEB]" checked={autoScanEnabled} onChange={(e) => setAutoScanEnabled(e.target.checked)} />
                    Scan automatique
                    {autoScanEnabled && (
                      <select value={scanIntervalH} onChange={(e) => setScanIntervalH(Number(e.target.value))} className="ml-1 rounded border border-slate-200 px-2 py-0.5 text-xs">
                        <option value={6}>6 h</option>
                        <option value={12}>12 h</option>
                        <option value={24}>24 h</option>
                        <option value={48}>48 h</option>
                      </select>
                    )}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" className="rounded border-slate-300 text-[#016AEB]" checked={alertEmailEnabled} onChange={(e) => setAlertEmailEnabled(e.target.checked)} />
                    Alerte email
                    {alertEmailEnabled && (
                      <select value={alertMinScore} onChange={(e) => setAlertMinScore(Number(e.target.value))} className="ml-1 rounded border border-slate-200 px-2 py-0.5 text-xs">
                        <option value={50}>≥ 50</option>
                        <option value={60}>≥ 60</option>
                        <option value={70}>≥ 70</option>
                        <option value={80}>≥ 80</option>
                      </select>
                    )}
                  </label>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    size="lg"
                    className="gap-2 bg-[#016AEB] hover:bg-[#0158c7]"
                    disabled={keywords.length === 0 || activateAgentMutation.isPending}
                    onClick={() => activateAgentMutation.mutate()}
                  >
                    {activateAgentMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Activer l&apos;agent
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={keywords.length === 0 || saveProfileMutation.isPending}
                    onClick={() => {
                      saveProfileMutation.mutate();
                      setMainView('opportunities');
                    }}
                  >
                    Enregistrer sans scanner
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Onglet Analyser URL */}
      {mainView === 'analyzer' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 size={16} /> Analyser une URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input
                type="url" value={analyzeUrl} onChange={(e) => setAnalyzeUrl(e.target.value)}
                placeholder="https://www.ungm.org/… ou boamp.fr/…"
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                onClick={() => analyzeUrlMutation.mutate({ url: analyzeUrl })}
                disabled={!analyzeUrl.trim() || analyzeUrlMutation.isPending}
                variant="outline" className="gap-1.5"
              >
                {analyzeUrlMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Analyser
              </Button>
            </div>
            {analyzeUrlMutation.data?.analysis && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                      CATEGORY_CONFIG[analyzeUrlMutation.data.analysis.type as Category]?.bg || 'bg-gray-50 border-gray-200',
                      CATEGORY_CONFIG[analyzeUrlMutation.data.analysis.type as Category]?.color || 'text-gray-700',
                    )}>
                      {analyzeUrlMutation.data.analysis.type}
                    </span>
                    <h4 className="font-semibold text-sm">{analyzeUrlMutation.data.analysis.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{analyzeUrlMutation.data.analysis.summary}</p>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Onglet Opportunités — page principale */}
      {mainView === 'opportunities' && (
        <>
          {!hasProfile && profileQuery.isSuccess && (
            <div className="border border-dashed border-slate-200 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Aucune mission active</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
                Briefez l&apos;agent pour commencer la veille, puis les opportunités apparaîtront ici.
              </p>
              <Button
                className="mt-4 gap-1.5 bg-[#016AEB] hover:bg-[#0158c7]"
                onClick={() => {
                  setSetupView('converse');
                  setMainView('mission');
                }}
              >
                <MessageSquare size={14} /> Briefer l&apos;agent
              </Button>
            </div>
          )}

          {hasProfile && (
            <>
          {/* Mission strip compact */}
          <div className="flex flex-col gap-2 border-l-2 border-[#016AEB] pl-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{missionTitle || 'Mission en cours'}</p>
              <p className="truncate text-xs text-slate-500">
                {marketMeta.label}
                {watchSites.length > 0
                  ? ` · ${watchSites.slice(0, 4).map((id) => WATCH_SITE_PRESETS.find((s) => s.id === id)?.shortLabel || id).join(', ')}`
                  : ''}
                {keywords.length > 0 ? ` · ${keywords.slice(0, 4).join(', ')}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-sm font-medium text-[#016AEB] hover:underline"
              onClick={() => {
                setSetupView(keywords.length ? 'review' : 'converse');
                setMainView('mission');
              }}
            >
              Modifier la mission
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button" onClick={() => setActiveTab('ALL')}
                className={cn('rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  activeTab === 'ALL' ? 'border-slate-400 bg-slate-100 text-foreground' : 'border-slate-200 text-muted-foreground hover:bg-slate-50'
                )}
              >
                Tout ({totalAll})
              </button>
              {visibleCategories.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const count = catCounts[cat] || 0;
                const CatIcon = config.icon;
                return (
                  <button
                    key={cat} type="button" onClick={() => setActiveTab(cat)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                      activeTab === cat ? `${config.bg} ${config.color}` : 'border-slate-200 text-muted-foreground hover:bg-slate-50'
                    )}
                  >
                    <CatIcon size={12} /> {config.label} ({count})
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); scanMutation.mutate(cat); }}
                      disabled={isScanning}
                      className="ml-1 rounded-full p-0.5 hover:bg-white/60 transition-colors"
                      title={config.scanLabel}
                    >
                      {scanMutation.isPending && scanMutation.variables === cat
                        ? <Loader2 size={11} className="animate-spin" />
                        : <RefreshCw size={11} />
                      }
                    </button>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1">
              {(['ALL', 'NEW', 'SAVED', 'APPLIED', 'DISMISSED'] as const).map((s) => {
                const cfg = s === 'ALL' ? { label: 'Tout', color: 'text-foreground', icon: Eye } : STATUS_CONFIG[s];
                const count = s === 'ALL' ? totalAll : (statusCounts[s] || 0);
                return (
                  <button
                    key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      statusFilter === s ? 'bg-slate-100 text-foreground' : 'text-muted-foreground hover:bg-slate-50'
                    )}
                  >
                    {cfg.label}
                    {count > 0 && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scan feedback */}
          {(scanMutation.isSuccess || scanAllMutation.isSuccess) && (
            <div
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center',
                (scanAllMutation.data?.newOpportunities || scanMutation.data?.meta?.totalSaved || 0) > 0
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              )}
            >
              <div className="flex items-start gap-2 flex-1">
                {(scanAllMutation.data?.newOpportunities || scanMutation.data?.meta?.totalSaved || 0) > 0 ? (
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                )}
                <span>
                  {scanAllMutation.isSuccess
                    ? `Scan terminé — ${scanAllMutation.data?.newOpportunities || 0} nouvelle(s) · ${scanAllMutation.data?.totalRaw ?? 0} source(s) trouvée(s).`
                    : `Scan terminé — ${scanMutation.data?.meta?.totalSaved || 0} opportunité(s) (sources brutes : ${scanMutation.data?.meta?.totalRaw ?? '—'}).`}
                  {(scanAllMutation.data?.newOpportunities || scanMutation.data?.meta?.totalSaved || 0) === 0
                    ? ' Vos choix n’ont pas été effacés. Élargissez mots-clés / zones, ou changez de marché.'
                    : null}
                </span>
              </div>
              {(scanAllMutation.data?.newOpportunities || scanMutation.data?.meta?.totalSaved || 0) === 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-amber-300 bg-white"
                  onClick={() => setMainView('mission')}
                >
                  Modifier la mission
                </Button>
              ) : null}
            </div>
          )}

          {/* Scan error */}
          {(scanMutation.isError || scanAllMutation.isError) && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} /> Erreur lors du scan. Vérifiez votre configuration et réessayez.
            </div>
          )}

          {/* Loading */}
          {(opportunitiesQuery.isLoading || isScanning) && (
            <div className="py-12 text-center">
              <Loader2 size={28} className="mx-auto mb-3 animate-spin text-blue-500" />
              <p className="text-sm text-muted-foreground">
                {isScanning ? 'Scan en cours — analyse des sources...' : 'Chargement des opportunités...'}
              </p>
            </div>
          )}

          {/* Opportunities list */}
          {!opportunitiesQuery.isLoading && !isScanning && opportunities.length > 0 && (
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opp={opp}
                  onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                  statusLoading={statusMutation.isPending}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!opportunitiesQuery.isLoading && !isScanning && opportunities.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Search size={40} className="mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="font-semibold text-foreground">Aucune opportunité pour ce scan</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  Le profil n’a pas été supprimé. Cliquez sur <strong>Modifier mes choix</strong> pour changer pays,
                  villes ou mots-clés, puis relancez un scan.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button type="button" variant="outline" className="gap-1.5" onClick={() => setMainView('mission')}>
                    <Settings2 size={14} /> Modifier la mission
                  </Button>
                  <Button
                    type="button"
                    className="gap-1.5"
                    onClick={() => scanAllMutation.mutate()}
                    disabled={isScanning}
                  >
                    <ScanLine size={14} /> Relancer le scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
            </>
          )}
        </>
      )}
      </div>
    </div>
  );
}
