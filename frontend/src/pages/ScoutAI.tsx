import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ScoutCategory = 'TENDER' | 'EVENT' | 'NEWS' | 'OTHER';

interface ScoutResult {
  id: string;
  title: string;
  url: string;
  source: string;
  snippet: string;
  publishedAt: string | null;
  category: ScoutCategory;
  relevanceScore: number;
  aiSummary: string | null;
  deadline: string | null;
  location: string | null;
  budget: string | null;
}

interface SearchMeta {
  totalRaw: number;
  totalAnalyzed: number;
  queries: string[];
  searchedAt: string;
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

const CATEGORY_CONFIG: Record<ScoutCategory, { icon: typeof FileText; label: string; color: string; bg: string }> = {
  TENDER: { icon: FileText, label: 'Appel d\'offres', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  EVENT: { icon: PartyPopper, label: 'Événement', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  NEWS: { icon: Newspaper, label: 'Actualité', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  OTHER: { icon: Radar, label: 'Autre', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

const SUGGESTED_KEYWORDS = [
  'bilan carbone',
  'environnement',
  'formation professionnelle',
  'conseil',
  'audit énergétique',
  'RSE',
  'développement durable',
  'ISO 14001',
];

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

function ResultCard({ result, onSave, saved }: { result: ScoutResult; onSave: () => void; saved: boolean }) {
  const catConfig = CATEGORY_CONFIG[result.category];
  const CatIcon = catConfig.icon;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <ScoreRing score={result.relevanceScore} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className={cn('mb-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase', catConfig.bg, catConfig.color)}>
                  <CatIcon size={10} /> {catConfig.label}
                </span>
                <h3 className="mt-1 text-sm font-semibold text-foreground line-clamp-2">{result.title}</h3>
              </div>
              <button
                type="button"
                onClick={onSave}
                className={cn('shrink-0 rounded-lg p-2 transition-colors', saved ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50')}
                title={saved ? 'Sauvegardé' : 'Sauvegarder'}
              >
                {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              </button>
            </div>

            {result.aiSummary && (
              <p className="text-sm text-muted-foreground">{result.aiSummary}</p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {result.deadline && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} /> {result.deadline}
                </span>
              )}
              {result.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {result.location}
                </span>
              )}
              {result.budget && (
                <span className="inline-flex items-center gap-1">
                  <Banknote size={12} /> {result.budget}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Link2 size={12} /> {result.source}
              </span>
            </div>

            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Voir la source <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScoutAI() {
  const { t } = useTranslation();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<ScoutCategory | 'ALL'>('ALL');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [analyzeUrl, setAnalyzeUrl] = useState('');

  const searchMutation = useMutation({
    mutationFn: (params: { keywords: string[]; sectors: string[] }) =>
      api.post('/scout-ai/search', params).then((r) => r.data as { results: ScoutResult[]; meta: SearchMeta }),
  });

  const saveMutation = useMutation({
    mutationFn: (result: ScoutResult) => api.post('/scout-ai/save', result),
    onSuccess: (_, result) => {
      setSavedIds((prev) => new Set([...prev, result.id]));
    },
  });

  const analyzeUrlMutation = useMutation({
    mutationFn: (params: { url: string }) =>
      api.post('/scout-ai/analyze-url', params).then((r) => r.data as { url: string; analysis: UrlAnalysis }),
  });

  const addKeyword = (kw: string) => {
    const trimmed = kw.trim().toLowerCase();
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed]);
    }
    setInputValue('');
  };

  const removeKeyword = (kw: string) => setKeywords(keywords.filter((k) => k !== kw));

  const handleSearch = () => {
    if (keywords.length === 0) return;
    searchMutation.mutate({ keywords, sectors });
  };

  const results = searchMutation.data?.results || [];
  const meta = searchMutation.data?.meta;
  const filteredResults = activeFilter === 'ALL' ? results : results.filter((r) => r.category === activeFilter);

  const categoryCounts: Record<string, number> = { ALL: results.length };
  for (const r of results) {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Radar size={22} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Scout AI</h1>
            <p className="text-sm text-muted-foreground">Veille & détection d'opportunités — appels d'offres, événements, actualités</p>
          </div>
        </div>
      </div>

      {/* Search form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurer la veille</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Mots-clés de veille</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addKeyword(inputValue);
                  }
                }}
                placeholder="Ex: bilan carbone, formation, audit..."
                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button onClick={() => addKeyword(inputValue)} variant="outline" size="sm" disabled={!inputValue.trim()}>
                Ajouter
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-200"
                  >
                    {kw}
                    <button type="button" onClick={() => removeKeyword(kw)} className="ml-0.5 text-blue-400 hover:text-blue-700">&times;</button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {SUGGESTED_KEYWORDS.filter((s) => !keywords.includes(s)).slice(0, 6).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addKeyword(s)}
                  className="rounded-full border border-dashed border-gray-300 px-2.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={keywords.length === 0 || searchMutation.isPending}
            className="w-full gap-2 sm:w-auto"
          >
            {searchMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Recherche en cours...</>
            ) : (
              <><Search size={16} /> Lancer la veille</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* URL Analyzer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Analyser une URL</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              value={analyzeUrl}
              onChange={(e) => setAnalyzeUrl(e.target.value)}
              placeholder="https://www.marchespublics.gov.tn/..."
              className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
              onClick={() => analyzeUrlMutation.mutate({ url: analyzeUrl })}
              disabled={!analyzeUrl.trim() || analyzeUrlMutation.isPending}
              variant="outline"
              className="gap-1.5"
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
                    CATEGORY_CONFIG[analyzeUrlMutation.data.analysis.type as ScoutCategory]?.bg || 'bg-gray-50',
                    CATEGORY_CONFIG[analyzeUrlMutation.data.analysis.type as ScoutCategory]?.color || 'text-gray-700',
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
                      {analyzeUrlMutation.data.analysis.actionItems.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {searchMutation.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={16} /> Erreur lors de la recherche. Vérifiez votre connexion et réessayez.
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {meta?.totalAnalyzed} opportunités détectées sur {meta?.totalRaw} résultats analysés
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'TENDER', 'EVENT', 'NEWS', 'OTHER'] as const).map((cat) => {
              const count = categoryCounts[cat] || 0;
              if (cat !== 'ALL' && count === 0) return null;
              const config = cat === 'ALL' ? { label: 'Tout', color: 'text-foreground', bg: 'bg-gray-100 border-gray-300' } : CATEGORY_CONFIG[cat];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    activeFilter === cat ? `${config.bg} ${config.color}` : 'border-gray-200 text-muted-foreground hover:bg-gray-50',
                  )}
                >
                  {config.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {filteredResults.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                saved={savedIds.has(result.id)}
                onSave={() => saveMutation.mutate(result)}
              />
            ))}
          </div>
        </div>
      )}

      {searchMutation.isSuccess && results.length === 0 && (
        <div className="py-12 text-center">
          <Radar size={40} className="mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">Aucune opportunité détectée pour ces mots-clés.</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Essayez d'élargir vos termes de recherche.</p>
        </div>
      )}
    </div>
  );
}
