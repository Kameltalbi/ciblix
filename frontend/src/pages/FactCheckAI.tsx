import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  ShieldCheck,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  ExternalLink,
  Link2,
  ArrowRight,
  Globe,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Verdict = 'TRUE' | 'FALSE' | 'PARTIALLY_TRUE' | 'UNVERIFIABLE' | 'MISLEADING';
type Stance = 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL';
type Reliability = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

interface FactCheckSource {
  url: string;
  title: string;
  stance: Stance;
  keyQuote: string;
}

interface FactCheckResult {
  verdict: Verdict;
  confidence: number;
  summary: string;
  analysis: string;
  sources: FactCheckSource[];
  context: string;
  recommendation: string;
}

interface UrlAnalysis {
  reliability: Reliability;
  score: number;
  title: string;
  mainClaims: string[];
  analysis: string;
  redFlags: string[];
  positiveSignals: string[];
  sourceType: string;
  recommendation: string;
}

const VERDICT_CONFIG: Record<Verdict, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  TRUE: { icon: CheckCircle2, label: 'Vrai', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300' },
  FALSE: { icon: XCircle, label: 'Faux', color: 'text-red-700', bg: 'bg-red-50 border-red-300' },
  PARTIALLY_TRUE: { icon: AlertTriangle, label: 'Partiellement vrai', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300' },
  MISLEADING: { icon: AlertTriangle, label: 'Trompeur', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' },
  UNVERIFIABLE: { icon: HelpCircle, label: 'Non vérifiable', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-300' },
};

const STANCE_CONFIG: Record<Stance, { icon: typeof ThumbsUp; label: string; color: string }> = {
  SUPPORTS: { icon: ThumbsUp, label: 'Confirme', color: 'text-emerald-600' },
  CONTRADICTS: { icon: ThumbsDown, label: 'Contredit', color: 'text-red-600' },
  NEUTRAL: { icon: Minus, label: 'Neutre', color: 'text-gray-500' },
};

const RELIABILITY_CONFIG: Record<Reliability, { color: string; bg: string; label: string }> = {
  HIGH: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', label: 'Fiabilité élevée' },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', label: 'Fiabilité moyenne' },
  LOW: { color: 'text-red-700', bg: 'bg-red-50 border-red-300', label: 'Fiabilité faible' },
  UNKNOWN: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-300', label: 'Fiabilité inconnue' },
};

function ConfidenceBar({ confidence }: { confidence: number }) {
  const color = confidence >= 70 ? 'bg-emerald-500' : confidence >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-100">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${confidence}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{confidence}%</span>
    </div>
  );
}

function VerdictCard({ result }: { result: FactCheckResult }) {
  const config = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.UNVERIFIABLE;
  const VIcon = config.icon;

  return (
    <div className="space-y-6">
      <Card className={cn('border-2', config.bg)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <VIcon size={32} className={config.color} />
            <div className="flex-1">
              <p className={cn('text-xl font-bold', config.color)}>{config.label}</p>
              <ConfidenceBar confidence={result.confidence} />
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-foreground">{result.summary}</p>
        </CardContent>
      </Card>

      {result.analysis && (
        <Card>
          <CardHeader><CardTitle className="text-base">Analyse détaillée</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{result.analysis}</p>
          </CardContent>
        </Card>
      )}

      {result.sources?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Sources ({result.sources.length})</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {result.sources.map((src, i) => {
              const stanceConfig = STANCE_CONFIG[src.stance] || STANCE_CONFIG.NEUTRAL;
              const SIcon = stanceConfig.icon;
              return (
                <div key={i} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{src.title}</p>
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5">
                        <Link2 size={10} /> {new URL(src.url).hostname} <ExternalLink size={10} />
                      </a>
                    </div>
                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', stanceConfig.color)}>
                      <SIcon size={10} /> {stanceConfig.label}
                    </span>
                  </div>
                  {src.keyQuote && (
                    <p className="mt-2 border-l-2 border-gray-200 pl-3 text-xs italic text-muted-foreground">"{src.keyQuote}"</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {result.context && (
        <Card>
          <CardHeader><CardTitle className="text-base">Contexte</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">{result.context}</p></CardContent>
        </Card>
      )}

      {result.recommendation && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-blue-800">Recommandation</p>
            <p className="text-sm text-blue-700 mt-1">{result.recommendation}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function FactCheckAI() {
  const [claim, setClaim] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [activeTab, setActiveTab] = useState<'claim' | 'url'>('claim');

  const checkMutation = useMutation({
    mutationFn: (params: { claim: string }) =>
      api.post('/factcheck-ai/check', params).then((r) => r.data as { claim: string; result: FactCheckResult; meta: any }),
  });

  const checkUrlMutation = useMutation({
    mutationFn: (params: { url: string }) =>
      api.post('/factcheck-ai/check-url', params).then((r) => r.data as { url: string; analysis: UrlAnalysis }),
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck size={22} strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">FactCheck AI</h1>
          <p className="text-sm text-muted-foreground">Vérifiez la fiabilité des informations en croisant les sources</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('claim')}
          className={cn('flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'claim' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Vérifier une affirmation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={cn('flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'url' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
        >
          Analyser une URL
        </button>
      </div>

      {/* Claim check */}
      {activeTab === 'claim' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Quelle information vérifier ?</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                placeholder="Ex: La Tunisie a réduit ses émissions de CO2 de 20% en 2025..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                onClick={() => checkMutation.mutate({ claim })}
                disabled={claim.trim().length < 5 || checkMutation.isPending}
                className="gap-2"
              >
                {checkMutation.isPending ? (
                  <><Loader2 size={16} className="animate-spin" /> Vérification en cours...</>
                ) : (
                  <><Search size={16} /> Vérifier</>
                )}
              </Button>
            </CardContent>
          </Card>

          {checkMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={16} /> Erreur. Vérifiez votre connexion et la configuration API.
            </div>
          )}

          {checkMutation.data?.result && <VerdictCard result={checkMutation.data.result} />}
        </div>
      )}

      {/* URL check */}
      {activeTab === 'url' && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Analyser la fiabilité d'une source</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://exemple.com/article..."
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button
                  onClick={() => checkUrlMutation.mutate({ url: urlInput })}
                  disabled={!urlInput.trim() || checkUrlMutation.isPending}
                  className="gap-1.5"
                >
                  {checkUrlMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  Analyser
                </Button>
              </div>
            </CardContent>
          </Card>

          {checkUrlMutation.isError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle size={16} /> Erreur lors de l'analyse.
            </div>
          )}

          {checkUrlMutation.data?.analysis && (() => {
            const a = checkUrlMutation.data.analysis;
            const relConfig = RELIABILITY_CONFIG[a.reliability] || RELIABILITY_CONFIG.UNKNOWN;

            return (
              <div className="space-y-4">
                <Card className={cn('border-2', relConfig.bg)}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Globe size={28} className={relConfig.color} />
                      <div className="flex-1">
                        <p className={cn('text-lg font-bold', relConfig.color)}>{relConfig.label}</p>
                        <ConfidenceBar confidence={a.score} />
                      </div>
                    </div>
                    {a.title && <p className="mt-3 font-medium text-foreground">{a.title}</p>}
                    {a.sourceType && <p className="text-xs text-muted-foreground mt-1">Type: {a.sourceType}</p>}
                  </CardContent>
                </Card>

                {a.analysis && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Analyse</CardTitle></CardHeader>
                    <CardContent><p className="text-sm text-muted-foreground whitespace-pre-line">{a.analysis}</p></CardContent>
                  </Card>
                )}

                {(a.redFlags?.length > 0 || a.positiveSignals?.length > 0) && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {a.positiveSignals?.length > 0 && (
                      <Card className="border-emerald-200">
                        <CardHeader><CardTitle className="text-sm text-emerald-700">Signaux positifs</CardTitle></CardHeader>
                        <CardContent>
                          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                            {a.positiveSignals.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {a.redFlags?.length > 0 && (
                      <Card className="border-red-200">
                        <CardHeader><CardTitle className="text-sm text-red-700">Signaux d'alerte</CardTitle></CardHeader>
                        <CardContent>
                          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                            {a.redFlags.map((s: string, i: number) => <li key={i}>{s}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {a.mainClaims?.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-base">Affirmations principales</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                        {a.mainClaims.map((c: string, i: number) => <li key={i}>{c}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {a.recommendation && (
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CardContent className="p-4">
                      <p className="text-sm font-medium text-blue-800">Recommandation</p>
                      <p className="text-sm text-blue-700 mt-1">{a.recommendation}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
