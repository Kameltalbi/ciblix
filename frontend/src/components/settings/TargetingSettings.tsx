import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type TargetingProfile = {
  activity: string | null;
  productsServices: string[];
  markets: string[];
  countries: string[];
  cities: string[];
  targetClients: string[];
  sectors: string[];
  keywords: string[];
  excludeCompanies: string[];
  orchestratorEnabled: boolean;
  orchestratorIntervalH: number;
  minScoutScoreToHandoff: number;
  lastOrchestratorAt?: string | null;
};

function listToText(items: string[]): string {
  return items.join('\n');
}

function textToList(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function TargetingSettings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ profile: TargetingProfile }>({
    queryKey: ['agent-team-targeting'],
    queryFn: () => api.get('/agent-team/targeting').then((r) => r.data),
  });

  const [form, setForm] = useState<TargetingProfile | null>(null);

  useEffect(() => {
    if (data?.profile) setForm(data.profile);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/agent-team/targeting', form).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agent-team-targeting'] });
    },
  });

  const runNow = useMutation({
    mutationFn: () => api.post('/agent-team/run-now').then((r) => r.data),
  });

  if (isLoading || !form) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>;
  }

  const listFields: Array<{ key: keyof TargetingProfile; label: string; hint: string }> = [
    { key: 'productsServices', label: t('agentTeam.products'), hint: t('agentTeam.listHint') },
    { key: 'markets', label: t('agentTeam.markets'), hint: t('agentTeam.listHint') },
    { key: 'countries', label: t('agentTeam.countries'), hint: t('agentTeam.listHint') },
    { key: 'cities', label: t('agentTeam.cities'), hint: t('agentTeam.listHint') },
    { key: 'targetClients', label: t('agentTeam.targetClients'), hint: t('agentTeam.listHint') },
    { key: 'sectors', label: t('agentTeam.sectors'), hint: t('agentTeam.listHint') },
    { key: 'keywords', label: t('agentTeam.keywords'), hint: t('agentTeam.listHint') },
    { key: 'excludeCompanies', label: t('agentTeam.exclude'), hint: t('agentTeam.listHint') },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('agentTeam.title')}</CardTitle>
          <p className="text-xs text-muted-foreground">{t('agentTeam.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('agentTeam.activity')}</Label>
            <Textarea
              value={form.activity || ''}
              onChange={(e) => setForm({ ...form, activity: e.target.value })}
              rows={3}
              placeholder={t('agentTeam.activityPlaceholder')}
            />
          </div>

          {listFields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Textarea
                value={listToText((form[f.key] as string[]) || [])}
                onChange={(e) =>
                  setForm({ ...form, [f.key]: textToList(e.target.value) })
                }
                rows={2}
                placeholder={f.hint}
              />
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t('agentTeam.intervalH')}</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={form.orchestratorIntervalH}
                onChange={(e) =>
                  setForm({ ...form, orchestratorIntervalH: Number(e.target.value) || 1 })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>{t('agentTeam.minScore')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.minScoutScoreToHandoff}
                onChange={(e) =>
                  setForm({ ...form, minScoutScoreToHandoff: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.orchestratorEnabled}
                  onChange={(e) => setForm({ ...form, orchestratorEnabled: e.target.checked })}
                />
                {t('agentTeam.enabled')}
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? t('common.loading') : t('common.save')}
            </Button>
            <Button
              variant="outline"
              onClick={() => runNow.mutate()}
              disabled={runNow.isPending}
            >
              {runNow.isPending ? t('common.loading') : t('agentTeam.runNow')}
            </Button>
          </div>
          {save.isSuccess ? (
            <p className="text-xs text-emerald-600">{t('agentTeam.saved')}</p>
          ) : null}
          {runNow.isSuccess ? (
            <p className="text-xs text-emerald-600">{t('agentTeam.runStarted')}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
