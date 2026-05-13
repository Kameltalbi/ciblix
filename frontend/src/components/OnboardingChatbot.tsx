import { useEffect, useMemo, useState } from 'react';
import { Bot, MessageCircle, Send, Sparkles, User, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export function OnboardingChatbot() {
  const { t, i18n } = useTranslation();
  const isLoggedIn = Boolean(useAuth((s) => s.accessToken));
  const [isVisible, setIsVisible] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: t('onboardingChatbot.welcome'),
    },
  ]);

  const canSend = input.trim().length > 0;
  const title = useMemo(
    () => (isLoggedIn ? t('onboardingChatbot.titleLoggedIn') : t('onboardingChatbot.titlePublic')),
    [isLoggedIn, t]
  );
  const quickQuestions = useMemo(
    () => [
      t('onboardingChatbot.quickQuestions.start'),
      t('onboardingChatbot.quickQuestions.difference'),
      t('onboardingChatbot.quickQuestions.convert'),
      t('onboardingChatbot.quickQuestions.kanban'),
    ],
    [t]
  );

  useEffect(() => {
    const knownWelcomeMessages = [
      "Bonjour, je suis votre chatbot d'onboarding KTOptima. Je vous aide à comprendre rapidement comment démarrer.",
      "Bonjour, je suis votre chatbot d'onboarding CIBLIX. Je vous aide à comprendre rapidement comment démarrer.",
      "Bonjour ! Je suis votre assistant CIBLIX. Je vous aide à trouver des prospects, prioriser vos opportunités et lancer vos relances.",
      'Hello, I am your KTOptima onboarding chatbot. I help you quickly understand how to get started.',
      'Hello, I am your CIBLIX onboarding chatbot. I help you quickly understand how to get started.',
      "Hi! I'm your CIBLIX assistant. I'll help you find prospects, prioritize opportunities, and launch follow-ups.",
      'مرحباً، أنا شات بوت التهيئة في KTOptima. أساعدك على فهم طريقة البدء بسرعة.',
      'مرحباً، أنا شات بوت التهيئة في CIBLIX. أساعدك على فهم طريقة البدء بسرعة.',
      'مرحباً! أنا مساعد CIBLIX. أساعدك على إيجاد العملاء المحتملين، ترتيب الفرص، وتشغيل المتابعات.',
    ];

    setMessages((prev) => {
      if (prev.length === 0) return [{ role: 'assistant', content: t('onboardingChatbot.welcome') }];
      const first = prev[0];
      if (first.role !== 'assistant' || !knownWelcomeMessages.includes(first.content)) return prev;
      const next = [...prev];
      next[0] = { role: 'assistant', content: t('onboardingChatbot.welcome') };
      return next;
    });
  }, [i18n.language, t]);

  const sendQuestion = async (question: string) => {
    const userQuestion = question.trim();
    if (!userQuestion) return;
    setMessages((prev) => [...prev, { role: 'user', content: userQuestion }]);
    setInput('');
    setIsLoading(true);

    try {
      const { data } = await api.post('/onboarding-chatbot/query', {
        message: userQuestion,
        language: i18n.language === 'ar' ? 'ar' : i18n.language === 'en' ? 'en' : 'fr',
      });
      const answer = data?.answer || t('onboardingChatbot.noAnswerFallback');
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: t('onboardingChatbot.errorFallback'),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[120] sm:bottom-6 sm:right-6">
      {isOpen && (
        <div className="mb-2 w-[min(92vw,370px)] rounded-2xl border border-border bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={14} className="text-primary" />
              {title}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Fermer le panneau onboarding"
            >
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[280px] space-y-2 overflow-y-auto p-3">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot size={12} className="text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] whitespace-pre-wrap rounded-xl px-2.5 py-2 text-xs ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}
                >
                  {m.content}
                </div>
                {m.role === 'user' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <User size={12} className="text-slate-700" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot size={12} className="text-primary" />
                </div>
                <div className="max-w-[82%] rounded-xl bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                  L'assistant onboarding réfléchit...
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t p-3">
            <div className="flex flex-wrap gap-1.5">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  className="rounded-full border border-border bg-white px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) sendQuestion(input);
                }}
                placeholder={t('onboardingChatbot.inputPlaceholder')}
                className="h-9 flex-1 rounded-lg border border-border px-3 text-xs outline-none focus:border-primary"
              />
              <button
                type="button"
                disabled={!canSend || isLoading}
                onClick={() => sendQuestion(input)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-end justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-white text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          title="Fermer le chatbot"
          aria-label="Fermer le chatbot"
        >
          <X size={14} />
        </button>
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl"
          title="Ouvrir le chatbot onboarding"
          aria-label="Ouvrir le chatbot onboarding"
        >
          <MessageCircle size={16} className="shrink-0" />
          <span className="hidden sm:inline">{t('onboardingChatbot.fabLabel')}</span>
        </button>
      </div>
    </div>
  );
}
