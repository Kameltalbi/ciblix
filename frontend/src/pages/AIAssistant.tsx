import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Flame,
  AlertTriangle,
  Zap,
  Mail,
  MessageCircle,
  CalendarPlus,
  KanbanSquare,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Radio,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { fmtDT } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: unknown;
}

interface OperationalBriefing {
  generatedAt: string;
  summary: {
    priorityOpportunities: number;
    quotesWithoutReply7d: number;
    atRiskCount: number;
    hotLeads: number;
    monthForecastWeightedHT: number;
  };
  recommendations: Array<{
    affaireId: string;
    clientName: string;
    action: string;
    iaLabelFr: string;
    score: number;
  }>;
  alerts: Array<{
    type: string;
    affaireId: string;
    clientName?: string | null;
    message: string;
  }>;
  hotOpportunities: Array<{
    id: string;
    clientName?: string | null;
    montantHT: number;
    iaLabelFr: string;
    heatFr: string;
    daysSinceLastTouch: number;
    signatureProbabilityPct: number;
    statut: string;
  }>;
}

export function AIAssistant() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const relanceRef = useRef<HTMLDivElement | null>(null);

  const suggestions = [
    'Quels clients dois-je relancer ?',
    'Quelles sont mes opportunités les plus chaudes ?',
    'Quel est mon CA probable ce mois ?',
    'Quels dossiers sont bloqués ?',
    'Quels commerciaux performent le mieux ?',
    t('aiAssistant.suggestions.predictYearEnd'),
    t('aiAssistant.suggestions.recommendations'),
  ];

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('aiAssistant.welcomeMessage'),
    },
  ]);
  const [input, setInput] = useState('');

  const [followAffaireId, setFollowAffaireId] = useState('');
  const [followTone, setFollowTone] = useState<'soft' | 'commercial' | 'firm'>('commercial');
  const [followChannel, setFollowChannel] = useState<'email' | 'whatsapp'>('email');
  const [followLength, setFollowLength] = useState<'short' | 'long'>('short');
  const [followPreview, setFollowPreview] = useState('');

  const { data: briefing, isPending: briefingPending } = useQuery<OperationalBriefing>({
    queryKey: ['operational-briefing'],
    queryFn: () => api.get('/ai-assistant/operational-briefing').then((r) => r.data),
    staleTime: 60_000,
  });

  const queryMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/ai-assistant/query', { message, language: i18n.language }).then((r) => r.data),
    onSuccess: (data) => {
      const response = formatResponse(data);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response, data: data.result },
      ]);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.status === 403
          ? 'Fonction réservée à votre formule (IA conversationnelle). Le résumé et les relances ci-dessus restent disponibles selon votre offre.'
          : err?.response?.data?.error || err?.message || 'Erreur';
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    },
  });

  const followMutation = useMutation({
    mutationFn: () =>
      api
        .post('/ai-assistant/follow-up-draft', {
          affaireId: followAffaireId,
          tone: followTone,
          channel: followChannel,
          length: followLength,
          language: i18n.language,
        })
        .then((r) => r.data),
    onSuccess: (data: { source?: string; text?: string; subject?: string; body?: string }) => {
      if (data.text) {
        setFollowPreview(data.text);
      } else {
        const sub = data.subject ? `Objet : ${data.subject}\n\n` : '';
        setFollowPreview(`${sub}${data.body || ''}`);
      }
    },
    onError: (err: any) => {
      setFollowPreview(err?.response?.data?.error || 'Impossible de générer la relance.');
    },
  });

  const fmtDTLocal = (v: number) => Math.round(v).toLocaleString('fr-FR') + ' DT';

  const formatResponse = (data: any): string => {
    const { result } = data;

    if (typeof result === 'string') {
      return result;
    }

    if (result.type === 'metric') {
      return `📊 ${result.title} : ${result.value}`;
    }

    if (result.type === 'list') {
      if (!result.data || result.data.length === 0) {
        return `📋 ${result.title}\n\nAucun élément trouvé.`;
      }
      const items = result.data.map((item: any, i: number) => {
        if (typeof item === 'string') return `${i + 1}. ${item}`;
        const parts = Object.entries(item)
          .map(([, v]) => `${v}`)
          .join(' — ');
        return `${i + 1}. ${parts}`;
      }).join('\n');
      return `📋 ${result.title}\n\n${items}`;
    }

    if (result.type === 'text') {
      return result.value;
    }

    if (result.type === 'prediction') {
      const growth = Number(result.growth || 0);
      const hasPipeline = Number(result.pipelineCA || 0) > 0;
      const predictedCA = Number(result.predictedCA || 0);

      let diagnostic = 'Votre dynamique commerciale est stable.';
      if (growth > 8) {
        diagnostic = 'Votre dynamique commerciale est positive et orientée croissance.';
      } else if (growth < 0) {
        diagnostic = 'Votre dynamique commerciale est sous pression et nécessite un pilotage rapproché.';
      }

      let focus = 'Maintenez une cadence régulière de prospection et de qualification pour sécuriser le CA.';
      if (hasPipeline) {
        focus = 'Concentrez vos efforts sur la conversion des opportunités qualifiées tout en gardant un flux constant de prospection.';
      }

      return (
        `📈 Prévision CA fin d'année\n\n` +
        `CA prévisionnel de fin d'année : ${fmtDTLocal(predictedCA)} HT\n\n` +
        `Prévision construite à partir des opportunités réalisées, du pipeline en cours et de la prospection, en tenant compte de la saisonnalité, de la tendance et de la croissance mensuelle.\n\n` +
        `${diagnostic}\n` +
        `${focus}\n\n` +
        `💡 Recommandations professionnelles :\n` +
        `1. Continuer à prospecter de manière structurée pour alimenter le haut de pipeline.\n` +
        `2. Qualifier en continu les prospects pour accélérer les décisions commerciales.\n` +
        `3. Suivre les opportunités clés sans perte de vue, jusqu'à la clôture.\n` +
        `4. Piloter chaque mois les priorités commerciales pour sécuriser et dépasser les objectifs.`
      );
    }

    if (result.type === 'recommendations') {
      const recs = (result.recommendations || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n');
      return `💡 Recommandations personnalisées\n\n${recs}`;
    }

    if (result.type === 'target_analysis') {
      const monthlyTarget = fmtDTLocal(result.monthlyTarget || 0);
      return (
        `🎯 Analyse des objectifs\n\n` +
        `CA réalisé : ${fmtDTLocal(result.currentCA)} HT\n` +
        `CA prévu fin d'année : ${fmtDTLocal(result.predictedCA)} HT\n` +
        `Objectif mensuel moyen : ${monthlyTarget} HT\n` +
        `Mois restants : ${result.monthsRemaining}\n\n` +
        (result.recommendations
          ? `💡 Recommandations :\n${(result.recommendations || []).map((r: string, i: number) => `${i + 1}. ${r}`).join('\n')}`
          : '')
      );
    }

    return JSON.stringify(result, null, 2);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    queryMutation.mutate(userMessage);
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const firstRecId = briefing?.recommendations[0]?.affaireId;

  return (
    <div className="flex flex-col gap-6 md:gap-8 px-2 md:px-0 min-h-0 flex-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Sparkles className="text-violet-600 shrink-0" size={28} />
            <span className="break-words">Assistant IA</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Résumé quotidien, priorités commerciales et copilote conversationnel — vos données CIBLIX, sans saisie
            superflue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/prospection-ia">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Radio size={16} /> Prospection IA
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 size={16} /> Centre IA
            </Button>
          </Link>
          <Link to="/affaires">
            <Button variant="outline" size="sm" className="gap-1.5">
              <KanbanSquare size={16} /> Pipeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Résumé quotidien */}
      <section aria-labelledby="daily-summary-heading">
        <h2 id="daily-summary-heading" className="sr-only">
          Résumé quotidien IA
        </h2>
        {briefingPending ? (
          <div className="text-sm text-muted-foreground py-6">Analyse de votre activité…</div>
        ) : briefing ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            <Card className="border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                  <Flame size={14} /> Opportunités prioritaires
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.priorityOpportunities}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
                  <Mail size={14} /> Offres sans réponse (7j+)
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.quotesWithoutReply7d}</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-rose-800 flex items-center gap-1">
                  <AlertTriangle size={14} /> Dossiers à risque
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.atRiskCount}</p>
              </CardContent>
            </Card>
            <Card className="border-sky-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-sky-800 flex items-center gap-1">
                  <Zap size={14} /> Leads chauds
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.hotLeads}</p>
              </CardContent>
            </Card>
            <Card className="border-sky-200/80 bg-white shadow-sm col-span-2 lg:col-span-1">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-sky-800">CA pondéré du mois (pipeline)</p>
                <p className="text-xl font-bold tabular-nums mt-1">{fmtDT(briefing.summary.monthForecastWeightedHT)}</p>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="text-violet-600" size={18} />
                Recommandations IA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(briefing?.recommendations || []).slice(0, 8).map((r) => (
                <button
                  key={r.affaireId}
                  type="button"
                  onClick={() => {
                    setFollowAffaireId(r.affaireId);
                    relanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-sm hover:bg-muted/40 transition-colors"
                >
                  <ChevronRight className="shrink-0 text-muted-foreground mt-0.5" size={16} />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{r.action}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {r.clientName} · score {r.score} · {r.iaLabelFr}
                    </span>
                  </span>
                </button>
              ))}
              {!briefing?.recommendations?.length && (
                <p className="text-sm text-muted-foreground">Aucune recommandation pour le moment — enrichissez le pipeline.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="text-amber-600" size={18} />
                Alertes intelligentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(briefing?.alerts || []).slice(0, 6).map((a) => (
                <div
                  key={a.affaireId + a.type}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{a.clientName || 'Contact'}</span>
                    <span className="block text-xs text-muted-foreground">{a.message}</span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate(`/affaires/${a.affaireId}`)}>
                    Ouvrir
                  </Button>
                </div>
              ))}
              {!briefing?.alerts?.length && (
                <p className="text-sm text-muted-foreground">Aucune alerte bloquante détectée.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Opportunités les plus chaudes</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/60">
              {(briefing?.hotOpportunities || []).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{o.clientName || '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.heatFr} · {o.iaLabelFr} · {o.daysSinceLastTouch}j sans échange · ~{o.signatureProbabilityPct}% sign.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{fmtDT(o.montantHT)}</p>
                    <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate(`/affaires/${o.id}`)}>
                      Fiche
                    </Button>
                  </div>
                </div>
              ))}
              {!briefing?.hotOpportunities?.length && (
                <p className="text-sm text-muted-foreground py-2">Pas encore assez de données dans le pipeline.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2">
              <Button
                variant="secondary"
                className="justify-start gap-2"
                onClick={() => {
                  setFollowAffaireId(firstRecId || followAffaireId);
                  relanceRef.current?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <RefreshCw size={16} /> Générer une relance
              </Button>
              <Link to="/email-templates" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Mail size={16} /> Modèles d&apos;emails
                </Button>
              </Link>
              <Link to="/calendar" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <CalendarPlus size={16} /> Programmer un rappel
                </Button>
              </Link>
              <Link to="/activites" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Zap size={16} /> Créer une activité
                </Button>
              </Link>
              <Link to="/affaires" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <KanbanSquare size={16} /> Mettre à jour le pipeline
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card ref={relanceRef} className="shadow-md border-violet-200/50 bg-gradient-to-b from-white to-violet-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="text-violet-600" size={18} />
                Relance IA
              </CardTitle>
              <p className="text-xs text-muted-foreground">Aperçu du message — copiez-collez ou adaptez avant envoi.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ID opportunité (affaire)</label>
                <Input
                  value={followAffaireId}
                  onChange={(e) => setFollowAffaireId(e.target.value)}
                  placeholder="Collez l’ID ou cliquez une recommandation ci-dessus"
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Ton</label>
                  <Select value={followTone} onValueChange={(v) => setFollowTone(v as typeof followTone)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soft">Douce</SelectItem>
                      <SelectItem value="commercial">Commerciale</SelectItem>
                      <SelectItem value="firm">Ferme</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Canal</label>
                  <Select value={followChannel} onValueChange={(v) => setFollowChannel(v as typeof followChannel)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Longueur</label>
                <Select value={followLength} onValueChange={(v) => setFollowLength(v as typeof followLength)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Courte</SelectItem>
                    <SelectItem value="long">Plus détaillée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={!followAffaireId.trim() || followMutation.isPending}
                onClick={() => followMutation.mutate()}
              >
                {followMutation.isPending ? 'Génération…' : 'Générer l’aperçu'}
              </Button>
              {followPreview ? (
                <div className="rounded-lg border bg-card p-3 text-sm whitespace-pre-wrap max-h-56 overflow-y-auto">
                  {followPreview}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Conversation */}
      <Card className="flex flex-col min-h-0 shadow-sm border-border/60 overflow-hidden">
        <CardHeader className="border-b py-3 sm:py-4 shrink-0">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Bot className="text-violet-600 shrink-0" size={20} />
            <span className="truncate">{t('aiAssistant.conversation')}</span>
          </CardTitle>
        </CardHeader>
        <CardContent
          className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-3 sm:space-y-4 min-h-[280px] max-h-[420px]"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={15} className="text-violet-600 sm:w-4 sm:h-4" />
                </div>
              )}
              <div
                className={`max-w-[min(92%,26rem)] rounded-2xl px-3 py-2.5 sm:p-3 ${
                  message.role === 'user'
                    ? 'bg-violet-600 text-white'
                    : 'bg-muted/60 text-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.content}</p>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User size={15} className="text-muted-foreground sm:w-4 sm:h-4" />
                </div>
              )}
            </div>
          ))}
          {queryMutation.isPending && (
            <div className="flex gap-2 sm:gap-3 justify-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <Bot size={15} className="text-violet-600 sm:w-4 sm:h-4" />
              </div>
              <div className="bg-muted/60 rounded-2xl px-3 py-2.5 sm:p-3 max-w-[min(92%,26rem)]">
                <p className="text-sm text-muted-foreground">{t('aiAssistant.thinking')}</p>
              </div>
            </div>
          )}
        </CardContent>
        <div className="border-t p-3 sm:p-4 space-y-2 sm:space-y-3 shrink-0 bg-card">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 max-h-[30vh] sm:max-h-none overflow-y-auto sm:overflow-visible">
            {suggestions.map((suggestion: string) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestion(suggestion)}
                className="text-xs w-full sm:w-auto sm:max-w-[280px] justify-start text-left h-auto min-h-9 py-2 px-3 whitespace-normal leading-snug"
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('aiAssistant.inputPlaceholder')}
              className="flex-1 min-w-0 min-h-11 text-base sm:text-sm"
              autoComplete="off"
              enterKeyHint="send"
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={handleSend}
              disabled={queryMutation.isPending || !input.trim()}
              aria-label={t('common.submit', { defaultValue: 'Envoyer' })}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
