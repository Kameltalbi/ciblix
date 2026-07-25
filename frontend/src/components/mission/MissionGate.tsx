import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bot, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

export function useMissionStatus() {
  return useQuery({
    queryKey: ['mission-status'],
    queryFn: () =>
      api.get('/mission/status').then(
        (r) =>
          r.data as {
            configured: boolean;
            status: string;
            step: number;
            completedAt: string | null;
            summary: string | null;
          }
      ),
    staleTime: 30_000,
  });
}

/** Affiché sur les pages agents tant que la Mission n’est pas ACTIVE. */
export function MissionGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data, isPending } = useMissionStatus();

  if (isPending) {
    return <p className="p-6 text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  if (data?.configured) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#016AEB]/10 text-[#016AEB]">
        <Bot size={28} />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        {t('mission.gateTitle')}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[15px]">
        {t('mission.gateBody')}
      </p>
      <div className="mt-2 text-xs text-slate-400">{t('mission.gateExplore')}</div>
      <Button className="mt-6 rounded-xl" asChild>
        <Link to="/mission">
          {t('mission.gateCta')}
          <ArrowRight size={16} className="ml-2" />
        </Link>
      </Button>
    </div>
  );
}
