import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function ComplianceSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{
    agentEventRawRetentionDays: number;
    telephonyRecordingConsentMode: string;
    telephonyConsentConfirmedAt: string | null;
  }>({
    queryKey: ['org-compliance-config'],
    queryFn: () => api.get('/organizations/config/compliance').then((r) => r.data),
  });

  const [retentionDays, setRetentionDays] = useState('90');

  useEffect(() => {
    if (data?.agentEventRawRetentionDays) {
      setRetentionDays(String(data.agentEventRawRetentionDays));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api
        .put('/organizations/config/compliance', {
          agentEventRawRetentionDays: Number(retentionDays) || 90,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org-compliance-config'] });
      alert('Paramètres conformité enregistrés');
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Conformité & rétention</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ciblix fournit les mécanismes techniques (consentement, effacement). Vous restez responsable
          de l&apos;obtention du consentement auprès de vos contacts.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Rétention des enregistrements bruts (jours)</Label>
          <Input
            type="number"
            min={7}
            max={365}
            value={retentionDays}
            onChange={(e) => setRetentionDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Transcriptions et fichiers audio stockés temporairement avant purge automatique.
          </p>
        </div>
        <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
          <p>
            Téléphonie / visio :{' '}
            <strong>{data?.telephonyRecordingConsentMode || 'DISABLED'}</strong>
            {data?.telephonyConsentConfirmedAt
              ? ` (confirmé le ${new Date(data.telephonyConsentConfirmedAt).toLocaleDateString('fr-FR')})`
              : ''}
          </p>
          <p>Configurez le mode téléphonie dans l&apos;onglet Intégrations.</p>
        </div>
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
