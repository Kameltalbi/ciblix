import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/form-controls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Thresholds = {
  chaudScore: number;
  chaudJours: number;
  relanceJours: number;
  tiedeScore: number;
  archiveJours: number;
};

export function PipelineSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ thresholds: Thresholds }>({
    queryKey: ['org-pipeline-config'],
    queryFn: () => api.get('/organizations/config/pipeline').then((r) => r.data),
  });

  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [warning, setWarning] = useState('');

  useEffect(() => {
    if (data?.thresholds) setThresholds(data.thresholds);
  }, [data]);

  useEffect(() => {
    if (!thresholds) return;
    if (thresholds.chaudScore < thresholds.tiedeScore) {
      setWarning('Le seuil "chaud" devrait être ≥ au seuil "tiède".');
    } else {
      setWarning('');
    }
  }, [thresholds]);

  const save = useMutation({
    mutationFn: () => api.put('/organizations/config/pipeline', thresholds).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['org-pipeline-config'] });
      alert('Seuils pipeline enregistrés');
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      alert(e?.response?.data?.error || 'Erreur');
    },
  });

  if (isLoading || !thresholds) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const fields: Array<{ key: keyof Thresholds; label: string }> = [
    { key: 'chaudScore', label: 'Score minimum "Chaud"' },
    { key: 'chaudJours', label: 'Jours max pour rester "Chaud"' },
    { key: 'tiedeScore', label: 'Score minimum "Tiède"' },
    { key: 'relanceJours', label: 'Jours avant "À relancer"' },
    { key: 'archiveJours', label: 'Jours avant archivage' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pipeline inféré (IA)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Statut calculé automatiquement — ces seuils ajustent la classification uniquement.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <Input
              type="number"
              value={thresholds[f.key]}
              onChange={(e) =>
                setThresholds({ ...thresholds, [f.key]: Number(e.target.value) })
              }
            />
          </div>
        ))}
        {warning ? <p className="text-xs text-amber-700">{warning}</p> : null}
        <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || Boolean(warning)}>
          Enregistrer
        </Button>
      </CardContent>
    </Card>
  );
}
