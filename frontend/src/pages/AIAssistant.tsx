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
  Radio,
  Upload,
  Mic,
  FileText,
  Loader2,
  ChevronRight,
  HelpCircle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/form-controls';
import { cn } from '@/lib/utils';

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

type Mode = 'analyze' | 'ask';

export function AIAssistant() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const analysisRef = useRef<HTMLDivElement | null>(null);

  const suggestions = [
    'Qui dois-je relancer en priorité aujourd’hui ?',
    'Résume mes derniers échanges analysés',
    'Quels signaux d’achat as-tu détectés ?',
    'Quelles actions me recommandes-tu cette semaine ?',
  ];

  const [mode, setMode] = useState<Mode>('analyze');
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
  const [showAdvancedFollowUp, setShowAdvancedFollowUp] = useState(false);

  const [followAffaireId, setFollowAffaireId] = useState('');
  const [followTone, setFollowTone] = useState<'soft' | 'commercial' | 'firm'>('commercial');
  const [followChannel, setFollowChannel] = useState<'email' | 'whatsapp'>('email');
  const [followLength] = useState<'short' | 'long'>('short');
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

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, chatMutation.isPending]);

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

  const canAnalyze = consentConfirmed && (Boolean(pastedText.trim()) || Boolean(audioFile));
  const hasAnalyses = (briefing?.summary.recentConversations ?? 0) > 0;

  const scoreBadgeClass =
    (analysisResult?.score ?? 0) >= 70
      ? 'bg-emerald-100 text-emerald-800'
      : (analysisResult?.score ?? 0) >= 40
        ? 'bg-amber-100 text-amber-800'
        : 'bg-rose-100 text-rose-800';

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:px-0">
      {/* Header */}
      <div>
        <h1 className="flex flex-wrap items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          <Sparkles className="shrink-0 text-[#016AEB]" size={26} />
          Assistant IA
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Votre coach commercial : il lit un appel ou un WhatsApp, vous dit qui relancer, et répond à vos questions.
        </p>
      </div>

      {/* How it works */}
      <div className="rounded-xl border border-[#BED6F6]/70 bg-[#f7faff] px-4 py-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#016AEB]">
          <HelpCircle size={14} /> Comment l’utiliser
        </p>
        <ol className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-lg bg-white/80 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">1. Donnez un échange</span>
            <p className="mt-0.5 text-muted-foreground">Collez un WhatsApp / email, ou uploadez un audio d’appel.</p>
          </li>
          <li className="rounded-lg bg-white/80 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">2. Lisez le résultat</span>
            <p className="mt-0.5 text-muted-foreground">Résumé, score, et actions concrètes (relancer, offre…).</p>
          </li>
          <li className="rounded-lg bg-white/80 px-3 py-2.5 text-sm">
            <span className="font-semibold text-foreground">3. Posez une question</span>
            <p className="mt-0.5 text-muted-foreground">Ex. « Qui relancer aujourd’hui ? » — réponses en langage naturel.</p>
          </li>
        </ol>
      </div>

      {/* Mode switch */}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mode === 'analyze' ? 'default' : 'outline'}
          className="gap-1.5"
          onClick={() => setMode('analyze')}
        >
          <Upload size={16} /> Analyser un échange
        </Button>
        <Button
          type="button"
          variant={mode === 'ask' ? 'default' : 'outline'}
          className="gap-1.5"
          onClick={() => setMode('ask')}
        >
          <MessageCircle size={16} /> Poser une question
        </Button>
      </div>

      {mode === 'analyze' ? (
        <>
          <Card className="border-[#BED6F6]/60 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Étape 1 — Analyser une conversation</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Choisissez <strong>soit</strong> un fichier audio, <strong>soit</strong> un texte collé. Cochez le
                consentement, puis lancez.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Mic size={14} /> Option A — Enregistrement d’appel
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
                  <label className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <FileText size={14} /> Option B — Texte WhatsApp / email
                  </label>
                  <textarea
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Collez ici la conversation (ex. fil WhatsApp)…"
                    className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  value={contactHintPhone}
                  onChange={(e) => setContactHintPhone(e.target.value)}
                  placeholder="Téléphone du contact (optionnel)"
                />
                <Input
                  value={contactHintEmail}
                  onChange={(e) => setContactHintEmail(e.target.value)}
                  placeholder="Email du contact (optionnel)"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={consentConfirmed}
                  onChange={(e) => setConsentConfirmed(e.target.checked)}
                />
                <span>
                  Je confirme avoir le consentement des interlocuteurs pour analyser cette conversation
                  (obligatoire).
                </span>
              </label>

              {!canAnalyze && (
                <p className="text-xs text-amber-700">
                  Pour lancer : ajoutez un audio <em>ou</em> un texte, et cochez le consentement.
                </p>
              )}

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

          {analysisResult && (
            <Card ref={analysisRef} className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>Étape 2 — Résultat</span>
                  {analysisResult.status === 'processing' && (
                    <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                      <Loader2 size={14} className="animate-spin" /> Transcription…
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analysisResult.status === 'error' ? (
                  <p className="text-sm text-destructive">
                    {analysisResult.processingError || 'Échec du traitement'}
                  </p>
                ) : analysisResult.status === 'processing' ? (
                  <p className="text-sm text-muted-foreground">
                    Transcription et analyse en cours — le résumé apparaîtra ici automatiquement.
                  </p>
                ) : (
                  <>
                    {typeof analysisResult.score === 'number' && (
                      <div
                        className={cn(
                          'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold',
                          scoreBadgeClass
                        )}
                      >
                        Score : {analysisResult.score}/100
                      </div>
                    )}
                    {analysisResult.resume && (
                      <p className="whitespace-pre-wrap text-sm">{analysisResult.resume}</p>
                    )}
                    {(analysisResult.actionsSuggerees?.length ?? 0) > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">À faire ensuite</p>
                        <ul className="list-disc space-y-1 pl-5 text-sm">
                          {analysisResult.actionsSuggerees!.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {analysisResult.contactId ? (
                        <Link to={`/contacts/${analysisResult.contactId}`}>
                          <Button size="sm">Voir la fiche contact</Button>
                        </Link>
                      ) : null}
                      <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setMode('ask')}>
                        <MessageCircle size={14} /> Poser une question sur cet échange
                      </Button>
                      <Link to="/agents/gmail-ai">
                        <Button size="sm" variant="outline" className="gap-1.5">
                          <Mail size={14} /> Relancer via Gmail IA
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
        </>
      ) : (
        <Card className="overflow-hidden border-[#BED6F6]/60 shadow-sm">
          <CardHeader className="border-b py-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="text-[#016AEB]" size={18} />
              Posez votre question
            </CardTitle>
            <p className="text-sm font-normal text-muted-foreground">
              {activeAgentEventId
                ? 'Le chat tient compte de l’analyse sélectionnée.'
                : 'Astuce : analysez d’abord un échange pour des réponses plus précises — ou posez une question générale.'}
            </p>
          </CardHeader>
          <CardContent
            className="max-h-[360px] min-h-[220px] space-y-3 overflow-y-auto p-4"
            role="log"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <p className="rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Essayez : « Qui dois-je relancer aujourd’hui ? »
              </p>
            )}
            {messages.map((message, index) => (
              <div
                key={message.id ?? index}
                className={cn('flex gap-2', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {message.role === 'assistant' && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f1fc]">
                    <Bot size={14} className="text-[#016AEB]" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[min(92%,26rem)] rounded-2xl px-3 py-2.5',
                    message.role === 'user' ? 'bg-[#016AEB] text-white' : 'bg-muted/60 text-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                    {message.content}
                  </p>
                </div>
                {message.role === 'user' && (
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <User size={14} className="text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {chatMutation.isPending && (
              <div className="flex gap-2 justify-start">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e8f1fc]">
                  <Bot size={14} className="text-[#016AEB]" />
                </div>
                <div className="rounded-2xl bg-muted/60 px-3 py-2.5">
                  <p className="text-sm text-muted-foreground">{t('aiAssistant.thinking')}</p>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </CardContent>
          <div className="space-y-2 border-t bg-card p-3">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setInput(suggestion);
                  }}
                  className="h-auto min-h-8 max-w-full whitespace-normal px-2.5 py-1.5 text-left text-xs"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Écrivez votre question…"
                className="min-h-11 min-w-0 flex-1"
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
      )}

      {/* Briefing — always visible as "what to do today" */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Votre briefing</h2>
          <p className="text-sm text-muted-foreground">
            Basé sur les conversations déjà analysées — se remplit après l’étape 1.
          </p>
        </div>

        {briefingPending ? (
          <p className="py-4 text-sm text-muted-foreground">Chargement du briefing…</p>
        ) : briefing ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="border-[#BED6F6]/60 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="flex items-center gap-1 text-xs font-medium text-[#016AEB]">
                  <Flame size={14} /> Analysées (48h)
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{briefing.summary.recentConversations}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="flex items-center gap-1 text-xs font-medium text-sky-800">
                  <Zap size={14} /> Scores élevés
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{briefing.summary.highScoreCount}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="flex items-center gap-1 text-xs font-medium text-rose-800">
                  <AlertTriangle size={14} /> À rattacher
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{briefing.summary.pendingContacts}</p>
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-white shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-amber-800">Score moyen</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{briefing.summary.avgScore}/100</p>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {!hasAnalyses && !briefingPending ? (
          <div className="rounded-lg border border-dashed border-[#BED6F6] bg-white px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune conversation analysée récemment.
            <br />
            <button
              type="button"
              className="mt-2 font-semibold text-[#016AEB] hover:underline"
              onClick={() => setMode('analyze')}
            >
              Analyser un premier échange →
            </button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">À faire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(briefing?.recommendations || []).slice(0, 6).map((r) => (
                  <button
                    key={`${r.agentEventId}-${r.action}`}
                    type="button"
                    onClick={() => {
                      setActiveAgentEventId(r.agentEventId);
                      setMode('analyze');
                    }}
                    className="flex w-full items-start gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/40"
                  >
                    <ChevronRight className="mt-0.5 shrink-0 text-muted-foreground" size={16} />
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">{r.action}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {r.contactName || 'Contact'} · score {r.score}
                      </span>
                    </span>
                  </button>
                ))}
                {!briefing?.recommendations?.length && (
                  <p className="text-sm text-muted-foreground">
                    Pas encore de recommandation. Analysez un échange ou posez une question.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="text-amber-600" size={18} />
                  Alertes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(briefing?.alerts || []).slice(0, 5).map((a) => (
                  <div
                    key={a.agentEventId + a.type}
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="font-medium">{a.contactName || 'Contact'}</span>
                      <span className="block text-xs text-muted-foreground">{a.message}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        setActiveAgentEventId(a.agentEventId);
                        setMode('analyze');
                      }}
                    >
                      Voir
                    </Button>
                  </div>
                ))}
                {!briefing?.alerts?.length && (
                  <p className="text-sm text-muted-foreground">Aucune alerte pour le moment.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link to="/prospection-ia">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Radio size={14} /> Chasseur IA
          </Button>
        </Link>
        <Link to="/agents/gmail-ai">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Mail size={14} /> Gmail IA
          </Button>
        </Link>
        <Link to="/agents/offre-bot">
          <Button variant="outline" size="sm" className="gap-1.5">
            <FileText size={14} /> Rédacteur d’offres
          </Button>
        </Link>
      </div>

      {/* Advanced — collapsed by default */}
      <div className="border-t border-border/60 pt-2">
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setShowAdvancedFollowUp((v) => !v)}
        >
          {showAdvancedFollowUp ? 'Masquer' : 'Afficher'} · Relance depuis une affaire (avancé)
        </button>
        {showAdvancedFollowUp && (
          <Card className="mt-3 border-border/60 shadow-sm">
            <CardContent className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Pour la plupart des cas, utilisez plutôt le résultat d’analyse ou Gmail IA.
              </p>
              <Input
                value={followAffaireId}
                onChange={(e) => setFollowAffaireId(e.target.value)}
                placeholder="ID affaire"
                className="font-mono text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={followTone} onValueChange={(v) => setFollowTone(v as typeof followTone)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soft">Douce</SelectItem>
                    <SelectItem value="commercial">Commerciale</SelectItem>
                    <SelectItem value="firm">Ferme</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={followChannel}
                  onValueChange={(v) => setFollowChannel(v as typeof followChannel)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-card p-3 text-sm">
                  {followPreview}
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
