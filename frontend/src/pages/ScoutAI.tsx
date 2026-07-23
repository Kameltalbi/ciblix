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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────

type Category = 'TENDER' | 'EVENT' | 'NEWS';
type OppStatus = 'NEW' | 'SAVED' | 'DISMISSED' | 'APPLIED';

interface ScoutProfile {
  id: string;
  keywords: string[];
  sectors: string[];
  geoZones: string[];
  tenderEnabled: boolean;
  eventEnabled: boolean;
  newsEnabled: boolean;
  autoScanEnabled: boolean;
  scanIntervalH: number;
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
  'bilan carbone', 'environnement', 'formation professionnelle', 'conseil',
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
  const [profileOpen, setProfileOpen] = useState(false);
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

  // ─── Tab / filter state ──────────────────────────────────
  const [activeTab, setActiveTab] = useState<Category | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<OppStatus | 'ALL'>('ALL');
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [showAnalyzer, setShowAnalyzer] = useState(false);

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
    try {
      localStorage.setItem(MARKET_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const zoneSuggestions = ZONES_BY_MARKET[market] || ZONES_BY_MARKET.FR;
  const marketMeta = MARKETS.find((m) => m.id === market) || MARKETS[0];

  // Auto-open profile config if no profile exists
  useEffect(() => {
    if (profileQuery.isSuccess && !profileQuery.data) {
      setProfileOpen(true);
    }
  }, [profileQuery.isSuccess, profileQuery.data]);

  // ─── Mutations ───────────────────────────────────────────

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
        tenderEnabled,
        eventEnabled,
        newsEnabled,
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
      }
      void queryClient.invalidateQueries({ queryKey: ['scout-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    },
  });

  const scanMutation = useMutation({
    mutationFn: (category: Category) => api.post('/scout-ai/scan', { category }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['scout-stats'] });
    },
  });

  const scanAllMutation = useMutation({
    mutationFn: () => api.post('/scout-ai/scan-all').then((r) => r.data),
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
  const totalAll = (catCounts['TENDER'] || 0) + (catCounts['EVENT'] || 0) + (catCounts['NEWS'] || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200">
            <Radar size={22} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scout AI</h1>
            <p className="text-sm text-muted-foreground">Veille & détection d'opportunités</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAnalyzer(!showAnalyzer)}>
            <Link2 size={14} /> Analyser URL
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setProfileOpen(!profileOpen)}>
            <Settings2 size={14} /> Profil
            {profileOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          {hasProfile && (
            <Button
              size="sm" className="gap-1.5"
              onClick={() => scanAllMutation.mutate()}
              disabled={isScanning}
            >
              {scanAllMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
              Scanner tout
            </Button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {stats && hasProfile && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total opportunités</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
                </div>
                <BarChart3 size={20} className="text-blue-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Nouvelles</p>
                  <p className="text-2xl font-bold text-emerald-700">{stats.newCount}</p>
                </div>
                <TrendingUp size={20} className="text-emerald-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Sauvegardées</p>
                  <p className="text-2xl font-bold text-amber-700">{stats.savedCount}</p>
                </div>
                <Bookmark size={20} className="text-amber-300" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-gray-100">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Dernier scan</p>
                  <p className="text-sm font-semibold text-foreground">
                    {stats.lastScanAt ? new Date(stats.lastScanAt).toLocaleString('fr-TN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Jamais'}
                  </p>
                </div>
                <Clock size={20} className="text-gray-300" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Profile config (collapsible) */}
      {profileOpen && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 size={16} /> Profil de veille
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <TagInput
              label="Mots-clés métier" tags={keywords} setTags={setKeywords}
              suggestions={SUGGESTED_KEYWORDS} placeholder="Ex: bilan carbone, formation..."
            />
            <TagInput
              label="Secteurs d'activité" tags={sectors} setTags={setSectors}
              suggestions={SUGGESTED_SECTORS} placeholder="Ex: IT & Digital, BTP..." maxTags={10}
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">Pays / marché à surveiller</label>
              <p className="text-xs text-muted-foreground">
                Choisissez où chercher les opportunités — indépendamment de votre localisation. Vous pouvez surveiller la
                France depuis la Tunisie, ou l’inverse.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MARKETS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMarket(m.id)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      market === m.id
                        ? 'border-blue-400 bg-blue-100 text-blue-800'
                        : 'border-gray-200 bg-white text-muted-foreground hover:border-blue-200 hover:text-blue-700'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <TagInput
              label={`Zones dans ${marketMeta.label}`}
              tags={geoZones}
              setTags={setGeoZones}
              suggestions={zoneSuggestions}
              placeholder={`Ex: ville ou région en ${marketMeta.label}…`}
              maxTags={10}
            />

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Catégories à surveiller</label>
              <div className="flex flex-wrap gap-3">
                {([
                  { key: 'tender', label: "Appels d'offres", icon: FileText, enabled: tenderEnabled, toggle: setTenderEnabled },
                  { key: 'event', label: 'Événements', icon: PartyPopper, enabled: eventEnabled, toggle: setEventEnabled },
                  { key: 'news', label: 'Actualités', icon: Newspaper, enabled: newsEnabled, toggle: setNewsEnabled },
                ] as const).map((cat) => (
                  <button
                    key={cat.key} type="button" onClick={() => cat.toggle(!cat.enabled)}
                    className={cn('flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all',
                      cat.enabled ? 'border-blue-300 bg-blue-100 text-blue-800' : 'border-gray-200 bg-white text-gray-400'
                    )}
                  >
                    <cat.icon size={16} /> {cat.label}
                    {cat.enabled ? <CheckCircle2 size={14} className="text-blue-600" /> : <XCircle size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                onClick={() => saveProfileMutation.mutate()}
                disabled={keywords.length === 0 || saveProfileMutation.isPending}
                className="gap-1.5"
              >
                {saveProfileMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Sauvegarder le profil
              </Button>
              {keywords.length === 0 ? (
                <span className="text-sm text-amber-700">
                  Ajoutez au moins 1 mot-clé (Entrée ou +) pour pouvoir sauvegarder.
                </span>
              ) : null}
              {saveProfileMutation.isSuccess && (
                <span className="flex items-center gap-1 text-sm text-emerald-600">
                  <CheckCircle2 size={14} /> Profil sauvegardé — vous pouvez lancer un scan
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* URL Analyzer (collapsible) */}
      {showAnalyzer && (
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
                placeholder="https://www.marchespublics.gov.tn/..."
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
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {analyzeUrlMutation.data.analysis.deadline && (
                      <span className="inline-flex items-center gap-1"><Calendar size={12} /> {analyzeUrlMutation.data.analysis.deadline}</span>
                    )}
                    {analyzeUrlMutation.data.analysis.location && (
                      <span className="inline-flex items-center gap-1"><MapPin size={12} /> {analyzeUrlMutation.data.analysis.location}</span>
                    )}
                    {analyzeUrlMutation.data.analysis.budget && (
                      <span className="inline-flex items-center gap-1"><Banknote size={12} /> {analyzeUrlMutation.data.analysis.budget}</span>
                    )}
                  </div>
                  {analyzeUrlMutation.data.analysis.organizer && (
                    <p className="text-xs"><strong>Organisme:</strong> {analyzeUrlMutation.data.analysis.organizer}</p>
                  )}
                  {analyzeUrlMutation.data.analysis.relevance && (
                    <p className="text-xs"><strong>Pertinence:</strong> {analyzeUrlMutation.data.analysis.relevance}</p>
                  )}
                  {analyzeUrlMutation.data.analysis.actionItems?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">Actions recommandées:</p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                        {analyzeUrlMutation.data.analysis.actionItems.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* No profile empty state */}
      {!hasProfile && !profileOpen && profileQuery.isSuccess && (
        <Card className="border-dashed border-2 border-blue-200">
          <CardContent className="py-12 text-center">
            <Settings2 size={40} className="mx-auto mb-3 text-blue-300" />
            <h3 className="text-lg font-semibold text-foreground">Configurez votre profil de veille</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              Définissez vos mots-clés, secteurs et zones géographiques pour que Scout AI détecte les opportunités pertinentes.
            </p>
            <Button className="mt-4 gap-1.5" onClick={() => setProfileOpen(true)}>
              <Settings2 size={14} /> Créer mon profil
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main content: tabs + opportunities */}
      {hasProfile && (
        <>
          {/* Category tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button" onClick={() => setActiveTab('ALL')}
                className={cn('rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                  activeTab === 'ALL' ? 'border-gray-400 bg-gray-100 text-foreground' : 'border-gray-200 text-muted-foreground hover:bg-gray-50'
                )}
              >
                Tout ({totalAll})
              </button>
              {(['TENDER', 'EVENT', 'NEWS'] as const).map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const count = catCounts[cat] || 0;
                const CatIcon = config.icon;
                return (
                  <button
                    key={cat} type="button" onClick={() => setActiveTab(cat)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                      activeTab === cat ? `${config.bg} ${config.color}` : 'border-gray-200 text-muted-foreground hover:bg-gray-50'
                    )}
                  >
                    <CatIcon size={12} /> {config.label} ({count})
                    {hasProfile && (
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
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status filter */}
            <div className="flex gap-1">
              {(['ALL', 'NEW', 'SAVED', 'APPLIED', 'DISMISSED'] as const).map((s) => {
                const cfg = s === 'ALL' ? { label: 'Tout', color: 'text-foreground', icon: Eye } : STATUS_CONFIG[s];
                const count = s === 'ALL' ? totalAll : (statusCounts[s] || 0);
                return (
                  <button
                    key={s} type="button" onClick={() => setStatusFilter(s)}
                    className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      statusFilter === s ? 'bg-gray-100 text-foreground' : 'text-muted-foreground hover:bg-gray-50'
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
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              {scanAllMutation.isSuccess
                ? `Scan complet terminé — ${scanAllMutation.data?.newOpportunities || 0} nouvelles opportunités détectées`
                : `Scan terminé — ${scanMutation.data?.meta?.totalSaved || 0} opportunités`
              }
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
                <h3 className="font-semibold text-foreground">Aucune opportunité détectée</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                  Lancez un scan pour détecter les appels d'offres, événements et actualités correspondant à votre profil.
                </p>
                <Button className="mt-4 gap-1.5" onClick={() => scanAllMutation.mutate()} disabled={isScanning}>
                  <ScanLine size={14} /> Lancer le premier scan
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
