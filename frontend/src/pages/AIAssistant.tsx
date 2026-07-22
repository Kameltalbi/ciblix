import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
  KanbanSquare,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Radio,
  Upload,
  Mic,
  FileText,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CopilotBriefing {
  generatedAt: string;
  summary: {
    recentConversations: number;
    highScoreCount: number;
    pendingContacts: number;
    avgScore: number;
  };
  recommendations: Array<{
    agentEventId: string;
    contactName?: string;
    action: string;
    score: number;
  }>;
  alerts: Array<{
    type: string;
    agentEventId: string;
    contactName?: string;
    message: string;
  }>;
  topOpportunities: Array<{
    id: string;
    contactName?: string;
    resume: string;
    score: number;
    createdAt: string;
  }>;
}

interface ConversationResult {
  agentEventId: string;
  status: 'processing' | 'done' | 'error';
  processingError?: string | null;
  resume?: string | null;
  score?: number | null;
  actionsSuggerees?: string[];
  scoreDetail?: Record<string, string | number>;
  signauxAchat?: string[];
  contactId?: string | null;
}

export function AIAssistant() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const relanceRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const suggestions = [
    'Quelles conversations dois-je relancer en priorité ?',
    'Résume mes derniers échanges analysés',
    'Quels signaux d’achat ont été détectés ?',
    'Quelles actions me recommandes-tu cette semaine ?',
  ];

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatLoaded, setChatLoaded] = useState(false);

  const [pastedText, setPastedText] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [contactHintPhone, setContactHintPhone] = useState('');
  const [contactHintEmail, setContactHintEmail] = useState('');
  const [activeAgentEventId, setActiveAgentEventId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ConversationResult | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  const [followAffaireId, setFollowAffaireId] = useState('');
  const [followTone, setFollowTone] = useState<'soft' | 'commercial' | 'firm'>('commercial');
  const [followChannel, setFollowChannel] = useState<'email' | 'whatsapp'>('email');
  const [followLength, setFollowLength] = useState<'short' | 'long'>('short');
  const [followPreview, setFollowPreview] = useState('');

  const { data: briefing, isPending: briefingPending } = useQuery<CopilotBriefing>({
    queryKey: ['copilot-briefing'],
    queryFn: () => api.get('/copilot/briefing').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: chatHistory } = useQuery({
    queryKey: ['copilot-chat-messages', activeAgentEventId],
    queryFn: () =>
      api
        .get('/copilot/chat/messages', {
          params: activeAgentEventId ? { agentEventId: activeAgentEventId } : {},
        })
        .then((r) => r.data.messages as Message[]),
    staleTime: 30_000,
  });

  useEffect(() => {
    setChatLoaded(false);
  }, [activeAgentEventId]);

  useEffect(() => {
    if (chatHistory && !chatLoaded) {
      setMessages(chatHistory.filter((m) => m.id !== 'welcome' || chatHistory.length === 1));
      setChatLoaded(true);
    }
  }, [chatHistory, chatLoaded]);

  const { data: selectedConversation } = useQuery<ConversationResult>({
    queryKey: ['copilot-conversation', activeAgentEventId],
    queryFn: () => api.get(`/copilot/conversations/${activeAgentEventId}`).then((r) => r.data),
    enabled: !!activeAgentEventId,
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 2500 : false),
  });

  useEffect(() => {
    if (!selectedConversation) return;
    setAnalysisResult(selectedConversation);
    if (selectedConversation.status === 'done') {
      void queryClient.invalidateQueries({ queryKey: ['copilot-briefing'] });
    }
  }, [selectedConversation, queryClient]);

  useEffect(() => {
    if (analysisResult?.status === 'done') {
      analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [analysisResult?.agentEventId, analysisResult?.status]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (pastedText.trim()) form.append('texte', pastedText.trim());
      if (audioFile) form.append('file', audioFile);
      form.append('consentConfirmed', consentConfirmed ? 'true' : 'false');
      if (contactHintPhone.trim()) form.append('contactHintPhone', contactHintPhone.trim());
      if (contactHintEmail.trim()) form.append('contactHintEmail', contactHintEmail.trim());

      const res = await api.post('/copilot/conversations', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data as ConversationResult;
    },
    onSuccess: (data) => {
      setActiveAgentEventId(data.agentEventId);
      setAnalysisResult(data);
      void queryClient.invalidateQueries({ queryKey: ['copilot-conversation', data.agentEventId] });
      if (data.status === 'done') {
        void queryClient.invalidateQueries({ queryKey: ['copilot-briefing'] });
      }
    },
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api
        .post('/copilot/chat', {
          message,
          agentEventId: activeAgentEventId || undefined,
        })
        .then((r) => r.data),
    onSuccess: (data: { reply: string }) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    },
    onError: (err: { response?: { data?: { error?: string } }; message?: string }) => {
      const msg = err?.response?.data?.error || err?.message || 'Erreur';
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
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setFollowPreview(err?.response?.data?.error || 'Impossible de générer la relance.');
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    chatMutation.mutate(userMessage);
  };

  const handleSuggestion = (suggestion: string) => {
    setInput(suggestion);
  };

  const canAnalyze = consentConfirmed && (Boolean(pastedText.trim()) || Boolean(audioFile));

  const scoreBadgeClass =
    (analysisResult?.score ?? 0) >= 70
      ? 'bg-emerald-100 text-emerald-800'
      : (analysisResult?.score ?? 0) >= 40
        ? 'bg-amber-100 text-amber-800'
        : 'bg-rose-100 text-rose-800';

  return (
    <div className="flex flex-col gap-6 md:gap-8 px-2 md:px-0 min-h-0 flex-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2 flex-wrap">
            <Sparkles className="text-violet-600 shrink-0" size={28} />
            <span className="break-words">Assistant IA</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Analysez vos conversations (audio ou texte), obtenez un score et un briefing basé sur votre activité réelle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/prospection-ia">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Radio size={16} /> {t('nav.agentHunt')}
            </Button>
          </Link>
          <Link to="/agents">
            <Button variant="outline" size="sm" className="gap-1.5">
              <BarChart3 size={16} /> Agents IA
            </Button>
          </Link>
        </div>
      </div>

      {/* Upload conversation */}
      <Card className="shadow-sm border-violet-200/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="text-violet-600" size={18} />
            Analyser une conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Mic size={14} /> Fichier audio
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => setAudioFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                {audioFile ? audioFile.name : 'Choisir un fichier audio'}
              </Button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileText size={14} /> Texte collé (WhatsApp, email…)
              </label>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Collez ici la conversation à analyser…"
                className="w-full min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              value={contactHintPhone}
              onChange={(e) => setContactHintPhone(e.target.value)}
              placeholder="Indice téléphone (optionnel)"
            />
            <Input
              value={contactHintEmail}
              onChange={(e) => setContactHintEmail(e.target.value)}
              placeholder="Indice email (optionnel)"
            />
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={consentConfirmed}
              onChange={(e) => setConsentConfirmed(e.target.checked)}
            />
            <span>
              Je confirme avoir le consentement des interlocuteurs pour analyser cette conversation (obligatoire).
            </span>
          </label>

          <Button
            type="button"
            disabled={!canAnalyze || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
            className="gap-2"
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Analyse en cours…
              </>
            ) : (
              <>
                <Sparkles size={16} /> Lancer l&apos;analyse
              </>
            )}
          </Button>

          {uploadMutation.isError && (
            <p className="text-sm text-destructive">
              {(uploadMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
                'Erreur lors de l’analyse'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Résultat analyse */}
      {analysisResult && (
        <Card ref={analysisRef} className="shadow-sm border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span>Résultat de l&apos;analyse</span>
              {analysisResult.status === 'processing' && (
                <span className="text-xs font-normal text-muted-foreground flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" /> Transcription en cours…
                </span>
              )}
              {analysisResult.status === 'error' && (
                <span className="text-xs font-normal text-destructive">Erreur</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {analysisResult.status === 'error' ? (
              <p className="text-sm text-destructive">{analysisResult.processingError || 'Échec du traitement'}</p>
            ) : analysisResult.status === 'processing' ? (
              <p className="text-sm text-muted-foreground">Votre fichier audio est en cours de transcription et d&apos;analyse.</p>
            ) : (
              <>
                {typeof analysisResult.score === 'number' && (
                  <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${scoreBadgeClass}`}>
                    Score : {analysisResult.score}/100
                  </div>
                )}
                {analysisResult.resume && (
                  <p className="text-sm whitespace-pre-wrap">{analysisResult.resume}</p>
                )}
                {(analysisResult.actionsSuggerees?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Actions suggérées</p>
                    <ul className="text-sm list-disc pl-5 space-y-1">
                      {analysisResult.actionsSuggerees!.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {analysisResult.contactId ? (
                    <Link to={`/contacts/${analysisResult.contactId}`}>
                      <Button size="sm" variant="default" className="gap-1.5">
                        Voir la fiche contact
                      </Button>
                    </Link>
                  ) : null}
                  <Link to="/agents/gmail-ai">
                    <Button size="sm" variant="secondary" className="gap-1.5">
                      <Mail size={14} /> Créer relance (Gmail IA)
                    </Button>
                  </Link>
                  <Link
                    to={
                      analysisResult.contactId
                        ? `/agents/offre-bot?contactId=${analysisResult.contactId}`
                        : '/agents/offre-bot'
                    }
                  >
                    <Button size="sm" variant="outline" className="gap-1.5">
                      <FileText size={14} /> Rédiger une offre
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Briefing */}
      <section aria-labelledby="daily-summary-heading">
        <h2 id="daily-summary-heading" className="sr-only">
          Briefing Copilot
        </h2>
        {briefingPending ? (
          <div className="text-sm text-muted-foreground py-6">Analyse de votre activité…</div>
        ) : briefing ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <Card className="border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                  <Flame size={14} /> Conversations (48h)
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.recentConversations}</p>
              </CardContent>
            </Card>
            <Card className="border-sky-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-sky-800 flex items-center gap-1">
                  <Zap size={14} /> Scores élevés (≥70)
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.highScoreCount}</p>
              </CardContent>
            </Card>
            <Card className="border-rose-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-rose-800 flex items-center gap-1">
                  <AlertTriangle size={14} /> Contacts non résolus
                </p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.pendingContacts}</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200/80 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-amber-800">Score moyen</p>
                <p className="text-2xl font-bold tabular-nums mt-1">{briefing.summary.avgScore}/100</p>
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
                  key={`${r.agentEventId}-${r.action}`}
                  type="button"
                  onClick={() => setActiveAgentEventId(r.agentEventId)}
                  className="w-full flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-sm hover:bg-muted/40 transition-colors"
                >
                  <ChevronRight className="shrink-0 text-muted-foreground mt-0.5" size={16} />
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{r.action}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {r.contactName || 'Contact'} · score {r.score}
                    </span>
                  </span>
                </button>
              ))}
              {!briefing?.recommendations?.length && (
                <p className="text-sm text-muted-foreground">Analysez une conversation pour obtenir des recommandations.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="text-amber-600" size={18} />
                Alertes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(briefing?.alerts || []).slice(0, 6).map((a) => (
                <div
                  key={a.agentEventId + a.type}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{a.contactName || 'Contact'}</span>
                    <span className="block text-xs text-muted-foreground">{a.message}</span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setActiveAgentEventId(a.agentEventId)}>
                    Voir
                  </Button>
                </div>
              ))}
              {!briefing?.alerts?.length && (
                <p className="text-sm text-muted-foreground">Aucune alerte pour le moment.</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meilleures opportunités détectées</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-border/60">
              {(briefing?.topOpportunities || []).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{o.contactName || 'Contact'}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{o.resume}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{o.score}/100</p>
                    <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setActiveAgentEventId(o.id)}>
                      Détail
                    </Button>
                  </div>
                </div>
              ))}
              {!briefing?.topOpportunities?.length && (
                <p className="text-sm text-muted-foreground py-2">Pas encore de conversations analysées.</p>
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
              <Link to="/agents/gmail-ai" className="block">
                <Button variant="secondary" className="w-full justify-start gap-2">
                  <Mail size={16} /> Gmail IA
                </Button>
              </Link>
              <Link to="/agents/offre-bot" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText size={16} /> Rédiger une offre
                </Button>
              </Link>
              <Link to="/prospection-ia" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Radio size={16} /> Lancer Hunt AI
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card ref={relanceRef} className="shadow-md border-violet-200/50 bg-gradient-to-b from-white to-violet-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="text-violet-600" size={18} />
                Relance IA (legacy affaire)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={followAffaireId}
                onChange={(e) => setFollowAffaireId(e.target.value)}
                placeholder="ID affaire (optionnel)"
                className="font-mono text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={followTone} onValueChange={(v) => setFollowTone(v as typeof followTone)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Douce</SelectItem>
                    <SelectItem value="commercial">Commerciale</SelectItem>
                    <SelectItem value="firm">Ferme</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={followChannel} onValueChange={(v) => setFollowChannel(v as typeof followChannel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
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

      {/* Conversation persistante */}
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
        >
          {messages.map((message, index) => (
            <div
              key={message.id ?? index}
              className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={15} className="text-violet-600 sm:w-4 sm:h-4" />
                </div>
              )}
              <div
                className={`max-w-[min(92%,26rem)] rounded-2xl px-3 py-2.5 sm:p-3 ${
                  message.role === 'user' ? 'bg-violet-600 text-white' : 'bg-muted/60 text-foreground'
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
          {chatMutation.isPending && (
            <div className="flex gap-2 sm:gap-3 justify-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <Bot size={15} className="text-violet-600 sm:w-4 sm:h-4" />
              </div>
              <div className="bg-muted/60 rounded-2xl px-3 py-2.5 sm:p-3">
                <p className="text-sm text-muted-foreground">{t('aiAssistant.thinking')}</p>
              </div>
            </div>
          )}
        </CardContent>
        <div className="border-t p-3 sm:p-4 space-y-2 sm:space-y-3 shrink-0 bg-card">
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => handleSuggestion(suggestion)}
                className="text-xs max-w-full justify-start text-left h-auto min-h-9 py-2 px-3 whitespace-normal"
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
              className="flex-1 min-w-0 min-h-11"
              autoComplete="off"
            />
            <Button
              type="button"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={handleSend}
              disabled={chatMutation.isPending || !input.trim()}
            >
              <Send size={18} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
