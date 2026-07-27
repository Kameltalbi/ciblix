import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, MessageCircle, Send, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ChatMsg = { id: string; role: 'bot' | 'user'; text: string };

const STORAGE_OPENED = 'ciblix_onboarding_chat_opened';

function langFromI18n(lng: string): 'fr' | 'en' | 'ar' {
  const base = (lng || 'fr').slice(0, 2).toLowerCase();
  if (base === 'en' || base === 'ar') return base;
  return 'fr';
}

export function OnboardingChatWidget() {
  const { t, i18n } = useTranslation();
  const language = langFromI18n(i18n.language);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const welcomeSeeded = useRef(false);

  useEffect(() => {
    if (welcomeSeeded.current) return;
    welcomeSeeded.current = true;
    setMessages([
      {
        id: 'welcome',
        role: 'bot',
        text: t('onboardingChatbot.welcome'),
      },
    ]);

    try {
      if (!localStorage.getItem(STORAGE_OPENED)) {
        const timer = window.setTimeout(() => {
          setOpen(true);
          localStorage.setItem(STORAGE_OPENED, '1');
        }, 1200);
        return () => window.clearTimeout(timer);
      }
    } catch {
      /* ignore */
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, pending]);

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (!text || pending) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
    setPending(true);
    try {
      const { data } = await api.post('/onboarding-chatbot/query', { message: text, language });
      const answer =
        (typeof data?.answer === 'string' && data.answer.trim()) ||
        t('onboardingChatbot.noAnswerFallback');
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: 'bot', text: answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'bot', text: t('onboardingChatbot.errorFallback') },
      ]);
    } finally {
      setPending(false);
    }
  };

  const quickKeys = ['start', 'message', 'contacts', 'signals'] as const;

  return (
    <div className="fixed bottom-24 end-5 z-[130] flex flex-col items-end gap-3 sm:bottom-28 sm:end-6">
      {open ? (
        <div
          className="flex h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-[#BED6F6]/80 bg-white shadow-2xl shadow-[#1E72B9]/20"
          role="dialog"
          aria-label={t('onboardingChatbot.titleLoggedIn')}
        >
          <header className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#0F1629] to-[#1B2A4A] px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B6BFB]">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t('onboardingChatbot.titleLoggedIn')}</p>
                <p className="truncate text-[11px] text-[#A8B4D0]">{t('onboardingChatbot.subtitle')}</p>
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-[#A8B4D0] hover:bg-white/10 hover:text-white"
              aria-label={t('onboardingChatbot.close')}
              onClick={() => setOpen(false)}
            >
              <X size={18} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#F7F9FC] px-3 py-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'rounded-br-md bg-[#016AEB] text-white'
                      : 'rounded-bl-md border border-[#D5DEED] bg-white text-[#1A2744]'
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex items-center gap-2 text-xs text-[#6B7C96]">
                <Loader2 size={14} className="animate-spin" />
                {t('onboardingChatbot.thinking')}
              </div>
            ) : null}
          </div>

          <div className="border-t border-[#E4EBF5] bg-white px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {quickKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={pending}
                  onClick={() => void ask(t(`onboardingChatbot.quickQuestions.${key}`))}
                  className="rounded-full border border-[#C5D4EA] bg-[#EEF3FA] px-2.5 py-1 text-[11px] font-medium text-[#2A3A55] hover:bg-[#E0EAF8] disabled:opacity-50"
                >
                  {t(`onboardingChatbot.quickQuestions.${key}`)}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('onboardingChatbot.inputPlaceholder')}
                className="h-10 flex-1 rounded-xl border border-[#C5D4EA] bg-[#F7F9FC] px-3 text-sm text-[#0F1629] outline-none placeholder:text-[#6B7C96] focus:border-[#016AEB]"
                disabled={pending}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 shrink-0 bg-[#016AEB] hover:bg-[#0159c4]"
                disabled={pending || !input.trim()}
              >
                <Send size={16} />
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          try {
            localStorage.setItem(STORAGE_OPENED, '1');
          } catch {
            /* ignore */
          }
        }}
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full border shadow-xl transition-smooth hover:scale-[1.04]',
          open
            ? 'border-[#016AEB] bg-[#016AEB] text-white shadow-[#016AEB]/35'
            : 'border-[#BED6F6]/60 bg-white text-[#1E72B9] shadow-[#1E72B9]/25 hover:bg-[#eef4fc]'
        )}
        title={t('onboardingChatbot.fabLabel')}
        aria-label={t('onboardingChatbot.fabLabel')}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={24} strokeWidth={2} className="text-[#0071DD]" />}
      </button>
    </div>
  );
}
