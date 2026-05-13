import { useEffect, useMemo, useState } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'ciblix_pwa_prompt_dismissed';

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function isStandaloneDisplay(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallPrompt() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isStandaloneDisplay());

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const canShowIosHint = useMemo(() => isIosDevice() && !isStandaloneDisplay(), []);
  const shouldShow = !isDismissed && !isInstalled && (deferredPrompt || canShowIosHint);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setIsDismissed(true);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  if (!shouldShow) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[1000] mx-auto max-w-xl rounded-2xl border border-border bg-white/95 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-sky-100 p-2 text-sky-700">
          {deferredPrompt ? <Download size={18} /> : <Smartphone size={18} />}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t('pwa.title')}</p>
          {deferredPrompt ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pwa.installDescription')}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pwa.iosDescription')}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            {deferredPrompt ? (
              <Button size="sm" onClick={handleInstallClick} className="bg-leaf hover:bg-leaf/90">
                {t('pwa.install')}
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={dismiss}>
              {t('pwa.later')}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('common.close', { defaultValue: 'Close' })}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
